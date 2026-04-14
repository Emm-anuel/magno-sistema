package com.magno.repository;

import com.magno.model.DiaFestivo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface DiaFestivoRepository extends JpaRepository<DiaFestivo, Long> {

    /**
     * Devuelve todas las fechas festivas que aplican a una sucursal específica,
     * incluyendo los festivos globales (aplica_sucursal_id IS NULL).
     */
    @Query("SELECT d.fecha FROM DiaFestivo d " +
           "WHERE d.aplicaSucursalId IS NULL OR d.aplicaSucursalId = :sucursalId")
    List<LocalDate> findFechasBySucursalId(@Param("sucursalId") Long sucursalId);
}
