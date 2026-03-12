/**
 * 会员获取弹窗组件
 * ---------------------------------
 * 功能：
 * - 展示种子用户招募信息
 * - 说明参与可免费获得会员权益
 */

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './JoinUsModal.css';
import './CommonModal.css';
import wechatQr from '../assets/qrcode/wechat-seed-user.png';

export default function MembershipModal({ isOpen, onClose }) {
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setIsPreviewOpen(false);
    }
  }, [isOpen]);

  return (
    <>
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

              <p>Physmath 就是我们当前重点打磨的物理模拟产品，我们正在邀请一批核心用户作为 <strong style={{color: '#ff9800', fontSize: '16px'}}>种子用户</strong>，一起体验和共建产品。</p>

              <p>加入种子用户计划后，你可以 <strong style={{color: '#ff9800', fontSize: '16px'}}>免费获取会员权益</strong>，优先体验新功能，并第一时间收到版本更新。</p>
            </div>

            {/* 参与权益 */}
            <div className="recruitment-section">
              <p className="recruitment-intro">种子用户权益：</p>

              <div className="position-card">
                <div className="position-header">
                  <span className="position-icon">🎁</span>
                  <h4 className="position-title">免费会员</h4>
                </div>
                <ul className="requirements-list">
                  <li>加入后可免费获得会员资格</li>
                  <li>更长时间和更完整地体验产品能力</li>
                </ul>
              </div>

              <div className="position-card">
                <div className="position-header">
                  <span className="position-icon">🚀</span>
                  <h4 className="position-title">优先体验</h4>
                </div>
                <ul className="requirements-list">
                  <li>优先体验新版本和新功能</li>
                  <li>你的建议会直接帮助我们优化产品</li>
                </ul>
              </div>
            </div>

            {/* 参与方式 */}
            <div className="contact-section">
              <p style={{fontSize: '15px', fontWeight: '500', marginBottom: '16px'}}>
                扫描下方二维码，加入种子用户群
              </p>
              <p style={{color: '#ff9800', fontWeight: '500'}}>
                欢迎加入，一起把 Physmath 打磨得更好！
              </p>
            </div>

            {/* 二维码区域 */}
            <div className="qrcode-section">
              <div className="qrcode-container">
                <div className="qrcode-item">
                  <div className="qrcode-placeholder">
                    <button
                      type="button"
                      className="qrcode-box qrcode-button"
                      onClick={() => setIsPreviewOpen(true)}
                      aria-label="点击查看微信二维码大图"
                    >
                      <img src={wechatQr} alt="微信二维码" className="qrcode-image" />
                    </button>
                  </div>
                  <p className="qrcode-label">种子用户群（点击查看大图）</p>
                </div>
              </div>
            </div>

          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="qrcode-preview-overlay" />
          <Dialog.Content className="qrcode-preview-content">
            <Dialog.Close className="qrcode-preview-close">✕</Dialog.Close>
            <img src={wechatQr} alt="微信二维码大图" className="qrcode-preview-image" />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
