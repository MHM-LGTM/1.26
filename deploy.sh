#!/bin/bash
# 前端部署脚本 - 将代码更新部署到生产环境

# 1. 打包前端
cd /root/12.26/frontend
npm run build

# 2. 备份当前生产环境
cd /www/wwwroot
cp -r frontend frontend_backup_$(date +%Y%m%d_%H%M%S)

# 3. 部署新版本
cd /root/12.26/frontend/dist
cp -r * /www/wwwroot/frontend/

# 4. 修改权限（.user.ini 报错可忽略）
chown -R www:www /www/wwwroot/frontend/

# 5. 后端无需重启（已自动热重载）
echo "部署完成！"
