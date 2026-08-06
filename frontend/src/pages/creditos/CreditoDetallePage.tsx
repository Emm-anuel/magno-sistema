import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, ChevronRight, Play, ExternalLink, X } from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { cobrosService } from '@/services/cobrosService'
import { useAuthStore } from '@/hooks/useAuthStore'
import CreditoEstadoBadge from '@/components/CreditoEstadoBadge'
import TipoCreditoBadge from '@/components/TipoCreditoBadge'
import TipoPagoBadge from '@/components/TipoPagoBadge'
import FileUpload from '@/components/FileUpload'
import SecurePreviewImage from '@/components/SecurePreviewImage'
import ImagePreviewModal from '@/components/ImagePreviewModal'
import ModalRegistrarPago from '@/components/cobros/ModalRegistrarPago'
import ModalModificarPago from '@/components/cobros/ModalModificarPago'
import ModalPagarAdeudo from '@/components/cobros/ModalPagarAdeudo'
import type { PagoCobroDTO, TipoPago, AbonoCorrienteDTO } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function todayLocalIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtDate(v?: string | null): string {
  if (!v) return '—'
  return new Date(toLocalDateInput(v)).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function fmtDateTime(v?: string | null): string {
  if (!v) return '—'
  return new Date(v).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function fmtPct(v?: number | null): string {
  if (v == null) return '—'
  return `${(Number(v) * 100).toFixed(0)}%`
}

function Row({ label, value, valueClass }: { label: string; value?: string | number | null; valueClass?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-1.5 border-b border-[#f1f3f5] last:border-0">
      <span className="text-[11px] font-medium text-[#adb5bd] sm:w-44 shrink-0 uppercase tracking-wide">{label}</span>
      <span className={`text-[13px] text-[#212529] ${valueClass ?? ''}`}>{value ?? '—'}</span>
    </div>
  )
}

// ── Estado labels ────────────────────────────────────────────────────────────

const ESTADO_LABELS: Record<string, string> = {
  SOLICITADO: 'Solicitado',
  APROBADO: 'Aprobado',
  ACTIVO: 'Activo',
  PAGADO: 'Pagado',
  RENOVADO: 'Renovado',
  CANCELADO: 'Cancelado',
}

// ── Tipo de pestaña ───────────────────────────────────────────────────────────

type Tab = 'informacion' | 'calendario' | 'evidencia' | 'video'

// ── Componente principal ──────────────────────────────────────────────────────

export default function CreditoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuthStore()
  const qc = useQueryClient()

  const [tab, setTab] = useState<Tab>('informacion')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')
  const [cambiandoVideo, setCambiandoVideo] = useState(false)
  const [pagoModal, setPagoModal] = useState<PagoCobroDTO | null>(null)
  const [pagoEditar, setPagoEditar] = useState<PagoCobroDTO | null>(null)
  const [registrarPagoOpen, setRegistrarPagoOpen] = useState(false)
  const [adeudoOpen, setAdeudoOpen] = useState(false)
  const [adelantoOpen, setAdelantoOpen] = useState(false)
  const [abonoDetalleModal, setAbonoDetalleModal] = useState<AbonoCorrienteDTO | null>(null)
  const [revertirOpen, setRevertirOpen] = useState(false)
  const [revertirMotivo, setRevertirMotivo] = useState('')

  const hoyIso = useMemo(() => todayLocalIso(), [])

  const numId = Number(id)

  const { data: credito, isLoading, isError } = useQuery({
    queryKey: ['credito', numId],
    queryFn: () => creditoService.obtener(numId),
    enabled: !isNaN(numId),
  })

  const { data: pagosHistorial = [] } = useQuery({
    queryKey: ['pagos-cliente-credito', numId],
    queryFn: () => cobrosService.getPagosPorCliente(credito!.cliente.id),
    enabled: !!credito,
    staleTime: 30_000,
  })

  const { data: abonosCredito = [] } = useQuery({
    queryKey: ['abonos-credito', numId],
    queryFn: () => cobrosService.getAbonosPorCredito(numId),
    enabled: !!credito,
    staleTime: 30_000,
  })

  const { data: multasCredito = [] } = useQuery({
    queryKey: ['multas-credito', numId],
    queryFn: () => cobrosService.getMultasPorCredito(numId),
    enabled: !!credito,
    staleTime: 30_000,
  })

  const { data: multasPreviewAdeudo = [] } = useQuery({
    queryKey: ['preview-multas-abono', numId, hoyIso],
    queryFn: () => cobrosService.getPreviewMultasAbono(numId, hoyIso),
    enabled: !!credito,
    staleTime: 30_000,
  })

  const subirVideoMut = useMutation({
    mutationFn: (url: string) => creditoService.subirVideoEntrega(numId, url),
    onSuccess: () => {
      toast.success('Video de entrega guardado')
      setCambiandoVideo(false)
      qc.invalidateQueries({ queryKey: ['credito', numId] })
    },
    onError: () => {
      toast.error('Error al guardar el video')
    },
  })

  const revertirMut = useMutation({
    mutationFn: (motivo: string) => creditoService.revertirDesembolso(numId, motivo),
    onSuccess: () => {
      toast.success('Desembolso revertido. El crédito regresó a estado Aprobado.')
      setRevertirOpen(false)
      setRevertirMotivo('')
      qc.invalidateQueries({ queryKey: ['credito', numId] })
      qc.invalidateQueries({ queryKey: ['creditos'] })
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'No se pudo revertir el desembolso')
    },
  })

  // ── Loading / error ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        Cargando crédito...
      </div>
    )
  }

  if (isError || !credito) {
    return (
      <div className="card p-8 text-center text-gray-500">
        <p className="mb-4 font-semibold">Crédito no encontrado</p>
        <button className="btn btn-sm" onClick={() => navigate('/creditos-nuevos')}>
          ← Volver
        </button>
      </div>
    )
  }

  // ── Permisos ──────────────────────────────────────────────────────

  const rol = usuario?.rol
  const esAdminSupervisor = rol === 'ADMINISTRADOR' || rol === 'SUPERVISOR'
  const puedeRegistrarCobro = rol === 'SUPERVISOR_CAMPO' || rol === 'ASESOR_COBRADOR'

  // ── Helpers de estado de calendario ──────────────────────────────

  function esVencido(fechaProgramada: string, estado: string) {
    const fechaIso = fechaProgramada?.slice(0, 10)
    return estado === 'PENDIENTE' && Boolean(fechaIso) && fechaIso < hoyIso
  }

  function esSlotAdeudoParaCorriente(pago: { estado: string; fechaProgramada?: string | null }) {
    const fechaIso = pago.fechaProgramada?.slice(0, 10)
    return pago.estado === 'NO_PAGADO' ||
      pago.estado === 'RECUPERADO_PARCIAL' ||
      (pago.estado === 'PENDIENTE' && typeof fechaIso === 'string' && fechaIso <= hoyIso)
  }

  // ── Stats ─────────────────────────────────────────────────────────

  const { estadisticas: stats } = credito
  const calendario = credito.calendario ?? []
  const evidenciaUrls = credito.evidenciaUrls ?? []
  const fechasAdeudoParaCorriente = new Set(
    calendario
      .filter(esSlotAdeudoParaCorriente)
      .map((pago) => pago.fechaProgramada?.slice(0, 10))
      .filter(Boolean),
  )
  const multasPendientesParaCorriente = multasPreviewAdeudo
    .filter((multa) => !multa.cobrada && fechasAdeudoParaCorriente.has(multa.fecha?.slice(0, 10)))
    .reduce((sum, multa) => sum + Number(multa.monto ?? 0), 0)
  const multasPendientesVisual = Math.max(
    Number(stats.multasPendientes ?? 0),
    multasPendientesParaCorriente,
  )
  const pagosVencidosVisuales = calendario.filter(
    (p) => p.estado === 'PENDIENTE' && p.fechaProgramada != null && p.fechaProgramada.slice(0, 10) < hoyIso,
  ).length
  const pagosVencidosTotales = Math.max(stats.pagosVencidos ?? 0, pagosVencidosVisuales)
  const tieneRecuperadoParcial = calendario.some((p) => p.estado === 'RECUPERADO_PARCIAL')
  const tieneAdeudoPendiente =
    pagosVencidosTotales > 0 || tieneRecuperadoParcial || multasPendientesVisual > 0
  const pagoPeriodicoCalendario = calendario.length > 0 ? calendario[0].montoEsperado : null
  const pagoPeriodicoVisual = pagoPeriodicoCalendario ?? credito.pagoPeriodico
  const hayDiferenciaPagoHistorico =
    pagoPeriodicoCalendario != null &&
    Number.isFinite(credito.pagoPeriodico) &&
    Math.abs(Number(pagoPeriodicoCalendario) - Number(credito.pagoPeriodico)) > 0.009
  const fechaPago = hoyIso
  const pagoPendienteHoy = calendario.find(
    (p) => p.estado === 'PENDIENTE' && p.fechaProgramada?.slice(0, 10) === fechaPago,
  )
  const tienePagosFuturos = calendario.some(
    (p) => p.estado === 'PENDIENTE' && p.fechaProgramada?.slice(0, 10) > fechaPago,
  )
  const siguientePendiente = calendario.find((p) => p.estado === 'PENDIENTE')
  const numeroPagoHoy = pagoPendienteHoy?.numeroPago ?? siguientePendiente?.numeroPago ?? null
  const totalAPagarCredito =
    credito.totalAPagar ??
    ((credito.montoCapital ?? 0) + (credito.cargoFinanciero ?? 0))
  const pagosHistorialCredito = pagosHistorial.filter((p) => p.creditoId === numId)
  const totalCobradoPagosRuta = pagosHistorialCredito
    .reduce((sum, p) => sum + Number(p.montoRecibido ?? 0), 0)
  const totalCuotaPagosRuta = pagosHistorialCredito
    .reduce((sum, p) => {
      const recibido = Number(p.montoRecibido ?? 0)
      const multa = Number(p.multaAplicada ?? 0)
      return sum + Math.max(recibido - multa, 0)
    }, 0)
  const totalCobradoAbonos = abonosCredito
    .reduce((sum, a) => sum + Number(a.montoDistribuido ?? 0), 0)
  const totalCuotaAbonos = abonosCredito
    .reduce((sum, a) => (
      sum + a.coberturas.reduce((sub, c) => sub + Number(c.montoCuota ?? 0), 0)
    ), 0)
  const totalCobradoCredito = totalCobradoPagosRuta + totalCobradoAbonos
  const totalAplicadoACredito = totalCuotaPagosRuta + totalCuotaAbonos
  const saldoRestante = Math.max(totalAPagarCredito - totalAplicadoACredito, 0)
  const multasCalendario = [
    ...multasCredito,
    ...multasPreviewAdeudo.filter(
      (multaPreview) => !multaPreview.id || !multasCredito.some((multa) => multa.id === multaPreview.id),
    ),
  ]
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
  const abonosAplicadosPorNumero = abonosCredito
    .flatMap((abono) => abono.coberturas)
    .reduce<Record<number, number>>((acc, cobertura) => {
      acc[cobertura.numeroPago] = (acc[cobertura.numeroPago] ?? 0) + Number(cobertura.totalAplicado ?? 0)
      return acc
    }, {})
  const multasPendientesPorFechaAdeudo = multasPreviewAdeudo
    .filter((multa) => !multa.cobrada)
    .reduce<Record<string, number>>((acc, multa) => {
      const fecha = multa.fecha?.slice(0, 10)
      const monto = Number(multa.monto ?? 0)
      if (fecha && fechasAdeudoParaCorriente.has(fecha) && monto > 0) {
        acc[fecha] = (acc[fecha] ?? 0) + monto
      }
      return acc
    }, {})
  const adeudoParaPonerseCorriente = calendario.reduce((sum, pago) => {
    if (!esSlotAdeudoParaCorriente(pago)) return sum
    const fecha = pago.fechaProgramada?.slice(0, 10) ?? ''
    const cuota = Number(pago.montoEsperado ?? 0)
    const multa = multasPendientesPorFechaAdeudo[fecha] ?? 0
    const yaAbonado = abonosAplicadosPorNumero[pago.numeroPago] ?? 0
    return sum + Math.max(cuota + multa - yaAbonado, 0)
  }, 0)

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            className="btn btn-sm mt-0.5 shrink-0"
            onClick={() => navigate('/creditos-nuevos')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-[#212529]">
                Crédito #{credito.id} — {credito.cliente.nombreCompleto}
              </h1>
              <div className="flex items-center gap-2">
                <TipoCreditoBadge tipo={credito.tipo ?? 'NUEVO'} />
                <TipoPagoBadge tipo={(credito.tipoPago ?? 'DIARIO') as TipoPago} />
                <CreditoEstadoBadge estado={credito.estado} />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {credito.sucursal.nombre} · {credito.asesor.nombreCompleto}
            </p>
          </div>
        </div>

        {/* Botones de acción por estado */}
        <div className="flex gap-2 shrink-0">
          {credito.estado === 'SOLICITADO' && esAdminSupervisor && (
            <button
              className="btn-primary btn btn-sm"
              onClick={() => navigate('/creditos-nuevos', { state: { initialTab: 'evaluacion', initialCreditoId: credito.id } })}
            >
              Evaluar
            </button>
          )}
          {credito.estado === 'APROBADO' && esAdminSupervisor && (
            <button
              className="btn-primary btn btn-sm"
              onClick={() => navigate('/creditos-nuevos', { state: { initialTab: 'desembolso', initialCreditoId: credito.id } })}
            >
              Desembolsar
            </button>
          )}
          {credito.estado === 'ACTIVO' && puedeRegistrarCobro && !tieneAdeudoPendiente && (
            <button
              className="btn-primary btn btn-sm"
              onClick={() => setRegistrarPagoOpen(true)}
            >
              Registrar Pago
            </button>
          )}
          {credito.estado === 'ACTIVO' && (puedeRegistrarCobro || esAdminSupervisor) &&
            tieneAdeudoPendiente && (
            <button
              className="btn btn-sm border-[#d97706] text-[#d97706] hover:bg-[#fef3c7]"
              onClick={() => setAdeudoOpen(true)}
            >
              Pagar adeudo
            </button>
          )}
          {credito.estado === 'ACTIVO' && (puedeRegistrarCobro || esAdminSupervisor) &&
            !tieneAdeudoPendiente && !pagoPendienteHoy && tienePagosFuturos && (
            <button
              className="btn btn-sm border-blue-600 text-blue-700 hover:bg-blue-50"
              onClick={() => setAdelantoOpen(true)}
            >
              Adelantar pagos
            </button>
          )}
          {credito.estado === 'ACTIVO' && esAdminSupervisor &&
            pagosHistorialCredito.length === 0 &&
            abonosCredito.length === 0 && (
            <button
              className="btn btn-sm border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => { setRevertirOpen(true); setRevertirMotivo('') }}
            >
              Revertir desembolso
            </button>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="metric-card">
          <span className="metric-label">{credito.montoAprobado != null ? 'Monto aprobado' : 'Monto solicitado'}</span>
          <span className="metric-val">{fmtMoney(credito.montoAprobado ?? credito.montoSolicitado)}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Pago {credito.tipoPago === 'SEMANAL' ? 'semanal' : 'diario'}</span>
          <span className="metric-val">{fmtMoney(pagoPeriodicoVisual)}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Progreso</span>
          <span className="metric-val">
            {stats.pagosRealizados} / {credito.plazoDias} pagos
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Vencimiento</span>
          <span className="metric-val text-sm">{fmtDate(credito.fechaVencimiento)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        {/* Tab nav */}
        <div className="flex border-b border-[#e9ecef] overflow-x-auto">
          {(
            [
              { key: 'informacion', label: 'Información' },
              { key: 'calendario', label: 'Calendario' },
              { key: 'evidencia', label: 'Evidencia' },
              ...(['SOLICITADO', 'APROBADO'].includes(credito.estado)
                ? []
                : [{ key: 'video' as Tab, label: 'Video de entrega' }]),
            ] as { key: Tab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === key
                  ? 'border-[#3d6b35] text-[#3d6b35]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4 sm:p-6">
          {/* ── Tab 1: Información ─────────────────────────────────── */}
          {tab === 'informacion' && (
            <div className="space-y-6">
              {hayDiferenciaPagoHistorico && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  El calendario histórico usa un pago por cuota de {fmtMoney(pagoPeriodicoCalendario)} y difiere del cálculo actual ({fmtMoney(credito.pagoPeriodico)}).
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Datos del crédito */}
                <section>
                  <h2 className="text-sm font-semibold text-[#3d6b35] uppercase tracking-wide mb-3">
                    Datos del crédito
                  </h2>
                  <div className="space-y-0.5">
                    <Row label="Capital solicitado" value={fmtMoney(credito.montoSolicitado)} />
                    <Row label="Monto aprobado" value={fmtMoney(credito.montoAprobado)} />
                    <Row label="Tasa de interés" value={fmtPct(credito.tasaInteres)} />
                    <Row label="Cargo financiero" value={fmtMoney(credito.cargoFinanciero)} />
                    <Row label="Total a pagar" value={fmtMoney(totalAPagarCredito)} />
                    <Row label={`Pago ${credito.tipoPago === 'SEMANAL' ? 'semanal' : 'diario'}`} value={fmtMoney(pagoPeriodicoVisual)} />
                    <Row label="Pago adelantado" value={fmtMoney(credito.pagoAdelantado)} />
                    <Row
                      label="Forma de pago"
                      value={credito.tipoPago === 'DIARIO' ? 'Diario' : 'Semanal'}
                    />
                    <Row label="Plazo" value={`${credito.plazoDias} ${credito.tipoPago === 'SEMANAL' ? 'semanas' : 'días'}`} />
                    <Row label="Fecha inicio" value={fmtDate(credito.fechaInicio)} />
                    <Row label="Fecha vencimiento" value={fmtDate(credito.fechaVencimiento)} />
                    {credito.garantiaDescripcion && (
                      <Row label="Garantía material" value={credito.garantiaDescripcion} />
                    )}
                  </div>
                </section>

                {/* Proceso */}
                <section>
                  <h2 className="text-sm font-semibold text-[#3d6b35] uppercase tracking-wide mb-3">
                    Proceso
                  </h2>
                  <div className="space-y-0.5">
                    <Row label="Estado" value={ESTADO_LABELS[credito.estado] ?? credito.estado} />
                    <Row label="Asesor" value={credito.asesor.nombreCompleto} />
                    <Row label="Sucursal" value={credito.sucursal.nombre} />
                    <Row label="Fecha solicitud" value={fmtDate(credito.createdAt)} />
                    <Row label="Aprobado por" value={credito.aprobadoPor?.nombreCompleto} />
                    <Row label="Fecha aprobación" value={fmtDate(credito.fechaAprobacion)} />
                    <Row label="Fecha desembolso" value={fmtDate(credito.fechaDesembolso)} />
                    {credito.observaciones && (
                      <Row label="Observaciones" value={credito.observaciones} />
                    )}
                  </div>
                </section>
              </div>

              {/* Estadísticas */}
              <section>
                <h2 className="text-sm font-semibold text-[#3d6b35] uppercase tracking-wide mb-3">
                  Estadísticas
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-[#16a34a]">{stats.pagosRealizados}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Pagos realizados</div>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-[#212529]">{stats.pagosPendientes}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Pendientes</div>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                    <div className={`text-xl font-bold ${pagosVencidosTotales > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
                      {pagosVencidosTotales}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Vencidos</div>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                    <div className={`text-xl font-bold ${multasPendientesVisual > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
                      {fmtMoney(multasPendientesVisual)}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Multas pendientes</div>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                    <div className={`text-xl font-bold ${stats.elegibleRenovacion ? 'text-[#16a34a]' : 'text-gray-400'}`}>
                      {stats.elegibleRenovacion ? 'Sí' : 'No'}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Elegible renovación</div>
                  </div>
                </div>
              </section>

              {/* Abonos extraordinarios */}
              {abonosCredito.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-[#3d6b35] uppercase tracking-wide mb-3">
                    Abonos extraordinarios
                  </h2>
                  <div className="space-y-2">
                    {abonosCredito.map((abono) => (
                      <button
                        key={abono.abonoId}
                        type="button"
                        onClick={() => setAbonoDetalleModal(abono)}
                        className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-100 transition-colors text-left"
                      >
                        <div>
                          <span className="text-[13px] font-semibold text-blue-800">
                            Abono #{abono.abonoId}
                          </span>
                          <span className="text-[12px] text-blue-600 ml-2">
                            {new Date(abono.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                          <span className="text-[12px] text-blue-600 ml-2">
                            — {abono.diasCubiertos} días cubiertos{abono.diasParciales > 0 ? ` + ${abono.diasParciales} parcial` : ''}
                          </span>
                        </div>
                        <div className="text-[13px] font-bold text-blue-800 shrink-0">
                          {fmtMoney(abono.montoTotal)}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Cliente card */}
              <section>
                <h2 className="text-sm font-semibold text-[#3d6b35] uppercase tracking-wide mb-3">
                  Cliente
                </h2>
                <button
                  onClick={() => navigate(`/clientes/${credito.cliente.id}`)}
                  className="w-full flex items-center justify-between p-4 bg-[#f8f9fa] hover:bg-[#eef3ee] rounded-lg border border-[#e9ecef] transition-colors text-left"
                >
                  <div>
                    <div className="font-semibold text-[#212529]">{credito.cliente.nombreCompleto}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{credito.cliente.celular}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                </button>
              </section>
            </div>
          )}

          {/* ── Tab 2: Calendario ──────────────────────────────────── */}
          {tab === 'calendario' && (
            <div className="space-y-4">
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="tabla min-w-full table-fixed">
                  <thead>
                    <tr>
                      <th className="w-12 !text-center px-2 py-3">#</th>
                      <th className="w-44 !text-center px-2 py-3">Fecha</th>
                      <th className="w-36 !text-center px-2 py-3 font-mono whitespace-nowrap">Monto esperado</th>
                      <th className="w-36 !text-center px-2 py-3 font-mono whitespace-nowrap">Monto recibido</th>
                      {hayMultasCalendario && (
                        <th className="w-28 !text-center px-2 py-3 font-mono whitespace-nowrap">Multa</th>
                      )}
                      <th className="w-40 !text-center px-2 py-3">Estado</th>
                      <th className="w-44 !text-center px-2 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendario.map((pago) => {
                      const vencido = esVencido(pago.fechaProgramada, pago.estado)
                      const pagoRegistrado = pagosHistorial.find(
                        (p) => p.creditoId === numId && p.numeroPago === pago.numeroPago
                      )

                      let rowClass = ''
                      if (pago.estado === 'RECUPERADO')        rowClass = 'bg-blue-50/60'
                      else if (pago.estado === 'RECUPERADO_PARCIAL') rowClass = 'bg-amber-50'
                      else if (pago.estado === 'ADELANTADO')   rowClass = 'bg-green-50'
                      else if (pago.estado === 'PAGADO')       rowClass = 'bg-green-50/60'
                      else if (pago.estado === 'PARCIAL')      rowClass = 'bg-amber-50'
                      else if (pago.estado === 'NO_PAGADO')    rowClass = 'bg-red-50'
                      else if (vencido)                        rowClass = 'bg-red-50'

                      let badgeCls = ''
                      let badgeLabel = ''
                      if (pago.estado === 'RECUPERADO') {
                        badgeCls = 'bg-blue-100 text-blue-700'
                        badgeLabel = 'Abono ✓'
                      } else if (pago.estado === 'RECUPERADO_PARCIAL') {
                        badgeCls = 'bg-amber-100 text-amber-800'
                        badgeLabel = 'Abono parcial'
                      } else if (pago.estado === 'ADELANTADO') {
                        badgeCls = 'bg-green-100 text-green-800'
                        badgeLabel = 'Adelantado ✓'
                      } else if (pago.estado === 'PAGADO') {
                        badgeCls = 'bg-green-100 text-green-700'
                        badgeLabel = 'Pagado'
                      } else if (pago.estado === 'PARCIAL') {
                        badgeCls = 'bg-amber-100 text-amber-800'
                        badgeLabel = 'Parcial'
                      } else if (pago.estado === 'NO_PAGADO') {
                        badgeCls = 'bg-red-100 text-red-800'
                        badgeLabel = 'No pagó'
                      } else if (vencido) {
                        badgeCls = 'bg-red-100 text-red-800'
                        badgeLabel = 'Vencido'
                      } else if ((pago.estado as string) === 'INHABILL' || (pago.estado as string) === 'INHABIL') {
                        badgeCls = 'bg-gray-100 text-gray-500'
                        badgeLabel = 'Inhábil'
                      } else {
                        badgeCls = 'bg-gray-100 text-gray-600'
                        badgeLabel = 'Pendiente'
                      }

                      const tieneRegistro = ['PAGADO', 'PARCIAL', 'NO_PAGADO', 'ADELANTADO'].includes(pago.estado)
                      const esAbono = pago.estado === 'RECUPERADO' || pago.estado === 'RECUPERADO_PARCIAL'
                      const abonoDeEstaFila = esAbono
                        ? abonosCredito.find((a) => a.coberturas.some((c) => c.numeroPago === pago.numeroPago))
                        : null
                      const fechaPagoProgramada = pago.fechaProgramada?.slice(0, 10) ?? ''
                      const multaFila = Math.max(
                        multasPorFecha[fechaPagoProgramada] ?? 0,
                        multasPagoPorNumero[pago.numeroPago] ?? 0,
                        multasAbonoPorNumero[pago.numeroPago] ?? 0,
                      )
                      const multaCubiertaAbono =
                        esAbono
                        && multaFila > 0
                        && (multasAbonoPorNumero[pago.numeroPago] ?? 0) >= multaFila

                      return (
                        <tr key={pago.id} className={rowClass}>
                          <td className="text-center font-mono text-sm px-2 py-3">{pago.numeroPago}</td>
                          <td className="text-sm text-center px-2 py-3 whitespace-nowrap">{fmtDate(pago.fechaProgramada)}</td>
                          <td className="text-center font-mono text-sm px-2 py-3 whitespace-nowrap">{fmtMoney(pago.montoEsperado)}</td>
                          <td className="text-center font-mono text-sm px-2 py-3 whitespace-nowrap">
                            {pagoRegistrado
                              ? pagoRegistrado.razonNoPago
                                ? <span className="text-[#dc2626] italic text-xs">No pagó</span>
                                : fmtMoney(pagoRegistrado.montoRecibido)
                              : (() => {
                                  if (esAbono) {
                                    const cobertura = abonosCredito
                                      .flatMap((a) => a.coberturas)
                                      .find((c) => c.numeroPago === pago.numeroPago)
                                    return cobertura
                                      ? <span className="text-blue-700 font-mono">{fmtMoney(cobertura.totalAplicado)}</span>
                                      : <span className="text-gray-400">—</span>
                                  }
                                  return <span className="text-gray-400">—</span>
                                })()
                            }
                          </td>
                          {hayMultasCalendario && (
                            <td className="text-center font-mono text-sm px-2 py-3 whitespace-nowrap">
                              {multaFila > 0
                                ? multaCubiertaAbono
                                  ? (
                                    <span className="text-blue-700" title="Multa cubierta con un abono">
                                      {fmtMoney(multaFila)}
                                      <span className="block text-[10px] font-sans font-normal leading-tight">
                                        cubierta con abono
                                      </span>
                                    </span>
                                  )
                                  : <span className="text-[#dc2626]">{fmtMoney(multaFila)}</span>
                                : <span className="text-gray-400">—</span>}
                            </td>
                          )}
                          <td className="text-center px-2 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>
                              {badgeLabel}
                            </span>
                          </td>
                          <td className="text-center px-2 py-3 whitespace-nowrap">
                            <div className="flex justify-center gap-1.5">
                              {tieneRegistro && pagoRegistrado && (
                                <button
                                  type="button"
                                  className="btn btn-sm text-xs py-0.5 px-2"
                                  onClick={() => setPagoModal(pagoRegistrado)}
                                >
                                  Ver pago
                                </button>
                              )}
                              {tieneRegistro && pagoRegistrado && esAdminSupervisor && (
                                <button
                                  type="button"
                                  className="btn btn-sm text-xs py-0.5 px-2"
                                  onClick={() => setPagoEditar(pagoRegistrado)}
                                >
                                  Modificar
                                </button>
                              )}
                              {esAbono && abonoDeEstaFila && (
                                <button
                                  type="button"
                                  className="btn btn-sm text-xs py-0.5 px-2 text-blue-700 border-blue-200 hover:bg-blue-50"
                                  onClick={() => setAbonoDetalleModal(abonoDeEstaFila)}
                                >
                                  Ver abono
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Enhanced summary */}
              {(() => {
                const pagadosCount = calendario.filter(
                  (p) => p.estado === 'PAGADO' || p.estado === 'ADELANTADO' || p.estado === 'RECUPERADO'
                ).length
                const parcialesCount = calendario.filter(
                  (p) => p.estado === 'PARCIAL' || p.estado === 'RECUPERADO_PARCIAL'
                ).length
                const noPagaronCount = calendario.filter((p) => p.estado === 'NO_PAGADO').length
                const vencidosCount = calendario.filter(
                  (p) =>
                    p.estado === 'PENDIENTE' &&
                    p.fechaProgramada != null &&
                    p.fechaProgramada.slice(0, 10) < hoyIso
                ).length
                const pendientesCount = calendario.filter(
                  (p) =>
                    p.estado === 'PENDIENTE' &&
                    p.fechaProgramada != null &&
                    p.fechaProgramada.slice(0, 10) >= hoyIso
                ).length
                const multasPend = multasPendientesVisual

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                      <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-[#16a34a]">{pagadosCount}</div>
                        <div className="text-[11px] text-gray-500">Pagados</div>
                      </div>
                      <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-amber-600">{parcialesCount}</div>
                        <div className="text-[11px] text-gray-500">Parciales</div>
                      </div>
                      <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                        <div className={`text-lg font-bold ${noPagaronCount > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
                          {noPagaronCount}
                        </div>
                        <div className="text-[11px] text-gray-500">No pagaron</div>
                      </div>
                      <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                        <div className={`text-lg font-bold ${vencidosCount > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
                          {vencidosCount}
                        </div>
                        <div className="text-[11px] text-gray-500">Vencidos</div>
                      </div>
                      <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-[#212529]">{pendientesCount}</div>
                        <div className="text-[11px] text-gray-500">Pendientes</div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 pt-1 text-sm">
                      <span className="text-[#16a34a] font-semibold">
                        Total cobrado: {fmtMoney(totalCobradoCredito)}
                      </span>
                      {multasPend > 0 && (
                        <span className="text-[#dc2626] font-semibold">
                          Multas pendientes: {fmtMoney(multasPend)}
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
                  </>
                )
              })()}
            </div>
          )}

          {/* ── Tab 3: Evidencia ───────────────────────────────────── */}
          {tab === 'evidencia' && (
            <div>
              {evidenciaUrls.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <p className="text-sm">Sin evidencia adjunta</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {evidenciaUrls.map((url, idx) => {
                    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url)
                    if (isVideo) {
                      return (
                        <button
                          key={idx}
                          type="button"
                          aria-label={`Abrir video de evidencia ${idx + 1}`}
                          onClick={() => window.open(url, '_blank')}
                          className="relative aspect-square bg-gray-900 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
                        >
                          <Play className="w-10 h-10 text-white opacity-80" />
                          <span className="absolute bottom-2 left-2 text-[10px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
                            Video
                          </span>
                        </button>
                      )
                    }
                    return (
                      <button
                        key={idx}
                        type="button"
                        aria-label={`Ver imagen de evidencia ${idx + 1}`}
                        onClick={() => {
                          setPreviewUrl(url)
                          setPreviewTitle(`Evidencia ${idx + 1}`)
                        }}
                        className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                      >
                        <SecurePreviewImage
                          fileUrl={url}
                          alt={`Evidencia ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Tab 4: Video de entrega ───────────────────────────── */}
          {tab === 'video' && (
            <div className="space-y-4">
              {credito.videoEntregaUrl && !cambiandoVideo ? (
                <div className="space-y-3">
                  <video
                    src={credito.videoEntregaUrl}
                    controls
                    className="w-full rounded-xl"
                    style={{ maxHeight: '400px' }}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={credito.videoEntregaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver en tamaño completo
                    </a>
                    <button
                      className="btn btn-sm"
                      onClick={() => setCambiandoVideo(true)}
                    >
                      Cambiar video
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cambiandoVideo && (
                    <button
                      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                      onClick={() => setCambiandoVideo(false)}
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  )}
                  <FileUpload
                    accept="video/mp4,video/quicktime,video/mov"
                    compress={true}
                    folder={`video-entrega/creditos/${numId}`}
                    label="Video de entrega de dinero"
                    onUploadComplete={(url) => subirVideoMut.mutate(url)}
                    disabled={subirVideoMut.isPending}
                  />
                  <p className="text-xs text-gray-400">
                    El video no es obligatorio para activar el crédito. Puede subirse después del desembolso
                    desde esta misma pantalla.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bloque: Liquidado por Renovación */}
      {credito.estado === 'RENOVADO' && credito.liquidadoPorRenovacion && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5 space-y-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            Liquidado por Renovación
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Fecha de renovación</div>
              <div className="font-medium text-gray-800 mt-0.5">
                {fmtDateTime(credito.liquidadoPorRenovacion.fechaRenovacion)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Pagos cubiertos</div>
              <div className="font-medium text-gray-800 mt-0.5">
                {credito.liquidadoPorRenovacion.pagosRestantes} pagos · {fmtMoney(credito.liquidadoPorRenovacion.montoPagosRestantes)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Monto crédito nuevo</div>
              <div className="font-medium text-gray-800 mt-0.5">
                {fmtMoney(credito.liquidadoPorRenovacion.montoCapitalVinculado)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Desembolso al cliente</div>
              <div className="font-semibold text-[#3d6b35] mt-0.5">
                {fmtMoney(credito.liquidadoPorRenovacion.montoDesembolso)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/creditos/${credito.liquidadoPorRenovacion!.creditoVinculadoId}`)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            Ver crédito #{credito.liquidadoPorRenovacion.creditoVinculadoId} →
          </button>
        </div>
      )}

      {/* Bloque: Originado por Renovación */}
      {credito.originadoPorRenovacion && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5 space-y-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            Originado por Renovación
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Crédito anterior</div>
              <div className="font-medium text-gray-800 mt-0.5">
                #{credito.originadoPorRenovacion.creditoVinculadoId} · {fmtMoney(credito.originadoPorRenovacion.montoCapitalVinculado)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Pagos cubiertos del anterior</div>
              <div className="font-medium text-gray-800 mt-0.5">
                {credito.originadoPorRenovacion.pagosRestantes} pagos · {fmtMoney(credito.originadoPorRenovacion.montoPagosRestantes)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/creditos/${credito.originadoPorRenovacion!.creditoVinculadoId}`)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900"
          >
            ← Ver crédito anterior #{credito.originadoPorRenovacion.creditoVinculadoId}
          </button>
        </div>
      )}

      {/* Modal Ver pago */}
      {pagoModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[2000] flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setPagoModal(null) }}
        >
          <div className="bg-white w-full sm:w-[440px] sm:max-w-[95vw] rounded-t-2xl sm:rounded-xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9ecef]">
              <div>
                <h2 className="text-[15px] font-semibold text-[#212529]">
                  Detalle del pago #{pagoModal.numeroPago}
                </h2>
                <p className="text-[12px] text-[#6c757d] mt-0.5">{pagoModal.cliente.nombreCompleto}</p>
              </div>
              <button type="button" className="btn btn-sm p-1.5" onClick={() => setPagoModal(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3">
              {([
                ['Fecha',             fmtDate(pagoModal.fechaPago)],
                ['Monto esperado',    fmtMoney(pagoModal.montoEsperado)],
                ['Monto recibido',    pagoModal.razonNoPago ? 'No pagó' : fmtMoney(pagoModal.montoRecibido)],
                ['Razón no pago',     pagoModal.razonNoPago ?? '—'],
                ['Registrado por',    pagoModal.registradoPor?.nombreCompleto ?? '—'],
                ['Fecha de registro', fmtDateTime(pagoModal.createdAt)],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between text-[13px]">
                  <span className="text-[#6c757d]">{label}</span>
                  <span className="font-medium text-[#212529] text-right max-w-[60%]">{value}</span>
                </div>
              ))}
              {pagoModal.modificadoPor && (
                <div className="pt-2 border-t border-[#f1f3f5]">
                  <p className="text-[11px] text-[#adb5bd] italic">
                    Modificado por {pagoModal.modificadoPor.nombreCompleto}
                    {pagoModal.fechaModificacion
                      ? ` el ${fmtDate(pagoModal.fechaModificacion.slice(0, 10))}`
                      : ''}
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-[#e9ecef] px-5 py-4">
              <button type="button" className="btn w-full py-2.5" onClick={() => setPagoModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar pago */}
      {registrarPagoOpen && (
        <ModalRegistrarPago
          creditoId={numId}
          pagoPeriodico={Number(pagoPeriodicoVisual) || 0}
          nombreCliente={credito.cliente.nombreCompleto}
          fecha={fechaPago}
          numeroPagoHoy={numeroPagoHoy}
          onClose={() => setRegistrarPagoOpen(false)}
          onSuccess={() => {
            setRegistrarPagoOpen(false)
            qc.invalidateQueries({ queryKey: ['credito', numId] })
            qc.invalidateQueries({ queryKey: ['pagos-cliente-credito', numId] })
          }}
        />
      )}

      {/* Modal Modificar pago */}
      {pagoEditar && (
        <ModalModificarPago
          pago={pagoEditar}
          onClose={() => setPagoEditar(null)}
          onSuccess={() => {
            setPagoEditar(null)
            qc.invalidateQueries({ queryKey: ['pagos-cliente-credito', numId] })
            qc.invalidateQueries({ queryKey: ['credito', numId] })
          }}
        />
      )}

      {/* Modal Pagar adeudo */}
      {adeudoOpen && (
        <ModalPagarAdeudo
          creditoId={numId}
          nombreCliente={credito.cliente.nombreCompleto}
          onClose={() => setAdeudoOpen(false)}
          onSuccess={() => {
            setAdeudoOpen(false)
            qc.invalidateQueries({ queryKey: ['credito', numId] })
            qc.invalidateQueries({ queryKey: ['pagos-cliente-credito', numId] })
            qc.invalidateQueries({ queryKey: ['abonos-credito', numId] })
          }}
        />
      )}

      {adelantoOpen && (
        <ModalPagarAdeudo
          creditoId={numId}
          nombreCliente={credito.cliente.nombreCompleto}
          modo="futuro"
          onClose={() => setAdelantoOpen(false)}
          onSuccess={() => {
            setAdelantoOpen(false)
            qc.invalidateQueries({ queryKey: ['credito', numId] })
            qc.invalidateQueries({ queryKey: ['pagos-cliente-credito', numId] })
            qc.invalidateQueries({ queryKey: ['abonos-credito', numId] })
          }}
        />
      )}

      {/* Modal de previsualización de imagen */}
      <ImagePreviewModal
        isOpen={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        imageUrl={previewUrl ?? ''}
        title={previewTitle}
      />

      {/* Modal Ver abono */}
      {abonoDetalleModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[2000] flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setAbonoDetalleModal(null) }}
        >
          <div className="bg-white w-full sm:w-[480px] rounded-t-2xl sm:rounded-xl max-h-[80dvh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9ecef] sticky top-0 bg-white">
              <div>
                <h2 className="text-[15px] font-semibold">Abono extraordinario #{abonoDetalleModal.abonoId}</h2>
                <p className="text-[12px] text-[#6c757d] mt-0.5">{fmtDate(abonoDetalleModal.fecha)}</p>
              </div>
              <button type="button" onClick={() => setAbonoDetalleModal(null)} className="btn btn-sm p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#f8f9fa] rounded-lg p-3">
                  <p className="text-[11px] text-[#6c757d]">Total recibido</p>
                  <p className="text-[16px] font-bold text-[#212529]">{fmtMoney(abonoDetalleModal.montoTotal)}</p>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3">
                  <p className="text-[11px] text-[#6c757d]">Días cubiertos</p>
                  <p className="text-[16px] font-bold text-[#16a34a]">{abonoDetalleModal.diasCubiertos}</p>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3">
                  <p className="text-[11px] text-[#6c757d]">Parciales</p>
                  <p className="text-[16px] font-bold text-amber-600">{abonoDetalleModal.diasParciales}</p>
                </div>
              </div>
              <div className="rounded-lg border border-[#e9ecef] overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#f8f9fa]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#6c757d] font-medium"># / Fecha</th>
                      <th className="text-right px-3 py-2 text-[#6c757d] font-medium">Cuota</th>
                      <th className="text-right px-3 py-2 text-[#6c757d] font-medium">Multa</th>
                      <th className="text-right px-3 py-2 text-[#6c757d] font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abonoDetalleModal.coberturas.map((c) => (
                      <tr key={c.numeroPago} className="border-t border-[#f1f3f5]">
                        <td className="px-3 py-2">
                          <span className="font-medium">#{c.numeroPago}</span>
                          <span className="text-[#adb5bd] ml-1">
                            — {new Date(c.fechaProgramada + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                          </span>
                          {c.esParcial && (
                            <span className="ml-1 text-amber-600 text-[10px]">(parcial)</span>
                          )}
                        </td>
                        <td className="text-right px-3 py-2 font-mono">{fmtMoney(c.montoCuota)}</td>
                        <td className="text-right px-3 py-2 font-mono">{fmtMoney(c.montoMulta)}</td>
                        <td className="text-right px-3 py-2 font-mono font-semibold">{fmtMoney(c.totalAplicado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Revertir desembolso */}
      {revertirOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Revertir desembolso</h2>
            <p className="text-sm text-gray-600">
              El crédito regresará a estado <strong>Aprobado</strong>. El calendario de pagos
              se eliminará. El dinero entregado debe ser recuperado físicamente por el asesor.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Motivo <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input w-full h-24 resize-none"
                placeholder="Ej: Cliente devolvió el dinero, desistió del crédito..."
                value={revertirMotivo}
                onChange={(e) => setRevertirMotivo(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => { setRevertirOpen(false); setRevertirMotivo('') }}
                disabled={revertirMut.isPending}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-sm bg-red-600 text-white hover:bg-red-700"
                disabled={!revertirMotivo.trim() || revertirMut.isPending}
                onClick={() => revertirMut.mutate(revertirMotivo.trim())}
              >
                {revertirMut.isPending ? 'Revirtiendo...' : 'Confirmar revertir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
