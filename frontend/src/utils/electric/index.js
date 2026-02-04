/**
 * 电学工具函数导出
 * ---------------------------------
 * 2026-02-01 创建
 * 2026-02-02 更新：使用 Blob 方法
 */

export { detectWires, renderLabelsToCanvas, renderDebugOverlay } from './wireDetection.js';
export { 
  analyzeCircuit, 
  calculateParticleSpeed, 
  calculateBranchParticleSpeed, 
  getElementEffect, 
  hasOpenSwitch, 
  getAllWirePaths 
} from './circuitAnalysis.js';
export { CurrentRenderer, createCurrentRenderer } from './currentRenderer.js';
