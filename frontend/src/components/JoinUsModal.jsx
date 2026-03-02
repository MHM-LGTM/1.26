/**
 * 加入我们弹窗组件
 * ---------------------------------
 * 功能：
 * - 展示团队招募信息
 * - 显示联系方式和二维码
 * - 复用登录窗口的样式风格
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import './JoinUsModal.css';
import './CommonModal.css';

export default function JoinUsModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="auth-modal-overlay" />
        <Dialog.Content className="join-us-modal-content">
          <Dialog.Close className="modal-close-fixed">✕</Dialog.Close>

          <Dialog.Title className="join-us-title">
            {t('joinUsTitle')}
          </Dialog.Title>

          <div className="join-us-content">
            <p>{t('joinUsIntro1')}</p>
            <p>{t('joinUsIntro2')}</p>
            <p>{t('joinUsIntro3')}</p>
          </div>

          <div className="recruitment-section">
            <p className="recruitment-intro">{t('recruitmentIntro')}</p>
            
            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">👥</span>
                <h4 className="position-title">{t('positionMarketing')}</h4>
              </div>
              <ul className="requirements-list">
                <li>{t('reqFemale')}</li>
                <li>{t('reqSocialMedia')}</li>
                <li>{t('reqOutgoing')}</li>
                <li>{t('reqPassion')}</li>
              </ul>
            </div>

            <div className="position-card">
              <div className="position-header">
                <span className="position-icon">💻</span>
                <h4 className="position-title">{t('positionTech')}</h4>
              </div>
              <ul className="requirements-list">
                <li>{t('reqIndustry')}</li>
                <li>{t('reqDevExp')}</li>
                <li>{t('reqTeamSpirit')}</li>
              </ul>
            </div>
          </div>

          <div className="contact-section">
            <p>
              {t('contactInfo')}
              <a href="mailto:contact@example.com" className="email-link">contact@example.com</a>
            </p>
            <div className="template-download">
              <a 
                href="/templates/个人信息模板.docx" 
                download="个人信息模板.docx"
                className="download-button"
              >
                {t('downloadTemplate')}
              </a>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
