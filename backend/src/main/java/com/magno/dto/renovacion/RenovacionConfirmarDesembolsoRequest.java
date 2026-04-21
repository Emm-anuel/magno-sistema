package com.magno.dto.renovacion;

public record RenovacionConfirmarDesembolsoRequest(
        String videoEntregaUrl   // null → opcional, se guarda si viene
) {}
