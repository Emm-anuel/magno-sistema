package com.magno.dto.gasto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record GastoCreateRequest(
        @NotNull Long categoriaGastoId,
        @NotBlank @Size(max = 1000) String concepto,
        @NotNull @DecimalMin("0.01") BigDecimal monto
) {}
