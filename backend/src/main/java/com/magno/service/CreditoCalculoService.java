package com.magno.service;

import com.magno.model.CalendarioPago;
import com.magno.model.Credito;
import com.magno.model.EstadoCalendarioPago;
import com.magno.repository.CalendarioPagoRepository;
import com.magno.repository.DiaFestivoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Servicio de cálculo financiero para créditos.
 *
 * Encapsula TODA la lógica de negocio de cálculo numérico:
 * - Determinación del producto (plazo + tasa) según el capital
 * - Cálculo de cargo, total, pago diario
 * - Generación del calendario de pagos (N días hábiles corridos)
 *
 * NO tiene lógica de autorización ni de estado de negocio.
 */
@Service
public class CreditoCalculoService {

    private final DiaFestivoRepository diaFestivoRepo;
    private final CalendarioPagoRepository calendarioPagoRepo;

    public CreditoCalculoService(DiaFestivoRepository diaFestivoRepo,
                                 CalendarioPagoRepository calendarioPagoRepo) {
        this.diaFestivoRepo = diaFestivoRepo;
        this.calendarioPagoRepo = calendarioPagoRepo;
    }

    // ────────────────────────────────────────────────────────────────────
    // Inner records (resultado de cálculo)
    // ────────────────────────────────────────────────────────────────────

    /**
     * Parámetros del producto determinado según el capital solicitado.
     * Fuente: CLAUDE.md sección 6.1.
     */
    public record ProductoCredito(int plazo, BigDecimal tasa, String descripcion) {}

    /**
     * Resumen completo del cálculo de un crédito.
     * pagoPeriodicoExacto: sin redondear (para distribuir correctamente el último pago).
     * pagoPeriodico: redondeado al entero más cercano.
     */
    public record ResumenCalculo(
            BigDecimal capital,
            int plazo,
            BigDecimal tasa,
            BigDecimal cargoFinanciero,
            BigDecimal totalAPagar,
            BigDecimal pagoPeriodicoExacto,
            BigDecimal pagoPeriodico,
            BigDecimal pagoAdelantado
    ) {}

    // ────────────────────────────────────────────────────────────────────
    // Lógica de producto (sección 6.1 del CLAUDE.md)
    // ────────────────────────────────────────────────────────────────────

    /**
     * Determina plazo y tasa en función del capital solicitado/aprobado.
     *
     * <pre>
     * capital < $15,000          → 25 días, tasa 30%
     * $15,000 ≤ capital < $20,000 → 25 días, tasa 24%
     * capital ≥ $20,000           → 30 días, tasa 24%
     * </pre>
     */
    public ProductoCredito determinarProducto(BigDecimal capital) {
        if (capital.compareTo(new BigDecimal("15000")) < 0) {
            return new ProductoCredito(25, new BigDecimal("0.30"), "25 días · 30% interés");
        } else if (capital.compareTo(new BigDecimal("20000")) < 0) {
            return new ProductoCredito(25, new BigDecimal("0.24"), "25 días · 24% interés");
        } else {
            return new ProductoCredito(30, new BigDecimal("0.24"), "30 días · 24% interés");
        }
    }

    /**
     * Calcula todos los valores financieros del crédito a partir del capital.
     *
     * Verificaciones de la tabla del CLAUDE.md:
     *  capital=$2,000  → cargo=$600,  total=$2,600,  pago=$104  ✓
     *  capital=$8,000  → cargo=$2,400, total=$10,400, pago=$416  ✓
     *  capital=$15,000 → cargo=$3,600, total=$18,600, pago=$744  ✓
     *  capital=$20,000 → cargo=$4,800, total=$24,800, pago=$827  ✓
     *   (nota: la tabla del cliente muestra $4,810 por redondear el pago primero;
     *    la fórmula correcta es capital×tasa=4800, total=24800, pago=round(24800/30)=827)
     */
    public ResumenCalculo calcularCredito(BigDecimal capital) {
        ProductoCredito producto = determinarProducto(capital);

        BigDecimal cargo = capital.multiply(producto.tasa()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = capital.add(cargo).setScale(2, RoundingMode.HALF_UP);

        BigDecimal plazoDecimal = BigDecimal.valueOf(producto.plazo());
        BigDecimal pagoExacto   = total.divide(plazoDecimal, 10, RoundingMode.HALF_UP);
        BigDecimal pago         = total.divide(plazoDecimal, 0, RoundingMode.HALF_UP);

        return new ResumenCalculo(
                capital,
                producto.plazo(),
                producto.tasa(),
                cargo,
                total,
                pagoExacto,
                pago,
                pago           // pagoAdelantado = primer pago (mismo monto)
        );
    }

    // ────────────────────────────────────────────────────────────────────
    // Generación del calendario de pagos
    // ────────────────────────────────────────────────────────────────────

    /**
     * Genera exactamente {@code plazo} días hábiles corridos a partir de
     * {@code fechaInicio}, saltando sábados, domingos y días festivos de
     * la sucursal indicada (Opción C, confirmada con el cliente).
     *
     * <ul>
     *   <li>Pago #1: estado=ADELANTADO (ya se cobró al desembolsar)</li>
     *   <li>Pago #N: monto ajustado para que la suma exacta = totalAPagar</li>
     * </ul>
     *
     * Actualiza {@code credito.fechaVencimiento} con la fecha del último pago.
     *
     * @param credito         entidad gestionada (se modifica fechaVencimiento in-place)
     * @param fechaInicio     primer día hábil del calendario
     * @param plazo           número de pagos (25 o 30)
     * @param calculo         resumen financiero para saber montos exactos
     * @param sucursalId      para filtrar días festivos
     * @return lista de CalendarioPago persistida
     */
    @Transactional
    public List<CalendarioPago> generarCalendario(Credito credito,
                                                   LocalDate fechaInicio,
                                                   int plazo,
                                                   ResumenCalculo calculo,
                                                   Long sucursalId) {
        // Obtener días festivos de la sucursal (+ globales)
        Set<LocalDate> diasFestivos = new HashSet<>(diaFestivoRepo.findFechasBySucursalId(sucursalId));

        List<CalendarioPago> pagos = new ArrayList<>(plazo);
        LocalDate cursor = fechaInicio;

        for (int num = 1; num <= plazo; num++) {
            // Avanzar al siguiente día hábil
            while (esInhabil(cursor, diasFestivos)) {
                cursor = cursor.plusDays(1);
            }

            BigDecimal monto;
            EstadoCalendarioPago estadoInicial;

            if (num == 1) {
                // Primer pago: ya cobrado como adelantado
                monto = calculo.pagoPeriodico();
                estadoInicial = EstadoCalendarioPago.ADELANTADO;
            } else if (num == plazo) {
                // Último pago: absorbe el residuo del redondeo para que la suma sea exacta
                BigDecimal pagados = calculo.pagoPeriodico().multiply(BigDecimal.valueOf(plazo - 1L));
                monto = calculo.totalAPagar().subtract(pagados).setScale(2, RoundingMode.HALF_UP);
                estadoInicial = EstadoCalendarioPago.PENDIENTE;
            } else {
                monto = calculo.pagoPeriodico();
                estadoInicial = EstadoCalendarioPago.PENDIENTE;
            }

            CalendarioPago cp = CalendarioPago.builder()
                    .credito(credito)
                    .numeroPago(num)
                    .fechaProgramada(cursor)
                    .montoEsperado(monto)
                    .estado(estadoInicial)
                    .build();

            pagos.add(calendarioPagoRepo.save(cp));

            cursor = cursor.plusDays(1); // avanzar para el siguiente pago
        }

        // Actualizar fecha de vencimiento en el crédito
        credito.setFechaVencimiento(pagos.get(pagos.size() - 1).getFechaProgramada());

        return pagos;
    }

    // ────────────────────────────────────────────────────────────────────
    // Helpers privados
    // ────────────────────────────────────────────────────────────────────

    private boolean esInhabil(LocalDate fecha, Set<LocalDate> festivos) {
        DayOfWeek dow = fecha.getDayOfWeek();
        return dow == DayOfWeek.SATURDAY
               || dow == DayOfWeek.SUNDAY
               || festivos.contains(fecha);
    }
}
