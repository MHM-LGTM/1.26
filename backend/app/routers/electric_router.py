"""
电学场景路由
---------------------------------
功能：
- `/upload`：接收前端电路图并保存，调用 AI 识别电学元件
- `/simulate`：处理元件轮廓，生成精灵图（复用 OpenCV 服务）

与物理路由的区别：
- 使用电学专用提示词
- 不识别导线（由前端算法处理）
- 简化的元素处理流程

2026-02-01 创建
"""

from fastapi import APIRouter, UploadFile, File, Depends
from typing import Dict, List
from uuid import uuid4
import asyncio
from concurrent.futures import ThreadPoolExecutor

from ..models.response_schema import ApiResponse
from ..models.electric_schema import ElectricSimulateRequest
from ..models.user import User
from ..utils.file_utils import save_upload_file
from ..utils.logger import log
from ..services.segment_service import preload_image
from ..services.electric_multimodal_service import analyze_electric_image
from ..services.opencv_service import extract_sprite, inpaint_remove_objects
from ..services.auth_service import get_current_user


router = APIRouter()

# 并发控制
_upload_semaphore = asyncio.Semaphore(5)
_executor = ThreadPoolExecutor(max_workers=10)


def _normalize_electric_elements(full: Dict[str, object] | None) -> List[Dict[str, object]]:
    """将多模态返回的电学元素标准化。
    
    只处理电学元件类型：
    - battery: 电源
    - resistor: 电阻
    - lamp: 小灯泡
    - switch: 开关
    - ammeter: 电流表
    - voltmeter: 电压表
    - rheostat: 滑动变阻器
    """
    allowed_types = {
        "battery",
        "resistor",
        "lamp",
        "switch",
        "ammeter",
        "voltmeter",
        "rheostat",
    }
    
    raw_list: List[object] = []
    if isinstance(full, dict):
        tmp = full.get("elements", []) or []
        raw_list = tmp if isinstance(tmp, list) else []
    
    normalized: List[Dict[str, object]] = []
    for i, item in enumerate(raw_list):
        if not isinstance(item, dict):
            continue
            
        name = item.get("name", "未知元件")
        element_type = item.get("element_type", "resistor")
        visual_description = item.get("visual_description", "")
        
        # 过滤非电学元件类型
        if element_type not in allowed_types:
            log.warning(f"[电学识别] 忽略非电学元件类型: {element_type}")
            continue
        
        normalized.append({
            "name": name,
            "element_type": element_type,
            "visual_description": visual_description,
        })
    
    return normalized


@router.post("/upload", response_model=ApiResponse)
async def upload_circuit_image(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """保存电路图图片，预热 embedding 并调用 AI 识别电学元件。
    
    **需要登录才能使用此功能**
    
    返回字段说明：
    - `path`: 图片在后端的保存路径
    - `embed_ms`: 预热 embedding 的耗时（毫秒）
    - `ai_ms`: AI 识别耗时（毫秒）
    - `elements`: 识别到的电学元件列表
    - `confidence`: 识别置信度
    - `assumptions`: AI 的假设说明
    """
    import time
    request_start = time.perf_counter()
    
    # 保存图片
    save_path, _ = await save_upload_file(file, "physics")  # 复用 physics 目录
    log.info(f"[电学上传] 图片已保存: {save_path}")
    
    async with _upload_semaphore:
        processing_start = time.perf_counter()
        wait_ms = int((processing_start - request_start) * 1000)
        
        # 定义预热任务
        async def preload_task():
            try:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(_executor, preload_image, str(save_path))
            except Exception as e:
                log.error(f"[电学预热失败] {e}")
                return -1
        
        # 定义AI分析任务
        async def ai_task():
            try:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(_executor, analyze_electric_image, str(save_path))
            except Exception as e:
                log.error(f"[电学AI失败] {e}")
                return {"ai_ms": -1, "elements": [], "full": None, "error": str(e)}
        
        # 并行执行预热和AI识别
        embed_ms, ai_result = await asyncio.gather(preload_task(), ai_task())
        
        processing_ms = int((time.perf_counter() - processing_start) * 1000)
        log.info(f"[电学处理完成] 预热={embed_ms}ms, AI={ai_result.get('ai_ms', -1)}ms")
    
    total_ms = int((time.perf_counter() - request_start) * 1000)
    
    # 处理AI分析结果
    ai_ms = int(ai_result.get("ai_ms", -1))
    full = ai_result.get("full")
    elements = _normalize_electric_elements(full)
    
    assumptions = (full or {}).get("assumptions", [])
    confidence = (full or {}).get("confidence", 0.0)
    
    log.info(f"[电学响应] 路径={save_path}, 总耗时={total_ms}ms, 元件数={len(elements)}")

    return ApiResponse.ok({
        "path": str(save_path),
        "embed_ms": embed_ms,
        "ai_ms": ai_ms,
        "total_ms": total_ms,
        "wait_ms": wait_ms,
        "elements": elements,
        "confidence": confidence,
        "assumptions": assumptions,
        "doubao_error": ai_result.get("error"),
    })


@router.post("/simulate", response_model=ApiResponse)
async def simulate_circuit(req: ElectricSimulateRequest, current_user: User = Depends(get_current_user)):
    """处理电路元件，生成精灵图。
    
    **需要登录才能使用此功能**
    
    注意：导线识别和电路计算由前端处理，后端只负责生成精灵图。
    """
    import time
    import cv2
    import base64
    from pathlib import Path
    
    start = time.perf_counter()
    
    image_path = Path(req.image_path)
    if not image_path.exists():
        return ApiResponse.fail(f"图片不存在: {req.image_path}")
    
    # 读取原始图片
    img = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return ApiResponse.fail(f"无法读取图片: {req.image_path}")
    
    results = []
    dynamic_contours = []
    
    for elem in req.elements:
        contour = elem.contour
        if not contour:
            results.append({
                "name": elem.name,
                "element_type": elem.element_type,
                "sprite_data_url": None,
                "contour": None,
                "parameters": elem.parameters.dict() if elem.parameters else {},
            })
            continue
        
        # 提取精灵图
        sprite_base64 = extract_sprite(img, contour)
        
        results.append({
            "name": elem.name,
            "element_type": elem.element_type,
            "sprite_data_url": f"data:image/png;base64,{sprite_base64}" if sprite_base64 else None,
            "contour": contour,
            "parameters": elem.parameters.dict() if elem.parameters else {},
        })
        
        # 电学场景暂不移除元件（保留原图显示）
        # dynamic_contours.append(contour)
    
    # 暂不处理背景清理（电学场景保留原图）
    background_clean = None
    
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    sim_id = f"电路模拟 #{uuid4().hex[:6]}，处理耗时 {elapsed_ms}ms"
    
    log.info(f"[电学模拟] {sim_id}，元件数={len(results)}")
    
    return ApiResponse.ok({
        "simulation_id": sim_id,
        "objects": results,
        "background_clean_data_url": background_clean,
    })
