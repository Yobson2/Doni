import { create } from 'zustand'
import type { components } from '@/api/schema'

type AuthUser = components['schemas']['UserResponseDto']
type Session = components['schemas']['SessionResponseDto']

interface AuthState {
  auth: {
    user: AuthUser | null
    /**
     * Held in memory only (ADR 0011): never written to localStorage,
     * sessionStorage or a cookie. A reload gets a new one by silent refresh.
     */
    accessToken: string
    setSession: (session: Session) => void
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    user: null,
    accessToken: '',
    setSession: ({ accessToken, user }) =>
      set((state) => ({ auth: { ...state.auth, accessToken, user } })),
    reset: () =>
      set((state) => ({
        auth: { ...state.auth, accessToken: '', user: null },
      })),
  },
}))
