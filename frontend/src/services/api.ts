import axios from 'axios'
import type { AuthResponse, ApiError, ClienteDocumentoDTO } from '@/types'

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

    // Spring Boot puede devolver el error en varios formatos
    const data = error.response?.data
    const message =
      (typeof data === 'object' && data !== null)
        ? (data.message ?? data.error ?? data.detail ?? JSON.stringify(data))
        : (typeof data === 'string' ? data : 'Error de conexión')

    const apiError: ApiError = {
      status:    error.response?.status ?? 0,
      message,
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

// ── Clientes ─────────────────────────────────────────────────────
export const clienteService = {
  listar: (params?: {
    buscar?: string
    estado?: string
    asesorId?: number
    sucursalId?: number
    activo?: boolean
    page?: number
    size?: number
  }) =>
    api.get<import('@/types').Page<import('@/types').ClienteResumen>>('/clientes', { params }).then((r) => r.data),

  obtener: (id: number) =>
    api.get<import('@/types').ClienteDetalle>(`/clientes/${id}`).then((r) => r.data),

  crear: (data: import('@/types').ClienteCreateRequest) =>
    api.post<import('@/types').ClienteDetalle>('/clientes', data).then((r) => r.data),

  actualizar: (id: number, data: import('@/types').ClienteUpdateRequest) =>
    api.put<import('@/types').ClienteDetalle>(`/clientes/${id}`, data).then((r) => r.data),

  cambiarEstado: (id: number, activo: boolean, motivo?: string) =>
    api.patch<import('@/types').ClienteResumen>(`/clientes/${id}/estado`, { activo, motivo }).then((r) => r.data),

  verificarCurp: (curp: string, excludeId?: number) =>
    api.get<{ disponible: boolean }>('/clientes/verificar-curp', { params: { curp, excludeId } })
       .then((r) => r.data.disponible),

  verificarCelular: (celular: string, excludeId?: number) =>
    api.get<{ disponible: boolean }>('/clientes/verificar-celular', { params: { celular, excludeId } })
       .then((r) => r.data.disponible),

  historial: (id: number) =>
    api.get<any[]>(`/clientes/${id}/historial`).then((r) => r.data),

  listarDocumentos: (clienteId: number) =>
    api.get<ClienteDocumentoDTO[]>(`/clientes/${clienteId}/documentos`).then((r) => r.data),

  agregarDocumento: (clienteId: number, tipo: string, url: string, nombre?: string) =>
    api.post<ClienteDocumentoDTO>(`/clientes/${clienteId}/documentos`, { tipo, url, nombre }).then((r) => r.data),

  eliminarDocumento: (clienteId: number, docId: number) =>
    api.delete(`/clientes/${clienteId}/documentos/${docId}`),
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
