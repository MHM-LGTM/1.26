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
import { showToast } from '../../utils/toast.js';
import { getMembershipStatus } from '../../api/membershipApi.js';
import ConfirmDialog from '../ConfirmDialog.jsx';
import MembershipModal from '../MembershipModal.jsx';
import './styles.css';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const menuRef = useRef(null);
  const { user, logout, membership, updateMembership } = useAuthStore();

  // 加载会员信息
  useEffect(() => {
    const loadMembership = async () => {
      try {
        const response = await getMembershipStatus();
        if (response.code === 0) {
          updateMembership(response.data);
        }
      } catch (error) {
        // 静默处理错误，不影响用户体验
        console.warn('获取会员信息失败:', error.message);
        // 设置默认值
        updateMembership({
          is_vip: false,
          vip_expires_at: null,
          today_used: 0,
          daily_limit: 5,
          remaining: 5
        });
      }
    };

    if (user) {
      loadMembership();
    }
  }, [user, updateMembership]);

  // 监听打开会员弹窗的事件
  useEffect(() => {
    const handleOpenMembership = () => {
      setShowMembershipModal(true);
    };

    window.addEventListener('open-membership-modal', handleOpenMembership);
    return () => {
      window.removeEventListener('open-membership-modal', handleOpenMembership);
    };
  }, []);

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

  const handleLogoutClick = () => {
    setShowConfirmLogout(true);
    setIsOpen(false);
  };

  const handleLogoutConfirm = () => {
    logout();
    showToast.success('已退出登录');
    setShowConfirmLogout(false);
  };

  const handleMembershipClick = () => {
    setShowMembershipModal(true);
    setIsOpen(false);
  };

  // 判断是否为会员
  const isVip = membership?.is_vip;
  const remaining = membership?.remaining ?? 0;

  return (
    <>
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
          {isVip && (
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              backgroundColor: '#ff9800',
              color: 'white',
              fontWeight: '500',
              marginLeft: '4px'
            }}>
              VIP
            </span>
          )}
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
            {/* 会员状态 */}
            <div className="user-menu-item" style={{ 
              cursor: 'default',
              padding: '10px 12px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              {isVip ? (
                <div style={{ fontSize: '13px' }}>
                  <div style={{ color: '#ff9800', fontWeight: '500' }}>
                    ⭐ 会员用户
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                    {membership.vip_expires_at ? `到期：${membership.vip_expires_at}` : '永久会员'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px' }}>
                  <div style={{ color: '#6b7280' }}>
                    今日剩余次数: <span style={{ color: '#ff9800', fontWeight: '500' }}>{remaining}/5</span>
                  </div>
                  <div 
                    onClick={handleMembershipClick}
                    style={{ 
                      color: '#ff9800', 
                      fontSize: '12px', 
                      marginTop: '4px',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    开通会员享无限次数
                  </div>
                </div>
              )}
            </div>

            <div className="user-menu-item" onClick={handleLogoutClick}>
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

      {/* 确认退出登录对话框 */}
      <ConfirmDialog
        isOpen={showConfirmLogout}
        title="退出登录"
        message="确定要退出登录吗？"
        confirmText="退出"
        cancelText="取消"
        confirmStyle="danger"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowConfirmLogout(false)}
      />

      {/* 会员获取弹窗 */}
      <MembershipModal
        isOpen={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
      />
    </>
  );
}




