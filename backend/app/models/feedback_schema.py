"""
反馈相关的 Pydantic Schema
---------------------------------
功能：
- 定义反馈提交的请求和响应数据结构
- 进行数据验证

使用：
- FeedbackCreate: 用于接收前端提交的反馈数据
- FeedbackResponse: 用于返回反馈信息
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class FeedbackCreate(BaseModel):
    """创建反馈请求"""
    email: EmailStr
    description: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "description": "在使用物理模拟时遇到了页面卡顿的问题..."
            }
        }


class FeedbackResponse(BaseModel):
    """反馈响应"""
    id: int
    email: str
    description: str
    images: Optional[str] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True
