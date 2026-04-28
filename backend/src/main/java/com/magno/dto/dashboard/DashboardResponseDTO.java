package com.magno.dto.dashboard;

import java.util.List;

public record DashboardResponseDTO(
        DashboardKpisDTO kpis,
        List<DashboardCobroPendienteDTO> cobrosPendientes,
        List<DashboardRenovacionDTO> renovaciones,
        List<DashboardAsesorIngresoDTO> ingresoPorAsesor) {
}
