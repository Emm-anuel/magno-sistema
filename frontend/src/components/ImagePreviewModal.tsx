import { useEffect } from 'react'
import { X, Download } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  title: string
  downloadFileName?: string
}

export default function ImagePreviewModal({ isOpen, onClose, imageUrl, title, downloadFileName }: Props) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[3000] bg-black/70 flex flex-col items-center justify-center p-4 transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9ecef] shrink-0">
          <span className="font-semibold text-[14px] text-[#212529] truncate mr-4">{title}</span>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={downloadFileName}
              className="btn btn-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar
            </a>
            <button onClick={onClose} className="text-[#adb5bd] hover:text-[#495057] p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Imagen */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full object-contain rounded"
            style={{ maxHeight: '85vh' }}
          />
        </div>
      </div>
    </div>
  )
}
