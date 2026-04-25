package com.magno.repository;

import com.magno.model.CategoriaGasto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CategoriaGastoRepository extends JpaRepository<CategoriaGasto, Long> {
    List<CategoriaGasto> findBySucursalIdAndActivoTrueOrderByNombreAsc(Long sucursalId);
}
