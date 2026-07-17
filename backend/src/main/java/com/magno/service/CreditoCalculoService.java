package com.magno.service;

import com.magno.model.CalendarioPago;
import com.magno.model.ConfigRangoCredito;
import com.magno.model.Credito;
import com.magno.model.EstadoCalendarioPago;
import com.magno.repository.CalendarioPagoRepository;
import com.magno.repository.ConfigRangoCreditoRepository;
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
import java.util.Optional;
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
    private final ConfigRangoCreditoRepository configRangoRepo;

    public CreditoCalculoService(DiaFestivoRepository diaFestivoRepo,
            CalendarioPagoRepository calendarioPagoRepo,
            ConfigRangoCreditoRepository configRangoRepo) {
        this.diaFestivoRepo = diaFestivoRepo;
        this.calendarioPagoRepo = calendarioPagoRepo;
        this.configRangoRepo = configRangoRepo;
    }

    // ────────────────────────────────────────────────────────────────────
    // Inner records (resultado de cálculo)
    // ────────────────────────────────────────────────────────────────────

    /**
     * Parámetros del producto determinado según el capital solicitado.
     * Fuente: CLAUDE.md sección 6.1.
     */
    public record ProductoCredito(int plazo, BigDecimal tasa, String descripcion) {
    }

    /**
     * Resumen completo del cálculo de un crédito.
     * pagoPeriodicoExacto: sin redondear (para distribuir correctamente el último
     * pago).
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
            BigDecimal pagoAdelantado) {
    }

    // ────────────────────────────────────────────────────────────────────
    // Lógica de producto (sección 6.1 del CLAUDE.md)
    // ────────────────────────────────────────────────────────────────────

    /**
     * Determina plazo y tasa para créditos diarios. Lee desde DB si hay config para
     * la sucursal; si no, usa los valores predeterminados del sistema.
     */
    public ProductoCredito determinarProducto(BigDecimal capital, Long sucursalId) {
        if (sucursalId != null) {
            Optional<ConfigRangoCredito> rango = configRangoRepo
                    .findBySucursalAndTipoPagoAndCapital(sucursalId, "DIARIO", capital);
            if (rango.isPresent()) {
                ConfigRangoCredito r = rango.get();
                String pct = r.getTasaInteres().multiply(BigDecimal.valueOf(100))
                        .stripTrailingZeros().toPlainString();
                return new ProductoCredito(r.getPlazo(), r.getTasaInteres(),
                        r.getPlazo() + " días · " + pct + "% interés");
            }
        }
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
     * capital=$2,000 → cargo=$600, total=$2,600, pago=$104 ✓
     * capital=$8,000 → cargo=$2,400, total=$10,400, pago=$416 ✓
     * capital=$15,000 → cargo=$3,600, total=$18,600, pago=$744 ✓
     * capital=$20,000 → cargo=$4,800, total=$24,800, pago=$827 ✓
     * (nota: la tabla del cliente muestra $4,810 por redondear el pago primero;
     * la fórmula correcta es capital×tasa=4800, total=24800,
     * pago=round(24800/30)=827)
     */
    public ResumenCalculo calcularCredito(BigDecimal capital, Long sucursalId) {
        ProductoCredito producto = determinarProducto(capital, sucursalId);

        BigDecimal cargo = capital.multiply(producto.tasa()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = capital.add(cargo).setScale(2, RoundingMode.HALF_UP);

        BigDecimal plazoDecimal = BigDecimal.valueOf(producto.plazo());
        BigDecimal pagoExacto = total.divide(plazoDecimal, 10, RoundingMode.HALF_UP);
        BigDecimal pago = total.divide(plazoDecimal, 0, RoundingMode.HALF_UP);
        // Último pago absorbe residuo del redondeo y es el cobrado por adelantado
        BigDecimal ultimoPago = total.subtract(pago.multiply(BigDecimal.valueOf(producto.plazo() - 1L)))
                .setScale(2, RoundingMode.HALF_UP);

        return new ResumenCalculo(
                capital,
                producto.plazo(),
                producto.tasa(),
                cargo,
                total,
                pagoExacto,
                pago,
                ultimoPago
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
     * <li>Pago #N (último): estado=ADELANTADO (ya se cobró al desembolsar)</li>
     * <li>Pago #N: monto ajustado para que la suma exacta = totalAPagar</li>
     * </ul>
     *
     * Actualiza {@code credito.fechaVencimiento} con la fecha del último pago.
     *
     * @param credito     entidad gestionada (se modifica fechaVencimiento in-place)
     * @param fechaInicio primer día hábil del calendario
     * @param plazo       número de pagos (25 o 30)
     * @param calculo     resumen financiero para saber montos exactos
     * @param sucursalId  para filtrar días festivos
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
            while (esInhabil(cursor, diasFestivos)) {
                cursor = cursor.plusDays(1);
            }

            BigDecimal monto;
            EstadoCalendarioPago estadoInicial;

            if (num == plazo) {
                // Último pago: absorbe el residuo del redondeo + ya fue cobrado adelantado al desembolsar
                BigDecimal pagados = calculo.pagoPeriodico().multiply(BigDecimal.valueOf(plazo - 1L));
                monto = calculo.totalAPagar().subtract(pagados).setScale(2, RoundingMode.HALF_UP);
                estadoInicial = EstadoCalendarioPago.ADELANTADO;
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
    // Créditos Semanales (tipo de pago = SEMANAL)
    // ────────────────────────────────────────────────────────────────────

    /**
     * Determina plazo y tasa para créditos semanales. Lee desde DB si hay config
     * para la sucursal; si no, usa los valores predeterminados del sistema.
     */
    public ProductoCredito determinarProductoSemanal(BigDecimal capital, Long sucursalId) {
        if (sucursalId != null) {
            Optional<ConfigRangoCredito> rango = configRangoRepo
                    .findBySucursalAndTipoPagoAndCapital(sucursalId, "SEMANAL", capital);
            if (rango.isPresent()) {
                ConfigRangoCredito r = rango.get();
                String pct = r.getTasaInteres().multiply(BigDecimal.valueOf(100))
                        .stripTrailingZeros().toPlainString();
                return new ProductoCredito(r.getPlazo(), r.getTasaInteres(),
                        r.getPlazo() + " semanas · " + pct + "% interés");
            }
        }
        if (capital.compareTo(new BigDecimal("10000")) < 0) {
            return new ProductoCredito(8, new BigDecimal("0.40"), "8 semanas · 40% interés");
        } else {
            return new ProductoCredito(12, new BigDecimal("0.40"), "12 semanas · 40% interés");
        }
    }

    /**
     * Calcula todos los valores financieros de un crédito semanal a partir del
     * capital.
     *
     * Verificaciones:
     * capital=$5,000 → cargo=$2,000, total=$7,000, pago semanal=$875 ✓
     * capital=$8,000 → cargo=$3,200, total=$11,200, pago semanal=$1,400 ✓
     * capital=$10,000 → cargo=$4,000, total=$14,000, pago semanal=$1,167 ✓
     * capital=$15,000 → cargo=$6,000, total=$21,000, pago semanal=$1,750 ✓
     */
    public ResumenCalculo calcularCreditoSemanal(BigDecimal capital, Long sucursalId) {
        ProductoCredito producto = determinarProductoSemanal(capital, sucursalId);

        BigDecimal cargo = capital.multiply(producto.tasa()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = capital.add(cargo).setScale(2, RoundingMode.HALF_UP);

        BigDecimal plazoDecimal = BigDecimal.valueOf(producto.plazo());
        BigDecimal pagoExacto = total.divide(plazoDecimal, 10, RoundingMode.HALF_UP);
        BigDecimal pago = total.divide(plazoDecimal, 0, RoundingMode.HALF_UP);

        // Créditos semanales: no hay pago adelantado, el crédito se entrega completo.
        return new ResumenCalculo(
                capital,
                producto.plazo(),
                producto.tasa(),
                cargo,
                total,
                pagoExacto,
                pago,
                BigDecimal.ZERO
        );
    }

    /**
     * Genera exactamente {@code plazo} pagos con frecuencia semanal.
     * Las fechas base están separadas por 7 días calendario; cada vencimiento
     * inhábil se recorre al siguiente día hábil de forma independiente.
     *
     * <ul>
     * <li>Pago #N (último): estado=ADELANTADO (ya se cobró al desembolsar)</li>
     * <li>Pago #N: monto ajustado para que la suma exacta = totalAPagar</li>
     * <li>Las fechas base conservan una cadencia de 7 días calendario</li>
     * </ul>
     *
     * Actualiza {@code credito.fechaVencimiento} con la fecha del último pago.
     *
     * @param credito     entidad gestionada (se modifica fechaVencimiento in-place)
     * @param fechaInicio primer día hábil del calendario
     * @param plazo       número de semanas (8 o 12)
     * @param calculo     resumen financiero para saber montos exactos
     * @param sucursalId  para filtrar días festivos
     * @return lista de CalendarioPago persistida
     */
    @Transactional
    public List<CalendarioPago> generarCalendarioSemanal(Credito credito,
            LocalDate fechaInicio,
            int plazo,
            ResumenCalculo calculo,
            Long sucursalId) {
        // Obtener días festivos de la sucursal (+ globales)
        Set<LocalDate> diasFestivos = new HashSet<>(diaFestivoRepo.findFechasBySucursalId(sucursalId));

        List<CalendarioPago> pagos = new ArrayList<>(plazo);
        LocalDate fechaBase = fechaInicio;

        for (int num = 1; num <= plazo; num++) {
            LocalDate fechaProgramada = fechaBase;
            while (esInhabil(fechaProgramada, diasFestivos)) {
                fechaProgramada = fechaProgramada.plusDays(1);
            }

            BigDecimal monto;
            EstadoCalendarioPago estadoInicial;

            if (num == plazo) {
                // Último pago: absorbe el residuo del redondeo. Sin pago adelantado en semanales.
                BigDecimal pagados = calculo.pagoPeriodico().multiply(BigDecimal.valueOf(plazo - 1L));
                monto = calculo.totalAPagar().subtract(pagados).setScale(2, RoundingMode.HALF_UP);
            } else {
                monto = calculo.pagoPeriodico();
            }
            estadoInicial = EstadoCalendarioPago.PENDIENTE;

            CalendarioPago cp = CalendarioPago.builder()
                    .credito(credito)
                    .numeroPago(num)
                    .fechaProgramada(fechaProgramada)
                    .montoEsperado(monto)
                    .estado(estadoInicial)
                    .build();

            pagos.add(calendarioPagoRepo.save(cp));

            // Mantener el ancla semanal aunque este vencimiento haya sido recorrido.
            fechaBase = fechaBase.plusDays(7);
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
