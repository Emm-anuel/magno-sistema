import { useState } from 'react'
import { Download } from 'lucide-react'

interface ExportPdfButtonProps {
  onExport: () => Promise<void>
  disabled?: boolean
}

export default function ExportPdfButton({ onExport, disabled }: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      await onExport()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-700 rounded text-sm font-medium hover:bg-emerald-50 disabled:opacity-40"
    >
      <Download className="w-4 h-4" />
      {loading ? 'Exportando...' : 'Exportar PDF'}
    </button>
  )
}
