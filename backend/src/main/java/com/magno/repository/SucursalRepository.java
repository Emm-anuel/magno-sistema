package com.magno.repository;

import com.magno.model.Sucursal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SucursalRepository extends JpaRepository<Sucursal, Long> {

    List<Sucursal> findByActivaTrue();

    List<Sucursal> findByActivaTrue(Sort sort);
}
