"""
反馈路由
---------------------------------
功能：
- 提交反馈
- 上传反馈图片
- 查询反馈列表（管理员功能，可选）

端点：
- POST /api/feedback - 提交反馈
- POST /api/feedback/{feedback_id}/images - 上传反馈图片
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import json
import os
from datetime import datetime

from ..config.database import get_db
from ..models.feedback import Feedback, FeedbackStatus
from ..models.feedback_schema import FeedbackCreate, FeedbackResponse
from ..models.response_schema import ApiResponse
from ..utils.file_utils import save_upload_file

router = APIRouter(prefix="/api/feedback", tags=["反馈"])


@router.post("", response_model=ApiResponse)
async def create_feedback(
    email: str = Form(...),
    description: str = Form(...),
    images: Optional[List[UploadFile]] = File(None),
    db: AsyncSession = Depends(get_db)
):
    """
    提交用户反馈
    
    参数：
    - email: 联系邮箱
    - description: 问题描述
    - images: 问题截图（可选，最多5张）
    
    返回：
    - 反馈ID和提交成功信息
    """
    try:
        # 验证图片数量
        if images and len(images) > 5:
            raise HTTPException(status_code=400, detail="最多只能上传5张图片")
        
        # 保存图片
        image_paths = []
        if images:
            upload_dir = "backend/uploads/feedback"
            os.makedirs(upload_dir, exist_ok=True)
            
            for img in images:
                if img.filename:  # 确保文件名存在
                    # 生成唯一文件名
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"{timestamp}_{img.filename}"
                    file_path = os.path.join(upload_dir, filename)
                    
                    # 保存文件
                    with open(file_path, "wb") as buffer:
                        content = await img.read()
                        buffer.write(content)
                    
                    image_paths.append(file_path)
        
        # 创建反馈记录
        feedback = Feedback(
            email=email,
            description=description,
            images=json.dumps(image_paths) if image_paths else None,
            status=FeedbackStatus.PENDING
        )
        
        db.add(feedback)
        await db.commit()
        await db.refresh(feedback)
        
        return ApiResponse(
            code=200,
            message="我们已经接收到您的反馈，会尽快与您取得联系！",
            data={
                "feedback_id": feedback.id,
                "email": feedback.email,
                "created_at": feedback.created_at.isoformat()
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"提交反馈失败: {str(e)}")


@router.get("/list", response_model=ApiResponse)
async def get_feedbacks(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    获取反馈列表（管理员功能）
    
    参数：
    - skip: 跳过的记录数
    - limit: 返回的记录数
    - status: 筛选状态（pending/processing/resolved/closed）
    
    返回：
    - 反馈列表
    """
    try:
        # 构建查询
        query = select(Feedback)
        
        # 按状态筛选
        if status:
            try:
                status_enum = FeedbackStatus[status.upper()]
                query = query.filter(Feedback.status == status_enum)
            except KeyError:
                raise HTTPException(status_code=400, detail="无效的状态值")
        
        # 按创建时间排序并分页
        query = query.order_by(Feedback.created_at.desc()).offset(skip).limit(limit)
        
        # 执行查询
        result = await db.execute(query)
        feedbacks = result.scalars().all()
        
        # 获取总数
        count_query = select(Feedback)
        if status:
            count_query = count_query.filter(Feedback.status == status_enum)
        count_result = await db.execute(count_query)
        total = len(count_result.scalars().all())
        
        # 转换为响应格式
        feedback_list = []
        for fb in feedbacks:
            feedback_list.append({
                "id": fb.id,
                "email": fb.email,
                "description": fb.description,
                "images": json.loads(fb.images) if fb.images else [],
                "status": fb.status.value,
                "created_at": fb.created_at.isoformat(),
                "updated_at": fb.updated_at.isoformat()
            })
        
        return ApiResponse(
            code=200,
            message="获取成功",
            data={
                "feedbacks": feedback_list,
                "total": total
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取反馈列表失败: {str(e)}")
