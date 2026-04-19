import { api } from './api'
import type { RenovacionCalculo, RenovacionDetalle, ColocacionesSemana, ColocacionItem, ListoRenovarItem } from '@/types'

function normalizeColocacionItem(raw: any): ColocacionItem {
  return {
    fecha: raw.fecha ?? raw.fecha_colocacion,
    clienteNombre: raw.clienteNombre ?? raw.cliente_nombre,
    clienteId: raw.clienteId ?? raw.cliente_id,
    creditoAnterior: raw.creditoAnterior ?? raw.credito_anterior,
    creditoNuevo: raw.creditoNuevo ?? raw.credito_nuevo,
    desembolso: raw.desembolso,
    asesorNombre: raw.asesorNombre ?? raw.asesor_nombre,
    tipo: raw.tipo,
    salidaDe: raw.salidaDe ?? raw.salida_de,
    refId: raw.refId ?? raw.ref_id,
  }
}

function normalizeColocaciones(raw: any): ColocacionesSemana {
  return {
    semanaInicio: raw.semanaInicio ?? raw.semana_inicio,
    semanaFin: raw.semanaFin ?? raw.semana_fin,
    items: (raw.items ?? []).map(normalizeColocacionItem),
    totalDesembolsos: raw.totalDesembolsos ?? raw.total_desembolsos ?? 0,
    totalCaja: raw.totalCaja ?? raw.total_caja ?? 0,
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
  calcularRenovacion: (creditoId: number): Promise<RenovacionCalculo> =>
    api.get(`/renovaciones/calcular/${creditoId}`).then((r) => r.data),

  obtenerDetalle: (creditoId: number): Promise<RenovacionDetalle> =>
    api.get(`/renovaciones/detalle/${creditoId}`).then((r) => r.data),

  getColocacionesSemana: (): Promise<ColocacionesSemana[]> =>
    api.get('/renovaciones/colocaciones-semana').then((r) =>
      (r.data ?? []).map(normalizeColocaciones),
    ),

  exportarPdfUrl: (creditoId: number): string =>
    `/api/renovaciones/exportar/${creditoId}`,

  getListosRenovar: (params?: {
    asesorId?: number
    sucursalId?: number
  }): Promise<ListoRenovarItem[]> =>
    api.get('/renovaciones/listos', { params })
      .then((r) => (r.data as any[]).map(normalizeListoItem)),
}
