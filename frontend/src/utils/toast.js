/**
 * Toast 工具函数
 * ---------------------------------
 * 提供全局的 toast 显示方法，替代 alert()
 * 
 * 使用方法：
 * import { showToast } from '../utils/toast';
 * showToast.success('操作成功！');
 * showToast.error('操作失败');
 * showToast.info('提示信息');
 * showToast.warning('警告信息');
 */

// Toast 队列，用于同时显示多个 toast
let toastQueue = [];
let toastIdCounter = 0;

/**
 * 显示 Toast 提示
 * @param {string} message - 提示信息
 * @param {string} type - 类型：'success' | 'error' | 'info' | 'warning'
 * @param {number} duration - 显示时长（毫秒），默认 3500ms
 */
export function showToast(message, type = 'info', duration = 3500) {
  // 创建 toast 容器（如果不存在）
  let toastRoot = document.getElementById('toast-root');
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.id = 'toast-root';
    toastRoot.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 0;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(toastRoot);
  }

  // 创建 toast 元素
  const toastId = `toast-${toastIdCounter++}`;
  const toastEl = document.createElement('div');
  toastEl.id = toastId;
  toastEl.style.pointerEvents = 'auto';
  
  // 根据类型选择样式和图标
  const typeConfig = {
    success: { icon: '✅', className: 'toast-success' },
    error: { icon: '❌', className: 'toast-error' },
    warning: { icon: '⚠️', className: 'toast-warning' },
    info: { icon: 'ℹ️', className: 'toast-info' }
  };
  
  const { icon, className } = typeConfig[type] || typeConfig.info;
  
  toastEl.className = `toast-container ${className}`;
  toastEl.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${message}</div>
  `;
  
  toastRoot.appendChild(toastEl);
  
  // 如果有多个 toast，调整位置
  const index = toastQueue.length;
  toastEl.style.top = `${20 + index * 80}px`;
  
  toastQueue.push({ id: toastId, el: toastEl });
  
  // 触发显示动画
  setTimeout(() => {
    toastEl.classList.add('toast-show');
  }, 10);
  
  // 自动隐藏
  setTimeout(() => {
    toastEl.classList.add('toast-hide');
    toastEl.classList.remove('toast-show');
    
    // 动画结束后移除元素
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
      
      // 从队列中移除
      toastQueue = toastQueue.filter(t => t.id !== toastId);
      
      // 重新调整剩余 toast 的位置
      toastQueue.forEach((t, i) => {
        t.el.style.top = `${20 + i * 80}px`;
      });
    }, 300);
  }, duration);
}

// 便捷方法
showToast.success = (message, duration) => showToast(message, 'success', duration);
showToast.error = (message, duration) => showToast(message, 'error', duration);
showToast.info = (message, duration) => showToast(message, 'info', duration);
showToast.warning = (message, duration) => showToast(message, 'warning', duration);

export default showToast;
