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

export interface GastoReporte {
  fecha: string
  categoria: string
  concepto: string
  monto: number
}

export interface InversionReporte {
  fecha: string
  concepto: string
  descripcion: string | null
  monto: number
}

export interface ReporteIngresosEgresos {
  filas: FilaDiaria[]
  totalMontoApertura: number
  totalIngresoCarteras: number
  totalDesembolsos: number
  totalGastos: number
  totalNomina: number
  subtotalNeto: number
  gastosDetalle: GastoReporte[]
  inversionesDetalle: InversionReporte[]
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

export interface ReporteClientesItem {
  id: number
  numeroCliente: string | null
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string | null
  nombreCompleto: string
  fechaNacimiento: string | null
  genero: string | null
  estadoCivil: string
  nombreConyuge: string | null
  telefonoFijo: string | null
  celular: string
  ineTipo: string | null
  ineNumero: string
  curp: string
  rfc: string | null
  domCalle: string
  domNoExterior: string
  domNoInterior: string | null
  domColonia: string
  domMunicipio: string
  domEstado: string
  domCodigoPostal: string
  domTipoVivienda: string | null
  domMontoRenta: number | null
  negocioNombre: string | null
  negocioGiro: string | null
  negocioAntiguedad: string | null
  negocioDireccion: string | null
  negocioCalle: string | null
  negocioNoExterior: string | null
  negocioNoInterior: string | null
  negocioColonia: string | null
  negocioMunicipio: string | null
  negocioEstado: string | null
  negocioCp: string | null
  negocioTipoLocal: string | null
  negocioMontoRenta: number | null
  negocioHorarios: string | null
  negocioLat: number | null
  negocioLng: number | null
  ingresosSemanales: number | null
  gastosSemanales: number | null
  gastosRenta: number | null
  gastosOtros: number | null
  ref1Nombre: string
  ref1Telefono: string
  ref1Parentesco: string
  ref2Nombre: string
  ref2Telefono: string
  ref2Parentesco: string
  avalNombre: string | null
  avalTelefono: string | null
  avalDireccion: string | null
  avalIdentificacion: string | null
  asesorNombre: string
  sucursalNombre: string
  estadoCliente: string
  fechaAlta: string
  fechaActualizacion: string
  creditoId: number | null
  tipoCredito: string | null
  tipoPago: string | null
  montoCredito: number | null
  montoSolicitado: number | null
  tasaInteres: number | null
  cargoFinanciero: number | null
  totalAPagar: number | null
  pagoPeriodico: number | null
  plazoDias: number | null
  fechaInicio: string | null
  fechaVencimiento: string | null
  estadoCredito: string | null
}

export interface ReporteClientes {
  clientes: ReporteClientesItem[]
  total: number
  totalActivos: number
  totalEnMora: number
  totalSinCredito: number
  totalInactivos: number
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

  getClientes: (sucursalId: number, asesorId?: number, estado = 'TODOS'): Promise<ReporteClientes> =>
    api.get<any>('/reportes/clientes', { params: { sucursalId, asesorId, estado } })
      .then(r => norm(r.data) as ReporteClientes),

  exportClientesPdf: (sucursalId: number, asesorId?: number, estado = 'TODOS') =>
    downloadPdf('/reportes/clientes/pdf', { sucursalId, asesorId, estado }, 'clientes.pdf'),

  exportClientesExcel: (sucursalId: number, asesorId?: number, estado = 'TODOS') =>
    downloadExcel('/reportes/clientes/excel', { sucursalId, asesorId, estado }, 'clientes.xlsx'),
}
