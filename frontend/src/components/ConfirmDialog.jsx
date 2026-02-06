/**
 * 确认对话框组件
 * ---------------------------------
 * 功能：优雅的确认/取消对话框，替代浏览器原生 confirm()
 * 
 * 使用：
 * <ConfirmDialog
 *   isOpen={showConfirm}
 *   title="确认退出"
 *   message="确认退出登录吗？"
 *   onConfirm={() => { ... }}
 *   onCancel={() => setShowConfirm(false)}
 *   confirmText="确定"
 *   cancelText="取消"
 * />
 */

import React from 'react';

export default function ConfirmDialog({
  isOpen,
  title = '确认操作',
  message,
  onConfirm,
  onCancel,
  confirmText = '确定',
  cancelText = '取消',
  confirmStyle = 'primary' // 'primary' | 'danger'
}) {
  if (!isOpen) return null;

  const confirmButtonStyle = confirmStyle === 'danger' 
    ? {
        background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
        border: '1px solid #ef4444',
        color: '#dc2626'
      }
    : {
        background: 'linear-gradient(135deg, #fff8e1 0%, #ffeaa7 100%)',
        border: '1px solid #ff9800',
        color: '#222'
      };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={onCancel}
    >
      <div 
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)',
          borderRadius: 16,
          padding: 24,
          width: '90%',
          maxWidth: 400,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: '1px solid #ffd93d',
          animation: 'slideUp 0.3s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <h3 style={{ 
          margin: '0 0 12px 0', 
          fontSize: 18, 
          fontWeight: 600,
          color: '#222'
        }}>
          {title}
        </h3>

        {/* 消息 */}
        <p style={{ 
          margin: '0 0 24px 0',
          fontSize: 14,
          color: '#6b7280',
          lineHeight: 1.6
        }}>
          {message}
        </p>

        {/* 按钮 */}
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              background: '#ffffff',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: '#6b7280',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f9fafb';
              e.target.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#ffffff';
              e.target.style.borderColor = '#d1d5db';
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.2s',
              ...confirmButtonStyle
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
