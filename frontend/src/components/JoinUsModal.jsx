/**
 * 加入我们弹窗组件
 * ---------------------------------
 * 功能：
 * - 展示团队招募信息
 * - 显示联系方式和二维码
 * - 复用登录窗口的样式风格
 */

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './JoinUsModal.css';
import './CommonModal.css';

export default function JoinUsModal({ isOpen, onClose }) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="auth-modal-overlay" />
        <Dialog.Content className="join-us-modal-content">
          <Dialog.Close className="modal-close-fixed">✕</Dialog.Close>

          {/* 标题 */}
          <Dialog.Title className="join-us-title">
            寻找创业伙伴
          </Dialog.Title>

          {/* 主要内容 */}
          <div className="join-us-content">
            <p>你好！我是一名连续创业者，有过两次创业经历，对教育领域充满热情。</p>
            
            <p>Physmath 只是一个用于寻找创业伙伴以及摸清市场方向的工具。关于 AI 教育领域，我们有着更大的想象空间。</p>
            
            <p>如果你对 AI 在教育中的应用充满好奇，愿意和我一起探索这个充满无限可能的领域，那么欢迎你的加入！</p>
          </div>

          {/* 招募信息 */}
          <div className="recruitment-section">
            <p className="recruitment-intro">目前需要以下伙伴：</p>
            
            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">👥</span>
                <h4 className="position-title">市场产品运营（招募2名女生）</h4>
              </div>
              <ul className="requirements-list">
                <li>需要2名女生</li>
                <li>有过自媒体运营经验</li>
                <li>性格开朗，善于沟通</li>
                <li>对教育产品有热情</li>
              </ul>
            </div>

            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">💻</span>
                <h4 className="position-title">技术支持（招募1-2名）</h4>
              </div>
              <ul className="requirements-list">
                <li>需要1-2名技术支持人员</li>
                <li>在读相关专业学生</li>
                <li>或相关技术行业从业人员</li>
                <li>熟悉前端或后端开发</li>
                <li>有学习热情和团队精神</li>
              </ul>
            </div>
          </div>

          {/* 联系方式 */}
          <div className="contact-section">
            <p>
              感兴趣的话，请将您的个人信息发送到邮箱：
              <a href="mailto:contact@example.com" className="email-link">contact@example.com</a>
            </p>
            <p>或扫描下方二维码联系我们：</p>
          </div>

          {/* 二维码区域 */}
          <div className="qrcode-section">
            <div className="qrcode-container">
              <div className="qrcode-item">
                <div className="qrcode-placeholder">
                  {/* 预留二维码位置 - 可以替换为实际的二维码图片 */}
                  <div className="qrcode-box">
                    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                      <rect width="120" height="120" fill="#f3f4f6" rx="8"/>
                      <path d="M60 35v50M35 60h50" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
                      <text x="60" y="100" fontSize="12" fill="#6b7280" textAnchor="middle">微信</text>
                    </svg>
                  </div>
                </div>
                <p className="qrcode-label">微信公众号</p>
              </div>
              
              <div className="qrcode-item">
                <div className="qrcode-placeholder">
                  {/* 预留第二个二维码位置 */}
                  <div className="qrcode-box">
                    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                      <rect width="120" height="120" fill="#f3f4f6" rx="8"/>
                      <path d="M60 35v50M35 60h50" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
                      <text x="60" y="100" fontSize="12" fill="#6b7280" textAnchor="middle">QQ</text>
                    </svg>
                  </div>
                </div>
                <p className="qrcode-label">QQ 群</p>
              </div>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
