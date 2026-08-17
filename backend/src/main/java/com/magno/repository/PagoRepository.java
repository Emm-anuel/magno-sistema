package com.magno.repository;

import com.magno.model.Pago;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface PagoRepository extends JpaRepository<Pago, Long> {

       List<Pago> findByCreditoIdOrderByNumeroPago(Long creditoId);

       Optional<Pago> findByCreditoIdAndFechaPago(Long creditoId, LocalDate fechaPago);

       List<Pago> findByAsesorIdAndFechaPagoOrderByNumeroPago(Long asesorId, LocalDate fechaPago);

       List<Pago> findByClienteIdOrderByFechaPagoDesc(Long clienteId);

       Page<Pago> findByClienteId(Long clienteId, Pageable pageable);

       boolean existsByCreditoIdAndNumeroPago(Long creditoId, Integer numeroPago);

       boolean existsByCreditoIdAndDeletedAtIsNull(Long creditoId);

       /**
        * Cuenta pagos incompletos (abonos) de un crédito, excluyendo los "no pagó".
        */
       @Query("SELECT COUNT(p) FROM Pago p " +
                     "WHERE p.credito.id = :creditoId " +
                     "AND p.esCompleto = false " +
                     "AND (p.razonNoPago IS NULL OR p.razonNoPago = '') " +
                     "AND p.deletedAt IS NULL")
       long countPagosIncompletosByCreditoId(@Param("creditoId") Long creditoId);

       /** Pagos del día de un asesor para el resumen de ruta. */
       @Query("SELECT p FROM Pago p " +
                     "WHERE p.asesor.id = :asesorId " +
                     "AND p.fechaPago = :fecha " +
                     "AND p.deletedAt IS NULL")
       List<Pago> findByAsesorIdAndFecha(@Param("asesorId") Long asesorId,
                     @Param("fecha") LocalDate fecha);

       @Query("SELECT p FROM Pago p " +
                     "WHERE p.credito.sucursal.id = :sucursalId " +
                     "AND (:asesorId IS NULL OR p.asesor.id = :asesorId) " +
                     "AND p.fechaPago = :fecha " +
                     "AND p.deletedAt IS NULL")
       List<Pago> findBySucursalAndAsesorIdAndFecha(@Param("sucursalId") Long sucursalId,
                     @Param("asesorId") Long asesorId,
                     @Param("fecha") LocalDate fecha);

       /** Entradas de dinero del dia, con cliente y asesor precargados para el dashboard. */
       @Query("SELECT p FROM Pago p " +
                     "JOIN FETCH p.cliente " +
                     "JOIN FETCH p.asesor " +
                     "WHERE p.credito.sucursal.id = :sucursalId " +
                     "AND (:asesorId IS NULL OR p.asesor.id = :asesorId) " +
                     "AND p.fechaPago = :fecha " +
                     "AND p.montoRecibido > 0 " +
                     "AND p.deletedAt IS NULL " +
                     "ORDER BY p.createdAt DESC, p.id DESC")
       List<Pago> findRecibidosByScopeAndFecha(@Param("sucursalId") Long sucursalId,
                     @Param("asesorId") Long asesorId,
                     @Param("fecha") LocalDate fecha);

       /** Historial filtrable — lista completa para merge con pendientes. */
       @Query("SELECT p FROM Pago p " +
                     "WHERE (:asesorId IS NULL OR p.asesor.id = :asesorId) " +
                     "AND (:clienteId IS NULL OR p.cliente.id = :clienteId) " +
                     "AND p.fechaPago >= COALESCE(:fechaDesde, p.fechaPago) " +
                     "AND p.fechaPago <= COALESCE(:fechaHasta, p.fechaPago) " +
                     "AND p.deletedAt IS NULL " +
                     "ORDER BY p.fechaPago DESC, p.id DESC")
       List<Pago> findHistorialList(@Param("asesorId") Long asesorId,
                     @Param("clienteId") Long clienteId,
                     @Param("fechaDesde") LocalDate fechaDesde,
                     @Param("fechaHasta") LocalDate fechaHasta);

       @Query("SELECT COALESCE(SUM(p.montoRecibido), 0) FROM Pago p " +
                     "WHERE p.credito.sucursal.id = :sucursalId " +
                     "AND p.fechaPago = :fecha " +
                     "AND p.deletedAt IS NULL")
       java.math.BigDecimal sumIngresoBySucursalAndFecha(
                     @Param("sucursalId") Long sucursalId,
                     @Param("fecha") LocalDate fecha);

       @Query("SELECT COALESCE(SUM(p.montoRecibido), 0) FROM Pago p " +
                     "WHERE p.credito.sucursal.id = :sucursalId " +
                     "AND p.fechaPago >= :desde AND p.fechaPago <= :hasta " +
                     "AND p.deletedAt IS NULL")
       java.math.BigDecimal sumIngresoBySucursalAndFechaRange(
                     @Param("sucursalId") Long sucursalId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta);

       @Query("SELECT p.asesor.nombreCompleto, COUNT(p), COALESCE(SUM(p.montoRecibido), 0) " +
                     "FROM Pago p " +
                     "WHERE p.credito.sucursal.id = :sucursalId " +
                     "AND p.fechaPago = :fecha " +
                     "AND p.deletedAt IS NULL " +
                     "GROUP BY p.asesor.id, p.asesor.nombreCompleto " +
                     "ORDER BY SUM(p.montoRecibido) DESC")
       List<Object[]> findCobrosPorAsesorBySucursalAndFecha(
                     @Param("sucursalId") Long sucursalId,
                     @Param("fecha") LocalDate fecha);

       @Query("SELECT p.asesor.nombreCompleto, COALESCE(SUM(p.multaAplicada), 0) " +
                     "FROM Pago p " +
                     "WHERE p.credito.sucursal.id = :sucursalId " +
                     "AND p.fechaPago = :fecha " +
                     "AND p.multaAplicada > 0 " +
                     "AND p.deletedAt IS NULL " +
                     "GROUP BY p.asesor.id, p.asesor.nombreCompleto " +
                     "ORDER BY SUM(p.multaAplicada) DESC")
       List<Object[]> findMultasPorAsesorBySucursalAndFecha(
                     @Param("sucursalId") Long sucursalId,
                     @Param("fecha") LocalDate fecha);

       @Query("SELECT COUNT(p) FROM Pago p " +
                     "WHERE p.asesor.id = :asesorId " +
                     "AND p.fechaPago >= :desde AND p.fechaPago <= :hasta " +
                     "AND p.deletedAt IS NULL")
       long countByAsesorAndFechaRange(
                     @Param("asesorId") Long asesorId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta);

       @Query("SELECT COALESCE(SUM(p.montoRecibido), 0) FROM Pago p " +
                     "WHERE p.asesor.id = :asesorId " +
                     "AND p.fechaPago >= :desde AND p.fechaPago <= :hasta " +
                     "AND p.deletedAt IS NULL")
       java.math.BigDecimal sumMontoCobradoByAsesorAndFechaRange(
                     @Param("asesorId") Long asesorId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta);

       @Query("SELECT COALESCE(SUM(p.multaAplicada), 0) FROM Pago p " +
                     "WHERE p.credito.sucursal.id = :sucursalId " +
                     "AND p.fechaPago >= :desde AND p.fechaPago <= :hasta " +
                     "AND p.multaAplicada > 0 " +
                     "AND p.deletedAt IS NULL")
       java.math.BigDecimal sumMultasBySucursalAndFechaRange(
                     @Param("sucursalId") Long sucursalId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta);

       @Query("SELECT COALESCE(SUM(p.multaAplicada), 0) FROM Pago p " +
                     "WHERE p.asesor.id = :asesorId " +
                     "AND p.fechaPago >= :desde AND p.fechaPago <= :hasta " +
                     "AND p.multaAplicada > 0 " +
                     "AND p.deletedAt IS NULL")
       java.math.BigDecimal sumMultasByAsesorAndFechaRange(
                     @Param("asesorId") Long asesorId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta);

       @Query("SELECT p.asesor.id, p.asesor.nombreCompleto, COUNT(p), " +
                     "COALESCE(SUM(p.montoRecibido), 0), COALESCE(SUM(p.multaAplicada), 0) " +
                     "FROM Pago p " +
                     "WHERE p.credito.sucursal.id = :sucursalId " +
                     "AND p.fechaPago >= :desde AND p.fechaPago <= :hasta " +
                     "AND (:asesorId IS NULL OR p.asesor.id = :asesorId) " +
                     "AND p.deletedAt IS NULL " +
                     "GROUP BY p.asesor.id, p.asesor.nombreCompleto " +
                     "ORDER BY SUM(p.montoRecibido) DESC")
       List<Object[]> findIngresosPorAsesorBySucursalAndFechaRange(
                     @Param("sucursalId") Long sucursalId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta,
                     @Param("asesorId") Long asesorId);

       @Query("SELECT COUNT(p) FROM Pago p " +
                     "WHERE p.asesor.id = :asesorId " +
                     "AND p.fechaPago >= :desde AND p.fechaPago <= :hasta " +
                     "AND p.esCompleto = false " +
                     "AND p.deletedAt IS NULL")
       long countIncompletosByAsesorAndFechaRange(
                     @Param("asesorId") Long asesorId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta);
}
