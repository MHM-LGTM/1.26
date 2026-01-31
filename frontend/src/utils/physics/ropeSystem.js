/**
 * Verlet 绳子物理系统
 * 使用 Verlet 积分实现柔性绳子模拟，可与 Matter.js 物理引擎集成
 */

import Matter from 'matter-js';

const { Body } = Matter;

/**
 * VerletRope 类
 * 基于 Verlet 积分的绳子模拟
 * 
 * @class VerletRope
 */
export class VerletRope {
    /**
     * 创建绳子实例
     * @param {number} startX - 起始点 X 坐标
     * @param {number} startY - 起始点 Y 坐标
     * @param {number} endX - 结束点 X 坐标
     * @param {number} endY - 结束点 Y 坐标
     * @param {number} segments - 绳子段数（默认 15）
     * @param {number} stiffness - 刚度系数（0-1，默认 0.8，更柔软自然）
     * @param {number} damping - 阻尼系数（0-1，默认 0.98）
     */
    constructor(startX, startY, endX, endY, segments = 15, stiffness = 0.8, damping = 0.99) {
        this.segments = segments;
        this.stiffness = stiffness;
        this.damping = damping;
        this.points = [];
        this.constraints = [];
        this.attachments = { start: null, end: null };
        this.id = Math.random().toString(36).substr(2, 9);
        
        // 创建点
        const dx = (endX - startX) / segments;
        const dy = (endY - startY) / segments;
        
        for (let i = 0; i <= segments; i++) {
            this.points.push({
                x: startX + dx * i,
                y: startY + dy * i,
                oldX: startX + dx * i,
                oldY: startY + dy * i,
                pinned: false
            });
        }
        
        // 创建约束（每个点与下一个点的距离）
        // 留更多余量让绳子更柔软自然（1.5倍）
        const segmentLength = Math.sqrt(dx * dx + dy * dy) * 1.5;
        for (let i = 0; i < segments; i++) {
            this.constraints.push({
                p1: i,
                p2: i + 1,
                length: segmentLength
            });
        }
    }
    
    /**
     * 附着到刚体
     * @param {Object} bodyData - 包含 body 和 offset 的对象
     * @param {boolean} isStart - 是否为起始端
     */
    attachToBody(bodyData, isStart) {
        if (isStart) {
            this.attachments.start = bodyData;
            this.points[0].pinned = true;
        } else {
            this.attachments.end = bodyData;
            this.points[this.points.length - 1].pinned = true;
        }
    }
    
    /**
     * 更新物理状态
     * @param {Object} gravity - 重力向量 {x, y}（默认 {x: 0, y: 0.5}）
     * @param {number} canvasWidth - 画布宽度（用于边界检测）
     * @param {number} canvasHeight - 画布高度（用于边界检测）
     * @param {Array} bodies - Matter.js 刚体数组（用于碰撞检测）
     */
    update(gravity = { x: 0, y: 0.5 }, canvasWidth = 800, canvasHeight = 600, bodies = []) {
        // 更新附着点位置
        if (this.attachments.start) {
            const body = this.attachments.start.body;
            const offset = this.attachments.start.offset;
            const cos = Math.cos(body.angle);
            const sin = Math.sin(body.angle);
            this.points[0].x = body.position.x + offset.x * cos - offset.y * sin;
            this.points[0].y = body.position.y + offset.x * sin + offset.y * cos;
            this.points[0].oldX = this.points[0].x;
            this.points[0].oldY = this.points[0].y;
        }
        
        if (this.attachments.end) {
            const body = this.attachments.end.body;
            const offset = this.attachments.end.offset;
            const cos = Math.cos(body.angle);
            const sin = Math.sin(body.angle);
            const lastIdx = this.points.length - 1;
            this.points[lastIdx].x = body.position.x + offset.x * cos - offset.y * sin;
            this.points[lastIdx].y = body.position.y + offset.x * sin + offset.y * cos;
            this.points[lastIdx].oldX = this.points[lastIdx].x;
            this.points[lastIdx].oldY = this.points[lastIdx].y;
        }
        
        // Verlet 积分
        for (let point of this.points) {
            if (point.pinned) continue;
            
            const vx = (point.x - point.oldX) * this.damping;
            const vy = (point.y - point.oldY) * this.damping;
            
            point.oldX = point.x;
            point.oldY = point.y;
            point.x += vx + gravity.x;
            point.y += vy + gravity.y;
            
            // 边界碰撞
            if (point.y > canvasHeight - 20) {
                point.y = canvasHeight - 20;
                point.oldY = point.y + vy * 0.5;
            }
            if (point.x < 20) {
                point.x = 20;
                point.oldX = point.x + vx * 0.5;
            }
            if (point.x > canvasWidth - 20) {
                point.x = canvasWidth - 20;
                point.oldX = point.x + vx * 0.5;
            }
        }
        
        // Verlet 积分后立即进行刚体碰撞检测，防止快速移动时穿透
        if (bodies && bodies.length > 0) {
            for (let point of this.points) {
                if (point.pinned) continue;
                
                for (let body of bodies) {
                    // 跳过附着的刚体
                    if ((this.attachments.start && this.attachments.start.body === body) ||
                        (this.attachments.end && this.attachments.end.body === body)) {
                        continue;
                    }
                    
                    const dx = point.x - body.position.x;
                    const dy = point.y - body.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 0.001) continue;
                    
                    // 计算刚体包围圆半径
                    let maxRadius = 0;
                    for (let v of body.vertices) {
                        const vdx = v.x - body.position.x;
                        const vdy = v.y - body.position.y;
                        const vdist = Math.sqrt(vdx * vdx + vdy * vdy);
                        if (vdist > maxRadius) maxRadius = vdist;
                    }
                    
                    const minDist = maxRadius + 4;
                    
                    if (dist < minDist) {
                        const nx = dx / dist;
                        const ny = dy / dist;
                        point.x = body.position.x + nx * minDist;
                        point.y = body.position.y + ny * minDist;
                        // 清除速度
                        point.oldX = point.x;
                        point.oldY = point.y;
                    }
                }
            }
        }
        
        // 约束求解（参考滑轮算法，使用25次迭代）
        for (let iter = 0; iter < 25; iter++) {
            // 距离约束（绳子只能拉伸，不能压缩）
            for (let c of this.constraints) {
                const p1 = this.points[c.p1];
                const p2 = this.points[c.p2];
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 0.0001) continue;
                
                // 只在绳子被拉伸（距离大于约束长度）时施加约束力
                // 这样绳子在松弛时可以自然下垂
                if (dist > c.length) {
                    const diff = (c.length - dist) / dist * this.stiffness;
                    const offsetX = dx * diff * 0.5;
                    const offsetY = dy * diff * 0.5;
                    
                    if (!p1.pinned) {
                        p1.x -= offsetX;
                        p1.y -= offsetY;
                    }
                    if (!p2.pinned) {
                        p2.x += offsetX;
                        p2.y += offsetY;
                    }
                }
            }
            
            // 刚体碰撞约束（严格版，防止嵌入）
            if (bodies && bodies.length > 0) {
                for (let point of this.points) {
                    if (point.pinned) continue;
                    
                    for (let body of bodies) {
                        // 跳过附着的刚体
                        if ((this.attachments.start && this.attachments.start.body === body) ||
                            (this.attachments.end && this.attachments.end.body === body)) {
                            continue;
                        }
                        
                        // 计算点到刚体中心的距离
                        const dx = point.x - body.position.x;
                        const dy = point.y - body.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist < 0.001) continue;
                        
                        // 计算刚体的近似半径（使用包围圆）
                        let maxRadius = 0;
                        for (let v of body.vertices) {
                            const vdx = v.x - body.position.x;
                            const vdy = v.y - body.position.y;
                            const vdist = Math.sqrt(vdx * vdx + vdy * vdy);
                            if (vdist > maxRadius) maxRadius = vdist;
                        }
                        
                        // 增加安全缓冲距离，防止嵌入（radius + 4）
                        const minDist = maxRadius + 4;
                        
                        // 只有当点太靠近或在刚体内部时才推出
                        if (dist < minDist) {
                            const nx = dx / dist;
                            const ny = dy / dist;
                            
                            // 强制将点推到安全距离
                            point.x = body.position.x + nx * minDist;
                            point.y = body.position.y + ny * minDist;
                            
                            // 完全清除碰撞方向的速度，防止嵌入
                            // 参考滑轮算法，直接设置 oldX/oldY
                            point.oldX = point.x;
                            point.oldY = point.y;
                        }
                    }
                }
            }
            
            // 重新固定端点（确保端点位置不变）
            if (this.attachments.start) {
                const body = this.attachments.start.body;
                const offset = this.attachments.start.offset;
                const cos = Math.cos(body.angle);
                const sin = Math.sin(body.angle);
                this.points[0].x = body.position.x + offset.x * cos - offset.y * sin;
                this.points[0].y = body.position.y + offset.x * sin + offset.y * cos;
            }
            
            if (this.attachments.end) {
                const body = this.attachments.end.body;
                const offset = this.attachments.end.offset;
                const cos = Math.cos(body.angle);
                const sin = Math.sin(body.angle);
                const lastIdx = this.points.length - 1;
                this.points[lastIdx].x = body.position.x + offset.x * cos - offset.y * sin;
                this.points[lastIdx].y = body.position.y + offset.x * sin + offset.y * cos;
            }
        }
        
        // 对连接的刚体施加力
        this.applyForceToBody();
    }
    
    /**
     * 对刚体施加绳子拉力（只在绳子被拉紧时）
     */
    applyForceToBody() {
        // 计算绳子当前总长度
        let currentLength = 0;
        for (let i = 0; i < this.points.length - 1; i++) {
            const dx = this.points[i + 1].x - this.points[i].x;
            const dy = this.points[i + 1].y - this.points[i].y;
            currentLength += Math.sqrt(dx * dx + dy * dy);
        }
        
        // 计算绳子的原始长度
        let restLength = 0;
        for (let c of this.constraints) {
            restLength += c.length;
        }
        
        // 只有当绳子被拉伸时才施加力
        const stretch = currentLength - restLength;
        if (stretch <= 0) return; // 绳子松弛，不施力
        
        // 张力与拉伸量成正比（减小系数避免过度振荡）
        const tensionForce = stretch * 0.00005;
        
        if (this.attachments.start && this.attachments.start.body) {
            const body = this.attachments.start.body;
            const p0 = this.points[0];
            const p1 = this.points[1];
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                const fx = (dx / dist) * tensionForce;
                const fy = (dy / dist) * tensionForce;
                Body.applyForce(body, body.position, { x: fx, y: fy });
            }
        }
        
        if (this.attachments.end && this.attachments.end.body) {
            const body = this.attachments.end.body;
            const lastIdx = this.points.length - 1;
            const pLast = this.points[lastIdx];
            const pPrev = this.points[lastIdx - 1];
            const dx = pPrev.x - pLast.x;
            const dy = pPrev.y - pLast.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                const fx = (dx / dist) * tensionForce;
                const fy = (dy / dist) * tensionForce;
                Body.applyForce(body, body.position, { x: fx, y: fy });
            }
        }
    }
    
    /**
     * 渲染绳子
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    render(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        
        // 使用贝塞尔曲线绘制平滑的绳子
        for (let i = 1; i < this.points.length - 1; i++) {
            const xc = (this.points[i].x + this.points[i + 1].x) / 2;
            const yc = (this.points[i].y + this.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(this.points[i].x, this.points[i].y, xc, yc);
        }
        
        const lastIdx = this.points.length - 1;
        ctx.lineTo(this.points[lastIdx].x, this.points[lastIdx].y);
        
        // 绳子样式 - 黑色细线
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        // 绘制端点（小黑点）
        for (let attachment of [this.attachments.start, this.attachments.end]) {
            if (attachment) {
                const idx = attachment === this.attachments.start ? 0 : lastIdx;
                ctx.beginPath();
                ctx.arc(this.points[idx].x, this.points[idx].y, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#000000';
                ctx.fill();
            }
        }
    }
    
    /**
     * 检测点是否在绳子附近
     * @param {number} x - 点的 X 坐标
     * @param {number} y - 点的 Y 坐标
     * @param {number} threshold - 距离阈值（默认 15）
     * @returns {boolean}
     */
    isNearPoint(x, y, threshold = 15) {
        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = this.points[i];
            const p2 = this.points[i + 1];
            const dist = this.pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
            if (dist < threshold) return true;
        }
        return false;
    }
    
    /**
     * 计算点到线段的距离
     * @private
     */
    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
        const nearX = x1 + t * dx;
        const nearY = y1 + t * dy;
        return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
    }
}

export default VerletRope;
