import type {
  AbonoCorrienteDTO,
  CalendarioPagoDetalle,
  MultaCobroDTO,
  PagoCobroDTO,
} from '@/types'

export type ClasificacionFila =
  | 'PENDIENTE'
  | 'VENCIDO'
  | 'LIMPIO'
  | 'ABONO'
  | 'PARCIAL_DIRECTO'
  | 'NO_PAGO'
  | 'RENOVACION'

export interface MultaInfoFila {
  monto: number
  condonada: boolean
  condonadaPorNombre: string | null
  fechaCondonacion: string | null
  motivoCondonacion: string | null
  cubiertaConAbono: boolean
}

export interface FilaCalendario {
  id: number
  numeroPago: number
  fechaProgramada: string
  montoEsperado: number
  estadoOriginal: string
  clasificacion: ClasificacionFila
  montoRecibido: number | null
  pagoRegistrado: PagoCobroDTO | null
  abono: AbonoCorrienteDTO | null
  multa: MultaInfoFila | null
}

export interface ConstruirFilasParams {
  calendario: CalendarioPagoDetalle[]
  /** Ya filtrado por creditoId — ver Task 5 */
  pagosHistorial: PagoCobroDTO[]
  abonosCredito: AbonoCorrienteDTO[]
  /** Multas reales + preview, ya combinadas (multasCalendario en CreditoDetallePage) */
  multas: MultaCobroDTO[]
  hoyIso: string
  liquidadoPorRenovacion: boolean
}

export function construirFilasCalendario(params: ConstruirFilasParams): FilaCalendario[] {
  const { calendario, pagosHistorial, abonosCredito, multas, hoyIso, liquidadoPorRenovacion } = params

  const multaPorFecha = new Map<string, MultaCobroDTO>()
  const multaMontoPorFecha: Record<string, number> = {}
  for (const multa of multas) {
    const fecha = multa.fecha?.slice(0, 10)
    const monto = Number(multa.monto ?? 0)
    if (fecha && monto > 0) {
      multaPorFecha.set(fecha, multa)
      multaMontoPorFecha[fecha] = (multaMontoPorFecha[fecha] ?? 0) + monto
    }
  }

  const multaMontoPorNumeroPago: Record<number, number> = {}
  for (const pago of pagosHistorial) {
    const monto = Number(pago.multaAplicada ?? 0)
    if (pago.numeroPago != null && monto > 0) {
      multaMontoPorNumeroPago[pago.numeroPago] = Math.max(multaMontoPorNumeroPago[pago.numeroPago] ?? 0, monto)
    }
  }

  const multaMontoAbonoPorNumeroPago: Record<number, number> = {}
  for (const abono of abonosCredito) {
    for (const cobertura of abono.coberturas) {
      const monto = Number(cobertura.montoMulta ?? 0)
      if (monto > 0) {
        multaMontoAbonoPorNumeroPago[cobertura.numeroPago] =
          (multaMontoAbonoPorNumeroPago[cobertura.numeroPago] ?? 0) + monto
      }
    }
  }

  return calendario.map((pago): FilaCalendario => {
    const fecha = pago.fechaProgramada?.slice(0, 10) ?? ''
    const pagoRegistrado = pagosHistorial.find((p) => p.numeroPago === pago.numeroPago) ?? null
    const abono =
      abonosCredito.find((a) => a.coberturas.some((c) => c.numeroPago === pago.numeroPago)) ?? null

    const montoMulta = Math.max(
      multaMontoPorFecha[fecha] ?? 0,
      multaMontoPorNumeroPago[pago.numeroPago] ?? 0,
      multaMontoAbonoPorNumeroPago[pago.numeroPago] ?? 0,
    )
    const multaDetalle = multaPorFecha.get(fecha) ?? null
    const cubiertaConAbono =
      montoMulta > 0 && (multaMontoAbonoPorNumeroPago[pago.numeroPago] ?? 0) >= montoMulta

    const multa: MultaInfoFila | null =
      montoMulta > 0
        ? {
            monto: montoMulta,
            condonada: multaDetalle?.condonada ?? false,
            condonadaPorNombre: multaDetalle?.condonadaPorNombre ?? null,
            fechaCondonacion: multaDetalle?.fechaCondonacion ?? null,
            motivoCondonacion: multaDetalle?.motivoCondonacion ?? null,
            cubiertaConAbono,
          }
        : null

    const clasificacion = clasificarFila({
      estado: pago.estado,
      fecha,
      hoyIso,
      pagoRegistrado,
      abono,
      liquidadoPorRenovacion,
    })

    const coberturaFila = abono?.coberturas.find((c) => c.numeroPago === pago.numeroPago) ?? null
    const montoRecibido = pagoRegistrado
      ? pagoRegistrado.razonNoPago
        ? null
        : Number(pagoRegistrado.montoRecibido)
      : coberturaFila
        ? Number(coberturaFila.totalAplicado)
        : null

    return {
      id: pago.id,
      numeroPago: pago.numeroPago,
      fechaProgramada: fecha,
      montoEsperado: Number(pago.montoEsperado ?? 0),
      estadoOriginal: pago.estado,
      clasificacion,
      montoRecibido,
      pagoRegistrado,
      abono,
      multa,
    }
  })
}

function clasificarFila(args: {
  estado: string
  fecha: string
  hoyIso: string
  pagoRegistrado: PagoCobroDTO | null
  abono: AbonoCorrienteDTO | null
  liquidadoPorRenovacion: boolean
}): ClasificacionFila {
  const { estado, fecha, hoyIso, pagoRegistrado, abono, liquidadoPorRenovacion } = args

  if (estado === 'PENDIENTE') {
    return fecha < hoyIso ? 'VENCIDO' : 'PENDIENTE'
  }
  if (estado === 'NO_PAGADO') return 'NO_PAGO'
  if (estado === 'PARCIAL') return 'PARCIAL_DIRECTO'
  if (estado === 'RECUPERADO' || estado === 'RECUPERADO_PARCIAL') return 'ABONO'

  // A partir de aquí el estado es PAGADO o ADELANTADO.
  if (pagoRegistrado) return 'LIMPIO'
  if (abono) return 'ABONO'
  if (liquidadoPorRenovacion) return 'RENOVACION'
  // Estado PAGADO/ADELANTADO sin registro real, sin abono y sin renovación:
  // no debería ocurrir con los datos actuales, pero si pasa (inconsistencia
  // de datos) se trata como un pago limpio en vez de dejar la fila sin clasificar.
  return 'LIMPIO'
}
