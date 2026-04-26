package com.magno.dto.caja;

import com.magno.dto.admin.NominaPersonalDTO;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record NominaEstadoDTO(
        boolean esDiaEfectivo,
        LocalDate diaEfectivo,
        List<NominaPersonalDTO> personal,
        BigDecimal totalCalculado,
        NominaPagoDTO pago  // null si aún no se ha registrado el pago
) {}
