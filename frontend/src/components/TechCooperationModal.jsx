/**
 * 技术合作弹窗组件
 * ---------------------------------
 * 功能：
 * - 展示技术合作信息
 * - 提供联系方式
 */

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './JoinUsModal.css';
import './CommonModal.css';

export default function TechCooperationModal({ isOpen, onClose }) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="auth-modal-overlay" />
        <Dialog.Content className="join-us-modal-content">
          <Dialog.Close className="modal-close-fixed">✕</Dialog.Close>

          {/* 标题 */}
          <Dialog.Title className="join-us-title">
            技术合作
          </Dialog.Title>

          {/* 合作说明 */}
          <div className="join-us-welcome">
            <p>欢迎与我们开展技术合作！</p>
            <p>如果您有以下需求，请随时联系我们：</p>
          </div>

          {/* 合作类型 */}
          <div className="recruitment-section">
            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">🔗</span>
                <h4 className="position-title">产品集成</h4>
              </div>
              <ul className="requirements-list">
                <li>将我们的物理/数学动画引擎集成到您的产品中</li>
                <li>定制化的动画演示功能</li>
                <li>提供完整的 API 接口和技术文档</li>
                <li>专业的技术支持团队</li>
              </ul>
            </div>

            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">🛠️</span>
                <h4 className="position-title">定制开发</h4>
              </div>
              <ul className="requirements-list">
                <li>特殊场景下的物理模拟需求</li>
                <li>教育类应用的动画功能开发</li>
                <li>私有化部署解决方案</li>
                <li>企业级功能定制</li>
              </ul>
            </div>

            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">🤝</span>
                <h4 className="position-title">战略合作</h4>
              </div>
              <ul className="requirements-list">
                <li>教育机构联合开发</li>
                <li>技术资源共享</li>
                <li>联合推广合作</li>
                <li>长期战略伙伴关系</li>
              </ul>
            </div>
          </div>

          {/* 联系方式 */}
          <div className="qrcode-section">
            <h3 className="section-title">联系我们</h3>
            <div className="contact-info" style={{ textAlign: 'center', marginTop: '20px' }}>
              <p style={{ fontSize: '16px', marginBottom: '12px' }}>
                请将您的合作需求发送至：
              </p>
              <a href="mailto:cooperation@example.com" className="email-link" style={{ fontSize: '18px' }}>
                cooperation@example.com
              </a>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '16px' }}>
                我们会在 24 小时内回复您的邮件
              </p>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
