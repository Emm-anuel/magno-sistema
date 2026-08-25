package com.magno.repository;

import com.magno.model.Credito;
import com.magno.model.EstadoCalendarioPago;
import com.magno.model.EstadoCredito;
import com.magno.model.TipoPago;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CreditoRepository extends JpaRepository<Credito, Long>,
                JpaSpecificationExecutor<Credito> {

        Optional<Credito> findByClienteIdAndEstado(Long clienteId, EstadoCredito estado);

        List<Credito> findByClienteIdAndEstadoAndDeletedAtIsNull(Long clienteId, EstadoCredito estado);

        boolean existsByClienteIdAndEstadoIn(Long clienteId, List<EstadoCredito> estados);

        boolean existsByClienteIdAndEstadoInAndTipoPago(Long clienteId, List<EstadoCredito> estados, TipoPago tipoPago);

        Page<Credito> findByAsesorId(Long asesorId, Pageable pageable);

        Page<Credito> findByEstado(EstadoCredito estado, Pageable pageable);

        Page<Credito> findBySucursalId(Long sucursalId, Pageable pageable);

        List<Credito> findByAsesorIdAndEstadoAndDeletedAtIsNull(Long asesorId, EstadoCredito estado);

        @Query("SELECT cr FROM Credito cr " +
                        "WHERE cr.estado = :estado " +
                        "AND cr.deletedAt IS NULL " +
                        "AND cr.sucursal.id = :sucursalId " +
                        "AND (:asesorId IS NULL OR cr.asesor.id = :asesorId)")
        List<Credito> findRutaDiaCreditosActivos(@Param("sucursalId") Long sucursalId,
                        @Param("asesorId") Long asesorId,
                        @Param("estado") EstadoCredito estado);

        List<Credito> findByClienteIdOrderByCreatedAtDesc(Long clienteId);

        @Query("SELECT c FROM Credito c " +
                        "WHERE c.deletedAt IS NULL " +
                        "AND c.tipo = com.magno.model.TipoCredito.NUEVO " +
                        "AND c.fechaDesembolso IS NOT NULL " +
                        "AND c.fechaDesembolso >= :inicioTs " +
                        "AND c.fechaDesembolso < :finTs " +
                        "AND (:asesorId IS NULL OR c.asesor.id = :asesorId) " +
                        "AND (:sucursalId IS NULL OR c.sucursal.id = :sucursalId) " +
                        "ORDER BY c.fechaDesembolso ASC")
        List<Credito> findColocacionesNuevos(
                        @Param("inicioTs") java.time.OffsetDateTime inicioTs,
                        @Param("finTs") java.time.OffsetDateTime finTs,
                        @Param("asesorId") Long asesorId,
                        @Param("sucursalId") Long sucursalId);

        @Query("SELECT COALESCE(SUM(c.montoCapital - c.pagoAdelantado), 0) FROM Credito c " +
                        "WHERE c.sucursal.id = :sucursalId " +
                        "AND c.tipo = com.magno.model.TipoCredito.NUEVO " +
                        "AND c.fechaDesembolso >= :desde " +
                        "AND c.fechaDesembolso < :hasta " +
                        "AND c.deletedAt IS NULL")
        java.math.BigDecimal sumDesembolsosBySucursalAndFecha(
                        @Param("sucursalId") Long sucursalId,
                        @Param("desde") java.time.OffsetDateTime desde,
                        @Param("hasta") java.time.OffsetDateTime hasta);

        @Query("SELECT COALESCE(SUM(c.montoCapital - c.pagoAdelantado), 0) FROM Credito c " +
                        "WHERE (:sucursalId IS NULL OR c.sucursal.id = :sucursalId) " +
                        "AND (:asesorId IS NULL OR c.asesor.id = :asesorId) " +
                        "AND c.tipo = com.magno.model.TipoCredito.NUEVO " +
                        "AND c.fechaDesembolso >= :desde " +
                        "AND c.fechaDesembolso < :hasta " +
                        "AND c.deletedAt IS NULL")
        java.math.BigDecimal sumDesembolsosByScopeAndFecha(
                        @Param("sucursalId") Long sucursalId,
                        @Param("asesorId") Long asesorId,
                        @Param("desde") java.time.OffsetDateTime desde,
                        @Param("hasta") java.time.OffsetDateTime hasta);

        @Query("SELECT COALESCE(SUM(c.montoCapital - c.pagoAdelantado), 0) FROM Credito c " +
                        "WHERE c.sucursal.id = :sucursalId " +
                        "AND c.tipo = :tipo " +
                        "AND c.fechaDesembolso >= :desde " +
                        "AND c.fechaDesembolso < :hasta " +
                        "AND c.deletedAt IS NULL")
        java.math.BigDecimal sumDesembolsosByTipoAndSucursalAndFecha(
                        @Param("sucursalId") Long sucursalId,
                        @Param("tipo") com.magno.model.TipoCredito tipo,
                        @Param("desde") java.time.OffsetDateTime desde,
                        @Param("hasta") java.time.OffsetDateTime hasta);

        @Query("SELECT c FROM Credito c WHERE c.estado = com.magno.model.EstadoCredito.ACTIVO " +
                        "AND c.deletedAt IS NULL " +
                        "AND c.sucursal.id = :sucursalId " +
                        "AND (:asesorId IS NULL OR c.asesor.id = :asesorId) " +
                        "ORDER BY c.cliente.apellidoPaterno ASC, c.cliente.nombre ASC")
        List<Credito> findActivosBySucursalAndAsesor(
                        @Param("sucursalId") Long sucursalId,
                        @Param("asesorId") Long asesorId);

        @Query("SELECT c FROM Credito c " +
                        "WHERE c.deletedAt IS NULL " +
                        "AND c.sucursal.id = :sucursalId " +
                        "ORDER BY c.createdAt DESC")
        List<Credito> findForClientReport(@Param("sucursalId") Long sucursalId);

        @Query("SELECT COUNT(c) FROM Credito c " +
                        "WHERE c.estado = com.magno.model.EstadoCredito.ACTIVO " +
                        "AND c.deletedAt IS NULL " +
                        "AND (:sucursalId IS NULL OR c.sucursal.id = :sucursalId) " +
                        "AND (:asesorId IS NULL OR c.asesor.id = :asesorId)")
        long countActivosByScope(
                        @Param("sucursalId") Long sucursalId,
                        @Param("asesorId") Long asesorId);

        @Query("SELECT c FROM Credito c WHERE c.estado = com.magno.model.EstadoCredito.ACTIVO " +
                        "AND c.deletedAt IS NULL " +
                        "AND (:asesorId IS NULL OR c.asesor.id = :asesorId) " +
                        "AND (:sucursalId IS NULL OR c.sucursal.id = :sucursalId) " +
                        "ORDER BY c.cliente.apellidoPaterno ASC, c.cliente.nombre ASC")
        List<Credito> findActivosParaEvaluarRenovacion(
                        @Param("asesorId") Long asesorId,
                        @Param("sucursalId") Long sucursalId);
}
