"""
文件存储工具
---------------------------------
功能：
- 保存前端上传的文件到 `backend/uploads/<category>/` 目录
- 返回绝对路径（用于文件操作）和相对路径（用于存储到数据库和前端访问）
- 提供文件删除功能，用于清理不再使用的文件

图片存储策略：
- 图片文件存储在服务器磁盘：backend/uploads/<category>/
- 数据库中存储相对路径（如：/uploads/animations/uuid_file.png）
- 命名规则：<uuid>_<原文件名>，避免重名覆盖

后续扩展：
- 可增加子目录（按日期/用户ID）与存储后清理策略
- 可接入对象存储（如 S3、OSS），在此处替换落盘逻辑即可
"""

from pathlib import Path
from uuid import uuid4
from typing import Literal, Tuple
import os

from fastapi import UploadFile

from ..config.settings import (
    PHYSICS_UPLOAD_DIR, 
    MATH_UPLOAD_DIR, 
    FEEDBACK_UPLOAD_DIR,
    ANIMATIONS_UPLOAD_DIR
)


def _target_dir(category: Literal["physics", "math", "feedback", "animations"]) -> Path:
    """根据类别返回目标上传目录"""
    dir_map = {
        "physics": PHYSICS_UPLOAD_DIR,
        "math": MATH_UPLOAD_DIR,
        "feedback": FEEDBACK_UPLOAD_DIR,
        "animations": ANIMATIONS_UPLOAD_DIR
    }
    return dir_map[category]


async def save_upload_file(
    file: UploadFile, 
    category: Literal["physics", "math", "feedback", "animations"]
) -> Tuple[Path, str]:
    """保存上传文件到对应目录。
    
    Args:
        file: 上传的文件对象
        category: 文件类别（physics/math/feedback/animations）
    
    Returns:
        Tuple[Path, str]: (绝对路径, 相对路径)
        - 绝对路径：用于文件操作
        - 相对路径：用于存储到数据库和前端访问（如：/uploads/animations/uuid_file.png）
    
    命名策略：`<uuid>_<原文件名>`，避免重名覆盖。
    """
    target = _target_dir(category)
    target.mkdir(parents=True, exist_ok=True)

    original_name = Path(file.filename or "upload.bin").name
    safe_name = f"{uuid4().hex}_{original_name}"
    save_path = target / safe_name

    # 保存文件
    content = await file.read()
    with save_path.open("wb") as out:
        out.write(content)

    # 生成相对路径（用于前端访问）
    relative_path = f"/uploads/{category}/{safe_name}"
    
    return save_path.resolve(), relative_path


def delete_upload_file(relative_path: str) -> bool:
    """删除上传的文件
    
    Args:
        relative_path: 相对路径（如：/uploads/animations/uuid_file.png）
    
    Returns:
        bool: 是否删除成功
    """
    try:
        # 去除开头的 /uploads/
        if relative_path.startswith("/uploads/"):
            # 从 settings 中获取 UPLOAD_DIR 的绝对路径
            from ..config.settings import UPLOAD_DIR
            file_path = UPLOAD_DIR / relative_path.replace("/uploads/", "")
            
            if file_path.exists() and file_path.is_file():
                file_path.unlink()
                return True
        return False
    except Exception as e:
        print(f"删除文件失败: {relative_path}, 错误: {e}")
        return False