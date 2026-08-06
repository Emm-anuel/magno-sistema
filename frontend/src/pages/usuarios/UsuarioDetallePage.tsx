import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, FileText, ImageOff, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { usuarioService } from '@/services/api'
import { ROL_LABELS } from '@/types'
import type { Rol } from '@/types'

// ── Utilidad de descarga ──────────────────────────────────────────
async function downloadIne(url: string) {
  const token = localStorage.getItem('magno_token')
  try {
    const res = await fetch(`/api/files/download?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
    if (!res.ok) throw new Error()
    const blob = await res.blob()
    const ct = res.headers.get('content-type') ?? ''
    const ext = ct.includes('pdf') ? 'pdf' : ct.includes('png') ? 'png' : 'jpg'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ine.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch {
    window.open(url, '_blank', 'noopener')
    toast('Archivo abierto en nueva pestaña')
  }
}

// ── Carga la imagen primero directo, si falla la proxea via API ───
function useProxiedImage(s3Url: string) {
  const [src, setSrc] = useState(s3Url)
  const [failed, setFailed] = useState(false)

  const handleError = async () => {
    if (src !== s3Url) {
      // Ya intentamos el proxy y falló
      setFailed(true)
      return
    }
    // Primer fallo: intentar via proxy autenticado
    const token = localStorage.getItem('magno_token')
    try {
      const res = await fetch(`/api/files/download?url=${encodeURIComponent(s3Url)}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      setSrc(URL.createObjectURL(blob))
    } catch {
      setFailed(true)
    }
  }

  return { src, failed, handleError }
}

// ── Visor de INE ──────────────────────────────────────────────────
function IneViewer({ url, nombre }: { url: string; nombre: string }) {
  const { src, failed, handleError } = useProxiedImage(url)
  const isPdf = url.toLowerCase().endsWith('.pdf')

  return (
    <div className="space-y-3">
      {isPdf ? (
        <div className="flex flex-col items-center justify-center h-44 bg-[#f8f9fa] rounded-xl border border-dashed border-[#dee2e6] gap-2">
          <FileText className="w-10 h-10 text-[#adb5bd]" />
          <p className="text-[13px] font-medium text-[#495057]">Documento PDF</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#3d6b35] underline hover:no-underline"
          >
            Ver en nueva pestaña ↗
          </a>
        </div>
      ) : failed ? (
        <div className="flex flex-col items-center justify-center h-44 bg-[#f8f9fa] rounded-xl border border-dashed border-[#dee2e6] gap-2">
          <ImageOff className="w-10 h-10 text-[#adb5bd]" />
          <p className="text-[12px] text-[#adb5bd] text-center px-4">
            No se pudo cargar la imagen
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#3d6b35] underline"
          >
            Abrir URL directamente ↗
          </a>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-[#dee2e6]">
          <img
            src={src}
            alt={`INE de ${nombre}`}
            className="w-full object-contain max-h-56"
            onError={handleError}
          />
        </div>
      )}

      <button
        onClick={() => downloadIne(url)}
        className="btn w-full justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        Descargar INE
      </button>
    </div>
  )
}

// ── Campo de solo lectura ─────────────────────────────────────────
function Campo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[#adb5bd] uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-[13px] text-[#212529]">
        {value || <span className="text-[#dee2e6]">—</span>}
      </p>
    </div>
  )
}

function fmtFecha(fecha?: string | null) {
  if (!fecha) return null
  return new Date(`${fecha.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ── Badge de Rol ──────────────────────────────────────────────────
function RolBadge({ rol }: { rol: string }) {
  const map: Record<string, string> = {
    ADMINISTRADOR:    'badge-azul',
    SUPERVISOR:       'badge-verde',
    SUPERVISOR_CAMPO: 'badge-amarillo',
    ASESOR_COBRADOR:  'badge-gris',
  }
  return (
    <span className={`badge ${map[rol] ?? 'badge-gris'}`}>
      {ROL_LABELS[rol as Rol] ?? rol}
    </span>
  )
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Página principal ──────────────────────────────────────────────
export default function UsuarioDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: u, isLoading, error } = useQuery({
    queryKey: ['usuario', id],
    queryFn: () => usuarioService.obtener(Number(id)),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[#adb5bd] text-[13px]">Cargando...</p>
      </div>
    )
  }

  if (error || !u) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-[#dc2626] text-[13px]">No se pudo cargar el usuario.</p>
        <button className="btn" onClick={() => navigate('/usuarios')}>
          Volver a usuarios
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Navegación */}
      <button
        className="flex items-center gap-1.5 text-[13px] text-[#6c757d] hover:text-[#212529]"
        onClick={() => navigate('/usuarios')}
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a usuarios
      </button>

      {/* Encabezado */}
      <div className="card">
        <div className="px-5 py-4 flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#d1fae5] flex items-center justify-center text-[18px] font-bold text-[#065f46] shrink-0">
            {initials(u.nombre_completo)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-semibold text-[#212529] leading-tight">
              {u.nombre_completo}
            </h1>
            <p className="text-[13px] text-[#6c757d]">{u.email}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <RolBadge rol={u.rol} />
            <span className={`badge ${u.activo ? 'badge-verde' : 'badge-rojo'}`}>
              {u.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      </div>

      {/* Contenido — 3 columnas en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Columna izquierda (span 2) */}
        <div className="lg:col-span-2 space-y-4">

          {/* Datos generales */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Datos Generales</span>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Teléfono" value={u.telefono} />
              <Campo label="Sucursal" value={u.sucursal.nombre} />
              <Campo label="Fecha de nacimiento" value={fmtFecha(u.fecha_nacimiento)} />
              <Campo label="Fecha de ingreso" value={fmtFecha(u.fecha_ingreso)} />
              <Campo label="No. de INE" value={u.ine_numero} />
            </div>
          </div>

          {/* Domicilio */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Domicilio</span>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Calle" value={u.calle} />
              <div className="grid grid-cols-2 gap-3">
                <Campo label="No. Exterior" value={u.no_exterior} />
                <Campo label="No. Interior" value={u.no_interior || 'N/A'} />
              </div>
              <Campo label="Colonia" value={u.colonia} />
              <Campo label="Municipio" value={u.municipio} />
              <Campo label="Estado" value={u.estado} />
              <Campo label="C.P." value={u.codigo_postal} />
            </div>
          </div>

          {/* Referencias */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Referencias Personales</span>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-[12px] font-semibold text-[#495057] mb-2">Referencia 1</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Campo label="Nombre" value={u.ref1_nombre} />
                  <Campo label="Teléfono" value={u.ref1_telefono} />
                  <Campo label="Parentesco" value={u.ref1_parentesco} />
                </div>
              </div>
              <hr className="border-[#f0f0f0]" />
              <div>
                <p className="text-[12px] font-semibold text-[#495057] mb-2">Referencia 2</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Campo label="Nombre" value={u.ref2_nombre} />
                  <Campo label="Teléfono" value={u.ref2_telefono} />
                  <Campo label="Parentesco" value={u.ref2_parentesco} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha — INE */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <span className="card-title">INE - Frente</span>
            </div>
            <div className="px-5 py-4">
              {u.ine_imagen_url ? (
                <IneViewer url={u.ine_imagen_url} nombre={u.nombre_completo} />
              ) : (
                <div className="flex flex-col items-center justify-center h-44 bg-[#f8f9fa] rounded-xl border border-dashed border-[#dee2e6] gap-2">
                  <User className="w-10 h-10 text-[#adb5bd]" />
                  <p className="text-[13px] text-[#adb5bd]">Sin imagen INE</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">INE - Reverso</span>
            </div>
            <div className="px-5 py-4">
              {u.ine_imagen_reverso_url ? (
                <IneViewer url={u.ine_imagen_reverso_url} nombre={u.nombre_completo} />
              ) : (
                <div className="flex flex-col items-center justify-center h-44 bg-[#f8f9fa] rounded-xl border border-dashed border-[#dee2e6] gap-2">
                  <User className="w-10 h-10 text-[#adb5bd]" />
                  <p className="text-[13px] text-[#adb5bd]">Sin imagen INE</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
