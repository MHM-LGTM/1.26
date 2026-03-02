/**
 * 我的动画面板组件
 * ---------------------------------
 * 功能：
 * - 显示用户保存的所有动画
 * - 卡片式布局展示
 * - 点击卡片加载动画到画布
 * - 固定高度，支持分页
 * 
 * 使用：
 * <MyAnimationsPanel onLoadAnimation={handleLoadAnimation} />
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../store/authStore';
import ShareLinkModal from './ShareLinkModal.jsx';
import { API_BASE_URL } from '../config/api';
import { showToast } from '../utils/toast.js';

export default function MyAnimationsPanel({ onLoadAnimation, onUploadClick }) {
  const { t } = useTranslation();
  const [animations, setAnimations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null); // 当前打开菜单的动画ID
  const [shareAnimationId, setShareAnimationId] = useState(null); // 要分享的动画ID
  const [currentPage, setCurrentPage] = useState(0); // 当前页码
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 }); // 菜单位置
  const token = useAuthStore((state) => state.token);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  
  // 分页配置：每页显示8个动画（4行×2列）
  const ITEMS_PER_PAGE = 8;

  // 加载我的动画列表
  const loadAnimations = async () => {
    if (!token) {
      setAnimations([]); // 退出登录时清空动画列表
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/animations/mine`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.code === 0) {
        setAnimations(data.data.animations || []);
      } else {
        console.error('获取动画列表失败:', data.message);
      }
    } catch (error) {
      console.error('加载动画列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnimations();
  }, [token]);

  // 重置页码当动画列表变化时
  useEffect(() => {
    setCurrentPage(0);
  }, [animations.length]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = () => {
      if (menuOpen !== null) {
        setMenuOpen(null);
      }
    };
    
    if (menuOpen !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [menuOpen]);

  // 计算分页数据
  const totalPages = Math.max(1, Math.ceil(animations.length / ITEMS_PER_PAGE));
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentAnimations = animations.slice(startIndex, endIndex);
  
  // 只有当动画总数超过每页显示数量时才显示空占位卡片
  const shouldShowPlaceholders = animations.length <= ITEMS_PER_PAGE;
  const emptySlots = shouldShowPlaceholders ? (ITEMS_PER_PAGE - currentAnimations.length) : 0;
  const placeholders = Array(emptySlots).fill(null);

  // 点击卡片，加载动画详情
  const handleCardClick = async (animationId, e) => {
    // 如果点击的是菜单按钮，不触发加载
    if (e.target.closest('.menu-button')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/animations/${animationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.code === 0) {
        const animData = data.data;
        console.log('[MyAnimationsPanel] 加载动画:', animData.title);
        
        // 转换场景数据中的图片路径为完整 URL
        const sceneData = { ...animData.scene_data };
        if (sceneData.imagePreview && !sceneData.imagePreview.startsWith('data:')) {
          // 如果是相对路径，转换为完整 URL
          sceneData.imagePreview = `${API_BASE_URL}${sceneData.imagePreview}`;
          console.log('[MyAnimationsPanel] 转换背景图路径:', sceneData.imagePreview);
        }
        
        // 调用父组件传入的加载函数
        onLoadAnimation(sceneData);
      } else {
        showToast.error(t('loadFailed', { message: data.message }));
      }
    } catch (error) {
      console.error('加载动画失败:', error);
      showToast.error(t('loadFailed', { message: error.message }));
    }
  };

  // 删除动画
  const handleDelete = async (animationId) => {
    if (!confirm(t('confirmDelete'))) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/animations/${animationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.code === 0) {
        showToast.success(t('deleteSuccess'));
        loadAnimations(); // 刷新列表
        setMenuOpen(null); // 关闭菜单
      } else {
        showToast.error(t('deleteFailed', { message: data.message }));
      }
    } catch (error) {
      console.error('删除动画失败:', error);
      showToast.error(t('deleteFailed', { message: error.message }));
    }
  };

  // 上传到广场
  const handlePublish = async (animationId, showAuthor = true) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/animations/${animationId}/publish?show_author=${showAuthor}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.code === 0) {
        showToast.success(t('uploadToPlazaSuccess'));
        loadAnimations(); // 刷新列表
        setMenuOpen(null); // 关闭菜单
      } else {
        showToast.error(t('uploadFailed2', { message: data.message }));
      }
    } catch (error) {
      console.error('上传动画失败:', error);
      showToast.error(t('uploadFailed2', { message: error.message }));
    }
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        top: '8.8vh',
        right: '1.5vw',
        width: '21vw',
        minWidth: '280px', /* 防止过小 */
        height: 'calc(100vh - 18.5vh)',
        background: 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)',
        borderRadius: 16,
        padding: 16,
        boxShadow: '0 4px 12px rgba(255, 152, 0, 0.15)',
        border: '1px solid #000000',
        display: 'flex',
        flexDirection: 'column'
      }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottom: '1px solid #ffd93d'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 600,
          color: '#222'
        }}>
          {t('myAnimations')}
        </h3>
        <span style={{
          fontSize: 13,
          color: '#666',
          fontWeight: 500
        }}>
          {t('countUnit', { count: animations.length })}
        </span>
      </div>

      {/* 内容区域 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <p style={{ 
              textAlign: 'center', 
              color: '#6b7280',
              fontSize: 14,
              margin: 0
            }}>
              {t('loading')}
            </p>
          </div>
        ) : animations.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <p style={{ 
              textAlign: 'center', 
              color: '#9ca3af', 
              fontSize: 13,
              lineHeight: 1.6,
              margin: 0
            }}>
              {!isLoggedIn || !token ? (
                <>{t('loginToSeeAnimations')}<br/>{t('clickLoginToStart')}</>
              ) : (
                <>{t('noSavedAnimations')}<br/>{t('runAndSaveHint')}</>
              )}
            </p>
          </div>
        ) : (
          <>
            {/* 动画网格容器（带滚动） */}
            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'visible',
              paddingRight: 4
            }}>
              {/* 动画网格 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                position: 'relative'
              }}>
              {/* 真实动画卡片 */}
              {currentAnimations.map((anim) => (
            <div
              key={anim.id}
              style={{
                position: 'relative',
                zIndex: menuOpen === anim.id ? 100 : 1,
                height: '100%'
              }}
            >
              <div
                onClick={(e) => handleCardClick(anim.id, e)}
                style={{
                  cursor: 'pointer',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid #ffd93d',
                  transition: 'all 0.2s',
                  backgroundColor: '#ffffff',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
              {/* 封面图 */}
              <div style={{
                width: '100%',
                height: 110,
                background: anim.thumbnail_url 
                  ? '#fffbf0'
                  : 'linear-gradient(135deg, #ff9800 0%, #ff6b35 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 32,
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                {anim.thumbnail_url ? (
                  <img 
                    src={anim.thumbnail_url.startsWith('data:') || anim.thumbnail_url.startsWith('http') 
                      ? anim.thumbnail_url 
                      : `${API_BASE_URL}${anim.thumbnail_url}`
                    } 
                    alt={anim.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      console.error('[封面加载失败]', anim.thumbnail_url);
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  '🎬'
                )}
                
                {/* 菜单按钮 - 右上角 */}
                <button
                  className="menu-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuPosition({
                      top: rect.bottom + 4,
                      right: window.innerWidth - rect.right
                    });
                    setMenuOpen(menuOpen === anim.id ? null : anim.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    border: '1px solid #d1d5db',
                    background: 'rgba(249, 250, 251, 0.95)',
                    color: '#6b7280',
                    fontSize: 18,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(243, 244, 246, 0.95)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(249, 250, 251, 0.95)';
                  }}
                >
                  ⋯
                </button>
              </div>

              {/* 标题和时间 */}
              <div style={{
                padding: 8,
                background: '#ffffff',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minHeight: 0
              }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#222',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                  marginBottom: 3
                }}
                title={anim.title}
                >
                  {anim.title}
                </div>
                <div style={{
                  fontSize: 10,
                  color: '#666',
                  marginTop: 1
                }}>
                  {new Date(anim.created_at).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              </div>
              </div>
            </div>
          ))}
          
          {/* 空占位卡片 */}
          {placeholders.map((_, index) => (
            <div
              key={`placeholder-${index}`}
              onClick={() => {
                if (!isLoggedIn || !token) {
                  showToast.warning(t('pleaseLoginToCreate'));
                } else if (onUploadClick) {
                  onUploadClick();
                }
              }}
              style={{
                borderRadius: 12,
                border: '1px solid #ffd93d',
                background: '#fffbf0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 145,
                color: '#666',
                fontSize: 28,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fff8e1';
                e.currentTarget.style.borderColor = '#ffcc80';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fffbf0';
                e.currentTarget.style.borderColor = '#ffd93d';
              }}
            >
              +
            </div>
          ))}
        </div>
        </div>

        {/* 分页控件 */}
        {animations.length > ITEMS_PER_PAGE && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid #ffd93d'
          }}>
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: '1px solid #000000',
                background: currentPage === 0 ? '#fffbf0' : 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)',
                color: currentPage === 0 ? '#ffcc80' : '#222',
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (currentPage !== 0) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #fff8e1 0%, #ffeaa7 100%)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== 0) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)';
                }
              }}
            >
              ‹
            </button>
            
            <span style={{
              fontSize: 12,
              color: '#222',
              minWidth: 50,
              textAlign: 'center'
            }}>
              {currentPage + 1} / {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: '1px solid #000000',
                background: currentPage >= totalPages - 1 ? '#fffbf0' : 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)',
                color: currentPage >= totalPages - 1 ? '#ffcc80' : '#222',
                cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (currentPage < totalPages - 1) {
                  e.currentTarget.style.background = '#f3f4f6';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage < totalPages - 1) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)';
                }
              }}
            >
              ›
            </button>
          </div>
        )}
      </>
        )}
      </div>

      {/* 下拉菜单 - 使用 fixed 定位，避免被遮挡 */}
      {menuOpen !== null && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          style={{
            position: 'fixed',
            top: menuPosition.top,
            right: menuPosition.right,
            background: 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)',
            border: '1px solid #ffd93d',
            borderRadius: 8,
            boxShadow: '0 8px 16px rgba(255, 152, 0, 0.25)',
            padding: '4px 0',
            minWidth: 130,
            zIndex: 9999
          }}
        >
          {/* 删除 */}
          <button
            onClick={() => handleDelete(menuOpen)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 13,
              color: '#222',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {t('delete')}
          </button>

          {/* 上传到广场 / 从广场下架 */}
          {animations.find(a => a.id === menuOpen)?.is_public ? (
            <button
              onClick={async () => {
                try {
                  const response = await fetch(`${API_BASE_URL}/api/animations/${menuOpen}/unpublish`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await response.json();
                  if (data.code === 0) {
                    showToast.success(t('removedFromPlaza'));
                    loadAnimations();
                    setMenuOpen(null);
                  }
                } catch (error) {
                  showToast.error(t('removeFailed'));
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: 13,
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {t('removeFromPlaza')}
            </button>
          ) : (
            <button
              onClick={() => handlePublish(menuOpen)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: 13,
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {t('uploadToPlaza')}
            </button>
          )}

          {/* 分享链接 */}
          <button
            onClick={() => {
              setShareAnimationId(menuOpen);
              setMenuOpen(null);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 13,
              color: '#222',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {t('shareLink')}
          </button>
        </div>
      )}
      </div>

      {/* 分享链接弹窗 - 移到外层，确保覆盖所有元素 */}
      <ShareLinkModal
        isOpen={shareAnimationId !== null}
        onClose={() => setShareAnimationId(null)}
        animationId={shareAnimationId}
      />
    </>
  );
}

