package com.magno.service;

import com.magno.model.ConfigUmbralRenovacion;
import com.magno.model.Credito;
import com.magno.model.EstadoCalendarioPago;
import com.magno.model.EstadoCredito;
import com.magno.model.TipoPago;
import com.magno.repository.ConfigUmbralRenovacionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class RenovacionElegibilidadService {

    public static final List<EstadoCalendarioPago> ESTADOS_REALIZADOS = List.of(
            EstadoCalendarioPago.PAGADO,
            EstadoCalendarioPago.PARCIAL,
            EstadoCalendarioPago.ADELANTADO,
            EstadoCalendarioPago.RECUPERADO);

    private final ConfigUmbralRenovacionRepository configUmbralRepo;

    public RenovacionElegibilidadService(ConfigUmbralRenovacionRepository configUmbralRepo) {
        this.configUmbralRepo = configUmbralRepo;
    }

    public boolean esElegible(Credito credito, long pagosRealizados) {
        return credito.getEstado() == EstadoCredito.ACTIVO
                && pagosRealizados >= resolverUmbral(credito);
    }

    public int resolverUmbral(Credito credito) {
        String tipoPagoStr = credito.getTipoPago() == TipoPago.SEMANAL ? "SEMANAL" : "DIARIO";
        return configUmbralRepo
                .findBySucursalIdAndTipoPagoAndPlazo(
                        credito.getSucursal().getId(), tipoPagoStr, credito.getPlazoDias())
                .map(ConfigUmbralRenovacion::getUmbralPagos)
                .orElseGet(() -> umbralDefault(credito));
    }

    private int umbralDefault(Credito credito) {
        if (credito.getTipoPago() == TipoPago.SEMANAL) {
            return credito.getPlazoDias() == 12 ? 9 : 5;
        }
        return credito.getPlazoDias() == 30 ? 19 : 16;
    }
}
