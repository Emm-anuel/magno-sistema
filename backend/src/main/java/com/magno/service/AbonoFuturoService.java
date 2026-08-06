package com.magno.service;

import com.magno.model.AbonoCoberturaDetalle;
import com.magno.model.CalendarioPago;
import com.magno.model.Credito;
import com.magno.model.EstadoCalendarioPago;
import com.magno.repository.CalendarioPagoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Adelanta días futuros PENDIENTE de un crédito con el saldo que sobra después
 * de cubrir atrasados (AbonoCorrienteService) o el día en curso (CobrosService),
 * para que el cliente pueda pagar por adelantado en vez de dejar el excedente
 * sin aplicar. No depende de CobrosService/AbonoCorrienteService para evitar
 * un ciclo, ya que ambos lo usan.
 */
@Service
@Transactional(readOnly = true)
public class AbonoFuturoService {

    private final CalendarioPagoRepository calendarioPagoRepo;

    public AbonoFuturoService(CalendarioPagoRepository calendarioPagoRepo) {
        this.calendarioPagoRepo = calendarioPagoRepo;
    }

    public record ResultadoAdelanto(List<AbonoCoberturaDetalle> coberturas, BigDecimal saldoRestante) {}

    /**
     * Cubre días futuros completos en orden (nunca parcialmente) hasta agotar
     * el saldo o quedarse sin días futuros. Las coberturas devueltas aún no
     * tienen abono asignado — el llamador debe asociarlas al AbonoCorriente
     * correspondiente antes de guardarlas.
     */
    @Transactional
    public ResultadoAdelanto adelantarDiasFuturos(Credito credito, BigDecimal saldoDisponible,
            LocalDate fechaOperacion) {
        if (saldoDisponible.compareTo(BigDecimal.ZERO) <= 0) {
            return new ResultadoAdelanto(List.of(), saldoDisponible);
        }

        List<CalendarioPago> futuros = calendarioPagoRepo
                .findByCreditoIdAndEstadoOrderByNumeroPagoAsc(credito.getId(), EstadoCalendarioPago.PENDIENTE)
                .stream()
                .filter(cp -> cp.getFechaProgramada().isAfter(fechaOperacion))
                .toList();

        BigDecimal saldo = saldoDisponible;
        List<AbonoCoberturaDetalle> coberturas = new ArrayList<>();

        for (CalendarioPago slot : futuros) {
            BigDecimal costo = slot.getMontoEsperado();
            if (saldo.compareTo(costo) < 0) break;

            saldo = saldo.subtract(costo);
            slot.setEstado(EstadoCalendarioPago.ADELANTADO);
            calendarioPagoRepo.save(slot);

            coberturas.add(AbonoCoberturaDetalle.builder()
                    .calendarioPago(slot)
                    .numeroPago(slot.getNumeroPago())
                    .montoCuota(costo)
                    .montoMulta(BigDecimal.ZERO)
                    .totalAplicado(costo)
                    .esParcial(false)
                    .build());
        }

        return new ResultadoAdelanto(coberturas, saldo);
    }
}
