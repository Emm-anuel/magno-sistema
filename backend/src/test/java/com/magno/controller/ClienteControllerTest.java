package com.magno.controller;

import com.magno.dto.cliente.ClienteDetalleDTO;
import com.magno.dto.cliente.ClienteUpdateRequest;
import com.magno.security.CajaGuard;
import com.magno.security.JwtPrincipal;
import com.magno.security.SecurityHelper;
import com.magno.service.ClientePdfService;
import com.magno.service.ClienteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cubre la interacción entre {@code normalizarUpdate} y {@code actualizar} — el punto exacto
 * donde dos regresiones seguidas se colaron (reasignación silenciosa de sucursal al editar,
 * y luego caja bloqueada incondicionalmente para SUPERVISOR_CAMPO por leer el campo nulled).
 */
class ClienteControllerTest {

    private ClienteService clienteService;
    private ClientePdfService clientePdfService;
    private CajaGuard cajaGuard;
    private SecurityHelper securityHelper;
    private ClienteController controller;
    private Authentication auth;

    private static final Long CLIENTE_ID = 100L;
    private static final Long USUARIO_ID = 10L;
    private static final Long HOME_SUCURSAL_ID = 1L;   // A — home del SUPERVISOR_CAMPO
    private static final Long SUCURSAL_ADICIONAL_ID = 2L; // B — asignada, no home
    private static final Long SUCURSAL_NO_ASIGNADA_ID = 999L; // Z — sin ninguna relación con el usuario

    @BeforeEach
    void setUp() {
        clienteService = mock(ClienteService.class);
        clientePdfService = mock(ClientePdfService.class);
        cajaGuard = mock(CajaGuard.class);
        securityHelper = mock(SecurityHelper.class);
        controller = new ClienteController(clienteService, clientePdfService, cajaGuard, securityHelper);
        auth = mock(Authentication.class);
    }

    @Test
    void actualizar_supervisorCampoSinAccesoASucursalDelCliente_devuelve403_yNoLlamaCajaGuardNiActualizar() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);
        when(auth.getPrincipal()).thenReturn(principal);

        ClienteDetalleDTO clienteActual = clienteConSucursal(CLIENTE_ID, SUCURSAL_NO_ASIGNADA_ID);
        when(clienteService.obtenerDetalle(CLIENTE_ID)).thenReturn(clienteActual);
        when(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_NO_ASIGNADA_ID)).thenReturn(false);

        ResponseEntity<ClienteDetalleDTO> response = controller.actualizar(CLIENTE_ID, requestVacio(), auth);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verify(clienteService, never()).actualizarCliente(any(), any());
        verify(cajaGuard, never()).validarCajaAbierta(any(), any());
    }

    @Test
    void actualizar_supervisorCampoConAccesoASucursalAdicional_cajaAbierta_actualizaOk() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);
        when(auth.getPrincipal()).thenReturn(principal);

        ClienteDetalleDTO clienteActual = clienteConSucursal(CLIENTE_ID, SUCURSAL_ADICIONAL_ID);
        when(clienteService.obtenerDetalle(CLIENTE_ID)).thenReturn(clienteActual);
        when(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_ADICIONAL_ID)).thenReturn(true);
        // cajaGuard.validarCajaAbierta es void — el mock por defecto no hace nada (equivalente a "caja abierta").
        ClienteDetalleDTO clienteActualizado = clienteConSucursal(CLIENTE_ID, SUCURSAL_ADICIONAL_ID);
        when(clienteService.actualizarCliente(eq(CLIENTE_ID), any())).thenReturn(clienteActualizado);

        ResponseEntity<ClienteDetalleDTO> response = controller.actualizar(CLIENTE_ID, requestVacio(), auth);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Esta es la aserción que habría atrapado la regresión: la caja debe validarse contra
        // la sucursal ACTUAL del cliente (B), no contra el campo sucursalId del DTO normalizado
        // (que ahora es intencionalmente null para SUPERVISOR/SUPERVISOR_CAMPO).
        verify(cajaGuard).validarCajaAbierta(eq(principal), eq(SUCURSAL_ADICIONAL_ID));
    }

    @Test
    void actualizar_supervisorCampoConAccesoPeroCajaCerrada_lanzaForbidden_yNoActualiza() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);
        when(auth.getPrincipal()).thenReturn(principal);

        ClienteDetalleDTO clienteActual = clienteConSucursal(CLIENTE_ID, SUCURSAL_ADICIONAL_ID);
        when(clienteService.obtenerDetalle(CLIENTE_ID)).thenReturn(clienteActual);
        when(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_ADICIONAL_ID)).thenReturn(true);
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "No es posible registrar operaciones — la caja está cerrada"))
                .when(cajaGuard).validarCajaAbierta(principal, SUCURSAL_ADICIONAL_ID);

        assertThatThrownBy(() -> controller.actualizar(CLIENTE_ID, requestVacio(), auth))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        verify(clienteService, never()).actualizarCliente(any(), any());
    }

    // ── Builders ──────────────────────────────────────────────────

    private ClienteDetalleDTO clienteConSucursal(Long id, Long sucursalId) {
        return new ClienteDetalleDTO(
                id,                                 // id
                "NC-0001",                          // numeroCliente
                "Juan",                              // nombre
                "Perez",                             // apellidoPaterno
                "Lopez",                             // apellidoMaterno
                "Juan Perez Lopez",                  // nombreCompleto
                null,                                // fechaNacimiento
                null,                                // genero
                null,                                // estadoCivil
                null,                                // nombreConyuge
                null,                                // telefonoFijo
                null,                                // celular
                null,                                // ineTipo
                null,                                // ineNumero
                null,                                // curp
                null,                                // rfc
                null,                                // domCalle
                null,                                // domNoExterior
                null,                                // domNoInterior
                null,                                // domColonia
                null,                                // domMunicipio
                null,                                // domEstado
                null,                                // domCodigoPostal
                null,                                // domTipoVivienda
                null,                                // domMontoRenta
                null,                                // negocioNombre
                null,                                // negocioGiro
                null,                                // negocioAntiguedad
                null,                                // negocioDireccion
                null,                                // negocioCalle
                null,                                // negocioNoExterior
                null,                                // negocioNoInterior
                null,                                // negocioColonia
                null,                                // negocioMunicipio
                null,                                // negocioEstado
                null,                                // negocioCp
                null,                                // negocioTipoLocal
                null,                                // negocioMontoRenta
                null,                                // negocioHorarios
                null,                                // negocioLat
                null,                                // negocioLng
                null,                                // ingresosSemanales
                null,                                // gastosSemanales
                null,                                // gastosRenta
                null,                                // gastosOtros
                null,                                // ref1Nombre
                null,                                // ref1Telefono
                null,                                // ref1Parentesco
                null,                                // ref2Nombre
                null,                                // ref2Telefono
                null,                                // ref2Parentesco
                null,                                // avalNombre
                null,                                // avalTelefono
                null,                                // avalDireccion
                null,                                // avalIdentificacion
                null,                                // asesor
                new ClienteDetalleDTO.SucursalInfo(sucursalId, "Sucursal Test"), // sucursal
                Boolean.TRUE,                        // activo
                "ACTIVO",                            // estadoCliente
                Boolean.FALSE,                       // tieneCreditoActivo
                null,                                // createdAt
                null                                 // updatedAt
        );
    }

    private ClienteUpdateRequest requestVacio() {
        return new ClienteUpdateRequest(
                null, // nombre
                null, // apellidoPaterno
                null, // apellidoMaterno
                null, // fechaNacimiento
                null, // genero
                null, // estadoCivil
                null, // nombreConyuge
                null, // telefonoFijo
                null, // celular
                null, // ineTipo
                null, // ineNumero
                null, // curp
                null, // rfc
                null, // domCalle
                null, // domNoExterior
                null, // domNoInterior
                null, // domColonia
                null, // domMunicipio
                null, // domEstado
                null, // domCodigoPostal
                null, // domTipoVivienda
                null, // domMontoRenta
                null, // negocioNombre
                null, // negocioGiro
                null, // negocioAntiguedad
                null, // negocioDireccion
                null, // negocioCalle
                null, // negocioNoExterior
                null, // negocioNoInterior
                null, // negocioColonia
                null, // negocioMunicipio
                null, // negocioEstado
                null, // negocioCp
                null, // negocioTipoLocal
                null, // negocioMontoRenta
                null, // negocioHorarios
                null, // negocioLat
                null, // negocioLng
                null, // ingresosSemanales
                null, // gastosSemanales
                null, // gastosRenta
                null, // gastosOtros
                null, // ref1Nombre
                null, // ref1Telefono
                null, // ref1Parentesco
                null, // ref2Nombre
                null, // ref2Telefono
                null, // ref2Parentesco
                null, // avalNombre
                null, // avalTelefono
                null, // avalDireccion
                null, // avalIdentificacion
                null, // asesorId
                null  // sucursalId — el request nunca fuerza sucursal para SUPERVISOR_CAMPO
        );
    }
}
