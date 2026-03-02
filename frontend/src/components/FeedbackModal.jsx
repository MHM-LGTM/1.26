/**
 * 问题反馈弹窗组件
 * ---------------------------------
 * 功能：
 * - 图片上传
 * - 问题描述文本框
 * - 提交反馈
 */

import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { showToast } from '../utils/toast.js';
import { API_BASE_URL } from '../config/api';
import './JoinUsModal.css';
import './CommonModal.css';
import './FeedbackModal.css';

export default function FeedbackModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const { t } = useTranslation();

  // 处理图片选择
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // 限制图片数量
    if (images.length + files.length > 5) {
      showToast.error(t('maxImages'));
      return;
    }

    // 验证文件类型和大小
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        showToast.error(t('notImageFile', { name: file.name }));
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast.error(t('imageTooLarge', { name: file.name }));
        return false;
      }
      return true;
    });

    // 读取图片并预览
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImages(prev => [...prev, {
          file: file,
          preview: e.target.result,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    });

    // 重置input
    e.target.value = '';
  };

  // 删除图片
  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // 提交反馈
  const handleSubmit = async () => {
    if (!email.trim()) {
      showToast.error(t('pleaseEnterEmail'));
      return;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast.error(t('invalidEmail'));
      return;
    }

    if (!description.trim()) {
      showToast.error(t('pleaseDescribeProblem'));
      return;
    }

    setLoading(true);
    try {
      // 创建 FormData
      const formData = new FormData();
      formData.append('email', email);
      formData.append('description', description);
      
      // 添加图片
      images.forEach((img) => {
        formData.append('images', img.file);
      });

      // 提交反馈
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok && result.code === 200) {
        showToast.success(result.message || t('submitSuccess'));
        setEmail('');
        setDescription('');
        setImages([]);
        onClose();
      } else {
        throw new Error(result.message || t('submitFailed'));
      }
    } catch (error) {
      console.error('提交反馈失败:', error);
      showToast.error(error.message || t('submitFailedRetry'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="auth-modal-overlay" />
        <Dialog.Content className="join-us-modal-content">
          <Dialog.Close className="modal-close-fixed">✕</Dialog.Close>

          {/* 标题 */}
          <Dialog.Title className="join-us-title">
            {t('feedbackTitle')}
          </Dialog.Title>

          {/* 说明 */}
          <div className="join-us-welcome">
            <p>{t('feedbackWelcome')}</p>
            <p className="feedback-reward" dangerouslySetInnerHTML={{ __html: t('feedbackReward') }} />
          </div>

          {/* 反馈表单 */}
          <div className="feedback-form">
            {/* 邮箱 */}
            <div className="form-group">
              <label className="form-label">{t('contactEmail')}</label>
              <input
                type="email"
                className="feedback-input"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* 问题描述 */}
            <div className="form-group">
              <label className="form-label">{t('problemDescription')}</label>
              <textarea
                className="feedback-textarea"
                placeholder={t('problemPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>

            {/* 图片上传 */}
            <div className="form-group">
              <label className="form-label">{t('uploadScreenshot')}</label>
              <p className="form-hint">{t('imageHint')}</p>
              
              <div className="image-upload-area">
                {/* 已上传的图片预览 */}
                {images.map((img, index) => (
                  <div key={index} className="image-preview-item">
                    <img src={img.preview} alt={img.name} />
                    <button
                      type="button"
                      className="remove-image-btn"
                      onClick={() => handleRemoveImage(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* 上传按钮 */}
                {images.length < 5 && (
                  <div 
                    className="upload-box"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="upload-icon">📷</div>
                    <div className="upload-text">{t('clickToUpload')}</div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* 提交按钮 */}
            <button
              className="auth-submit-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? t('submitting') : t('submitFeedback')}
            </button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
