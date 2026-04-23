package com.magno.repository;

import com.magno.model.NominaPersonal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NominaPersonalRepository extends JpaRepository<NominaPersonal, Long> {

    List<NominaPersonal> findBySucursalIdAndDeletedAtIsNullOrderByNombreAsc(Long sucursalId);

    Optional<NominaPersonal> findByIdAndDeletedAtIsNull(Long id);
}
