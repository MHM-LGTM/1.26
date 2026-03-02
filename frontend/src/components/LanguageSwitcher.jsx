import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');

  const toggle = () => {
    i18n.changeLanguage(isZh ? 'en' : 'zh');
  };

  return (
    <button className="lang-switcher-btn" onClick={toggle} title={isZh ? 'Switch to English' : '切换到中文'}>
      {isZh ? 'EN' : '中'}
    </button>
  );
}
