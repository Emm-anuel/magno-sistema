package com.magno.repository;

import com.magno.model.CalendarioPago;
import com.magno.model.EstadoCalendarioPago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CalendarioPagoRepository extends JpaRepository<CalendarioPago, Long> {

    List<CalendarioPago> findByCreditoIdOrderByNumeroPago(Long creditoId);

    List<CalendarioPago> findByCreditoIdAndEstado(Long creditoId, EstadoCalendarioPago estado);

    long countByCreditoIdAndEstadoIn(Long creditoId, List<EstadoCalendarioPago> estados);

    List<CalendarioPago> findByCreditoIdAndEstadoIn(Long creditoId, List<EstadoCalendarioPago> estados);
}
