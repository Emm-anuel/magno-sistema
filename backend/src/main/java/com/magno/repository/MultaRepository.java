package com.magno.repository;

import com.magno.model.Multa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface MultaRepository extends JpaRepository<Multa, Long> {

       List<Multa> findByCreditoIdAndCobradaFalseAndDeletedAtIsNull(Long creditoId);

       List<Multa> findByCreditoIdAndCobradaFalseAndCondonadaFalseAndDeletedAtIsNull(Long creditoId);

       List<Multa> findByClienteIdAndCobradaFalseAndDeletedAtIsNull(Long clienteId);

       List<Multa> findByCreditoIdAndDeletedAtIsNullOrderByFechaDesc(Long creditoId);

       @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
                     "WHERE m.credito.id = :creditoId " +
                     "AND m.cobrada = false " +
                     "AND m.condonada = false " +
                     "AND m.deletedAt IS NULL")
       BigDecimal sumMontosPendientesByCreditoId(@Param("creditoId") Long creditoId);

       @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
                     "WHERE m.credito.asesor.id = :asesorId " +
                     "AND m.cobrada = true " +
                     "AND m.fecha >= :desde AND m.fecha <= :hasta " +
                     "AND m.deletedAt IS NULL")
       BigDecimal sumMultasCobradaByAsesorAndFechaRange(
                     @Param("asesorId") Long asesorId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta);

       /**
        * Cuenta multas tipo INCOMPLETO para un crédito (para detectar el múltiplo de
        * 2).
        */
       @Query("SELECT COUNT(m) FROM Multa m " +
                     "WHERE m.credito.id = :creditoId " +
                     "AND m.tipo = 'INCOMPLETO' " +
                     "AND m.deletedAt IS NULL")
       long countIncompletosByCreditoId(@Param("creditoId") Long creditoId);

       @Query("SELECT m FROM Multa m " +
                     "WHERE m.credito.id = :creditoId " +
                     "AND m.cobrada = false " +
                     "AND m.condonada = false " +
                     "AND m.deletedAt IS NULL " +
                     "ORDER BY m.fecha ASC")
       List<Multa> findPendientesByCreditoId(@Param("creditoId") Long creditoId);

       @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
                     "WHERE m.credito.sucursal.id = :sucursalId " +
                     "AND m.condonada = true " +
                     "AND CAST(m.fechaCondonacion AS java.time.LocalDate) = :fecha " +
                     "AND m.deletedAt IS NULL")
       BigDecimal sumMultasCondonadasBySucursalAndFecha(
                     @Param("sucursalId") Long sucursalId,
                     @Param("fecha") LocalDate fecha);

       @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
                     "WHERE m.credito.sucursal.id = :sucursalId " +
                     "AND m.cobrada = true " +
                     "AND m.condonada = false " +
                     "AND m.cobradaEnPago IS NULL " +
                     "AND CAST(m.updatedAt AS java.time.LocalDate) = :fecha " +
                     "AND m.deletedAt IS NULL")
       BigDecimal sumMultasCobrasViaRenovacionBySucursalAndFecha(
                     @Param("sucursalId") Long sucursalId,
                     @Param("fecha") LocalDate fecha);

       @Query("SELECT m FROM Multa m WHERE m.credito.id = :creditoId " +
                     "AND m.cobrada = false AND m.condonada = false AND m.deletedAt IS NULL " +
                     "AND m.fecha = :fecha ORDER BY m.id ASC")
       List<Multa> findPendientesByCreditoIdAndFecha(
                     @Param("creditoId") Long creditoId,
                     @Param("fecha") LocalDate fecha);

       boolean existsByCreditoIdAndFechaAndTipoAndDeletedAtIsNull(
                     Long creditoId,
                     LocalDate fecha,
                     String tipo);

       boolean existsByCreditoIdAndDeletedAtIsNull(Long creditoId);
}
