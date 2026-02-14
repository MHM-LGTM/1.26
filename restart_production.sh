#!/bin/bash
# 重启生产后端（8000端口）- 部署新代码时使用

echo "=========================================="
echo "🔄 重启生产后端服务器"
echo "=========================================="

# 查找8000端口的进程
PID=$(ps aux | grep "uvicorn app.main:app --host 0.0.0.0 --port 8000" | grep -v grep | awk '{print $2}')

if [ -z "$PID" ]; then
    echo "⚠️  未找到运行在8000端口的后端进程"
    echo "是否要启动新的生产后端? (y/n)"
    read -r response
    if [[ "$response" == "y" ]]; then
        echo "启动生产后端..."
        cd /root/12.26/backend
        nohup /root/12.26/myenv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > app.log 2>&1 &
        sleep 2
        echo "✅ 生产后端已启动"
    fi
else
    echo "找到进程 PID: $PID"
    echo "正在停止旧进程..."
    kill $PID
    sleep 2
    
    echo "启动新进程..."
    cd /root/12.26/backend
    nohup /root/12.26/myenv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > app.log 2>&1 &
    
    sleep 2
    
    # 检查是否启动成功
    NEW_PID=$(ps aux | grep "uvicorn app.main:app --host 0.0.0.0 --port 8000" | grep -v grep | awk '{print $2}')
    if [ -z "$NEW_PID" ]; then
        echo "❌ 启动失败！请查看日志: tail -f /root/12.26/backend/app.log"
    else
        echo "✅ 生产后端已重启，新进程 PID: $NEW_PID"
        echo "查看日志: tail -f /root/12.26/backend/app.log"
    fi
fi

echo "=========================================="
