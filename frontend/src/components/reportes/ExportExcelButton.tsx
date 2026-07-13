import { useState } from 'react'
import { Download } from 'lucide-react'

interface ExportExcelButtonProps {
  onExport: () => Promise<void>
  disabled?: boolean
}

export default function ExportExcelButton({ onExport, disabled }: ExportExcelButtonProps) {
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
      className="inline-flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 rounded text-sm font-medium hover:bg-green-50 disabled:opacity-40"
    >
      <Download className="w-4 h-4" />
      {loading ? 'Exportando...' : 'Exportar Excel'}
    </button>
  )
}
