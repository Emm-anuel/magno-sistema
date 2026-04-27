package com.magno.repository;

import com.magno.model.CajaDia;
import com.magno.model.EstadoCaja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface CajaDiaRepository extends JpaRepository<CajaDia, Long> {

       Optional<CajaDia> findBySucursalIdAndFecha(Long sucursalId, LocalDate fecha);

       Optional<CajaDia> findBySucursalIdAndFechaAndEstado(Long sucursalId, LocalDate fecha, EstadoCaja estado);

       boolean existsBySucursalIdAndFechaAndEstado(Long sucursalId, LocalDate fecha, EstadoCaja estado);

       @Query("SELECT cd FROM CajaDia cd WHERE cd.sucursal.id = :sucursalId " +
                     "AND cd.fecha >= :desde AND cd.fecha <= :hasta " +
                     "ORDER BY cd.fecha DESC")
       List<CajaDia> findBySucursalAndFechaRange(
                     @Param("sucursalId") Long sucursalId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta);

       @Query("SELECT cd FROM CajaDia cd WHERE cd.sucursal.id = :sucursalId " +
                     "AND cd.fecha >= :desde AND cd.fecha <= :hasta " +
                     "AND cd.estado = com.magno.model.EstadoCaja.CERRADA " +
                     "ORDER BY cd.fecha ASC")
       List<CajaDia> findCerradasBySucursalAndFechaRange(
                     @Param("sucursalId") Long sucursalId,
                     @Param("desde") LocalDate desde,
                     @Param("hasta") LocalDate hasta);
}
