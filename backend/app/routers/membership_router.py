"""
会员管理路由
---------------------------------
功能：
- GET /api/membership/status - 获取会员状态和使用统计
- POST /api/membership/grant - 管理员赠送会员（用于测试和邀请用户参与调研）
- GET /api/membership/check-limit - 检查当前是否可以制作动画

使用：
- 在 main.py 中通过 app.include_router 挂载
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from ..config.database import get_db
from ..models.user import User
from ..models.response_schema import ApiResponse
from ..services.auth_service import get_current_user
from ..services.membership_service import membership_service
from ..utils.logger import log


router = APIRouter()


# ============================================================================
# Pydantic 模型
# ============================================================================

class GrantVipRequest(BaseModel):
    """赠送会员请求"""
    phone_number: str = Field(..., description="手机号")
    days: int = Field(..., ge=0, description="会员天数（0表示永久）")
    note: str = Field(default="管理员赠送", description="备注")


# ============================================================================
# API 路由
# ============================================================================

@router.get("/membership/status", response_model=ApiResponse)
async def get_membership_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取会员状态和使用统计
    
    返回：
    - is_vip: 是否为会员
    - vip_expires_at: 会员到期日期
    - today_used: 今日已使用次数
    - daily_limit: 每日限制次数
    - remaining: 今日剩余次数（-1表示无限）
    """
    try:
        stats = await membership_service.get_user_usage_stats(current_user, db)
        
        return ApiResponse.ok(stats)
        
    except Exception as e:
        log.error(f"获取会员状态失败：{e}")
        raise HTTPException(status_code=500, detail=f"获取失败：{str(e)}")


@router.get("/membership/check-limit", response_model=ApiResponse)
async def check_usage_limit(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    检查当前是否可以制作动画
    
    返回：
    - allowed: 是否允许
    - message: 提示消息
    - usage: 使用统计
    """
    try:
        allowed, message, usage_data = await membership_service.check_usage_limit(current_user, db)
        
        return ApiResponse.ok({
            "allowed": allowed,
            "message": message,
            **usage_data
        })
        
    except Exception as e:
        log.error(f"检查使用限制失败：{e}")
        raise HTTPException(status_code=500, detail=f"检查失败：{str(e)}")


@router.post("/membership/grant", response_model=ApiResponse)
async def grant_vip_to_user(
    req: GrantVipRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    管理员赠送会员（用于测试和邀请用户参与调研）
    
    注意：目前这个接口没有做管理员权限验证，仅用于测试阶段
    后期可以添加管理员权限检查或通过后台脚本调用
    
    请求体：
    - phone_number: 手机号
    - days: 会员天数（0表示永久）
    - note: 备注
    
    返回：
    - message: 操作结果
    """
    try:
        # TODO: 添加管理员权限验证
        # 目前为了方便测试，暂时不做限制
        # 后期可以添加：if current_user.id not in ADMIN_USER_IDS: raise HTTPException(403)
        
        # 查询目标用户
        from sqlalchemy import select
        from ..models.user import User as UserModel
        
        stmt = select(UserModel).where(UserModel.phone_number == req.phone_number)
        result = await db.execute(stmt)
        target_user = result.scalar_one_or_none()
        
        if not target_user:
            return ApiResponse.error(404, "目标用户不存在")
        
        # 赠送会员
        success, message = await membership_service.grant_vip(
            target_user.id,
            req.days,
            db,
            note=req.note
        )
        
        if success:
            log.info(f"用户 {current_user.id} 为用户 {target_user.id} 赠送会员：{req.days}天")
            return ApiResponse.ok({"message": message})
        else:
            return ApiResponse.error(500, message)
        
    except Exception as e:
        log.error(f"赠送会员失败：{e}")
        raise HTTPException(status_code=500, detail=f"赠送失败：{str(e)}")
