# -*- coding: utf-8 -*-
"""
电学场景多模态分析服务（豆包 Ark）
---------------------------------
功能：
- 调用豆包多模态分析电路图，识别电学元件
- 使用电学专用提示词，加快响应速度
- 只识别元件，不识别导线（导线由前端算法处理）

2026-02-01 创建
"""
from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional

from ..config.settings import ARK_BASE_URL, ARK_API_KEY, DOUBAO_MODEL_ID
from ..utils.pictures_utils import image_to_data_url
from ..utils.electric_prompt_utils import electric_analysis_system_prompt, build_electric_user_prompt
from ..utils.logger import log


def _get_client():
    """创建 OpenAI 兼容客户端（豆包 Ark）。"""
    try:
        from openai import OpenAI
    except Exception as e:
        raise RuntimeError(f"openai SDK 未安装：{e}")
    if not ARK_API_KEY:
        raise RuntimeError("ARK_API_KEY 未设置，请在环境变量中提供豆包 API Key")
    return OpenAI(base_url=ARK_BASE_URL, api_key=ARK_API_KEY)


def _extract_json(text: str) -> Dict[str, Any]:
    """尽力从文本中提取 JSON 对象。"""
    if not text:
        return {}
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        block = m.group(0)
        try:
            return json.loads(block)
        except Exception:
            log.warning("[电学] extract_json: 正则块解析失败")
    return {}


def _simplify_elements(full: Dict[str, Any]) -> List[str]:
    """将完整结构化结果压缩为元素名称数组。"""
    arr = full.get("elements", []) if isinstance(full, dict) else []
    names: List[str] = []
    for item in arr:
        name = item.get("name") if isinstance(item, dict) else None
        if isinstance(name, str) and name:
            names.append(name)
    return names


def analyze_electric_image(image_path: str, user_text: Optional[str] = None) -> Dict[str, Any]:
    """调用豆包多模态分析电路图并返回结构化结果。
    
    返回字典示例：
    {
      "ai_ms": 1200,
      "elements": ["电源", "电阻", "小灯泡"],
      "full": { ... 原始 JSON ... },
      "raw": "模型原始字符串"
    }
    """
    client = _get_client()
    data_url = image_to_data_url(image_path)
    system_prompt = electric_analysis_system_prompt()
    user_prompt = build_electric_user_prompt(user_text)

    t0 = time.perf_counter()
    try:
        resp = client.chat.completions.create(
            model=DOUBAO_MODEL_ID,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            temperature=0.2,  # 降低随机性，提高一致性
            max_tokens=1024,  # 电学场景输出较短
        )
        raw = resp.choices[0].message.content if resp.choices else ""
        ai_ms = int((time.perf_counter() - t0) * 1000)
        log.info(f"[电学多模态] 识别完成，耗时 {ai_ms}ms")
        
        full = _extract_json(raw)
        elements = _simplify_elements(full)
        
        return {"ai_ms": ai_ms, "elements": elements, "full": full, "raw": raw}
    except Exception as e:
        ai_ms = int((time.perf_counter() - t0) * 1000)
        log.error(f"[电学多模态] 识别失败: {e}")
        return {"ai_ms": -1, "elements": [], "full": None, "raw": "", "error": str(e)}
