/**
 * =====================================================
 * 物理引擎模块 - physicsEngine.js (重构版)
 * =====================================================
 *
 * 【文件概述】
 * 本文件是前端物理模拟的核心引擎，基于 Matter.js 库实现。
 * 负责将后端识别出的物体转换为物理刚体，并在画布上进行实时物理模拟。
 *
 * 【重构说明】2026-01-30
 * 为提高代码可维护性，原1400行的单体文件已拆分为多个模块：
 * - geometry.js：几何计算工具（面积、质心、凸包）
 * - pathSimplification.js：路径简化和预处理
 * - convexDecomposition.js：凸分解算法
 * - bodyCreator.js：刚体创建和属性应用
 * 
 * 本文件保留主函数 runSimulation() 和物理引擎核心逻辑。
 *
 * 【主要功能】
 * 1. 在原图上进行物理模拟：渲染画布与物体坐标严格按原图位置与比例对齐
 * 2. 将后端返回的物体数据（轮廓、物理属性）构造成 Matter.js 刚体
 * 3. 支持物体贴图（sprite）渲染
 * 4. 支持凹面体和凸面体的不同处理策略
 * 5. 自动添加边界墙防止物体飞出画布
 * 6. 支持约束系统（单摆、弹簧等）
 * 7. 支持交互模式（鼠标拖拽）
 */

import Matter from 'matter-js';
import decomp from 'poly-decomp';

// 导入拆分的模块
import { toConvexHull } from './physics/geometry.js';
import { douglasPeucker, preprocessContour, DP_EPSILON } from './physics/pathSimplification.js';
import { decomposeToConvexPolygons } from './physics/convexDecomposition.js';
import { createConvexHullBody, applyPhysicsProperties } from './physics/bodyCreator.js';
import { VerletRope } from './physics/ropeSystem.js';

// 解构 Matter.js 常用模块
const { Engine, Render, Runner, Bodies, Composite, Body, Events, Vertices, Mouse, MouseConstraint } = Matter;

// 全局注册 poly-decomp 到 Matter.js
if (typeof window !== 'undefined') {
  window.decomp = decomp;
}
Matter.Common.setDecomp(decomp);


/**
 * 运行物理模拟（主入口函数）
 * =========================
 *
 * 【功能】创建 Matter.js 物理世界，添加物体和约束，启动模拟
 *
 * 【调用方式】
 * ```javascript
 * import { runSimulation } from '@/utils/physicsEngine';
 *
 * runSimulation({
 *   container: canvasContainerRef.current,
 *   objects: responseData.objects,
 *   constraints: constraintRelations,
 *   imageRect: imageElement.getBoundingClientRect(),
 *   naturalSize: { w: image.naturalWidth, h: image.naturalHeight },
 *   frozen: false,
 *   interactiveMode: false
 * });
 * ```
 *
 * @param {Object} options - 配置对象
 * @param {HTMLElement} options.container - 画布挂载容器
 * @param {Array} options.objects - 物体数据数组
 * @param {Array} options.constraints - 约束关系数组
 * @param {DOMRect} options.imageRect - 图片在页面上的位置和尺寸
 * @param {Object} options.naturalSize - 原图的原始尺寸 { w, h }
 * @param {boolean} options.frozen - 是否创建冻结的刚体
 * @param {boolean} options.interactiveMode - 是否启用交互模式
 * @param {number} options.timeScale - 时间缩放系数（1.0=正常速度, 0.5=慢镜头, 2.0=快镜头）
 *
 * @returns {Object} - 返回模拟控制器
 */
export function runSimulation({ 
  container, 
  objects = [], 
  constraints = [], 
  imageRect, 
  naturalSize = { w: 0, h: 0 }, 
  frozen = false, 
  interactiveMode = false,
  timeScale = 1.0
}) {

  // ────────────────────────────────────────────────────────────────
  // 第一部分：布局计算
  // ────────────────────────────────────────────────────────────────

  const containerRect = container?.getBoundingClientRect?.() || {
    left: 0, top: 0, width: 640, height: 360
  };

  const imgRect = imageRect || containerRect;

  const width = Math.max(1, Math.floor(imgRect.width || 640));
  const height = Math.max(1, Math.floor(imgRect.height || 360));

  const offX = Math.round((imgRect.left || 0) - (containerRect.left || 0));
  const offY = Math.round((imgRect.top || 0) - (containerRect.top || 0));

  const sx = naturalSize.w ? width / naturalSize.w : 1;
  const sy = naturalSize.h ? height / naturalSize.h : 1;


  // ────────────────────────────────────────────────────────────────
  // 第二部分：Matter.js 初始化
  // ────────────────────────────────────────────────────────────────

  const engine = Engine.create();
  
  // 应用时间缩放（慢镜头/快镜头功能）
  engine.timing.timeScale = timeScale;
  console.log(`[物理引擎] 时间缩放已设置为: ${timeScale}x`);

  const render = Render.create({
    element: container || document.body,
    engine,
    options: {
      width,
      height,
      wireframes: false,
      background: 'transparent'
    },
  });

  // 绳子系统初始化
  const ropes = [];
  
  // 凹面体精灵图信息存储
  const concaveSprites = [];


  // ────────────────────────────────────────────────────────────────
  // 第三部分：画布定位
  // ────────────────────────────────────────────────────────────────

  if (render?.canvas?.style) {
    render.canvas.style.position = 'absolute';
    render.canvas.style.left = `${offX}px`;
    render.canvas.style.top = `${offY}px`;
    render.canvas.style.pointerEvents = 'auto';
  }


  // ────────────────────────────────────────────────────────────────
  // 第四部分：物体创建逻辑
  // ────────────────────────────────────────────────────────────────

  let hasStatic = false;
  const bodiesMap = {};
  const conveyorParams = new Map();

  objects.forEach((obj) => {
    // 跳过约束类型元素
    if (obj.role === 'constraint') {
      console.log(`[物理引擎] 跳过约束元素（不创建刚体）: ${obj.name || '未命名'}`);
      return;
    }

    const raw = Array.isArray(obj.contour) ? obj.contour : [];
    if (raw.length < 3) return;

    // 步骤1：缩放轮廓点到画布坐标系
    const scaled = raw.map((p) => ({
      x: Math.round(p.x * sx),
      y: Math.round(p.y * sy)
    }));

    // 步骤2：预处理轮廓
    const processed = preprocessContour(scaled);
    if (processed.length < 3) return;

    // 步骤3：获取物体属性
    const isConcave = obj.is_concave === true;
    const isStatic = obj.role === 'static';
    if (isStatic) hasStatic = true;

    // 步骤4：提取物理参数
    const restitution = Number(obj?.parameters?.restitution ?? 0.5);
    const friction = Number(obj?.parameters?.friction_coefficient ?? 0.2);
    const air = Number(obj?.parameters?.air_drag ?? 0.0);

    // 步骤5：根据凹凸性和静态/动态选择不同的创建策略
    if (!isConcave) {
      // 情况A：凸多边形 - 强制使用凸包
      const hullPoints = toConvexHull(processed);
      const verts = Vertices.create(hullPoints, Matter);
      const center = Matter.Vertices.centre(verts);

      const body = Bodies.fromVertices(center.x, center.y, verts, {
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
        const bodyName = obj.name || `body-${Object.keys(bodiesMap).length}`;
        bodiesMap[bodyName] = body;
        
        // 识别并记录传送带参数
        const speed = Number(obj?.parameters?.conveyor_speed ?? NaN);
        const isConveyor = !isNaN(speed) || String(obj?.element_type || '').toLowerCase() === 'conveyor_belt';
        if (isStatic && isConveyor) {
          body.label = 'conveyor';
          conveyorParams.set(bodyName, { speed: isNaN(speed) ? 0 : speed });
        }
        console.log(`[物理引擎] 凸多边形创建成功 (凸包): ${bodyName}`);
      }

    } else if (isStatic) {
      // 情况B：静态凹面体 - DP简化 + 凸分解
      const simplified = douglasPeucker(processed, DP_EPSILON);

      if (simplified.length < 3) {
        console.warn(`[物理引擎] DP简化后顶点不足，回退到凸包: ${obj.name || '未命名'}`);
        createConvexHullBody(processed, obj, isStatic, friction, air, restitution, sx, sy, Bodies, Vertices, Body, Composite, engine, bodiesMap);
        return;
      }

      console.log(`[物理引擎] DP简化: ${processed.length} 点 → ${simplified.length} 点`);

      const convexPolygons = decomposeToConvexPolygons(simplified);

      if (convexPolygons.length === 0) {
        console.warn(`[物理引擎] 凸分解失败，回退到凸包: ${obj.name || '未命名'}`);
        createConvexHullBody(processed, obj, isStatic, friction, air, restitution, sx, sy, Bodies, Vertices, Body, Composite, engine, bodiesMap);
        return;
      }

      const concaveComposite = Composite.create({
        label: `凹面体-${obj.name || '未命名'}`
      });

      // 如果有精灵图，分解的凸多边形设为透明，稍后手动绘制精灵图
      const hasSprite = !!obj.sprite_data_url;

      convexPolygons.forEach((polygon, idx) => {
        const polyVerts = Vertices.create(polygon, Matter);
        const polyCenter = Matter.Vertices.centre(polyVerts);

        const polyBody = Bodies.fromVertices(polyCenter.x, polyCenter.y, polyVerts, {
          isStatic: true,
          friction,
          frictionStatic: 0.5,
          restitution,
          render: hasSprite 
            ? { visible: false }  // 有精灵图时隐藏物理刚体
            : { fillStyle: '#94a3b8' },  // 无精灵图时显示灰色填充
        });

        if (polyBody) {
          Composite.add(concaveComposite, polyBody);
        }
      });

      Composite.add(engine.world, concaveComposite);
      
      // 保存凹面体的精灵图信息，用于手动渲染
      if (hasSprite) {
        // 计算原始轮廓的包围盒和中心点
        const minX = Math.min(...processed.map(p => p.x));
        const maxX = Math.max(...processed.map(p => p.x));
        const minY = Math.min(...processed.map(p => p.y));
        const maxY = Math.max(...processed.map(p => p.y));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const spriteWidth = maxX - minX;
        const spriteHeight = maxY - minY;
        
        concaveSprites.push({
          texture: obj.sprite_data_url,
          center: { x: centerX, y: centerY },
          width: spriteWidth,
          height: spriteHeight,
          composite: concaveComposite
        });
        
        console.log(`[物理引擎] 静态凹面体创建成功（含精灵图）: ${obj.name || '未命名'}, 分解为 ${convexPolygons.length} 个凸多边形`);
      } else {
        console.log(`[物理引擎] 静态凹面体创建成功: ${obj.name || '未命名'}, 分解为 ${convexPolygons.length} 个凸多边形`);
      }

    } else {
      // 情况C：动态凹面体 - 使用凸包近似
      console.log(`[物理引擎] 动态凹面体使用凸包近似: ${obj.name || '未命名'}`);
      createConvexHullBody(processed, obj, isStatic, friction, air, restitution, sx, sy, Bodies, Vertices, Body, Composite, engine, bodiesMap);
    }
  });

  // ────────────────────────────────────────────────────────────────
  // 第 4.4 部分：滑轮对象创建
  // ────────────────────────────────────────────────────────────────

  const pulleys = [];

  objects.forEach((obj, idx) => {
    // 识别定滑轮类型
    if (obj.element_type === 'pulley_fixed') {
      const bodyName = obj.name || `pulley-${idx}`;
      const body = bodiesMap[bodyName];
      
      if (!body) {
        console.warn(`[滑轮系统] 未找到定滑轮刚体: ${bodyName}`);
        return;
      }
      
      // 计算滑轮半径（根据轮廓大小）
      const bounds = body.bounds;
      const width = bounds.max.x - bounds.min.x;
      const height = bounds.max.y - bounds.min.y;
      const radius = Math.min(width, height) / 2;
      
      // 确保定滑轮是静态的
      Body.setStatic(body, true);
      
      pulleys.push({
        body: body,
        position: body.position,
        radius: radius,
        angle: 0,  // 旋转角度（用于显示辐条）
        isStatic: true,
        spriteUrl: obj.sprite_data_url,
        name: bodyName
      });
      
      console.log(`[滑轮系统] 创建定滑轮: ${bodyName}, 半径=${radius.toFixed(1)}px`);
    }
  });


  // ────────────────────────────────────────────────────────────────
  // 第 4.5 部分：约束创建逻辑
  // ────────────────────────────────────────────────────────────────

  const Constraint = Matter.Constraint;
  const REDUCED_BODY_SIZE = { width: 20, height: 20 };

  if (constraints && constraints.length > 0) {
    console.log(`[约束系统] 开始创建 ${constraints.length} 个约束`);

    constraints.forEach((c, idx) => {
      const isSpring = c.springType === 'constraint' || c.springType === 'launcher';
      // 修复：检查元素类型而不是约束类型，避免与单摆的绳子约束混淆
      const isRopeConstraint = c.element_type === 'rope_constraint' && c.secondPivotPoint;

      // 绳索系统处理（优先于弹簧处理）
      if (isRopeConstraint) {
        console.log(`[绳索系统] 处理绳索约束元素: ${c.bodyName}`);

        const firstPoint = {
          x: Math.round((c.pivotPoint?.x || 0) * sx),
          y: Math.round((c.pivotPoint?.y || 0) * sy)
        };
        const secondPoint = {
          x: Math.round((c.secondPivotPoint?.x || 0) * sx),
          y: Math.round((c.secondPivotPoint?.y || 0) * sy)
        };

        const firstBody = bodiesMap[c.pivotName];
        const secondBody = bodiesMap[c.secondPivotName];

        // 创建 VerletRope 实例
        const ropeParams = c.parameters || {};
        const segments = ropeParams.segments || 15;
        const stiffness = ropeParams.stiffness || 0.9;
        const damping = ropeParams.damping || 0.98;

        const rope = new VerletRope(
          firstPoint.x,
          firstPoint.y,
          secondPoint.x,
          secondPoint.y,
          segments,
          stiffness,
          damping
        );

        // 附着到第一个端点
        if (firstBody) {
          rope.attachToBody({
            body: firstBody,
            offset: { x: 0, y: 0 }
          }, true);
          console.log(`[绳索系统] 第一端连接到物体: ${c.pivotName}`);
        } else {
          rope.points[0].pinned = true;
          rope.points[0].x = firstPoint.x;
          rope.points[0].y = firstPoint.y;
          rope.points[0].oldX = firstPoint.x;
          rope.points[0].oldY = firstPoint.y;
          console.log(`[绳索系统] 第一端固定在世界坐标: (${firstPoint.x}, ${firstPoint.y})`);
        }

        // 附着到第二个端点
        if (secondBody) {
          rope.attachToBody({
            body: secondBody,
            offset: { x: 0, y: 0 }
          }, false);
          console.log(`[绳索系统] 第二端连接到物体: ${c.secondPivotName}`);
        } else {
          const lastIdx = rope.points.length - 1;
          rope.points[lastIdx].pinned = true;
          rope.points[lastIdx].x = secondPoint.x;
          rope.points[lastIdx].y = secondPoint.y;
          rope.points[lastIdx].oldX = secondPoint.x;
          rope.points[lastIdx].oldY = secondPoint.y;
          console.log(`[绳索系统] 第二端固定在世界坐标: (${secondPoint.x}, ${secondPoint.y})`);
        }

        ropes.push(rope);
        console.log(`[绳索系统] 绳索创建成功，段数: ${segments}`);

        return;
      }

      if (isSpring && c.secondPivotPoint) {
        // 弹簧系统处理
        console.log(`[弹簧系统] 处理${c.springType}类型弹簧: ${c.bodyName}`);

        const firstPoint = {
          x: Math.round((c.pivotPoint?.x || 0) * sx),
          y: Math.round((c.pivotPoint?.y || 0) * sy)
        };
        const secondPoint = {
          x: Math.round((c.secondPivotPoint?.x || 0) * sx),
          y: Math.round((c.secondPivotPoint?.y || 0) * sy)
        };

        const firstBody = bodiesMap[c.pivotName];
        const secondBody = bodiesMap[c.secondPivotName];

        if (c.springType === 'constraint') {
          const springConstraint = Constraint.create({
            bodyA: firstBody,
            pointA: firstBody ? undefined : firstPoint,
            bodyB: secondBody,
            pointB: secondBody ? undefined : secondPoint,
            length: c.springLength * Math.max(sx, sy),
            stiffness: (c.stiffness || 100) / 1000,
            damping: c.damping || 0.1,
            render: {
              visible: true,
              lineWidth: 2,
              strokeStyle: '#000000',
              type: 'spring'
            }
          });
          Composite.add(engine.world, springConstraint);
          console.log(`[弹簧系统] 创建约束型弹簧: ${c.pivotName} ↔ ${c.secondPivotName}`);

        } else if (c.springType === 'launcher') {
          const reducedBody = Bodies.rectangle(
            firstPoint.x + (secondPoint.x - firstPoint.x) * 0.9,
            firstPoint.y + (secondPoint.y - firstPoint.y) * 0.9,
            REDUCED_BODY_SIZE.width,
            REDUCED_BODY_SIZE.height,
            {
              mass: 0.5,
              restitution: 0.1,
              friction: 0.0,
              frictionAir: 0.0,
              label: 'spring_launcher_reduced',
              render: { fillStyle: '#94a3b8' }
            }
          );

          const springConstraint = Constraint.create({
            bodyA: firstBody,
            pointA: firstBody ? undefined : firstPoint,
            bodyB: reducedBody,
            length: c.springLength * Math.max(sx, sy) - REDUCED_BODY_SIZE.width,
            stiffness: (c.stiffness || 200) / 1000,
            damping: c.damping || 0.05,
            render: { visible: false }
          });

          Composite.add(engine.world, [reducedBody, springConstraint]);

          Events.on(engine, 'collisionStart', (event) => {
            event.pairs.forEach(pair => {
              if ((pair.bodyA.label === 'spring_launcher_reduced' || pair.bodyB.label === 'spring_launcher_reduced') &&
                  (secondBody && (pair.bodyA === secondBody || pair.bodyB === secondBody))) {
                setTimeout(() => {
                  Matter.World.remove(engine.world, reducedBody);
                  Matter.World.remove(engine.world, springConstraint);
                }, 100);
              }
            });
          });

          console.log(`[弹簧系统] 创建弹射型弹簧: ${c.pivotName} → 削减刚体 → ${c.secondPivotName}`);
        }

        return;
      }

      // 单摆系统处理
      const bodyB = bodiesMap[c.bodyName];
      if (!bodyB) {
        console.warn(`[约束系统] 未找到物体: ${c.bodyName}，跳过约束 ${idx}`);
        return;
      }

      const pivotPointScaled = {
        x: Math.round((c.pivotPoint?.x || 0) * sx),
        y: Math.round((c.pivotPoint?.y || 0) * sy),
      };

      let stiffness = c.stiffness ?? 1.0;
      if (c.constraintType === 'spring') {
        stiffness = c.stiffness ?? 0.3;
      } else if (c.constraintType === 'rope') {
        stiffness = c.stiffness ?? 0.9;
      }

      const length = c.length ? c.length * Math.max(sx, sy) : undefined;
      const pivotBody = bodiesMap[c.pivotName];

      let constraint;

      if (pivotBody) {
        constraint = Constraint.create({
          bodyA: pivotBody,
          bodyB: bodyB,
          length: length,
          stiffness: stiffness,
          render: {
            visible: true,
            lineWidth: 2,
            strokeStyle: c.constraintType === 'spring' ? '#22c55e' : '#000000',
            type: c.constraintType === 'spring' ? 'spring' : 'line',
          },
        });
        console.log(`[约束系统] 创建物体间约束: ${c.bodyName} → ${c.pivotName}`);

      } else {
        constraint = Constraint.create({
          pointA: pivotPointScaled,
          bodyB: bodyB,
          length: length,
          stiffness: stiffness,
          render: {
            visible: true,
            lineWidth: 2,
            strokeStyle: c.constraintType === 'spring' ? '#22c55e' : '#000000',
            type: c.constraintType === 'spring' ? 'spring' : 'line',
          },
        });
        console.log(`[约束系统] 创建固定点约束: ${c.bodyName} → 世界坐标(${pivotPointScaled.x}, ${pivotPointScaled.y})`);
      }

      if (constraint) {
        Composite.add(engine.world, constraint);
      }
    });

    console.log(`[约束系统] 约束创建完成，共 ${constraints.length} 个`);
  }


  // ────────────────────────────────────────────────────────────────
  // 第五部分：边界墙创建
  // ────────────────────────────────────────────────────────────────

  if (!hasStatic) {
    const t = Math.max(10, Math.floor(Math.min(width, height) * 0.02));

    const walls = [
      Bodies.rectangle(width / 2, -t / 2, width, t, {
        isStatic: true,
        render: { visible: false }
      }),
      Bodies.rectangle(width / 2, height + t / 2, width, t, {
        isStatic: true,
        render: { visible: false }
      }),
      Bodies.rectangle(-t / 2, height / 2, t, height, {
        isStatic: true,
        render: { visible: false }
      }),
      Bodies.rectangle(width + t / 2, height / 2, t, height, {
        isStatic: true,
        render: { visible: false }
      }),
    ];

    Composite.add(engine.world, walls);
  }


  // ────────────────────────────────────────────────────────────────
  // 第六部分：启动模拟
  // ────────────────────────────────────────────────────────────────

  Render.run(render);

  const runner = Runner.create();

  // 绳索系统更新和渲染（即使初始没有绳子也要绑定事件，因为后续可能加载动画）
  const ropeUpdateHandler = () => {
    // 更新滑轮位置（虽然定滑轮是静态的，但保持位置引用更新）
    pulleys.forEach(pulley => {
      pulley.position = pulley.body.position;
    });
    
    if (ropes.length > 0) {
      const gravity = { x: 0, y: 0.15 }; // 适中的重力，让绳子自然下垂
      // 获取所有刚体用于碰撞检测（包括静态和动态）
      const allBodies = Composite.allBodies(engine.world);
      for (const rope of ropes) {
        rope.update(gravity, width, height, allBodies, pulleys);
        
        // 更新滑轮旋转
        pulleys.forEach(pulley => {
          rope.updatePulleyRotation(pulley);
        });
      }
    }
  };

  /**
   * 渲染滑轮（带旋转辐条）
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {Array} pulleys - 滑轮数组
   */
  const renderPulleys = (ctx, pulleys) => {
    pulleys.forEach(pulley => {
      ctx.save();
      ctx.translate(pulley.position.x, pulley.position.y);
      ctx.rotate(pulley.angle);  // 旋转画布
      
      // 如果没有精灵图，绘制默认滑轮图形
      if (!pulley.spriteUrl) {
        // 外圈
        ctx.beginPath();
        ctx.arc(0, 0, pulley.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#00f5ff';  // 青色（定滑轮）
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // 凹槽（绳子放置处）
        ctx.beginPath();
        ctx.arc(0, 0, pulley.radius - 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      
      // 辐条（显示旋转效果）- 总是绘制，即使有精灵图
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.3)';  // 青色半透明
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(angle) * pulley.radius * 0.7,
          Math.sin(angle) * pulley.radius * 0.7
        );
        ctx.stroke();
      }
      
      // 中心轴
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00f5ff';
      ctx.fill();
      
      ctx.restore();
    });
  };

  // 创建精灵图加载缓存
  const spriteImageCache = new Map();
  
  const ropeRenderHandler = () => {
    if (render.context) {
      const ctx = render.context;
      
      // 绘制凹面体精灵图
      if (concaveSprites.length > 0) {
        for (const sprite of concaveSprites) {
          // 检查图片是否已加载
          let img = spriteImageCache.get(sprite.texture);
          if (!img) {
            img = new Image();
            img.src = sprite.texture;
            spriteImageCache.set(sprite.texture, img);
          }
          
          // 只在图片加载完成后绘制
          if (img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.translate(sprite.center.x, sprite.center.y);
            ctx.drawImage(
              img,
              -sprite.width / 2,
              -sprite.height / 2,
              sprite.width,
              sprite.height
            );
            ctx.restore();
          }
        }
      }
      
      // 绘制绳子
      if (ropes.length > 0) {
        for (const rope of ropes) {
          rope.render(ctx);
        }
      }
      
      // 绘制滑轮（在绳子上方）
      if (pulleys.length > 0) {
        renderPulleys(ctx, pulleys);
      }
    }
  };

  Events.on(engine, 'afterUpdate', ropeUpdateHandler);
  Events.on(render, 'afterRender', ropeRenderHandler);

  if (ropes.length > 0) {
    console.log(`[绳索系统] 启用绳索渲染，共 ${ropes.length} 根绳索`);
  }
  
  // 创建鼠标交互约束
  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: {
        visible: false
      }
    }
  });
  
  Composite.add(engine.world, mouseConstraint);
  render.mouse = mouse;
  
  // 冻结模式处理
  let frozenBodies = [];
  let isInteractiveModeActive = interactiveMode;
  
  if (frozen) {
    console.log('[物理引擎] 冻结模式：将所有动态刚体设置为静态');
    const allBodies = Composite.allBodies(engine.world);
    for (const body of allBodies) {
      if (!body.isStatic && body.label !== 'conveyor') {
        body._frozenVelocity = { x: body.velocity.x, y: body.velocity.y };
        body._frozenAngularVelocity = body.angularVelocity;
        
        Body.setVelocity(body, { x: 0, y: 0 });
        Body.setAngularVelocity(body, 0);
        
        body._isFrozen = true;
        frozenBodies.push(body);
      }
    }
    console.log(`[物理引擎] 已冻结 ${frozenBodies.length} 个动态刚体`);
    mouseConstraint.constraint.render.visible = false;
  } else if (isInteractiveModeActive) {
    console.log('[物理引擎] 交互模式：清除所有初始速度，保持物理约束');
    const allBodies = Composite.allBodies(engine.world);
    for (const body of allBodies) {
      if (!body.isStatic && body.label !== 'conveyor') {
        Body.setVelocity(body, { x: 0, y: 0 });
        Body.setAngularVelocity(body, 0);
      }
    }
    Runner.run(runner, engine);
    console.log('[物理引擎] 交互模式已启动，鼠标可拖拽物体');
  } else {
    Runner.run(runner, engine);
  }

  // 传送带推进逻辑
  const onBeforeUpdate = () => {
    const pairs = engine.pairs?.list || [];
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const { bodyA, bodyB } = pair;
      const aIsConv = bodyA?.label === 'conveyor';
      const bIsConv = bodyB?.label === 'conveyor';
      if (!aIsConv && !bIsConv) continue;

      const conveyorBody = aIsConv ? bodyA : bodyB;
      const otherBody = aIsConv ? bodyB : bodyA;
      if (!otherBody || otherBody.isStatic) continue;

      let speed = 0;
      for (const [name, b] of Object.entries(bodiesMap)) {
        if (b === conveyorBody) {
          const cfg = conveyorParams.get(name);
          if (cfg) speed = Number(cfg.speed || 0);
          break;
        }
      }
      Body.setVelocity(otherBody, { x: speed, y: otherBody.velocity.y });
      Body.setAngularVelocity(otherBody, 0);
    }
  };
  Events.on(engine, 'beforeUpdate', onBeforeUpdate);

  // 返回模拟控制器
  const constraintCount = constraints?.length || 0;
  return {
    summary: frozen 
      ? `预览模式：对象数=${objects.length}${constraintCount > 0 ? `，约束数=${constraintCount}` : ''}（点击"开始模拟"启动物理效果）`
      : `模拟运行中：对象数=${objects.length}${constraintCount > 0 ? `，约束数=${constraintCount}` : ''}`,
    
    unfreeze: () => {
      if (!frozen || frozenBodies.length === 0) {
        console.log('[物理引擎] 已经在运行中，无需解冻');
        return;
      }
      
      console.log('[物理引擎] 解除冻结，启动物理模拟');
      
      for (const body of frozenBodies) {
        if (body._isFrozen) {
          if (body._frozenVelocity) {
            Body.setVelocity(body, body._frozenVelocity);
          }
          if (body._frozenAngularVelocity !== undefined) {
            Body.setAngularVelocity(body, body._frozenAngularVelocity);
          }
          
          delete body._isFrozen;
          delete body._frozenVelocity;
          delete body._frozenAngularVelocity;
        }
      }
      
      Runner.run(runner, engine);
      
      frozen = false;
      frozenBodies = [];
      
      console.log('[物理引擎] 物理模拟已启动');
    },
    
    toggleInteractiveMode: () => {
      const newState = !isInteractiveModeActive;
      isInteractiveModeActive = newState;
      
      if (isInteractiveModeActive) {
        console.log('[物理引擎] 进入交互模式：清除所有初始速度');
        const allBodies = Composite.allBodies(engine.world);
        for (const body of allBodies) {
          if (!body.isStatic && body.label !== 'conveyor' && !body._isFrozen) {
            Body.setVelocity(body, { x: 0, y: 0 });
            Body.setAngularVelocity(body, 0);
          }
        }
      } else {
        console.log('[物理引擎] 退出交互模式：恢复正常物理模拟');
      }
      
      return isInteractiveModeActive;
    },
    
    getInteractiveMode: () => {
      return isInteractiveModeActive;
    },
    
    setTimeScale: (newTimeScale) => {
      const scale = Math.max(0.1, Math.min(3, newTimeScale)); // 限制在 0.1 到 3 之间
      engine.timing.timeScale = scale;
      console.log(`[物理引擎] 时间缩放已更新为: ${scale}x`);
    },
    
    stop: () => {
      console.log('[物理引擎] 停止模拟，清理资源...');
      Runner.stop(runner);
      Render.stop(render);
      Events.off(engine, 'beforeUpdate', onBeforeUpdate);
      Events.off(engine, 'afterUpdate', ropeUpdateHandler);
      Events.off(render, 'afterRender', ropeRenderHandler);
      ropes.length = 0; // 清空绳索数组
      concaveSprites.length = 0; // 清空凹面体精灵图数组
      spriteImageCache.clear(); // 清空精灵图缓存
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      if (render.canvas) {
        render.canvas.remove();
      }
      render.canvas = null;
      render.context = null;
      render.textures = {};
    }
  };
}
