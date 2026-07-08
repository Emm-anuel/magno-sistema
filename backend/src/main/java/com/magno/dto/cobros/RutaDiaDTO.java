package com.magno.dto.cobros;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Respuesta completa de la ruta del dia de un asesor.
 * Incluye todos sus clientes con credito activo y el resumen del dia.
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
                        BigDecimal totalCaja, // modalidad legacy removida; se conserva para la UI
                        BigDecimal totalRuta, // total cobrado registrado en la fecha
                        BigDecimal totalMultasCobradas // multas cobradas en el dia
        ) {
        }
}
