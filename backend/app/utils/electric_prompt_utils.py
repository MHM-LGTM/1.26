"""
电学场景多模态分析提示词
---------------------------------
功能：
- 提供电学场景专用的系统提示词
- 只识别电学元件，不识别导线（导线由前端算法处理）
- 精简提示词，加快 AI 响应速度

设计理念：
- 开关只识别断开状态
- 不需要返回导线连接关系
- 返回结构简洁，便于前端处理

2026-02-01 创建
"""

from __future__ import annotations
from typing import Optional


def electric_analysis_system_prompt() -> str:
    """返回电学场景的系统提示词，指导模型识别电学元件。
    
    注意：
    - 只识别元件，不识别导线
    - 开关只识别断开状态
    - 提示词精简，加快响应速度
    """
    return (
        "你是一名物理电学教学助理。请识别图片中的电路元件（不需要识别导线）。"
        "\n\n必须仅输出一个严格的 JSON 对象，不要包含任何多余文字或 Markdown。"
        "\nJSON 结构如下：\n"
        "{\n"
        "  \"elements\": [\n"
        "    {\n"
        "      \"name\": \"电源\" | \"电阻\" | \"小灯泡\" | \"开关\" | \"电流表\" | \"电压表\" | \"滑动变阻器\",\n"
        "      \"element_type\": \"battery\" | \"resistor\" | \"lamp\" | \"switch\" | \"ammeter\" | \"voltmeter\" | \"rheostat\",\n"
        "      \"visual_description\": \"该元件的视觉特征描述，帮助用户在图中找到它\"\n"
        "    }\n"
        "  ],\n"
        "  \"assumptions\": [string],\n"
        "  \"confidence\": 0.0_to_1.0\n"
        "}\n\n"
        "元件识别规则：\n"
        "- 电源（battery）：长短两条竖线（电池符号），长线为正极\n"
        "- 电阻（resistor）：矩形方框或锯齿形符号\n"
        "- 小灯泡（lamp）：圆圈内有交叉线（X形）\n"
        "- 开关（switch）：断开的线段（只识别断开状态的开关）\n"
        "- 电流表（ammeter）：圆圈内有字母 A\n"
        "- 电压表（voltmeter）：圆圈内有字母 V\n"
        "- 滑动变阻器（rheostat）：矩形带滑动箭头或滑片\n\n"
        "注意事项：\n"
        "- 不需要识别导线，前端会自动处理导线连接\n"
        "- 如果图中有多个相同类型的元件，请分别列出并用 visual_description 区分\n"
        "- visual_description 要简洁明了，如\"左上角的电阻\"、\"中间的小灯泡\"、\"靠近电源的开关\""
    )


def build_electric_user_prompt(user_text: Optional[str] = None) -> str:
    """构造电学场景的用户提示文本。
    
    Args:
        user_text: 可选的题目描述文本
        
    Returns:
        合并的用户提示文本
    """
    base = "请分析图片中的电路图，识别所有电学元件并返回 JSON。"
    if user_text:
        return f"{base}\n题目描述：{user_text.strip()}"
    return base
