"""
物理模拟路由（含豆包多模态接入、元素参数聚合与精灵裁剪）
---------------------------------
功能：
- `/upload`：接收前端图片并保存到 `uploads/physics`，同步执行两步：
  1) 预热 SAM embedding（避免首次交互卡顿）；
  2) 调用豆包多模态分析图片，返回识别到的元素及耗时；
   响应包含：
   - `path`：图片保存路径；
   - `embed_ms`：预热耗时；
   - `ai_ms`：多模态识别耗时（失败时为 -1）；
   - `elements`：简化名称数组；
   - `elements_detailed`：规范化后的元素详情（含 `id`/`display_name`/`role`/`parameters`），对同名元素自动做 A/B 标注；
   - `analysis`：保留 `assumptions` 与 `confidence` 等额外信息；
   - `doubao_error`：当多模态调用异常时的错误信息。
- `/segment`：根据点或框选调用 SAM 生成掩码，提取轮廓坐标（像素坐标）。
- `/simulate`：接收图片路径、元素名称集合与各自轮廓坐标，使用 OpenCV 精准裁剪每个元素的精灵图，返回 `objects` 列表（含 `sprite_data_url` 与坐标）。

本次修改（刚体碰撞参数透传）：
- `/simulate` 增强：除名称与轮廓外，支持透传每个元素的 `role` 与 `parameters`（初速度、摩擦、弹性等），
  以便前端物理引擎在创建刚体时应用这些属性。

本次修改（动态物体消除 + 背景修复）：
- 在 `/simulate` 汇总所有 `role=dynamic` 的轮廓，调用 OpenCV inpaint 移除图中的动态物体并修复背景；
- 响应新增 `background_clean_data_url` 字段（PNG data URL），前端直接作为背景显示。

后续扩展：
- 在 `/simulate` 中整合几何参数提取与元素参数合并，返回给前端用作真实物理引擎模拟；
- 在 `/upload` 增加题目文本，以提升参数推断准确性。
"""

from fastapi import APIRouter, UploadFile, File
from typing import Dict, List
from uuid import uuid4
import asyncio
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from ..models.response_schema import ApiResponse
from ..models.physics_schema import PhysicsSegmentRequest, PhysicsSimulateRequest
from ..utils.file_utils import save_upload_file
from ..utils.logger import log
from ..services.segment_service import segment_with_points, segment_with_box, preload_image
from ..services.multimodal_service import analyze_physics_image
from ..services.opencv_service import extract_sprite, inpaint_remove_objects


router = APIRouter()

# ========================================================================
# 并发控制：使用信号量限制同时进行预热+AI识别的用户数量
# - 最多允许5个用户同时处理（预热+AI识别）
# - 第6个及之后的用户会自动排队等待
# - 当有用户处理完成后，排队的下一个用户自动获得处理资格
# ========================================================================
_upload_semaphore = asyncio.Semaphore(5)
_executor = ThreadPoolExecutor(max_workers=10)  # 全局线程池，复用避免重复创建


def _normalize_elements(full: Dict[str, object] | None) -> List[Dict[str, object]]:
    """将多模态返回的元素标准化，保留原始名称，不再对同名元素添加标注。

    2025-11-23 更新：
    - 新增 element_type 字段：决定前端交互行为（rigid_body/pendulum_bob/spring_constraint/spring_launcher/pivot/anchor/surface）
    - 新增 constraints 字段：包含约束关系信息（needs_pivot/needs_second_pivot/suggested_pivot/pivot_prompt/second_pivot_prompt/constraint_type）
    - 新增 visual_description 字段：大模型生成的视觉描述，帮助用户识别元素

    2025-11-25 更新（弹簧系统支持）：
    - element_type 新增 spring_constraint 和 spring_launcher 两种弹簧类型
    - constraints 新增 needs_second_pivot 和 second_pivot_prompt 字段，支持两端点选择
    - spring_constraint: 约束型弹簧，连接两个物体
    - spring_launcher: 弹射型弹簧，一端固定，另一端弹射物体
    """
    raw_list: List[object] = []
    allowed_types = {
        "rigid_body",
        "pendulum_bob",
        "spring_constraint",
        "spring_launcher",
        "pivot",
        "anchor",
        "surface",
        "conveyor_belt",
    }
    if isinstance(full, dict):
        tmp = full.get("elements", []) or []
        raw_list = tmp if isinstance(tmp, list) else []
    normalized: List[Dict[str, object]] = []
    for i, item in enumerate(raw_list):
        base_name = item.get("name") if isinstance(item, dict) else None
        base_name = base_name if isinstance(base_name, str) and base_name else "未知元素"
        role = item.get("role") if isinstance(item, dict) else None
        params = item.get("parameters") if isinstance(item, dict) else {}
        if not isinstance(params, dict):
            params = {}
        # 提取凹面体标识，由大模型判断
        is_concave = item.get("is_concave", False) if isinstance(item, dict) else False

        # 提取元素类型（element_type），决定前端交互行为
        # rigid_body: 普通刚体 | pendulum_bob: 摆球 | spring_constraint: 约束型弹簧 | spring_launcher: 弹射型弹簧 | pivot/anchor: 支点 | surface: 表面
        element_type = item.get("element_type", "rigid_body") if isinstance(item, dict) else "rigid_body"
        if element_type not in allowed_types:
            continue

        # 提取视觉描述，帮助用户在图片中识别元素
        visual_description = item.get("visual_description", "") if isinstance(item, dict) else ""

        # 提取约束关系信息
        constraints_raw = item.get("constraints", {}) if isinstance(item, dict) else {}
        if not isinstance(constraints_raw, dict):
            constraints_raw = {}

        # 标准化约束信息（2025-11-25 更新：添加弹簧系统的双端点支持）
        constraints = {
            # 是否需要用户选择第一个支点（pendulum_bob/spring_constraint/spring_launcher 应为 true）
            "needs_pivot": bool(constraints_raw.get("needs_pivot", False)),
            # 是否需要用户选择第二个支点（spring_constraint/spring_launcher 应为 true）
            "needs_second_pivot": bool(constraints_raw.get("needs_second_pivot", False)),
            # 大模型建议的支点元素名称
            "suggested_pivot": constraints_raw.get("suggested_pivot") or None,
            # 前端显示的第一个端点提示文案
            "pivot_prompt": constraints_raw.get("pivot_prompt") or None,
            # 前端显示的第二个端点提示文案（弹簧系统专用）
            "second_pivot_prompt": constraints_raw.get("second_pivot_prompt") or None,
            # 约束类型：pendulum/spring/rope/hinge/none
            "constraint_type": constraints_raw.get("constraint_type", "none") or "none",
        }

        if element_type == "pendulum_bob":
            constraints["needs_pivot"] = True
            constraints["needs_second_pivot"] = False
            constraints["constraint_type"] = "pendulum"
            if constraints.get("pivot_prompt") is None:
                constraints["pivot_prompt"] = "请选择摆球的支点"

        # 传送带类型规整与速度参数透传
        name_lower = str(base_name).lower()
        desc_lower = str(visual_description).lower()
        # ========================================================================
        # 【2026-01-28 优化】严格判断传送带，避免误识别
        # 只有以下情况才识别为传送带：
        # 1. element_type 明确为 "conveyor_belt"
        # 2. 名称/描述中包含完整的传送带关键词（避免 "belt" 这种过于宽泛的词）
        # ========================================================================
        is_conveyor = (
            element_type == "conveyor_belt"
            or ("传送带" in base_name)
            or ("传送带" in visual_description)
            or ("conveyor" in name_lower and "belt" in name_lower)  # 要求同时包含
            or ("conveyor" in desc_lower and "belt" in desc_lower)  # 要求同时包含
            or ("输送带" in base_name)
            or ("输送带" in visual_description)
        )
        if is_conveyor:
            element_type = "conveyor_belt"
            # 保持模型返回的 role，不在此强制静态
            sp = None
            for k in ("conveyor_speed", "belt_speed", "speed", "velocity"):
                v = params.get(k)
                if isinstance(v, (int, float)):
                    sp = float(v)
                    break
                if isinstance(v, str):
                    try:
                        sp = float(v)
                        break
                    except Exception:
                        pass
            # ====================================================================
            # 【2026-01-28 修复】只有找到有效速度值时才设置 conveyor_speed
            # 避免给所有物体都添加 conveyor_speed: 0.0，导致前端误判
            # ====================================================================
            if sp is not None and sp != 0:
                params["conveyor_speed"] = sp

        normalized.append({
            "id": f"{base_name}-{i}",
            "name": base_name,
            "display_name": base_name,
            "role": role or "unknown",
            "parameters": params,
            "is_concave": bool(is_concave),  # 凹面体标识，前端用于显示和物理引擎处理
            "element_type": element_type,     # 元素类型，决定前端交互行为
            "visual_description": visual_description,  # 视觉描述，帮助用户识别
            "constraints": constraints,       # 约束关系信息
        })
    return normalized


@router.post("/upload", response_model=ApiResponse)
async def upload_image(file: UploadFile = File(...)):
    """保存物理模拟图片，预热 embedding 并调用豆包分析，返回元素与耗时。

    并发控制：
    - 最多允许5个用户同时进行预热+AI识别
    - 第6个及之后的用户会自动排队等待
    - 处理完成后自动释放资源，让排队的下一个用户进入

    返回字段说明：
    - `path`: 图片在后端的保存路径（字符串）。
    - `embed_ms`: 预热 embedding 的耗时（毫秒）。
    - `ai_ms`: 豆包多模态分析耗时（毫秒），当为 -1 表示调用失败或未启用。
    - `total_ms`: 并行执行的总耗时（毫秒），等于 max(embed_ms, ai_ms)。
    - `wait_ms`: 排队等待的耗时（毫秒），如果无需等待则为 0。
    - `elements`: 模型识别到的元素名称数组（已做简化）。
    - `doubao_error`: 当调用异常时附带错误信息，方便前端直观展示问题来源。
    """
    import time
    request_start = time.perf_counter()
    
    # 保存图片
    save_path = save_upload_file("physics", file)
    log.info(f"[上传] 图片已保存: {save_path}")
    
    # 检查当前排队情况
    available_slots = _upload_semaphore._value
    waiting_count = max(0, 5 - available_slots)
    if waiting_count > 0:
        log.info(f"[排队] 当前有 {waiting_count} 个用户正在处理，本次请求将等待...")
    
    # ========================================================================
    # 【并发控制】使用信号量限制并发数
    # - 获得信号量令牌后，才能开始预热和AI识别
    # - 两个任务并行执行，都完成后才释放令牌
    # - 第6个及之后的用户会在这里自动排队等待
    # ========================================================================
    async with _upload_semaphore:
        processing_start = time.perf_counter()
        wait_ms = int((processing_start - request_start) * 1000)
        
        if wait_ms > 100:
            log.info(f"[获得资格] 等待了 {wait_ms}ms，开始处理: {save_path}")
        else:
            log.info(f"[开始处理] 无需等待，立即处理: {save_path}")
        
        # 定义预热任务
        async def preload_task():
            try:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(_executor, preload_image, str(save_path))
            except Exception as e:
                log.error(f"[预热失败] {e}")
                return -1
        
        # 定义AI分析任务
        async def ai_task():
            try:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(_executor, analyze_physics_image, str(save_path))
            except Exception as e:
                log.error(f"[AI失败] {e}")
                return {"ai_ms": -1, "elements": [], "full": None, "error": str(e)}
        
        # 并行执行预热和AI识别，等待两者都完成
        embed_ms, ai_result = await asyncio.gather(preload_task(), ai_task())
        
        processing_ms = int((time.perf_counter() - processing_start) * 1000)
        log.info(f"[处理完成] 预热耗时={embed_ms}ms, AI耗时={ai_result.get('ai_ms', -1)}ms, 处理总耗时={processing_ms}ms")
    
    # 信号量已释放，下一个排队的用户可以开始处理了
    
    # 计算总耗时（包含排队时间）
    total_ms = int((time.perf_counter() - request_start) * 1000)
    
    # 处理AI分析结果
    ai_ms = int(ai_result.get("ai_ms", -1))
    elements = ai_result.get("elements", [])
    full = ai_result.get("full")
    elements_detailed = _normalize_elements(full)
    analysis = {
        "elements": elements_detailed,
        "assumptions": (full or {}).get("assumptions", []),
        "confidence": (full or {}).get("confidence"),
    }
    doubao_error = ai_result.get("error") or None
    
    log.info(f"[响应返回] 路径={save_path}, 总耗时={total_ms}ms (其中等待={wait_ms}ms), 元素数={len(elements)}")

    return ApiResponse.ok({
        "path": str(save_path),
        "embed_ms": embed_ms,
        "ai_ms": ai_ms,
        "total_ms": total_ms,
        "wait_ms": wait_ms,  # 新增：排队等待耗时
        "elements": elements,
        "elements_detailed": elements_detailed,
        "analysis": analysis,
        "doubao_error": doubao_error,
    })


@router.post("/segment", response_model=ApiResponse)
async def segment(req: PhysicsSegmentRequest):
    """调用 SAM 根据点击点或框选生成掩码并返回轮廓坐标。"""
    if not req.image_path:
        return ApiResponse.error("请先上传图片后再进行分割")

    try:
        contour = []
        if req.box:
            # 优先使用框选
            bx = tuple(int(v) for v in req.box)
            contour = segment_with_box(req.image_path, bx)
        else:
            # 退化为点提示
            pts = [(p.x, p.y) for p in (req.points or [])]
            contour = segment_with_points(req.image_path, pts)
    except Exception as e:
        log.error(f"SAM 分割失败: {e}")
        return ApiResponse.error("分割失败，请检查模型与依赖")

    log.info(f"Segment contour points: {len(contour)}")
    contour_dicts = [{"x": int(x), "y": int(y)} for (x, y) in contour]
    return ApiResponse.ok({"contour": contour_dicts})


@router.post("/simulate", response_model=ApiResponse)
async def simulate(req: PhysicsSimulateRequest):
    """接收图片路径、元素与各自轮廓坐标，返回模拟任务ID与裁剪后的精灵。"""
    task_id = f"sim-{uuid4().hex[:8]}"
    objects: List[Dict[str, object]] = []
    # 兼容两种元素输入形态：完整元素对象或简化字符串数组
    names: List[str] = []
    roles_in: List[str] = []
    params_in: List[Dict[str, object]] = []
    try:
        if isinstance(req.elements, list) and len(req.elements) > 0:
            # 完整元素对象
            for el in req.elements:
                nm = getattr(el, "name", None) or "elem"
                names.append(nm)
                roles_in.append(getattr(el, "role", None) or "unknown")
                p = getattr(el, "parameters", None)
                params_in.append(dict(p) if isinstance(p, dict) else (p.dict() if p is not None else {}))
        else:
            # 旧版：字符串名称数组 + 对齐的角色/参数列表
            names = list(req.elements_simple or [])
            roles_in = list(req.roles or [])
            params_in = list(req.parameters_list or [])
    except Exception:
        names = list(req.elements_simple or [])
        roles_in = list(req.roles or [])
        params_in = list(req.parameters_list or [])
    dyn_contours: List[List[tuple[int, int]]] = []
    try:
        for i, pts in enumerate(req.contours or []):
            # 兼容多形态：Point | dict{x,y} | (x,y)
            contour_xy = []
            for p in pts:
                try:
                    if hasattr(p, "x") and hasattr(p, "y"):
                        contour_xy.append((int(p.x), int(p.y)))
                    elif isinstance(p, dict):
                        contour_xy.append((int(p.get("x", 0)), int(p.get("y", 0))))
                    elif isinstance(p, (list, tuple)) and len(p) >= 2:
                        contour_xy.append((int(p[0]), int(p[1])))
                except Exception:
                    pass
            sprite_url = None
            try:
                if req.image_path:
                    sprite_url = extract_sprite(req.image_path, contour_xy)
            except Exception as e:
                log.error(f"extract_sprite failed: {e}")
            name = names[i] if i < len(names) else f"elem-{i}"
            role = None
            params = None
            # 兼容：角色与参数列表（或来自完整元素）
            if i < len(roles_in):
                role = roles_in[i]
            if i < len(params_in):
                params = params_in[i]

            objects.append({
                "name": name,
                "role": role or "unknown",
                "parameters": params or {},
                "sprite_data_url": sprite_url,
                "contour": [{"x": x, "y": y} for (x, y) in contour_xy],
            })
            # 收集需要从背景中移除的元素轮廓（动态物体 + 约束类元素如弹簧）
            # 2025-11-25 更新：弹簧的 role 为 "constraint"，也需要从背景中移除
            if contour_xy and ((role or "unknown") == "dynamic" or (role or "unknown") == "constraint"):
                dyn_contours.append(contour_xy)
    except Exception as e:
        log.error(f"simulate failed: {e}")
        return ApiResponse.error("模拟任务创建失败")

    background_clean = None
    try:
        if req.image_path and dyn_contours:
            background_clean = inpaint_remove_objects(req.image_path, dyn_contours)
    except Exception as e:
        log.error(f"inpaint background failed: {e}")

    payload: Dict[str, object] = {
        "simulation_id": task_id,
        "objects": objects,
        "background_clean_data_url": background_clean,
    }
    log.info(f"Create simulate task: id={task_id}, count={len(objects)}")
    return ApiResponse.ok(payload)
