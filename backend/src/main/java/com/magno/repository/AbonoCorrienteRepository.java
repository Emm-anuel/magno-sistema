package com.magno.repository;

import com.magno.model.AbonoCorriente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
}
