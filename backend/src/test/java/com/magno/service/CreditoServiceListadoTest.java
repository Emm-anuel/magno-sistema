package com.magno.service;

import com.magno.model.Credito;
import com.magno.model.TipoCredito;
import com.magno.repository.*;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CreditoServiceListadoTest {

    private CreditoRepository creditoRepo;
    private CreditoService service;

    @BeforeEach
    void setUp() {
        creditoRepo = mock(CreditoRepository.class);
        service = new CreditoService(
                creditoRepo,
                mock(CalendarioPagoRepository.class),
                mock(ClienteRepository.class),
                mock(UsuarioRepository.class),
                mock(SucursalRepository.class),
                mock(CreditoCalculoService.class),
                mock(RenovacionRepository.class),
                mock(RenovacionElegibilidadService.class),
                mock(PagoRepository.class),
                mock(MultaRepository.class),
                mock(AbonoCorrienteRepository.class),
                mock(CajaDiaRepository.class),
                mock(SaldoCuotaService.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void listar_aplicaTipoEnLaConsultaAntesDePaginar() {
        Pageable pageable = PageRequest.of(0, 20);
        when(creditoRepo.findAll(any(Specification.class), eq(pageable)))
                .thenReturn(Page.empty(pageable));

        service.listar(null, null, null, null, TipoCredito.RENOVACION, null, pageable);

        ArgumentCaptor<Specification<Credito>> specCaptor = ArgumentCaptor.forClass(Specification.class);
        verify(creditoRepo).findAll(specCaptor.capture(), eq(pageable));

        Root<Credito> root = mock(Root.class);
        CriteriaQuery<?> query = mock(CriteriaQuery.class);
        CriteriaBuilder cb = mock(CriteriaBuilder.class);
        Path<Object> deletedAtPath = mock(Path.class);
        Path<Object> tipoPath = mock(Path.class);
        Predicate deletedAtPredicate = mock(Predicate.class);
        Predicate tipoPredicate = mock(Predicate.class);
        Predicate combinedPredicate = mock(Predicate.class);

        when(root.<Object>get("deletedAt")).thenReturn(deletedAtPath);
        when(root.<Object>get("tipo")).thenReturn(tipoPath);
        when(cb.isNull(deletedAtPath)).thenReturn(deletedAtPredicate);
        when(cb.equal(tipoPath, TipoCredito.RENOVACION)).thenReturn(tipoPredicate);
        when(cb.and(deletedAtPredicate, tipoPredicate)).thenReturn(combinedPredicate);

        specCaptor.getValue().toPredicate(root, query, cb);

        verify(cb).equal(tipoPath, TipoCredito.RENOVACION);
    }
}
