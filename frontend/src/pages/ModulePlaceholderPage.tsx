import { useLocation } from 'react-router-dom'

export default function ModulePlaceholderPage() {
  const { pathname } = useLocation()
  const module = pathname.replace('/', '')

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#3d6b35]/10 flex items-center justify-center mb-4">
        <span className="text-2xl text-[#3d6b35]">🚧</span>
      </div>
      <h2 className="text-xl font-semibold text-gray-700 mb-1 capitalize">
        {module.replace('-', ' ')}
      </h2>
      <p className="text-sm text-gray-400">Este módulo está en desarrollo.</p>
    </div>
  )
}
