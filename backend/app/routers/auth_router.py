"""
认证路由
---------------------------------
功能：
- /auth/register - 用户注册
- /auth/token - 用户登录（获取 Token）
- /auth/me - 获取当前用户信息

使用：
- 前端调用这些接口进行用户注册、登录、获取用户信息
- 登录成功后返回 JWT Token，前端保存并在后续请求中携带
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from datetime import datetime
import re

from ..models.user import User
from ..services.auth_service import hash_password, verify_password, create_access_token, decode_access_token
from ..services.sms_service import get_sms_service
from ..services.verification_service import get_verification_service
from ..config.database import get_db
from ..models.response_schema import ApiResponse
from ..utils.phone_utils import validate_phone_number, mask_phone_number

router = APIRouter()

# OAuth2 密码流（用于提取 Token）
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


# ============================================================================
# Pydantic 模型
# ============================================================================

class SendVerificationCodeRequest(BaseModel):
    """发送验证码请求"""
    phone_number: str = Field(..., min_length=11, max_length=11, description="手机号")
    scene: str = Field(..., description="场景：register(注册) 或 reset_password(找回密码)")


class RegisterRequest(BaseModel):
    """注册请求"""
    phone_number: str = Field(..., min_length=11, max_length=11, description="手机号")
    password: str = Field(..., min_length=6, description="密码")
    verification_code: str = Field(..., min_length=4, max_length=8, description="验证码")


class ResetPasswordRequest(BaseModel):
    """重置密码请求"""
    phone_number: str = Field(..., min_length=11, max_length=11, description="手机号")
    verification_code: str = Field(..., min_length=4, max_length=8, description="验证码")
    new_password: str = Field(..., min_length=6, description="新密码")


class UserResponse(BaseModel):
    """用户信息响应"""
    id: int
    phone_number: str


# ============================================================================
# 认证依赖函数
# ============================================================================

async def get_current_user_optional(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User | None:
    """
    依赖注入：获取当前登录用户（可选认证）
    
    用法：
    @router.get("/optional-protected")
    async def optional_protected(current_user: User = Depends(get_current_user_optional)):
        if current_user:
            # 已登录用户逻辑
        else:
            # 未登录用户逻辑
    
    Args:
        token: JWT Token
        db: 数据库会话
        
    Returns:
        当前用户对象，未登录返回 None
    """
    if not token:
        return None
    
    payload = decode_access_token(token)
    if not payload:
        return None
    
    user_id = payload.get("user_id")
    if not user_id:
        return None
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    return user


# ============================================================================
# API 路由
# ============================================================================

@router.post("/send-code", response_model=ApiResponse)
async def send_verification_code(req: SendVerificationCodeRequest):
    """
    发送短信验证码
    
    请求体：
    - phone_number: 手机号（11位）
    - scene: 场景（register/reset_password）
    
    返回：
    - 发送结果
    """
    
    # 校验手机号格式
    if not validate_phone_number(req.phone_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式错误"
        )
    
    # 校验场景
    if req.scene not in ["register", "reset_password"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="场景参数错误，必须是 register 或 reset_password"
        )
    
    # 获取服务
    verification_service = get_verification_service()
    sms_service = get_sms_service()
    
    # 生成并存储验证码
    success, code, message = verification_service.generate_and_store_code(
        req.phone_number,
        req.scene  # type: ignore
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=message
        )
    
    # 发送短信
    sms_success, sms_message = await sms_service.send_verification_code(
        req.phone_number,
        code,
        req.scene  # type: ignore
    )
    
    if not sms_success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"短信发送失败: {sms_message}"
        )
    
    return ApiResponse.ok({
        "message": "验证码已发送，请注意查收",
        "phone_number": mask_phone_number(req.phone_number)
    })


@router.post("/register", response_model=ApiResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    用户注册
    
    请求体：
    - phone_number: 手机号（11位）
    - password: 密码（至少6位）
    - verification_code: 验证码
    
    返回：
    - 注册成功的用户信息
    """
    
    # 校验手机号格式
    if not validate_phone_number(req.phone_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式错误"
        )
    
    # 验证验证码
    verification_service = get_verification_service()
    verify_success, verify_message = verification_service.verify_code(
        req.phone_number,
        "register",
        req.verification_code
    )
    
    if not verify_success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=verify_message
        )
    
    # 检查手机号是否已存在
    result = await db.execute(
        select(User).where(User.phone_number == req.phone_number)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该手机号已注册"
        )
    
    # 创建用户
    hashed_pwd = hash_password(req.password)
    new_user = User(
        phone_number=req.phone_number,
        hashed_password=hashed_pwd
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return ApiResponse.ok({
        "id": new_user.id,
        "phone_number": mask_phone_number(new_user.phone_number),
        "message": "注册成功"
    })


@router.post("/token", response_model=ApiResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    用户登录（获取 Token）
    
    请求体（application/x-www-form-urlencoded）：
    - username: 手机号（字段名必须是 username，符合 OAuth2 标准）
    - password: 密码
    
    返回：
    - access_token: JWT Token
    - token_type: "bearer"
    - user: 用户信息
    """
    
    # form_data.username 实际上是手机号
    phone_number = form_data.username
    password = form_data.password
    
    # 查询用户
    result = await db.execute(
        select(User).where(User.phone_number == phone_number)
    )
    user = result.scalar_one_or_none()
    
    # 验证用户和密码
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码错误"
        )
    
    # 更新最后登录时间
    user.last_login = datetime.utcnow()
    await db.commit()
    
    # 生成 Token
    access_token = create_access_token(data={"user_id": user.id})
    
    return ApiResponse.ok({
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "phone_number": mask_phone_number(user.phone_number)
        }
    })


@router.get("/me", response_model=ApiResponse)
async def get_me(
    current_user: User = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    获取当前用户信息
    
    需要在请求头中携带 Token：
    Authorization: Bearer <token>
    
    返回：
    - 当前用户信息
    - 会员状态
    - 使用统计
    """
    
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录"
        )
    
    # 获取会员统计
    from ..services.membership_service import membership_service
    stats = await membership_service.get_user_usage_stats(current_user, db)
    
    return ApiResponse.ok({
        "id": current_user.id,
        "phone_number": mask_phone_number(current_user.phone_number),
        "membership": stats
    })


@router.post("/reset-password", response_model=ApiResponse)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    重置密码（找回密码）
    
    请求体：
    - phone_number: 手机号（11位）
    - verification_code: 验证码
    - new_password: 新密码（至少6位）
    
    返回：
    - 重置结果
    """
    
    # 校验手机号格式
    if not validate_phone_number(req.phone_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式错误"
        )
    
    # 验证验证码
    verification_service = get_verification_service()
    verify_success, verify_message = verification_service.verify_code(
        req.phone_number,
        "reset_password",
        req.verification_code
    )
    
    if not verify_success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=verify_message
        )
    
    # 查询用户
    result = await db.execute(
        select(User).where(User.phone_number == req.phone_number)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该手机号未注册"
        )
    
    # 更新密码
    user.hashed_password = hash_password(req.new_password)
    await db.commit()
    
    return ApiResponse.ok({
        "message": "密码重置成功",
        "phone_number": mask_phone_number(user.phone_number)
    })




