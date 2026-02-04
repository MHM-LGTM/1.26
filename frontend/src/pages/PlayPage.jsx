/**
 * 动画播放页
 * ---------------------------------
 * 功能：
 * - 通过分享码加载并播放动画
 * - 精简 UI，专注于动画展示
 * - 支持手动开始模拟和重置功能
 * - 使用与主界面一致的设计风格
 * 
 * 使用：
 * 路由：/physics/play/:shareCode
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { runSimulation } from '../utils/physicsEngine.js';
import { API_BASE_URL } from '../config/api';
import { showToast } from '../utils/toast.js';

export default function PlayPage() {
  const { shareCode } = useParams();
  const [animation, setAnimation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simulationCache, setSimulationCache] = useState(null); // 缓存初始状态用于重置
  
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
          // 移除自动播放：用户需要手动点击"开始模拟"按钮
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
      
      // 从 scene_data 中提取物体数据
      // scene_data.objects 是 assignments 数组，需要转换为物理引擎需要的格式
      const assignments = sceneData.objects || [];
      
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

      // 运行模拟
      const sim = runSimulation({
        container: simRef.current,
        objects,
        constraints,
        imageRect: imgRef.current?.getBoundingClientRect?.(),
        naturalSize: sceneData.imageNaturalSize || { w: 800, h: 600 },
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
    console.log('[PlayPage] 点击重置，停止模拟并回到初始状态');
    
    // 停止当前运行的模拟
    if (runningSimulation.current) {
      runningSimulation.current.stop();
      runningSimulation.current = null;
    }
    
    // 使用缓存的数据重新创建模拟
    if (simulationCache) {
      setTimeout(() => {
        const sim = runSimulation({
          container: simRef.current,
          objects: simulationCache.objects,
          constraints: simulationCache.constraints,
          imageRect: simulationCache.imageRect,
          naturalSize: simulationCache.naturalSize,
        });
        
        runningSimulation.current = sim;
        console.log('[PlayPage] 已重置到初始状态');
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
      padding: 24,
      background: 'linear-gradient(135deg, #fffbf0 0%, #fff8e1 50%, #ffeaa7 100%)',
      minHeight: '100vh'
    }}>
      {/* 顶部信息 */}
      <div style={{
        marginBottom: 16,
        background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)',
        padding: 16,
        borderRadius: 12,
        border: '1px solid #000000'
      }}>
        <h1 style={{
          margin: '0 0 8px 0',
          fontSize: 24,
          fontWeight: 600,
          color: '#222'
        }}>
          📝 {animation.title}
        </h1>
        
        {animation.description && (
          <p style={{
            margin: '0 0 12px 0',
            fontSize: 14,
            color: '#666',
            lineHeight: 1.6
          }}>
            {animation.description}
          </p>
        )}
        
        <div style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          fontSize: 14,
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

      {/* 画布区域 */}
      <div style={{
        position: 'relative',
        marginBottom: 16
      }}>
        <div
          style={{
            position: 'relative',
            height: 480,
            maxWidth: 800,
            margin: '0 auto',
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

      {/* 底部操作 */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 12
      }}>
        <a 
          href="/physics" 
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #ffffff 0%, #fffef8 100%)',
            border: '1px solid #000000',
            borderRadius: 8,
            textDecoration: 'none',
            color: '#222',
            fontSize: 14,
            fontWeight: 500,
            transition: 'all 0.2s'
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
    </div>
  );
}

