import axios from 'axios'
import type { AuthResponse, ApiError } from '@/types'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

// ── Interceptor de request: adjuntar JWT ─────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('magno_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Interceptor de response: manejo de errores ───────────────────
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('magno_token')
      window.location.href = '/login'
    }
    const apiError: ApiError = {
      status:    error.response?.status ?? 0,
      message:   error.response?.data?.message ?? 'Error de conexión',
      timestamp: new Date().toISOString(),
    }
    return Promise.reject(apiError)
  },
)

// ── Auth ──────────────────────────────────────────────────────────
export const authService = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),

  logout: () =>
    api.post('/auth/logout').catch(() => {}),
}

// ── Files ─────────────────────────────────────────────────────────
export const fileService = {
  upload: (file: File, folder?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (folder) form.append('folder', folder)
    return api
      .post<{ url: string }>('/files/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.url)
  },
}
