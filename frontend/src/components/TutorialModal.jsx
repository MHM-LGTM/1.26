/**
 * 使用教程弹窗组件
 * ---------------------------------
 * 功能：
 * - 展示使用教程视频
 * - 视频播放功能
 */

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './JoinUsModal.css';
import './CommonModal.css';
import './TutorialModal.css';

export default function TutorialModal({ isOpen, onClose }) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="auth-modal-overlay" />
        <Dialog.Content className="join-us-modal-content tutorial-modal-content">
          <Dialog.Close className="modal-close-fixed">✕</Dialog.Close>

          {/* 标题 */}
          <Dialog.Title className="join-us-title">
            使用教程
          </Dialog.Title>

          {/* 说明 */}
          <div className="join-us-welcome">
            <p>观看以下视频，快速了解如何使用我们的产品</p>
          </div>

          {/* 视频区域 */}
          <div className="video-section">
            <div className="video-container">
              {/* 可以替换为实际的视频链接 */}
              <video 
                controls 
                className="tutorial-video"
                poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450'%3E%3Crect width='800' height='450' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' font-size='24' fill='%239ca3af' text-anchor='middle' dy='.3em'%3E点击播放教程视频%3C/text%3E%3C/svg%3E"
              >
                <source src="/tutorial-video.mp4" type="video/mp4" />
                {/* 备用视频源 */}
                <source src="/tutorial-video.webm" type="video/webm" />
                您的浏览器不支持视频播放，请升级浏览器。
              </video>
            </div>
          </div>

          {/* 功能介绍 */}
          <div className="recruitment-section" style={{ marginTop: '32px' }}>
            <h3 className="section-title">主要功能</h3>
            
            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">📐</span>
                <h4 className="position-title">物理图表可视化模拟</h4>
              </div>
              <div className="feature-description">
                <p>专注于模拟物理课本和习题中的简单静态图表，帮助学生更直观地理解物理概念。</p>
              </div>
              <ul className="requirements-list">
                <li><strong>支持场景：</strong>单摆、弹簧、轻绳轻杆模型、运动学、电学电路及电流流向等</li>
                <li><strong>操作流程：</strong>上传图片 → AI 识别物理元素 → 框选模拟区域 → 点击开始模拟</li>
                <li><strong>参数调整：</strong>右侧自定义功能区可调整重力、摩擦力、速度等具体参数</li>
                <li><strong>性能说明：</strong>目前适用于简单场景，复杂场景的性能还在持续优化中</li>
              </ul>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
