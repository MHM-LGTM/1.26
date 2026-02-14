#!/bin/bash
# 启动开发前端（5174端口）

cd /root/12.26/frontend

echo "=========================================="
echo "🎨 启动开发前端服务器"
echo "端口: 5174"
echo "模式: 热重载（修改代码自动刷新）"
echo "=========================================="
echo ""
echo "前端地址: http://localhost:5174"
echo "后端地址: http://localhost:8001"
echo ""
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 启动 Vite 开发服务器
npm run dev
