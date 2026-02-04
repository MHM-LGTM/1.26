/**
 * 用户菜单组件
 * ---------------------------------
 * 功能：
 * - 显示用户手机号（脱敏）
 * - 点击展开下拉菜单
 * - 提供退出登录选项
 */

import React, { useState, useRef, useEffect } from 'react';
import useAuthStore from '../../store/authStore.js';
import toast from 'react-hot-toast';
import './styles.css';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, logout } = useAuthStore();

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = () => {
    if (confirm('确认退出登录？')) {
      logout();
      toast.success('已退出登录');
      setIsOpen(false);
    }
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button 
        className="user-menu-trigger" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none"
          style={{ flexShrink: 0 }}
        >
          <circle 
            cx="12" 
            cy="8" 
            r="4" 
            stroke="#ff9800" 
            strokeWidth="2" 
            strokeLinecap="round"
          />
          <path 
            d="M6 21C6 17.134 8.686 14 12 14C15.314 14 18 17.134 18 21" 
            stroke="#ff9800" 
            strokeWidth="2" 
            strokeLinecap="round"
          />
        </svg>
        <span>{user?.phone_number}</span>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill="none" 
          style={{ 
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          <path 
            d="M2.5 4.5L6 8L9.5 4.5" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-item" onClick={handleLogout}>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              fill="none"
              style={{ flexShrink: 0 }}
            >
              <path 
                d="M10 2H13C13.5523 2 14 2.44772 14 3V13C14 13.5523 13.5523 14 13 14H10M6.5 11.5L10 8M10 8L6.5 4.5M10 8H2" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            退出登录
          </div>
        </div>
      )}
    </div>
  );
}




