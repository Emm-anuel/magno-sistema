package com.magno.repository;

import com.magno.model.BitacoraConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface BitacoraConfigRepository
        extends JpaRepository<BitacoraConfig, Long>,
                JpaSpecificationExecutor<BitacoraConfig> {
}
