package com.magno.repository;

import com.magno.model.Credito;
import com.magno.model.EstadoCalendarioPago;
import com.magno.model.EstadoCredito;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.time.LocalDate;

@Repository
public interface CreditoRepository extends JpaRepository<Credito, Long>,
                JpaSpecificationExecutor<Credito> {

        Optional<Credito> findByClienteIdAndEstado(Long clienteId, EstadoCredito estado);

        boolean existsByClienteIdAndEstadoIn(Long clienteId, List<EstadoCredito> estados);

        Page<Credito> findByAsesorId(Long asesorId, Pageable pageable);

        Page<Credito> findByEstado(EstadoCredito estado, Pageable pageable);

        Page<Credito> findBySucursalId(Long sucursalId, Pageable pageable);

        List<Credito> findByAsesorIdAndEstadoAndDeletedAtIsNull(Long asesorId, EstadoCredito estado);

        @Query("SELECT cr FROM Credito cr " +
                        "WHERE cr.estado = :estado " +
                        "AND cr.deletedAt IS NULL " +
                        "AND cr.sucursal.id = :sucursalId " +
                        "AND (:asesorId IS NULL OR cr.asesor.id = :asesorId) " +
                        "AND cr.fechaVencimiento >= :fechaMin")
        List<Credito> findRutaDiaCreditosActivos(@Param("sucursalId") Long sucursalId,
                        @Param("asesorId") Long asesorId,
                        @Param("estado") EstadoCredito estado,
                        @Param("fechaMin") java.time.LocalDate fechaMin);

        List<Credito> findByClienteIdOrderByCreatedAtDesc(Long clienteId);

        /**
         * Suma de multas pendientes (no cobradas) para un crédito.
         * Devuelve 0 si no hay multas.
         */
        @Query("SELECT c FROM Credito c " +
                        "WHERE c.deletedAt IS NULL " +
                        "AND c.estado = :estado " +
                        "AND c.fechaDesembolso IS NOT NULL " +
                        "AND c.fechaDesembolso >= :inicioTs " +
                        "AND c.fechaDesembolso < :finTs " +
                        "AND (:asesorId IS NULL OR c.asesor.id = :asesorId) " +
                        "AND (:sucursalId IS NULL OR c.sucursal.id = :sucursalId) " +
                        "ORDER BY c.fechaDesembolso ASC")
        List<Credito> findColocacionesNuevos(
                        @Param("estado") EstadoCredito estado,
                        @Param("inicioTs") java.time.OffsetDateTime inicioTs,
                        @Param("finTs") java.time.OffsetDateTime finTs,
                        @Param("asesorId") Long asesorId,
                        @Param("sucursalId") Long sucursalId);

        @Query(value = "SELECT COALESCE(SUM(m.monto), 0) " +
                        "FROM multas m " +
                        "WHERE m.credito_id = :creditoId AND m.cobrada = false AND m.deleted_at IS NULL", nativeQuery = true)
        java.math.BigDecimal sumMultasPendientes(@Param("creditoId") Long creditoId);

        @Query("SELECT COALESCE(SUM(c.montoCapital), 0) FROM Credito c " +
                        "WHERE c.sucursal.id = :sucursalId " +
                        "AND c.fechaDesembolso >= :desde " +
                        "AND c.fechaDesembolso < :hasta " +
                        "AND c.deletedAt IS NULL")
        java.math.BigDecimal sumDesembolsosBySucursalAndFecha(
                        @Param("sucursalId") Long sucursalId,
                        @Param("desde") java.time.OffsetDateTime desde,
                        @Param("hasta") java.time.OffsetDateTime hasta);

        @Query("SELECT COALESCE(SUM(c.montoCapital), 0) FROM Credito c " +
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
               "AND (:asesorId IS NULL OR c.asesor.id = :asesorId) " +
               "AND (:sucursalId IS NULL OR c.sucursal.id = :sucursalId) " +
               "AND (SELECT COUNT(cp) FROM CalendarioPago cp WHERE cp.credito = c " +
               "     AND cp.estado IN :realizados) >= " +
               "    CASE WHEN c.plazoDias = 30 THEN 19L ELSE 16L END " +
               "ORDER BY c.cliente.apellidoPaterno ASC, c.cliente.nombre ASC")
        List<Credito> findListosParaRenovar(
                @Param("asesorId") Long asesorId,
                @Param("sucursalId") Long sucursalId,
                @Param("realizados") List<EstadoCalendarioPago> realizados);
}
