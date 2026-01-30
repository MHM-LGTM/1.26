/**
 * API 统一导出
 * ---------------------------------
 * 功能：
 * - 将所有 API 模块统一导出，便于页面/组件按需导入。
 *
 * 使用示例：
 * import { physicsApi, mathApi, authApi } from '@/api';
 */

export * as physicsApi from './physicsApi.js';
export * as mathApi from './mathApi.js';
export * as authApi from './authApi.js';