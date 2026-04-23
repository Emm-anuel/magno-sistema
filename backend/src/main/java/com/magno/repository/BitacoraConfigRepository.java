package com.magno.repository;

import com.magno.model.BitacoraConfig;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;

@Repository
public interface BitacoraConfigRepository extends JpaRepository<BitacoraConfig, Long> {

    @Query("SELECT b FROM BitacoraConfig b WHERE " +
           "(:sucursalId IS NULL OR b.sucursalId = :sucursalId) AND " +
           "(:seccion IS NULL OR b.seccion = :seccion) AND " +
           "(:usuarioId IS NULL OR b.usuarioId = :usuarioId) AND " +
           "(:desde IS NULL OR b.createdAt >= :desde) AND " +
           "(:hasta IS NULL OR b.createdAt <= :hasta) " +
           "ORDER BY b.createdAt DESC")
    Page<BitacoraConfig> buscarConFiltros(
            @Param("sucursalId") Long sucursalId,
            @Param("seccion") String seccion,
            @Param("usuarioId") Long usuarioId,
            @Param("desde") OffsetDateTime desde,
            @Param("hasta") OffsetDateTime hasta,
            Pageable pageable);
}
