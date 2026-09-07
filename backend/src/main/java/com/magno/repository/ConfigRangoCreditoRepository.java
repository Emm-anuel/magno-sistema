package com.magno.repository;

import com.magno.model.ConfigRangoCredito;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConfigRangoCreditoRepository extends JpaRepository<ConfigRangoCredito, Long> {

    List<ConfigRangoCredito> findBySucursalIdOrderByTipoPagoAscRangoMinAsc(Long sucursalId);

    List<ConfigRangoCredito> findBySucursalIdAndTipoPagoOrderByRangoMinAsc(Long sucursalId, String tipoPago);

    void deleteBySucursalIdAndTipoPago(Long sucursalId, String tipoPago);
}
