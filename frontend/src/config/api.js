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
// 生产环境使用空字符串（相对路径，通过nginx反向代理访问）
// 开发环境使用 http://localhost:8000
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// 前端应用基础 URL（用于生成分享链接等）
export const APP_BASE_URL = import.meta.env.VITE_APP_BASE_URL || 'https://physmath.cn';
