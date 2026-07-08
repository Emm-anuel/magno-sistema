import { api } from '@/services/api'
import type {
  RutaDia,
  ClienteRuta,
  PagoRegistrarRequest,
  PagoModificarRequest,
  PagoCobroDTO,
  MultaCobroDTO,
  AbonoCorrienteDTO,
  AbonoCorrienteHistorialDTO,
  AbonoCorrienteRequest,
  Page,
} from '@/types'

function normalizeClienteRuta(raw: any): ClienteRuta {
  return {
    clienteId: raw.clienteId ?? raw.cliente_id,
    nombreCompleto: raw.nombreCompleto ?? raw.nombre_completo,
    celular: raw.celular,
    negocioNombre: raw.negocioNombre ?? raw.negocio_nombre,
    asesorId: raw.asesorId ?? raw.asesor_id ?? null,
    asesorNombre:
      raw.asesorNombre ?? raw.asesor_nombre ?? raw.asesor ?? null,
    creditoId: raw.creditoId ?? raw.credito_id,
    montoCapital: raw.montoCapital ?? raw.monto_capital,
    pagoPeriodico: raw.pagoPeriodico ?? raw.pago_periodico,
    tipoPago: raw.tipoPago ?? raw.tipo_pago ?? 'DIARIO',
    numeroPagoHoy: raw.numeroPagoHoy ?? raw.numero_pago_hoy ?? null,
    totalPagos: raw.totalPagos ?? raw.total_pagos ?? 0,
    estadoHoy: raw.estadoHoy ?? raw.estado_hoy,
    montoRecibidoHoy: raw.montoRecibidoHoy ?? raw.monto_recibido_hoy ?? null,
    multasPendientes: raw.multasPendientes ?? raw.multas_pendientes ?? 0,
    razonNoPago: raw.razonNoPago ?? raw.razon_no_pago ?? null,
    pagoIdHoy: raw.pagoIdHoy ?? raw.pago_id_hoy ?? null,
    tieneAdeudoPendiente: raw.tieneAdeudoPendiente ?? raw.tiene_adeudo_pendiente ?? false,
  }
}

function normalizeRutaDia(raw: any): RutaDia {
  const asesor = raw.asesor ?? {}
  const resumen = raw.resumen ?? {}

  return {
    asesor: {
      id: asesor.id,
      nombreCompleto: asesor.nombreCompleto ?? asesor.nombre_completo,
    },
    fecha: raw.fecha,
    clientes: (raw.clientes ?? []).map(normalizeClienteRuta),
    resumen: {
      totalClientes: resumen.totalClientes ?? resumen.total_clientes ?? 0,
      cobrados: resumen.cobrados ?? 0,
      noPagaron: resumen.noPagaron ?? resumen.no_pagaron ?? 0,
      sinRegistrar: resumen.sinRegistrar ?? resumen.sin_registrar ?? 0,
      inhabiles: resumen.inhabiles ?? 0,
      totalCaja: resumen.totalCaja ?? resumen.total_caja ?? 0,
      totalRuta: resumen.totalRuta ?? resumen.total_ruta ?? 0,
      totalMultasCobradas:
        resumen.totalMultasCobradas ?? resumen.total_multas_cobradas ?? 0,
    },
  }
}

function normalizePago(raw: any): PagoCobroDTO {
  const cliente = raw.cliente ?? {}
  const registradoPor = raw.registradoPor ?? raw.registrado_por
  const modificadoPor = raw.modificadoPor ?? raw.modificado_por

  return {
    id: raw.id,
    creditoId: raw.creditoId ?? raw.credito_id,
    cliente: {
      id: cliente.id,
      nombreCompleto: cliente.nombreCompleto ?? cliente.nombre_completo,
    },
    numeroPago: raw.numeroPago ?? raw.numero_pago,
    fechaPago: raw.fechaPago ?? raw.fecha_pago,
    montoRecibido: raw.montoRecibido ?? raw.monto_recibido,
    montoEsperado: raw.montoEsperado ?? raw.monto_esperado,
    esCompleto: raw.esCompleto ?? raw.es_completo,
    razonNoPago: raw.razonNoPago ?? raw.razon_no_pago ?? null,
    multaAplicada: raw.multaAplicada ?? raw.multa_aplicada ?? 0,
    tipoPago: raw.tipoPago ?? raw.tipo_pago ?? 'DIARIO',
    registradoPor: registradoPor
      ? {
          id: registradoPor.id,
          nombreCompleto:
            registradoPor.nombreCompleto ?? registradoPor.nombre_completo,
        }
      : null,
    modificadoPor: modificadoPor
      ? {
          id: modificadoPor.id,
          nombreCompleto:
            modificadoPor.nombreCompleto ?? modificadoPor.nombre_completo,
        }
      : null,
    fechaModificacion: raw.fechaModificacion ?? raw.fecha_modificacion ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    esPendiente: raw.esPendiente ?? raw.es_pendiente ?? false,
  }
}

function normalizeMulta(raw: any): MultaCobroDTO {
  return {
    id: raw.id,
    creditoId: raw.creditoId ?? raw.credito_id,
    clienteId: raw.clienteId ?? raw.cliente_id,
    pagoId: raw.pagoId ?? raw.pago_id ?? null,
    tipo: raw.tipo,
    monto: raw.monto,
    fecha: raw.fecha,
    cobrada: raw.cobrada,
    cobradaEnPagoId: raw.cobradaEnPagoId ?? raw.cobrada_en_pago_id ?? null,
  }
}

function normalizeAbonoHistorial(raw: any): AbonoCorrienteHistorialDTO {
  const cliente = raw.cliente ?? {}
  const registradoPor = raw.registradoPor ?? raw.registrado_por

  return {
    abonoId: raw.abonoId ?? raw.abono_id,
    creditoId: raw.creditoId ?? raw.credito_id,
    cliente: {
      id: cliente.id,
      nombreCompleto: cliente.nombreCompleto ?? cliente.nombre_completo,
    },
    fecha: raw.fecha,
    montoTotal: raw.montoTotal ?? raw.monto_total ?? 0,
    montoDistribuido: raw.montoDistribuido ?? raw.monto_distribuido ?? 0,
    montoSobrante: raw.montoSobrante ?? raw.monto_sobrante ?? 0,
    montoMulta: raw.montoMulta ?? raw.monto_multa ?? 0,
    diasCubiertos: raw.diasCubiertos ?? raw.dias_cubiertos ?? 0,
    diasParciales: raw.diasParciales ?? raw.dias_parciales ?? 0,
    registradoPor: registradoPor
      ? {
          id: registradoPor.id,
          nombreCompleto:
            registradoPor.nombreCompleto ?? registradoPor.nombre_completo,
        }
      : null,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
  }
}

function normalizePage<T>(raw: any, mapItem: (item: any) => T): Page<T> {
  return {
    content: (raw.content ?? []).map(mapItem),
    total_elements: raw.total_elements ?? raw.totalElements ?? 0,
    total_pages: raw.total_pages ?? raw.totalPages ?? 0,
    number: raw.number ?? 0,
    size: raw.size ?? 0,
    totalElements: raw.totalElements ?? raw.total_elements,
    totalPages: raw.totalPages ?? raw.total_pages,
  }
}

export const cobrosService = {
  getRutaDia: (params?: { asesorId?: number; sucursalId?: number; fecha?: string }): Promise<RutaDia> =>
    api.get<any>('/cobros/ruta-dia', { params }).then((r) => normalizeRutaDia(r.data)),

  registrar: (req: PagoRegistrarRequest): Promise<PagoCobroDTO> =>
    api
      .post<any>('/cobros/registrar', {
        ...req,
        fecha_pago: req.fechaPago,
      })
      .then((r) => normalizePago(r.data)),

  modificar: (pagoId: number, req: PagoModificarRequest): Promise<PagoCobroDTO> =>
    api.patch<any>(`/cobros/${pagoId}`, req).then((r) => normalizePago(r.data)),

  getHistorial: (params?: {
    asesorId?: number
    clienteId?: number
    fechaDesde?: string
    fechaHasta?: string
    page?: number
    size?: number
  }): Promise<Page<PagoCobroDTO>> =>
    api
      .get<any>('/cobros/historial', { params })
      .then((r) => normalizePage(r.data, normalizePago)),

  getHistorialAbonos: (params?: {
    asesorId?: number
    clienteId?: number
    fechaDesde?: string
    fechaHasta?: string
  }): Promise<AbonoCorrienteHistorialDTO[]> =>
    api
      .get<any[]>('/cobros/abono-corriente/historial', { params })
      .then((r) => (r.data ?? []).map(normalizeAbonoHistorial)),

  getPagosPorCliente: (clienteId: number): Promise<PagoCobroDTO[]> =>
    api
      .get<any[]>(`/cobros/cliente/${clienteId}`)
      .then((r) => (r.data ?? []).map(normalizePago)),

  getMultasPorCredito: (creditoId: number): Promise<MultaCobroDTO[]> =>
    api
      .get<any[]>(`/cobros/multas/${creditoId}`)
      .then((r) => (r.data ?? []).map(normalizeMulta)),

  getPreviewMultasAbono: (creditoId: number, fechaPago?: string): Promise<MultaCobroDTO[]> =>
    api
      .get<any[]>('/cobros/abono-corriente/preview-multas', {
        params: {
          credito_id: creditoId,
          fecha_pago: fechaPago,
        },
      })
      .then((r) => (r.data ?? []).map(normalizeMulta)),

  registrarAbonoCorrente: (req: AbonoCorrienteRequest): Promise<AbonoCorrienteDTO> =>
    api
      .post<AbonoCorrienteDTO>('/cobros/abono-corriente', {
        credito_id: req.creditoId,
        monto_recibido: req.montoRecibido,
        fecha_pago: req.fechaPago,
      })
      .then((r) => r.data),

  getAbonosPorCredito: (creditoId: number): Promise<AbonoCorrienteDTO[]> =>
    api
      .get<AbonoCorrienteDTO[]>('/cobros/abono-corriente', {
        params: { credito_id: creditoId },
      })
      .then((r) => r.data ?? []),
}
