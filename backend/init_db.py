"""
数据库初始化脚本
---------------------------------
功能：
- 创建 users 表
- 创建 animations 表
- 创建 animation_likes 表
- 创建 feedbacks 表

使用：
python backend/init_db.py
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 从环境变量读取 MySQL 配置
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "physmath")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "physmath")

DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

# 导入 Base 和所有模型（这会自动注册到 Base.metadata）
from app.models.base import Base
from app.models.user import User
from app.models.animation import Animation, AnimationLike
from app.models.feedback import Feedback


async def init_database():
    """初始化数据库表"""
    print("正在初始化数据库...")
    print(f"连接到：{DB_HOST}:{DB_PORT}/{DB_NAME}")
    
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        # 删除所有表（可选，用于重建）
        # await conn.run_sync(Base.metadata.drop_all)
        
        # 创建所有表
        await conn.run_sync(Base.metadata.create_all)
    
    await engine.dispose()
    
    print("✅ 数据库表创建成功！")
    print(f"   数据库：{DB_NAME}")
    print(f"   已创建表：{', '.join(Base.metadata.tables.keys())}")


if __name__ == "__main__":
    asyncio.run(init_database())




