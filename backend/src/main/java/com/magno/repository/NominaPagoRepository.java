package com.magno.repository;

import com.magno.model.NominaPago;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NominaPagoRepository extends JpaRepository<NominaPago, Long> {

    @EntityGraph(attributePaths = {"cajaDia", "registradoPor"})
    Optional<NominaPago> findByCajaDiaIdAndDeletedAtIsNull(Long cajaDiaId);
}
