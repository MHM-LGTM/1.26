/**
 * 电路拓扑分析
 * ---------------------------------
 * 功能：
 * - 构建电路网表（netlist）
 * - 识别串联/并联结构
 * - 计算各支路电流分配
 * - 检测短路情况
 * 
 * 2026-02-01 创建
 */

import { getElementResistance } from '../../components/electric/elementTypes.js';

/**
 * 分析电路拓扑，计算电流分配
 * @param {Object} connectionGraph - 连接图（来自 wireDetection）
 * @param {Array} elements - 电学元件列表（包含参数）
 * @returns {Object} { branches, currents, shortCircuits, totalResistance }
 */
export function analyzeCircuit(connectionGraph, elements) {
  // 1. 找到电源
  const batteryIndex = elements.findIndex(e => e.element_type === 'battery');
  if (batteryIndex === -1) {
    return { error: '未找到电源', branches: [], currents: {}, shortCircuits: [] };
  }
  
  const battery = elements[batteryIndex];
  const voltage = battery.parameters?.voltage_V || 3;
  
  // 2. 从电源正极出发，进行深度优先搜索，构建支路
  const branches = findAllBranches(connectionGraph, batteryIndex, elements);
  
  // 3. 检测短路
  const shortCircuits = detectShortCircuits(branches, elements);
  
  // 4. 计算各支路电阻和电流
  const branchData = calculateBranchCurrents(branches, elements, voltage, shortCircuits);
  
  return {
    batteryIndex,
    voltage,
    branches: branchData.branches,
    currents: branchData.currents,
    shortCircuits,
    totalResistance: branchData.totalResistance,
    totalCurrent: branchData.totalCurrent
  };
}

/**
 * 找到所有从电源出发回到电源的支路
 */
function findAllBranches(graph, batteryIndex, elements) {
  const branches = [];
  const batteryNodeId = `element_${batteryIndex}`;
  const adjacency = graph.adjacency;
  
  if (!adjacency[batteryNodeId] || adjacency[batteryNodeId].length === 0) {
    return branches;
  }
  
  // DFS 找所有路径
  const visited = new Set();
  const currentPath = [];
  
  function dfs(nodeId, pathSoFar) {
    if (nodeId === batteryNodeId && pathSoFar.length > 0) {
      // 回到电源，形成一个完整支路
      branches.push([...pathSoFar]);
      return;
    }
    
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const neighbors = adjacency[nodeId] || [];
    for (const neighbor of neighbors) {
      // 找到连接的边信息
      const edgeInfo = {
        from: nodeId,
        to: neighbor.to,
        path: neighbor.path
      };
      
      dfs(neighbor.to, [...pathSoFar, edgeInfo]);
    }
    
    visited.delete(nodeId);
  }
  
  // 从电源的每个邻居开始搜索
  for (const neighbor of adjacency[batteryNodeId]) {
    const startEdge = {
      from: batteryNodeId,
      to: neighbor.to,
      path: neighbor.path
    };
    dfs(neighbor.to, [startEdge]);
  }
  
  return branches;
}

/**
 * 检测短路：电阻极小的路径
 */
function detectShortCircuits(branches, elements) {
  const shortCircuits = [];
  const SHORT_THRESHOLD = 0.001; // 0.001Ω 以下视为短路（比开关电阻小得多）
  
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    let totalResistance = 0;
    const elementsInBranch = [];
    
    for (const edge of branch) {
      // 提取元件索引
      const fromMatch = edge.from.match(/element_(\d+)/);
      const toMatch = edge.to.match(/element_(\d+)/);
      
      if (toMatch) {
        const elemIdx = parseInt(toMatch[1]);
        const elem = elements[elemIdx];
        if (elem && elem.element_type !== 'battery') {
          totalResistance += getElementResistance(elem);
          elementsInBranch.push(elemIdx);
        }
      }
    }
    
    // 只有纯导线连接（没有任何元件）且电阻极小才算短路
    if (totalResistance < SHORT_THRESHOLD && elementsInBranch.length === 0) {
      shortCircuits.push({
        branchIndex: i,
        branch,
        resistance: totalResistance,
        isDirectShort: true
      });
    }
  }
  
  return shortCircuits;
}

/**
 * 计算各支路电流
 */
function calculateBranchCurrents(branches, elements, voltage, shortCircuits) {
  const branchInfo = [];
  const currents = {}; // elementIndex -> current
  
  // 初始化所有元件电流为 0
  for (let i = 0; i < elements.length; i++) {
    currents[i] = 0;
  }
  
  // 如果有短路，短路支路电流极大，其他支路几乎为 0
  const hasShortCircuit = shortCircuits.length > 0;
  const shortBranchIndices = new Set(shortCircuits.map(sc => sc.branchIndex));
  
  // 计算每个支路的电阻
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    let branchResistance = 0;
    const elementsInBranch = [];
    const wirePaths = [];
    
    for (const edge of branch) {
      wirePaths.push(edge.path);
      
      const toMatch = edge.to.match(/element_(\d+)/);
      if (toMatch) {
        const elemIdx = parseInt(toMatch[1]);
        const elem = elements[elemIdx];
        if (elem && elem.element_type !== 'battery') {
          const resistance = getElementResistance(elem);
          branchResistance += resistance;
          elementsInBranch.push({
            index: elemIdx,
            type: elem.element_type,
            name: elem.name,
            resistance
          });
        }
      }
    }
    
    // 防止除零
    if (branchResistance === 0) branchResistance = 0.001;
    
    let branchCurrent;
    if (hasShortCircuit) {
      if (shortBranchIndices.has(i)) {
        // 短路支路：电流极大（设为 100A 表示）
        branchCurrent = 100;
      } else {
        // 其他支路：电流极小
        branchCurrent = 0.001;
      }
    } else {
      // 正常情况：欧姆定律
      branchCurrent = voltage / branchResistance;
    }
    
    branchInfo.push({
      index: i,
      resistance: branchResistance,
      current: branchCurrent,
      elements: elementsInBranch,
      wirePaths,
      isShortCircuit: shortBranchIndices.has(i)
    });
    
    // 更新元件电流
    for (const elem of elementsInBranch) {
      currents[elem.index] = Math.max(currents[elem.index], branchCurrent);
    }
  }
  
  // 计算总电阻（并联等效）
  let totalConductance = 0; // 电导 = 1/R
  for (const info of branchInfo) {
    if (info.resistance > 0) {
      totalConductance += 1 / info.resistance;
    }
  }
  const totalResistance = totalConductance > 0 ? 1 / totalConductance : Infinity;
  const totalCurrent = voltage / totalResistance;
  
  return {
    branches: branchInfo,
    currents,
    totalResistance,
    totalCurrent
  };
}

/**
 * 根据电流大小计算粒子速度
 * @param {number} current - 电流值（A）
 * @param {number} baseCurrent - 基准电流值
 * @returns {number} 速度倍数（1.0 为标准速度）
 */
export function calculateParticleSpeed(current, baseCurrent = 1) {
  if (current <= 0) return 0;
  if (current >= 100) return 5; // 短路时极快
  
  // 速度与电流成正比，但有上下限
  const ratio = current / baseCurrent;
  return Math.max(0.1, Math.min(3, ratio));
}

/**
 * 根据支路电阻计算该支路的粒子速度
 * 并联时：大电阻支路速度慢，小电阻支路速度快
 */
export function calculateBranchParticleSpeed(branchResistance, minResistance, voltage) {
  if (branchResistance === Infinity) return 0; // 电压表支路
  if (branchResistance <= 0) return 5; // 短路
  
  // 电流 I = V / R，速度与电流成正比
  const current = voltage / branchResistance;
  const maxCurrent = voltage / Math.max(minResistance, 0.1);
  
  // 归一化到 0.2 - 2.0 范围
  const normalized = current / maxCurrent;
  return 0.2 + normalized * 1.8;
}

/**
 * 获取元件的发光/发热效果参数
 */
export function getElementEffect(element, current) {
  const type = element.element_type;
  
  switch (type) {
    case 'resistor':
      // 电阻发热：电流越大越红
      const heatIntensity = Math.min(1, current / 2);
      return {
        type: 'heat',
        color: `rgba(255, ${Math.floor(100 - heatIntensity * 100)}, 0, ${0.3 + heatIntensity * 0.4})`,
        intensity: heatIntensity
      };
    
    case 'lamp':
      // 灯泡发光：电流越大越亮
      const brightness = Math.min(1, current / 1.5);
      return {
        type: 'glow',
        color: `rgba(255, 255, ${Math.floor(100 + brightness * 100)}, ${0.4 + brightness * 0.5})`,
        intensity: brightness,
        radius: 20 + brightness * 30
      };
    
    case 'ammeter':
      // 电流表：显示读数
      return {
        type: 'reading',
        value: current.toFixed(2) + 'A'
      };
    
    case 'voltmeter':
      // 电压表：显示读数（需要额外计算）
      return {
        type: 'reading',
        value: '—V' // 需要根据连接位置计算
      };
    
    default:
      return null;
  }
}

/**
 * 判断开关是否断开导致电路不通
 */
export function hasOpenSwitch(elements) {
  for (const elem of elements) {
    if (elem.element_type === 'switch') {
      const isClosed = elem.parameters?.is_closed ?? false;
      if (!isClosed) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 获取所有导线路径（用于渲染）
 */
export function getAllWirePaths(branchData) {
  const allPaths = [];
  
  for (const branch of branchData.branches) {
    for (const wirePath of branch.wirePaths) {
      allPaths.push({
        path: wirePath,
        current: branch.current,
        isShortCircuit: branch.isShortCircuit,
        branchIndex: branch.index
      });
    }
  }
  
  return allPaths;
}
