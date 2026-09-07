package com.magno.repository;

import com.magno.model.EstadoRenovacion;
import com.magno.model.Renovacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface RenovacionRepository extends JpaRepository<Renovacion, Long> {

       List<Renovacion> findByCreditoAnteriorId(Long creditoAnteriorId);

       boolean existsByCreditoAnteriorIdAndEstadoAndDeletedAtIsNull(
                     Long creditoAnteriorId, EstadoRenovacion estado);

       // Renovación que liquidó el crédito anterior (para vínculo en detalle)
       // Busca renovaciones APROBADAS o ACTIVAS que hayan liquidado un crédito
       // anterior
       @Query("SELECT r FROM Renovacion r WHERE r.creditoAnterior.id = :creditoId " +
                     "AND r.deletedAt IS NULL AND r.estado IN (com.magno.model.EstadoRenovacion.APROBADO, com.magno.model.EstadoRenovacion.ACTIVO)")
       Optional<Renovacion> findActivaByCreditoAnteriorId(@Param("creditoId") Long creditoId);

       // Renovación que originó el crédito nuevo (para vínculo en detalle)
       // Busca renovaciones APROBADAS o ACTIVAS que hayan originado un crédito nuevo
       @Query("SELECT r FROM Renovacion r WHERE r.creditoNuevo.id = :creditoId " +
                     "AND r.deletedAt IS NULL AND r.estado IN (com.magno.model.EstadoRenovacion.APROBADO, com.magno.model.EstadoRenovacion.ACTIVO)")
       Optional<Renovacion> findActivaByCreditoNuevoId(@Param("creditoId") Long creditoId);

       // Renovaciones ACTIVAS de una semana (desembolsadas, para colocaciones)
       @Query("SELECT r FROM Renovacion r " +
                     "WHERE r.deletedAt IS NULL " +
                     "AND r.estado = com.magno.model.EstadoRenovacion.ACTIVO " +
                     "AND r.fecha BETWEEN :inicio AND :fin " +
                     "AND (:asesorId IS NULL OR r.asesor.id = :asesorId) " +
                     "AND (:sucursalId IS NULL OR r.creditoNuevo.sucursal.id = :sucursalId) " +
                     "ORDER BY r.fecha ASC")
       List<Renovacion> findColocaciones(
                     @Param("inicio") LocalDate inicio,
                     @Param("fin") LocalDate fin,
                     @Param("asesorId") Long asesorId,
                     @Param("sucursalId") Long sucursalId);

       @Query("SELECT COALESCE(SUM(r.montoDesembolso), 0) FROM Renovacion r " +
                     "WHERE r.deletedAt IS NULL " +
                     "AND r.estado = com.magno.model.EstadoRenovacion.ACTIVO " +
                     "AND r.fecha BETWEEN :desde AND :hasta " +
                     "AND (:asesorId IS NULL OR r.asesor.id = :asesorId) " +
                     "AND (:sucursalId IS NULL OR r.creditoNuevo.sucursal.id = :sucursalId)")
       java.math.BigDecimal sumDesembolsosByScopeAndFecha(
                     @Param("sucursalId") Long sucursalId,
                     @Param("asesorId") Long asesorId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta);

       // Renovaciones SOLICITADAS pendientes de aprobación
       @Query("SELECT r FROM Renovacion r " +
                     "WHERE r.deletedAt IS NULL " +
                     "AND r.estado = com.magno.model.EstadoRenovacion.SOLICITADO " +
                     "AND (:asesorId IS NULL OR r.asesor.id = :asesorId) " +
                     "AND (:sucursalId IS NULL OR r.creditoAnterior.sucursal.id = :sucursalId) " +
                     "ORDER BY r.createdAt ASC")
       List<Renovacion> findPendientes(
                     @Param("asesorId") Long asesorId,
                     @Param("sucursalId") Long sucursalId);

       // Solicitudes creadas por el usuario autenticado. El fallback por asesor
       // conserva visibles registros antiguos que no tengan createdBy.
       @Query("SELECT r FROM Renovacion r " +
                     "LEFT JOIN r.createdBy creador " +
                     "WHERE r.deletedAt IS NULL " +
                     "AND (creador.id = :usuarioId " +
                     "OR (creador.id IS NULL AND r.asesor.id = :usuarioId)) " +
                     "ORDER BY r.createdAt DESC")
       List<Renovacion> findMisSolicitudes(@Param("usuarioId") Long usuarioId);

       // Renovaciones APROBADAS pendientes de confirmar desembolso
       @Query("SELECT r FROM Renovacion r " +
                     "WHERE r.deletedAt IS NULL " +
                     "AND r.estado = com.magno.model.EstadoRenovacion.APROBADO " +
                     "AND (:sucursalId IS NULL OR r.creditoAnterior.sucursal.id = :sucursalId) " +
                     "ORDER BY r.fechaAprobacion ASC")
       List<Renovacion> findPendientesDesembolso(@Param("sucursalId") Long sucursalId);
}
