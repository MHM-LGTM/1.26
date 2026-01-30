"""
数据库连接配置
---------------------------------
功能：
- 配置 MySQL 异步数据库引擎
- 提供数据库会话管理
- 提供依赖注入函数供路由使用

使用：
- 在路由中通过 Depends(get_db) 获取数据库会话
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from pathlib import Path

# 数据库配置：从环境变量读取 MySQL 连接信息
import os
from dotenv import load_dotenv

load_dotenv()

# MySQL 连接配置
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "physmath")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "physmath")

# 构建数据库 URL
DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

# 创建异步引擎
engine = create_async_engine(
    DATABASE_URL, 
    echo=False,  # 生产环境设为 False
    future=True,
    pool_pre_ping=True,  # 连接池预检测
    pool_recycle=3600,   # 连接回收时间（秒）
)

# 创建异步会话工厂
AsyncSessionLocal = sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)


async def get_db():
    """
    依赖注入：获取数据库会话
    
    使用示例：
    @router.get("/example")
    async def example(db: AsyncSession = Depends(get_db)):
        ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()




