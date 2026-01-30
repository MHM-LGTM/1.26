/**
 * 路径简化模块
 * ====================================
 * 功能：提供轮廓简化和预处理工具
 * - Douglas-Peucker 路径简化算法
 * - 轮廓点预处理（去重等）
 */

/**
 * Douglas-Peucker 容差阈值（单位：像素）
 * 
 * 【作用】控制路径简化的程度
 * 【调整建议】
 * - 1.0-2.0：保留更多细节，适合有细小凹陷的物体
 * - 2.5-3.5：平衡性能和精度（推荐默认值）
 * - 4.0+：激进简化，可能丢失重要特征
 */
export const DP_EPSILON = 1;


/**
 * Douglas-Peucker 路径简化算法
 * ---------------------------
 * 【功能】简化多边形轮廓，减少顶点数量但保持形状特征
 * 【用途】处理 SAM 提取的密集轮廓点（可能上千个点）
 *
 * 【原理】
 * 通过递归分治，保留关键特征点，删除接近直线的冗余点
 * 1. 连接起点和终点形成基线
 * 2. 找到距离基线最远的点
 * 3. 如果距离 > epsilon，保留该点并递归处理两段
 * 4. 如果距离 <= epsilon，删除中间所有点
 *
 * @param {Array} points - 原始轮廓点 [{x, y}, ...]
 * @param {number} epsilon - 容差阈值（像素）
 * @returns {Array} - 简化后的轮廓点
 */
export function douglasPeucker(points, epsilon) {
  if (!points || points.length < 3) return points;

  // 计算点到线段的垂直距离
  const pointToLineDistance = (p, lineStart, lineEnd) => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lineLengthSquared = dx * dx + dy * dy;
    
    if (lineLengthSquared === 0) {
      // 线段退化为点
      const pdx = p.x - lineStart.x;
      const pdy = p.y - lineStart.y;
      return Math.sqrt(pdx * pdx + pdy * pdy);
    }
    
    // 投影参数
    const t = ((p.x - lineStart.x) * dx + (p.y - lineStart.y) * dy) / lineLengthSquared;
    
    // 找到垂足
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    
    // 计算距离
    const distX = p.x - projX;
    const distY = p.y - projY;
    return Math.sqrt(distX * distX + distY * distY);
  };

  // 递归简化
  const simplify = (pts, startIdx, endIdx) => {
    if (endIdx - startIdx < 2) {
      // 只有两个点，无需简化
      return [pts[startIdx], pts[endIdx]];
    }

    let maxDist = 0;
    let maxIdx = startIdx;

    // 找到距离起点-终点连线最远的点
    for (let i = startIdx + 1; i < endIdx; i++) {
      const dist = pointToLineDistance(pts[i], pts[startIdx], pts[endIdx]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    // 判断是否需要保留该点
    if (maxDist > epsilon) {
      // 递归处理两段
      const left = simplify(pts, startIdx, maxIdx);
      const right = simplify(pts, maxIdx, endIdx);
      // 合并结果（去除重复的中间点）
      return [...left.slice(0, -1), ...right];
    } else {
      // 删除中间所有点
      return [pts[startIdx], pts[endIdx]];
    }
  };

  const simplified = simplify(points, 0, points.length - 1);
  
  // 确保闭合多边形（首尾点应该接近）
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  const dist = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2);
  
  // 如果首尾距离很小，移除最后一个点避免重复
  if (dist < 1 && simplified.length > 3) {
    simplified.pop();
  }

  return simplified;
}


/**
 * 预处理轮廓点
 * ------------
 * 【功能】清理和优化轮廓点数据
 * 【用途】确保轮廓数据质量，避免 Matter.js 创建刚体失败
 *
 * 【处理内容】
 * 1. 移除重复点（距离小于1像素的点视为重复）
 * 2. 确保至少有3个顶点（形成有效多边形）
 *
 * @param {Array} points - 原始轮廓点
 * @returns {Array} - 处理后的轮廓点
 */
export function preprocessContour(points) {
  if (points.length < 3) return points;

  // 移除重复点（距离小于1像素的点视为重复）
  const unique = [points[0]];  // 保留第一个点
  for (let i = 1; i < points.length; i++) {
    const prev = unique[unique.length - 1];  // 上一个有效点
    const curr = points[i];                   // 当前点

    // 计算两点之间的欧几里得距离
    const dist = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);

    // 只有距离大于1像素的点才保留
    if (dist > 1) {
      unique.push(curr);
    }
  }

  // 如果处理后顶点不足3个，返回原始数据（让后续逻辑处理）
  return unique.length >= 3 ? unique : points;
}
