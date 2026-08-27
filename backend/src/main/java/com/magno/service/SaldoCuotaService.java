package com.magno.service;

import com.magno.model.CalendarioPago;
import com.magno.repository.AbonoCoberturaDetalleRepository;
import com.magno.repository.PagoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

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

    private BigDecimal coalesce(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
