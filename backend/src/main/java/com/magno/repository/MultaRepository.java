package com.magno.repository;

import com.magno.model.Multa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface MultaRepository extends JpaRepository<Multa, Long> {

       List<Multa> findByCreditoIdAndCobradaFalseAndDeletedAtIsNull(Long creditoId);

       List<Multa> findByClienteIdAndCobradaFalseAndDeletedAtIsNull(Long clienteId);

       List<Multa> findByCreditoIdAndDeletedAtIsNullOrderByFechaDesc(Long creditoId);

       @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
                     "WHERE m.credito.id = :creditoId " +
                     "AND m.cobrada = false " +
                     "AND m.deletedAt IS NULL")
       BigDecimal sumMontosPendientesByCreditoId(@Param("creditoId") Long creditoId);

       @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
                     "WHERE m.credito.asesor.id = :asesorId " +
                     "AND m.cobrada = true " +
                     "AND m.fecha >= :desde AND m.fecha <= :hasta " +
                     "AND m.deletedAt IS NULL")
       BigDecimal sumMultasCobradaByAsesorAndFechaRange(
                     @Param("asesorId") Long asesorId,
                     @Param("desde") java.time.LocalDate desde,
                     @Param("hasta") java.time.LocalDate hasta);

       /**
        * Cuenta multas tipo INCOMPLETO para un crédito (para detectar el múltiplo de
        * 2).
        */
       @Query("SELECT COUNT(m) FROM Multa m " +
                     "WHERE m.credito.id = :creditoId " +
                     "AND m.tipo = 'INCOMPLETO' " +
                     "AND m.deletedAt IS NULL")
       long countIncompletosByCreditoId(@Param("creditoId") Long creditoId);
}
