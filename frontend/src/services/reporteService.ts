import { api } from '@/services/api'

export interface FilaDiaria {
  fecha: string
  montoApertura: number
  ingresoCarteras: number
  desembolsos: number
  gastos: number
  nomina: number
  inversiones: number
  subtotalCaja: number
}

export interface ReporteIngresosEgresos {
  filas: FilaDiaria[]
  totalMontoApertura: number
  totalIngresoCarteras: number
  totalDesembolsos: number
  totalGastos: number
  totalNomina: number
  subtotalNeto: number
}

export interface ColocacionFila {
  fecha: string
  clienteNombre: string
  clienteId: number
  creditoAnterior: number | null
  creditoNuevo: number
  desembolso: number
  asesorNombre: string
  tipoPago: string
  tipo: string
  refId: number
}

export interface ReporteColocaciones {
  items: ColocacionFila[]
  totalDesembolsos: number
  totalCaja: number
}

export interface CreditoActivo {
  creditoId: number
  clienteNombre: string
  asesorNombre: string
  montoCapital: number
  pagosRealizados: number
  pagosTotal: number
  saldoPendiente: number
  multasPendientes: number
  enMora: boolean
}

export interface ReporteCartera {
  totalCreditosActivos: number
  montoTotalColocado: number
  creditosEnMora: number
  montoEnRiesgo: number
  creditos: CreditoActivo[]
}

export interface AsesorResumen {
  asesorId: number
  asesorNombre: string
  cobrosRegistrados: number
  montoCobrado: number
  multasCobradas: number
  pagosIncompletos: number
  clientesActivos: number
  montoTotalColocado: number
  clientesEnMora: number
  montoEnRiesgo: number
}

export interface ReportePorAsesor {
  asesores: AsesorResumen[]
  totalCobrosRegistrados: number
  totalMontoCobrado: number
  totalMultasCobradas: number
  totalClientesActivos: number
  totalMontoColocado: number
  totalClientesEnMora: number
}

export interface Sucursal {
  id: number
  nombre: string
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

async function downloadPdf(url: string, params: Record<string, any>, filename: string) {
  const response = await api.get(url, { params, responseType: 'blob' })
  const href = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

async function downloadExcel(url: string, params: Record<string, any>, filename: string) {
  const response = await api.get(url, { params, responseType: 'blob' })
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const href = URL.createObjectURL(new Blob([response.data], { type: mime }))
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export const reporteService = {
  getSucursales: (): Promise<Sucursal[]> =>
    api.get<any[]>('/sucursales').then(r => r.data.map((s: any) => ({ id: s.id, nombre: s.nombre }))),

  getIngresosEgresos: (sucursalId: number, desde: string, hasta: string): Promise<ReporteIngresosEgresos> =>
    api.get<any>('/reportes/ingresos-egresos', { params: { sucursalId, desde, hasta } })
      .then(r => norm(r.data) as ReporteIngresosEgresos),

  exportIngresosEgresosPdf: (sucursalId: number, desde: string, hasta: string) =>
    downloadPdf('/reportes/ingresos-egresos/pdf', { sucursalId, desde, hasta },
      `ingresos-egresos-${desde}-${hasta}.pdf`),

  getColocaciones: (sucursalId: number, desde: string, hasta: string, asesorId?: number): Promise<ReporteColocaciones> =>
    api.get<any>('/reportes/colocaciones', { params: { sucursalId, desde, hasta, asesorId } })
      .then(r => norm(r.data) as ReporteColocaciones),

  exportColocacionesPdf: (sucursalId: number, desde: string, hasta: string, asesorId?: number) =>
    downloadPdf('/reportes/colocaciones/pdf', { sucursalId, desde, hasta, asesorId },
      `colocaciones-${desde}-${hasta}.pdf`),

  getCartera: (sucursalId: number, asesorId?: number, estado = 'TODOS'): Promise<ReporteCartera> =>
    api.get<any>('/reportes/cartera', { params: { sucursalId, asesorId, estado } })
      .then(r => norm(r.data) as ReporteCartera),

  exportCarteraPdf: (sucursalId: number, asesorId?: number, estado = 'TODOS') =>
    downloadPdf('/reportes/cartera/pdf', { sucursalId, asesorId, estado }, 'cartera.pdf'),

  getPorAsesor: (sucursalId: number, desde: string, hasta: string, asesorId?: number): Promise<ReportePorAsesor> =>
    api.get<any>('/reportes/por-asesor', { params: { sucursalId, desde, hasta, asesorId } })
      .then(r => norm(r.data) as ReportePorAsesor),

  exportPorAsesorPdf: (sucursalId: number, desde: string, hasta: string, asesorId?: number) =>
    downloadPdf('/reportes/por-asesor/pdf', { sucursalId, desde, hasta, asesorId },
      `por-asesor-${desde}-${hasta}.pdf`),

  exportIngresosEgresosExcel: (sucursalId: number, desde: string, hasta: string) =>
    downloadExcel('/reportes/ingresos-egresos/excel', { sucursalId, desde, hasta },
      `ingresos-egresos-${desde}-${hasta}.xlsx`),

  exportColocacionesExcel: (sucursalId: number, desde: string, hasta: string, asesorId?: number) =>
    downloadExcel('/reportes/colocaciones/excel', { sucursalId, desde, hasta, asesorId },
      `colocaciones-${desde}-${hasta}.xlsx`),

  exportCarteraExcel: (sucursalId: number, asesorId?: number, estado = 'TODOS') =>
    downloadExcel('/reportes/cartera/excel', { sucursalId, asesorId, estado }, 'cartera.xlsx'),

  exportPorAsesorExcel: (sucursalId: number, desde: string, hasta: string, asesorId?: number) =>
    downloadExcel('/reportes/por-asesor/excel', { sucursalId, desde, hasta, asesorId },
      `por-asesor-${desde}-${hasta}.xlsx`),
}
