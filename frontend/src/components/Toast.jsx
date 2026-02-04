/**
 * Toast 提示组件
 * ---------------------------------
 * 功能：优雅的非阻塞式提示，自动消失
 * 类型：success（成功）、error（错误）、info（信息）、warning（警告）
 */

import React, { useEffect, useState } from 'react';
import './Toast.css';

export default function Toast({ message, type = 'info', duration = 3500, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // 延迟一点让动画生效
    const showTimer = setTimeout(() => setIsVisible(true), 10);

    // 设置自动消失定时器
    const hideTimer = setTimeout(() => {
      setIsLeaving(true);
      // 动画结束后再调用 onClose
      setTimeout(() => {
        if (onClose) onClose();
      }, 300);
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [duration, onClose]);

  if (!message) return null;

  // 根据类型选择图标和样式
  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return { icon: '✅', className: 'toast-success' };
      case 'error':
        return { icon: '❌', className: 'toast-error' };
      case 'warning':
        return { icon: '⚠️', className: 'toast-warning' };
      case 'info':
      default:
        return { icon: 'ℹ️', className: 'toast-info' };
    }
  };

  const { icon, className } = getTypeConfig();

  return (
    <div 
      className={`toast-container ${className} ${isVisible && !isLeaving ? 'toast-show' : ''} ${isLeaving ? 'toast-hide' : ''}`}
    >
      <div className="toast-icon">{icon}</div>
      <div className="toast-message">{message}</div>
    </div>
  );
}
