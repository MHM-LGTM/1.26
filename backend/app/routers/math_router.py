"""
数学讲解路由（最小可用版）
---------------------------------
功能：
- `/upload`：保存数学题图片到 `uploads/math`，返回路径。
- `/render`：创建一个演示性的渲染任务（后台任务），返回 `task_id`。

后续扩展：
- 将 `/render` 接入 Manim/Claude/TTS 等服务，异步渲染并提供进度查询路由。
"""

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Depends
from uuid import uuid4

from ..models.response_schema import ApiResponse
from ..models.math_schema import MathRenderRequest
from ..models.user import User
from ..utils.file_utils import save_upload_file
from ..utils.logger import log
from ..services.auth_service import get_current_user


router = APIRouter()


@router.post("/upload", response_model=ApiResponse)
async def upload_image(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """
    上传数学题图片
    
    **需要登录才能使用此功能**
    """
    abs_path, relative_path = await save_upload_file(file, "math")
    log.info(f"Math image saved by user {current_user.id}: {abs_path}")
    return ApiResponse.ok({"path": str(abs_path)})


def _mock_render(task_id: str, req: MathRenderRequest):
    # 这里是后台模拟渲染：真实情况应调用 Manim/TTS/FFmpeg 等服务
    log.info(f"[mock-render] task={task_id}, prompt={req.prompt!r}, image={req.image_path}")


@router.post("/render", response_model=ApiResponse)
async def render(background_tasks: BackgroundTasks, req: MathRenderRequest):
    task_id = f"render-{uuid4().hex[:8]}"
    background_tasks.add_task(_mock_render, task_id, req)
    return ApiResponse.ok({"task_id": task_id})