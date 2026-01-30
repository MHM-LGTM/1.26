/**
 * 问题反馈弹窗组件
 * ---------------------------------
 * 功能：
 * - 图片上传
 * - 问题描述文本框
 * - 提交反馈
 */

import React, { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import toast from 'react-hot-toast';
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

  // 处理图片选择
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // 限制图片数量
    if (images.length + files.length > 5) {
      toast.error('最多只能上传5张图片');
      return;
    }

    // 验证文件类型和大小
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} 不是图片文件`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} 超过5MB限制`);
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
      toast.error('请输入您的邮箱');
      return;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    if (!description.trim()) {
      toast.error('请描述您遇到的问题');
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
        toast.success(result.message);
        setEmail('');
        setDescription('');
        setImages([]);
        onClose();
      } else {
        throw new Error(result.message || '提交失败');
      }
    } catch (error) {
      console.error('提交反馈失败:', error);
      toast.error(error.message || '提交失败，请重试');
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
            问题反馈
          </Dialog.Title>

          {/* 说明 */}
          <div className="join-us-welcome">
            <p>感谢您帮助我们改进产品！</p>
            <p className="feedback-reward">
              📢 反馈被采纳后，您的账号将获得 <strong>15天会员</strong> 奖励
            </p>
          </div>

          {/* 反馈表单 */}
          <div className="feedback-form">
            {/* 邮箱 */}
            <div className="form-group">
              <label className="form-label">联系邮箱 *</label>
              <input
                type="email"
                className="feedback-input"
                placeholder="请输入您的邮箱，以便我们与您联系"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* 问题描述 */}
            <div className="form-group">
              <label className="form-label">问题描述 *</label>
              <textarea
                className="feedback-textarea"
                placeholder="请详细描述您遇到的问题，包括：&#10;1. 问题出现的场景&#10;2. 具体的错误表现&#10;3. 您的操作步骤"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>

            {/* 图片上传 */}
            <div className="form-group">
              <label className="form-label">上传截图（选填）</label>
              <p className="form-hint">支持 JPG、PNG、GIF 格式，单张最大 5MB，最多 5 张</p>
              
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
                    <div className="upload-text">点击上传</div>
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
              {loading ? '提交中...' : '提交反馈'}
            </button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
