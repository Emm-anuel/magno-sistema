import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Usuario } from '@/types'

// Nota: zustand se agrega al instalar dependencias.
// Si se prefiere sin zustand, usar Context + useReducer.
// Por ahora se deja como hook simple con localStorage.

interface AuthState {
  token: string | null
  usuario: Usuario | null
  isAuthenticated: boolean
  isHydrated: boolean
  login: (token: string, usuario: Usuario) => void
  logout: () => void
  setHydrated: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:           null,
      usuario:         null,
      isAuthenticated: false,
      isHydrated:      false,

      login: (token, usuario) => {
        localStorage.setItem('magno_token', token)
        set({ token, usuario, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('magno_token')
        set({ token: null, usuario: null, isAuthenticated: false })
      },

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'magno-auth',
      partialize: (s) => ({ token: s.token, usuario: s.usuario }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Sincronizar isAuthenticated desde el token persistido
          state.isAuthenticated = !!state.token
          state.setHydrated()
        }
      },
    },
  ),
)
