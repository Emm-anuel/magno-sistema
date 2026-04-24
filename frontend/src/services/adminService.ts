import { api } from '@/services/api'

// ── Tipos ────────────────────────────────────────────────────────────

export interface AdminConfigSucursal {
  sucursalId: number
  horaLimiteOperacion: string   // "HH:mm:ss"
  porcentajeAhorro: number      // 0.24 = 24%
  montoAhorroFijo: number
  diaPagoNomina: string
}

export interface AdminConfigMulta {
  id: number
  sucursalId: number
  rangoMin: number
  rangoMax: number
  multaNoPago: number
  multaIncompletos: number
  multaSemanalNoPago: number
  multaSemanalIncompletos: number
}

export interface AdminRangoCredito {
  id?: number
  tipoPago: 'DIARIO' | 'SEMANAL'
  rangoMin: number
  rangoMax: number
  plazo: number
  tasaInteres: number           // 0.30 = 30%
}

export interface AdminNomina {
  id: number
  nombre: string
  puesto: string
  montoSemanal: number
}

export interface AdminConcepto {
  id: number
  nombre: string
}

export interface BitacoraConfigItem {
  id: number
  createdAt: string
  usuarioNombre: string | null
  sucursalNombre: string | null
  seccion: string
  campo: string
  valorAnterior: string | null
  valorNuevo: string | null
}

export interface PageResult<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
}

// ── Normalizadores ────────────────────────────────────────────────────

function normalizeConfig(raw: any): AdminConfigSucursal {
  return {
    sucursalId:            raw?.sucursalId   ?? 0,
    horaLimiteOperacion:   raw?.horaLimiteOperacion ?? '17:00:00',
    porcentajeAhorro:      Number(raw?.porcentajeAhorro ?? 0),
    montoAhorroFijo:       Number(raw?.montoAhorroFijo  ?? 0),
    diaPagoNomina:         raw?.diaPagoNomina ?? '',
  }
}

function normalizeMulta(raw: any): AdminConfigMulta {
  return {
    id:                       raw?.id,
    sucursalId:               raw?.sucursalId,
    rangoMin:                 Number(raw?.rangoMin                ?? 0),
    rangoMax:                 Number(raw?.rangoMax                ?? 0),
    multaNoPago:              Number(raw?.multaNoPago             ?? 0),
    multaIncompletos:         Number(raw?.multaIncompletos        ?? 0),
    multaSemanalNoPago:       Number(raw?.multaSemanalNoPago      ?? 0),
    multaSemanalIncompletos:  Number(raw?.multaSemanalIncompletos ?? 0),
  }
}

function normalizeRango(raw: any): AdminRangoCredito {
  return {
    id:          raw?.id,
    tipoPago:    raw?.tipoPago,
    rangoMin:    Number(raw?.rangoMin    ?? 0),
    rangoMax:    Number(raw?.rangoMax    ?? 0),
    plazo:       Number(raw?.plazo       ?? 0),
    tasaInteres: Number(raw?.tasaInteres ?? 0),
  }
}

function normalizeNomina(raw: any): AdminNomina {
  return {
    id:           raw?.id,
    nombre:       raw?.nombre       ?? '',
    puesto:       raw?.puesto       ?? '',
    montoSemanal: Number(raw?.montoSemanal ?? 0),
  }
}

function normalizeConcepto(raw: any): AdminConcepto {
  return { id: raw?.id, nombre: raw?.nombre ?? '' }
}

// ── Servicio ──────────────────────────────────────────────────────────

export const adminService = {
  // Config general
  getConfig: (sucursalId: number) =>
    api.get<any>(`/admin/sucursales/${sucursalId}/config`)
       .then(r => normalizeConfig(r.data)),

  saveConfig: (sucursalId: number, payload: {
    horaLimiteOperacion: string
    porcentajeAhorro: number
    montoAhorroFijo: number
    diaPagoNomina: string
  }) =>
    api.put<any>(`/admin/sucursales/${sucursalId}/config`, payload)
       .then(r => normalizeConfig(r.data)),

  // Multas
  getMultas: (sucursalId: number) =>
    api.get<any[]>(`/admin/sucursales/${sucursalId}/multas`)
       .then(r => r.data.map(normalizeMulta)),

  saveMulta: (sucursalId: number, multaId: number, payload: {
    rangoMin: number; rangoMax: number
    multaNoPago: number; multaIncompletos: number
    multaSemanalNoPago: number; multaSemanalIncompletos: number
  }) =>
    api.put<any>(`/admin/sucursales/${sucursalId}/multas/${multaId}`, payload)
       .then(r => normalizeMulta(r.data)),

  // Rangos crédito
  getRangos: (sucursalId: number) =>
    api.get<any[]>(`/admin/sucursales/${sucursalId}/rangos`)
       .then(r => r.data.map(normalizeRango)),

  saveRangos: (sucursalId: number, payload: {
    diario: Array<{ rangoMin: number; rangoMax: number; plazo: number; tasaInteres: number }>
    semanal: Array<{ rangoMin: number; rangoMax: number; plazo: number; tasaInteres: number }>
  }) =>
    api.put<any[]>(`/admin/sucursales/${sucursalId}/rangos`, payload)
       .then(r => r.data.map(normalizeRango)),

  // Nómina personal
  getNomina: (sucursalId: number) =>
    api.get<any[]>(`/admin/sucursales/${sucursalId}/nomina`)
       .then(r => r.data.map(normalizeNomina)),

  crearNomina: (sucursalId: number, payload: { nombre: string; puesto: string; montoSemanal: number }) =>
    api.post<any>(`/admin/sucursales/${sucursalId}/nomina`, payload)
       .then(r => normalizeNomina(r.data)),

  actualizarNomina: (sucursalId: number, id: number, payload: { nombre: string; puesto: string; montoSemanal: number }) =>
    api.put<any>(`/admin/sucursales/${sucursalId}/nomina/${id}`, payload)
       .then(r => normalizeNomina(r.data)),

  eliminarNomina: (sucursalId: number, id: number) =>
    api.delete(`/admin/sucursales/${sucursalId}/nomina/${id}`),

  // Días inhábiles (globales — sin sucursalId)
  getDiasInhabiles: () =>
    api.get<any[]>('/admin/dias-inhabiles').then(r =>
      r.data.map(d => ({ id: d.id as number, fecha: d.fecha as string, descripcion: d.descripcion as string }))
    ),

  crearDiaInhabil: (payload: { fecha: string; descripcion: string }) =>
    api.post<any>('/admin/dias-inhabiles', payload).then(r =>
      ({ id: r.data.id as number, fecha: r.data.fecha as string, descripcion: r.data.descripcion as string })
    ),

  actualizarDiaInhabil: (id: number, payload: { fecha: string; descripcion: string }) =>
    api.put<any>(`/admin/dias-inhabiles/${id}`, payload).then(r =>
      ({ id: r.data.id as number, fecha: r.data.fecha as string, descripcion: r.data.descripcion as string })
    ),

  eliminarDiaInhabil: (id: number) =>
    api.delete(`/admin/dias-inhabiles/${id}`),

  // Conceptos de inversión
  getConceptos: (sucursalId: number) =>
    api.get<any[]>(`/admin/sucursales/${sucursalId}/conceptos`)
       .then(r => r.data.map(normalizeConcepto)),

  crearConcepto: (sucursalId: number, payload: { nombre: string }) =>
    api.post<any>(`/admin/sucursales/${sucursalId}/conceptos`, payload)
       .then(r => normalizeConcepto(r.data)),

  actualizarConcepto: (sucursalId: number, id: number, payload: { nombre: string }) =>
    api.put<any>(`/admin/sucursales/${sucursalId}/conceptos/${id}`, payload)
       .then(r => normalizeConcepto(r.data)),

  eliminarConcepto: (sucursalId: number, id: number) =>
    api.delete(`/admin/sucursales/${sucursalId}/conceptos/${id}`),

  // Bitácora de configuración
  getBitacora: (params: {
    sucursalId?: number
    seccion?: string
    desde?: string
    hasta?: string
    page?: number
    size?: number
  }) => {
    const p: Record<string, string> = {}
    if (params.sucursalId !== undefined) p.sucursalId = String(params.sucursalId)
    if (params.seccion)    p.seccion    = params.seccion
    if (params.desde)      p.desde      = params.desde
    if (params.hasta)      p.hasta      = params.hasta
    if (params.page  !== undefined) p.page  = String(params.page)
    if (params.size  !== undefined) p.size  = String(params.size)
    return api.get<PageResult<BitacoraConfigItem>>(
      '/admin/bitacora',
      { params: p }
    ).then(r => r.data)
  },
}
