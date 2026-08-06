package com.magno.security;

import com.magno.repository.ClienteRepository;
import com.magno.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SecurityHelperTest {

    private ClienteRepository clienteRepo;
    private UsuarioRepository usuarioRepo;
    private SecurityHelper securityHelper;

    private static final Long USUARIO_ID = 10L;
    private static final Long HOME_SUCURSAL_ID = 1L;
    private static final Long SUCURSAL_ADICIONAL_ID = 2L;
    private static final Long SUCURSAL_NO_ASIGNADA_ID = 3L;

    @BeforeEach
    void setUp() {
        clienteRepo = mock(ClienteRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        securityHelper = new SecurityHelper(clienteRepo, usuarioRepo);
    }

    @Test
    void administrador_tieneAccesoACualquierSucursal() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "admin@magno.mx", "ADMINISTRADOR", HOME_SUCURSAL_ID);

        assertThat(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_NO_ASIGNADA_ID)).isTrue();
    }

    @Test
    void supervisorCampo_tieneAccesoASuSucursalHome() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);

        assertThat(securityHelper.tieneAccesoSucursal(principal, HOME_SUCURSAL_ID)).isTrue();
    }

    @Test
    void supervisorCampo_tieneAccesoASucursalAdicionalAsignada() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);
        when(usuarioRepo.existsByIdAndSucursalesAdicionales_Id(USUARIO_ID, SUCURSAL_ADICIONAL_ID)).thenReturn(true);

        assertThat(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_ADICIONAL_ID)).isTrue();
    }

    @Test
    void supervisorCampo_sinAccesoASucursalNoAsignada() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);
        when(usuarioRepo.existsByIdAndSucursalesAdicionales_Id(USUARIO_ID, SUCURSAL_NO_ASIGNADA_ID)).thenReturn(false);

        assertThat(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_NO_ASIGNADA_ID)).isFalse();
    }

    @Test
    void supervisor_sinAccesoAOtraSucursal_soloVeSuHome() {
        // SUPERVISOR (Gerente de Sucursal) no debe tratarse como "ve todo" — solo ADMINISTRADOR
        // tiene ese bypass. Ver la nota en el spec (docs/superpowers/specs/2026-08-06-supervisor-multi-sucursal-design.md).
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "gerente@magno.mx", "SUPERVISOR", HOME_SUCURSAL_ID);

        assertThat(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_NO_ASIGNADA_ID)).isFalse();
        assertThat(securityHelper.tieneAccesoSucursal(principal, HOME_SUCURSAL_ID)).isTrue();
    }

    @Test
    void sucursalIdNulo_siempreFalse() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "admin@magno.mx", "ADMINISTRADOR", HOME_SUCURSAL_ID);

        assertThat(securityHelper.tieneAccesoSucursal(principal, null)).isFalse();
    }

    @Test
    void asesorCobrador_sinAccesoAOtraSucursal_soloVeSuHome() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "asesor@magno.mx", "ASESOR_COBRADOR", HOME_SUCURSAL_ID);

        assertThat(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_NO_ASIGNADA_ID)).isFalse();
        assertThat(securityHelper.tieneAccesoSucursal(principal, HOME_SUCURSAL_ID)).isTrue();
    }

    @Test
    void principalSinSucursalHome_noLanzaExcepcion_devuelveFalse() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "raro@magno.mx", "SUPERVISOR_CAMPO", null);

        assertThat(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_NO_ASIGNADA_ID)).isFalse();
    }
}
