package com.magno.repository;

import com.magno.model.ConfigMulta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;

@Repository
public interface ConfigMultaRepository extends JpaRepository<ConfigMulta, Long> {

    /**
     * Busca la configuración de multa aplicable a un monto y sucursal.
     * El rango es inclusivo en ambos extremos.
     */
    @Query("SELECT c FROM ConfigMulta c " +
           "WHERE c.sucursalId = :sucursalId " +
           "AND :monto >= c.rangoMin " +
           "AND :monto <= c.rangoMax")
    Optional<ConfigMulta> findBySucursalAndMonto(
            @Param("sucursalId") Long sucursalId,
            @Param("monto") BigDecimal monto
    );
}
