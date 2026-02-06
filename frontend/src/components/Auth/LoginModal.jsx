/**
 * 登录/注册模态框
 * ---------------------------------
 * 功能：
 * - 登录和注册在同一个弹窗中
 * - 支持手机号格式校验
 * - 密码显示/隐藏切换
 * - 实时表单验证
 */

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { register, login, sendVerificationCode, resetPassword } from '../../api/authApi.js';
import useAuthStore from '../../store/authStore.js';
import { showToast } from '../../utils/toast.js';
import './styles.css';

export default function LoginModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset_password'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  const loginUser = useAuthStore((state) => state.login);

  // 校验手机号
  const validatePhone = (phone) => /^1[3-9]\d{9}$/.test(phone);

  // 提取错误消息的辅助函数
  const extractErrorMessage = (error) => {
    if (!error) return '操作失败，请重试';
    
    // 如果是字符串，直接返回
    if (typeof error === 'string') return error;
    
    // 如果是数组（FastAPI 验证错误格式）
    if (Array.isArray(error)) {
      return error.map(e => e.msg || e.message || JSON.stringify(e)).join('；') || '验证失败，请检查输入';
    }
    
    // 如果是对象
    if (typeof error === 'object') {
      // 尝试获取常见错误字段
      if (error.msg) return error.msg;
      if (error.message) return error.message;
      if (error.detail) return extractErrorMessage(error.detail);
      // 如果是验证错误对象
      if (error.type && error.loc) {
        return error.msg || `字段 ${error.loc.join('.')} 验证失败`;
      }
    }
    
    return '操作失败，请重试';
  };

  // 倒计时效果
  useEffect(() => {
    if (codeCountdown > 0) {
      const timer = setTimeout(() => {
        setCodeCountdown(codeCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [codeCountdown]);

  // 发送验证码
  const handleSendCode = async () => {
    if (!validatePhone(phoneNumber)) {
      setError('请输入正确的手机号');
      showToast.error('请输入正确的手机号');
      return;
    }

    if (codeCountdown > 0) {
      showToast.error(`请${codeCountdown}秒后再试`);
      return;
    }

    setSendingCode(true);
    setError('');
    try {
      // 根据模式选择场景
      const scene = mode === 'reset_password' ? 'reset_password' : 'register';
      const res = await sendVerificationCode(phoneNumber, scene);
      if (res.code === 0) {
        showToast.success('验证码已发送，请注意查收');
        setCodeCountdown(60); // 60秒倒计时
      } else {
        const errorMsg = res.message || '发送验证码失败';
        setError(errorMsg);
        showToast.error(errorMsg);
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      const errorMessage = extractErrorMessage(errorDetail);
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setSendingCode(false);
    }
  };

  // 提交登录
  const handleLogin = async () => {
    setError('');
    
    if (!validatePhone(phoneNumber)) {
      setError('请输入正确的手机号');
      return;
    }
    
    if (password.length < 6) {
      setError('密码至少需要6位');
      return;
    }

    setLoading(true);
    try {
      const res = await login(phoneNumber, password);
      if (res.code === 0) {
        const { access_token, user } = res.data;
        loginUser(access_token, user);
        showToast.success('登录成功');
        onClose();
        resetForm();
      } else {
        setError(res.message || '登录失败');
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      const errorMessage = extractErrorMessage(errorDetail);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 提交注册
  const handleRegister = async () => {
    setError('');
    
    if (!validatePhone(phoneNumber)) {
      setError('请输入正确的手机号');
      return;
    }
    
    if (!verificationCode) {
      setError('请输入验证码');
      return;
    }
    
    if (password.length < 6) {
      setError('密码至少需要6位');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const res = await register(phoneNumber, password, verificationCode);
      if (res.code === 0) {
        showToast.success('注册成功，请登录');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setVerificationCode('');
        setCodeCountdown(0);
      } else {
        setError(res.message || '注册失败');
      }
    } catch (err) {
      // 安全地提取错误消息，确保始终是字符串
      const errorDetail = err.response?.data?.detail;
      const errorMessage = extractErrorMessage(errorDetail);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 提交重置密码
  const handleResetPassword = async () => {
    setError('');
    
    if (!validatePhone(phoneNumber)) {
      setError('请输入正确的手机号');
      return;
    }
    
    if (!verificationCode) {
      setError('请输入验证码');
      return;
    }
    
    if (password.length < 6) {
      setError('密码至少需要6位');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(phoneNumber, verificationCode, password);
      if (res.code === 0) {
        showToast.success('密码重置成功，请登录');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setVerificationCode('');
        setCodeCountdown(0);
      } else {
        setError(res.message || '密码重置失败');
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      const errorMessage = extractErrorMessage(errorDetail);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPhoneNumber('');
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setError('');
    setCodeCountdown(0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'login') {
      handleLogin();
    } else if (mode === 'register') {
      handleRegister();
    } else if (mode === 'reset_password') {
      handleResetPassword();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="auth-modal-overlay" />
        <Dialog.Content className="auth-modal-content">
          <Dialog.Close className="auth-modal-close">✕</Dialog.Close>

          {/* 标题 */}
          <Dialog.Title className="auth-title">
            {mode === 'login' ? '欢迎回来' : mode === 'register' ? '用户注册' : '找回密码'}
          </Dialog.Title>

          {/* 描述（用于可访问性） */}
          <Dialog.Description className="auth-description">
            {mode === 'login' 
              ? '请输入您的手机号和密码登录' 
              : mode === 'register' 
              ? '请填写以下信息完成注册' 
              : '请输入手机号和验证码重置密码'}
          </Dialog.Description>

          {/* 错误提示 */}
          {error && (
            <div className="auth-error">
              ⚠️ {error}
            </div>
          )}

          {/* 表单 */}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>手机号</label>
            <input
              type="tel"
              placeholder="请输入手机号"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              maxLength={11}
              autoComplete="tel"
            />

            {mode !== 'reset_password' && (
              <label>密码</label>
            )}
            {mode !== 'reset_password' && (
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'login' ? '请输入密码' : '请输入密码（至少6位）'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="toggle-password"
                tabIndex={-1}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            )}

            {(mode === 'register' || mode === 'reset_password') && (
              <>
                <label>验证码</label>
                <div className="verification-code-input">
                  <input
                    type="text"
                    placeholder="请输入验证码"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    className="send-code-btn"
                    onClick={handleSendCode}
                    disabled={codeCountdown > 0 || sendingCode || !validatePhone(phoneNumber)}
                  >
                    {sendingCode ? '发送中...' : codeCountdown > 0 ? `${codeCountdown}秒` : '发送验证码'}
                  </button>
                </div>

                {mode === 'register' && (
                  <>
                    <label>确认密码</label>
                    <div className="password-input">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请再次输入密码"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="toggle-password"
                        tabIndex={-1}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {showPassword ? (
                            <>
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </>
                          ) : (
                            <>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                  </>
                )}

                {mode === 'reset_password' && (
                  <>
                    <label>新密码</label>
                    <div className="password-input">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入新密码（至少6位）"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="toggle-password"
                        tabIndex={-1}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {showPassword ? (
                            <>
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </>
                          ) : (
                            <>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>

                    <label>确认密码</label>
                    <div className="password-input">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请再次输入新密码"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="toggle-password"
                        tabIndex={-1}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {showPassword ? (
                            <>
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </>
                          ) : (
                            <>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading 
                ? '处理中...' 
                : mode === 'login' 
                ? '登 录' 
                : mode === 'register' 
                ? '注 册' 
                : '重置密码'}
            </button>

            <p className="auth-hint">
              {mode === 'login' ? (
                <>
                  还没有账号？
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setMode('register'); setError(''); resetForm(); }}
                  >
                    注册
                  </button>
                  <span style={{ margin: '0 8px', color: '#9ca3af' }}>|</span>
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setMode('reset_password'); setError(''); resetForm(); }}
                  >
                    忘记密码
                  </button>
                </>
              ) : mode === 'register' ? (
                <>
                  已有账号？
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setMode('login'); setError(''); resetForm(); }}
                  >
                    登录
                  </button>
                </>
              ) : (
                <>
                  想起密码了？
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setMode('login'); setError(''); resetForm(); }}
                  >
                    返回登录
                  </button>
                </>
              )}
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}




