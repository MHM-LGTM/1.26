"""
短信服务模块
---------------------------------
功能：
- 使用阿里云短信服务发送短信验证码
- 支持注册、找回密码等场景

使用：
- 调用 send_verification_code() 发送验证码短信
"""

from typing import Literal
from alibabacloud_dysmsapi20170525.client import Client as DysmsClient
from alibabacloud_credentials.client import Client as CredentialClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_dysmsapi20170525 import models as dysmsapi_models
from alibabacloud_tea_util import models as util_models
from ..config.settings import (
    SMS_SIGN_NAME,
    SMS_TEMPLATE_REGISTER,
    SMS_TEMPLATE_RESET_PASSWORD,
)
import json
import logging

logger = logging.getLogger(__name__)

# 短信场景类型
SMSSceneType = Literal["register", "reset_password"]


class SMSService:
    """阿里云短信服务"""
    
    def __init__(self):
        """初始化阿里云短信客户端（使用凭据客户端）"""
        # 使用凭据客户端（会自动从环境变量读取 ALIBABA_CLOUD_ACCESS_KEY_ID 和 ALIBABA_CLOUD_ACCESS_KEY_SECRET）
        credential = CredentialClient()
        config = open_api_models.Config(
            credential=credential,
            endpoint="dysmsapi.aliyuncs.com"
        )
        self.client = DysmsClient(config)
    
    def _get_template_code(self, scene: SMSSceneType) -> str:
        """
        根据场景获取对应的模板CODE
        
        Args:
            scene: 短信场景（register/reset_password）
            
        Returns:
            模板CODE
        """
        if scene == "register":
            return SMS_TEMPLATE_REGISTER
        elif scene == "reset_password":
            return SMS_TEMPLATE_RESET_PASSWORD
        else:
            raise ValueError(f"Unknown SMS scene: {scene}")
    
    async def send_verification_code(
        self,
        phone_number: str,
        code: str,
        scene: SMSSceneType
    ) -> tuple[bool, str]:
        """
        发送短信验证码
        
        Args:
            phone_number: 接收短信的手机号
            code: 验证码
            scene: 短信场景
            
        Returns:
            (是否成功, 错误信息或成功消息)
        """
        try:
            request = dysmsapi_models.SendSmsRequest(
                phone_numbers=phone_number,
                sign_name=SMS_SIGN_NAME,
                template_code=self._get_template_code(scene),
                template_param=json.dumps({"code": code})
            )
            
            runtime = util_models.RuntimeOptions()
            
            # 发送短信
            response = self.client.send_sms_with_options(request, runtime)
            
            # 检查返回结果
            if response.body.code == "OK":
                logger.info(f"短信发送成功: {phone_number}, 场景: {scene}")
                return True, "短信发送成功"
            else:
                error_msg = f"短信发送失败: {response.body.message}"
                logger.error(f"{error_msg}, Code: {response.body.code}")
                return False, error_msg
                
        except Exception as e:
            error_msg = f"短信发送异常: {str(e)}"
            logger.exception(error_msg)
            return False, error_msg


# 全局单例
_sms_service = None


def get_sms_service() -> SMSService:
    """
    获取短信服务单例
    
    Returns:
        SMSService实例
    """
    global _sms_service
    if _sms_service is None:
        _sms_service = SMSService()
    return _sms_service
