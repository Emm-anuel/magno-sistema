import { useRef, useState, useCallback } from 'react'
import { UploadCloud } from 'lucide-react'
import { compressImage } from '@/utils/imageCompressor'
import { fileService } from '@/services/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileUploadProps {
  onUploadComplete: (url: string) => void
  accept?: string
  folder?: string
  compress?: boolean
  label?: string
  disabled?: boolean
}

type UploadState =
  | { kind: 'idle' }
  | { kind: 'compressing-image' }
  | { kind: 'loading-compressor' }
  | { kind: 'compressing-video'; progress: number }
  | { kind: 'uploading' }
  | { kind: 'done'; url: string; isVideo: boolean }
  | { kind: 'error'; message: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <span
      className="inline-block w-5 h-5 border-2 rounded-full animate-spin border-[#3d6b35] border-t-transparent"
      role="status"
      aria-label="Cargando"
    />
  )
}

interface ProgressBarProps {
  percent: number
}

function ProgressBar({ percent }: ProgressBarProps) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className="h-2 rounded-full bg-[#3d6b35] transition-all duration-200"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FileUpload({
  onUploadComplete,
  accept = 'image/*,video/*',
  folder,
  compress = true,
  label = 'Arrastra un archivo o haz clic para seleccionar',
  disabled = false,
}: FileUploadProps) {
  const [state, setState] = useState<UploadState>({ kind: 'idle' })
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (rawFile: File) => {
      if (disabled) return

      try {
        let file = rawFile
        const isVideo = isVideoFile(file)
        const isImage = isImageFile(file)

        // 1. Compress image
        if (isImage && compress) {
          setState({ kind: 'compressing-image' })
          file = await compressImage(file)
        }

        // 2. Compress video (dynamic import to avoid loading ffmpeg/wasm eagerly)
        if (isVideo && compress) {
          setState({ kind: 'loading-compressor' })
          const { compressVideo } = await import('@/utils/videoCompressor')
          setState({ kind: 'compressing-video', progress: 0 })
          file = await compressVideo(file, (pct) => {
            setState({ kind: 'compressing-video', progress: pct })
          })
        }

        // 3. Upload
        setState({ kind: 'uploading' })
        const url = await fileService.upload(file, folder)

        setState({ kind: 'done', url, isVideo })
        onUploadComplete(url)
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Error al procesar el archivo'
        setState({ kind: 'error', message })
      }
    },
    [compress, disabled, folder, onUploadComplete],
  )

  // ── Event handlers ────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset input so the same file can be re-selected after an error
    e.target.value = ''
  }

  const handleClick = () => {
    if (!disabled && state.kind === 'idle') {
      inputRef.current?.click()
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleReset = () => {
    setState({ kind: 'idle' })
  }

  // ── Derived UI values ─────────────────────────────────────────────

  const isInteractive = !disabled && state.kind === 'idle'
  const isBusy =
    state.kind === 'compressing-image' ||
    state.kind === 'loading-compressor' ||
    state.kind === 'compressing-video' ||
    state.kind === 'uploading'

  const dropZoneClasses = [
    'relative flex flex-col items-center justify-center gap-3',
    'border-dashed border-2 rounded-xl p-6 text-center min-h-[44px]',
    'transition-colors duration-150',
    isBusy ? 'border-[#3d6b35] bg-green-50' : '',
    isInteractive
      ? isDragging
        ? 'border-[#3d6b35] bg-green-50 cursor-pointer'
        : 'border-gray-300 hover:border-[#3d6b35] hover:bg-green-50 cursor-pointer'
      : '',
    disabled ? 'opacity-50 cursor-not-allowed border-gray-300' : '',
    state.kind === 'error' ? 'border-red-300 bg-red-50' : '',
    state.kind === 'done' ? 'border-gray-200 bg-gray-50' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isBusy}
        aria-hidden="true"
      />

      <div
        className={dropZoneClasses}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-disabled={disabled || isBusy}
        onKeyDown={(e) => {
          if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        {/* ── Idle ── */}
        {state.kind === 'idle' && (
          <>
            <UploadCloud className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
            <p className="text-sm text-gray-600">{label}</p>
          </>
        )}

        {/* ── Compressing image ── */}
        {state.kind === 'compressing-image' && (
          <div className="flex flex-col items-center gap-2">
            <Spinner />
            <p className="text-sm text-gray-600">Optimizando imagen...</p>
          </div>
        )}

        {/* ── Loading video compressor ── */}
        {state.kind === 'loading-compressor' && (
          <div className="flex flex-col items-center gap-2">
            <Spinner />
            <p className="text-sm text-gray-600">
              Cargando compresor de video...
            </p>
          </div>
        )}

        {/* ── Compressing video ── */}
        {state.kind === 'compressing-video' && (
          <div className="flex flex-col items-center gap-3 w-full px-2">
            <p className="text-sm text-gray-600">
              Optimizando video... {state.progress}%
            </p>
            <div className="w-full">
              <ProgressBar percent={state.progress} />
            </div>
          </div>
        )}

        {/* ── Uploading ── */}
        {state.kind === 'uploading' && (
          <div className="flex flex-col items-center gap-2">
            <Spinner />
            <p className="text-sm text-gray-600">Subiendo archivo...</p>
          </div>
        )}

        {/* ── Done ── */}
        {state.kind === 'done' && (
          <div className="flex flex-col items-center gap-3 w-full">
            {state.isVideo ? (
              <video
                src={state.url}
                controls
                className="w-full max-h-48 rounded-lg"
              />
            ) : (
              <img
                src={state.url}
                alt="Vista previa"
                className="max-h-48 object-contain rounded-lg mx-auto"
              />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleReset()
              }}
              className="text-xs text-gray-500 underline hover:text-gray-700"
            >
              Cambiar archivo
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {state.kind === 'error' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-red-600 font-medium">
              {state.message}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleReset()
              }}
              className="text-xs text-gray-500 underline hover:text-gray-700"
            >
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
