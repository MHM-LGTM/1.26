"""
动画管理路由
---------------------------------
功能：
- POST /api/animations - 保存动画到我的动画库
- GET /api/animations/mine - 获取我的动画列表
- GET /api/animations/{id} - 获取动画详情
- DELETE /api/animations/{id} - 删除动画
- POST /api/animations/{id}/publish - 发布到广场
- POST /api/plaza/animations/{id}/fork - Fork动画
- POST /api/animations/{id}/share-link - 生成分享链接

使用：
- 在 main.py 中通过 app.include_router 挂载
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List
import random
import string
import os

from ..config.database import get_db
from ..config.settings import FRONTEND_BASE_URL
from ..models.user import User
from ..models.animation import Animation, AnimationLike
from ..models.animation_schema import (
    AnimationCreateRequest, 
    AnimationResponse,
    AnimationDetailResponse,
    AnimationListItem
)
from ..models.response_schema import ApiResponse
from ..services.auth_service import get_current_user
from ..services.membership_service import membership_service
from ..utils.logger import log
from ..utils.phone_utils import mask_phone_number
from ..utils.file_utils import save_upload_file, delete_upload_file


router = APIRouter()


@router.post("/animations/upload-image", response_model=ApiResponse)
async def upload_animation_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    上传动画图片（封面或背景图）
    
    参数：
    - file: 图片文件（支持 jpg, jpeg, png, gif, webp）
    
    返回：
    - path: 图片的相对路径（用于前端访问，如：/uploads/animations/uuid_file.png）
    
    限制：
    - 文件大小：最大 10MB
    - 文件类型：图片格式
    """
    try:
        # 验证文件类型
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="仅支持图片文件")
        
        # 验证文件大小（10MB）
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="图片大小不能超过 10MB")
        
        # 重置文件指针
        await file.seek(0)
        
        # 保存文件
        abs_path, relative_path = await save_upload_file(file, "animations")
        
        log.info(f"用户 {current_user.id} 上传动画图片: {relative_path}")
        
        return ApiResponse.ok({
            "path": relative_path,
            "message": "图片上传成功"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"上传动画图片失败: {e}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.post("/animations", response_model=ApiResponse)
async def create_animation(
    req: AnimationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    保存动画到我的动画库
    
    参数：
    - title: 动画名称（必填，1-100字符）
    - description: 动画描述（可选，最多500字符）
    - thumbnail_url: 封面图路径（可选，相对路径如 /uploads/animations/xxx.png）
    - scene_data: 场景数据（必填，JSON对象）
      - imagePreview: 背景图路径（相对路径，而非 data URL）
      - imageNaturalSize: 图片原始尺寸 {w, h}
      - objects: 物体数据数组
      - constraints: 约束关系数组
    
    返回：
    - id: 新创建的动画ID
    - message: 成功消息
    
    会员限制：
    - 非会员每天最多制作5次动画
    - 会员无限制
    
    图片存储逻辑：
    - 图片文件存储在服务器磁盘（backend/uploads/animations/）
    - 数据库中以相对路径（如 /uploads/animations/uuid_file.png）格式存储
    - 前端需先通过 /api/animations/upload-image 上传图片获取路径，再保存动画
    - 删除动画时会自动清理关联的磁盘文件
    """
    try:
        # 检查使用限制
        allowed, message, usage_data = await membership_service.check_usage_limit(current_user, db)
        
        if not allowed:
            return ApiResponse.error(403, message, usage_data)
        
        # 创建动画记录
        animation = Animation(
            user_id=current_user.id,
            title=req.title,
            description=req.description,
            thumbnail_url=req.thumbnail_url,
            scene_data=req.scene_data,
            is_public=False,
            like_count=0
        )
        
        db.add(animation)
        await db.commit()
        await db.refresh(animation)
        
        # 增加使用次数（仅非会员）
        if not current_user.is_vip_active:
            await membership_service.increment_usage(current_user.id, db)
        
        log.info(f"用户 {current_user.id} 创建动画：{animation.id} - {animation.title}")
        
        # 获取更新后的使用统计
        updated_stats = await membership_service.get_user_usage_stats(current_user, db)
        
        return ApiResponse.ok({
            "id": animation.id,
            "message": "动画保存成功",
            "usage": updated_stats
        })
        
    except Exception as e:
        await db.rollback()
        log.error(f"创建动画失败：{e}")
        raise HTTPException(status_code=500, detail=f"保存失败：{str(e)}")


@router.get("/animations/mine", response_model=ApiResponse)
async def get_my_animations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取我的动画列表
    
    返回：
    - animations: 动画列表数组
      - id: 动画ID
      - title: 动画名称
      - thumbnail_url: 封面图URL
      - like_count: 点赞数
      - created_at: 创建时间（ISO格式字符串）
    """
    try:
        stmt = (
            select(Animation)
            .where(Animation.user_id == current_user.id)
            .order_by(Animation.created_at.desc())
        )
        
        result = await db.execute(stmt)
        animations = result.scalars().all()
        
        return ApiResponse.ok({
            "animations": [
                {
                    "id": anim.id,
                    "title": anim.title,
                    "thumbnail_url": anim.thumbnail_url,
                    "like_count": anim.like_count,
                    "is_public": anim.is_public,
                    "created_at": anim.created_at.isoformat()
                }
                for anim in animations
            ]
        })
        
    except Exception as e:
        log.error(f"获取动画列表失败：{e}")
        raise HTTPException(status_code=500, detail=f"获取失败：{str(e)}")


@router.get("/animations/{animation_id}", response_model=ApiResponse)
async def get_animation_detail(
    animation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    获取动画详情（包含完整的 scene_data）
    
    参数：
    - animation_id: 动画ID
    
    返回：
    - id: 动画ID
    - title: 动画名称
    - description: 动画描述
    - scene_data: 完整的场景数据
    - created_at: 创建时间
    """
    try:
        stmt = select(Animation).where(
            Animation.id == animation_id,
            Animation.user_id == current_user.id
        )
        
        result = await db.execute(stmt)
        animation = result.scalar_one_or_none()
        
        if not animation:
            return ApiResponse.error(404, "动画不存在或无权访问")
        
        return ApiResponse.ok({
            "id": animation.id,
            "title": animation.title,
            "description": animation.description,
            "scene_data": animation.scene_data,
            "created_at": animation.created_at.isoformat()
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"获取动画详情失败：{e}")
        raise HTTPException(status_code=500, detail=f"获取失败：{str(e)}")


@router.delete("/animations/{animation_id}", response_model=ApiResponse)
async def delete_animation(
    animation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    删除动画（同时删除关联的图片文件）
    
    参数：
    - animation_id: 动画ID
    
    返回：
    - message: 成功消息
    """
    try:
        # 先查询确认权限
        stmt = select(Animation).where(
            Animation.id == animation_id,
            Animation.user_id == current_user.id
        )
        
        result = await db.execute(stmt)
        animation = result.scalar_one_or_none()
        
        if not animation:
            return ApiResponse.error(404, "动画不存在或无权删除")
        
        # 收集需要删除的图片路径
        files_to_delete = []
        
        # 1. 封面图
        if animation.thumbnail_url and not animation.thumbnail_url.startswith('data:'):
            files_to_delete.append(animation.thumbnail_url)
        
        # 2. 背景图（从 scene_data 中提取）
        if animation.scene_data and isinstance(animation.scene_data, dict):
            image_preview = animation.scene_data.get('imagePreview')
            if image_preview and not image_preview.startswith('data:'):
                # 避免重复删除（如果封面和背景是同一个文件）
                if image_preview not in files_to_delete:
                    files_to_delete.append(image_preview)
        
        # 先删除数据库记录
        delete_stmt = delete(Animation).where(Animation.id == animation_id)
        await db.execute(delete_stmt)
        await db.commit()
        
        # 再删除文件（即使删除失败也不影响数据库操作）
        deleted_files = []
        for file_path in files_to_delete:
            if delete_upload_file(file_path):
                deleted_files.append(file_path)
        
        log.info(f"用户 {current_user.id} 删除动画：{animation_id}，清理文件：{deleted_files}")
        
        return ApiResponse.ok({
            "message": "删除成功"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        log.error(f"删除动画失败：{e}")
        raise HTTPException(status_code=500, detail=f"删除失败：{str(e)}")


@router.post("/animations/{animation_id}/publish", response_model=ApiResponse)
async def publish_to_plaza(
    animation_id: int,
    show_author: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    上传动画到广场
    
    参数：
    - animation_id: 动画ID
    - show_author: 是否公开显示作者用户名（默认 true）
    
    返回：
    - message: 成功消息
    """
    try:
        # 查询动画
        stmt = select(Animation).where(
            Animation.id == animation_id,
            Animation.user_id == current_user.id
        )
        
        result = await db.execute(stmt)
        animation = result.scalar_one_or_none()
        
        if not animation:
            return ApiResponse.error(404, "动画不存在或无权操作")
        
        # 设置为公开
        animation.is_public = True
        animation.show_author = show_author
        
        await db.commit()
        
        log.info(f"用户 {current_user.id} 发布动画到广场：{animation_id} - {animation.title}")
        
        return ApiResponse.ok({
            "message": "已上传到动画广场"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        log.error(f"发布动画失败：{e}")
        raise HTTPException(status_code=500, detail=f"发布失败：{str(e)}")


@router.post("/animations/{animation_id}/unpublish", response_model=ApiResponse)
async def unpublish_from_plaza(
    animation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    从广场下架动画
    
    参数：
    - animation_id: 动画ID
    
    返回：
    - message: 成功消息
    """
    try:
        # 查询动画
        stmt = select(Animation).where(
            Animation.id == animation_id,
            Animation.user_id == current_user.id
        )
        
        result = await db.execute(stmt)
        animation = result.scalar_one_or_none()
        
        if not animation:
            return ApiResponse.error(404, "动画不存在或无权操作")
        
        # 设置为私有
        animation.is_public = False
        
        await db.commit()
        
        log.info(f"用户 {current_user.id} 从广场下架动画：{animation_id}")
        
        return ApiResponse.ok({
            "message": "已从广场下架"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        log.error(f"下架动画失败：{e}")
        raise HTTPException(status_code=500, detail=f"下架失败：{str(e)}")


@router.get("/plaza/animations/{animation_id}", response_model=ApiResponse)
async def get_plaza_animation_detail(
    animation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取广场动画详情（公开接口，无需登录）
    
    参数：
    - animation_id: 动画ID
    
    返回：
    - id: 动画ID
    - title: 动画名称
    - description: 动画描述
    - scene_data: 完整的场景数据
    - like_count: 点赞数
    - author_name: 作者用户名（如果 show_author=true）
    - created_at: 创建时间
    """
    try:
        # 查询动画（必须是公开的）
        stmt = select(Animation).where(
            Animation.id == animation_id,
            Animation.is_public == True
        )
        
        result = await db.execute(stmt)
        animation = result.scalar_one_or_none()
        
        if not animation:
            return ApiResponse.error(404, "动画不存在或未公开")
        
        anim_data = {
            "id": animation.id,
            "title": animation.title,
            "description": animation.description,
            "scene_data": animation.scene_data,
            "like_count": animation.like_count,
            "share_code": animation.share_code,  # 返回分享码（如果有）
            "created_at": animation.created_at.isoformat()
        }
        
        # 如果作者选择公开用户名
        if animation.show_author:
            user_stmt = select(User).where(User.id == animation.user_id)
            user_result = await db.execute(user_stmt)
            user = user_result.scalar_one_or_none()
            if user:
                anim_data["author_name"] = mask_phone_number(user.phone_number)
        
        return ApiResponse.ok(anim_data)
        
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"获取广场动画详情失败：{e}")
        raise HTTPException(status_code=500, detail=f"获取失败：{str(e)}")


@router.get("/plaza/animations", response_model=ApiResponse)
async def get_plaza_animations(db: AsyncSession = Depends(get_db)):
    """
    获取广场动画列表（公开接口，无需登录）
    
    返回：
    - animations: 动画列表
      - id: 动画ID
      - title: 动画名称
      - thumbnail_url: 封面图
      - like_count: 点赞数
      - author_name: 作者用户名（如果 show_author=true）
      - created_at: 创建时间
    """
    try:
        # 优化查询：一次性获取所有需要显示作者的动画的用户信息
        stmt = (
            select(Animation)
            .where(Animation.is_public == True)
            .order_by(Animation.like_count.desc(), Animation.created_at.desc())
        )
        
        result = await db.execute(stmt)
        animations = result.scalars().all()
        
        # 收集需要查询的用户ID
        user_ids_to_fetch = {anim.user_id for anim in animations if anim.show_author}
        
        # 批量查询用户信息
        users_map = {}
        if user_ids_to_fetch:
            user_stmt = select(User).where(User.id.in_(user_ids_to_fetch))
            user_result = await db.execute(user_stmt)
            users = user_result.scalars().all()
            users_map = {user.id: user for user in users}
        
        # 构建返回列表
        animation_list = []
        for anim in animations:
            anim_data = {
                "id": anim.id,
                "title": anim.title,
                "thumbnail_url": anim.thumbnail_url,
                "like_count": anim.like_count,
                "created_at": anim.created_at.isoformat()
            }
            
            # 如果作者选择公开用户名，则从缓存的用户信息中获取
            if anim.show_author and anim.user_id in users_map:
                user = users_map[anim.user_id]
                anim_data["author_name"] = mask_phone_number(user.phone_number)
            
            animation_list.append(anim_data)
        
        return ApiResponse.ok({
            "animations": animation_list
        })
        
    except Exception as e:
        log.error(f"获取广场动画列表失败：{e}")
        raise HTTPException(status_code=500, detail=f"获取失败：{str(e)}")


@router.post("/plaza/animations/{animation_id}/like", response_model=ApiResponse)
async def like_animation(
    animation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    点赞动画
    
    参数：
    - animation_id: 动画ID
    
    返回：
    - message: 成功消息
    - like_count: 更新后的点赞数
    """
    try:
        # 检查动画是否存在且公开
        anim_stmt = select(Animation).where(
            Animation.id == animation_id,
            Animation.is_public == True
        )
        anim_result = await db.execute(anim_stmt)
        animation = anim_result.scalar_one_or_none()
        
        if not animation:
            return ApiResponse.error(404, "动画不存在或未公开")
        
        # 检查是否已点赞
        like_stmt = select(AnimationLike).where(
            AnimationLike.animation_id == animation_id,
            AnimationLike.user_id == current_user.id
        )
        like_result = await db.execute(like_stmt)
        existing_like = like_result.scalar_one_or_none()
        
        if existing_like:
            return ApiResponse.error(400, "已经点赞过了")
        
        # 创建点赞记录
        like = AnimationLike(
            animation_id=animation_id,
            user_id=current_user.id
        )
        db.add(like)
        
        # 更新点赞数
        animation.like_count = (animation.like_count or 0) + 1
        
        await db.commit()
        
        log.info(f"用户 {current_user.id} 点赞动画 {animation_id}")
        
        return ApiResponse.ok({
            "message": "点赞成功",
            "like_count": animation.like_count
        })
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        log.error(f"点赞失败：{e}")
        raise HTTPException(status_code=500, detail=f"点赞失败：{str(e)}")


@router.delete("/plaza/animations/{animation_id}/like", response_model=ApiResponse)
async def unlike_animation(
    animation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    取消点赞
    
    参数：
    - animation_id: 动画ID
    
    返回：
    - message: 成功消息
    - like_count: 更新后的点赞数
    """
    try:
        # 查找点赞记录
        like_stmt = select(AnimationLike).where(
            AnimationLike.animation_id == animation_id,
            AnimationLike.user_id == current_user.id
        )
        like_result = await db.execute(like_stmt)
        like = like_result.scalar_one_or_none()
        
        if not like:
            return ApiResponse.error(400, "还没有点赞")
        
        # 删除点赞记录（使用 delete 语句）
        delete_stmt = delete(AnimationLike).where(
            AnimationLike.animation_id == animation_id,
            AnimationLike.user_id == current_user.id
        )
        await db.execute(delete_stmt)
        
        # 更新动画点赞数
        anim_stmt = select(Animation).where(Animation.id == animation_id)
        anim_result = await db.execute(anim_stmt)
        animation = anim_result.scalar_one_or_none()
        
        if animation:
            animation.like_count = max(0, (animation.like_count or 0) - 1)
        
        await db.commit()
        
        log.info(f"用户 {current_user.id} 取消点赞动画 {animation_id}")
        
        return ApiResponse.ok({
            "message": "已取消点赞",
            "like_count": animation.like_count if animation else 0
        })
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        log.error(f"取消点赞失败：{e}")
        raise HTTPException(status_code=500, detail=f"取消点赞失败：{str(e)}")


@router.get("/plaza/animations/{animation_id}/like-status", response_model=ApiResponse)
async def get_like_status(
    animation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    查询当前用户是否已点赞
    
    参数：
    - animation_id: 动画ID
    
    返回：
    - liked: 是否已点赞
    """
    try:
        like_stmt = select(AnimationLike).where(
            AnimationLike.animation_id == animation_id,
            AnimationLike.user_id == current_user.id
        )
        like_result = await db.execute(like_stmt)
        like = like_result.scalar_one_or_none()
        
        return ApiResponse.ok({
            "liked": like is not None
        })
        
    except Exception as e:
        log.error(f"查询点赞状态失败：{e}")
        raise HTTPException(status_code=500, detail=f"查询失败：{str(e)}")


@router.post("/plaza/animations/{animation_id}/fork", response_model=ApiResponse)
async def fork_animation(
    animation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fork 动画到我的动画库
    
    参数：
    - animation_id: 要 Fork 的动画ID
    
    返回：
    - id: 新创建的动画ID
    - message: 成功消息
    """
    try:
        # 查询源动画（必须是公开的）
        source_stmt = select(Animation).where(
            Animation.id == animation_id,
            Animation.is_public == True
        )
        source_result = await db.execute(source_stmt)
        source_animation = source_result.scalar_one_or_none()
        
        if not source_animation:
            return ApiResponse.error(404, "动画不存在或未公开")
        
        # 创建副本
        forked_animation = Animation(
            user_id=current_user.id,
            title=f"{source_animation.title}（副本）",
            description=source_animation.description,
            thumbnail_url=source_animation.thumbnail_url,
            scene_data=source_animation.scene_data,
            is_public=False,  # Fork 的动画默认私有
            like_count=0,
            fork_from=source_animation.id
        )
        
        db.add(forked_animation)
        await db.commit()
        await db.refresh(forked_animation)
        
        log.info(f"用户 {current_user.id} Fork 动画 {animation_id} -> {forked_animation.id}")
        
        return ApiResponse.ok({
            "id": forked_animation.id,
            "message": "已保存到我的动画"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        log.error(f"Fork 动画失败：{e}")
        raise HTTPException(status_code=500, detail=f"Fork 失败：{str(e)}")


@router.post("/animations/{animation_id}/share-link", response_model=ApiResponse)
async def generate_share_link(
    animation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    生成分享链接
    
    参数：
    - animation_id: 动画ID
    
    返回：
    - share_code: 分享码
    - share_url: 完整分享链接
    
    会员限制：
    - 非会员不能生成分享链接
    - 会员可以正常使用
    """
    try:
        # 检查会员状态
        if not current_user.is_vip_active:
            return ApiResponse.error(
                403, 
                "分享链接功能仅对会员开放，请开通会员后使用",
                {"is_vip": False, "feature": "share_link"}
            )
        
        # 查询动画（必须是自己的）
        stmt = select(Animation).where(
            Animation.id == animation_id,
            Animation.user_id == current_user.id
        )
        
        result = await db.execute(stmt)
        animation = result.scalar_one_or_none()
        
        if not animation:
            return ApiResponse.error(404, "动画不存在或无权操作")
        
        # 如果已有分享码，直接返回
        if animation.share_code:
            share_url = f"{FRONTEND_BASE_URL}/physics/play/{animation.share_code}"
            return ApiResponse.ok({
                "share_code": animation.share_code,
                "share_url": share_url
            })
        
        # 生成唯一的6位分享码
        while True:
            share_code = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
            # 检查是否重复
            check_stmt = select(Animation).where(Animation.share_code == share_code)
            check_result = await db.execute(check_stmt)
            if not check_result.scalar_one_or_none():
                break
        
        # 保存分享码
        animation.share_code = share_code
        await db.commit()
        
        share_url = f"{FRONTEND_BASE_URL}/physics/play/{share_code}"
        
        log.info(f"用户 {current_user.id} 生成分享链接：{animation_id} -> {share_code}")
        
        return ApiResponse.ok({
            "share_code": share_code,
            "share_url": share_url
        })
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        log.error(f"生成分享链接失败：{e}")
        raise HTTPException(status_code=500, detail=f"生成失败：{str(e)}")


@router.get("/play/{share_code}", response_model=ApiResponse)
async def get_animation_by_share_code(
    share_code: str,
    db: AsyncSession = Depends(get_db)
):
    """
    通过分享码获取动画（公开接口，无需登录）
    
    参数：
    - share_code: 分享码
    
    返回：
    - 完整的动画信息和 scene_data
    """
    try:
        stmt = select(Animation).where(Animation.share_code == share_code)
        result = await db.execute(stmt)
        animation = result.scalar_one_or_none()
        
        if not animation:
            return ApiResponse.error(404, "分享链接不存在或已失效")
        
        anim_data = {
            "id": animation.id,
            "title": animation.title,
            "description": animation.description,
            "scene_data": animation.scene_data,
            "like_count": animation.like_count,
            "created_at": animation.created_at.isoformat()
        }
        
        # 如果作者选择公开用户名
        if animation.show_author:
            user_stmt = select(User).where(User.id == animation.user_id)
            user_result = await db.execute(user_stmt)
            user = user_result.scalar_one_or_none()
            if user:
                anim_data["author_name"] = mask_phone_number(user.phone_number)
        
        return ApiResponse.ok(anim_data)
        
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"获取分享动画失败：{e}")
        raise HTTPException(status_code=500, detail=f"获取失败：{str(e)}")

