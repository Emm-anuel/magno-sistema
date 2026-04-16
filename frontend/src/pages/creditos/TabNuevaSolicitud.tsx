import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Search,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Send,
} from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { clienteService, usuarioService } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import ProductoCalculoCard from '@/components/ProductoCalculoCard'
import MultiFileUpload from '@/components/MultiFileUpload'
import SecurePreviewImage from '@/components/SecurePreviewImage'
import ProcessingOverlay from '@/components/ProcessingOverlay'
import type { ClienteResumen, ProductoCalculo } from '@/types'

interface Props {
  onSuccess?: () => void
  initialCreditoId?: number
}

type Step = 1 | 2

// ── Stepper ────────────────────────────────────────────────────────

function Stepper({ current }: { current: Step }) {
  const steps = [
    { n: 1 as Step, label: 'Datos del crédito' },
    { n: 2 as Step, label: 'Confirmación' },
  ]
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div
            className={[
              'flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold transition-colors',
              current === s.n
                ? 'bg-[#3d6b35] text-white'
                : current > s.n
                ? 'bg-green-200 text-green-800'
                : 'bg-gray-200 text-gray-500',
            ].join(' ')}
          >
            {current > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
          </div>
          <span
            className={`text-sm hidden sm:inline ${
              current === s.n ? 'font-semibold text-gray-800' : 'text-gray-400'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

// ── Main Component ─────────────────────────────────────────────────

export default function TabNuevaSolicitud({ onSuccess: _onSuccess, initialCreditoId }: Props) {
  const navigate = useNavigate()
  const { usuario } = useAuthStore()
  const queryClient = useQueryClient()
  const isEditMode = typeof initialCreditoId === 'number'

  const [step, setStep] = useState<Step>(1)

  // Form state
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteResumen | null>(null)
  const [montoStr, setMontoStr] = useState('')
  const [tipoPago, setTipoPago] = useState<'DIARIO' | 'SEMANAL'>('DIARIO')
  const [asesorId, setAsesorId] = useState<number | ''>('')
  const [garantiaDescripcion, setGarantiaDescripcion] = useState('')
  const [evidenciaUrls, setEvidenciaUrls] = useState<string[]>([])

  // Calc state
  const [calculo, setCalculo] = useState<ProductoCalculo | null>(null)
  const [calculoLoading, setCalculoLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const calcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Client search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<ClienteResumen[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const isAdminOrSup =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const isFieldUser =
    usuario?.rol === 'ASESOR_COBRADOR' || usuario?.rol === 'SUPERVISOR_CAMPO'

  const { data: creditoInicial, isLoading: creditoInicialLoading } = useQuery({
    queryKey: ['credito', initialCreditoId],
    queryFn: () => creditoService.obtener(initialCreditoId as number),
    enabled: isEditMode,
  })

  const creditoInicialRaw = creditoInicial as (typeof creditoInicial & {
    monto_capital?: number | string | null
    tipo_pago?: string | null
    garantia_descripcion?: string | null
    evidencia_urls?: string[] | null
    lugar?: string | null
    cliente?: { id?: number; nombreCompleto?: string; nombre_completo?: string; celular?: string }
    asesor?: { id?: number }
  }) | undefined

  const prefillDoneRef = useRef(false)

  useEffect(() => {
    if (!isEditMode || !creditoInicial || prefillDoneRef.current) return

    prefillDoneRef.current = true

    const montoInicial = safeNumber(creditoInicial.montoCapital ?? creditoInicialRaw?.monto_capital)
    if (montoInicial > 0) {
      setMontoStr(String(montoInicial))
      setCalculoLoading(true)
      creditoService
        .calcularProducto(montoInicial)
        .then((result) => setCalculo(result))
        .catch(() => setCalculo(null))
        .finally(() => setCalculoLoading(false))
    }

    const tipoPagoInicial = (creditoInicial.tipoPago ?? creditoInicialRaw?.tipo_pago ?? 'DIARIO') as 'DIARIO' | 'SEMANAL'
    const asesorInicialId = creditoInicial.asesor?.id ?? creditoInicialRaw?.asesor?.id
    const garantiaInicial = creditoInicial.garantiaDescripcion ?? creditoInicialRaw?.garantia_descripcion ?? ''
    const evidenciaInicial = creditoInicial.evidenciaUrls ?? creditoInicialRaw?.evidencia_urls ?? []

    setTipoPago(tipoPagoInicial)
    if (asesorInicialId != null) setAsesorId(asesorInicialId)
    setGarantiaDescripcion(garantiaInicial)
    setEvidenciaUrls(Array.isArray(evidenciaInicial) ? evidenciaInicial : [])
  }, [isEditMode, creditoInicial, creditoInicialRaw])

  // Pre-fill asesorId for field users
  useEffect(() => {
    if (isFieldUser && usuario) {
      setAsesorId(usuario.id)
    }
  }, [isFieldUser, usuario])

  // Asesores for admin/supervisor dropdown
  const { data: asesoresData } = useQuery({
    queryKey: ['usuarios-asesores'],
    queryFn: () => usuarioService.listar({ activo: true, rol: 'ASESOR_COBRADOR' }),
    enabled: isAdminOrSup,
  })

  // ── Client search ────────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await clienteService.listar({ buscar: searchQuery, size: 8 })
        setSearchResults(res.content)
        setSearchOpen(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelectCliente(c: ClienteResumen) {
    setClienteSeleccionado(c)
    setSearchQuery('')
    setSearchOpen(false)
  }

  // ── Monto / calculo ──────────────────────────────────────────────

  function handleMontoChange(val: string) {
    const clean = val.replace(/[^0-9.]/g, '')
    setMontoStr(clean)
    setCalculo(null)

    if (calcDebounceRef.current) clearTimeout(calcDebounceRef.current)

    const num = parseFloat(clean)
    if (!clean || isNaN(num) || num < 1000 || num > 50000) {
      setCalculoLoading(false)
      return
    }

    setCalculoLoading(true)
    calcDebounceRef.current = setTimeout(async () => {
      try {
        const result = await creditoService.calcularProducto(num)
        setCalculo(result)
      } catch {
        setCalculo(null)
      } finally {
        setCalculoLoading(false)
      }
    }, 500)
  }

  // ── Validation ───────────────────────────────────────────────────

  const monto = parseFloat(montoStr)
  const montoValido = !isNaN(monto) && monto >= 1000 && monto <= 50000
  const tieneCredito = isEditMode ? false : (clienteSeleccionado?.tiene_credito_activo ?? false)
  const clienteIdSeleccionado = isEditMode ? (creditoInicial?.cliente?.id ?? creditoInicialRaw?.cliente?.id) : clienteSeleccionado?.id
  const nombreCliente = isEditMode
    ? (creditoInicial?.cliente?.nombreCompleto ?? creditoInicialRaw?.cliente?.nombre_completo)
    : clienteSeleccionado?.nombre_completo
  const celularCliente = isEditMode ? (creditoInicial?.cliente?.celular ?? creditoInicialRaw?.cliente?.celular) : clienteSeleccionado?.celular
  const carpetaEvidencia = clienteIdSeleccionado ? `evidencia-negocio/${clienteIdSeleccionado}` : 'evidencia-negocio'

  const canContinue =
    clienteIdSeleccionado != null &&
    !tieneCredito &&
    montoValido &&
    calculo !== null &&
    evidenciaUrls.length > 0 &&
    asesorId !== ''

  // ── Submit ───────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: () => {
      if (isEditMode) {
        return creditoService.actualizarSolicitud(initialCreditoId as number, {
          asesorId: Number(asesorId),
          montoSolicitado: monto,
          tipoPago,
          garantiaDescripcion: garantiaDescripcion.trim() || undefined,
          evidenciaUrls,
          lugar: creditoInicial?.lugar ?? undefined,
        })
      }

      return creditoService.crearSolicitud({
        clienteId: clienteSeleccionado!.id,
        asesorId: Number(asesorId),
        sucursalId: usuario!.sucursal.id,
        montoSolicitado: monto,
        tipoPago,
        garantiaDescripcion: garantiaDescripcion.trim() || undefined,
        evidenciaUrls,
      })
    },
    onSuccess: (data) => {
      toast.success(isEditMode ? 'Solicitud actualizada correctamente' : 'Solicitud enviada correctamente')
      queryClient.invalidateQueries({ queryKey: ['creditos'] })
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['credito', initialCreditoId] })
        _onSuccess?.()
        return
      }
      navigate(`/creditos/${data.id}`)
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al enviar la solicitud'
      toast.error(msg)
    },
  })

  // ── Step 1 ────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="w-full">
        <Stepper current={1} />

        <div className="card p-6 space-y-6 w-full">

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>

            {isEditMode && creditoInicialLoading && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                Cargando datos de la solicitud...
              </div>
            )}

            {isEditMode && creditoInicial && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="font-semibold text-gray-800">
                      {creditoInicial.cliente.nombreCompleto}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 pl-5">
                    📱 {creditoInicial.cliente.celular}
                  </div>
                  <div className="text-xs text-gray-500 pl-5">
                    Cliente bloqueado durante edición de solicitud
                  </div>
                </div>
              </div>
            )}

            {!isEditMode && clienteSeleccionado ? (
              <div className="rounded-xl border border-green-300 bg-green-50 p-3 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="font-semibold text-gray-800">
                      {clienteSeleccionado.nombre_completo}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 pl-5">
                    📱 {clienteSeleccionado.celular}
                  </div>
                  <div className="text-sm text-gray-500 pl-5">
                    🏪 {clienteSeleccionado.negocio_nombre}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClienteSeleccionado(null)
                    setSearchQuery('')
                  }}
                  className="text-xs text-gray-500 underline hover:text-gray-700 flex-shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : !isEditMode ? (
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input pl-9 w-full"
                    autoComplete="off"
                  />
                  {searchLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#3d6b35] border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => handleSelectCliente(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-800">{c.nombre_completo}</div>
                        <div className="text-xs text-gray-500">
                          {c.celular} · {c.negocio_nombre}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchOpen && searchResults.length === 0 && !searchLoading && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500 text-center">
                    No se encontraron clientes
                  </div>
                )}
              </div>
            ) : null}

            {/* Active credit warning */}
            {tieneCredito && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  Este cliente ya tiene un crédito activo o en proceso. No puede solicitar uno
                  nuevo hasta completarlo.
                </p>
              </div>
            )}
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto Solicitado <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">
                $
              </span>
              <input
                type="number"
                min={1000}
                max={50000}
                step={500}
                placeholder="2000"
                value={montoStr}
                onChange={(e) => handleMontoChange(e.target.value)}
                className="input pl-7 w-full"
              />
            </div>
            {montoStr && !montoValido && (
              <p className="text-xs text-red-500 mt-1">
                El monto debe estar entre $1,000 y $50,000
              </p>
            )}
            <div className="mt-3">
              <ProductoCalculoCard calculo={calculo} loading={calculoLoading} />
            </div>
          </div>

          {/* Forma de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forma de Pago <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-6">
              {(['DIARIO', 'SEMANAL'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoPago"
                    value={v}
                    checked={tipoPago === v}
                    onChange={() => setTipoPago(v)}
                    className="w-4 h-4 accent-[#3d6b35]"
                  />
                  <span className="text-sm">{v === 'DIARIO' ? 'Diario' : 'Semanal'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Asesor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Asesor <span className="text-red-500">*</span>
            </label>
            {isFieldUser ? (
              <input
                type="text"
                value={usuario?.nombre_completo ?? ''}
                disabled
                className="input w-full"
              />
            ) : (
              <select
                value={asesorId}
                onChange={(e) =>
                  setAsesorId(e.target.value ? Number(e.target.value) : '')
                }
                className="input w-full"
              >
                <option value="">Seleccionar asesor...</option>
                {asesoresData?.content.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre_completo}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Garantía */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Garantía Material{' '}
              <span className="text-xs text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={garantiaDescripcion}
              onChange={(e) => setGarantiaDescripcion(e.target.value)}
              rows={2}
              placeholder="Describe el objeto dado en garantía (solo para préstamos grandes)"
              className="input w-full resize-none"
            />
          </div>

          {/* Evidencia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evidencia del Negocio <span className="text-red-500">*</span>
            </label>
            <MultiFileUpload
              value={evidenciaUrls}
              onChange={setEvidenciaUrls}
              folder={carpetaEvidencia}
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              label="Arrastra fotos/videos del negocio o haz clic para seleccionar"
              required
            />
          </div>

          {/* Continue */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canContinue}
              className="btn-primary flex items-center gap-2 px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Confirmation ─────────────────────────────────────────

  const asesorNombre = isFieldUser
    ? usuario?.nombre_completo
    : asesoresData?.content.find((u) => u.id === asesorId)?.nombre_completo ?? '—'

  return (
    <div className="w-full">
      <Stepper current={2} />

      <div className="space-y-4">
        {/* Cliente */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Cliente</h3>
          <div className="space-y-1 text-sm">
            <div className="font-medium text-gray-800">
              {nombreCliente ?? '—'}
            </div>
            <div className="text-gray-500">📱 {celularCliente ?? '—'}</div>
          </div>
        </div>

        {/* Condiciones */}
        {calculo && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Condiciones del crédito
            </h3>
            <div className="space-y-1.5 text-sm">
              {[
                ['Monto solicitado', `$${monto.toLocaleString('es-MX')}`],
                ['Plazo', `${safeNumber(calculo.plazo ?? (calculo as { plazo_dias?: number | string }).plazo_dias)} días`],
                ['Tasa de interés', `${(safeNumber(calculo.tasa ?? (calculo as { tasa_interes?: number | string }).tasa_interes) * 100).toFixed(0)}%`],
                [
                  'Cargo financiero',
                  `$${safeNumber(calculo.cargoFinanciero ?? (calculo as { cargo_financiero?: number | string }).cargo_financiero).toLocaleString('es-MX')}`,
                ],
                ['Total a pagar', `$${safeNumber(calculo.totalAPagar ?? (calculo as { total_apagar?: number | string }).total_apagar).toLocaleString('es-MX')}`],
                ['Pago diario', `$${safeNumber(calculo.pagoPeriodico ?? (calculo as { pago_periodico?: number | string }).pago_periodico).toLocaleString('es-MX')}`],
                [
                  'Pago adelantado',
                  `$${safeNumber(calculo.pagoAdelantado ?? (calculo as { pago_adelantado?: number | string }).pago_adelantado).toLocaleString('es-MX')} (se cobra al desembolsar)`,
                ],
                ['Forma de pago', tipoPago === 'DIARIO' ? 'Diario' : 'Semanal'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800 text-right max-w-[60%]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Archivos */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Archivos adjuntos</h3>
          <div className="flex flex-wrap gap-2">
            {evidenciaUrls.map((url, i) => (
              <div
                key={url}
                className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center"
              >
                {/\.(mp4|mov|webm)/i.test(url) ? (
                  <span className="text-xl">🎥</span>
                ) : (
                  <SecurePreviewImage
                    fileUrl={url}
                    alt={`Evidencia ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {evidenciaUrls.length} archivo{evidenciaUrls.length !== 1 ? 's' : ''} adjunto
            {evidenciaUrls.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Asesor */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Asesor</h3>
          <div className="text-sm">
            <div className="font-medium text-gray-800">{asesorNombre}</div>
            <div className="text-gray-500">{usuario?.sucursal?.nombre}</div>
          </div>
        </div>

        {/* Garantía */}
        {garantiaDescripcion.trim() && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Garantía material</h3>
            <p className="text-sm text-gray-700">{garantiaDescripcion}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="btn flex items-center gap-2 justify-center py-3"
          >
            <ChevronLeft className="w-4 h-4" /> Volver
          </button>
          <button
            type="button"
            onClick={async () => {
              setIsProcessing(true)
              try {
                await mutation.mutateAsync()
              } finally {
                setIsProcessing(false)
              }
            }}
            disabled={mutation.isPending || isProcessing}
            className="btn-primary flex items-center gap-2 justify-center flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending || isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> {isEditMode ? 'Guardar Cambios' : 'Enviar Solicitud'}
              </>
            )}
          </button>
        </div>
      </div>

      <ProcessingOverlay
        visible={mutation.isPending || isProcessing}
        title={isEditMode ? 'Guardando solicitud' : 'Enviando solicitud'}
        message="Estamos procesando los datos y los archivos adjuntos. No hagas clic otra vez."
      />
    </div>
  )
}
