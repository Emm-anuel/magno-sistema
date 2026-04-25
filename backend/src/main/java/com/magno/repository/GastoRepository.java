package com.magno.repository;

import com.magno.model.Gasto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface GastoRepository extends JpaRepository<Gasto, Long> {

    List<Gasto> findByCajaDiaIdAndDeletedAtIsNullOrderByCreatedAtAsc(Long cajaDiaId);

    Optional<Gasto> findByIdAndDeletedAtIsNull(Long id);

    @Query("SELECT COALESCE(SUM(g.monto), 0.00) FROM Gasto g WHERE g.cajaDia.id = :cajaDiaId AND g.deletedAt IS NULL")
    BigDecimal sumMontoByCajaDiaId(@Param("cajaDiaId") Long cajaDiaId);
}
