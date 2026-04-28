import { api } from '@/services/api'

export interface DashboardKpis {
  cobros: number
  creditosActivos: number
  multas: number
  porcentajeAhorro: number
  montoAhorro: number
  montoAhorroFijo: number
  desembolsos: number
  creditosEnMora: number
}

export interface DashboardCobroPendiente {
  creditoId: number
  clienteNombre: string
  asesorNombre: string
  montoEsperado: number
  estado: string
}

export interface DashboardRenovacion {
  renovacionId: number
  clienteNombre: string
  creditoNuevo: number
  montoDesembolso: number
  fecha: string
}

export interface DashboardAsesorIngreso {
  asesorId: number
  asesorNombre: string
  ingresoCarteras: number
  desembolsos: number
  multas: number
  clientesActivos: number
}

export interface DashboardResponse {
  kpis: DashboardKpis
  cobrosPendientes: DashboardCobroPendiente[]
  renovaciones: DashboardRenovacion[]
  ingresoPorAsesor: DashboardAsesorIngreso[]
}

function norm(raw: any): any {
  if (Array.isArray(raw)) return raw.map(norm)
  if (raw && typeof raw === 'object') {
    const out: any = {}
    for (const [k, v] of Object.entries(raw)) {
      const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      out[camel] = norm(v)
    }
    return out
  }
  return raw
}

export const dashboardService = {
  getDashboard: (params: {
    sucursalId?: number | null
    asesorId?: number
    desde: string
    hasta: string
  }): Promise<DashboardResponse> =>
    api
      .get('/dashboard', { params })
      .then(r => norm(r.data) as DashboardResponse),
}
