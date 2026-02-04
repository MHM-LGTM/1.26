"""
电学场景数据模型
---------------------------------
功能：
- 定义电学元件的数据结构
- 定义 API 请求/响应模型

2026-02-01 创建
"""

from pydantic import BaseModel
from typing import Optional, List


class ElectricParameters(BaseModel):
    """电学元件参数（由前端调节）"""
    voltage_V: Optional[float] = None        # 电源电压
    resistance_ohm: Optional[float] = None   # 电阻值
    is_closed: Optional[bool] = False        # 开关闭合状态


class ElectricElement(BaseModel):
    """电学元件（AI 识别返回）"""
    name: str                                # 元件名称（中文）
    element_type: str                        # 元件类型（英文标识）
    visual_description: Optional[str] = None # 视觉描述


class ElectricElementWithContour(BaseModel):
    """带轮廓的电学元件（用户分割后）"""
    name: str
    element_type: str
    visual_description: Optional[str] = None
    contour: Optional[List[List[int]]] = None  # SAM 分割轮廓
    parameters: Optional[ElectricParameters] = None


class ElectricUploadResponse(BaseModel):
    """上传电路图响应"""
    path: str                                # 图片保存路径
    elements: List[ElectricElement]          # 识别到的元件列表
    confidence: float                        # 置信度
    assumptions: List[str]                   # 假设说明
    ai_ms: int                               # AI 识别耗时
    embed_ms: int                            # SAM 预热耗时


class ElectricSimulateRequest(BaseModel):
    """电路模拟请求"""
    image_path: str                          # 图片路径
    elements: List[ElectricElementWithContour]  # 元件列表（含轮廓）


class ElectricSimulateResponse(BaseModel):
    """电路模拟响应"""
    simulation_id: str                       # 模拟 ID
    elements: List[ElectricElementWithContour]  # 处理后的元件
    background_clean_data_url: Optional[str] = None  # 清理后的背景图
