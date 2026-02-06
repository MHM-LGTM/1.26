"""
用户数据模型
---------------------------------
功能：
- 定义 User 表结构，用于存储用户注册信息
- 字段包括：id、手机号、密码哈希、创建时间、最后登录时间
- 支持会员系统：is_vip、vip_expires_at

使用：
- 用于用户注册、登录验证
- 手机号作为唯一标识
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Date
from datetime import datetime, date
from .base import Base


class User(Base):
    """用户模型"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, comment="用户ID")
    phone_number = Column(String(11), unique=True, index=True, nullable=False, comment="手机号")
    hashed_password = Column(String(255), nullable=False, comment="密码哈希")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    last_login = Column(DateTime, nullable=True, comment="最后登录时间")
    
    # 会员系统
    is_vip = Column(Boolean, default=False, comment="是否为会员")
    vip_expires_at = Column(Date, nullable=True, comment="会员到期日期")
    
    def __repr__(self):
        return f"<User(id={self.id}, phone={self.phone_number}, vip={self.is_vip})>"
    
    @property
    def is_vip_active(self) -> bool:
        """判断会员是否有效（未过期）"""
        if not self.is_vip:
            return False
        if self.vip_expires_at is None:
            return True  # 永久会员
        return date.today() <= self.vip_expires_at


class UserUsageRecord(Base):
    """用户每日使用记录"""
    __tablename__ = "user_usage_records"
    
    id = Column(Integer, primary_key=True, index=True, comment="记录ID")
    user_id = Column(Integer, index=True, nullable=False, comment="用户ID")
    date = Column(Date, default=date.today, nullable=False, comment="日期")
    animation_count = Column(Integer, default=0, comment="当日动画制作次数")
    
    def __repr__(self):
        return f"<UserUsageRecord(user_id={self.user_id}, date={self.date}, count={self.animation_count})>"


class MembershipTransaction(Base):
    """会员交易记录"""
    __tablename__ = "membership_transactions"
    
    id = Column(Integer, primary_key=True, index=True, comment="交易ID")
    user_id = Column(Integer, index=True, nullable=False, comment="用户ID")
    transaction_type = Column(String(20), nullable=False, comment="交易类型：purchase(购买), grant(赠送), renew(续费)")
    days = Column(Integer, nullable=False, comment="会员天数")
    amount = Column(Integer, default=0, comment="金额（分）")
    payment_method = Column(String(20), nullable=True, comment="支付方式：alipay, wechat, free等")
    payment_status = Column(String(20), default="pending", comment="支付状态：pending, success, failed")
    order_id = Column(String(100), unique=True, nullable=True, comment="订单号")
    note = Column(String(255), nullable=True, comment="备注")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    
    def __repr__(self):
        return f"<MembershipTransaction(id={self.id}, user_id={self.user_id}, type={self.transaction_type})>"




