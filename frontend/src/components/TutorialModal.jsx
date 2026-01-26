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
                <h4 className="position-title">物理模拟</h4>
              </div>
              <ul className="requirements-list">
                <li>拖拽创建物体（小球、方块）</li>
                <li>添加物理约束（绳子、轻杆、滑轮）</li>
                <li>实时物理引擎模拟</li>
                <li>导出和分享动画</li>
              </ul>
            </div>

            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">🎨</span>
                <h4 className="position-title">数学动画</h4>
              </div>
              <ul className="requirements-list">
                <li>输入数学公式</li>
                <li>自动生成动画演示</li>
                <li>支持多种数学符号</li>
                <li>保存和回放功能</li>
              </ul>
            </div>

            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">🌐</span>
                <h4 className="position-title">广场分享</h4>
              </div>
              <ul className="requirements-list">
                <li>浏览他人的优秀作品</li>
                <li>点赞和收藏动画</li>
                <li>分享自己的创作</li>
                <li>学习和交流</li>
              </ul>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
