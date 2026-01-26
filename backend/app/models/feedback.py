"""
用户反馈数据模型
---------------------------------
功能：
- 定义 Feedback 表结构，用于存储用户反馈信息
- 字段包括：id、邮箱、问题描述、图片路径、创建时间、状态

使用：
- 用于存储和管理用户反馈
- 支持图片附件存储
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Enum
from datetime import datetime
from .base import Base
import enum


class FeedbackStatus(enum.Enum):
    """反馈状态枚举"""
    PENDING = "pending"  # 待处理
    PROCESSING = "processing"  # 处理中
    RESOLVED = "resolved"  # 已解决
    CLOSED = "closed"  # 已关闭


class Feedback(Base):
    """用户反馈模型"""
    __tablename__ = "feedbacks"
    
    id = Column(Integer, primary_key=True, index=True, comment="反馈ID")
    email = Column(String(255), nullable=False, index=True, comment="联系邮箱")
    description = Column(Text, nullable=False, comment="问题描述")
    images = Column(Text, nullable=True, comment="图片路径（JSON格式存储）")
    status = Column(
        Enum(FeedbackStatus), 
        default=FeedbackStatus.PENDING, 
        nullable=False, 
        comment="处理状态"
    )
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    def __repr__(self):
        return f"<Feedback(id={self.id}, email={self.email}, status={self.status.value})>"
