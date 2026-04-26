import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChevronDown, ChevronUp, Plus, Pencil, Trash2, Loader2, Save,
} from 'lucide-react'
import { adminService } from '@/services/adminService'
import type { AdminConfigMulta, AdminRangoCredito, AdminNomina, AdminConcepto } from '@/services/adminService'
import { gastoService, type CategoriaGasto } from '@/services/gastoService'

// ── Helpers ───────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function pagoEstimado(rangoMin: number, tasaInteres: number, plazo: number) {
  if (!rangoMin || !plazo) return 0
  return Math.round(rangoMin * (1 + tasaInteres) / plazo)
}

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES']

// ── Collapsible card ──────────────────────────────────────────────────

interface SectionCardProps {
  title: string
  subtitle?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

function SectionCard({ title, subtitle, open, onToggle, children }: SectionCardProps) {
  return (
    <div className="card">
      <button
        type="button"
        className="card-header w-full text-left hover:bg-[#f8f9fa] transition-colors rounded-t-[10px]"
        onClick={onToggle}
      >
        <div>
          <p className="card-title">{title}</p>
          {subtitle && <p className="text-[11px] text-[#adb5bd] mt-0.5">{subtitle}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#adb5bd] shrink-0" />
               : <ChevronDown className="w-4 h-4 text-[#adb5bd] shrink-0" />}
      </button>
      {open && <div className="card-body">{children}</div>}
    </div>
  )
}

// ── Sección 1 — Multas ───────────────────────────────────────────────

function SeccionMultas({ sucursalId }: { sucursalId: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [rows, setRows] = useState<AdminConfigMulta[]>([])

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-multas', sucursalId],
    queryFn: () => adminService.getMultas(sucursalId),
  })

  useEffect(() => { setRows(data) }, [data])

  const mutation = useMutation({
    mutationFn: async () => {
      for (const m of rows) {
        await adminService.saveMulta(sucursalId, m.id, {
          rangoMin:                m.rangoMin,
          rangoMax:                m.rangoMax,
          multaNoPago:             m.multaNoPago,
          multaIncompletos:        m.multaIncompletos,
          multaSemanalNoPago:      m.multaSemanalNoPago,
          multaSemanalIncompletos: m.multaSemanalIncompletos,
        })
      }
    },
    onSuccess: () => {
      toast.success('Multas actualizadas')
      qc.invalidateQueries({ queryKey: ['admin-multas', sucursalId] })
    },
    onError: () => toast.error('Error al guardar multas'),
  })

  function update(idx: number, field: keyof AdminConfigMulta, value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: Number(value) || 0 } : r))
  }

  return (
    <SectionCard
      title="Multas"
      subtitle="Montos por incumplimiento según rango de crédito"
      open={open}
      onToggle={() => setOpen(v => !v)}
    >
      {isLoading ? (
        <p className="text-[#adb5bd] text-[13px] py-4 text-center">Cargando...</p>
      ) : rows.length === 0 ? (
        <p className="text-[#adb5bd] text-[13px]">Sin configuración de multas.</p>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto mb-4">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Rango de monto</th>
                  <th className="text-right">No pago (diario)</th>
                  <th className="text-right">Incompleto (diario)</th>
                  <th className="text-right">No pago (semanal)</th>
                  <th className="text-right">Incompleto (semanal)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={m.id}>
                    <td className="font-medium text-[#495057]">
                      ${fmt(m.rangoMin)} – ${fmt(m.rangoMax)}
                    </td>
                    {(
                      [
                        ['multaNoPago', m.multaNoPago],
                        ['multaIncompletos', m.multaIncompletos],
                        ['multaSemanalNoPago', m.multaSemanalNoPago],
                        ['multaSemanalIncompletos', m.multaSemanalIncompletos],
                      ] as [keyof AdminConfigMulta, number][]
                    ).map(([field, val]) => (
                      <td key={field} className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[#adb5bd] text-[12px]">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={val}
                            onChange={e => update(i, field, e.target.value)}
                            className="input text-right w-24"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3 mb-4">
            {rows.map((m, i) => (
              <div key={m.id} className="border border-[#e9ecef] rounded-lg p-3 space-y-2">
                <p className="text-[12px] font-semibold text-[#495057]">
                  Rango: ${fmt(m.rangoMin)} – ${fmt(m.rangoMax)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['multaNoPago', 'No pago diario', m.multaNoPago],
                      ['multaIncompletos', 'Incompleto diario', m.multaIncompletos],
                      ['multaSemanalNoPago', 'No pago semanal', m.multaSemanalNoPago],
                      ['multaSemanalIncompletos', 'Incompleto semanal', m.multaSemanalIncompletos],
                    ] as [keyof AdminConfigMulta, string, number][]
                  ).map(([field, label, val]) => (
                    <div key={field}>
                      <p className="text-[10px] text-[#adb5bd] mb-0.5">{label}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-[#adb5bd] text-[12px]">$</span>
                        <input
                          type="number"
                          min="0"
                          value={val}
                          onChange={e => update(i, field, e.target.value)}
                          className="input text-right"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar multas
            </button>
          </div>
        </>
      )}
    </SectionCard>
  )
}

// ── Sección 2 — Rangos de Crédito ────────────────────────────────────

type RangoRow = { rangoMin: number; rangoMax: number; plazo: number; tasaInteres: number }

function SeccionRangos({ sucursalId }: { sucursalId: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [diario, setDiario] = useState<RangoRow[]>([])
  const [semanal, setSemanal] = useState<RangoRow[]>([])

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-rangos', sucursalId],
    queryFn: () => adminService.getRangos(sucursalId),
  })

  useEffect(() => {
    setDiario(data.filter(r => r.tipoPago === 'DIARIO').map(r => ({
      rangoMin: r.rangoMin, rangoMax: r.rangoMax, plazo: r.plazo, tasaInteres: r.tasaInteres,
    })))
    setSemanal(data.filter(r => r.tipoPago === 'SEMANAL').map(r => ({
      rangoMin: r.rangoMin, rangoMax: r.rangoMax, plazo: r.plazo, tasaInteres: r.tasaInteres,
    })))
  }, [data])

  const mutation = useMutation({
    mutationFn: () => adminService.saveRangos(sucursalId, { diario, semanal }),
    onSuccess: () => {
      toast.success('Rangos actualizados')
      qc.invalidateQueries({ queryKey: ['admin-rangos', sucursalId] })
    },
    onError: () => toast.error('Error al guardar rangos'),
  })

  function updateRow(tipo: 'diario' | 'semanal', idx: number, field: keyof RangoRow, value: string) {
    const setter = tipo === 'diario' ? setDiario : setSemanal
    setter(prev => prev.map((r, i) => i === idx ? { ...r, [field]: Number(value) || 0 } : r))
  }

  function addRow(tipo: 'diario' | 'semanal') {
    const blank: RangoRow = { rangoMin: 0, rangoMax: 0, plazo: tipo === 'diario' ? 25 : 8, tasaInteres: tipo === 'diario' ? 0.30 : 0.40 }
    if (tipo === 'diario') setDiario(prev => [...prev, blank])
    else setSemanal(prev => [...prev, blank])
  }

  function removeRow(tipo: 'diario' | 'semanal', idx: number) {
    if (tipo === 'diario') setDiario(prev => prev.filter((_, i) => i !== idx))
    else setSemanal(prev => prev.filter((_, i) => i !== idx))
  }

  function RangoTable({ rows, tipo }: { rows: RangoRow[]; tipo: 'diario' | 'semanal' }) {
    return (
      <div>
        <p className="text-[11px] font-semibold text-[#495057] uppercase tracking-wide mb-2">
          {tipo === 'diario' ? 'Crédito Diario' : 'Crédito Semanal'}
        </p>

        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto mb-2">
          <table className="tabla">
            <thead>
              <tr>
                <th>Desde</th>
                <th>Hasta</th>
                <th>{tipo === 'diario' ? 'Días' : 'Semanas'}</th>
                <th>Tasa %</th>
                <th className="text-right">Pago estimado*</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-[#adb5bd] py-4">Sin rangos configurados</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className="text-[#adb5bd] text-[12px]">$</span>
                      <input
                        type="number" min="0" value={r.rangoMin}
                        onChange={e => updateRow(tipo, i, 'rangoMin', e.target.value)}
                        className="input w-28"
                      />
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className="text-[#adb5bd] text-[12px]">$</span>
                      <input
                        type="number" min="0" value={r.rangoMax}
                        onChange={e => updateRow(tipo, i, 'rangoMax', e.target.value)}
                        className="input w-28"
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      type="number" min="1" value={r.plazo}
                      onChange={e => updateRow(tipo, i, 'plazo', e.target.value)}
                      className="input w-20"
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" max="100" step="0.5"
                        value={+(r.tasaInteres * 100).toFixed(1)}
                        onChange={e => updateRow(tipo, i, 'tasaInteres', String(Number(e.target.value) / 100))}
                        className="input w-20"
                      />
                      <span className="text-[#adb5bd] text-[12px]">%</span>
                    </div>
                  </td>
                  <td className="text-right font-mono text-[12px] text-[#2d6a4f]">
                    ${fmt(pagoEstimado(r.rangoMin, r.tasaInteres, r.plazo))}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeRow(tipo, i)}
                      className="btn btn-sm text-[#dc2626] hover:bg-[#fee2e2]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden space-y-2 mb-2">
          {rows.map((r, i) => (
            <div key={i} className="border border-[#e9ecef] rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <p className="text-[10px] text-[#adb5bd] mb-0.5">Desde ($)</p>
                  <input type="number" value={r.rangoMin}
                    onChange={e => updateRow(tipo, i, 'rangoMin', e.target.value)}
                    className="input" />
                </div>
                <div>
                  <p className="text-[10px] text-[#adb5bd] mb-0.5">Hasta ($)</p>
                  <input type="number" value={r.rangoMax}
                    onChange={e => updateRow(tipo, i, 'rangoMax', e.target.value)}
                    className="input" />
                </div>
                <div>
                  <p className="text-[10px] text-[#adb5bd] mb-0.5">{tipo === 'diario' ? 'Días' : 'Semanas'}</p>
                  <input type="number" value={r.plazo}
                    onChange={e => updateRow(tipo, i, 'plazo', e.target.value)}
                    className="input" />
                </div>
                <div>
                  <p className="text-[10px] text-[#adb5bd] mb-0.5">Tasa %</p>
                  <input type="number" step="0.5"
                    value={+(r.tasaInteres * 100).toFixed(1)}
                    onChange={e => updateRow(tipo, i, 'tasaInteres', String(Number(e.target.value) / 100))}
                    className="input" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#2d6a4f] font-semibold">
                  Pago est. ${fmt(pagoEstimado(r.rangoMin, r.tasaInteres, r.plazo))}
                </span>
                <button type="button" onClick={() => removeRow(tipo, i)}
                  className="btn btn-sm text-[#dc2626]">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => addRow(tipo)} className="btn btn-sm">
          <Plus className="w-3.5 h-3.5" /> Agregar rango
        </button>
        <p className="text-[10px] text-[#adb5bd] mt-1.5">
          * Pago estimado calculado sobre el monto mínimo del rango
        </p>
      </div>
    )
  }

  return (
    <SectionCard
      title="Parámetros de Crédito"
      subtitle="Rangos de monto con plazo y tasa de interés"
      open={open}
      onToggle={() => setOpen(v => !v)}
    >
      {isLoading ? (
        <p className="text-[#adb5bd] text-[13px] py-4 text-center">Cargando...</p>
      ) : (
        <div className="space-y-5">
          <RangoTable rows={diario} tipo="diario" />
          <div className="border-t border-[#e9ecef] pt-4">
            <RangoTable rows={semanal} tipo="semanal" />
          </div>
          <div className="flex justify-end pt-1">
            <button
              className="btn-primary"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar rangos
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ── Sección 3 — Hora Límite ───────────────────────────────────────────

function SeccionHoraLimite({ sucursalId }: { sucursalId: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [hora, setHora] = useState('17:00')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-config', sucursalId],
    queryFn: () => adminService.getConfig(sucursalId),
  })

  useEffect(() => {
    if (data) setHora(data.horaLimiteOperacion.slice(0, 5))
  }, [data])

  const mutation = useMutation({
    mutationFn: () => adminService.saveConfig(sucursalId, {
      horaLimiteOperacion: hora + ':00',
      porcentajeAhorro:    data?.porcentajeAhorro    ?? 0,
      montoAhorroFijo:     data?.montoAhorroFijo     ?? 0,
      diaPagoNomina:       data?.diaPagoNomina       ?? 'MIERCOLES',
    }),
    onSuccess: () => {
      toast.success('Hora límite actualizada')
      qc.invalidateQueries({ queryKey: ['admin-config', sucursalId] })
    },
    onError: () => toast.error('Error al guardar'),
  })

  return (
    <SectionCard
      title="Hora Límite de Operación"
      subtitle="Hora máxima para registrar cobros del día"
      open={open}
      onToggle={() => setOpen(v => !v)}
    >
      {isLoading ? (
        <p className="text-[#adb5bd] text-[13px] py-4 text-center">Cargando...</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="w-full sm:w-48">
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              Hora límite
            </label>
            <input
              type="time"
              value={hora}
              onChange={e => setHora(e.target.value)}
              className="input"
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </button>
        </div>
      )}
    </SectionCard>
  )
}

// ── Sección 4 — Ahorro ────────────────────────────────────────────────

function SeccionAhorro({ sucursalId }: { sucursalId: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [pct, setPct]   = useState('24')
  const [fijo, setFijo] = useState('100')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-config', sucursalId],
    queryFn: () => adminService.getConfig(sucursalId),
  })

  useEffect(() => {
    if (data) {
      setPct(String(+(data.porcentajeAhorro * 100).toFixed(2)))
      setFijo(String(data.montoAhorroFijo))
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: () => adminService.saveConfig(sucursalId, {
      horaLimiteOperacion: data?.horaLimiteOperacion ?? '17:00:00',
      porcentajeAhorro:    Number(pct) / 100,
      montoAhorroFijo:     Number(fijo),
      diaPagoNomina:       data?.diaPagoNomina ?? 'MIERCOLES',
    }),
    onSuccess: () => {
      toast.success('Configuración de ahorro actualizada')
      qc.invalidateQueries({ queryKey: ['admin-config', sucursalId] })
    },
    onError: () => toast.error('Error al guardar'),
  })

  return (
    <SectionCard
      title="Ahorro Diario"
      subtitle="Porcentaje y monto fijo de ahorro por pago"
      open={open}
      onToggle={() => setOpen(v => !v)}
    >
      {isLoading ? (
        <p className="text-[#adb5bd] text-[13px] py-4 text-center">Cargando...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Porcentaje de ahorro
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={pct}
                  onChange={e => setPct(e.target.value)}
                  className="input"
                />
                <span className="text-[#adb5bd] text-[13px]">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Monto fijo de ahorro ($)
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[#adb5bd] text-[13px]">$</span>
                <input
                  type="number" min="0" step="1"
                  value={fijo}
                  onChange={e => setFijo(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar ahorro
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ── Sección 5 — Nómina ────────────────────────────────────────────────

function SeccionNomina({ sucursalId }: { sucursalId: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [diaPago, setDiaPago] = useState('MIERCOLES')
  const [editando, setEditando] = useState<AdminNomina | null>(null)
  const [form, setForm] = useState({ nombre: '', puesto: '', montoSemanal: '' })

  const { data: config } = useQuery({
    queryKey: ['admin-config', sucursalId],
    queryFn: () => adminService.getConfig(sucursalId),
  })

  const { data: nomina = [], isLoading } = useQuery({
    queryKey: ['admin-nomina', sucursalId],
    queryFn: () => adminService.getNomina(sucursalId),
  })

  useEffect(() => {
    if (config) setDiaPago(config.diaPagoNomina || 'MIERCOLES')
  }, [config])

  const saveDiaMutation = useMutation({
    mutationFn: () => adminService.saveConfig(sucursalId, {
      horaLimiteOperacion: config?.horaLimiteOperacion ?? '17:00:00',
      porcentajeAhorro:    config?.porcentajeAhorro    ?? 0,
      montoAhorroFijo:     config?.montoAhorroFijo     ?? 0,
      diaPagoNomina:       diaPago,
    }),
    onSuccess: () => {
      toast.success('Día de pago actualizado')
      qc.invalidateQueries({ queryKey: ['admin-config', sucursalId] })
    },
    onError: () => toast.error('Error al guardar'),
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { nombre: form.nombre.trim(), puesto: form.puesto.trim(), montoSemanal: Number(form.montoSemanal) }
      return editando
        ? adminService.actualizarNomina(sucursalId, editando.id, payload)
        : adminService.crearNomina(sucursalId, payload)
    },
    onSuccess: () => {
      toast.success(editando ? 'Personal actualizado' : 'Personal agregado')
      qc.invalidateQueries({ queryKey: ['admin-nomina', sucursalId] })
      cancelarForm()
    },
    onError: () => toast.error('Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminService.eliminarNomina(sucursalId, id),
    onSuccess: () => {
      toast.success('Registro eliminado')
      qc.invalidateQueries({ queryKey: ['admin-nomina', sucursalId] })
    },
    onError: () => toast.error('Error al eliminar'),
  })

  function iniciarEdicion(n: AdminNomina) {
    setEditando(n)
    setForm({ nombre: n.nombre, puesto: n.puesto, montoSemanal: String(n.montoSemanal) })
  }

  function cancelarForm() {
    setEditando(null)
    setForm({ nombre: '', puesto: '', montoSemanal: '' })
  }

  const formValido = form.nombre.trim() && form.puesto.trim() && Number(form.montoSemanal) > 0
  const totalSemanal = nomina.reduce((s, n) => s + n.montoSemanal, 0)

  return (
    <SectionCard
      title="Nómina de Personal"
      subtitle="Personal de la sucursal y su sueldo semanal"
      open={open}
      onToggle={() => setOpen(v => !v)}
    >
      {/* Día de pago */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 pb-4 mb-4 border-b border-[#e9ecef]">
        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1">
            Día de pago de nómina
          </label>
          <select
            value={diaPago}
            onChange={e => setDiaPago(e.target.value)}
            className="input w-auto"
          >
            {DIAS.map(d => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <button
          className="btn-primary"
          onClick={() => saveDiaMutation.mutate()}
          disabled={saveDiaMutation.isPending}
        >
          {saveDiaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar día
        </button>
      </div>

      {/* Tabla personal */}
      {isLoading ? (
        <p className="text-[#adb5bd] text-[13px] py-2 text-center">Cargando...</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="tabla mb-3">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Puesto</th>
                  <th className="text-right">Monto semanal</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {nomina.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-[#adb5bd] py-6">Sin personal registrado</td></tr>
                ) : nomina.map(n => (
                  <tr key={n.id}>
                    <td className="font-medium">{n.nombre}</td>
                    <td className="text-[#495057]">{n.puesto}</td>
                    <td className="text-right font-mono">${fmt(n.montoSemanal)}</td>
                    <td className="text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button className="btn btn-sm" onClick={() => iniciarEdicion(n)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button className="btn btn-sm text-[#dc2626]"
                          onClick={() => deleteMutation.mutate(n.id)}
                          disabled={deleteMutation.isPending}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {nomina.length > 0 && (
                  <tr>
                    <td colSpan={2} className="text-right text-[11px] text-[#adb5bd] font-medium pt-2">Total semanal</td>
                    <td className="text-right font-semibold text-[#2d6a4f] font-mono">${fmt(totalSemanal)}</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2 mb-3">
            {nomina.length === 0 ? (
              <p className="text-[#adb5bd] text-[13px] text-center py-4">Sin personal registrado</p>
            ) : nomina.map(n => (
              <div key={n.id} className="border border-[#e9ecef] rounded-lg px-3 py-2.5 flex justify-between items-center">
                <div>
                  <p className="font-medium text-[13px]">{n.nombre}</p>
                  <p className="text-[11px] text-[#adb5bd]">{n.puesto} · ${fmt(n.montoSemanal)}/sem</p>
                </div>
                <div className="flex gap-1.5">
                  <button className="btn btn-sm" onClick={() => iniciarEdicion(n)}><Pencil className="w-3.5 h-3.5" /></button>
                  <button className="btn btn-sm text-[#dc2626]" onClick={() => deleteMutation.mutate(n.id)}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Formulario inline */}
          <div className="border border-[#dee2e6] rounded-lg p-3 bg-[#f8f9fa]">
            <p className="text-[12px] font-semibold text-[#495057] mb-2">
              {editando ? `Editando: ${editando.nombre}` : 'Agregar personal'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <div>
                <label className="text-[10px] text-[#adb5bd] block mb-0.5">Nombre</label>
                <input
                  type="text" placeholder="Nombre completo"
                  value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#adb5bd] block mb-0.5">Puesto</label>
                <input
                  type="text" placeholder="Ej: Asesor"
                  value={form.puesto} onChange={e => setForm(p => ({ ...p, puesto: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#adb5bd] block mb-0.5">Monto semanal ($)</label>
                <input
                  type="number" min="0" placeholder="0"
                  value={form.montoSemanal} onChange={e => setForm(p => ({ ...p, montoSemanal: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-primary btn-sm"
                onClick={() => saveMutation.mutate()}
                disabled={!formValido || saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {editando ? 'Actualizar' : 'Agregar'}
              </button>
              {editando && (
                <button className="btn btn-sm" onClick={cancelarForm}>Cancelar</button>
              )}
            </div>
          </div>
        </>
      )}
    </SectionCard>
  )
}

// ── Sección 6 — Conceptos de Inversión ───────────────────────────────

function SeccionConceptos({ sucursalId }: { sucursalId: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [editando, setEditando] = useState<AdminConcepto | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [editNombre, setEditNombre] = useState('')

  const { data: conceptos = [], isLoading } = useQuery({
    queryKey: ['admin-conceptos', sucursalId],
    queryFn: () => adminService.getConceptos(sucursalId),
  })

  const crearMutation = useMutation({
    mutationFn: () => adminService.crearConcepto(sucursalId, { nombre: nuevoNombre.trim() }),
    onSuccess: () => {
      toast.success('Concepto creado')
      qc.invalidateQueries({ queryKey: ['admin-conceptos', sucursalId] })
      setNuevoNombre('')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Error al crear'),
  })

  const editarMutation = useMutation({
    mutationFn: () => adminService.actualizarConcepto(sucursalId, editando!.id, { nombre: editNombre.trim() }),
    onSuccess: () => {
      toast.success('Concepto actualizado')
      qc.invalidateQueries({ queryKey: ['admin-conceptos', sucursalId] })
      setEditando(null)
    },
    onError: () => toast.error('Error al actualizar'),
  })

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => adminService.eliminarConcepto(sucursalId, id),
    onSuccess: () => {
      toast.success('Concepto eliminado')
      qc.invalidateQueries({ queryKey: ['admin-conceptos', sucursalId] })
    },
    onError: () => toast.error('Error al eliminar'),
  })

  function iniciarEdicion(c: AdminConcepto) {
    setEditando(c)
    setEditNombre(c.nombre)
  }

  return (
    <SectionCard
      title="Conceptos de Inversión"
      subtitle="Categorías para clasificar gastos e inversiones"
      open={open}
      onToggle={() => setOpen(v => !v)}
    >
      {isLoading ? (
        <p className="text-[#adb5bd] text-[13px] py-4 text-center">Cargando...</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {conceptos.length === 0 ? (
            <p className="text-[#adb5bd] text-[13px] py-3">Sin conceptos configurados.</p>
          ) : conceptos.map(c => (
            <div key={c.id} className="flex items-center gap-2 border border-[#e9ecef] rounded-lg px-3 py-2">
              {editando?.id === c.id ? (
                <>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={e => setEditNombre(e.target.value)}
                    className="input flex-1"
                    autoFocus
                  />
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => editarMutation.mutate()}
                    disabled={!editNombre.trim() || editarMutation.isPending}
                  >
                    {editarMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[13px] text-[#212529]">{c.nombre}</span>
                  <button className="btn btn-sm" onClick={() => iniciarEdicion(c)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="btn btn-sm text-[#dc2626]"
                    onClick={() => eliminarMutation.mutate(c.id)}
                    disabled={eliminarMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Alta inline */}
      <div className="flex gap-2 mt-1">
        <input
          type="text"
          placeholder="Nombre del concepto"
          value={nuevoNombre}
          onChange={e => setNuevoNombre(e.target.value)}
          className="input flex-1"
          onKeyDown={e => e.key === 'Enter' && nuevoNombre.trim() && crearMutation.mutate()}
        />
        <button
          className="btn-primary"
          onClick={() => crearMutation.mutate()}
          disabled={!nuevoNombre.trim() || crearMutation.isPending}
        >
          {crearMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Agregar
        </button>
      </div>
    </SectionCard>
  )
}

// ── Sección 7 — Categorías de Gastos ─────────────────────────────────

function SeccionCategorias({ sucursalId }: { sucursalId: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [editando, setEditando] = useState<CategoriaGasto | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [editNombre, setEditNombre] = useState('')

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['gastos-categorias', sucursalId],
    queryFn: () => gastoService.getCategorias(sucursalId),
  })

  const crearMutation = useMutation({
    mutationFn: () => gastoService.crearCategoria(sucursalId, { nombre: nuevoNombre.trim() }),
    onSuccess: () => {
      toast.success('Categoría creada')
      qc.invalidateQueries({ queryKey: ['gastos-categorias', sucursalId] })
      setNuevoNombre('')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Error al crear'),
  })

  const editarMutation = useMutation({
    mutationFn: () => gastoService.actualizarCategoria(editando!.id, { nombre: editNombre.trim() }),
    onSuccess: () => {
      toast.success('Categoría actualizada')
      qc.invalidateQueries({ queryKey: ['gastos-categorias', sucursalId] })
      setEditando(null)
    },
    onError: () => toast.error('Error al actualizar'),
  })

  const desactivarMutation = useMutation({
    mutationFn: (id: number) => gastoService.desactivarCategoria(id),
    onSuccess: () => {
      toast.success('Categoría desactivada')
      qc.invalidateQueries({ queryKey: ['gastos-categorias', sucursalId] })
    },
    onError: () => toast.error('Error al desactivar'),
  })

  function iniciarEdicion(c: CategoriaGasto) {
    setEditando(c)
    setEditNombre(c.nombre)
  }

  return (
    <SectionCard
      title="Categorías de Gastos"
      subtitle="Categorías para clasificar los gastos operativos"
      open={open}
      onToggle={() => setOpen(v => !v)}
    >
      {isLoading ? (
        <p className="text-[#adb5bd] text-[13px] py-4 text-center">Cargando...</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {categorias.length === 0 ? (
            <p className="text-[#adb5bd] text-[13px] py-3">Sin categorías configuradas.</p>
          ) : categorias.map(c => (
            <div key={c.id} className="flex items-center gap-2 border border-[#e9ecef] rounded-lg px-3 py-2">
              {editando?.id === c.id ? (
                <>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={e => setEditNombre(e.target.value)}
                    className="input flex-1"
                    autoFocus
                  />
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => editarMutation.mutate()}
                    disabled={!editNombre.trim() || editarMutation.isPending}
                  >
                    {editarMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[13px] text-[#212529]">{c.nombre}</span>
                  <button className="btn btn-sm" onClick={() => iniciarEdicion(c)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="btn btn-sm text-[#dc2626]"
                    onClick={() => desactivarMutation.mutate(c.id)}
                    disabled={desactivarMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Alta inline */}
      <div className="flex gap-2 mt-1">
        <input
          type="text"
          placeholder="Nombre de la categoría"
          value={nuevoNombre}
          onChange={e => setNuevoNombre(e.target.value)}
          className="input flex-1"
          onKeyDown={e => e.key === 'Enter' && nuevoNombre.trim() && crearMutation.mutate()}
        />
        <button
          className="btn-primary"
          onClick={() => crearMutation.mutate()}
          disabled={!nuevoNombre.trim() || crearMutation.isPending}
        >
          {crearMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Agregar
        </button>
      </div>
    </SectionCard>
  )
}

// ── Componente principal del Tab ──────────────────────────────────────

interface Props {
  sucursalId: number
}

export default function TabConfigSucursal({ sucursalId }: Props) {
  return (
    <div className="space-y-4">
      <SeccionMultas          sucursalId={sucursalId} />
      <SeccionRangos          sucursalId={sucursalId} />
      <SeccionHoraLimite      sucursalId={sucursalId} />
      <SeccionAhorro          sucursalId={sucursalId} />
      <SeccionNomina          sucursalId={sucursalId} />
      <SeccionConceptos       sucursalId={sucursalId} />
      <SeccionCategorias      sucursalId={sucursalId} />
    </div>
  )
}
