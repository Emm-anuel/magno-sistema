package com.magno.repository;

import com.magno.model.ConfigUmbralRenovacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConfigUmbralRenovacionRepository extends JpaRepository<ConfigUmbralRenovacion, Long> {

    List<ConfigUmbralRenovacion> findBySucursalIdOrderByTipoPagoAscPlazoAsc(Long sucursalId);

    Optional<ConfigUmbralRenovacion> findBySucursalIdAndTipoPagoAndPlazo(
            Long sucursalId, String tipoPago, Integer plazo);

    void deleteBySucursalId(Long sucursalId);
}
