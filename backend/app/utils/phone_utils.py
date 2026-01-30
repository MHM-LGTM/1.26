"""
手机号工具函数
---------------------------------
功能：
- 手机号格式校验
- 手机号脱敏处理

使用：
- validate_phone_number() - 校验手机号格式
- mask_phone_number() - 脱敏手机号
"""

import re


def validate_phone_number(phone: str) -> bool:
    """
    校验中国大陆手机号格式
    
    Args:
        phone: 手机号字符串
        
    Returns:
        是否符合格式
    """
    pattern = r'^1[3-9]\d{9}$'
    return bool(re.match(pattern, phone))


def mask_phone_number(phone: str) -> str:
    """
    脱敏手机号：138****8888
    
    Args:
        phone: 原始手机号
        
    Returns:
        脱敏后的手机号
    """
    if len(phone) == 11:
        return f"{phone[:3]}****{phone[7:]}"
    return phone
