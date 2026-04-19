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
    },
    creditoAnterior: raw.creditoAnterior ?? raw.credito_anterior,
    creditoNuevo: raw.creditoNuevo ?? raw.credito_nuevo,
    fecha: raw.fecha,
    pagosRestantes: raw.pagosRestantes ?? raw.pagos_restantes,
    montoPagosRestantes: raw.montoPagosRestantes ?? raw.monto_pagos_restantes,
    multasPendientes: raw.multasPendientes ?? raw.multas_pendientes,
    pagoAdelantado: raw.pagoAdelantado ?? raw.pago_adelantado,
    montoDesembolso: raw.montoDesembolso ?? raw.monto_desembolso,
    salidaDe: raw.salidaDe ?? raw.salida_de,
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
      tipo: item.tipo,
      salidaDe: item.salidaDe ?? item.salida_de ?? null,
      refId: item.refId ?? item.ref_id,
    })),
    totalDesembolsos: raw.totalDesembolsos ?? raw.total_desembolsos,
    totalCaja: raw.totalCaja ?? raw.total_caja,
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
    asesorId: raw.asesorId ?? raw.asesor_id,
    asesorNombre: raw.asesorNombre ?? raw.asesor_nombre,
    sucursalId: raw.sucursalId ?? raw.sucursal_id,
    sucursalNombre: raw.sucursalNombre ?? raw.sucursal_nombre,
    pagosRealizados: raw.pagosRealizados ?? raw.pagos_realizados,
    pagosRestantes: raw.pagosRestantes ?? raw.pagos_restantes,
    multasPendientes: raw.multasPendientes ?? raw.multas_pendientes ?? 0,
  }
}

export const renovacionService = {
  calcular: (creditoId: number, montoNuevo: number): Promise<RenovacionCalculo> =>
    api.get('/renovaciones/calcular', { params: { creditoId, montoNuevo } })
      .then((r) => normalizeCalculo(r.data)),

  crear: (data: {
    creditoAnteriorId: number
    montoNuevo: number
    tipoPago: string
    salidaDe: 'CAJA' | 'RUTA'
    garantiaDescripcion?: string
    evidenciaUrls?: string[]
    videoEntregaUrl?: string
  }): Promise<RenovacionDetalle> =>
    api.post('/renovaciones', {
      creditoAnteriorId: data.creditoAnteriorId,
      montoNuevo: data.montoNuevo,
      tipoPago: data.tipoPago,
      salidaDe: data.salidaDe,
      garantiaDescripcion: data.garantiaDescripcion,
      evidenciaUrls: data.evidenciaUrls,
      videoEntregaUrl: data.videoEntregaUrl,
    }).then((r) => normalizeDetalle(r.data)),

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
}
