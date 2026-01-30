/**
 * 认证相关 API
 * ---------------------------------
 * 功能：
 * - 用户注册
 * - 用户登录
 * - 获取当前用户信息
 */

import axios from './axios.js';

/**
 * 发送验证码
 * @param {string} phoneNumber - 手机号
 * @param {string} scene - 场景：'register' 或 'reset_password'
 * @returns {Promise} 发送结果
 */
export async function sendVerificationCode(phoneNumber, scene = 'register') {
  const response = await axios.post('/auth/send-code', {
    phone_number: phoneNumber,
    scene: scene,
  });
  return response.data;
}

/**
 * 用户注册
 * @param {string} phoneNumber - 手机号
 * @param {string} password - 密码
 * @param {string} verificationCode - 验证码
 * @returns {Promise} 注册结果
 */
export async function register(phoneNumber, password, verificationCode) {
  const response = await axios.post('/auth/register', {
    phone_number: phoneNumber,
    password: password,
    verification_code: verificationCode,
  });
  return response.data;
}

/**
 * 用户登录
 * @param {string} phoneNumber - 手机号
 * @param {string} password - 密码
 * @returns {Promise} 登录结果（包含 access_token 和 user）
 */
export async function login(phoneNumber, password) {
  // OAuth2 标准格式：使用 form-data
  const formData = new FormData();
  formData.append('username', phoneNumber); // 字段名必须是 username
  formData.append('password', password);

  const response = await axios.post('/auth/token', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
}

/**
 * 重置密码（找回密码）
 * @param {string} phoneNumber - 手机号
 * @param {string} verificationCode - 验证码
 * @param {string} newPassword - 新密码
 * @returns {Promise} 重置结果
 */
export async function resetPassword(phoneNumber, verificationCode, newPassword) {
  const response = await axios.post('/auth/reset-password', {
    phone_number: phoneNumber,
    verification_code: verificationCode,
    new_password: newPassword,
  });
  return response.data;
}

/**
 * 获取当前用户信息
 * @returns {Promise} 用户信息
 * @note Token 由拦截器自动添加，无需手动传入
 */
export async function getCurrentUser() {
  const response = await axios.get('/auth/me');
  return response.data;
}

