/**
 * 保存动画弹窗组件
 * ---------------------------------
 * 功能：
 * - 显示封面预览
 * - 输入动画名称和描述
 * - 调用后端 API 保存动画到我的动画库
 * 
 * 使用：
 * <SaveAnimationModal
 *   isOpen={showSaveModal}
 *   onClose={() => setShowSaveModal(false)}
 *   sceneData={...}  // 包含 imagePreview, objects, constraints 等
 * />
 */

import React, { useState } from 'react';
import useAuthStore from '../store/authStore';
import { API_BASE_URL } from '../config/api';
import { showToast } from '../utils/toast.js';

export default function SaveAnimationModal({ isOpen, onClose, sceneData, getSceneData }) {
  // 优先使用 getSceneData 函数（动态获取最新数据），否则用传入的 sceneData
  const getCurrentSceneData = () => {
    if (getSceneData) {
      return getSceneData();
    }
    return sceneData;
  };
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPublishPrompt, setShowPublishPrompt] = useState(false); // 是否显示上传询问
  const [savedAnimationId, setSavedAnimationId] = useState(null); // 保存后的动画ID
  const [showAuthor, setShowAuthor] = useState(true); // 是否显示作者
  const [dontAskAgain, setDontAskAgain] = useState(false); // 不再提醒
  const token = useAuthStore((state) => state.token);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  // 辅助函数：将 data URL 转换为 Blob
  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // 辅助函数：获取可显示的图片 URL
  const getDisplayableImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    
    // 如果是 data URL，直接返回
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    
    // 如果已经是完整 URL（http:// 或 https://），直接返回
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // 如果是相对路径，加上 API_BASE_URL
    return `${API_BASE_URL}${imageUrl}`;
  };

  // 辅助函数：上传图片到服务器
  const uploadImageToServer = async (imageUrl) => {
    // 如果是空值，直接返回
    if (!imageUrl) {
      return imageUrl;
    }
    
    // 如果不是 data URL，可能是路径或完整 URL
    if (!imageUrl.startsWith('data:')) {
      // 如果是完整 URL（包含 API_BASE_URL），提取相对路径
      if (imageUrl.startsWith(API_BASE_URL)) {
        const relativePath = imageUrl.replace(API_BASE_URL, '');
        console.log('[SaveAnimationModal] 转换完整URL为相对路径:', imageUrl, '->', relativePath);
        return relativePath;
      }
      // 如果是其他完整 URL（http:// 或 https://），也尝试提取相对路径
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        try {
          const url = new URL(imageUrl);
          const relativePath = url.pathname;
          console.log('[SaveAnimationModal] 从URL提取相对路径:', imageUrl, '->', relativePath);
          return relativePath;
        } catch (e) {
          console.warn('[SaveAnimationModal] 无法解析URL，直接返回:', imageUrl);
          return imageUrl;
        }
      }
      // 已经是相对路径，直接返回
      return imageUrl;
    }

    try {
      // 将 data URL 转换为 Blob
      const blob = dataURLtoBlob(imageUrl);
      
      // 创建 FormData
      const formData = new FormData();
      formData.append('file', blob, 'animation-image.png');

      // 上传图片
      const response = await fetch(`${API_BASE_URL}/api/animations/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.code === 0) {
        return data.data.path; // 返回服务器上的相对路径
      } else {
        throw new Error(data.message || '图片上传失败');
      }
    } catch (error) {
      console.error('上传图片失败:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    // 检查登录状态
    if (!isLoggedIn || !token) {
      showToast.warning('请先登录后再保存动画');
      return;
    }

    // 检查必填字段
    if (!title.trim()) {
      showToast.warning('请输入动画名称');
      return;
    }

    // 获取最新的场景数据
    const currentSceneData = getCurrentSceneData();
    
    // 检查场景数据
    if (!currentSceneData) {
      showToast.error('场景数据不存在，请重新运行模拟');
      return;
    }

    setSaving(true);
    try {
      console.log('[SaveAnimationModal] 准备保存动画:', {
        title: title.trim(),
        hasSceneData: !!currentSceneData,
        sceneDataKeys: currentSceneData ? Object.keys(currentSceneData) : [],
        objectsCount: currentSceneData?.objects?.length || 0,
        hasSprites: currentSceneData?.objects?.[0]?.sprite_data_url ? '有精灵图' : '无精灵图'
      });
      
      // 优先使用原始上传的图片作为封面，避免OpenCV裁剪导致的元素残缺
      // 如果没有原始图片，则回退到处理后的图片
      const originalThumbnailUrl = currentSceneData?.originalImageUrl || currentSceneData?.imagePreview || null;
      const originalImagePreview = currentSceneData?.imagePreview || null;
      
      console.log('[SaveAnimationModal] 开始上传图片...');
      
      // 1. 先上传封面图（如果是 data URL）
      let thumbnailPath = null;
      if (originalThumbnailUrl) {
        thumbnailPath = await uploadImageToServer(originalThumbnailUrl);
        console.log('[SaveAnimationModal] 封面图上传完成:', thumbnailPath);
      }
      
      // 2. 上传背景图（如果是 data URL，且与封面不同）
      let imagePreviewPath = thumbnailPath; // 默认使用封面图路径
      if (originalImagePreview && originalImagePreview !== originalThumbnailUrl) {
        imagePreviewPath = await uploadImageToServer(originalImagePreview);
        console.log('[SaveAnimationModal] 背景图上传完成:', imagePreviewPath);
      }
      
      // 3. 构建新的 scene_data，使用文件路径替换 data URL
      const updatedSceneData = {
        ...currentSceneData,
        imagePreview: imagePreviewPath // 使用文件路径
      };
      
      // 4. 保存动画到数据库
      console.log('[SaveAnimationModal] 保存动画到数据库...');
      const response = await fetch(`${API_BASE_URL}/api/animations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          thumbnail_url: thumbnailPath, // 使用文件路径
          scene_data: updatedSceneData
        })
      });
      
      console.log('[SaveAnimationModal] 响应状态:', response.status);

      const data = await response.json();
      
      if (data.code === 0) {
        const animId = data.data.id;
        setSavedAnimationId(animId);
        
        // 更新会员使用统计（如果返回了）
        if (data.data.usage) {
          const updateMembership = useAuthStore.getState().updateMembership;
          updateMembership(data.data.usage);
        }
        
        // 检查是否需要询问上传到广场
        const dontAsk = localStorage.getItem('dontAskPublish') === 'true';
        
        if (dontAsk) {
          // 用户选择了"不再提醒"，直接关闭
          showToast.success('保存成功！');
          onClose();
          setTitle('');
          setDescription('');
        } else {
          // 显示上传到广场的询问
          setShowPublishPrompt(true);
        }
      } else {
        // 检查是否是会员限制错误
        if (data.code === 403 && data.data?.is_vip === false) {
          showToast.error(data.message || '今日次数已用完，开通会员享无限次数');
          // 可以在这里打开会员弹窗
          setTimeout(() => {
            // 触发打开会员弹窗的事件
            window.dispatchEvent(new CustomEvent('open-membership-modal'));
          }, 2000);
        } else {
          showToast.error(`保存失败：${data.message || '未知错误'}`);
        }
      }
    } catch (error) {
      console.error('保存动画失败:', error);
      showToast.error(`保存失败：${error.message || '网络错误'}`);
    } finally {
      setSaving(false);
    }
  };

  // 处理上传到广场
  const handlePublishToPlaza = async () => {
    if (!savedAnimationId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/animations/${savedAnimationId}/publish?show_author=${showAuthor}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.code === 0) {
        // 保存"不再提醒"设置
        if (dontAskAgain) {
          localStorage.setItem('dontAskPublish', 'true');
        }
        
        showToast.success('已保存到我的动画并上传到广场！');
        handleCloseAll();
      } else {
        showToast.error(`上传失败：${data.message}`);
      }
    } catch (error) {
      showToast.error(`上传失败：${error.message}`);
    }
  };

  // 跳过上传
  const handleSkipPublish = () => {
    // 保存"不再提醒"设置
    if (dontAskAgain) {
      localStorage.setItem('dontAskPublish', 'true');
    }
    
    showToast.success('保存成功！');
    handleCloseAll();
  };

  // 关闭所有弹窗并重置
  const handleCloseAll = () => {
    onClose();
    setShowPublishPrompt(false);
    setSavedAnimationId(null);
    setTitle('');
    setDescription('');
    setShowAuthor(true);
    setDontAskAgain(false);
  };

  // 处理关闭
  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // 如果显示上传询问弹窗
  if (showPublishPrompt) {
    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}
        onClick={handleCloseAll}
      >
        <div 
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)',
            borderRadius: 16,
            padding: 24,
            width: '90%',
            maxWidth: 400,
            boxShadow: '0 20px 60px rgba(255, 152, 0, 0.3)',
            border: '1px solid #ffd93d'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 style={{ 
            margin: '0 0 16px 0', 
            fontSize: 18, 
            fontWeight: 600,
            color: '#222'
          }}>
            ✅ 保存成功！
          </h3>

          <p style={{ 
            margin: '0 0 20px 0',
            fontSize: 14,
            color: '#6b7280',
            lineHeight: 1.6
          }}>
            是否将动画分享到<strong>动画广场</strong>？<br/>
            分享后其他用户也能看到并使用
          </p>

          {/* 是否显示用户名 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ 
              fontSize: 14, 
              fontWeight: 500,
              color: '#374151',
              marginBottom: 8,
              display: 'block'
            }}>
              是否公开显示你的用户名？
            </label>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={showAuthor}
                  onChange={() => setShowAuthor(true)}
                  style={{ marginRight: 6 }}
                />
                <span style={{ fontSize: 14 }}>显示用户名</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={!showAuthor}
                  onChange={() => setShowAuthor(false)}
                  style={{ marginRight: 6 }}
                />
                <span style={{ fontSize: 14 }}>匿名</span>
              </label>
            </div>
          </div>

          {/* 不再提醒 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>不再提醒</span>
            </label>
          </div>

          {/* 按钮 */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            justifyContent: 'flex-end' 
          }}>
            <button
              onClick={handleSkipPublish}
              style={{
                padding: '10px 20px',
                border: '1px solid #ffd93d',
                background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                color: '#222'
              }}
            >
              暂不了
            </button>
            <button
              onClick={handlePublishToPlaza}
              style={{
                padding: '10px 20px',
                border: '1px solid #ff9800',
                background: 'linear-gradient(135deg, #fff8e1 0%, #ffeaa7 100%)',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                color: '#222'
              }}
            >
              上传到广场
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 保存动画表单
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)'
      }}
      onClick={handleClose}
    >
      <div 
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)',
          borderRadius: 16,
          padding: 24,
          width: '90%',
          maxWidth: 480,
          boxShadow: '0 20px 60px rgba(255, 152, 0, 0.3)',
          border: '1px solid #ffd93d',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ 
          margin: '0 0 20px 0', 
          fontSize: 20, 
          fontWeight: 600,
          color: '#222'
        }}>
          保存动画到我的动画库
        </h3>

        {/* 封面预览 */}
        {(getCurrentSceneData()?.originalImageUrl || getCurrentSceneData()?.imagePreview) && (
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <img 
              src={getDisplayableImageUrl(getCurrentSceneData()?.originalImageUrl || getCurrentSceneData()?.imagePreview)} 
              alt="封面预览"
              style={{
                maxWidth: '100%',
                maxHeight: 200,
                borderRadius: 8,
                border: '2px solid #ffd93d',
                objectFit: 'contain'
              }}
              onError={(e) => {
                console.error('[SaveAnimationModal] 封面图片加载失败:', e.target.src);
                e.target.style.display = 'none';
              }}
            />
            <p style={{ 
              fontSize: 12, 
              color: '#6b7280', 
              marginTop: 8 
            }}>
              封面预览（原始上传图片）
            </p>
          </div>
        )}

        {/* 动画名称 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 6, 
            fontSize: 14, 
            fontWeight: 500,
            color: '#374151'
          }}>
            动画名称 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：弹性碰撞演示"
            maxLength={100}
            disabled={saving}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '2px solid #ffd93d',
              borderRadius: 8,
              fontSize: 14,
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s',
              background: '#ffffff'
            }}
            onFocus={(e) => e.target.style.borderColor = '#ff9800'}
            onBlur={(e) => e.target.style.borderColor = '#ffd93d'}
          />
          <p style={{ 
            fontSize: 12, 
            color: '#6b7280', 
            marginTop: 4 
          }}>
            {title.length}/100
          </p>
        </div>

        {/* 描述（可选） */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: 6, 
            fontSize: 14, 
            fontWeight: 500,
            color: '#374151'
          }}>
            描述（可选）
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述这个动画的内容，例如：展示两个小球在光滑斜面上的弹性碰撞过程..."
            maxLength={500}
            rows={4}
            disabled={saving}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '2px solid #ffd93d',
              borderRadius: 8,
              fontSize: 14,
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'border-color 0.2s',
              background: '#ffffff'
            }}
            onFocus={(e) => e.target.style.borderColor = '#ff9800'}
            onBlur={(e) => e.target.style.borderColor = '#ffd93d'}
          />
          <p style={{ 
            fontSize: 12, 
            color: '#6b7280', 
            marginTop: 4 
          }}>
            {description.length}/500
          </p>
        </div>

        {/* 按钮 - 简洁风格，与"取消"按钮一致 */}
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={handleClose}
            disabled={saving}
            style={{
              padding: '10px 20px',
              border: '1px solid #000000',
              background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)',
              borderRadius: 8,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: '#222'
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            style={{
              padding: '10px 20px',
              border: '1px solid #000000',
              background: saving || !title.trim() ? '#fffbf0' : 'linear-gradient(135deg, #fff8e1 0%, #ffeaa7 100%)',
              borderRadius: 8,
              cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: saving || !title.trim() ? '#9ca3af' : '#222'
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

