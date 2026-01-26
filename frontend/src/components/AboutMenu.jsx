/**
 * 关于菜单组件
 * ---------------------------------
 * 功能：
 * - 显示"关于"按钮
 * - 点击展开下拉菜单
 * - 提供加入我们、技术合作、使用教程、问题反馈等选项
 */

import React, { useState, useRef, useEffect } from 'react';
import JoinUsModal from './JoinUsModal';
import TechCooperationModal from './TechCooperationModal';
import TutorialModal from './TutorialModal';
import FeedbackModal from './FeedbackModal';
import '../components/Auth/styles.css';

export default function AboutMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showJoinUsModal, setShowJoinUsModal] = useState(false);
  const [showTechCooperationModal, setShowTechCooperationModal] = useState(false);
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
      case '技术合作':
        setShowTechCooperationModal(true);
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
          关于 ▼
        </button>

        {isOpen && (
          <div className="user-menu-dropdown">
            <div className="user-menu-item" onClick={() => handleMenuClick('加入我们')}>
              加入我们
            </div>
            <div className="user-menu-item" onClick={() => handleMenuClick('技术合作')}>
              技术合作
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
      <TechCooperationModal 
        isOpen={showTechCooperationModal} 
        onClose={() => setShowTechCooperationModal(false)} 
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
