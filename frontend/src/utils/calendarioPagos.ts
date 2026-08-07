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

export interface GrupoFilas {
  tipo: 'grupo'
  clasificacion: 'LIMPIO' | 'RENOVACION'
  filas: FilaCalendario[]
  fechaInicio: string
  fechaFin: string
  montoTotal: number
}

export interface FilaIndividual {
  tipo: 'fila'
  fila: FilaCalendario
}

export type FilaOGrupo = GrupoFilas | FilaIndividual

/**
 * Agrupa rachas consecutivas de pagos ya resueltos sin incidentes (LIMPIO o
 * RENOVACION, nunca mezclados entre sí). Una fila con multa asociada nunca
 * se agrupa, sin importar su clasificación — siempre debe verse su detalle.
 * Los pendientes/vencidos tampoco se agrupan (no son LIMPIO ni RENOVACION).
 */
export function agruparFilas(filas: FilaCalendario[], umbralMinimo = 2): FilaOGrupo[] {
  const resultado: FilaOGrupo[] = []
  let racha: FilaCalendario[] = []
  let clasificacionRacha: 'LIMPIO' | 'RENOVACION' | null = null

  const cerrarRacha = () => {
    if (racha.length === 0) return
    if (racha.length >= umbralMinimo && clasificacionRacha) {
      resultado.push({
        tipo: 'grupo',
        clasificacion: clasificacionRacha,
        filas: racha,
        fechaInicio: racha[0].fechaProgramada,
        fechaFin: racha[racha.length - 1].fechaProgramada,
        montoTotal: racha.reduce((sum, f) => sum + f.montoEsperado, 0),
      })
    } else {
      for (const fila of racha) resultado.push({ tipo: 'fila', fila })
    }
    racha = []
    clasificacionRacha = null
  }

  for (const fila of filas) {
    const agrupable: 'LIMPIO' | 'RENOVACION' | null =
      !fila.multa && (fila.clasificacion === 'LIMPIO' || fila.clasificacion === 'RENOVACION')
        ? fila.clasificacion
        : null

    if (agrupable && (clasificacionRacha === null || clasificacionRacha === agrupable)) {
      clasificacionRacha = agrupable
      racha.push(fila)
      continue
    }

    cerrarRacha()
    if (agrupable) {
      clasificacionRacha = agrupable
      racha.push(fila)
    } else {
      resultado.push({ tipo: 'fila', fila })
    }
  }
  cerrarRacha()

  return resultado
}

export interface ResumenCalendario {
  pagadosCount: number
  parcialesCount: number
  noPagaronCount: number
  vencidosCount: number
  pendientesCount: number
  multasCondonadasMonto: number
}

export function resumirFilas(filas: FilaCalendario[]): ResumenCalendario {
  let pagadosCount = 0
  let parcialesCount = 0
  let noPagaronCount = 0
  let vencidosCount = 0
  let pendientesCount = 0
  let multasCondonadasMonto = 0

  for (const fila of filas) {
    if (
      fila.estadoOriginal === 'PAGADO' ||
      fila.estadoOriginal === 'ADELANTADO' ||
      fila.estadoOriginal === 'RECUPERADO'
    ) {
      pagadosCount++
    } else if (fila.estadoOriginal === 'PARCIAL' || fila.estadoOriginal === 'RECUPERADO_PARCIAL') {
      parcialesCount++
    } else if (fila.estadoOriginal === 'NO_PAGADO') {
      noPagaronCount++
    } else if (fila.clasificacion === 'VENCIDO') {
      vencidosCount++
    } else if (fila.clasificacion === 'PENDIENTE') {
      pendientesCount++
    }

    if (fila.multa?.condonada) {
      multasCondonadasMonto += fila.multa.monto
    }
  }

  return { pagadosCount, parcialesCount, noPagaronCount, vencidosCount, pendientesCount, multasCondonadasMonto }
}
