/**
 * 几何计算工具模块
 * ====================================
 * 功能：提供多边形几何计算的基础工具函数
 * - 计算多边形面积
 * - 计算多边形质心
 * - 生成凸包
 */

import Matter from 'matter-js';

/**
 * 计算多边形面积
 * -------------
 * 【功能】使用 Shoelace 公式（鞋带公式）计算多边形面积
 * 【用途】用于计算物体密度（density = mass / area）
 *
 * 【数学原理】
 * Shoelace 公式：Area = 0.5 * |Σ(x[i] * y[i+1] - x[i+1] * y[i])|
 *
 * @param {Array} points - 多边形顶点数组 [{x: number, y: number}, ...]
 * @returns {number} - 多边形面积（像素平方）
 */
export function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;  // 下一个顶点索引（循环）
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}


/**
 * 计算多边形质心（几何中心）
 * -------------------------
 * 【功能】计算多边形所有顶点的平均位置
 * 【用途】物体定位参考点
 *
 * @param {Array} points - 顶点数组 [{x: number, y: number}, ...]
 * @returns {{x: number, y: number}} - 质心坐标
 */
export function calculateCentroid(points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };

  // 累加所有顶点坐标
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );

  // 返回平均值作为质心
  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}


/**
 * 生成凸包（Convex Hull）
 * ----------------------
 * 【功能】将任意多边形转换为其凸包（最小凸多边形）
 * 【用途】动态凹面体的近似处理
 *
 * 【原理】
 * 凸包是包含所有给定点的最小凸多边形
 * 想象用橡皮筋包裹所有点，橡皮筋的形状就是凸包
 *
 * @param {Array} points - 原始顶点数组
 * @returns {Array} - 凸包顶点数组（坐标取整）
 */
export function toConvexHull(points) {
  // 使用 Matter.js 内置的凸包算法
  const verts = Matter.Vertices.create(points, Matter);
  const hull = Matter.Vertices.hull(verts);

  // 坐标取整，避免浮点误差
  return hull.map((v) => ({ x: Math.round(v.x), y: Math.round(v.y) }));
}


/**
 * 计算多边形质心（用于 fromVertices）
 * ----------------------------------
 * 【功能】计算凸多边形的几何中心
 * 【用途】创建凸多边形刚体时确定中心点位置
 *
 * @param {Array} polygon - 顶点数组 [{x, y}, {x, y}, ...]
 * @returns {{x: number, y: number}} - 多边形质心
 */
export function polygonCentroid(polygon) {
  if (!polygon || polygon.length === 0) return { x: 0, y: 0 };
  
  const sum = polygon.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  
  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length,
  };
}
