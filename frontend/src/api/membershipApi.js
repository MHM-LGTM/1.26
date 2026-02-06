/**
 * 会员相关 API
 * ---------------------------------
 * 功能：
 * - 获取会员状态和使用统计
 * - 检查使用限制
 */

import axios from './axios.js';

/**
 * 获取会员状态和使用统计
 * @returns {Promise} 会员信息
 */
export async function getMembershipStatus() {
  const response = await axios.get('/api/membership/status');
  return response.data;
}

/**
 * 检查当前是否可以制作动画
 * @returns {Promise} 限制检查结果
 */
export async function checkUsageLimit() {
  const response = await axios.get('/api/membership/check-limit');
  return response.data;
}
