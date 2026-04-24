import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Loader2, Plus, X, CalendarDays } from 'lucide-react'
import { adminService } from '@/services/adminService'

// ── Tipos ─────────────────────────────────────────────────────────────

interface DiaInhabil {
  id: number
  fecha: string       // "YYYY-MM-DD"
  descripcion: string
}

// ── Helpers ───────────────────────────────────────────────────────────

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DOW_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DOW_LABELS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function fechaKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay()
  return dow === 0 || dow === 6
}

/** Devuelve array de 7*N celdas; null = celda vacía de relleno. */
function calendarCells(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay()          // 0=Dom
  const startPad = (firstDow + 6) % 7                         // lunes=0
  const total    = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(startPad).fill(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]} ${y}`
}

function dowLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return DOW_LABELS[new Date(y, m - 1, d).getDay()]
}

// ── Calendario de un mes ──────────────────────────────────────────────

interface MonthCardProps {
  year: number
  month: number                       // 0-indexed
  inhabiles: Map<string, string>      // fecha → descripcion
}

function MonthCard({ year, month, inhabiles }: MonthCardProps) {
  const cells = calendarCells(year, month)

  return (
    <div className="card p-2 sm:p-3">
      {/* Nombre del mes */}
      <p className="text-[10px] sm:text-[11px] font-semibold text-center text-[#495057] mb-1.5 uppercase tracking-wide">
        {MESES[month]}
      </p>

      {/* Cabecera días de la semana */}
      <div className="grid grid-cols-7 mb-0.5">
        {DOW_HEADERS.map(d => (
          <div key={d} className="text-[8px] sm:text-[9px] text-center text-[#ced4da] font-medium py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="py-[3px]" />

          const key     = fechaKey(year, month, day)
          const weekend = isWeekend(year, month, day)
          const inhabil = inhabiles.has(key)
          const desc    = inhabiles.get(key)

          let cls = 'text-[#495057]'
          if (inhabil)      cls = 'bg-[#fef3c7] text-[#92400e] font-semibold rounded'
          else if (weekend) cls = 'text-[#ced4da]'

          return (
            <div
              key={i}
              title={inhabil ? desc : undefined}
              className={`text-[9px] sm:text-[10px] text-center py-[3px] cursor-default ${cls}`}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────

export default function TabDiasInhabiles() {
  const qc = useQueryClient()
  const currentYear = new Date().getFullYear()

  const [year, setYear]         = useState(currentYear)
  const [editando, setEditando] = useState<DiaInhabil | null>(null)
  const [form, setForm]         = useState({ fecha: '', descripcion: '' })

  // ── Datos ──────────────────────────────────────────────────────────

  const { data: dias = [], isLoading } = useQuery<DiaInhabil[]>({
    queryKey: ['admin-dias-inhabiles'],
    queryFn:  () => adminService.getDiasInhabiles(),
  })

  // Map para el calendario: fecha → descripcion (solo año visible)
  const inhabiles = new Map<string, string>(
    dias
      .filter(d => d.fecha.startsWith(String(year)))
      .map(d => [d.fecha, d.descripcion]),
  )

  // Lista completa ordenada por fecha
  const diasOrdenados = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha))

  // ── Mutations ──────────────────────────────────────────────────────

  const crearMutation = useMutation({
    mutationFn: () => adminService.crearDiaInhabil({ fecha: form.fecha, descripcion: form.descripcion.trim() }),
    onSuccess: () => {
      toast.success('Día inhábil registrado')
      qc.invalidateQueries({ queryKey: ['admin-dias-inhabiles'] })
      setForm({ fecha: '', descripcion: '' })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Error al guardar'),
  })

  const actualizarMutation = useMutation({
    mutationFn: () =>
      adminService.actualizarDiaInhabil(editando!.id, { fecha: form.fecha, descripcion: form.descripcion.trim() }),
    onSuccess: () => {
      toast.success('Día inhábil actualizado')
      qc.invalidateQueries({ queryKey: ['admin-dias-inhabiles'] })
      cancelarEdicion()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Error al actualizar'),
  })

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => adminService.eliminarDiaInhabil(id),
    onSuccess: () => {
      toast.success('Día inhábil eliminado')
      qc.invalidateQueries({ queryKey: ['admin-dias-inhabiles'] })
    },
    onError: () => toast.error('Error al eliminar'),
  })

  // ── Handlers ──────────────────────────────────────────────────────

  function iniciarEdicion(d: DiaInhabil) {
    setEditando(d)
    setForm({ fecha: d.fecha, descripcion: d.descripcion })
    // Scroll al formulario en móvil
    document.getElementById('dia-inhabil-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function cancelarEdicion() {
    setEditando(null)
    setForm({ fecha: '', descripcion: '' })
  }

  function handleGuardar() {
    if (editando) actualizarMutation.mutate()
    else crearMutation.mutate()
  }

  const isPending  = crearMutation.isPending || actualizarMutation.isPending
  const formValido = form.fecha && form.descripcion.trim()

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Calendario anual ─────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Calendario {year}</span>
          {/* Navegación de año */}
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm"
              onClick={() => setYear(y => y - 1)}
              title="Año anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-semibold text-[#495057] w-12 text-center select-none">
              {year}
            </span>
            <button
              className="btn btn-sm"
              onClick={() => setYear(y => y + 1)}
              title="Año siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="card-body pt-3">
          {/* Leyenda */}
          <div className="flex flex-wrap gap-3 mb-4 text-[11px] text-[#495057]">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-4 rounded bg-[#fef3c7] border border-[#fde68a]" />
              Día inhábil registrado
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#ced4da] text-[12px] font-semibold">8</span>
              Fin de semana
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#495057] text-[12px]">8</span>
              Día hábil
            </div>
          </div>

          {/* Grid de 12 meses */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="card p-3 h-[110px] animate-pulse bg-[#f8f9fa]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Array.from({ length: 12 }, (_, m) => (
                <MonthCard key={m} year={year} month={m} inhabiles={inhabiles} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Lista + Formulario ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Lista de días registrados */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <span className="card-title">
              Días inhábiles registrados
              {dias.length > 0 && (
                <span className="ml-2 badge badge-azul">{dias.length}</span>
              )}
            </span>
          </div>

          {isLoading ? (
            <p className="text-center text-[#adb5bd] text-[13px] py-8">Cargando...</p>
          ) : diasOrdenados.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarDays className="w-8 h-8 text-[#dee2e6] mx-auto mb-2" />
              <p className="text-[13px] text-[#adb5bd]">Sin días inhábiles registrados</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Día</th>
                      <th>Descripción</th>
                      <th className="text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasOrdenados.map(d => (
                      <tr
                        key={d.id}
                        className={editando?.id === d.id ? 'bg-[#fffbeb]' : ''}
                      >
                        <td className="font-mono text-[12px]">{formatFecha(d.fecha)}</td>
                        <td>
                          <span className={`text-[11px] font-medium ${
                            isWeekend(
                              Number(d.fecha.split('-')[0]),
                              Number(d.fecha.split('-')[1]) - 1,
                              Number(d.fecha.split('-')[2]),
                            ) ? 'text-[#adb5bd]' : 'text-[#495057]'
                          }`}>
                            {dowLabel(d.fecha)}
                          </span>
                        </td>
                        <td className="text-[#212529]">{d.descripcion}</td>
                        <td className="text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              className="btn btn-sm"
                              onClick={() => iniciarEdicion(d)}
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="btn btn-sm text-[#dc2626]"
                              onClick={() => eliminarMutation.mutate(d.id)}
                              disabled={eliminarMutation.isPending}
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[#e9ecef]">
                {diasOrdenados.map(d => (
                  <div
                    key={d.id}
                    className={`px-4 py-3 flex items-start gap-3 ${editando?.id === d.id ? 'bg-[#fffbeb]' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[12px] font-mono font-medium text-[#212529]">
                          {formatFecha(d.fecha)}
                        </span>
                        <span className="text-[10px] text-[#adb5bd]">{dowLabel(d.fecha)}</span>
                      </div>
                      <p className="text-[12px] text-[#495057] truncate">{d.descripcion}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button className="btn btn-sm" onClick={() => iniciarEdicion(d)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="btn btn-sm text-[#dc2626]"
                        onClick={() => eliminarMutation.mutate(d.id)}
                        disabled={eliminarMutation.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Formulario */}
        <div id="dia-inhabil-form" className="card self-start">
          <div className="card-header">
            <span className="card-title">
              {editando ? 'Editar día inhábil' : 'Registrar día inhábil'}
            </span>
            {editando && (
              <button
                className="btn btn-sm"
                onClick={cancelarEdicion}
                title="Cancelar edición"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="card-body space-y-4">
            {editando && (
              <div className="alert alert-warn text-[12px] py-2">
                Editando: <strong>{formatFecha(editando.fecha)}</strong>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Fecha <span className="text-[#dc2626]">*</span>
              </label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                className="input"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Descripción <span className="text-[#dc2626]">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Día de la Independencia"
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                className="input"
                onKeyDown={e => e.key === 'Enter' && formValido && handleGuardar()}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary flex-1"
                onClick={handleGuardar}
                disabled={!formValido || isPending}
              >
                {isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : editando ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />
                }
                {editando ? 'Actualizar' : 'Agregar'}
              </button>
              {editando && (
                <button className="btn" onClick={cancelarEdicion}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
