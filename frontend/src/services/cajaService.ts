import { api } from '@/services/api'

// ── Tipos ────────────────────────────────────────────────────────────

export interface CobroAsesorItem {
  asesorNombre: string
  cantidadCobros: number
  montoCobrado: number
}

export interface MultaAsesorItem {
  asesorNombre: string
  totalMultas: number
}

export interface CajaCierrePreview {
  cajaId: number
  montoApertura: number
  subtotalInversiones: number
  cobrosPorAsesor: CobroAsesorItem[]
  totalIngresoCarteras: number
  desembolsosCreditosNuevos: number
  desembolsosRenovaciones: number
  totalDesembolsos: number
  subtotalCaja: number
  porcentajeAhorro: number
  montoLibres: number
  total: number
  ahorroFijo: number
  totalGastos: number
  totalNomina: number
  totalRealLibres: number
  multasPorAsesor: MultaAsesorItem[]
  totalMultasCobradas: number
  multasCobrasRenovaciones: number
  totalMultasCondonadas: number
}

export interface CajaDiaResumen {
  id: number
  fecha: string
  sucursalNombre: string
  abiertaPorNombre: string
  cerradaPorNombre: string | null
  fechaHoraCierre: string | null
  subtotalCaja: number | null
  montoLibres: number | null
  total: number | null
  estado: string
}

export interface CajaEstado {
  cajaId: number | null
  estado: string | null
  bloqueado: boolean
  abiertaPorNombre: string | null
  fechaHoraApertura: string | null
  horaLimite: string
  motivoBloqueo: string | null
}

export interface MovimientoInversion {
  id: number
  conceptoInversionId: number
  conceptoNombre: string
  descripcion: string | null
  monto: number
  registradoPorId: number
  registradoPorNombre: string
  createdAt: string
}

export interface NominaPersonalItem {
  id: number
  nombre: string
  puesto: string
  montoSemanal: number
}

export interface NominaPago {
  id: number
  totalPagado: number
  registradoPorId: number
  registradoPorNombre: string
  createdAt: string
}

export interface NominaEstado {
  esDiaEfectivo: boolean
  diaEfectivo: string          // ISO date "YYYY-MM-DD"
  personal: NominaPersonalItem[]
  totalCalculado: number
  pago: NominaPago | null
}

export interface CajaDiaDetalle {
  id: number
  sucursalId: number
  sucursalNombre: string
  fecha: string
  estado: string
  montoApertura: number
  conceptoApertura: string | null
  abiertaPorId: number
  abiertaPorNombre: string
  fechaHoraApertura: string
  cerradaPorId: number | null
  cerradaPorNombre: string | null
  fechaHoraCierre: string | null
  ingresoCarteras: number | null
  desembolsos: number | null
  subtotalCaja: number | null
  montoLibres: number | null
  total: number | null
  ahorroFijo: number | null
  totalGastos: number | null
  totalNomina: number | null
  totalRealLibres: number | null
  inversiones: MovimientoInversion[]
}

// ── Normalizadores ────────────────────────────────────────────────────

function normalizeEstado(raw: any): CajaEstado {
  return {
    cajaId:              raw?.cajaId ?? null,
    estado:              raw?.estado ?? null,
    bloqueado:           raw?.bloqueado ?? true,
    abiertaPorNombre:    raw?.abiertaPorNombre ?? null,
    fechaHoraApertura:   raw?.fechaHoraApertura ?? null,
    horaLimite:          raw?.horaLimiteOperacion
                           ? String(raw.horaLimiteOperacion).substring(0, 5)
                           : '17:00',
    motivoBloqueo:       raw?.motivoBloqueo ?? null,
  }
}

function normalizeMovimiento(raw: any): MovimientoInversion {
  return {
    id:                  raw?.id,
    conceptoInversionId: raw?.conceptoInversionId,
    conceptoNombre:      raw?.conceptoNombre ?? '',
    descripcion:         raw?.descripcion ?? null,
    monto:               Number(raw?.monto ?? 0),
    registradoPorId:     raw?.registradoPorId,
    registradoPorNombre: raw?.registradoPorNombre ?? '',
    createdAt:           raw?.createdAt ?? '',
  }
}

function normalizeDetalle(raw: any): CajaDiaDetalle {
  return {
    id:                  raw?.id,
    sucursalId:          raw?.sucursalId,
    sucursalNombre:      raw?.sucursalNombre ?? '',
    fecha:               raw?.fecha ?? '',
    estado:              raw?.estado ?? '',
    montoApertura:       Number(raw?.montoApertura ?? 0),
    conceptoApertura:    raw?.conceptoApertura ?? null,
    abiertaPorId:        raw?.abiertaPorId,
    abiertaPorNombre:    raw?.abiertaPorNombre ?? '',
    fechaHoraApertura:   raw?.fechaHoraApertura ?? '',
    cerradaPorId:        raw?.cerradaPorId ?? null,
    cerradaPorNombre:    raw?.cerradaPorNombre ?? null,
    fechaHoraCierre:     raw?.fechaHoraCierre ?? null,
    ingresoCarteras:     raw?.ingresoCarteras  != null ? Number(raw.ingresoCarteras)  : null,
    desembolsos:         raw?.desembolsos      != null ? Number(raw.desembolsos)      : null,
    subtotalCaja:        raw?.subtotalCaja     != null ? Number(raw.subtotalCaja)     : null,
    montoLibres:         raw?.montoLibres      != null ? Number(raw.montoLibres)      : null,
    total:               raw?.total            != null ? Number(raw.total)            : null,
    ahorroFijo:          raw?.ahorroFijo       != null ? Number(raw.ahorroFijo)       : null,
    totalGastos:         raw?.totalGastos      != null ? Number(raw.totalGastos)      : null,
    totalNomina:         raw?.totalNomina      != null ? Number(raw.totalNomina)      : null,
    totalRealLibres:     raw?.totalRealLibres  != null ? Number(raw.totalRealLibres)  : null,
    inversiones:         (raw?.inversiones ?? []).map(normalizeMovimiento),
  }
}

// ── Servicio ──────────────────────────────────────────────────────────

export const cajaService = {
  getEstado: (sucursalId?: number): Promise<CajaEstado> =>
    api.get('/caja/estado', { params: sucursalId ? { sucursalId } : undefined })
       .then(r => normalizeEstado(r.data)),

  abrir: (payload: {
    montoApertura: number
    conceptoApertura?: string
    sucursalId?: number
  }): Promise<CajaDiaDetalle> =>
    api.post('/caja/abrir', payload).then(r => normalizeDetalle(r.data)),

  cerrar: (payload?: { sucursalId?: number; cajaId?: number }): Promise<CajaDiaDetalle> =>
    api.post('/caja/cerrar', payload ?? {}).then(r => normalizeDetalle(r.data)),

  cancelarCorte: (cajaId: number): Promise<CajaDiaDetalle> =>
    api.post(`/caja/${cajaId}/cancelar`).then(r => normalizeDetalle(r.data)),

  getHistorial: (fecha: string, sucursalId?: number): Promise<CajaDiaDetalle> =>
    api.get('/caja/historial', { params: { fecha, ...(sucursalId ? { sucursalId } : {}) } })
       .then(r => normalizeDetalle(r.data)),

  getHistorialLista: (params: {
    sucursalId?: number
    desde?: string
    hasta?: string
  }): Promise<CajaDiaResumen[]> =>
    api.get('/caja/historial/lista', { params })
       .then(r => (r.data as any[]).map(raw => ({
         id:               raw.id,
         fecha:            raw.fecha,
         sucursalNombre:   raw.sucursalNombre ?? '',
         abiertaPorNombre: raw.abiertaPorNombre ?? '',
         cerradaPorNombre: raw.cerradaPorNombre ?? null,
         fechaHoraCierre:  raw.fechaHoraCierre ?? null,
         subtotalCaja:     raw.subtotalCaja != null ? Number(raw.subtotalCaja) : null,
         montoLibres:      raw.montoLibres != null ? Number(raw.montoLibres) : null,
         total:            raw.total != null ? Number(raw.total) : null,
         estado:           raw.estado ?? '',
       }))),

  getPreviewCierre: (sucursalId?: number): Promise<CajaCierrePreview> =>
    api.get('/caja/cierre-preview', { params: sucursalId ? { sucursalId } : undefined })
       .then(r => {
         const d = r.data
         return {
           cajaId:                    d.cajaId,
           montoApertura:             Number(d.montoApertura ?? 0),
           subtotalInversiones:       Number(d.subtotalInversiones ?? 0),
           cobrosPorAsesor:           (d.cobrosPorAsesor ?? []).map((x: any) => ({
             asesorNombre:  x.asesorNombre,
             cantidadCobros: x.cantidadCobros,
             montoCobrado:  Number(x.montoCobrado ?? 0),
           })),
           totalIngresoCarteras:      Number(d.totalIngresoCarteras ?? 0),
           desembolsosCreditosNuevos: Number(d.desembolsosCreditosNuevos ?? 0),
           desembolsosRenovaciones:   Number(d.desembolsosRenovaciones ?? 0),
           totalDesembolsos:          Number(d.totalDesembolsos ?? 0),
           subtotalCaja:              Number(d.subtotalCaja ?? 0),
           porcentajeAhorro:          Number(d.porcentajeAhorro ?? 0),
           montoLibres:               Number(d.montoLibres ?? 0),
           total:                     Number(d.total ?? 0),
           ahorroFijo:                Number(d.ahorroFijo ?? 0),
           totalGastos:               Number(d.totalGastos ?? 0),
           totalNomina:               Number(d.totalNomina ?? 0),
           totalRealLibres:           Number(d.totalRealLibres ?? 0),
           multasPorAsesor:           (d.multasPorAsesor ?? []).map((x: any) => ({
             asesorNombre: x.asesorNombre,
             totalMultas:  Number(x.totalMultas ?? 0),
           })),
           totalMultasCobradas:       Number(d.totalMultasCobradas ?? 0),
           multasCobrasRenovaciones:  Number(d.multasCobrasRenovaciones ?? d.multas_cobras_renovaciones ?? 0),
           totalMultasCondonadas:     Number(d.totalMultasCondonadas ?? d.total_multas_condonadas ?? 0),
         }
       }),

  exportarPdf: async (cajaId: number, fecha: string): Promise<void> => {
    const response = await api.get(`/caja/${cajaId}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `corte-caja-${fecha}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },

  async getNominaEstado(cajaDiaId: number): Promise<NominaEstado> {
    const { data } = await api.get(`/caja/${cajaDiaId}/nomina`)
    return {
      esDiaEfectivo: data.esDiaEfectivo,
      diaEfectivo:   data.diaEfectivo,
      personal:      (data.personal ?? []).map((p: any) => ({
        id:           p.id,
        nombre:       p.nombre,
        puesto:       p.puesto,
        montoSemanal: Number(p.montoSemanal ?? 0),
      })),
      totalCalculado: Number(data.totalCalculado ?? 0),
      pago: data.pago
        ? {
            id:                  data.pago.id,
            totalPagado:         Number(data.pago.totalPagado ?? 0),
            registradoPorId:     data.pago.registradoPorId,
            registradoPorNombre: data.pago.registradoPorNombre ?? '',
            createdAt:           data.pago.createdAt,
          }
        : null,
    }
  },

  async registrarNomina(cajaDiaId: number): Promise<NominaPago> {
    const { data } = await api.post(`/caja/${cajaDiaId}/nomina`)
    return {
      id:                  data.id,
      totalPagado:         Number(data.totalPagado ?? 0),
      registradoPorId:     data.registradoPorId,
      registradoPorNombre: data.registradoPorNombre ?? '',
      createdAt:           data.createdAt,
    }
  },

  async anularNomina(cajaDiaId: number): Promise<void> {
    await api.delete(`/caja/${cajaDiaId}/nomina`)
  },
}
