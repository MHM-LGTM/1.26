"""
会员服务
---------------------------------
功能：
- 检查用户会员状态
- 管理每日使用次数限制
- 开通/续费会员（目前支持管理员手动赠送，后期对接支付）

使用：
- 在需要限制的接口中调用 check_usage_limit 检查权限
- 在消耗次数的接口中调用 increment_usage 增加使用次数
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta
from typing import Tuple

from ..models.user import User, UserUsageRecord, MembershipTransaction
from ..utils.logger import log


# 非会员每日限制
FREE_USER_DAILY_LIMIT = 5


class MembershipService:
    """会员服务"""
    
    @staticmethod
    async def check_user_vip_status(user: User) -> bool:
        """
        检查用户是否为有效会员
        
        Args:
            user: 用户对象
            
        Returns:
            是否为有效会员
        """
        return user.is_vip_active
    
    @staticmethod
    async def get_today_usage(user_id: int, db: AsyncSession) -> int:
        """
        获取用户今日使用次数
        
        Args:
            user_id: 用户ID
            db: 数据库会话
            
        Returns:
            今日使用次数
        """
        today = date.today()
        
        stmt = select(UserUsageRecord).where(
            UserUsageRecord.user_id == user_id,
            UserUsageRecord.date == today
        )
        
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        
        return record.animation_count if record else 0
    
    @staticmethod
    async def check_usage_limit(user: User, db: AsyncSession) -> Tuple[bool, str, dict]:
        """
        检查用户是否可以继续使用（制作动画）
        
        Args:
            user: 用户对象
            db: 数据库会话
            
        Returns:
            (是否允许, 消息, 额外数据)
        """
        # 会员无限制
        if user.is_vip_active:
            return True, "会员用户无限制", {
                "is_vip": True,
                "remaining": -1  # -1 表示无限
            }
        
        # 非会员检查今日次数
        today_count = await MembershipService.get_today_usage(user.id, db)
        
        if today_count >= FREE_USER_DAILY_LIMIT:
            return False, f"今日次数已用完（{FREE_USER_DAILY_LIMIT}/{FREE_USER_DAILY_LIMIT}），开通会员享受无限次数", {
                "is_vip": False,
                "used": today_count,
                "limit": FREE_USER_DAILY_LIMIT,
                "remaining": 0
            }
        
        return True, f"今日剩余次数：{FREE_USER_DAILY_LIMIT - today_count}", {
            "is_vip": False,
            "used": today_count,
            "limit": FREE_USER_DAILY_LIMIT,
            "remaining": FREE_USER_DAILY_LIMIT - today_count
        }
    
    @staticmethod
    async def increment_usage(user_id: int, db: AsyncSession) -> None:
        """
        增加用户今日使用次数（仅非会员需要记录）
        
        Args:
            user_id: 用户ID
            db: 数据库会话
        """
        today = date.today()
        
        # 查询今日记录
        stmt = select(UserUsageRecord).where(
            UserUsageRecord.user_id == user_id,
            UserUsageRecord.date == today
        )
        
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        
        if record:
            # 更新次数
            record.animation_count += 1
        else:
            # 创建新记录
            record = UserUsageRecord(
                user_id=user_id,
                date=today,
                animation_count=1
            )
            db.add(record)
        
        await db.commit()
        log.info(f"用户 {user_id} 今日使用次数: {record.animation_count}")
    
    @staticmethod
    async def grant_vip(
        user_id: int,
        days: int,
        db: AsyncSession,
        note: str = "管理员赠送"
    ) -> Tuple[bool, str]:
        """
        赠送会员（管理员操作或后期对接支付）
        
        Args:
            user_id: 用户ID
            days: 会员天数（0表示永久）
            db: 数据库会话
            note: 备注
            
        Returns:
            (是否成功, 消息)
        """
        try:
            # 查询用户
            stmt = select(User).where(User.id == user_id)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()
            
            if not user:
                return False, "用户不存在"
            
            # 计算到期日期
            if days == 0:
                # 永久会员
                expires_at = None
            else:
                # 如果已经是会员，从原到期日期续费；否则从今天开始
                if user.is_vip and user.vip_expires_at and user.vip_expires_at > date.today():
                    expires_at = user.vip_expires_at + timedelta(days=days)
                else:
                    expires_at = date.today() + timedelta(days=days)
            
            # 更新用户会员状态
            user.is_vip = True
            user.vip_expires_at = expires_at
            
            # 创建交易记录
            transaction = MembershipTransaction(
                user_id=user_id,
                transaction_type="grant",
                days=days,
                amount=0,
                payment_method="free",
                payment_status="success",
                note=note
            )
            db.add(transaction)
            
            await db.commit()
            
            expires_text = "永久" if days == 0 else f"至 {expires_at}"
            log.info(f"用户 {user_id} 开通会员：{days}天，到期：{expires_text}")
            
            return True, f"会员开通成功，有效期{expires_text}"
            
        except Exception as e:
            await db.rollback()
            log.error(f"开通会员失败：{e}")
            return False, f"开通失败：{str(e)}"
    
    @staticmethod
    async def get_user_usage_stats(user: User, db: AsyncSession) -> dict:
        """
        获取用户使用统计
        
        Args:
            user: 用户对象
            db: 数据库会话
            
        Returns:
            统计数据
        """
        today_count = await MembershipService.get_today_usage(user.id, db)
        
        stats = {
            "is_vip": user.is_vip_active,
            "vip_expires_at": user.vip_expires_at.isoformat() if user.vip_expires_at else None,
            "today_used": today_count,
            "daily_limit": FREE_USER_DAILY_LIMIT,
            "remaining": -1 if user.is_vip_active else max(0, FREE_USER_DAILY_LIMIT - today_count)
        }
        
        return stats


# 单例服务
membership_service = MembershipService()
