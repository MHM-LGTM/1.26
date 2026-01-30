/**
 * 数学讲解 API 封装
 * ---------------------------------
 * 功能：
 * - 上传题图与创建渲染任务（演示版），返回 `task_id`。
 * - 使用统一的 axios 实例配置。
 */

import axios from './axios.js';

export async function uploadImage(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await axios.post('/math/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function renderDemo(payload) {
  const res = await axios.post('/math/render', payload);
  return res.data;
}