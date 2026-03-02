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
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { register, login, sendVerificationCode, resetPassword } from '../../api/authApi.js';
import useAuthStore from '../../store/authStore.js';
import { showToast } from '../../utils/toast.js';
import './styles.css';

export default function LoginModal({ isOpen, onClose }) {
  const { t } = useTranslation();
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
    if (!error) return t('operationFailed');
    
    // 如果是字符串，直接返回
    if (typeof error === 'string') return error;
    
    // 如果是数组（FastAPI 验证错误格式）
    if (Array.isArray(error)) {
      return error.map(e => e.msg || e.message || JSON.stringify(e)).join('; ') || t('validationFailed');
    }
    
    // 如果是对象
    if (typeof error === 'object') {
      // 尝试获取常见错误字段
      if (error.msg) return error.msg;
      if (error.message) return error.message;
      if (error.detail) return extractErrorMessage(error.detail);
      // 如果是验证错误对象
      if (error.type && error.loc) {
        return error.msg || t('fieldValidationFailed', { field: error.loc.join('.') });
      }
    }
    
    return t('operationFailed');
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
      setError(t('invalidPhone'));
      showToast.error(t('invalidPhone'));
      return;
    }

    if (codeCountdown > 0) {
      showToast.error(t('secondsLater', { count: codeCountdown }));
      return;
    }

    setSendingCode(true);
    setError('');
    try {
      // 根据模式选择场景
      const scene = mode === 'reset_password' ? 'reset_password' : 'register';
      const res = await sendVerificationCode(phoneNumber, scene);
      if (res.code === 0) {
        showToast.success(t('codeSent'));
        setCodeCountdown(60); // 60秒倒计时
      } else {
        const errorMsg = res.message || t('sendCodeFailed');
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
      setError(t('invalidPhone'));
      return;
    }
    
    if (password.length < 6) {
      setError(t('passwordMinLength'));
      return;
    }

    setLoading(true);
    try {
      const res = await login(phoneNumber, password);
      if (res.code === 0) {
        const { access_token, user } = res.data;
        loginUser(access_token, user);
        showToast.success(t('loginSuccess'));
        onClose();
        resetForm();
      } else {
        setError(res.message || t('loginFailed'));
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
      setError(t('invalidPhone'));
      return;
    }
    
    if (!verificationCode) {
      setError(t('pleaseEnterCode'));
      return;
    }
    
    if (password.length < 6) {
      setError(t('passwordMinLength'));
      return;
    }
    
    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await register(phoneNumber, password, verificationCode);
      if (res.code === 0) {
        showToast.success(t('registerSuccess'));
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setVerificationCode('');
        setCodeCountdown(0);
      } else {
        setError(res.message || t('registerFailed'));
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
      setError(t('invalidPhone'));
      return;
    }
    
    if (!verificationCode) {
      setError(t('pleaseEnterCode'));
      return;
    }
    
    if (password.length < 6) {
      setError(t('passwordMinLength'));
      return;
    }
    
    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(phoneNumber, verificationCode, password);
      if (res.code === 0) {
        showToast.success(t('resetPasswordSuccess'));
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setVerificationCode('');
        setCodeCountdown(0);
      } else {
        setError(res.message || t('resetPasswordFailed'));
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
            {mode === 'login' ? t('welcomeBack') : mode === 'register' ? t('userRegister') : t('findPassword')}
          </Dialog.Title>

          {/* 描述（用于可访问性） */}
          <Dialog.Description className="auth-description">
            {mode === 'login' 
              ? t('loginDescription') 
              : mode === 'register' 
              ? t('registerDescription') 
              : t('resetPasswordDescription')}
          </Dialog.Description>

          {/* 错误提示 */}
          {error && (
            <div className="auth-error">
              ⚠️ {error}
            </div>
          )}

          {/* 表单 */}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>{t('phoneNumber')}</label>
            <input
              type="tel"
              placeholder={t('phonePlaceholder')}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              maxLength={11}
              autoComplete="tel"
            />

            {mode !== 'reset_password' && (
              <label>{t('password')}</label>
            )}
            {mode !== 'reset_password' && (
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'login' ? t('passwordPlaceholder') : t('passwordPlaceholderNew')}
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
                <label>{t('verificationCode')}</label>
                <div className="verification-code-input">
                  <input
                    type="text"
                    placeholder={t('verificationCodePlaceholder')}
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
                    {sendingCode ? t('sending') : codeCountdown > 0 ? t('secondsLater', { count: codeCountdown }) : t('sendCode')}
                  </button>
                </div>

                {mode === 'register' && (
                  <>
                    <label>{t('confirmPassword')}</label>
                    <div className="password-input">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('confirmPasswordPlaceholder')}
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
                    <label>{t('newPassword')}</label>
                    <div className="password-input">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('newPasswordPlaceholder')}
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

                    <label>{t('confirmPassword')}</label>
                    <div className="password-input">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('confirmNewPasswordPlaceholder')}
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
                ? t('processingBtn') 
                : mode === 'login' 
                ? t('loginBtn') 
                : mode === 'register' 
                ? t('registerBtn') 
                : t('resetPasswordBtn')}
            </button>

            <p className="auth-hint">
              {mode === 'login' ? (
                <>
                  {t('noAccount')}
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setMode('register'); setError(''); resetForm(); }}
                  >
                    {t('register')}
                  </button>
                  <span style={{ margin: '0 8px', color: '#9ca3af' }}>|</span>
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setMode('reset_password'); setError(''); resetForm(); }}
                  >
                    {t('forgotPassword')}
                  </button>
                </>
              ) : mode === 'register' ? (
                <>
                  {t('hasAccount')}
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setMode('login'); setError(''); resetForm(); }}
                  >
                    {t('loginLink')}
                  </button>
                </>
              ) : (
                <>
                  {t('rememberedPassword')}
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setMode('login'); setError(''); resetForm(); }}
                  >
                    {t('backToLogin')}
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




