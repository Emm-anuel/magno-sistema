# Rediseño del Calendario de Pagos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el tab "Calendario" de `CreditoDetallePage` para que se entienda de un vistazo qué pasó con cada pago (a tiempo, cubierto por abono, con multa condonada, o saldado por una renovación), sin perder la visibilidad de todos los pagos pendientes por hacer.

**Architecture:** Lógica pura de clasificación/agrupación en un módulo de utilidades sin dependencias de React (`frontend/src/utils/calendarioPagos.ts`), consumida por un componente presentacional nuevo (`frontend/src/components/creditos/CalendarioPagos.tsx`) que `CreditoDetallePage.tsx` monta dentro del tab existente, reemplazando la tabla actual. Ningún cambio de backend: los campos de condonación de multas ya existen en la API, solo faltaba mapearlos en el frontend.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS (frontend only). Este repo no tiene test runner de frontend configurado (no hay vitest/jest/testing-library, `frontend/package.json` no define script `test`). La verificación de cada tarea usa `npm run type-check` (tsc --noEmit) como red de seguridad automática, y la Tarea 6 es una verificación manual en navegador contra datos reales — es el patrón que ya sigue este proyecto para cambios de frontend (ver CLAUDE.md / instrucciones de sesión: "para cambios de UI, iniciar el servidor de desarrollo y probar en el navegador").

**Spec de referencia:** `docs/superpowers/specs/2026-08-06-calendario-pagos-redesign-design.md`

---

## Task 1: Exponer el estado de condonación de multas en el frontend

**Files:**
- Modify: `frontend/src/types/index.ts:528-538` (interfaz `MultaCobroDTO`)
- Modify: `frontend/src/services/cobrosService.ts:104-116` (función `normalizeMulta`)

- [ ] **Step 1: Extender `MultaCobroDTO`**

En `frontend/src/types/index.ts`, reemplazar la interfaz actual:

```ts
export interface MultaCobroDTO {
  id: number
  creditoId: number
  clienteId: number
  pagoId: number | null
  tipo: TipoMulta
  monto: number
  fecha: string
  cobrada: boolean
  cobradaEnPagoId: number | null
}
```

por:

```ts
export interface MultaCobroDTO {
  id: number
  creditoId: number
  clienteId: number
  pagoId: number | null
  tipo: TipoMulta
  monto: number
  fecha: string
  cobrada: boolean
  cobradaEnPagoId: number | null
  cobradaEnAbonoId: number | null
  condonada: boolean
  condonadaEnRenovacionId: number | null
  condonadaPorNombre: string | null
  fechaCondonacion: string | null
  motivoCondonacion: string | null
}
```

- [ ] **Step 2: Mapear los campos nuevos en `normalizeMulta`**

En `frontend/src/services/cobrosService.ts`, reemplazar:

```ts
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
```

por:

```ts
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
    cobradaEnAbonoId: raw.cobradaEnAbonoId ?? raw.cobrada_en_abono_id ?? null,
    condonada: raw.condonada ?? false,
    condonadaEnRenovacionId: raw.condonadaEnRenovacionId ?? raw.condonada_en_renovacion_id ?? null,
    condonadaPorNombre: raw.condonadaPorNombre ?? raw.condonada_por_nombre ?? null,
    fechaCondonacion: raw.fechaCondonacion ?? raw.fecha_condonacion ?? null,
    motivoCondonacion: raw.motivoCondonacion ?? raw.motivo_condonacion ?? null,
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend && npm run type-check`
Expected: sin errores (0 errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/cobrosService.ts
git commit -m "feat: exponer condonación de multas en MultaCobroDTO"
```

---

## Task 2: Clasificación pura de filas del calendario

**Files:**
- Create: `frontend/src/utils/calendarioPagos.ts`

- [ ] **Step 1: Crear el módulo con tipos y `construirFilasCalendario`**

Crear `frontend/src/utils/calendarioPagos.ts`:

```ts
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
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npm run type-check`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/calendarioPagos.ts
git commit -m "feat: agregar clasificación pura de filas del calendario de pagos"
```

---

## Task 3: Agrupación de rachas y resumen agregado

**Files:**
- Modify: `frontend/src/utils/calendarioPagos.ts` (agregar al final del archivo)

- [ ] **Step 1: Agregar `agruparFilas`**

Agregar al final de `frontend/src/utils/calendarioPagos.ts`:

```ts
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
    const esAgrupable =
      (fila.clasificacion === 'LIMPIO' || fila.clasificacion === 'RENOVACION') && !fila.multa

    if (esAgrupable && (clasificacionRacha === null || clasificacionRacha === fila.clasificacion)) {
      clasificacionRacha = fila.clasificacion
      racha.push(fila)
      continue
    }

    cerrarRacha()
    if (esAgrupable) {
      clasificacionRacha = fila.clasificacion
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
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npm run type-check`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/calendarioPagos.ts
git commit -m "feat: agregar agrupación de rachas y resumen al calendario de pagos"
```

---

## Task 4: Componente presentacional `CalendarioPagos`

**Files:**
- Create: `frontend/src/components/creditos/CalendarioPagos.tsx`

- [ ] **Step 1: Crear el componente**

Crear `frontend/src/components/creditos/CalendarioPagos.tsx`:

```tsx
import { useMemo, useState } from 'react'
import type { AbonoCorrienteDTO, CalendarioPagoDetalle, MultaCobroDTO, PagoCobroDTO } from '@/types'
import {
  agruparFilas,
  construirFilasCalendario,
  resumirFilas,
  type FilaCalendario,
  type GrupoFilas,
} from '@/utils/calendarioPagos'

function fmtMoney(v?: number | null): string {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

function toLocalDateInput(v: string): string {
  const value = v.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
}

function fmtDate(v?: string | null): string {
  if (!v) return '—'
  return new Date(toLocalDateInput(v)).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const LEYENDA = [
  { label: 'Pagado', bg: '#dcfce7', text: '#15803d' },
  { label: 'Abono cubrió atraso', bg: '#dbeafe', text: '#1d4ed8' },
  { label: 'Atrasado / no pagó', bg: '#fee2e2', text: '#b91c1c' },
  { label: 'Multa condonada', bg: '#f3e8ff', text: '#7e22ce' },
  { label: 'Cubierto por renovación', bg: '#ede9fe', text: '#6d28d9' },
  { label: 'Pendiente (futuro)', bg: '#f1f5f9', text: '#475569' },
]

function estiloClasificacion(fila: FilaCalendario): { bg: string; text: string; label: string } {
  switch (fila.clasificacion) {
    case 'LIMPIO':
      return { bg: '#dcfce7', text: '#15803d', label: fila.estadoOriginal === 'ADELANTADO' ? 'Adelantado' : 'Pagado' }
    case 'ABONO':
      return {
        bg: '#dbeafe',
        text: '#1d4ed8',
        label: fila.estadoOriginal === 'RECUPERADO_PARCIAL' ? 'Abono parcial' : 'Abono',
      }
    case 'PARCIAL_DIRECTO':
      return { bg: '#fef3c7', text: '#92400e', label: 'Pago parcial' }
    case 'NO_PAGO':
      return { bg: '#fee2e2', text: '#b91c1c', label: 'No pagó' }
    case 'VENCIDO':
      return { bg: '#fee2e2', text: '#b91c1c', label: 'Vencido' }
    case 'RENOVACION':
      return { bg: '#ede9fe', text: '#6d28d9', label: 'Saldado por renovación' }
    case 'PENDIENTE':
    default:
      return { bg: '#f1f5f9', text: '#475569', label: 'Pendiente' }
  }
}

function explicacionFila(fila: FilaCalendario): string | null {
  if (fila.clasificacion === 'LIMPIO' || fila.clasificacion === 'PENDIENTE') return null

  if (fila.clasificacion === 'VENCIDO') {
    return 'No se ha registrado el cobro de este día.'
  }

  if (fila.clasificacion === 'NO_PAGO') {
    let texto = 'El cliente no pagó este día.'
    if (fila.multa?.condonada) {
      texto += ` La multa de ${fmtMoney(fila.multa.monto)} fue condonada por ${fila.multa.condonadaPorNombre ?? 'un supervisor'}${
        fila.multa.fechaCondonacion ? ` el ${fmtDate(fila.multa.fechaCondonacion)}` : ''
      }${fila.multa.motivoCondonacion ? ` — "${fila.multa.motivoCondonacion}"` : ''}.`
    } else if (fila.multa && !fila.multa.cubiertaConAbono) {
      texto += ` Tiene una multa pendiente de ${fmtMoney(fila.multa.monto)}.`
    }
    return texto
  }

  if (fila.clasificacion === 'PARCIAL_DIRECTO') {
    return `Pagó ${fmtMoney(fila.montoRecibido)} de ${fmtMoney(fila.montoEsperado)} esperados ese día.`
  }

  if (fila.clasificacion === 'ABONO') {
    const cobertura = fila.abono?.coberturas.find((c) => c.numeroPago === fila.numeroPago) ?? null
    const partes = [`cuota ${fmtMoney(cobertura?.montoCuota ?? fila.montoEsperado)}`]
    if (cobertura && Number(cobertura.montoMulta) > 0) partes.push(`multa ${fmtMoney(cobertura.montoMulta)}`)
    return `Abono #${fila.abono?.abonoId ?? ''}: cubrió ${partes.join(' + ')} = ${fmtMoney(fila.montoRecibido)}.`
  }

  if (fila.clasificacion === 'RENOVACION') {
    let texto = 'Este pago no fue cobrado día a día: se saldó al aprobar una renovación de este crédito.'
    if (fila.multa?.condonada) {
      texto += ` La multa de ${fmtMoney(fila.multa.monto)} también fue condonada.`
    } else if (fila.multa) {
      texto += ` Incluye una multa de ${fmtMoney(fila.multa.monto)} descontada del desembolso.`
    }
    return texto
  }

  return null
}

function FilaRow({
  fila,
  esAdminSupervisor,
  onVerPago,
  onModificarPago,
  onVerAbono,
}: {
  fila: FilaCalendario
  esAdminSupervisor: boolean
  onVerPago: (pago: PagoCobroDTO) => void
  onModificarPago: (pago: PagoCobroDTO) => void
  onVerAbono: (abono: AbonoCorrienteDTO) => void
}) {
  const base = estiloClasificacion(fila)
  const estilo = fila.multa?.condonada ? { bg: '#f3e8ff', text: '#7e22ce', label: `${base.label} — multa condonada` } : base
  const explicacion = explicacionFila(fila)

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 py-3 px-3 border-b border-[#f1f3f5] last:border-0">
      <div className="sm:w-32 shrink-0 text-sm">
        <div className="font-medium text-[#212529]">{fmtDate(fila.fechaProgramada)}</div>
        <div className="text-[11px] text-gray-400">pago #{fila.numeroPago}</div>
      </div>
      <div className="flex-1 min-w-0">
        <span
          className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: estilo.bg, color: estilo.text }}
        >
          {estilo.label}
        </span>
        {explicacion && <p className="text-[12px] text-gray-600 mt-1 leading-relaxed max-w-xl">{explicacion}</p>}
      </div>
      <div className="sm:w-28 shrink-0 text-sm font-mono sm:text-right">
        {fila.montoRecibido != null ? fmtMoney(fila.montoRecibido) : <span className="text-gray-400">—</span>}
      </div>
      <div className="sm:w-40 shrink-0 flex flex-wrap sm:justify-end gap-1.5">
        {fila.pagoRegistrado && (
          <button type="button" className="btn btn-sm text-xs py-0.5 px-2" onClick={() => onVerPago(fila.pagoRegistrado!)}>
            Ver pago
          </button>
        )}
        {fila.pagoRegistrado && esAdminSupervisor && (
          <button
            type="button"
            className="btn btn-sm text-xs py-0.5 px-2"
            onClick={() => onModificarPago(fila.pagoRegistrado!)}
          >
            Modificar
          </button>
        )}
        {fila.abono && (
          <button
            type="button"
            className="btn btn-sm text-xs py-0.5 px-2 text-blue-700 border-blue-200 hover:bg-blue-50"
            onClick={() => onVerAbono(fila.abono!)}
          >
            Ver abono
          </button>
        )}
      </div>
    </div>
  )
}

function GrupoRow({ grupo, abierto, onToggle }: { grupo: GrupoFilas; abierto: boolean; onToggle: () => void }) {
  const label = grupo.clasificacion === 'RENOVACION' ? 'saldados por renovación' : 'pagos a tiempo'
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2 py-2.5 px-3 text-left text-[13px] text-gray-500 italic hover:bg-[#f8f9fa] border-b border-[#f1f3f5]"
    >
      <span className="text-gray-400 not-italic">{abierto ? '▾' : '▸'}</span>
      <span>
        ✓ {grupo.filas.length} {label} · {fmtDate(grupo.fechaInicio)}–{fmtDate(grupo.fechaFin)} · {fmtMoney(grupo.montoTotal)}
      </span>
    </button>
  )
}

export interface CalendarioPagosProps {
  calendario: CalendarioPagoDetalle[]
  pagosHistorial: PagoCobroDTO[]
  abonosCredito: AbonoCorrienteDTO[]
  multas: MultaCobroDTO[]
  hoyIso: string
  liquidadoPorRenovacion: boolean
  esAdminSupervisor: boolean
  onVerPago: (pago: PagoCobroDTO) => void
  onModificarPago: (pago: PagoCobroDTO) => void
  onVerAbono: (abono: AbonoCorrienteDTO) => void
}

export default function CalendarioPagos({
  calendario,
  pagosHistorial,
  abonosCredito,
  multas,
  hoyIso,
  liquidadoPorRenovacion,
  esAdminSupervisor,
  onVerPago,
  onModificarPago,
  onVerAbono,
}: CalendarioPagosProps) {
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set())

  const filas = useMemo(
    () =>
      construirFilasCalendario({
        calendario,
        pagosHistorial,
        abonosCredito,
        multas,
        hoyIso,
        liquidadoPorRenovacion,
      }),
    [calendario, pagosHistorial, abonosCredito, multas, hoyIso, liquidadoPorRenovacion],
  )
  const filasOGrupos = useMemo(() => agruparFilas(filas), [filas])
  const resumen = useMemo(() => resumirFilas(filas), [filas])

  function claveGrupo(grupo: GrupoFilas): string {
    return `${grupo.clasificacion}-${grupo.fechaInicio}-${grupo.fechaFin}`
  }

  function toggleGrupo(clave: string) {
    setGruposAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(clave)) next.delete(clave)
      else next.add(clave)
      return next
    })
  }

  let mostroDivisorPendientes = false

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {LEYENDA.map((chip) => (
          <span
            key={chip.label}
            className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: chip.bg, color: chip.text }}
          >
            {chip.label}
          </span>
        ))}
      </div>

      <div className="rounded-lg border border-[#e9ecef] overflow-hidden">
        {filasOGrupos.map((item) => {
          const primeraFila = item.tipo === 'fila' ? item.fila : item.filas[0]
          const esPrimerPendiente = !mostroDivisorPendientes && primeraFila.clasificacion === 'PENDIENTE'
          if (esPrimerPendiente) mostroDivisorPendientes = true

          const key = item.tipo === 'fila' ? `fila-${item.fila.id}` : `grupo-${claveGrupo(item)}`

          return (
            <div key={key}>
              {esPrimerPendiente && (
                <div className="px-3 py-2 bg-[#f8f9fa] text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Próximos pagos
                </div>
              )}
              {item.tipo === 'grupo' ? (
                <>
                  <GrupoRow
                    grupo={item}
                    abierto={gruposAbiertos.has(claveGrupo(item))}
                    onToggle={() => toggleGrupo(claveGrupo(item))}
                  />
                  {gruposAbiertos.has(claveGrupo(item)) &&
                    item.filas.map((fila) => (
                      <FilaRow
                        key={fila.id}
                        fila={fila}
                        esAdminSupervisor={esAdminSupervisor}
                        onVerPago={onVerPago}
                        onModificarPago={onModificarPago}
                        onVerAbono={onVerAbono}
                      />
                    ))}
                </>
              ) : (
                <FilaRow
                  fila={item.fila}
                  esAdminSupervisor={esAdminSupervisor}
                  onVerPago={onVerPago}
                  onModificarPago={onModificarPago}
                  onVerAbono={onVerAbono}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#16a34a]">{resumen.pagadosCount}</div>
          <div className="text-[11px] text-gray-500">Pagados</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-amber-600">{resumen.parcialesCount}</div>
          <div className="text-[11px] text-gray-500">Parciales</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className={`text-lg font-bold ${resumen.noPagaronCount > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
            {resumen.noPagaronCount}
          </div>
          <div className="text-[11px] text-gray-500">No pagaron</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className={`text-lg font-bold ${resumen.vencidosCount > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
            {resumen.vencidosCount}
          </div>
          <div className="text-[11px] text-gray-500">Vencidos</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#212529]">{resumen.pendientesCount}</div>
          <div className="text-[11px] text-gray-500">Pendientes</div>
        </div>
        {resumen.multasCondonadasMonto > 0 && (
          <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-purple-700">{fmtMoney(resumen.multasCondonadasMonto)}</div>
            <div className="text-[11px] text-gray-500">Multas condonadas</div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npm run type-check`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/creditos/CalendarioPagos.tsx
git commit -m "feat: agregar componente CalendarioPagos"
```

---

## Task 5: Integrar el componente en `CreditoDetallePage`

**Files:**
- Modify: `frontend/src/pages/creditos/CreditoDetallePage.tsx`

- [ ] **Step 1: Importar el componente nuevo**

En `frontend/src/pages/creditos/CreditoDetallePage.tsx`, agregar el import junto a los demás (cerca de la línea 17):

```tsx
import CalendarioPagos from '@/components/creditos/CalendarioPagos'
```

- [ ] **Step 2: Eliminar la función `esVencido` (ya no se usa fuera de la tabla vieja)**

Eliminar (líneas 206-211 aprox.):

```tsx
  // ── Helpers de estado de calendario ──────────────────────────────

  function esVencido(fechaProgramada: string, estado: string) {
    const fechaIso = fechaProgramada?.slice(0, 10)
    return estado === 'PENDIENTE' && Boolean(fechaIso) && fechaIso < hoyIso
  }

```

Dejar `esSlotAdeudoParaCorriente` tal cual — sigue siendo necesaria para `multasPendientesVisual`/`adeudoParaPonerseCorriente`.

- [ ] **Step 3: Eliminar los cálculos de multas que solo usaba la tabla vieja**

Eliminar estos cuatro bloques (aprox. líneas 287-314 en el archivo original):

```tsx
  const multasPorFecha = multasCalendario.reduce<Record<string, number>>((acc, multa) => {
    const fecha = multa.fecha?.slice(0, 10)
    const monto = Number(multa.monto ?? 0)
    if (fecha && monto > 0) {
      acc[fecha] = (acc[fecha] ?? 0) + monto
    }
    return acc
  }, {})
  const multasPagoPorNumero = pagosHistorialCredito.reduce<Record<number, number>>((acc, pago) => {
    const monto = Number(pago.multaAplicada ?? 0)
    if (pago.numeroPago != null && monto > 0) {
      acc[pago.numeroPago] = Math.max(acc[pago.numeroPago] ?? 0, monto)
    }
    return acc
  }, {})
  const multasAbonoPorNumero = abonosCredito
    .flatMap((abono) => abono.coberturas)
    .reduce<Record<number, number>>((acc, cobertura) => {
      const monto = Number(cobertura.montoMulta ?? 0)
      if (monto > 0) {
        acc[cobertura.numeroPago] = (acc[cobertura.numeroPago] ?? 0) + monto
      }
      return acc
    }, {})
  const hayMultasCalendario =
    multasCalendario.some((multa) => Number(multa.monto ?? 0) > 0) ||
    Object.values(multasPagoPorNumero).some((monto) => monto > 0) ||
    Object.values(multasAbonoPorNumero).some((monto) => monto > 0)
```

Dejar `multasCalendario` (se usa como prop nuevo) y `abonosAplicadosPorNumero` (se usa en `adeudoParaPonerseCorriente`) sin tocar.

- [ ] **Step 4: Reemplazar el contenido del tab "Calendario"**

Reemplazar todo el bloque `{tab === 'calendario' && ( ... )}` (la tabla `<table className="tabla...">` completa más el IIFE `(() => { ... })()` del resumen) por:

```tsx
          {/* ── Tab 2: Calendario ──────────────────────────────────── */}
          {tab === 'calendario' && (
            <div className="space-y-4">
              <CalendarioPagos
                calendario={calendario}
                pagosHistorial={pagosHistorialCredito}
                abonosCredito={abonosCredito}
                multas={multasCalendario}
                hoyIso={hoyIso}
                liquidadoPorRenovacion={credito.liquidadoPorRenovacion != null}
                esAdminSupervisor={esAdminSupervisor}
                onVerPago={setPagoModal}
                onModificarPago={setPagoEditar}
                onVerAbono={setAbonoDetalleModal}
              />
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 pt-1 text-sm">
                <span className="text-[#16a34a] font-semibold">
                  Total cobrado: {fmtMoney(totalCobradoCredito)}
                </span>
                {multasPendientesVisual > 0 && (
                  <span className="text-[#dc2626] font-semibold">
                    Multas pendientes: {fmtMoney(multasPendientesVisual)}
                  </span>
                )}
                {adeudoParaPonerseCorriente > 0 && (
                  <span className="text-[#f59e0b] font-semibold">
                    Adeudo para ponerse al corriente: {fmtMoney(adeudoParaPonerseCorriente)}
                  </span>
                )}
                <span className="text-gray-700 font-semibold">
                  Saldo restante crédito: {fmtMoney(saldoRestante)}
                </span>
              </div>
            </div>
          )}
```

- [ ] **Step 5: Verificar tipos y lint**

Run: `cd frontend && npm run type-check`
Expected: sin errores.

Run: `cd frontend && npm run lint`
Expected: sin errores (el `hayMultasCalendario` y las variables de multas eliminadas no deben quedar referenciadas en ningún otro lado — si `lint`/`type-check` marca alguna variable no usada o no definida, revisar que el Step 3 se aplicó completo).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/creditos/CreditoDetallePage.tsx
git commit -m "feat: integrar CalendarioPagos en el detalle de crédito"
```

---

## Task 6: Verificación manual en navegador

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Levantar el stack de desarrollo**

Si no están corriendo ya:

```bash
docker compose -f docker-compose.dev.yml up -d
```

En una terminal, backend:

```bash
cd backend && mvn "-Dspring-boot.run.profiles=dev" spring-boot:run
```

En otra terminal, frontend:

```bash
cd frontend && npm run dev
```

Abrir `http://localhost:5173`.

- [ ] **Step 2: Verificar un crédito con historial mixto**

Navegar a un crédito activo o renovado que tenga en su calendario: al menos una racha de 2+ pagos a tiempo, un día cubierto por abono, y (si hay datos) una multa condonada o un tramo saldado por renovación (el crédito "Crédito #30 — Cristal Rosales Hernández" mencionado en esta conversación es un buen candidato si sigue existiendo en la base local).

Confirmar:
- La racha de pagos a tiempo aparece colapsada como una sola fila (`▸ N pagos a tiempo · fecha–fecha · monto`) y se expande al hacer clic.
- El día cubierto por abono muestra su propia fila con la oración explicando cuánto cubrió y de qué abono viene, sin necesidad de abrir el modal.
- Si el crédito tiene un tramo liquidado por renovación, esas filas aparecen agrupadas bajo la etiqueta morada "Saldado por renovación", distinta de "Pagado".
- La leyenda de colores aparece arriba de la tabla.

- [ ] **Step 3: Verificar que los pagos pendientes nunca se colapsan**

En un crédito activo con pagos futuros, confirmar que la sección "Próximos pagos" lista cada fecha individualmente (sin agrupar), con su monto esperado visible.

- [ ] **Step 4: Verificar responsive**

Abrir las DevTools del navegador, activar el modo responsive a 375px de ancho, y confirmar que las filas se apilan verticalmente sin generar scroll horizontal.

- [ ] **Step 5: Verificar botones de acción**

Confirmar que "Ver pago", "Modificar" (solo Admin/Supervisor) y "Ver abono" siguen abriendo los mismos modales que antes, sin cambios de comportamiento.

No requiere commit — es un paso de verificación.

---

## Self-review de este plan

- **Cobertura de la spec:** Sección 1 (clasificación) → Task 2. Sección 2 (agrupación) → Task 3. Sección 3 (contenido de fila + leyenda) → Task 4. Sección 4 (resumen + multas condonadas) → Task 3 (`resumirFilas`) + Task 4 (render). Sección 5 (extracción de componente) → Task 4 + Task 5. El hallazgo de `MultaCobroDTO` incompleto → Task 1.
- **Consistencia de tipos:** `FilaCalendario`, `GrupoFilas`, `FilaOGrupo`, `ConstruirFilasParams`, `CalendarioPagosProps` se usan con los mismos nombres de campo en las Tasks 2, 3, 4 y 5 (verificado: `estadoOriginal`, `clasificacion`, `multa.condonada`, `liquidadoPorRenovacion` coinciden en las tres tasks).
- **Fuera de alcance respetado:** ningún archivo de `renovaciones/`, `ClienteDetallePage.tsx`, ni backend aparece en las tasks — consistente con la spec.
