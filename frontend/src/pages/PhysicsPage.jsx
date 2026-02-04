/**
 * 物理模拟页面
 * ---------------------------------
 * 功能：
 * - 顶部显示模式切换按钮和登录状态；
 * - 中部区域承载 PhysicsInputBox 或 ElectricInputBox 组件（根据场景类型切换）。
 * - 集成登录/注册功能
 * 
 * 2026-02-01 更新：
 * - 新增电学场景支持，通过 sceneType 状态切换画布组件
 * - 电学场景使用独立的 ElectricInputBox 组件（不依赖 Matter.js）
 */

import React, { useState, useRef } from 'react';
import PhysicsInputBox from '../components/PhysicsInputBox.jsx';
import ElectricInputBox from '../components/ElectricInputBox.jsx';
import MyAnimationsPanel from '../components/MyAnimationsPanel.jsx';
import PlazaPanel from '../components/PlazaPanel.jsx';
import LoginModal from '../components/Auth/LoginModal.jsx';
import UserMenu from '../components/Auth/UserMenu.jsx';
import AboutMenu from '../components/AboutMenu.jsx';
import useAuthStore from '../store/authStore.js';

export default function PhysicsPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [plazaAnimationInfo, setPlazaAnimationInfo] = useState(null); // 广场动画信息
  const [currentAnimationSource, setCurrentAnimationSource] = useState(null); // 'my' | 'plaza' | null
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  
  // 场景类型：'mechanics' (运动学/力学) | 'electric' (电学)
  const [sceneType, setSceneType] = useState('mechanics');
  
  // 用于访问 PhysicsInputBox 或 ElectricInputBox 的加载函数
  const physicsBoxRef = useRef(null);
  const electricBoxRef = useRef(null);

  // 处理动画加载
  const handleLoadAnimation = (sceneData, plazaAnimationId = null) => {
    console.log('[PhysicsPage] 接收到加载请求，scene_data keys:', Object.keys(sceneData || {}));
    console.log('[PhysicsPage] plazaAnimationId:', plazaAnimationId);
    console.log('[PhysicsPage] 当前场景类型:', sceneType);
    
    // 根据当前场景类型，将 sceneData 传递给对应的组件
    if (sceneType === 'mechanics') {
      if (physicsBoxRef.current?.loadAnimation) {
        physicsBoxRef.current.loadAnimation(sceneData, plazaAnimationId);
      } else {
        console.error('[PhysicsPage] physicsBoxRef.current.loadAnimation 不存在');
      }
    } else {
      if (electricBoxRef.current?.loadAnimation) {
        electricBoxRef.current.loadAnimation(sceneData, plazaAnimationId);
      } else {
        console.error('[PhysicsPage] electricBoxRef.current.loadAnimation 不存在');
      }
    }
  };

  // 处理广场动画加载（显示信息区）
  const handlePlazaAnimationLoad = (animationInfo) => {
    console.log('[PhysicsPage] 广场动画信息:', animationInfo);
    setPlazaAnimationInfo(animationInfo);
    setCurrentAnimationSource('plaza'); // 标记为广场动画
  };

  return (
    <div className="page-wrapper">
      <div className="topbar">
        {/* 左上角：场景切换按钮 */}
        <div className="topbar-left">
          {/* 场景类型切换按钮 */}
          <div className="scene-selector">
            <button
              className={`scene-btn ${sceneType === 'mechanics' ? 'active' : ''}`}
              onClick={() => setSceneType('mechanics')}
            >
              运动学/力学
            </button>
            <button
              className={`scene-btn ${sceneType === 'electric' ? 'active' : ''}`}
              onClick={() => setSceneType('electric')}
            >
              电学
            </button>
          </div>
        </div>
        
        {/* 右上角：登录状态与关于 */}
        <div className="topbar-right">
          {isLoggedIn ? (
            <UserMenu />
          ) : (
            <button
              className="login-btn"
              onClick={() => setShowLoginModal(true)}
            >
              登录 / 注册
            </button>
          )}
          <AboutMenu />
        </div>
      </div>

      {/* 根据场景类型渲染不同的画布组件 */}
      {sceneType === 'mechanics' ? (
        <PhysicsInputBox 
          ref={physicsBoxRef}
          animationSource={currentAnimationSource}
          plazaAnimationInfo={plazaAnimationInfo}
          onClosePlazaInfo={() => setPlazaAnimationInfo(null)}
        />
      ) : (
        <ElectricInputBox 
          ref={electricBoxRef}
          animationSource={currentAnimationSource}
          plazaAnimationInfo={plazaAnimationInfo}
          onClosePlazaInfo={() => setPlazaAnimationInfo(null)}
        />
      )}

      {/* 阶段二新增：我的动画面板 */}
      <MyAnimationsPanel 
        onLoadAnimation={(sceneData) => {
          handleLoadAnimation(sceneData);
          setPlazaAnimationInfo(null); // 加载我的动画时，清除广场信息
          setCurrentAnimationSource('my'); // 标记为我的动画
        }}
        onUploadClick={() => {
          // 根据当前场景类型触发对应组件的上传功能
          if (sceneType === 'mechanics') {
            if (physicsBoxRef.current?.triggerUpload) {
              physicsBoxRef.current.triggerUpload();
            }
          } else {
            if (electricBoxRef.current?.triggerUpload) {
              electricBoxRef.current.triggerUpload();
            }
          }
        }}
      />

      {/* 阶段三新增：动画广场面板 */}
      <PlazaPanel 
        onLoadAnimation={handleLoadAnimation}
        onPlazaAnimationLoad={handlePlazaAnimationLoad}
      />

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}