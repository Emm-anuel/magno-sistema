package com.magno.repository;

import com.magno.model.ConfigSucursal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConfigSucursalRepository extends JpaRepository<ConfigSucursal, Long> {

    Optional<ConfigSucursal> findBySucursalId(Long sucursalId);
}
