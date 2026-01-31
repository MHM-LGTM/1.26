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
            
            <p>Physmath 是一个简单物理图表可视化的平台。借助 Physmath 这个项目，我也想趁此机会寻找志同道合的创业伙伴。关于 AI 教育领域，我们有着更大的想象空间。</p>
            
            <p>如果你对 AI 在教育中的应用充满好奇，愿意和我一起探索这个充满无限可能的领域，那么欢迎你的加入！</p>
          </div>

          {/* 招募信息 */}
          <div className="recruitment-section">
            <p className="recruitment-intro">目前需要以下伙伴：</p>
            
            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">👥</span>
                <h4 className="position-title">市场产品运营（女生，2人）</h4>
              </div>
              <ul className="requirements-list">
                <li>性别女性，招募2人</li>
                <li>有自媒体经营经验</li>
                <li>性格开朗，善于沟通</li>
                <li>对教育产品有热情</li>
              </ul>
            </div>

            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">💻</span>
                <h4 className="position-title">技术支持（1-2人）</h4>
              </div>
              <ul className="requirements-list">
                <li>相关行业从业人员或在读相关专业学生</li>
                <li>有一定的开发经验</li>
                <li>有学习热情和团队精神</li>
              </ul>
            </div>
          </div>

          {/* 联系方式 */}
          <div className="contact-section">
            <p>
              感兴趣的话，请下载个人信息模板填写后发送到邮箱：
              <a href="mailto:contact@example.com" className="email-link">contact@example.com</a>
            </p>
            <div className="template-download">
              <a 
                href="/templates/个人信息模板.docx" 
                download="个人信息模板.docx"
                className="download-button"
              >
                📄 下载个人信息模板
              </a>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
