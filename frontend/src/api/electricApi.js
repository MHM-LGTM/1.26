/**
 * 电学场景 API 接口
 * ---------------------------------
 * 功能：
 * - 电学场景专用的 API 调用
 * - 与后端 /electric 路由交互
 * 
 * 2026-02-01 创建
 */

import axios from './axios.js';
import { API_BASE_URL } from '../config/api.js';

// 后端地址（从环境变量读取）
const BASE_URL = API_BASE_URL;

/**
 * 健康检查
 */
export async function health() {
  const resp = await axios.get(`${BASE_URL}/healthz`);
  return resp.data;
}

/**
 * 上传电路图并识别电学元件
 * @param {File} file - 图片文件
 * @returns {Promise<{path: string, elements: Array, confidence: number, ai_ms: number, embed_ms: number}>}
 */
export async function uploadCircuitImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await axios.post(`${BASE_URL}/electric/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return resp.data;
}

/**
 * SAM 分割（复用物理场景的 SAM 服务）
 * @param {Object} payload - { image_path, image_size, points?, box? }
 */
export async function segment(payload) {
  const resp = await axios.post(`${BASE_URL}/physics/segment`, payload);
  return resp.data;
}

/**
 * 电路模拟（生成精灵图等）
 * @param {Object} payload - { image_path, elements, contours }
 */
export async function simulateCircuit(payload) {
  const resp = await axios.post(`${BASE_URL}/electric/simulate`, payload);
  return resp.data;
}
