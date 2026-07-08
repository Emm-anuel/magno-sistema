import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { cajaService } from '@/services/cajaService'
import { inversionService } from '@/services/inversionService'
import { adminService } from '@/services/adminService'
import { api } from '@/services/api'
import { todayLocalStr } from '@/utils/date'

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

export default function InversionesPage() {
  const location = useLocation()
  const { usuario } = useAuthStore()
  const queryClient = useQueryClient()
  const esRetiroCaja = location.pathname === '/retiros-caja'

  const isAdmin = usuario?.rol === 'ADMINISTRADOR'
  const [fecha, setFecha] = useState(todayLocalStr())
  const [adminSucursalId, setAdminSucursalId] = useState<number | null>(null)

  const efectivaSucursalId: number | undefined = isAdmin
    ? (adminSucursalId ?? undefined)
    : usuario?.sucursal?.id

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

  const { data: inversiones = [], isLoading, isError } = useQuery({
    queryKey: ['inversiones', cajaId],
    queryFn: () => inversionService.getByDia(cajaId!),
    enabled: cajaId !== null,
    staleTime: 30_000,
  })

  const { data: conceptos = [] } = useQuery({
    queryKey: ['conceptos-inversion', efectivaSucursalId],
    queryFn: () => adminService.getConceptos(efectivaSucursalId!),
    enabled: !esRetiroCaja && efectivaSucursalId !== undefined,
    staleTime: 300_000,
  })

  const [showForm, setShowForm] = useState(false)
  const [conceptoId, setConceptoId] = useState<number>(0)
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')

  const montoNum = Number(monto)
  const montoValido = monto !== '' && Number.isFinite(montoNum) && montoNum !== 0
  const formValid = esRetiroCaja
    ? descripcion.trim().length > 0 && montoValido
    : conceptoId > 0 && montoValido

  function resetForm() {
    setConceptoId(0)
    setDescripcion('')
    setMonto('')
    setShowForm(false)
  }

  const registrarMut = useMutation({
    mutationFn: () => inversionService.registrar(cajaId!, {
      conceptoInversionId: esRetiroCaja ? null : conceptoId,
      descripcion: descripcion.trim() || undefined,
      monto: esRetiroCaja ? -Math.abs(montoNum) : montoNum,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inversiones', cajaId] })
      queryClient.invalidateQueries({ queryKey: ['caja-cierre-preview', efectivaSucursalId] })
      resetForm()
      toast.success('Movimiento registrado')
    },
    onError: () => toast.error('Error al registrar el movimiento'),
  })

  const eliminarMut = useMutation({
    mutationFn: (movimientoId: number) => inversionService.eliminar(cajaId!, movimientoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inversiones', cajaId] })
      queryClient.invalidateQueries({ queryKey: ['caja-cierre-preview', efectivaSucursalId] })
      toast.success('Movimiento eliminado')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const movimientosMostrados = esRetiroCaja
    ? inversiones.filter(m => m.monto < 0)
    : inversiones
  const totalMostrado = movimientosMostrados.reduce((s, m) => s + m.monto, 0)

  return (
    <div className="page-container space-y-4">
      <h1 className="page-title">{esRetiroCaja ? 'Retiros de Caja' : 'Movimientos de Inversión'}</h1>

      {/* Filtros */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <div className="flex-1 min-w-[160px]">
              <label className="text-[12px] font-medium text-[#495057] block mb-1">Sucursal</label>
              <select
                className="input"
                value={adminSucursalId ?? ''}
                onChange={e => setAdminSucursalId(Number(e.target.value))}
              >
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1 min-w-[140px]">
            <label className="text-[12px] font-medium text-[#495057] block mb-1">Fecha</label>
            <input
              type="date"
              className="input"
              value={fecha}
              max={todayLocalStr()}
              onChange={e => setFecha(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Banner estado caja */}
      {cajaId !== null && cajaEstado && (
        <div className={`rounded-lg px-4 py-2 text-[13px] font-medium flex items-center gap-2 ${
          cajaEstado === 'ABIERTA'
            ? 'bg-[#d1fae5] text-[#065f46]'
            : 'bg-[#f3f4f6] text-[#6b7280]'
        }`}>
          <span className={`w-2 h-2 rounded-full inline-block ${
            cajaEstado === 'ABIERTA' ? 'bg-[#10b981]' : 'bg-[#9ca3af]'
          }`} />
          {cajaEstado === 'ABIERTA'
            ? 'Caja abierta — puedes registrar movimientos'
            : `Caja ${cajaEstado.toLowerCase()}`}
        </div>
      )}

      {/* Sin caja */}
      {cajaId === null && !isLoading && efectivaSucursalId !== undefined && (
        <div className="alert alert-warning flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No hay caja registrada para esta fecha.
        </div>
      )}

      {/* Tabla principal */}
      {cajaId !== null && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Movimientos del día</h2>
            {editMode && !showForm && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            )}
          </div>
          <div className="card-body space-y-4">
            {/* Formulario de alta */}
            {showForm && (
              <form
                onSubmit={e => { e.preventDefault(); if (formValid) registrarMut.mutate() }}
                className="p-3 bg-[#f8f9fa] rounded-lg border border-[#dee2e6] space-y-3"
              >
                <div className={`grid grid-cols-1 ${esRetiroCaja ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3`}>
                  {!esRetiroCaja && (
                    <div>
                      <label className="block text-[12px] font-medium text-[#495057] mb-1">
                        Concepto <span className="text-[#dc2626]">*</span>
                      </label>
                      <select
                        className="input"
                        value={conceptoId}
                        onChange={e => setConceptoId(Number(e.target.value))}
                      >
                        <option value={0} disabled>Selecciona…</option>
                        {conceptos.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-[12px] font-medium text-[#495057] mb-1">
                      Descripción {esRetiroCaja && <span className="text-[#dc2626]">*</span>}
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder={esRetiroCaja ? 'Motivo del retiro' : 'Opcional'}
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#495057] mb-1">
                      {esRetiroCaja ? 'Monto del retiro' : 'Monto'} <span className="text-[#dc2626]">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={esRetiroCaja ? '0.01' : undefined}
                      className="input"
                      placeholder="0.00"
                      value={monto}
                      onChange={e => setMonto(e.target.value)}
                    />
                    {!esRetiroCaja && (
                      <p className="text-[11px] text-[#6c757d] mt-0.5">
                        Negativo para retiro / salida de capital
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn btn-sm" onClick={resetForm}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary"
                    disabled={!formValid || registrarMut.isPending}
                  >
                    {registrarMut.isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}

            {/* Lista */}
            {isLoading ? (
              <p className="text-[13px] text-[#6c757d]">Cargando…</p>
            ) : isError ? (
              <p className="text-[13px] text-[#dc2626]">Error al cargar los movimientos</p>
            ) : movimientosMostrados.length === 0 ? (
              <p className="text-[13px] text-[#adb5bd] text-center py-4">
                Sin movimientos registrados
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      {!esRetiroCaja && <th>Concepto</th>}
                      <th>Descripción</th>
                      <th className="text-right">Monto</th>
                      <th>Registrado por</th>
                      <th>Hora</th>
                      {editMode && <th className="w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosMostrados.map(m => (
                      <tr key={m.id}>
                        {!esRetiroCaja && (
                          <td className="font-medium">{m.conceptoNombre ?? '—'}</td>
                        )}
                        <td className="text-[#6c757d]">{m.descripcion ?? '—'}</td>
                        <td className={`text-right font-mono ${m.monto < 0 ? 'text-[#dc2626]' : ''}`}>
                          {fmtMoney(m.monto)}
                        </td>
                        <td className="text-[#6c757d]">{m.registradoPorNombre}</td>
                        <td className="text-[#6c757d]">{fmtTime(m.createdAt)}</td>
                        {editMode && (
                          <td>
                            <button
                              type="button"
                              className="text-[#adb5bd] hover:text-[#dc2626] transition-colors"
                              onClick={() => {
                                if (window.confirm('¿Eliminar este movimiento?')) {
                                  eliminarMut.mutate(m.id)
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Subtotal */}
            {movimientosMostrados.length > 0 && (
              <div className="text-right text-[13px]">
                <span className="text-[#6c757d]">
                  {esRetiroCaja ? 'Subtotal retiros: ' : 'Subtotal inversiones: '}
                </span>
                <span className={`font-semibold font-mono ${totalMostrado < 0 ? 'text-[#dc2626]' : ''}`}>
                  {fmtMoney(totalMostrado)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
