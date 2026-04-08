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
    const isLoginEndpoint = error.config?.url?.includes('/auth/login')

    // Solo redirigir a /login en 401 si NO es la propia petición de login
    if (error.response?.status === 401 && !isLoginEndpoint) {
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

// ── Usuarios ──────────────────────────────────────────────────────
export const usuarioService = {
  listar: (params?: { rol?: string; sucursalId?: number; activo?: boolean; page?: number; size?: number }) =>
    api.get<import('@/types').Page<import('@/types').Usuario>>('/usuarios', { params }).then((r) => r.data),

  obtener: (id: number) =>
    api.get<import('@/types').Usuario>(`/usuarios/${id}`).then((r) => r.data),

  crear: (data: import('@/types').UsuarioCreateRequest) =>
    api.post<import('@/types').Usuario>('/usuarios', data).then((r) => r.data),

  actualizar: (id: number, data: import('@/types').UsuarioUpdateRequest) =>
    api.put<import('@/types').Usuario>(`/usuarios/${id}`, data).then((r) => r.data),

  cambiarEstado: (id: number, activo: boolean) =>
    api.patch<import('@/types').Usuario>(`/usuarios/${id}/estado`, { activo }).then((r) => r.data),
}

// ── Files ─────────────────────────────────────────────────────────
export const fileService = {
  upload: (file: File, folder?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (folder) form.append('folder', folder)
    return api
      .post<{ data: { url: string } }>('/files/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data.url)
  },
}
