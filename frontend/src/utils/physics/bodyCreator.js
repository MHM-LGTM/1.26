/**
 * 刚体创建模块
 * ====================================
 * 功能：提供刚体创建和物理属性应用的辅助函数
 * - 创建凸包刚体
 * - 应用物理属性（质量、初速度等）
 */

import Matter from 'matter-js';
import { polygonArea } from './geometry.js';
import { toConvexHull } from './geometry.js';

/**
 * 创建凸包刚体
 * ------------
 * 【功能】使用凸包算法创建刚体
 * 【用途】
 *   1. 动态凹面体的近似处理
 *   2. 凸分解失败时的回退方案
 *
 * @param {Array} processed - 处理后的轮廓点
 * @param {Object} obj - 原始物体数据
 * @param {boolean} isStatic - 是否静态
 * @param {number} friction - 摩擦系数
 * @param {number} air - 空气阻力
 * @param {number} restitution - 弹性系数
 * @param {number} sx - X方向缩放比例
 * @param {number} sy - Y方向缩放比例
 * @param {Object} Bodies - Matter.Bodies 模块
 * @param {Object} Vertices - Matter.Vertices 模块
 * @param {Object} Body - Matter.Body 模块
 * @param {Object} Composite - Matter.Composite 模块
 * @param {Object} engine - Matter.Engine 实例
 * @param {Object} bodiesMap - 物体名称到刚体的映射表
 */
export function createConvexHullBody(processed, obj, isStatic, friction, air, restitution, sx, sy, Bodies, Vertices, Body, Composite, engine, bodiesMap) {
  // 生成凸包顶点
  const hullPoints = toConvexHull(processed);
  const hullVerts = Vertices.create(hullPoints, Matter);
  const hullCenter = Matter.Vertices.centre(hullVerts);

  // 创建刚体
  const body = Bodies.fromVertices(hullCenter.x, hullCenter.y, hullVerts, {
    isStatic,
    friction,
    frictionStatic: 0.5,
    frictionAir: air,
    restitution,
    render: obj.sprite_data_url
      ? { sprite: { texture: obj.sprite_data_url, xScale: sx, yScale: sy } }
      : { fillStyle: isStatic ? '#94a3b8' : '#60a5fa' },
  });

  if (body) {
    applyPhysicsProperties(body, obj, processed, isStatic, Body);
    Composite.add(engine.world, body);
    
    // 添加到映射表（用于约束创建）
    const bodyName = obj.name || `body-${Object.keys(bodiesMap).length}`;
    bodiesMap[bodyName] = body;
  }
}


/**
 * 应用物理属性
 * ------------
 * 【功能】为刚体设置质量、初速度、角速度等物理属性
 * 【用途】统一的物理属性应用逻辑
 *
 * 【处理的属性】
 * 1. 质量/密度：根据轮廓面积和给定质量计算密度
 * 2. 初始线速度：X和Y方向的初始速度
 * 3. 初始角速度：旋转的初始速度
 *
 * @param {Object} body - Matter.js 刚体实例
 * @param {Object} obj - 原始物体数据
 * @param {Array} processed - 处理后的轮廓点（用于计算面积）
 * @param {boolean} isStatic - 是否静态物体
 * @param {Object} Body - Matter.Body 模块
 */
export function applyPhysicsProperties(body, obj, processed, isStatic, Body) {

  // ────────────────────────────────────────────────────────────────
  // 质量/密度设置
  // Matter.js 使用密度（density）而不是直接设置质量
  // 密度 = 质量 / 面积
  // ────────────────────────────────────────────────────────────────
  try {
    const area = polygonArea(processed);                              // 计算轮廓面积
    const massKg = Number(obj?.parameters?.mass_kg ?? 0);             // 获取质量参数
    if (!isNaN(massKg) && massKg > 0 && area > 1) {
      const density = Math.max(0.0001, massKg / area);                // 计算密度（设置下限防止过小）
      Body.setDensity(body, density);
    }
  } catch (_) {
    // 计算失败时忽略，使用默认密度
  }

  // ────────────────────────────────────────────────────────────────
  // 初始线速度设置
  // 只对动态物体有效
  // ────────────────────────────────────────────────────────────────
  const vx = Number(obj?.parameters?.initial_velocity_px_s ?? obj?.parameters?.initial_velocity_m_s ?? 0);
  const vy = Number(obj?.parameters?.initial_velocity_y_px_s ?? 0);
  if (!isStatic && (vx || vy)) {
    Body.setVelocity(body, { x: vx, y: vy });
  }

  // ────────────────────────────────────────────────────────────────
  // 初始角速度设置
  // 只对动态物体有效
  // ────────────────────────────────────────────────────────────────
  const w0 = Number(obj?.parameters?.initial_angular_velocity_rad_s ?? 0);
  if (!isStatic && w0) {
    Body.setAngularVelocity(body, w0);
  }
}
