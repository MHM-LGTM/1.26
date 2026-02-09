/**
 * 网站底部备案信息组件
 * ---------------------------------
 * 功能：
 * - 显示ICP备案号和公安备案号
 * - 符合中国互联网管理规定
 */

import React from 'react';

export default function Footer() {
  return (
    <footer className="site-footer" style={{ pointerEvents: 'none' }}>
      <div className="footer-decorator">
        <div className="footer-dot"></div>
      </div>
      <div className="beian-info" style={{ pointerEvents: 'auto' }}>
        <a 
          href="https://beian.miit.gov.cn/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="beian-link"
        >
          滇ICP备2026002078号-1
        </a>
        <span className="divider">|</span>
        <a 
          href="https://beian.mps.gov.cn/#/query/webSearch?code=53010202002287" 
          target="_blank" 
          rel="noopener noreferrer"
          className="beian-link"
        >
          <img src="/beian-icon.png" alt="公安备案" className="beian-icon" />
          滇公网安备53010202002287号
        </a>
      </div>
    </footer>
  );
}
