package com.magno.dto.renovacion;

import java.math.BigDecimal;

public record RenovacionAprobarRequest(
        BigDecimal montoAprobado   // null → se usa montoNuevo de la solicitud sin cambios
) {}
