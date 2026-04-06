export default function DashboardPage() {
  return (
    <div>
      {/* ── Métricas (6 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <div className="metric-card">
          <p className="metric-label">Cobros hoy</p>
          <p className="metric-val text-[#2d6a4f]">—</p>
          <p className="metric-sub">Pendiente de datos</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Créditos activos</p>
          <p className="metric-val">—</p>
          <p className="metric-sub">Todas las sucursales</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Con multa hoy</p>
          <p className="metric-val text-[#dc2626]">—</p>
          <p className="metric-sub">Pendiente de datos</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Apartado 24%</p>
          <p className="metric-val text-[#f59e0b]">—</p>
          <p className="metric-sub">Del ingreso diario</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Desembolsos hoy</p>
          <p className="metric-val">—</p>
          <p className="metric-sub">Créditos / renovaciones</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">En mora</p>
          <p className="metric-val text-[#dc2626]">—</p>
          <p className="metric-sub">Pendiente de datos</p>
        </div>
      </div>

      {/* ── Dos tablas en grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] mb-[18px]">
        {/* Cobros pendientes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Cobros pendientes hoy</span>
            <button className="btn btn-sm">Ver todos →</button>
          </div>
          <table className="tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Asesor</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="text-center text-[#adb5bd] py-6 text-[13px]">
                  Sin datos por ahora
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Renovaciones */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Renovaciones esta semana</span>
            <button className="btn btn-sm">Ver todas →</button>
          </div>
          <table className="tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Cr. Nuevo</th>
                <th>Desembolso</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className="text-center text-[#adb5bd] py-6 text-[13px]">
                  Sin datos por ahora
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tabla ingreso por asesor (full width) ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Ingreso por Asesor — Hoy</span>
        </div>
        <table className="tabla">
          <thead>
            <tr>
              <th>Asesor</th>
              <th>Ingreso Carteras</th>
              <th>Desembolsos</th>
              <th>Multas</th>
              <th>Clientes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="text-center text-[#adb5bd] py-6 text-[13px]">
                Sin datos por ahora
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
