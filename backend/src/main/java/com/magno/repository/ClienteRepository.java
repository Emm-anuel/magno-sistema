package com.magno.repository;

import com.magno.model.Cliente;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClienteRepository extends JpaRepository<Cliente, Long>,
        JpaSpecificationExecutor<Cliente> {

    boolean existsByCurpIgnoreCase(String curp);

    boolean existsByCelular(String celular);

    boolean existsByCurpIgnoreCaseAndIdNot(String curp, Long id);

    boolean existsByCelularAndIdNot(String celular, Long id);

    List<Cliente> findByAsesorId(Long asesorId);

    Page<Cliente> findByActivoTrue(Pageable pageable);

    long countByActivoTrue();

    /**
     * Busca clientes que pertenecen a un asesor específico (lista completa para
     * ruta del día).
     */
    List<Cliente> findByAsesorIdAndActivoTrue(Long asesorId);

    /** Busca clientes que pertenecen a un asesor específico (paginado). */
    Page<Cliente> findByAsesorIdAndActivoTrue(Long asesorId, Pageable pageable);

    long countByAsesorIdAndActivoTrue(Long asesorId);

    /**
     * Verifica si el cliente tiene algún crédito activo.
     * Usa native query para no necesitar la entidad Credito todavía.
     */
    @Query(value = "SELECT COUNT(*) > 0 FROM creditos WHERE cliente_id = :clienteId AND estado = 'ACTIVO' AND deleted_at IS NULL", nativeQuery = true)
    boolean tieneCredito(@Param("clienteId") Long clienteId);

    /**
     * Devuelve los tipo_pago distintos que el cliente tiene en proceso
     * (SOLICITADO, APROBADO o ACTIVO) para validar si puede solicitar
     * un nuevo crédito del mismo tipo.
     */
    @Query(value = "SELECT DISTINCT tipo_pago FROM creditos WHERE cliente_id = :clienteId AND estado IN ('SOLICITADO', 'APROBADO', 'ACTIVO') AND deleted_at IS NULL", nativeQuery = true)
    java.util.List<String> getTiposPagoEnProceso(@Param("clienteId") Long clienteId);

    @EntityGraph(attributePaths = {"asesor", "sucursal"})
    List<Cliente> findBySucursalIdOrderByApellidoPaternoAscNombreAsc(Long sucursalId);

    @EntityGraph(attributePaths = {"asesor", "sucursal"})
    List<Cliente> findBySucursalIdAndAsesorIdOrderByApellidoPaternoAscNombreAsc(Long sucursalId, Long asesorId);
}
