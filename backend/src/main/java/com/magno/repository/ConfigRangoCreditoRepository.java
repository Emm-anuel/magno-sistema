package com.magno.repository;

import com.magno.model.ConfigRangoCredito;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface ConfigRangoCreditoRepository extends JpaRepository<ConfigRangoCredito, Long> {

    List<ConfigRangoCredito> findBySucursalIdOrderByTipoPagoAscRangoMinAsc(Long sucursalId);

    List<ConfigRangoCredito> findBySucursalIdAndTipoPagoOrderByRangoMinAsc(Long sucursalId, String tipoPago);

    /**
     * Encuentra el rango aplicable a un capital y sucursal dados.
     * El rango es inclusivo en ambos extremos.
     */
    @Query("SELECT r FROM ConfigRangoCredito r " +
           "WHERE r.sucursalId = :sucursalId " +
           "AND r.tipoPago = :tipoPago " +
           "AND :capital >= r.rangoMin " +
           "AND :capital <= r.rangoMax")
    Optional<ConfigRangoCredito> findBySucursalAndTipoPagoAndCapital(
            @Param("sucursalId") Long sucursalId,
            @Param("tipoPago") String tipoPago,
            @Param("capital") BigDecimal capital);

    void deleteBySucursalIdAndTipoPago(Long sucursalId, String tipoPago);
}
