/**
 * 绘制掩码轮廓工具
 * ---------------------------------
 * 功能：
 * - 将后端返回的轮廓坐标数组在 Canvas 上连接为亮线；
 * - 支持清空与重绘。
 *
 * 使用：
 * - drawContour(ctx, points) 传入 形如 [{x,y}, ...] 的列表。
 * - clear(ctx, width, height) 清空画布。
 */

export function clear(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

export function drawContour(ctx, points) {
  if (!ctx || !points || points.length === 0) return;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2b6ef2'; // 高亮蓝色
  ctx.shadowColor = '#7aa2ff';
  ctx.shadowBlur = 12;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export function drawDragRect(ctx, x1, y1, x2, y2) {
  if (!ctx) return;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = '#ff9900';
  ctx.shadowColor = '#ff9900';
  ctx.shadowBlur = 8;
  const w = x2 - x1;
  const h = y2 - y1;
  ctx.strokeRect(x1, y1, w, h);
  ctx.restore();
}

/**
 * 绘制端点选择标记
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 * @param {number} x - 端点 X 坐标
 * @param {number} y - 端点 Y 坐标
 * @param {string} type - 端点类型: 'first' | 'second'
 */
export function drawPivotMarker(ctx, x, y, type = 'first') {
  if (!ctx) return;
  
  ctx.save();
  
  // 根据类型选择颜色
  const colors = {
    first: {
      outer: '#10b981',      // 绿色外圈
      inner: '#34d399',      // 浅绿色内圈
      center: '#ffffff',     // 白色中心点
      shadow: '#6ee7b7'      // 阴影颜色
    },
    second: {
      outer: '#f59e0b',      // 橙色外圈
      inner: '#fbbf24',      // 浅橙色内圈
      center: '#ffffff',     // 白色中心点
      shadow: '#fcd34d'      // 阴影颜色
    }
  };
  
  const color = colors[type] || colors.first;
  
  // 绘制阴影效果
  ctx.shadowColor = color.shadow;
  ctx.shadowBlur = 12;
  
  // 绘制外圈
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fillStyle = color.outer;
  ctx.fill();
  
  // 绘制内圈
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = color.inner;
  ctx.fill();
  
  // 绘制中心点
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = color.center;
  ctx.fill();
  
  // 绘制外圈边框
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.strokeStyle = color.outer;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.restore();
}