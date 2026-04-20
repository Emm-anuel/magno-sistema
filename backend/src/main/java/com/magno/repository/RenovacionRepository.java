package com.magno.repository;

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

    @Query("SELECT r FROM Renovacion r WHERE r.creditoAnterior.id = :creditoId AND r.deletedAt IS NULL")
    Optional<Renovacion> findActivaByCreditoAnteriorId(@Param("creditoId") Long creditoId);

    @Query("SELECT r FROM Renovacion r WHERE r.creditoNuevo.id = :creditoId AND r.deletedAt IS NULL")
    Optional<Renovacion> findActivaByCreditoNuevoId(@Param("creditoId") Long creditoId);

    @Query("SELECT r FROM Renovacion r " +
           "WHERE r.deletedAt IS NULL " +
           "AND r.fecha BETWEEN :inicio AND :fin " +
           "AND (:asesorId IS NULL OR r.asesor.id = :asesorId) " +
           "AND (:sucursalId IS NULL OR r.creditoNuevo.sucursal.id = :sucursalId) " +
           "ORDER BY r.fecha ASC")
    List<Renovacion> findColocaciones(
            @Param("inicio") LocalDate inicio,
            @Param("fin") LocalDate fin,
            @Param("asesorId") Long asesorId,
            @Param("sucursalId") Long sucursalId);
}
