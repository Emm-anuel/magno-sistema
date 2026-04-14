import { useState, useCallback } from 'react'
import { X, FileVideo } from 'lucide-react'
import FileUpload from './FileUpload'
import SecurePreviewImage from './SecurePreviewImage'

interface Props {
  value: string[]
  onChange: (urls: string[]) => void
  folder?: string
  accept?: string
  label?: string
  disabled?: boolean
  required?: boolean
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm|avi)(\?|$)/i.test(url)
}

function Thumbnail({ url, onRemove }: { url: string; onRemove: () => void }) {
  const isVideo = isVideoUrl(url)
  return (
    <div className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
      {isVideo ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <FileVideo className="w-6 h-6 text-gray-400" />
        </div>
      ) : (
        <SecurePreviewImage
          fileUrl={url}
          alt="Evidencia"
          className="w-full h-full object-cover"
        />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Eliminar archivo"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

export default function MultiFileUpload({
  value,
  onChange,
  folder,
  accept = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime',
  label = 'Arrastra fotos/videos del negocio o haz clic para seleccionar',
  disabled = false,
  required = false,
}: Props) {
  const [uploaderKey, setUploaderKey] = useState(0)

  const handleUploadComplete = useCallback(
    (url: string) => {
      onChange([...value, url])
      // Reset the FileUpload component to idle so user can add more files
      setUploaderKey((k) => k + 1)
    },
    [value, onChange],
  )

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index))
    },
    [value, onChange],
  )

  return (
    <div className="space-y-3">
      {/* Existing files */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 items-end">
          {value.map((url, i) => (
            <Thumbnail key={url} url={url} onRemove={() => handleRemove(i)} />
          ))}
          <div className="text-xs text-gray-500 pb-1">
            {value.length} archivo{value.length !== 1 ? 's' : ''} adjunto
            {value.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Upload zone — always visible so more files can be added */}
      <FileUpload
        key={uploaderKey}
        onUploadComplete={handleUploadComplete}
        accept={accept}
        folder={folder}
        compress
        label={value.length > 0 ? 'Agregar otro archivo (opcional)' : label}
        disabled={disabled}
      />

      {required && value.length === 0 && (
        <p className="text-xs text-red-500">Se requiere al menos 1 archivo de evidencia</p>
      )}
    </div>
  )
}
