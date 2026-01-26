"""
验证码管理服务
---------------------------------
功能：
- 生成随机验证码
- 存储验证码（内存存储，带过期时间）
- 验证验证码是否正确
- 限制同一手机号的发送频率

使用：
- 调用 generate_and_store_code() 生成并存储验证码
- 调用 verify_code() 验证验证码
"""

from datetime import datetime, timedelta
from typing import Literal
import random
import logging
from ..config.settings import (
    VERIFICATION_CODE_EXPIRE_MINUTES,
    VERIFICATION_CODE_LENGTH,
    SMS_RATE_LIMIT_SECONDS,
)

logger = logging.getLogger(__name__)

# 验证码场景类型
VerificationSceneType = Literal["register", "reset_password"]


class VerificationCodeStore:
    """验证码存储（内存存储）"""
    
    def __init__(self):
        # 存储结构: {(phone_number, scene): {"code": "123456", "expire_at": datetime, "created_at": datetime}}
        self._store: dict[tuple[str, str], dict] = {}
    
    def set(
        self,
        phone_number: str,
        scene: VerificationSceneType,
        code: str,
        expire_minutes: int = VERIFICATION_CODE_EXPIRE_MINUTES
    ):
        """
        存储验证码
        
        Args:
            phone_number: 手机号
            scene: 场景
            code: 验证码
            expire_minutes: 过期时间（分钟）
        """
        key = (phone_number, scene)
        now = datetime.now()
        self._store[key] = {
            "code": code,
            "expire_at": now + timedelta(minutes=expire_minutes),
            "created_at": now,
        }
        logger.info(f"验证码已存储: {phone_number}, 场景: {scene}, 过期时间: {expire_minutes}分钟")
    
    def get(self, phone_number: str, scene: VerificationSceneType) -> str | None:
        """
        获取验证码
        
        Args:
            phone_number: 手机号
            scene: 场景
            
        Returns:
            验证码，如果不存在或已过期返回None
        """
        key = (phone_number, scene)
        data = self._store.get(key)
        
        if not data:
            return None
        
        # 检查是否过期
        if datetime.now() > data["expire_at"]:
            # 已过期，删除
            del self._store[key]
            logger.info(f"验证码已过期并被删除: {phone_number}, 场景: {scene}")
            return None
        
        return data["code"]
    
    def delete(self, phone_number: str, scene: VerificationSceneType):
        """
        删除验证码
        
        Args:
            phone_number: 手机号
            scene: 场景
        """
        key = (phone_number, scene)
        if key in self._store:
            del self._store[key]
            logger.info(f"验证码已删除: {phone_number}, 场景: {scene}")
    
    def can_send(
        self,
        phone_number: str,
        scene: VerificationSceneType,
        rate_limit_seconds: int = SMS_RATE_LIMIT_SECONDS
    ) -> tuple[bool, int]:
        """
        检查是否可以发送新验证码（防刷限制）
        
        Args:
            phone_number: 手机号
            scene: 场景
            rate_limit_seconds: 限制间隔（秒）
            
        Returns:
            (是否可以发送, 剩余等待秒数)
        """
        key = (phone_number, scene)
        data = self._store.get(key)
        
        if not data:
            return True, 0
        
        # 计算距离上次发送的时间
        created_at = data["created_at"]
        elapsed = (datetime.now() - created_at).total_seconds()
        
        if elapsed < rate_limit_seconds:
            wait_seconds = int(rate_limit_seconds - elapsed)
            return False, wait_seconds
        
        return True, 0
    
    def cleanup_expired(self):
        """清理所有过期的验证码"""
        now = datetime.now()
        expired_keys = [
            key for key, data in self._store.items()
            if now > data["expire_at"]
        ]
        
        for key in expired_keys:
            del self._store[key]
        
        if expired_keys:
            logger.info(f"清理了 {len(expired_keys)} 个过期验证码")


class VerificationService:
    """验证码服务"""
    
    def __init__(self):
        self.store = VerificationCodeStore()
    
    def generate_code(self, length: int = VERIFICATION_CODE_LENGTH) -> str:
        """
        生成随机数字验证码
        
        Args:
            length: 验证码长度
            
        Returns:
            验证码字符串
        """
        return "".join([str(random.randint(0, 9)) for _ in range(length)])
    
    def generate_and_store_code(
        self,
        phone_number: str,
        scene: VerificationSceneType
    ) -> tuple[bool, str, str]:
        """
        生成并存储验证码
        
        Args:
            phone_number: 手机号
            scene: 场景
            
        Returns:
            (是否成功, 验证码或错误信息, 提示信息)
        """
        # 检查是否可以发送
        can_send, wait_seconds = self.store.can_send(phone_number, scene)
        if not can_send:
            return False, "", f"发送过于频繁，请{wait_seconds}秒后再试"
        
        # 生成验证码
        code = self.generate_code()
        
        # 存储验证码
        self.store.set(phone_number, scene, code)
        
        return True, code, "验证码已生成"
    
    def verify_code(
        self,
        phone_number: str,
        scene: VerificationSceneType,
        code: str,
        delete_after_verify: bool = True
    ) -> tuple[bool, str]:
        """
        验证验证码
        
        Args:
            phone_number: 手机号
            scene: 场景
            code: 待验证的验证码
            delete_after_verify: 验证后是否删除（防止重复使用）
            
        Returns:
            (是否验证通过, 错误信息或成功消息)
        """
        stored_code = self.store.get(phone_number, scene)
        
        if not stored_code:
            return False, "验证码不存在或已过期"
        
        if stored_code != code:
            return False, "验证码错误"
        
        # 验证通过，删除验证码（可选）
        if delete_after_verify:
            self.store.delete(phone_number, scene)
        
        return True, "验证码正确"


# 全局单例
_verification_service = None


def get_verification_service() -> VerificationService:
    """
    获取验证码服务单例
    
    Returns:
        VerificationService实例
    """
    global _verification_service
    if _verification_service is None:
        _verification_service = VerificationService()
    return _verification_service
