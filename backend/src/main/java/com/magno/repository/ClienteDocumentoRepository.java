package com.magno.repository;

import com.magno.model.ClienteDocumento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClienteDocumentoRepository extends JpaRepository<ClienteDocumento, Long> {

    @Query("SELECT d FROM ClienteDocumento d WHERE d.cliente.id = :clienteId AND d.deletedAt IS NULL ORDER BY d.createdAt ASC")
    List<ClienteDocumento> findByClienteIdActivos(@Param("clienteId") Long clienteId);
}
