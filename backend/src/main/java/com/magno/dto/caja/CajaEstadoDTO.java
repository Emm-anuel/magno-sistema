package com.magno.dto.caja;

import java.time.LocalTime;
import java.time.OffsetDateTime;

public record CajaEstadoDTO(
        Long cajaId,
        String estado,
        boolean bloqueado,
        String abiertaPorNombre,
        OffsetDateTime fechaHoraApertura,
        LocalTime horaLimiteOperacion
) {}
