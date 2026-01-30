/**
 * 凸分解模块
 * ====================================
 * 功能：将凹多边形分解为多个凸多边形
 * 使用 poly-decomp 库实现凸分解算法
 */

import decomp from 'poly-decomp';

/**
 * 凸分解算法（使用 poly-decomp.js）
 * --------------------------------
 * 【功能】将凹多边形分解为多个凸多边形
 * 【用途】静态凹面体的碰撞检测
 *
 * 【原理】
 * 使用 poly-decomp 库的凸分解算法：
 * 1. 识别内角 > 180° 的"凹点"
 * 2. 在凹点处切割多边形
 * 3. 递归处理每个子多边形，直到全部为凸多边形
 *
 * 【优点】
 * - 生成的是凸多边形（比三角形更大，数量更少）
 * - 每个凸多边形独立处理碰撞，组合实现凹形效果
 * - 避免过度细分，提升物理引擎性能
 *
 * 【限制】
 * - 只适用于静态物体（多个凸多边形组合不能作为刚性整体运动）
 * - 要求输入多边形无自相交
 *
 * @param {Array} points - 多边形顶点数组 [{x: number, y: number}, ...]
 * @returns {Array} - 凸多边形数组，每个元素是包含顶点的数组
 */
export function decomposeToConvexPolygons(points) {
  if (!points || points.length < 3) return [];

  try {
    // 转换为 poly-decomp 所需的格式：[[x1, y1], [x2, y2], ...]
    const polyDecompFormat = points.map(p => [p.x, p.y]);

    // 确保多边形是逆时针方向（Matter.js 和 poly-decomp 要求）
    decomp.makeCCW(polyDecompFormat);

    // 执行凸分解
    const convexPolygons = decomp.quickDecomp(polyDecompFormat);

    // 转换回 Matter.js 格式：[{x, y}, {x, y}, ...]
    return convexPolygons.map(poly => 
      poly.map(vertex => ({ x: vertex[0], y: vertex[1] }))
    );

  } catch (error) {
    console.error('[凸分解] poly-decomp 分解失败:', error);
    // 分解失败时返回空数组，让调用方回退到凸包方案
    return [];
  }
}
