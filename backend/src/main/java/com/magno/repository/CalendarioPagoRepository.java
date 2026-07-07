package com.magno.repository;

import com.magno.model.CalendarioPago;
import com.magno.model.EstadoCalendarioPago;
import com.magno.model.EstadoCredito;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Pageable;

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

        @Query("SELECT cp FROM CalendarioPago cp " +
                        "JOIN cp.credito c " +
                        "JOIN c.cliente cl " +
                        "JOIN c.asesor a " +
                        "WHERE c.deletedAt IS NULL " +
                        "AND c.estado = :estadoCredito " +
                        "AND cp.fechaProgramada = :fecha " +
                        "AND cp.estado IN :estados " +
                        "AND (:sucursalId IS NULL OR c.sucursal.id = :sucursalId) " +
                        "AND (:asesorId IS NULL OR a.id = :asesorId) " +
                        "ORDER BY cp.montoEsperado DESC")
        List<CalendarioPago> findPendientesByFechaAndScope(
                        @Param("fecha") LocalDate fecha,
                        @Param("estados") List<EstadoCalendarioPago> estados,
                        @Param("estadoCredito") EstadoCredito estadoCredito,
                        @Param("sucursalId") Long sucursalId,
                        @Param("asesorId") Long asesorId,
                        Pageable pageable);

        @Query("SELECT cp FROM CalendarioPago cp " +
                        "JOIN FETCH cp.credito c " +
                        "JOIN FETCH c.cliente cl " +
                        "JOIN FETCH c.asesor a " +
                        "WHERE c.deletedAt IS NULL " +
                        "AND c.estado = com.magno.model.EstadoCredito.ACTIVO " +
                        "AND cp.fechaProgramada BETWEEN :fechaDesde AND :fechaHasta " +
                        "AND cp.estado = com.magno.model.EstadoCalendarioPago.PENDIENTE " +
                        "AND (:asesorId IS NULL OR a.id = :asesorId) " +
                        "AND (:clienteId IS NULL OR cl.id = :clienteId)")
        List<CalendarioPago> findPendientesByFechaRange(
                        @Param("fechaDesde") LocalDate fechaDesde,
                        @Param("fechaHasta") LocalDate fechaHasta,
                        @Param("asesorId") Long asesorId,
                        @Param("clienteId") Long clienteId);

        @Query("SELECT COUNT(DISTINCT cp.credito.id) FROM CalendarioPago cp " +
                        "WHERE cp.credito.estado = com.magno.model.EstadoCredito.ACTIVO " +
                        "AND cp.credito.deletedAt IS NULL " +
                        "AND cp.estado IN ('NO_PAGADO', 'PARCIAL') " +
                        "AND cp.fechaProgramada <= :hoy " +
                        "AND (:sucursalId IS NULL OR cp.credito.sucursal.id = :sucursalId) " +
                        "AND (:asesorId IS NULL OR cp.credito.asesor.id = :asesorId)")
        long countEnMoraByScope(
                        @Param("hoy") LocalDate hoy,
                        @Param("sucursalId") Long sucursalId,
                        @Param("asesorId") Long asesorId);

        @Query("SELECT cp FROM CalendarioPago cp WHERE cp.credito.id = :creditoId " +
                        "AND (cp.estado = com.magno.model.EstadoCalendarioPago.NO_PAGADO " +
                        "OR cp.estado = com.magno.model.EstadoCalendarioPago.RECUPERADO_PARCIAL " +
                        "OR (cp.estado = com.magno.model.EstadoCalendarioPago.PENDIENTE AND cp.fechaProgramada <= :hoy)) " +
                        "ORDER BY cp.numeroPago ASC")
        List<CalendarioPago> findSlotsCubrir(
                        @Param("creditoId") Long creditoId,
                        @Param("hoy") LocalDate hoy);
}
