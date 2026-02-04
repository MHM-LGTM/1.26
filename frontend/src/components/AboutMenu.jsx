/**
 * 关于菜单组件
 * ---------------------------------
 * 功能：
 * - 显示"关于"按钮
 * - 点击展开下拉菜单
 * - 提供加入我们、会员获取、使用教程、问题反馈等选项
 */

import React, { useState, useRef, useEffect } from 'react';
import JoinUsModal from './JoinUsModal';
import MembershipModal from './MembershipModal';
import TutorialModal from './TutorialModal';
import FeedbackModal from './FeedbackModal';
import '../components/Auth/styles.css';

export default function AboutMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showJoinUsModal, setShowJoinUsModal] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const menuRef = useRef(null);

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

  const handleMenuClick = (option) => {
    setIsOpen(false);
    
    switch(option) {
      case '加入我们':
        setShowJoinUsModal(true);
        break;
      case '会员获取':
        setShowMembershipModal(true);
        break;
      case '使用教程':
        setShowTutorialModal(true);
        break;
      case '问题反馈':
        setShowFeedbackModal(true);
        break;
      default:
        break;
    }
  };

  return (
    <>
      <div className="user-menu" ref={menuRef}>
        <button 
          className="user-menu-trigger" 
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>关于</span>
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
            <div className="user-menu-item" onClick={() => handleMenuClick('加入我们')}>
              加入我们
            </div>
            <div className="user-menu-item" onClick={() => handleMenuClick('会员获取')}>
              会员获取
            </div>
            <div className="user-menu-item" onClick={() => handleMenuClick('使用教程')}>
              使用教程
            </div>
            <div className="user-menu-item" onClick={() => handleMenuClick('问题反馈')}>
              问题反馈
            </div>
          </div>
        )}
      </div>

      {/* 所有弹窗 */}
      <JoinUsModal 
        isOpen={showJoinUsModal} 
        onClose={() => setShowJoinUsModal(false)} 
      />
      <MembershipModal 
        isOpen={showMembershipModal} 
        onClose={() => setShowMembershipModal(false)} 
      />
      <TutorialModal 
        isOpen={showTutorialModal} 
        onClose={() => setShowTutorialModal(false)} 
      />
      <FeedbackModal 
        isOpen={showFeedbackModal} 
        onClose={() => setShowFeedbackModal(false)} 
      />
    </>
  );
}
