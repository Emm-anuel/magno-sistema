package com.magno.security;

import com.magno.model.EstadoCaja;
import com.magno.repository.CajaDiaRepository;
import com.magno.util.DateTimeUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CajaGuardTest {

    private CajaDiaRepository cajaDiaRepo;
    private CajaGuard cajaGuard;

    private static final Long USUARIO_ID = 10L;
    private static final Long HOME_SUCURSAL_ID = 1L;
    private static final Long OTRA_SUCURSAL_ID = 2L;

    @BeforeEach
    void setUp() {
        cajaDiaRepo = mock(CajaDiaRepository.class);
        cajaGuard = new CajaGuard(cajaDiaRepo);
    }

    @Test
    void rolBloqueado_conCajaAbiertaEnSucursalIndicada_noLanzaExcepcion() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);
        when(cajaDiaRepo.existsBySucursalIdAndFechaAndEstado(OTRA_SUCURSAL_ID, DateTimeUtils.hoyEnMagno(), EstadoCaja.ABIERTA))
                .thenReturn(true);

        cajaGuard.validarCajaAbierta(principal, OTRA_SUCURSAL_ID);
        // No exception thrown = success
    }

    @Test
    void rolBloqueado_conCajaCerradaEnSucursalIndicada_lanzaForbidden() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "asesor@magno.mx", "ASESOR_COBRADOR", HOME_SUCURSAL_ID);
        when(cajaDiaRepo.existsBySucursalIdAndFechaAndEstado(HOME_SUCURSAL_ID, DateTimeUtils.hoyEnMagno(), EstadoCaja.ABIERTA))
                .thenReturn(false);

        assertThatThrownBy(() -> cajaGuard.validarCajaAbierta(principal, HOME_SUCURSAL_ID))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void rolNoBloqueado_nuncaValidaCaja_noConsultaRepositorio() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "admin@magno.mx", "ADMINISTRADOR", HOME_SUCURSAL_ID);

        cajaGuard.validarCajaAbierta(principal, OTRA_SUCURSAL_ID);

        verifyNoInteractions(cajaDiaRepo);
    }

    @Test
    void overloadUnArgumento_delegaUsandoSucursalHomeDelPrincipal() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);
        when(cajaDiaRepo.existsBySucursalIdAndFechaAndEstado(HOME_SUCURSAL_ID, DateTimeUtils.hoyEnMagno(), EstadoCaja.ABIERTA))
                .thenReturn(true);
        when(cajaDiaRepo.existsBySucursalIdAndFechaAndEstado(OTRA_SUCURSAL_ID, DateTimeUtils.hoyEnMagno(), EstadoCaja.ABIERTA))
                .thenReturn(false);

        // Si el overload de 1 argumento validara contra OTRA_SUCURSAL_ID en vez de la home,
        // esto lanzaría ResponseStatusException porque esa caja está "cerrada" en el stub.
        cajaGuard.validarCajaAbierta(principal);
        // No exception thrown = success — confirma que validó HOME_SUCURSAL_ID, no OTRA_SUCURSAL_ID.
    }
}
