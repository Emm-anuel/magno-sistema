import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, CheckCircle, Banknote, Plus, Pencil } from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { usuarioService } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import CreditoEstadoBadge from '@/components/CreditoEstadoBadge'
import type { CreditoResumen, EstadoCredito } from '@/types'

const ESTADOS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'SOLICITADO', label: 'Solicitado' },
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'PAGADO', label: 'Pagado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(n)
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  const date = new Date(s)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface Props {
  onEvaluar: (creditoId: number) => void
  onDesembolsar: (creditoId: number) => void
  onNuevaSolicitud: () => void
  onEditarSolicitud: (creditoId: number) => void
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function fmtPlazoDias(value: unknown): string {
  const dias = safeNumber(value)
  if (dias <= 0) return '—'
  return `${dias} días`
}

export default function TabSolicitudes({
  onEvaluar,
  onDesembolsar,
  onNuevaSolicitud,
  onEditarSolicitud,
}: Props) {
  const navigate = useNavigate()
  const { usuario } = useAuthStore()
  const isAdminOrSup =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('')
  const [asesorId, setAsesorId] = useState<number | undefined>()
  const [page, setPage] = useState(0)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['creditos', { estado, asesorId, page }],
    queryFn: () =>
      creditoService.listar({ estado: estado || undefined, asesorId, page, size: 20 }),
  })

  const { data: asesores } = useQuery({
    queryKey: ['usuarios-asesores'],
    queryFn: () => usuarioService.listar({ activo: true }),
    enabled: isAdminOrSup,
  })

  const creditos = data?.content ?? []

  // Client-side filter by name
  const filtered = buscar.trim()
    ? creditos.filter((c) =>
        (c.cliente.nombreCompleto ?? (c.cliente as { nombre_completo?: string }).nombre_completo ?? '')
          .toLowerCase()
          .includes(buscar.toLowerCase()),
      )
    : creditos

  // Metrics from current page data
  const total = data?.total_elements ?? 0
  const counts = creditos.reduce(
    (acc, c) => {
      acc[c.estado] = (acc[c.estado] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total créditos', value: total, color: 'text-gray-800' },
          { label: 'Solicitados', value: counts['SOLICITADO'] ?? 0, color: 'text-blue-700' },
          { label: 'Aprobados', value: counts['APROBADO'] ?? 0, color: 'text-yellow-700' },
          { label: 'Activos', value: counts['ACTIVO'] ?? 0, color: 'text-green-700' },
        ].map((m) => (
          <div key={m.label} className="metric-card">
            <p className="metric-label">{m.label}</p>
            <p className={`metric-val ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre de cliente..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="input pl-9 w-full"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value)
              setPage(0)
            }}
            className="input w-full sm:w-40"
          >
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
          {isAdminOrSup && asesores && (
            <select
              value={asesorId ?? ''}
              onChange={(e) => {
                setAsesorId(e.target.value ? Number(e.target.value) : undefined)
                setPage(0)
              }}
              className="input w-full sm:w-44"
            >
              <option value="">Todos los asesores</option>
              {asesores.content.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_completo}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="card p-8 text-center text-gray-500">Cargando créditos...</div>
      )}
      {isError && (
        <div className="card p-8 text-center text-red-600">Error al cargar créditos.</div>
      )}

      {/* Desktop table */}
      {!isLoading && !isError && (
        <>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onNuevaSolicitud}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nueva Solicitud
            </button>
          </div>

          <div className="card hidden lg:block overflow-x-auto">
            <table className="tabla w-full">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Pago/día</th>
                  <th>Plazo</th>
                  <th>Estado</th>
                  <th>Asesor</th>
                  <th>Fecha de solicitud</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 py-8">
                      Sin registros
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {/** Soporta ambos formatos del backend */}
                        <div className="font-medium text-gray-800">
                          {c.cliente.nombreCompleto ??
                            (c.cliente as { nombre_completo?: string }).nombre_completo}
                        </div>
                        <div className="text-xs text-gray-500">
                          {c.cliente.celular}
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const montoCapital = safeNumber(
                            c.montoCapital ??
                              (c as { monto_capital?: number | string }).monto_capital,
                          )
                          const montoAprobado =
                            c.montoAprobado == null ? null : safeNumber(c.montoAprobado)

                          return (
                            <>
                              <div>{fmt(montoCapital)}</div>
                              {montoAprobado !== null &&
                                montoAprobado > 0 &&
                                (c.estado === 'APROBADO' || c.estado === 'ACTIVO') && (
                                  <div className="text-xs text-green-700">
                                    Aprobado: {fmt(montoAprobado)}
                                  </div>
                                )}
                            </>
                          )
                        })()}
                      </td>
                      <td>
                        {fmt(
                          safeNumber(
                            c.pagoPeriodico ??
                              (c as { pago_periodico?: number | string }).pago_periodico,
                          ),
                        )}
                      </td>
                      <td>
                        {fmtPlazoDias(
                          c.plazoDias ?? (c as { plazo_dias?: number | string }).plazo_dias,
                        )}
                      </td>
                      <td>
                        <CreditoEstadoBadge
                          estado={c.estado as EstadoCredito}
                          size="sm"
                        />
                      </td>
                      <td className="text-sm">
                        {c.asesor.nombreCompleto ??
                          (c.asesor as { nombre_completo?: string }).nombre_completo}
                      </td>
                      <td className="text-sm text-gray-500">
                        {fmtDate(
                          c.createdAt ??
                            (c as { created_at?: string | null }).created_at,
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/creditos/${c.id}`)}
                            className="btn btn-sm"
                            title="Ver detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdminOrSup && c.estado === 'SOLICITADO' && (
                            <button
                              type="button"
                              onClick={() => onEditarSolicitud(c.id)}
                              className="btn btn-sm"
                              title="Editar solicitud"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isAdminOrSup && c.estado === 'SOLICITADO' && (
                            <button
                              type="button"
                              onClick={() => onEvaluar(c.id)}
                              className="btn btn-sm"
                              title="Evaluar"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isAdminOrSup && c.estado === 'APROBADO' && (
                            <button
                              type="button"
                              onClick={() => onDesembolsar(c.id)}
                              className="btn-primary btn-sm"
                              title="Desembolsar"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {filtered.length === 0 && (
              <div className="card p-6 text-center text-gray-400">Sin registros</div>
            )}
            {filtered.map((c) => (
              <MobileCard
                key={c.id}
                credito={c}
                isAdminOrSup={isAdminOrSup}
                onVer={() => navigate(`/creditos/${c.id}`)}
                onEvaluar={() => onEvaluar(c.id)}
                onDesembolsar={() => onDesembolsar(c.id)}
                onEditarSolicitud={() => onEditarSolicitud(c.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {(data?.total_pages ?? 0) > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn btn-sm"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-600 self-center">
                Página {page + 1} de {data?.total_pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data?.total_pages ?? 1) - 1}
                className="btn btn-sm"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Mobile card ────────────────────────────────────────────────────

interface MobileCardProps {
  credito: CreditoResumen
  isAdminOrSup: boolean
  onVer: () => void
  onEvaluar: () => void
  onDesembolsar: () => void
  onEditarSolicitud: () => void
}

function MobileCard({
  credito: c,
  isAdminOrSup,
  onVer,
  onEvaluar,
  onDesembolsar,
  onEditarSolicitud,
}: MobileCardProps) {
  function fmtM(n: number) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(n)
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-gray-800">
            {c.cliente.nombreCompleto ??
              (c.cliente as { nombre_completo?: string }).nombre_completo}
          </div>
          <div className="text-sm text-gray-500">{c.cliente.celular}</div>
        </div>
        <CreditoEstadoBadge estado={c.estado as EstadoCredito} size="sm" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-gray-500 text-xs">Monto</div>
          <div className="font-medium">
            {fmtM(
              safeNumber(
                c.montoCapital ?? (c as { monto_capital?: number | string }).monto_capital,
              ),
            )}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Pago/día</div>
          <div className="font-medium">
            {fmtM(
              safeNumber(
                c.pagoPeriodico ??
                  (c as { pago_periodico?: number | string }).pago_periodico,
              ),
            )}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Total días</div>
          <div className="font-medium">
            {fmtPlazoDias(
              c.plazoDias ?? (c as { plazo_dias?: number | string }).plazo_dias,
            )}
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Asesor: {c.asesor.nombreCompleto ??
          (c.asesor as { nombre_completo?: string }).nombre_completo}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onVer}
          className="btn flex-1 py-2 text-sm"
        >
          <Eye className="w-3.5 h-3.5" /> Ver
        </button>
        {isAdminOrSup && c.estado === 'SOLICITADO' && (
          <button
            type="button"
            onClick={onEditarSolicitud}
            className="btn flex-1 py-2 text-sm"
          >
            Editar
          </button>
        )}
        {isAdminOrSup && c.estado === 'SOLICITADO' && (
          <button
            type="button"
            onClick={onEvaluar}
            className="btn flex-1 py-2 text-sm"
          >
            Evaluar
          </button>
        )}
        {isAdminOrSup && c.estado === 'APROBADO' && (
          <button
            type="button"
            onClick={onDesembolsar}
            className="btn-primary flex-1 py-2 text-sm"
          >
            Desembolsar
          </button>
        )}
      </div>
    </div>
  )
}
