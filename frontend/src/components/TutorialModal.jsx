/**
 * 使用教程弹窗组件
 * ---------------------------------
 * 功能：
 * - 展示使用教程视频
 * - 视频播放功能
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import './JoinUsModal.css';
import './CommonModal.css';
import './TutorialModal.css';

export default function TutorialModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="auth-modal-overlay" />
        <Dialog.Content className="join-us-modal-content tutorial-modal-content">
          <Dialog.Close className="modal-close-fixed">✕</Dialog.Close>

          <Dialog.Title className="join-us-title">
            {t('tutorialTitle')}
          </Dialog.Title>

          <div className="join-us-welcome">
            <p>{t('tutorialWelcome')}</p>
          </div>

          <div className="video-section">
            <div className="video-container">
              <video 
                controls 
                className="tutorial-video"
                poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450'%3E%3Crect width='800' height='450' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' font-size='24' fill='%239ca3af' text-anchor='middle' dy='.3em'%3E▶%3C/text%3E%3C/svg%3E"
              >
                <source src="/tutorial-video.mp4" type="video/mp4" />
                <source src="/tutorial-video.webm" type="video/webm" />
                {t('browserNotSupported')}
              </video>
            </div>
          </div>

          <div className="recruitment-section" style={{ marginTop: '32px' }}>
            <h3 className="section-title">{t('mainFeatures')}</h3>
            
            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">📐</span>
                <h4 className="position-title">{t('featurePhysicsTitle')}</h4>
              </div>
              <div className="feature-description">
                <p>{t('featurePhysicsDesc')}</p>
              </div>
              <ul className="requirements-list">
                <li dangerouslySetInnerHTML={{ __html: t('featureScenes') }} />
                <li dangerouslySetInnerHTML={{ __html: t('featureFlow') }} />
                <li dangerouslySetInnerHTML={{ __html: t('featureParams') }} />
                <li dangerouslySetInnerHTML={{ __html: t('featurePerf') }} />
              </ul>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
