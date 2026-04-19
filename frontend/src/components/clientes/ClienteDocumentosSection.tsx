import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Trash2, FileText } from 'lucide-react'
import FileUpload from '@/components/FileUpload'
import { clienteService } from '@/services/api'
import type { ClienteDocumentoDTO } from '@/types'

const TIPOS_DOCUMENTO: { value: string; label: string }[] = [
  { value: 'INE_FRENTE',            label: 'INE — Frente' },
  { value: 'INE_REVERSO',           label: 'INE — Reverso' },
  { value: 'COMPROBANTE_DOMICILIO', label: 'Comprobante de domicilio' },
  { value: 'OTRO',                  label: 'Otro documento' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

interface Props {
  clienteId: number
  canDelete?: boolean
}

export default function ClienteDocumentosSection({ clienteId, canDelete = false }: Props) {
  const qc = useQueryClient()
  const [tipoSeleccionado, setTipoSeleccionado] = useState('INE_FRENTE')
  const [nombre, setNombre] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploadKey, setUploadKey] = useState(0)

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['cliente-documentos', clienteId],
    queryFn: () => clienteService.listarDocumentos(clienteId),
    staleTime: 30_000,
  })

  const agregarMutation = useMutation({
    mutationFn: () =>
      clienteService.agregarDocumento(clienteId, tipoSeleccionado, uploadedUrl!, nombre || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente-documentos', clienteId] })
      toast.success('Documento guardado')
      setUploadedUrl(null)
      setNombre('')
      setUploadKey((k) => k + 1)
    },
    onError: () => toast.error('Error al guardar documento'),
  })

  const eliminarMutation = useMutation({
    mutationFn: (docId: number) => clienteService.eliminarDocumento(clienteId, docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente-documentos', clienteId] })
      toast.success('Documento eliminado')
    },
    onError: () => toast.error('Error al eliminar documento'),
  })

  return (
    <div className="space-y-5">
      {/* ── Subir nuevo documento ── */}
      <div className="card p-4 space-y-3">
        <p className="text-[13px] font-semibold text-[#212529]">Subir documento</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-[#495057] mb-1.5">
              Tipo de documento
            </label>
            <select
              className="input"
              value={tipoSeleccionado}
              onChange={(e) => setTipoSeleccionado(e.target.value)}
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#495057] mb-1.5">
              Descripción (opcional)
            </label>
            <input
              className="input"
              placeholder="Ej. INE del titular"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
        </div>

        <FileUpload
          key={uploadKey}
          accept="image/*,.pdf"
          folder={`clientes-documentos/${clienteId}/${tipoSeleccionado}`}
          compress
          label="Arrastra el documento o haz clic para seleccionar (imagen o PDF)"
          onUploadComplete={(url) => setUploadedUrl(url)}
        />

        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          disabled={!uploadedUrl || agregarMutation.isPending}
          onClick={() => agregarMutation.mutate()}
        >
          {agregarMutation.isPending ? 'Guardando...' : 'Guardar documento'}
        </button>
      </div>

      {/* ── Lista de documentos ── */}
      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-[#6c757d] uppercase tracking-wide">
          Documentos guardados ({documentos.length})
        </p>

        {isLoading && (
          <p className="text-[13px] text-[#adb5bd]">Cargando...</p>
        )}

        {!isLoading && documentos.length === 0 && (
          <p className="text-[13px] text-[#adb5bd] py-4 text-center">
            Sin documentos registrados
          </p>
        )}

        {documentos.map((doc: ClienteDocumentoDTO) => (
          <div key={doc.id} className="card p-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#3d6b35] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#212529] truncate">
                {TIPOS_DOCUMENTO.find((t) => t.value === doc.tipo)?.label ?? doc.tipo}
                {doc.nombre && (
                  <span className="text-[#6c757d] font-normal"> — {doc.nombre}</span>
                )}
              </p>
              <p className="text-[11px] text-[#adb5bd]">{fmtDate(doc.createdAt)}</p>
            </div>
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm text-xs shrink-0"
            >
              Ver
            </a>
            {canDelete && (
              <button
                type="button"
                className="btn btn-sm text-xs text-[#dc2626] hover:bg-[#fff5f5] shrink-0"
                onClick={() => eliminarMutation.mutate(doc.id)}
                disabled={eliminarMutation.isPending}
                title="Eliminar documento"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
