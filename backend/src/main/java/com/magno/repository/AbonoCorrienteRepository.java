package com.magno.repository;

import com.magno.model.AbonoCorriente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AbonoCorrienteRepository extends JpaRepository<AbonoCorriente, Long> {

    List<AbonoCorriente> findByCreditoIdOrderByFechaDesc(Long creditoId);
}
