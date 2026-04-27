interface MetricCardProps {
  label: string
  value: string
  colorClass: string
}

export default function MetricCard({ label, value, colorClass }: MetricCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
