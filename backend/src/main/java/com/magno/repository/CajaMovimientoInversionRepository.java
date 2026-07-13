package com.magno.repository;

import com.magno.model.CajaMovimientoInversion;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface CajaMovimientoInversionRepository extends JpaRepository<CajaMovimientoInversion, Long> {

    List<CajaMovimientoInversion> findByCajaDiaIdOrderByCreatedAtAsc(Long cajaDiaId);

    @Query("SELECT COALESCE(SUM(m.monto), 0) FROM CajaMovimientoInversion m WHERE m.cajaDia.id = :cajaDiaId")
    BigDecimal sumMontoByCajaDiaId(@Param("cajaDiaId") Long cajaDiaId);

    @EntityGraph(attributePaths = {"conceptoInversion"})
    @Query("SELECT m FROM CajaMovimientoInversion m WHERE m.cajaDia.sucursal.id = :sucursalId AND m.cajaDia.fecha BETWEEN :desde AND :hasta ORDER BY m.cajaDia.fecha, m.createdAt")
    List<CajaMovimientoInversion> findBySucursalAndFechaRange(@Param("sucursalId") Long sucursalId,
            @Param("desde") LocalDate desde, @Param("hasta") LocalDate hasta);
}
