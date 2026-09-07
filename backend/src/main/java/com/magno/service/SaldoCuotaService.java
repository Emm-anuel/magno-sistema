package com.magno.service;

import com.magno.model.CalendarioPago;
import com.magno.repository.AbonoCoberturaDetalleRepository;
import com.magno.repository.PagoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Calcula el capital realmente cubierto de una cuota. Las multas se registran
 * en el mismo movimiento de caja, pero nunca deben reducir el saldo de capital.
 */
@Service
@Transactional(readOnly = true)
public class SaldoCuotaService {

    private final PagoRepository pagoRepo;
    private final AbonoCoberturaDetalleRepository abonoCoberturaRepo;

    public SaldoCuotaService(
            PagoRepository pagoRepo,
            AbonoCoberturaDetalleRepository abonoCoberturaRepo) {
        this.pagoRepo = pagoRepo;
        this.abonoCoberturaRepo = abonoCoberturaRepo;
    }

    public BigDecimal saldoCuota(CalendarioPago cuota) {
        BigDecimal aplicadoDirecto = coalesce(
                pagoRepo.sumMontoCuotaAplicadoByCalendarioPagoId(cuota.getId()));
        BigDecimal aplicadoEnAbonos = coalesce(
                abonoCoberturaRepo.sumMontoCuotaByCalendarioPagoId(cuota.getId()));

        return cuota.getMontoEsperado()
                .subtract(aplicadoDirecto)
                .subtract(aplicadoEnAbonos)
                .max(BigDecimal.ZERO);
    }

    /**
     * Dinero registrado para cada cuota, incluyendo pagos directos y abonos de
     * adeudo. Se usa en el historial para mostrar cuánto entregó el cliente en
     * las cuotas parciales.
     */
    public Map<Long, BigDecimal> montosAbonadosPorCuota(Long creditoId) {
        Map<Long, BigDecimal> montos = new HashMap<>();

        pagoRepo.findByCreditoIdOrderByNumeroPago(creditoId).stream()
                .filter(p -> p.getDeletedAt() == null)
                .filter(p -> p.getCalendarioPago() != null)
                .filter(p -> p.getRazonNoPago() == null || p.getRazonNoPago().isBlank())
                .forEach(p -> montos.merge(
                        p.getCalendarioPago().getId(),
                        coalesce(p.getMontoRecibido()),
                        BigDecimal::add));

        abonoCoberturaRepo.findByAbono_CreditoIdOrderByNumeroPagoAsc(creditoId)
                .forEach(detalle -> montos.merge(
                        detalle.getCalendarioPago().getId(),
                        coalesce(detalle.getTotalAplicado()),
                        BigDecimal::add));

        return montos;
    }

    private BigDecimal coalesce(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
