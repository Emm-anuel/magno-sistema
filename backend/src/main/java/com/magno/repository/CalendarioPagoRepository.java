package com.magno.repository;

import com.magno.model.CalendarioPago;
import com.magno.model.EstadoCalendarioPago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface CalendarioPagoRepository extends JpaRepository<CalendarioPago, Long> {

    List<CalendarioPago> findByCreditoIdOrderByNumeroPago(Long creditoId);

    List<CalendarioPago> findByCreditoIdAndEstado(Long creditoId, EstadoCalendarioPago estado);

    long countByCreditoIdAndEstadoIn(Long creditoId, List<EstadoCalendarioPago> estados);

    List<CalendarioPago> findByCreditoIdAndEstadoIn(Long creditoId, List<EstadoCalendarioPago> estados);

    @Query("SELECT COUNT(cp) FROM CalendarioPago cp " +
            "WHERE cp.credito.id = :creditoId " +
            "AND cp.estado IN ('NO_PAGADO', 'PARCIAL') " +
            "AND cp.fechaProgramada <= :hoy")
    long countAtrasadosByCreditoId(
            @Param("creditoId") Long creditoId,
            @Param("hoy") LocalDate hoy);

    @Query("SELECT COUNT(cp) FROM CalendarioPago cp " +
            "WHERE cp.credito.id = :creditoId " +
            "AND cp.estado IN ('PAGADO', 'ADELANTADO')")
    long countRealizadosByCreditoId(@Param("creditoId") Long creditoId);
}
