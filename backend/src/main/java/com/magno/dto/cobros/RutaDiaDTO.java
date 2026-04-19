package com.magno.dto.cobros;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Respuesta completa de la ruta del día de un asesor.
 * Incluye todos sus clientes con crédito activo y el resumen del día.
 */
public record RutaDiaDTO(
                AsesorResumenDTO asesor,
                LocalDate fecha,
                List<ClienteRutaDTO> clientes,
                Resumen resumen) {

        public record AsesorResumenDTO(Long id, String nombreCompleto) {
        }

        public record Resumen(
                        int totalClientes,
                        int cobrados, // PAGADO + PARCIAL
                        int noPagaron, // NO_PAGADO
                        int sinRegistrar, // SIN_REGISTRO
                        int inhabiles, // INHABIL
                        BigDecimal totalMultasCobradas // multas cobradas en el día
        ) {
        }
}
