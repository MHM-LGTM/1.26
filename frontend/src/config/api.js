/**
 * API 配置文件
 * ---------------------------------
 * 统一管理所有 API 地址配置
 * 
 * 环境变量：
 * - VITE_API_BASE_URL: 后端 API 地址
 * - VITE_APP_BASE_URL: 前端应用地址（用于生成分享链接）
 */

// 后端 API 基础 URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://106.55.243.121:8000';

// 前端应用基础 URL（用于生成分享链接等）
export const APP_BASE_URL = import.meta.env.VITE_APP_BASE_URL || 'http://localhost:5174';
