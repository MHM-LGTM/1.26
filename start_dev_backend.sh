#!/bin/bash
# 启动开发后端（8001端口，支持热重载）

cd /root/12.26/backend
source /root/12.26/myenv/bin/activate

echo "=========================================="
echo "🚀 启动开发后端服务器"
echo "端口: 8001"
echo "模式: 热重载（修改代码自动重启）"
echo "=========================================="
echo ""
echo "访问地址: http://localhost:8001"
echo "API文档: http://localhost:8001/docs"
echo "健康检查: http://localhost:8001/healthz"
echo ""
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 启动开发服务器（带热重载）
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
