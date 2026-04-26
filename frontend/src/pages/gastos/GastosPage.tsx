import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { cajaService } from '@/services/cajaService'
import { gastoService, type GastoDTO, type CategoriaGasto } from '@/services/gastoService'
import { api } from '@/services/api'
import { todayLocalStr } from '@/utils/date'

// ── Helpers ────────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

// ── Gasto Modal ────────────────────────────────────────────────────────

interface GastoModalProps {
  categorias: CategoriaGasto[]
  initial?: GastoDTO | null
  onClose: () => void
  onSave: (data: { categoriaGastoId: number; concepto: string; monto: number }) => void
  isPending: boolean
}

function GastoModal({ categorias, initial, onClose, onSave, isPending }: GastoModalProps) {
  const [categoriaGastoId, setCategoriaGastoId] = useState<number>(
    initial?.categoriaId ?? (categorias[0]?.id ?? 0)
  )
  const [concepto, setConcepto] = useState(initial?.concepto ?? '')
  const [monto, setMonto] = useState(initial ? String(initial.monto) : '')

  const valid = categoriaGastoId > 0 && concepto.trim().length > 0 && Number(monto) > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSave({ categoriaGastoId, concepto: concepto.trim(), monto: Number(monto) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[#212529]">
            {initial ? 'Editar gasto' : 'Agregar gasto'}
          </h2>
          <button type="button" onClick={onClose} className="btn btn-sm">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-[#495057] block mb-1">Categoría</label>
            <select
              value={categoriaGastoId}
              onChange={e => setCategoriaGastoId(Number(e.target.value))}
              className="input w-full"
            >
              <option value={0} disabled>Selecciona una categoría</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[12px] font-medium text-[#495057] block mb-1">Concepto</label>
            <input
              type="text"
              value={concepto}
              onChange={e => setConcepto(e.target.value)}
              placeholder="Descripción del gasto"
              className="input w-full"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-[#495057] block mb-1">Monto ($)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0"
              className="input w-full"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" className="btn btn-sm" onClick={onClose} disabled={isPending}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={!valid || isPending}
            >
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export default function GastosPage() {
  const { usuario } = useAuthStore()
  const queryClient = useQueryClient()

  const isAdmin = usuario?.rol === 'ADMINISTRADOR'
  const [fecha, setFecha] = useState(todayLocalStr())
  const [adminSucursalId, setAdminSucursalId] = useState<number | null>(null)

  const efectivaSucursalId: number | undefined = isAdmin
    ? (adminSucursalId ?? undefined)
    : usuario?.sucursal?.id

  // Sucursales (admin only)
  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales-lista'],
    queryFn: () => api.get<{ id: number; nombre: string }[]>('/sucursales').then(r => r.data),
    enabled: isAdmin,
    staleTime: 300_000,
  })

  useEffect(() => {
    if (isAdmin && sucursales.length > 0 && adminSucursalId === null) {
      setAdminSucursalId(sucursales[0].id)
    }
  }, [isAdmin, sucursales, adminSucursalId])

  const isToday = fecha === todayLocalStr()

  // Resolve cajaId
  const { data: estadoHoy } = useQuery({
    queryKey: ['caja-estado', efectivaSucursalId],
    queryFn: () => cajaService.getEstado(efectivaSucursalId),
    enabled: isToday && efectivaSucursalId !== undefined,
    staleTime: 30_000,
  })

  const { data: historialLista } = useQuery({
    queryKey: ['caja-historial-lista', efectivaSucursalId, fecha],
    queryFn: () => cajaService.getHistorialLista({ sucursalId: efectivaSucursalId, desde: fecha, hasta: fecha }),
    enabled: !isToday && efectivaSucursalId !== undefined,
    staleTime: 60_000,
  })

  const cajaId: number | null = isToday
    ? (estadoHoy?.cajaId ?? null)
    : (historialLista?.[0]?.id ?? null)

  const cajaEstado: string | null = isToday
    ? (estadoHoy?.estado ?? null)
    : (historialLista?.[0]?.estado ?? null)

  const editMode = isToday && cajaEstado === 'ABIERTA'

  // Fetch gastos
  const { data: gastosDelDia, isLoading: loadingGastos, isError: errorGastos } = useQuery({
    queryKey: ['gastos', cajaId],
    queryFn: () => gastoService.getGastos(cajaId!),
    enabled: cajaId !== null,
    staleTime: 30_000,
  })

  // Fetch categorias
  const { data: categorias = [] } = useQuery({
    queryKey: ['gastos-categorias', efectivaSucursalId],
    queryFn: () => gastoService.getCategorias(efectivaSucursalId!),
    enabled: efectivaSucursalId !== undefined,
    staleTime: 300_000,
  })

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGasto, setEditingGasto] = useState<GastoDTO | null>(null)

  // Mutations
  const registrarMut = useMutation({
    mutationFn: (data: { categoriaGastoId: number; concepto: string; monto: number }) =>
      gastoService.registrar(cajaId!, data),
    onSuccess: () => {
      toast.success('Gasto registrado')
      queryClient.invalidateQueries({ queryKey: ['gastos', cajaId] })
      setModalOpen(false)
    },
    onError: (err: any) => toast.error(err?.message ?? 'Error al registrar gasto'),
  })

  const actualizarMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { categoriaGastoId: number; concepto: string; monto: number } }) =>
      gastoService.actualizar(id, data),
    onSuccess: () => {
      toast.success('Gasto actualizado')
      queryClient.invalidateQueries({ queryKey: ['gastos', cajaId] })
      setEditingGasto(null)
      setModalOpen(false)
    },
    onError: (err: any) => toast.error(err?.message ?? 'Error al actualizar gasto'),
  })

  const eliminarMut = useMutation({
    mutationFn: (id: number) => gastoService.eliminar(id),
    onSuccess: () => {
      toast.success('Gasto eliminado')
      queryClient.invalidateQueries({ queryKey: ['gastos', cajaId] })
    },
    onError: (err: any) => toast.error(err?.message ?? 'Error al eliminar gasto'),
  })

  function handleSave(data: { categoriaGastoId: number; concepto: string; monto: number }) {
    if (editingGasto) {
      actualizarMut.mutate({ id: editingGasto.id, data })
    } else {
      registrarMut.mutate(data)
    }
  }

  function openAdd() {
    setEditingGasto(null)
    setModalOpen(true)
  }

  function openEdit(g: GastoDTO) {
    setEditingGasto(g)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingGasto(null)
  }

  const modalPending = registrarMut.isPending || actualizarMut.isPending

  return (
    <div className="space-y-5 pb-10">

      {/* Modal */}
      {modalOpen && (
        <GastoModal
          categorias={categorias}
          initial={editingGasto}
          onClose={closeModal}
          onSave={handleSave}
          isPending={modalPending}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#212529]">Gastos</h1>
          <p className="text-[13px] text-[#6c757d] mt-0.5">
            Registro de gastos operativos por día
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sucursal selector (admin only) */}
          {isAdmin && sucursales.length > 0 && (
            <select
              value={adminSucursalId ?? ''}
              onChange={e => setAdminSucursalId(Number(e.target.value))}
              className="input w-auto"
            >
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}

          {/* Date selector */}
          <input
            type="date"
            value={fecha}
            max={todayLocalStr()}
            onChange={e => setFecha(e.target.value)}
            className="input w-auto"
          />
        </div>
      </div>

      {/* Status banner */}
      {cajaId !== null && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] ${
          editMode
            ? 'bg-[#f0fdf4] border border-[#bbf7d0]'
            : 'bg-[#f8f9fa] border border-[#dee2e6]'
        }`}>
          <span className={editMode ? 'text-[#15803d] font-medium' : 'text-[#6c757d]'}>
            {editMode
              ? 'Caja abierta — puedes registrar y editar gastos'
              : `Solo lectura — caja ${cajaEstado?.toLowerCase() ?? 'cerrada'}`}
          </span>
        </div>
      )}

      {/* No caja found */}
      {!loadingGastos && cajaId === null && efectivaSucursalId !== undefined && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[#f8f9fa] border border-[#dee2e6] rounded-lg text-[13px] text-[#6c757d]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No hay caja registrada para esta fecha.
        </div>
      )}

      {/* Gastos Card */}
      {cajaId !== null && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="card-title">Gastos del Día</h2>
            {editMode && (
              <button
                type="button"
                className="btn btn-sm btn-primary flex items-center gap-1.5"
                onClick={openAdd}
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Gasto
              </button>
            )}
          </div>

          <div className="card-body">
            {loadingGastos && (
              <p className="text-[13px] text-[#6c757d] py-4 text-center">Cargando gastos…</p>
            )}

            {errorGastos && !loadingGastos && (
              <p className="text-[13px] text-[#dc2626] py-4 text-center">Error al cargar gastos.</p>
            )}

            {!loadingGastos && gastosDelDia && gastosDelDia.grupos.length === 0 && (
              <p className="text-[13px] text-[#adb5bd] py-6 text-center">
                Sin gastos registrados para esta fecha.
              </p>
            )}

            {!loadingGastos && gastosDelDia && gastosDelDia.grupos.length > 0 && (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th className="text-right">Monto</th>
                        <th>Registrado por</th>
                        <th>Hora</th>
                        {editMode && <th className="text-right">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {gastosDelDia.grupos.map(grupo => (
                        <>
                          {/* Category header row */}
                          <tr key={`cat-${grupo.categoriaId}`} className="bg-[#f8f9fa]">
                            <td
                              colSpan={editMode ? 5 : 4}
                              className="font-semibold text-[#495057] text-[12px] uppercase tracking-wide py-1.5"
                            >
                              {grupo.categoriaNombre}
                            </td>
                          </tr>

                          {/* Gasto rows */}
                          {grupo.gastos.map(g => (
                            <tr key={g.id}>
                              <td>{g.concepto}</td>
                              <td className="text-right font-mono">{fmtMoney(g.monto)}</td>
                              <td className="text-[#6c757d]">{g.registradoPorNombre}</td>
                              <td className="text-[#6c757d]">{fmtTime(g.createdAt)}</td>
                              {editMode && (
                                <td className="text-right">
                                  <div className="flex gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      onClick={() => openEdit(g)}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm text-[#dc2626]"
                                      onClick={() => eliminarMut.mutate(g.id)}
                                      disabled={eliminarMut.isPending}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}

                          {/* Subtotal row */}
                          <tr key={`sub-${grupo.categoriaId}`}>
                            <td className="text-right text-[12px] text-[#6c757d]" colSpan={editMode ? 4 : 3}>
                              Subtotal {grupo.categoriaNombre}
                            </td>
                            <td className="text-right font-mono font-semibold">
                              {fmtMoney(grupo.subtotal)}
                            </td>
                            {editMode && <td />}
                          </tr>
                        </>
                      ))}

                      {/* Total row */}
                      <tr className="border-t-2 border-[#dee2e6]">
                        <td
                          colSpan={editMode ? 4 : 3}
                          className="text-right font-bold text-[#212529]"
                        >
                          Total Gastos
                        </td>
                        <td className="text-right font-mono font-bold text-[#dc2626]">
                          {fmtMoney(gastosDelDia.total)}
                        </td>
                        {editMode && <td />}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Mobile card layout */}
                <div className="md:hidden space-y-4">
                  {gastosDelDia.grupos.map(grupo => (
                    <div key={grupo.categoriaId}>
                      <p className="text-[11px] font-semibold text-[#495057] uppercase tracking-wide mb-2 px-1">
                        {grupo.categoriaNombre}
                      </p>
                      <div className="space-y-2">
                        {grupo.gastos.map(g => (
                          <div
                            key={g.id}
                            className="border border-[#dee2e6] rounded-lg px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-[#212529] truncate">{g.concepto}</p>
                                <p className="text-[11px] text-[#6c757d]">
                                  {g.registradoPorNombre} · {fmtTime(g.createdAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono font-semibold text-[14px]">{fmtMoney(g.monto)}</span>
                                {editMode && (
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      onClick={() => openEdit(g)}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm text-[#dc2626]"
                                      onClick={() => eliminarMut.mutate(g.id)}
                                      disabled={eliminarMut.isPending}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between px-1 pt-1 border-t border-[#dee2e6] text-[12px]">
                          <span className="text-[#6c757d]">Subtotal {grupo.categoriaNombre}</span>
                          <span className="font-mono font-semibold">{fmtMoney(grupo.subtotal)}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Mobile total */}
                  <div className="flex justify-between px-1 pt-2 border-t-2 border-[#dee2e6]">
                    <span className="font-bold text-[#212529]">Total Gastos</span>
                    <span className="font-mono font-bold text-[#dc2626]">{fmtMoney(gastosDelDia.total)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
