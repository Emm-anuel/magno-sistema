import { api } from './api'
import type { CreditoResumen, CreditoDetalle, CalendarioPagoDetalle, ProductoCalculo, Page, RenovacionVinculo } from '@/types'

function normalizeProductoCalculo(raw: any): ProductoCalculo {
  return {
    capital: raw.capital,
    plazo: raw.plazo ?? raw.plazo_dias,
    tasa: raw.tasa ?? raw.tasa_interes,
    cargoFinanciero: raw.cargoFinanciero ?? raw.cargo_financiero,
    totalAPagar: raw.totalAPagar ?? raw.total_a_pagar,
    pagoPeriodico: raw.pagoPeriodico ?? raw.pago_periodico,
    pagoAdelantado: raw.pagoAdelantado ?? raw.pago_adelantado,
    descripcionProducto: raw.descripcionProducto ?? raw.descripcion_producto,
    tipoPago: raw.tipoPago ?? raw.tipo_pago,
  }
}

function normalizeCreditoResumen(raw: any): CreditoResumen {
  const cliente = raw.cliente ?? {}
  const asesor = raw.asesor ?? {}
  const sucursal = raw.sucursal ?? {}

  return {
    id: raw.id,
    cliente: {
      id: cliente.id,
      nombreCompleto: cliente.nombreCompleto ?? cliente.nombre_completo,
      celular: cliente.celular,
    },
    asesor: {
      id: asesor.id,
      nombreCompleto: asesor.nombreCompleto ?? asesor.nombre_completo,
    },
    sucursal: {
      id: sucursal.id,
      nombre: sucursal.nombre,
    },
    montoSolicitado: raw.montoSolicitado ?? raw.monto_solicitado ?? raw.montoCapital ?? raw.monto_capital,
    montoCapital: raw.montoCapital ?? raw.monto_capital,
    montoAprobado: raw.montoAprobado ?? raw.monto_aprobado,
    pagoPeriodico: raw.pagoPeriodico ?? raw.pago_periodico,
    plazoDias: raw.plazoDias ?? raw.plazo_dias,
    tipoPago: raw.tipoPago ?? raw.tipo_pago,
    tipo: raw.tipo ?? 'NUEVO',
    estado: raw.estado,
    fechaInicio: raw.fechaInicio ?? raw.fecha_inicio,
    fechaVencimiento: raw.fechaVencimiento ?? raw.fecha_vencimiento,
    pagosRealizados: raw.pagosRealizados ?? raw.pagos_realizados ?? 0,
    totalPagos: raw.totalPagos ?? raw.total_pagos ?? 0,
    tieneVideoEntrega: raw.tieneVideoEntrega ?? raw.tiene_video_entrega ?? false,
    createdAt: raw.createdAt ?? raw.created_at,
    pagosVencidos: raw.pagosVencidos ?? raw.pagos_vencidos ?? 0,
    multasPendientes: raw.multasPendientes ?? raw.multas_pendientes ?? 0,
  }
}

function normalizeCreditoPage(raw: any): Page<CreditoResumen> {
  return {
    content: (raw.content ?? []).map(normalizeCreditoResumen),
    total_elements: raw.total_elements ?? raw.totalElements ?? 0,
    total_pages: raw.total_pages ?? raw.totalPages ?? 0,
    number: raw.number ?? 0,
    size: raw.size ?? 0,
    totalElements: raw.totalElements ?? raw.total_elements,
    totalPages: raw.totalPages ?? raw.total_pages,
  }
}

function normalizeCalendarioItem(item: any): CalendarioPagoDetalle {
  return {
    id: item.id,
    numeroPago: item.numeroPago ?? item.numero_pago,
    fechaProgramada: item.fechaProgramada ?? item.fecha_programada,
    montoEsperado: item.montoEsperado ?? item.monto_esperado,
    estado: item.estado,
  }
}

function normalizeRenovacionVinculo(raw: any): RenovacionVinculo {
  return {
    renovacionId: raw.renovacionId ?? raw.renovacion_id,
    fechaRenovacion: raw.fechaRenovacion ?? raw.fecha_renovacion,
    pagosRestantes: raw.pagosRestantes ?? raw.pagos_restantes,
    montoPagosRestantes: raw.montoPagosRestantes ?? raw.monto_pagos_restantes,
    montoDesembolso: raw.montoDesembolso ?? raw.monto_desembolso,
    creditoVinculadoId: raw.creditoVinculadoId ?? raw.credito_vinculado_id,
    montoCapitalVinculado: raw.montoCapitalVinculado ?? raw.monto_capital_vinculado,
  }
}

function normalizeCreditoDetalle(raw: any): CreditoDetalle {
  const cliente = raw.cliente ?? {}
  const asesor = raw.asesor ?? {}
  const sucursal = raw.sucursal ?? {}
  const aprobadoPor = raw.aprobadoPor ?? raw.aprobado_por
  const estadisticasRaw = raw.estadisticas ?? {}
  const liquidadoRaw = raw.liquidadoPorRenovacion ?? raw.liquidado_por_renovacion
  const origenRaw = raw.originadoPorRenovacion ?? raw.originado_por_renovacion

  return {
    id: raw.id,
    cliente: {
      id: cliente.id,
      nombreCompleto: cliente.nombreCompleto ?? cliente.nombre_completo,
      celular: cliente.celular,
    },
    asesor: {
      id: asesor.id,
      nombreCompleto: asesor.nombreCompleto ?? asesor.nombre_completo,
    },
    sucursal: {
      id: sucursal.id,
      nombre: sucursal.nombre,
    },
    montoSolicitado: raw.montoSolicitado ?? raw.monto_solicitado ?? raw.montoCapital ?? raw.monto_capital,
    montoCapital: raw.montoCapital ?? raw.monto_capital,
    tasaInteres: raw.tasaInteres ?? raw.tasa_interes,
    cargoFinanciero: raw.cargoFinanciero ?? raw.cargo_financiero,
    totalAPagar: raw.totalAPagar ?? raw.total_a_pagar,
    pagoPeriodico: raw.pagoPeriodico ?? raw.pago_periodico,
    plazoDias: raw.plazoDias ?? raw.plazo_dias,
    tipoPago: raw.tipoPago ?? raw.tipo_pago,
    tipo: raw.tipo ?? 'NUEVO',
    fechaInicio: raw.fechaInicio ?? raw.fecha_inicio,
    fechaVencimiento: raw.fechaVencimiento ?? raw.fecha_vencimiento,
    pagoAdelantado: raw.pagoAdelantado ?? raw.pago_adelantado,
    garantiaDescripcion: raw.garantiaDescripcion ?? raw.garantia_descripcion,
    evidenciaUrls: raw.evidenciaUrls ?? raw.evidencia_urls ?? [],
    lugar: raw.lugar,
    estado: raw.estado,
    montoAprobado: raw.montoAprobado ?? raw.monto_aprobado,
    observaciones: raw.observaciones,
    fechaAprobacion: raw.fechaAprobacion ?? raw.fecha_aprobacion,
    aprobadoPor: aprobadoPor
      ? {
          id: aprobadoPor.id,
          nombreCompleto: aprobadoPor.nombreCompleto ?? aprobadoPor.nombre_completo,
        }
      : null,
    fechaDesembolso: raw.fechaDesembolso ?? raw.fecha_desembolso,
    videoEntregaUrl: raw.videoEntregaUrl ?? raw.video_entrega_url,
    createdAt: raw.createdAt ?? raw.created_at,
    updatedAt: raw.updatedAt ?? raw.updated_at,
    calendario: (raw.calendario ?? []).map(normalizeCalendarioItem),
    estadisticas: {
      pagosRealizados: estadisticasRaw.pagosRealizados ?? estadisticasRaw.pagos_realizados ?? 0,
      pagosPendientes: estadisticasRaw.pagosPendientes ?? estadisticasRaw.pagos_pendientes ?? 0,
      pagosVencidos: estadisticasRaw.pagosVencidos ?? estadisticasRaw.pagos_vencidos ?? 0,
      multasPendientes: estadisticasRaw.multasPendientes ?? estadisticasRaw.multas_pendientes ?? 0,
      elegibleRenovacion: estadisticasRaw.elegibleRenovacion ?? estadisticasRaw.elegible_renovacion ?? false,
    },
    liquidadoPorRenovacion: liquidadoRaw ? normalizeRenovacionVinculo(liquidadoRaw) : null,
    originadoPorRenovacion: origenRaw ? normalizeRenovacionVinculo(origenRaw) : null,
  }
}

export const creditoService = {
  listar: (params?: {
    clienteId?: number
    asesorId?: number
    sucursalId?: number
    estado?: string
    buscar?: string
    page?: number
    size?: number
  }): Promise<Page<CreditoResumen>> =>
    api.get('/creditos', { params }).then((r) => normalizeCreditoPage(r.data)),

  obtener: (id: number): Promise<CreditoDetalle> =>
    api.get(`/creditos/${id}`).then((r) => normalizeCreditoDetalle(r.data)),

  getCalendario: (id: number) =>
    api.get<CalendarioPagoDetalle[]>(`/creditos/${id}/calendario`).then((r) => r.data),

  calcularProducto: (capital: number, tipoPago?: 'DIARIO' | 'SEMANAL') =>
    api.get('/creditos/calcular', { params: { capital, tipoPago } }).then((r) => normalizeProductoCalculo(r.data)),

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
    api.post<CreditoDetalle>('/creditos', {
      clienteId: data.clienteId,
      asesorId: data.asesorId,
      sucursalId: data.sucursalId,
      montoSolicitado: data.montoSolicitado,
      tipoPago: data.tipoPago,
      garantiaDescripcion: data.garantiaDescripcion,
      evidenciaUrls: data.evidenciaUrls,
      lugar: data.lugar,
    }).then((r) => normalizeCreditoDetalle(r.data)),

  actualizarSolicitud: (id: number, data: {
    asesorId: number
    montoSolicitado: number
    tipoPago: string
    garantiaDescripcion?: string
    evidenciaUrls?: string[]
    lugar?: string
  }) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/solicitud`, {
      asesorId: data.asesorId,
      montoSolicitado: data.montoSolicitado,
      tipoPago: data.tipoPago,
      garantiaDescripcion: data.garantiaDescripcion,
      evidenciaUrls: data.evidenciaUrls,
      lugar: data.lugar,
    }).then((r) => normalizeCreditoDetalle(r.data)),

  aprobarCredito: (id: number, data: { montoAprobado: number; observaciones?: string }) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/aprobar`, {
      montoAprobado: data.montoAprobado,
      observaciones: data.observaciones,
    }).then((r) => normalizeCreditoDetalle(r.data)),

  activarCredito: (id: number) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/activar`).then((r) => normalizeCreditoDetalle(r.data)),

  subirVideoEntrega: (id: number, videoEntregaUrl: string) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/video-entrega`, { videoEntregaUrl }).then((r) => normalizeCreditoDetalle(r.data)),

  cancelarCredito: (id: number, motivo: string) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/cancelar`, { motivo }).then((r) => normalizeCreditoDetalle(r.data)),

  revertirDesembolso: (id: number, motivo: string) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/revertir-desembolso`, { motivo }).then((r) => normalizeCreditoDetalle(r.data)),

  getCreditosCliente: (clienteId: number): Promise<CreditoResumen[]> =>
    api.get(`/creditos/cliente/${clienteId}`).then((r) =>
      (r.data ?? []).map(normalizeCreditoResumen),
    ),
}
