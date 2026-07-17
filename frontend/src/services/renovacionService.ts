import { api } from './api'
import type { RenovacionCalculo, RenovacionDetalle, ColocacionesSemana, ListoRenovarItem } from '@/types'

function normalizeCalculo(raw: any): RenovacionCalculo {
  return {
    creditoAnteriorId: raw.creditoAnteriorId ?? raw.credito_anterior_id,
    montoAnterior: raw.montoAnterior ?? raw.monto_anterior,
    pagoPeriodicoAnterior: raw.pagoPeriodicoAnterior ?? raw.pago_periodico_anterior,
    plazoDiasAnterior: raw.plazoDiasAnterior ?? raw.plazo_dias_anterior,
    montoNuevo: raw.montoNuevo ?? raw.monto_nuevo,
    pagosRestantes: raw.pagosRestantes ?? raw.pagos_restantes,
    montoPagosRestantes: raw.montoPagosRestantes ?? raw.monto_pagos_restantes,
    multasPendientes: raw.multasPendientes ?? raw.multas_pendientes,
    pagoAdelantadoNuevo: raw.pagoAdelantadoNuevo ?? raw.pago_adelantado_nuevo,
    montoDesembolso: raw.montoDesembolso ?? raw.monto_desembolso,
    plazoDiasNuevo: raw.plazoDiasNuevo ?? raw.plazo_dias_nuevo,
    tasaNueva: raw.tasaNueva ?? raw.tasa_nueva,
    cargoFinancieroNuevo: raw.cargoFinancieroNuevo ?? raw.cargo_financiero_nuevo,
    totalAPagarNuevo: raw.totalAPagarNuevo ?? raw.total_a_pagar_nuevo,
    pagoPeriodicoNuevo: raw.pagoPeriodicoNuevo ?? raw.pago_periodico_nuevo,
    puedeAumentarMonto: raw.puedeAumentarMonto ?? raw.puede_aumentar_monto ?? true,
    advertenciaMonto: raw.advertenciaMonto ?? raw.advertencia_monto ?? null,
  }
}

function normalizeDetalle(raw: any): RenovacionDetalle {
  return {
    id: raw.id,
    cliente: {
      id: raw.cliente?.id,
      nombreCompleto: raw.cliente?.nombreCompleto ?? raw.cliente?.nombre_completo,
      celular: raw.cliente?.celular,
    },
    asesor: {
      id: raw.asesor?.id,
      nombreCompleto: raw.asesor?.nombreCompleto ?? raw.asesor?.nombre_completo,
      sucursalNombre: raw.asesor?.sucursalNombre ?? raw.asesor?.sucursal_nombre ?? '',
    },
    creditoAnterior: raw.creditoAnterior ?? raw.credito_anterior,
    creditoNuevo: raw.creditoNuevo ?? raw.credito_nuevo ?? null,
    fecha: raw.fecha,
    estado: raw.estado ?? 'APROBADO',
    aprobadoPor: raw.aprobadoPor ?? raw.aprobado_por ?? null,
    fechaAprobacion: raw.fechaAprobacion ?? raw.fecha_aprobacion ?? null,
    motivoRechazo: raw.motivoRechazo ?? raw.motivo_rechazo ?? null,
    montoNuevo: raw.montoNuevo ?? raw.monto_nuevo,
    montoAprobado: raw.montoAprobado ?? raw.monto_aprobado ?? null,
    confirmadoPor: raw.confirmadoPor ?? raw.confirmado_por ?? null,
    fechaConfirmacion: raw.fechaConfirmacion ?? raw.fecha_confirmacion ?? null,
    tipoPago: raw.tipoPago ?? raw.tipo_pago,
    pagosRestantes: raw.pagosRestantes ?? raw.pagos_restantes,
    montoPagosRestantes: raw.montoPagosRestantes ?? raw.monto_pagos_restantes,
    multasPendientes: raw.multasPendientes ?? raw.multas_pendientes,
    multasCondonadas: Number(raw.multasCondonadas ?? raw.multas_condonadas ?? 0),
    motivoCondonacion: raw.motivoCondonacion ?? raw.motivo_condonacion ?? null,
    multasCondonadasDetalle: (raw.multasCondonadasDetalle ?? raw.multas_condonadas_detalle ?? []).map((c: any) => ({
      id: c.id,
      monto: Number(c.monto),
      tipo: c.tipo,
      fecha: c.fecha,
      motivoCondonacion: c.motivoCondonacion ?? c.motivo_condonacion ?? null,
      condonadaPorNombre: c.condonadaPorNombre ?? c.condonada_por_nombre ?? null,
      fechaCondonacion: c.fechaCondonacion ?? c.fecha_condonacion ?? null,
    })),
    pagoAdelantado: raw.pagoAdelantado ?? raw.pago_adelantado,
    montoDesembolso: raw.montoDesembolso ?? raw.monto_desembolso,
    garantiaDescripcion: raw.garantiaDescripcion ?? raw.garantia_descripcion ?? null,
    videoEntregaUrl: raw.videoEntregaUrl ?? raw.video_entrega_url ?? null,
    evidenciaUrls: raw.evidenciaUrls ?? raw.evidencia_urls ?? [],
    createdAt: raw.createdAt ?? raw.created_at,
  }
}

function normalizeColocaciones(raw: any): ColocacionesSemana {
  return {
    semanaInicio: raw.semanaInicio ?? raw.semana_inicio,
    semanaFin: raw.semanaFin ?? raw.semana_fin,
    items: (raw.items ?? []).map((item: any) => ({
      fecha: item.fecha,
      clienteNombre: item.clienteNombre ?? item.cliente_nombre,
      clienteId: item.clienteId ?? item.cliente_id,
      creditoAnterior: item.creditoAnterior ?? item.credito_anterior ?? null,
      creditoNuevo: item.creditoNuevo ?? item.credito_nuevo,
      desembolso: item.desembolso,
      asesorNombre: item.asesorNombre ?? item.asesor_nombre,
      sucursalNombre: item.sucursalNombre ?? item.sucursal_nombre,
      tipoPago: item.tipoPago ?? item.tipo_pago ?? 'DIARIO',
      tipo: item.tipo,
      refId: item.refId ?? item.ref_id,
    })),
    totalDesembolsos: raw.totalDesembolsos ?? raw.total_desembolsos,
  }
}

function normalizeListoItem(raw: any): ListoRenovarItem {
  return {
    clienteId: raw.clienteId ?? raw.cliente_id,
    clienteNombre: raw.clienteNombre ?? raw.cliente_nombre,
    creditoId: raw.creditoId ?? raw.credito_id,
    montoCapital: raw.montoCapital ?? raw.monto_capital,
    plazoDias: raw.plazoDias ?? raw.plazo_dias,
    pagoPeriodico: raw.pagoPeriodico ?? raw.pago_periodico,
    tipoPago: raw.tipoPago ?? raw.tipo_pago ?? 'DIARIO',
    asesorId: raw.asesorId ?? raw.asesor_id,
    asesorNombre: raw.asesorNombre ?? raw.asesor_nombre,
    sucursalId: raw.sucursalId ?? raw.sucursal_id,
    sucursalNombre: raw.sucursalNombre ?? raw.sucursal_nombre,
    pagosRealizados: raw.pagosRealizados ?? raw.pagos_realizados,
    pagosRestantes: raw.pagosRestantes ?? raw.pagos_restantes,
    multasPendientes: raw.multasPendientes ?? raw.multas_pendientes ?? 0,
    pagosVencidos: raw.pagosVencidos ?? raw.pagos_vencidos ?? 0,
  }
}

export const renovacionService = {
  calcular: (creditoId: number, montoNuevo: number, tipoPago?: 'DIARIO' | 'SEMANAL'): Promise<RenovacionCalculo> =>
    api.get('/renovaciones/calcular', { params: { creditoId, montoNuevo, tipoPago } })
      .then((r) => normalizeCalculo(r.data)),

  crear: (data: {
    creditoAnteriorId: number
    montoNuevo: number
    tipoPago: string
    garantiaDescripcion?: string
    evidenciaUrls?: string[]
    videoEntregaUrl?: string
  }): Promise<RenovacionDetalle> =>
    api.post('/renovaciones', {
      creditoAnteriorId: data.creditoAnteriorId,
      montoNuevo: data.montoNuevo,
      tipoPago: data.tipoPago,
      garantiaDescripcion: data.garantiaDescripcion,
      evidenciaUrls: data.evidenciaUrls,
      videoEntregaUrl: data.videoEntregaUrl,
    }).then((r) => normalizeDetalle(r.data)),

  aprobar: (id: number, payload: {
    montoAprobado?: number | null,
    multasCondonadasIds?: number[],
    motivoCondonacion?: string,
  }): Promise<RenovacionDetalle> =>
    api.patch(`/renovaciones/${id}/aprobar`, payload)
      .then((r) => normalizeDetalle(r.data)),

  getMultasPendientes: (renovacionId: number): Promise<import('@/types').MultaItem[]> =>
    api.get(`/renovaciones/${renovacionId}/multas-pendientes`)
      .then(r => (r.data ?? []).map((m: any) => ({
        id: m.id,
        creditoId: m.creditoId ?? m.credito_id,
        clienteId: m.clienteId ?? m.cliente_id,
        pagoId: m.pagoId ?? m.pago_id ?? null,
        tipo: m.tipo,
        monto: Number(m.monto),
        fecha: m.fecha,
        cobrada: Boolean(m.cobrada),
        cobradaEnPagoId: m.cobradaEnPagoId ?? m.cobrada_en_pago_id ?? null,
        condonada: Boolean(m.condonada),
        condonadaEnRenovacionId: m.condonadaEnRenovacionId ?? m.condonada_en_renovacion_id ?? null,
        condonadaPorNombre: m.condonadaPorNombre ?? m.condonada_por_nombre ?? null,
        fechaCondonacion: m.fechaCondonacion ?? m.fecha_condonacion ?? null,
        motivoCondonacion: m.motivoCondonacion ?? m.motivo_condonacion ?? null,
      }))),

  confirmarDesembolso: (renovacionId: number, videoEntregaUrl?: string): Promise<RenovacionDetalle> =>
    api.patch(`/renovaciones/${renovacionId}/confirmar-desembolso`, {
      videoEntregaUrl: videoEntregaUrl ?? null,
    }).then((r) => normalizeDetalle(r.data)),

  getPendientesDesembolso: (): Promise<RenovacionDetalle[]> =>
    api.get('/renovaciones/pendientes-desembolso')
      .then((r) => (r.data as any[]).map(normalizeDetalle)),

  rechazar: (renovacionId: number, motivo?: string): Promise<RenovacionDetalle> =>
    api.patch(`/renovaciones/${renovacionId}/rechazar`, { motivo: motivo ?? '' })
      .then((r) => normalizeDetalle(r.data)),

  getPendientes: (params?: { asesorId?: number; sucursalId?: number }): Promise<RenovacionDetalle[]> =>
    api.get('/renovaciones/pendientes', { params })
      .then((r) => (r.data as any[]).map(normalizeDetalle)),

  getColocaciones: (params?: {
    semanaInicio?: string
    asesorId?: number
    sucursalId?: number
  }): Promise<ColocacionesSemana> =>
    api.get('/renovaciones/colocaciones', { params }).then((r) => normalizeColocaciones(r.data)),

  exportarPdfUrl: (params?: { semanaInicio?: string; asesorId?: number; sucursalId?: number }): string => {
    const base = '/api/renovaciones/colocaciones/pdf'
    const qs = new URLSearchParams()
    if (params?.semanaInicio) qs.set('semanaInicio', params.semanaInicio)
    if (params?.asesorId) qs.set('asesorId', String(params.asesorId))
    if (params?.sucursalId) qs.set('sucursalId', String(params.sucursalId))
    return `${base}?${qs.toString()}`
  },

  getListosRenovar: (params?: {
    asesorId?: number
    sucursalId?: number
  }): Promise<ListoRenovarItem[]> =>
    api.get('/renovaciones/listos', { params })
      .then((r) => (r.data as any[]).map(normalizeListoItem)),

  getMisSolicitudes: (): Promise<RenovacionDetalle[]> =>
    api.get('/renovaciones/mis-solicitudes')
      .then((r) => (r.data as any[]).map(normalizeDetalle)),
}
