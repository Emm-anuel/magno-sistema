import { AlertTriangle } from 'lucide-react'

interface Props {
  monto: number
}

export default function MultaBadge({ monto }: Props) {
  if (!monto || monto <= 0) return null
  return (
    <span className="inline-flex items-center gap-1 bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold px-[7px] py-[2px] rounded-full">
      <AlertTriangle className="w-3 h-3" />
      {`$${Number(monto).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`}
    </span>
  )
}
