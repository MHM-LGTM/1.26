/**
 * 用户认证状态管理（Zustand）
 * ---------------------------------
 * 功能：
 * - 管理用户登录状态
 * - 存储 JWT Token 和用户信息
 * - 提供登录、退出登录方法
 * - 使用 localStorage 持久化状态
 *
 * 使用：
 * import useAuthStore from '@/store/authStore';
 * 
 * const { isLoggedIn, user, token, login, logout } = useAuthStore();
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      // 状态
      token: null,
      user: null,
      isLoggedIn: false,
      membership: null, // 会员信息

      // 登录
      login: (token, user) => {
        set({
          token,
          user,
          isLoggedIn: true,
        });
      },

      // 退出登录
      logout: () => {
        set({
          token: null,
          user: null,
          isLoggedIn: false,
          membership: null,
        });
      },

      // 更新用户信息
      updateUser: (user) => {
        set({ user });
      },

      // 更新会员信息
      updateMembership: (membership) => {
        set({ membership });
      },
    }),
    {
      name: 'auth-storage', // localStorage 中的 key
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isLoggedIn: state.isLoggedIn,
        membership: state.membership,
      }),
    }
  )
);

export default useAuthStore;




