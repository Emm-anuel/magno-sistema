package com.magno.repository;

import com.magno.model.NominaPago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NominaPagoRepository extends JpaRepository<NominaPago, Long> {

    @Query("SELECT n FROM NominaPago n JOIN FETCH n.registradoPor WHERE n.cajaDia.id = :cajaDiaId AND n.deletedAt IS NULL")
    Optional<NominaPago> findActiveByCajaDiaId(@Param("cajaDiaId") Long cajaDiaId);
}
