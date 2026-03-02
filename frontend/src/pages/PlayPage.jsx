/**
 * 动画播放页
 * ---------------------------------
 * 功能：
 * - 通过分享码加载并播放动画
 * - 显示作者信息和画布
 * - 右侧参数调节面板（与首页一致）
 * - 支持参数调节和重新模拟
 * - 完整的交互功能
 * 
 * 使用：
 * 路由：/physics/play/:shareCode
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { runSimulation } from '../utils/physicsEngine.js';
import { API_BASE_URL } from '../config/api';
import { showToast } from '../utils/toast.js';
import PhysicsParametersPanel from '../components/PhysicsParametersPanel.jsx';
import { useTranslation } from 'react-i18next';

export default function PlayPage() {
  const { t } = useTranslation();
  const { shareCode } = useParams();
  const [animation, setAnimation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simulationCache, setSimulationCache] = useState(null); // 缓存初始状态用于重置
  const [assignments, setAssignments] = useState([]); // 物体数据（用于参数调节）
  const [globalParameters, setGlobalParameters] = useState({ timeScale: 1.0 }); // 全局参数

  // 自定义路径编辑模式
  const [isPathEditMode, setIsPathEditMode] = useState(false);
  const [pathEditObjectIndex, setPathEditObjectIndex] = useState(null);
  const [interactionMode, setInteractionMode] = useState('idle');
  const [imageNaturalSize, setImageNaturalSize] = useState({ w: 800, h: 600 });
  
  const imgRef = useRef(null);
  const simRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null); // 画布容器，用于路径编辑时确保可点击区域
  const runningSimulation = useRef(null);

  // 加载动画数据
  useEffect(() => {
    const loadAnimation = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/play/${shareCode}`);
        const data = await response.json();
        
        if (data.code === 0) {
          // 转换场景数据中的图片路径为完整 URL
          const animData = { ...data.data };
          if (animData.scene_data && animData.scene_data.imagePreview && !animData.scene_data.imagePreview.startsWith('data:')) {
            animData.scene_data = {
              ...animData.scene_data,
              imagePreview: `${API_BASE_URL}${animData.scene_data.imagePreview}`
            };
            console.log('[PlayPage] 转换背景图路径:', animData.scene_data.imagePreview);
          }
          setAnimation(animData);
          
          // 从场景数据预设置图片原始尺寸（用于路径编辑坐标转换，避免图片缓存导致 onLoad 延迟）
          if (animData.scene_data?.imageNaturalSize) {
            setImageNaturalSize(animData.scene_data.imageNaturalSize);
          }
          
          // 设置物体数据用于参数调节面板
          if (animData.scene_data && animData.scene_data.objects) {
            setAssignments(animData.scene_data.objects);
            console.log('[PlayPage] 加载物体数据:', animData.scene_data.objects);
          }
          
          // 设置全局参数（如果有的话）
          if (animData.scene_data && animData.scene_data.global_parameters) {
            setGlobalParameters(animData.scene_data.global_parameters);
            console.log('[PlayPage] 加载全局参数:', animData.scene_data.global_parameters);
          }
        } else {
          setError(data.message || t('loadFailed', { message: '' }));
        }
      } catch (err) {
        console.error('加载动画失败:', err);
        setError(t('loadFailed', { message: '' }));
      } finally {
        setLoading(false);
      }
    };

    if (shareCode) {
      loadAnimation();
    }
  }, [shareCode]);

  // 组件卸载时清理模拟
  useEffect(() => {
    return () => {
      if (runningSimulation.current) {
        runningSimulation.current.stop();
        runningSimulation.current = null;
      }
    };
  }, []);

  // 用 ref 保存最新的路径编辑函数，避免闭包过期问题
  const enablePathEditRef = useRef(null);
  const disablePathEditRef = useRef(null);

  // 注册路径编辑全局函数（只注册一次，通过 ref 始终拿到最新版本）
  useEffect(() => {
    window.enablePathEdit = (idx) => enablePathEditRef.current?.(idx);
    window.disablePathEdit = () => disablePathEditRef.current?.();
    window.setPathVisualsVisible = (visible) => {
      runningSimulation.current?.setPathVisualsVisible(visible);
    };
    return () => {
      delete window.enablePathEdit;
      delete window.disablePathEdit;
      delete window.setPathVisualsVisible;
    };
  }, []);

  // 监听窗口大小变化，同步画布尺寸
  useEffect(() => {
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, []);

  // 进入路径编辑模式时延迟同步画布尺寸（修复通过链接打开时画布可能未正确初始化的问题）
  useEffect(() => {
    if (isPathEditMode && animation?.scene_data?.imagePreview) {
      const timer = setTimeout(syncCanvasSize, 100);
      return () => clearTimeout(timer);
    }
  }, [isPathEditMode, animation?.scene_data?.imagePreview]);

  // 处理参数变化
  const handleParametersChange = (objectIndex, newParams) => {
    console.log('[PlayPage] 参数变化:', objectIndex, newParams);
    
    // 更新 assignments 中的参数
    setAssignments(prev => {
      const updated = [...prev];
      if (updated[objectIndex]) {
        updated[objectIndex] = {
          ...updated[objectIndex],
          parameters: {
            ...updated[objectIndex].parameters,
            ...newParams
          }
        };
      }
      return updated;
    });
    
    console.log('[PlayPage] 参数已更新，点击重置后生效');
  };
  
  // 处理全局参数变化（时间缩放等）
  const handleGlobalParametersChange = (newGlobalParams) => {
    console.log('[PlayPage] 全局参数变化:', newGlobalParams);
    
    setGlobalParameters(prev => ({
      ...prev,
      ...newGlobalParams
    }));
    
    // 如果模拟正在运行，实时更新时间缩放
    if (runningSimulation.current && newGlobalParams.timeScale !== undefined) {
      runningSimulation.current.setTimeScale(newGlobalParams.timeScale);
      console.log(`[PlayPage] 实时更新时间缩放: ${newGlobalParams.timeScale}x`);
    }
  };

  // ============================================================================
  // 自定义路径编辑功能
  // ============================================================================

  const syncCanvasSize = () => {
    if (!canvasRef.current) return;
    // 优先使用图片尺寸，若图片未加载或尺寸为0，则使用容器尺寸作为回退（确保路径编辑时可点击）
    let w = 0, h = 0;
    if (imgRef.current) {
      w = imgRef.current.clientWidth || 0;
      h = imgRef.current.clientHeight || 0;
    }
    if ((!w || !h) && canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      w = Math.floor(rect.width) || 0;
      h = Math.floor(rect.height) || 0;
    }
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    canvasRef.current.width = Math.max(1, Math.floor(w * dpr));
    canvasRef.current.height = Math.max(1, Math.floor(h * dpr));
    canvasRef.current.style.width = `${Math.max(1, w)}px`;
    canvasRef.current.style.height = `${Math.max(1, h)}px`;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const handleImageLoad = (ev) => {
    const newSize = { w: ev.target.naturalWidth, h: ev.target.naturalHeight };
    setImageNaturalSize(newSize);
    syncCanvasSize();
  };

  const enablePathEdit = (objectIndex) => {
    console.log('[PlayPage] enablePathEdit called, objectIndex:', objectIndex, 'assignments:', assignments);
    const obj = assignments[objectIndex];
    if (!obj) {
      console.warn('[PlayPage 路径编辑] 物体不存在:', objectIndex);
      showToast.warning(t('objectNotExist'));
      return;
    }
    if (!obj.parameters?.custom_path_enabled) {
      showToast.warning(t('pleaseEnableCustomPath'));
      return;
    }
    if (simulating) {
      showToast.warning(t('pleaseResetFirst'));
      return;
    }
    syncCanvasSize();
    setIsPathEditMode(true);
    setPathEditObjectIndex(objectIndex);
    setInteractionMode('edit_path');
    // 延迟再次同步画布尺寸，确保布局计算完成（修复通过链接打开时画布尺寸为0导致无法点击的问题）
    requestAnimationFrame(() => {
      syncCanvasSize();
    });
    if (!obj.parameters.custom_path_points) {
      handleParametersChange(objectIndex, { custom_path_points: [] });
    }
    showToast.success(t('pathEditEnabled', { name: obj.label || obj.name }));
  };

  // 每次渲染都更新 ref，确保 window.enablePathEdit 始终调用最新版本
  enablePathEditRef.current = enablePathEdit;

  const disablePathEdit = () => {
    setIsPathEditMode(false);
    setPathEditObjectIndex(null);
    setInteractionMode('idle');
  };

  disablePathEditRef.current = disablePathEdit;

  const handleCanvasMouseUp = (ev) => {
    if (interactionMode !== 'edit_path' || !isPathEditMode || pathEditObjectIndex === null) return;
    if (!canvasRef.current || !imgRef.current) return;

    const imgRect = imgRef.current.getBoundingClientRect();
    // 使用图片边界进行坐标转换（画布可能比图片大，需确保点击在图片区域内）
    const xInImg = ev.clientX - imgRect.left;
    const yInImg = ev.clientY - imgRect.top;
    if (xInImg < 0 || xInImg > imgRect.width || yInImg < 0 || yInImg > imgRect.height) return;

    const scaleX = imageNaturalSize.w / imgRect.width;
    const scaleY = imageNaturalSize.h / imgRect.height;
    const originalX = Math.round(xInImg * scaleX);
    const originalY = Math.round(yInImg * scaleY);

    const newPoint = { x: originalX, y: originalY };
    const currentPoints = assignments[pathEditObjectIndex]?.parameters?.custom_path_points || [];
    const updatedPoints = [...currentPoints, newPoint];

    handleParametersChange(pathEditObjectIndex, { custom_path_points: updatedPoints });

    const ctx = canvasRef.current.getContext('2d');
    const isStart = updatedPoints.length === 1;
    const color = isStart ? '#ef4444' : '#10b981';
    const drawX = xInImg;
    const drawY = yInImg;

    ctx.beginPath();
    ctx.arc(drawX, drawY, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(drawX, drawY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();

    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(updatedPoints.length, drawX, drawY);

    if (updatedPoints.length > 1) {
      const prevPointOriginal = updatedPoints[updatedPoints.length - 2];
      const prevX = Math.round(prevPointOriginal.x / scaleX);
      const prevY = Math.round(prevPointOriginal.y / scaleY);
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    console.log(`[PlayPage 路径编辑] 添加路径点 #${updatedPoints.length}: 原图(${originalX}, ${originalY}), 画布(${x}, ${y})`);
  };

  // 开始模拟或重置
  const handleStartSimulate = (animData = animation) => {
    if (!animData || !animData.scene_data) return;

    // 如果已在运行，则执行重置
    if (simulating) {
      handleReset();
      return;
    }

    setSimulating(true);
    
    try {
      const sceneData = animData.scene_data;
      
      // 使用当前的 assignments（包含用户调节的参数）
      console.log('[PlayPage] ========== 调试信息 ==========');
      console.log('[PlayPage] assignments 数量:', assignments.length);
      console.log('[PlayPage] assignments 详情:', assignments);
      console.log('[PlayPage] 第一个物体的 sprite_data_url:', assignments[0]?.sprite_data_url?.substring(0, 50));
      
      // 转换为物理引擎需要的格式
      const objects = assignments.map((a, idx) => ({
        name: a.label || a.name || `elem-${idx}`,
        role: a.role || 'dynamic',
        parameters: a.parameters || {},
        contour: a.contour || [],
        sprite_data_url: a.sprite_data_url || null,  // 关键：精灵图
        is_concave: a.is_concave || false
      }));
      
      console.log('[PlayPage] 转换后的 objects:', objects);
      console.log('[PlayPage] 第一个 object 的 sprite_data_url:', objects[0]?.sprite_data_url?.substring(0, 50));
      console.log('[PlayPage] ==============================');
      
      const constraints = sceneData.constraints || [];

      // 缓存初始状态用于重置
      setSimulationCache({
        objects,
        constraints,
        imageRect: imgRef.current?.getBoundingClientRect?.(),
        naturalSize: sceneData.imageNaturalSize || { w: 800, h: 600 }
      });

      // 清理旧模拟
      if (runningSimulation.current) {
        runningSimulation.current.stop();
        runningSimulation.current = null;
      }

      // 运行模拟（使用全局参数中的时间缩放）
      const sim = runSimulation({
        container: simRef.current,
        objects,
        constraints,
        imageRect: imgRef.current?.getBoundingClientRect?.(),
        naturalSize: sceneData.imageNaturalSize || { w: 800, h: 600 },
        timeScale: globalParameters.timeScale || 1.0,
      });
      
      runningSimulation.current = sim;
    } catch (err) {
      console.error('模拟失败:', err);
      showToast.error(t('simulationFailed') + ': ' + err.message);
      setSimulating(false);
    }
  };

  // 重置功能
  const handleReset = () => {
    console.log('[PlayPage] 点击重置，应用最新参数并重新创建模拟');
    
    // 停止当前运行的模拟
    if (runningSimulation.current) {
      runningSimulation.current.stop();
      runningSimulation.current = null;
    }
    
    // 使用最新的 assignments（包含用户调节的参数）重新创建模拟
    if (animation && animation.scene_data) {
      setTimeout(() => {
        const sceneData = animation.scene_data;
        
        // 使用当前的 assignments（包含最新的参数调节）
        const objects = assignments.map((a, idx) => ({
          name: a.label || a.name || `elem-${idx}`,
          role: a.role || 'dynamic',
          parameters: a.parameters || {},
          contour: a.contour || [],
          sprite_data_url: a.sprite_data_url || null,
          is_concave: a.is_concave || false
        }));
        
        const constraints = sceneData.constraints || [];
        
        const sim = runSimulation({
          container: simRef.current,
          objects,
          constraints,
          imageRect: imgRef.current?.getBoundingClientRect?.(),
          naturalSize: sceneData.imageNaturalSize || { w: 800, h: 600 },
          timeScale: globalParameters.timeScale || 1.0,
        });
        
        runningSimulation.current = sim;
        console.log('[PlayPage] 已重置并应用最新参数');
      }, 50);
    }
    
    setSimulating(false);
  };


  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #fffbf0 0%, #fff8e1 50%, #ffeaa7 100%)'
      }}>
        <p style={{ fontSize: 18, color: '#222' }}>{t('loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #fffbf0 0%, #fff8e1 50%, #ffeaa7 100%)',
        gap: 16
      }}>
        <p style={{ fontSize: 18, color: '#ef4444' }}>❌ {error}</p>
        <a 
          href="/physics" 
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)',
            border: '1px solid #000000',
            borderRadius: 8,
            textDecoration: 'none',
            color: '#222',
            fontWeight: 500
          }}
        >
          {t('backToHome')}
        </a>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'linear-gradient(135deg, #fffbf0 0%, #fff8e1 50%, #ffeaa7 100%)',
      overflow: 'hidden'
    }}>
      {/* 顶部信息栏 */}
      <div style={{
        flexShrink: 0,
        background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)',
        padding: '16px 24px',
        borderBottom: '1px solid #000000',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{
            margin: '0 0 4px 0',
            fontSize: 20,
            fontWeight: 600,
            color: '#222'
          }}>
            📝 {animation.title}
          </h1>
          
          {animation.description && (
            <p style={{
              margin: '0 0 8px 0',
              fontSize: 13,
              color: '#666',
              lineHeight: 1.4
            }}>
              {animation.description}
            </p>
          )}
          
          <div style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            fontSize: 13,
            color: '#666'
          }}>
            <span style={{ color: '#ff9800' }}>❤️ {animation.like_count || 0} {t('likes')}</span>
            {animation.author_name && (
              <span style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="8" r="4" stroke="#ff9800" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 21C6 17.134 8.686 14 12 14C15.314 14 18 17.134 18 21" stroke="#ff9800" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {t('author')}{animation.author_name}
              </span>
            )}
          </div>
        </div>
        
        <a 
          href="/physics" 
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)',
            border: '1px solid #000000',
            borderRadius: 8,
            textDecoration: 'none',
            color: '#222',
            fontSize: 13,
            fontWeight: 500,
            transition: 'all 0.2s',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #fff8e1 0%, #ffeaa7 100%)';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 2px 8px rgba(255, 152, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          ← {t('backToHome')}
        </a>
      </div>

      {/* 主内容区域：画布 + 参数面板 */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: 16,
        padding: 16,
        overflow: 'hidden'
      }}>
        {/* 左侧：画布区域 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
          <div
            ref={canvasContainerRef}
            style={{
              position: 'relative',
              flex: 1,
              borderRadius: 16,
              border: '1px solid #000000',
              background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(255, 152, 0, 0.15)'
            }}
          >
            {animation.scene_data?.imagePreview && (
              <>
                <img
                  ref={imgRef}
                  src={animation.scene_data.imagePreview}
                  alt={t('animationScene')}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    borderRadius: 16,
                    pointerEvents: 'none',
                  }}
                  onLoad={handleImageLoad}
                />
                <canvas
                  ref={canvasRef}
                  onMouseUp={handleCanvasMouseUp}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: interactionMode === 'edit_path' ? 50 : 2,
                    cursor: interactionMode === 'edit_path' ? 'crosshair' : 'default',
                    pointerEvents: interactionMode === 'edit_path' ? 'auto' : 'none',
                    borderRadius: 16,
                  }}
                />
                <div
                  ref={simRef}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 1,
                    pointerEvents: 'none'
                  }}
                />
                {isPathEditMode && (
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: 'rgba(16, 185, 129, 0.9)',
                    color: '#fff',
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    zIndex: 10,
                    pointerEvents: 'auto'
                  }}>
                    <span>{t('pathEditModeHint')}</span>
                    <button
                      onClick={disablePathEdit}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(255,255,255,0.3)',
                        border: '1px solid rgba(255,255,255,0.5)',
                        borderRadius: 6,
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600
                      }}
                    >
                      {t('finishEditing')}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* 按钮 - 画布内右下角 */}
            <div style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              display: 'flex',
              gap: 12,
              zIndex: 10
            }}>
              <button
                onClick={() => handleStartSimulate()}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: '1px solid #000000',
                  background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)',
                  backdropFilter: 'blur(8px)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  boxShadow: '0 4px 12px rgba(255, 152, 0, 0.2)',
                  transition: 'all 0.2s',
                  color: '#222'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #fff8e1 0%, #ffeaa7 100%)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                {simulating ? t('reset') : t('startSimulationPlay')}
              </button>
            </div>
          </div>
        </div>

        {/* 右侧：参数调节面板 */}
        <div style={{
          width: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <PhysicsParametersPanel
            objects={assignments}
            onParametersChange={handleParametersChange}
            onGlobalParametersChange={handleGlobalParametersChange}
            globalParameters={globalParameters}
            isSimulationRunning={simulating}
          />
        </div>
      </div>
    </div>
  );
}

