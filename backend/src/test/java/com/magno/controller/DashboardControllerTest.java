package com.magno.controller;

import com.magno.security.JwtPrincipal;
import com.magno.service.DashboardService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

import java.time.LocalDate;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DashboardControllerTest {

    private DashboardService dashboardService;
    private DashboardController controller;
    private Authentication auth;

    @BeforeEach
    void setUp() {
        dashboardService = mock(DashboardService.class);
        controller = new DashboardController(dashboardService);
        auth = mock(Authentication.class);
    }

    @Test
    void getDashboard_asesorIgnoraFiltrosSolicitadosYVeSoloSusPagos() {
        LocalDate fecha = LocalDate.of(2026, 8, 17);
        JwtPrincipal principal = new JwtPrincipal(15L, "asesor@magno.mx", "ASESOR_COBRADOR", 2L);
        when(auth.getPrincipal()).thenReturn(principal);

        controller.getDashboard(99L, 88L, fecha, fecha, auth);

        verify(dashboardService).getDashboard(2L, 15L, fecha, fecha, principal);
    }

    @Test
    void getDashboard_gerenteSucursalMantieneSuSucursalYPuedeFiltrarAsesor() {
        LocalDate fecha = LocalDate.of(2026, 8, 17);
        JwtPrincipal principal = new JwtPrincipal(10L, "gerente@magno.mx", "SUPERVISOR", 3L);
        when(auth.getPrincipal()).thenReturn(principal);

        controller.getDashboard(99L, 25L, fecha, fecha, auth);

        verify(dashboardService).getDashboard(3L, 25L, fecha, fecha, principal);
    }

    @Test
    void getDashboard_supervisorMantieneSuSucursalYPuedeFiltrarAsesor() {
        LocalDate fecha = LocalDate.of(2026, 8, 17);
        JwtPrincipal principal = new JwtPrincipal(11L, "supervisor@magno.mx", "SUPERVISOR_CAMPO", 3L);
        when(auth.getPrincipal()).thenReturn(principal);

        controller.getDashboard(99L, 26L, fecha, fecha, auth);

        verify(dashboardService).getDashboard(3L, 26L, fecha, fecha, principal);
    }

    @Test
    void getDashboard_gerenteGeneralPuedeFiltrarSucursalYAsesor() {
        LocalDate fecha = LocalDate.of(2026, 8, 17);
        JwtPrincipal principal = new JwtPrincipal(1L, "admin@magno.mx", "ADMINISTRADOR", 1L);
        when(auth.getPrincipal()).thenReturn(principal);

        controller.getDashboard(4L, 30L, fecha, fecha, auth);

        verify(dashboardService).getDashboard(4L, 30L, fecha, fecha, principal);
    }
}
