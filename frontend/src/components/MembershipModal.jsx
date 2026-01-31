/**
 * 会员获取弹窗组件
 * ---------------------------------
 * 功能：
 * - 展示用户调研活动信息
 * - 说明参与调研可获得会员权益
 */

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './JoinUsModal.css';
import './CommonModal.css';

export default function MembershipModal({ isOpen, onClose }) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="auth-modal-overlay" />
        <Dialog.Content className="join-us-modal-content">
          <Dialog.Close className="modal-close-fixed">✕</Dialog.Close>

          {/* 标题 */}
          <Dialog.Title className="join-us-title">
            会员获取
          </Dialog.Title>

          {/* 主要内容 */}
          <div className="join-us-content">
            <p>感谢您对 Physmath 的支持！</p>
            
            <p>我们正在开发一款新的教育产品，希望邀请您参与用户调研，帮助我们了解您的需求和建议。完成调研的用户可以获得 <strong style={{color: '#ff9800', fontSize: '16px'}}>至少 30 天会员</strong> 权益作为感谢！</p>
          </div>

          {/* 调研流程 */}
          <div className="recruitment-section">
            <p className="recruitment-intro">调研流程：</p>
            
            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">📝</span>
                <h4 className="position-title">第一步：在线问卷</h4>
              </div>
              <ul className="requirements-list">
                <li>填写简单的问卷调查</li>
                <li>了解您的基本需求和使用习惯</li>
                <li>大约 5-10 分钟完成</li>
              </ul>
            </div>

            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">📞</span>
                <h4 className="position-title">第二步：电话深入调研</h4>
              </div>
              <ul className="requirements-list">
                <li>一对一电话访谈</li>
                <li>深入了解您的使用场景和具体建议</li>
                <li>时长约 15-30 分钟</li>
              </ul>
            </div>
          </div>

          {/* 参与方式 */}
          <div className="contact-section">
            <p style={{fontSize: '15px', fontWeight: '500', marginBottom: '16px'}}>
              扫描下方二维码，加入用户调研群聊
            </p>
            <p style={{color: '#ff9800', fontWeight: '500'}}>
              期待您的参与，让我们一起把产品做得更好！
            </p>
          </div>

          {/* 二维码区域 */}
          <div className="qrcode-section">
            <div className="qrcode-container">
              <div className="qrcode-item">
                <div className="qrcode-placeholder">
                  {/* 预留二维码位置 - 可以替换为实际的二维码图片 */}
                  <div className="qrcode-box">
                    <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
                      <rect width="140" height="140" fill="#f3f4f6" rx="8"/>
                      <path d="M70 40v60M40 70h60" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
                      <text x="70" y="115" fontSize="14" fill="#6b7280" textAnchor="middle">二维码</text>
                    </svg>
                  </div>
                </div>
                <p className="qrcode-label">用户调研群</p>
              </div>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
