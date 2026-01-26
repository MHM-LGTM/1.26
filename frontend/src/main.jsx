/**
 * 应用入口（ReactDOM 挂载）
 * ---------------------------------
 * 功能：
 * - 创建 React 根节点并挂载 App 组件；
 * - 引入 BrowserRouter 以支持路由切换（/physics 与 /math）。
 * - 全局引入基础样式（components/styles.css）。
 *
 * 后续扩展：
 * - 可集成全局状态管理（如 Zustand/Redux），在此处注入 Provider。
 * - 可增加错误边界、主题 Provider、国际化等。
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './components/styles.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
    <Toaster 
      position="top-center"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#363636',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        error: {
          duration: 4000,
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      }}
    />
  </BrowserRouter>
);