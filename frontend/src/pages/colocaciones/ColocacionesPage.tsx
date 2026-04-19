import TabColocacionesSemanales from './TabColocacionesSemanales'

export default function ColocacionesPage() {
  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Colocaciones Semanales</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Registro semanal de créditos nuevos y renovaciones desembolsados
        </p>
      </div>
      <TabColocacionesSemanales />
    </div>
  )
}
