interface ProcessingOverlayProps {
  visible: boolean
  title: string
  message?: string
}

export default function ProcessingOverlay({ visible, title, message }: ProcessingOverlayProps) {
  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[2500] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111827] px-6 py-5 text-center shadow-2xl">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-white/15 border-t-white animate-spin" />
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {message && (
          <p className="mt-2 text-sm leading-6 text-white/75">{message}</p>
        )}
      </div>
    </div>
  )
}