package com.magno.repository;

import com.magno.model.AbonoCorriente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface AbonoCorrienteRepository extends JpaRepository<AbonoCorriente, Long> {

    List<AbonoCorriente> findByCreditoIdOrderByFechaDesc(Long creditoId);

    @Query("SELECT a FROM AbonoCorriente a " +
            "WHERE (:asesorId IS NULL OR a.credito.asesor.id = :asesorId) " +
            "AND (:clienteId IS NULL OR a.credito.cliente.id = :clienteId) " +
            "AND a.fecha >= COALESCE(:fechaDesde, a.fecha) " +
            "AND a.fecha <= COALESCE(:fechaHasta, a.fecha) " +
            "ORDER BY a.fecha DESC, a.id DESC")
    List<AbonoCorriente> findHistorialList(@Param("asesorId") Long asesorId,
            @Param("clienteId") Long clienteId,
            @Param("fechaDesde") LocalDate fechaDesde,
            @Param("fechaHasta") LocalDate fechaHasta);

    @Query("SELECT COALESCE(SUM(a.montoDistribuido), 0) FROM AbonoCorriente a " +
            "WHERE (:sucursalId IS NULL OR a.credito.sucursal.id = :sucursalId) " +
            "AND (:asesorId IS NULL OR a.credito.asesor.id = :asesorId) " +
            "AND a.fecha >= :desde AND a.fecha <= :hasta")
    BigDecimal sumMontoDistribuidoByScopeAndFechaRange(@Param("sucursalId") Long sucursalId,
            @Param("asesorId") Long asesorId,
            @Param("desde") LocalDate desde,
            @Param("hasta") LocalDate hasta);

    @Query("SELECT a.credito.asesor.id, a.credito.asesor.nombreCompleto, COUNT(a), " +
            "COALESCE(SUM(a.montoDistribuido), 0) " +
            "FROM AbonoCorriente a " +
            "WHERE (:sucursalId IS NULL OR a.credito.sucursal.id = :sucursalId) " +
            "AND (:asesorId IS NULL OR a.credito.asesor.id = :asesorId) " +
            "AND a.fecha >= :desde AND a.fecha <= :hasta " +
            "GROUP BY a.credito.asesor.id, a.credito.asesor.nombreCompleto")
    List<Object[]> findAbonosPorAsesorByScopeAndFechaRange(@Param("sucursalId") Long sucursalId,
            @Param("asesorId") Long asesorId,
            @Param("desde") LocalDate desde,
            @Param("hasta") LocalDate hasta);
}
