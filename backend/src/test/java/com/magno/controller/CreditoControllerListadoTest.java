package com.magno.controller;

import com.magno.model.TipoCredito;
import com.magno.security.CajaGuard;
import com.magno.security.JwtPrincipal;
import com.magno.security.SecurityHelper;
import com.magno.service.CreditoCalculoService;
import com.magno.service.CreditoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CreditoControllerListadoTest {

    private CreditoService creditoService;
    private CreditoController controller;
    private Authentication authentication;

    @BeforeEach
    void setUp() {
        creditoService = mock(CreditoService.class);
        controller = new CreditoController(
                creditoService,
                mock(CreditoCalculoService.class),
                mock(SecurityHelper.class),
                mock(CajaGuard.class));
        authentication = mock(Authentication.class);
        when(authentication.getPrincipal())
                .thenReturn(new JwtPrincipal(1L, "admin@magno.mx", "ADMINISTRADOR", 1L));
        when(creditoService.listar(
                isNull(), isNull(), isNull(), isNull(), eq(TipoCredito.RENOVACION),
                eq("angelica"), any(Pageable.class)))
                .thenReturn(Page.empty());
    }

    @Test
    void listar_enviaTipoAlServicioAntesDePaginar() {
        controller.listar(
                null,
                null,
                null,
                null,
                "RENOVACION",
                "angelica",
                0,
                20,
                authentication);

        verify(creditoService).listar(
                isNull(), isNull(), isNull(), isNull(), eq(TipoCredito.RENOVACION),
                eq("angelica"), any(Pageable.class));
    }
}
