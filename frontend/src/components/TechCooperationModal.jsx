/**
 * 技术合作弹窗组件
 * ---------------------------------
 * 功能：
 * - 展示技术合作信息
 * - 提供联系方式
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import './JoinUsModal.css';
import './CommonModal.css';

export default function TechCooperationModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="auth-modal-overlay" />
        <Dialog.Content className="join-us-modal-content">
          <Dialog.Close className="modal-close-fixed">✕</Dialog.Close>

          <Dialog.Title className="join-us-title">
            {t('techCoopTitle')}
          </Dialog.Title>

          <div className="join-us-welcome">
            <p>{t('techCoopWelcome')}</p>
            <p>{t('techCoopNeedsIntro')}</p>
          </div>

          <div className="recruitment-section">
            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">🔗</span>
                <h4 className="position-title">{t('productIntegration')}</h4>
              </div>
              <ul className="requirements-list">
                <li>{t('techCoopInteg1')}</li>
                <li>{t('techCoopInteg2')}</li>
                <li>{t('techCoopInteg3')}</li>
                <li>{t('techCoopInteg4')}</li>
              </ul>
            </div>

            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">🛠️</span>
                <h4 className="position-title">{t('customDev')}</h4>
              </div>
              <ul className="requirements-list">
                <li>{t('techCoopDev1')}</li>
                <li>{t('techCoopDev2')}</li>
                <li>{t('techCoopDev3')}</li>
                <li>{t('techCoopDev4')}</li>
              </ul>
            </div>

            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">🤝</span>
                <h4 className="position-title">{t('strategicCoop')}</h4>
              </div>
              <ul className="requirements-list">
                <li>{t('techCoopStrat1')}</li>
                <li>{t('techCoopStrat2')}</li>
                <li>{t('techCoopStrat3')}</li>
                <li>{t('techCoopStrat4')}</li>
              </ul>
            </div>
          </div>

          <div className="qrcode-section">
            <h3 className="section-title">{t('contactUs')}</h3>
            <div className="contact-info" style={{ textAlign: 'center', marginTop: '20px' }}>
              <p style={{ fontSize: '16px', marginBottom: '12px' }}>
                {t('sendCoopRequest')}
              </p>
              <a href="mailto:cooperation@example.com" className="email-link" style={{ fontSize: '18px' }}>
                cooperation@example.com
              </a>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '16px' }}>
                {t('replyIn24h')}
              </p>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
