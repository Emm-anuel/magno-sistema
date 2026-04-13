import { api } from './api'
import type { CreditoResumen, CreditoDetalle, CalendarioPagoDetalle, ProductoCalculo, Page } from '@/types'

export const creditoService = {
  listar: (params?: {
    clienteId?: number
    asesorId?: number
    sucursalId?: number
    estado?: string
    page?: number
    size?: number
  }) =>
    api.get<Page<CreditoResumen>>('/creditos', { params }).then((r) => r.data),

  obtener: (id: number) =>
    api.get<CreditoDetalle>(`/creditos/${id}`).then((r) => r.data),

  getCalendario: (id: number) =>
    api.get<CalendarioPagoDetalle[]>(`/creditos/${id}/calendario`).then((r) => r.data),

  calcularProducto: (capital: number) =>
    api.get<ProductoCalculo>('/creditos/calcular', { params: { capital } }).then((r) => r.data),

  crearSolicitud: (data: {
    clienteId: number
    asesorId: number
    sucursalId: number
    montoSolicitado: number
    tipoPago: string
    garantiaDescripcion?: string
    evidenciaUrls?: string[]
    lugar?: string
  }) =>
    api.post<CreditoDetalle>('/creditos', data).then((r) => r.data),

  aprobarCredito: (id: number, data: { montoAprobado: number; observaciones?: string }) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/aprobar`, data).then((r) => r.data),

  activarCredito: (id: number) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/activar`).then((r) => r.data),

  subirVideoEntrega: (id: number, videoEntregaUrl: string) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/video-entrega`, { videoEntregaUrl }).then((r) => r.data),

  cancelarCredito: (id: number, motivo: string) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/cancelar`, { motivo }).then((r) => r.data),

  getCreditosCliente: (clienteId: number) =>
    api.get<CreditoResumen[]>(`/creditos/cliente/${clienteId}`).then((r) => r.data),
}
