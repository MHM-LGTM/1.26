/**
 * 电流粒子渲染引擎
 * ---------------------------------
 * 功能：
 * - 渲染沿导线运动的发光粒子（模拟电流）
 * - 渲染元件效果（电阻发热、灯泡发光等）
 * - 支持短路效果（导线发红、粒子极快）
 * - 实时响应参数变化
 * 
 * 2026-02-01 创建
 */

import { calculateBranchParticleSpeed, getElementEffect, getAllWirePaths } from './circuitAnalysis.js';

/**
 * 电流渲染器类
 */
export class CurrentRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.animationId = null;
    this.isRunning = false;
    
    // 配置
    this.options = {
      particleCount: options.particleCount || 50,      // 每条支路粒子数
      particleRadius: options.particleRadius || 3,      // 粒子半径
      particleColor: options.particleColor || '#FFD700', // 金黄色
      glowRadius: options.glowRadius || 8,              // 发光半径
      baseSpeed: options.baseSpeed || 2,                // 基础速度（像素/帧）
      ...options
    };
    
    // 状态
    this.branchData = null;
    this.elements = null;
    this.wirePaths = [];
    this.voltage = 3;
  }
  
  /**
   * 初始化渲染器
   * @param {Object} circuitData - 电路分析结果
   * @param {Array} elements - 元件列表
   */
  initialize(circuitData, elements) {
    console.log('[CurrentRenderer] 初始化渲染器');
    console.log('[CurrentRenderer] circuitData:', circuitData);
    console.log('[CurrentRenderer] elements数量:', elements?.length);
    
    this.branchData = circuitData;
    this.elements = elements;
    this.voltage = circuitData.voltage || 3;
    this.wirePaths = getAllWirePaths(circuitData);
    
    console.log('[CurrentRenderer] wirePaths数量:', this.wirePaths.length);
    console.log('[CurrentRenderer] branches数量:', circuitData.branches?.length);
    
    // 生成粒子
    this.generateParticles();
    
    console.log('[CurrentRenderer] 生成粒子数量:', this.particles.length);
  }
  
  /**
   * 生成粒子
   */
  generateParticles() {
    this.particles = [];
    
    if (!this.branchData || !this.branchData.branches) {
      console.warn('[CurrentRenderer] 无有效分支数据，无法生成粒子');
      return;
    }
    
    console.log('[CurrentRenderer] 开始生成粒子，分支数:', this.branchData.branches.length);
    
    // 找出最小电阻（用于计算相对速度）
    const minResistance = Math.min(
      ...this.branchData.branches
        .filter(b => b.resistance > 0 && b.resistance < Infinity)
        .map(b => b.resistance),
      10 // 默认最小值
    );
    
    console.log('[CurrentRenderer] 最小电阻:', minResistance);
    
    for (let branchIdx = 0; branchIdx < this.branchData.branches.length; branchIdx++) {
      const branch = this.branchData.branches[branchIdx];
      
      if (branch.resistance === Infinity) {
        console.log(`[CurrentRenderer] 分支${branchIdx}: 跳过（电阻为无穷大）`);
        continue;
      }
      
      console.log(`[CurrentRenderer] 分支${branchIdx}:`, {
        resistance: branch.resistance,
        wirePaths: branch.wirePaths?.length || 0,
        isShortCircuit: branch.isShortCircuit
      });
      
      // 计算该支路的粒子速度
      const speed = calculateBranchParticleSpeed(
        branch.resistance,
        minResistance,
        this.voltage
      );
      
      console.log(`[CurrentRenderer] 分支${branchIdx} 粒子速度:`, speed);
      
      // 为该支路的每段导线生成粒子
      if (!branch.wirePaths || branch.wirePaths.length === 0) {
        console.warn(`[CurrentRenderer] 分支${branchIdx}: 无导线路径数据`);
        continue;
      }
      
      for (let pathIdx = 0; pathIdx < branch.wirePaths.length; pathIdx++) {
        const wirePath = branch.wirePaths[pathIdx];
        
        if (!wirePath || wirePath.length < 2) {
          console.warn(`[CurrentRenderer] 分支${branchIdx} 路径${pathIdx}: 无效（点数: ${wirePath?.length || 0}）`);
          continue;
        }
        
        console.log(`[CurrentRenderer] 分支${branchIdx} 路径${pathIdx}: ${wirePath.length}个点`);
        
        // 检查路径数据格式
        if (wirePath.length > 0) {
          console.log(`[CurrentRenderer] 分支${branchIdx} 路径${pathIdx} 前3个点:`, wirePath.slice(0, 3));
        }
        
        // 根据路径长度决定粒子数量
        const pathLength = this.calculatePathLength(wirePath);
        const particleCount = Math.max(2, Math.floor(pathLength / 30));
        
        console.log(`[CurrentRenderer] 分支${branchIdx} 路径${pathIdx}: 长度=${pathLength.toFixed(1)}, 粒子数=${particleCount}`);
        
        for (let i = 0; i < particleCount; i++) {
          this.particles.push({
            pathIndex: this.wirePaths.findIndex(wp => wp.path === wirePath),
            path: wirePath,
            progress: i / particleCount, // 0-1 之间的进度
            speed: speed * this.options.baseSpeed,
            isShortCircuit: branch.isShortCircuit,
            branchIndex: branch.index
          });
        }
      }
    }
    
    console.log('[CurrentRenderer] 粒子生成完成，总数:', this.particles.length);
  }
  
  /**
   * 计算路径总长度
   */
  calculatePathLength(path) {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      
      // 调试：检查异常值
      if (!isFinite(segmentLength) || segmentLength < 0) {
        console.error('[CurrentRenderer] 路径段长度异常:', {
          segment: i,
          from: path[i - 1],
          to: path[i],
          dx, dy, segmentLength
        });
      }
      
      length += segmentLength;
    }
    return length;
  }
  
  /**
   * 获取路径上某个进度点的位置
   */
  getPositionOnPath(path, progress) {
    if (!path || path.length < 2) return null;
    
    const totalLength = this.calculatePathLength(path);
    const targetLength = progress * totalLength;
    
    let accumulatedLength = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      
      if (accumulatedLength + segmentLength >= targetLength) {
        const t = (targetLength - accumulatedLength) / segmentLength;
        return {
          x: path[i - 1].x + dx * t,
          y: path[i - 1].y + dy * t
        };
      }
      
      accumulatedLength += segmentLength;
    }
    
    // 返回路径末端
    return { x: path[path.length - 1].x, y: path[path.length - 1].y };
  }
  
  /**
   * 更新粒子位置
   */
  updateParticles() {
    const pathLength = 1; // 归一化路径长度
    
    for (const particle of this.particles) {
      // 更新进度
      const speedFactor = particle.speed / (this.calculatePathLength(particle.path) || 100);
      particle.progress += speedFactor;
      
      // 循环
      if (particle.progress >= 1) {
        particle.progress = 0;
      }
    }
  }
  
  /**
   * 渲染一帧
   */
  render() {
    if (!this.ctx) {
      console.error('[CurrentRenderer] 渲染上下文丢失');
      return;
    }
    
    // 清除画布（保持透明以便叠加在电路图上）
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 渲染短路导线（红色发光）
    this.renderShortCircuitWires();
    
    // 渲染元件效果
    this.renderElementEffects();
    
    // 渲染粒子
    this.renderParticles();
  }
  
  /**
   * 渲染短路导线
   */
  renderShortCircuitWires() {
    for (const wireInfo of this.wirePaths) {
      if (!wireInfo.isShortCircuit) continue;
      
      const path = wireInfo.path;
      if (!path || path.length < 2) continue;
      
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
      this.ctx.lineWidth = 4;
      this.ctx.shadowColor = 'red';
      this.ctx.shadowBlur = 15;
      
      this.ctx.beginPath();
      this.ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        this.ctx.lineTo(path[i].x, path[i].y);
      }
      this.ctx.stroke();
      this.ctx.restore();
    }
  }
  
  /**
   * 渲染元件效果
   */
  renderElementEffects() {
    if (!this.elements || !this.branchData) return;
    
    for (let i = 0; i < this.elements.length; i++) {
      const element = this.elements[i];
      const current = this.branchData.currents[i] || 0;
      
      if (current <= 0) continue;
      
      const effect = getElementEffect(element, current);
      if (!effect) continue;
      
      // 获取元件中心位置
      const center = this.getElementCenter(element);
      if (!center) continue;
      
      this.ctx.save();
      
      switch (effect.type) {
        case 'heat':
          // 电阻发热效果
          this.ctx.fillStyle = effect.color;
          this.ctx.shadowColor = 'orange';
          this.ctx.shadowBlur = 10 * effect.intensity;
          this.ctx.beginPath();
          this.ctx.arc(center.x, center.y, 15 + effect.intensity * 10, 0, Math.PI * 2);
          this.ctx.fill();
          break;
        
        case 'glow':
          // 灯泡发光效果 - 添加安全检查
          const radius = effect.radius || 30;
          if (isFinite(center.x) && isFinite(center.y) && isFinite(radius) && radius > 0) {
            const gradient = this.ctx.createRadialGradient(
              center.x, center.y, 0,
              center.x, center.y, radius
            );
            gradient.addColorStop(0, effect.color);
            gradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
          }
          break;
        
        case 'reading':
          // 仪表读数
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          this.ctx.fillRect(center.x - 25, center.y - 10, 50, 20);
          this.ctx.fillStyle = 'lime';
          this.ctx.font = '12px monospace';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(effect.value, center.x, center.y);
          break;
      }
      
      this.ctx.restore();
    }
  }
  
  /**
   * 获取元件中心位置
   * 注意：contour 格式为 [{x, y}, {x, y}, ...]
   */
  getElementCenter(element) {
    if (!element.contour || element.contour.length === 0) return null;
    
    let sumX = 0, sumY = 0;
    let validCount = 0;
    
    for (const point of element.contour) {
      const x = point.x;
      const y = point.y;
      
      if (typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y)) {
        sumX += x;
        sumY += y;
        validCount++;
      }
    }
    
    if (validCount === 0) return null;
    
    const centerX = sumX / validCount;
    const centerY = sumY / validCount;
    
    // 确保返回有效数值
    if (!isFinite(centerX) || !isFinite(centerY)) return null;
    
    return { x: centerX, y: centerY };
  }
  
  /**
   * 渲染粒子
   */
  renderParticles() {
    for (const particle of this.particles) {
      const pos = this.getPositionOnPath(particle.path, particle.progress);
      if (!pos) continue;
      
      this.ctx.save();
      
      // 粒子颜色
      let color = this.options.particleColor;
      let glowColor = 'rgba(255, 215, 0, 0.6)';
      
      if (particle.isShortCircuit) {
        // 短路粒子：更亮更红
        color = '#FF6600';
        glowColor = 'rgba(255, 100, 0, 0.8)';
      }
      
      // 发光效果
      this.ctx.shadowColor = glowColor;
      this.ctx.shadowBlur = this.options.glowRadius;
      
      // 绘制粒子
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, this.options.particleRadius, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 额外的核心高亮
      this.ctx.fillStyle = 'white';
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, this.options.particleRadius * 0.4, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
    }
  }
  
  /**
   * 动画循环
   */
  animate() {
    if (!this.isRunning) return;
    
    this.updateParticles();
    this.render();
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }
  
  /**
   * 开始动画
   */
  start() {
    if (this.isRunning) {
      console.log('[CurrentRenderer] 动画已在运行中');
      return;
    }
    
    console.log('[CurrentRenderer] 启动动画，粒子数:', this.particles.length);
    
    this.isRunning = true;
    this.animate();
  }
  
  /**
   * 停止动画
   */
  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  /**
   * 清除画布
   */
  clear() {
    this.stop();
    this.particles = [];
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
  
  /**
   * 更新参数（实时响应）
   * @param {Object} newCircuitData - 新的电路分析结果
   * @param {Array} newElements - 新的元件列表
   */
  updateParameters(newCircuitData, newElements) {
    const wasRunning = this.isRunning;
    
    // 更新数据
    this.branchData = newCircuitData;
    this.elements = newElements;
    this.voltage = newCircuitData.voltage || this.voltage;
    this.wirePaths = getAllWirePaths(newCircuitData);
    
    // 重新生成粒子（保持动画流畅）
    this.regenerateParticlesSmooth();
    
    // 如果之前在运行，继续运行
    if (wasRunning && !this.isRunning) {
      this.start();
    }
  }
  
  /**
   * 平滑重新生成粒子（保持现有粒子位置）
   */
  regenerateParticlesSmooth() {
    const oldParticles = [...this.particles];
    this.generateParticles();
    
    // 尝试保持粒子进度（简单实现）
    for (let i = 0; i < Math.min(oldParticles.length, this.particles.length); i++) {
      if (this.particles[i].branchIndex === oldParticles[i].branchIndex) {
        this.particles[i].progress = oldParticles[i].progress;
      }
    }
  }
  
  /**
   * 设置画布尺寸
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}

/**
 * 创建渲染器实例的工厂函数
 */
export function createCurrentRenderer(canvas, options = {}) {
  return new CurrentRenderer(canvas, options);
}
