"""
会员赠送脚本
---------------------------------
功能：
- 管理员手动赠送会员给用户（用于测试和邀请用户参与调研）

运行：
python backend/grant_vip.py <手机号> <天数> [备注]

示例：
python backend/grant_vip.py 13800138000 30 "感谢参与调研"
python backend/grant_vip.py 13800138000 0 "永久会员"
"""

import asyncio
import sys
from app.config.database import AsyncSessionLocal
from app.services.membership_service import membership_service
from app.utils.logger import log
from sqlalchemy import select
from app.models.user import User


async def grant_vip(phone_number: str, days: int, note: str = "管理员赠送"):
    """赠送会员"""
    
    async with AsyncSessionLocal() as db:
        # 查询用户
        stmt = select(User).where(User.phone_number == phone_number)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            log.error(f"❌ 用户不存在：{phone_number}")
            return False
        
        # 赠送会员
        success, message = await membership_service.grant_vip(
            user.id,
            days,
            db,
            note=note
        )
        
        if success:
            log.info(f"✅ {message}")
            log.info(f"   用户：{phone_number}")
            log.info(f"   天数：{days if days > 0 else '永久'}")
            log.info(f"   备注：{note}")
            return True
        else:
            log.error(f"❌ {message}")
            return False


async def list_vip_users():
    """列出所有会员用户"""
    
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.is_vip == True).order_by(User.vip_expires_at.desc())
        result = await db.execute(stmt)
        users = result.scalars().all()
        
        if not users:
            log.info("暂无会员用户")
            return
        
        log.info(f"\n当前会员用户列表（共 {len(users)} 人）：")
        log.info("-" * 70)
        log.info(f"{'ID':<6} {'手机号':<12} {'到期日期':<12} {'状态':<8}")
        log.info("-" * 70)
        
        for user in users:
            expires = user.vip_expires_at.isoformat() if user.vip_expires_at else "永久"
            status = "有效" if user.is_vip_active else "已过期"
            log.info(f"{user.id:<6} {user.phone_number:<12} {expires:<12} {status:<8}")


def print_usage():
    """打印使用说明"""
    print("""
会员赠送脚本
==========================================

用法：
  python backend/grant_vip.py <手机号> <天数> [备注]
  python backend/grant_vip.py --list

参数：
  手机号    必填，11位手机号
  天数      必填，会员天数（0表示永久）
  备注      可选，赠送备注

选项：
  --list    列出所有会员用户

示例：
  # 赠送30天会员
  python backend/grant_vip.py 13800138000 30 "感谢参与调研"
  
  # 赠送永久会员
  python backend/grant_vip.py 13800138000 0 "核心测试用户"
  
  # 列出所有会员
  python backend/grant_vip.py --list
==========================================
    """)


async def main():
    """主函数"""
    
    # 解析命令行参数
    if len(sys.argv) < 2:
        print_usage()
        return
    
    # 列出会员
    if sys.argv[1] == "--list":
        await list_vip_users()
        return
    
    # 赠送会员
    if len(sys.argv) < 3:
        print_usage()
        return
    
    phone_number = sys.argv[1]
    
    try:
        days = int(sys.argv[2])
    except ValueError:
        log.error("❌ 天数必须是数字")
        return
    
    if days < 0:
        log.error("❌ 天数不能为负数")
        return
    
    note = sys.argv[3] if len(sys.argv) > 3 else "管理员赠送"
    
    await grant_vip(phone_number, days, note)


if __name__ == "__main__":
    asyncio.run(main())
