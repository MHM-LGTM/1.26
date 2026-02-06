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

export default function PlayPage() {
  const { shareCode } = useParams();
  const [animation, setAnimation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simulationCache, setSimulationCache] = useState(null); // 缓存初始状态用于重置
  const [assignments, setAssignments] = useState([]); // 物体数据（用于参数调节）
  const [globalParameters, setGlobalParameters] = useState({ timeScale: 1.0 }); // 全局参数
  
  const imgRef = useRef(null);
  const simRef = useRef(null);
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
          setError(data.message || '动画不存在或链接已失效');
        }
      } catch (err) {
        console.error('加载动画失败:', err);
        setError('加载失败，请检查网络连接');
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
      showToast.error('模拟失败：' + err.message);
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
        <p style={{ fontSize: 18, color: '#222' }}>加载中...</p>
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
          返回首页
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
            <span style={{ color: '#ff9800' }}>❤️ {animation.like_count || 0} 点赞</span>
            {animation.author_name && (
              <span style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="8" r="4" stroke="#ff9800" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 21C6 17.134 8.686 14 12 14C15.314 14 18 17.134 18 21" stroke="#ff9800" strokeWidth="2" strokeLinecap="round" />
                </svg>
                作者：{animation.author_name}
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
          ← 返回首页
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
                  alt="动画场景"
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
                {simulating ? '🔄 重置' : '▶️ 开始模拟'}
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

