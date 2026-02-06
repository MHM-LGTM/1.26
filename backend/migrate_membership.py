"""
会员系统数据库迁移脚本
---------------------------------
功能：
- 为 users 表添加会员相关字段
- 创建 user_usage_records 表
- 创建 membership_transactions 表

运行：
python backend/migrate_membership.py
"""

import asyncio
from sqlalchemy import text
from app.config.database import engine
from app.models.base import Base
from app.models.user import User, UserUsageRecord, MembershipTransaction
from app.utils.logger import log


async def migrate():
    """执行数据库迁移"""
    
    async with engine.begin() as conn:
        # 检查 users 表是否存在 is_vip 字段
        result = await conn.execute(text("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'is_vip'
        """))
        
        count = result.scalar()
        
        if count == 0:
            log.info("开始迁移 users 表...")
            
            # 添加会员字段
            await conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN is_vip BOOLEAN DEFAULT FALSE COMMENT '是否为会员',
                ADD COLUMN vip_expires_at DATE NULL COMMENT '会员到期日期'
            """))
            
            log.info("users 表迁移完成")
        else:
            log.info("users 表已包含会员字段，跳过")
        
        # 创建新表
        log.info("创建会员系统相关表...")
        
        # 使用 SQLAlchemy 的表结构创建
        await conn.run_sync(Base.metadata.create_all)
        
        log.info("所有表创建完成")


async def verify_migration():
    """验证迁移结果"""
    
    async with engine.begin() as conn:
        # 检查 users 表字段
        result = await conn.execute(text("DESCRIBE users"))
        fields = [row[0] for row in result]
        
        log.info(f"users 表字段: {fields}")
        
        assert 'is_vip' in fields, "is_vip 字段未添加"
        assert 'vip_expires_at' in fields, "vip_expires_at 字段未添加"
        
        # 检查新表
        result = await conn.execute(text("SHOW TABLES"))
        tables = [row[0] for row in result]
        
        log.info(f"数据库表: {tables}")
        
        assert 'user_usage_records' in tables, "user_usage_records 表未创建"
        assert 'membership_transactions' in tables, "membership_transactions 表未创建"
        
        log.info("✅ 数据库迁移验证通过")


async def main():
    """主函数"""
    try:
        log.info("=" * 50)
        log.info("开始会员系统数据库迁移")
        log.info("=" * 50)
        
        await migrate()
        await verify_migration()
        
        log.info("=" * 50)
        log.info("数据库迁移完成")
        log.info("=" * 50)
        
    except Exception as e:
        log.error(f"迁移失败：{e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
