package com.magno.repository;

import com.magno.model.AbonoCoberturaDetalle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface AbonoCoberturaDetalleRepository extends JpaRepository<AbonoCoberturaDetalle, Long> {

    List<AbonoCoberturaDetalle> findByAbono_CreditoIdOrderByNumeroPagoAsc(Long creditoId);

    List<AbonoCoberturaDetalle> findByAbonoIdOrderByNumeroPagoAsc(Long abonoId);

    List<AbonoCoberturaDetalle> findByCalendarioPagoId(Long calendarioPagoId);

    @Query("SELECT COALESCE(SUM(d.totalAplicado), 0) FROM AbonoCoberturaDetalle d WHERE d.calendarioPago.id = :cpId")
    BigDecimal sumTotalAplicadoByCalendarioPagoId(@Param("cpId") Long cpId);

    @Query("SELECT COALESCE(SUM(d.montoMulta), 0) FROM AbonoCoberturaDetalle d WHERE d.calendarioPago.id = :cpId")
    BigDecimal sumMontoMultaByCalendarioPagoId(@Param("cpId") Long cpId);

    @Query("SELECT COALESCE(SUM(d.montoCuota), 0) FROM AbonoCoberturaDetalle d WHERE d.calendarioPago.id = :cpId")
    BigDecimal sumMontoCuotaByCalendarioPagoId(@Param("cpId") Long cpId);

    @Query("SELECT COALESCE(SUM(d.montoMulta), 0) FROM AbonoCoberturaDetalle d " +
            "WHERE (:sucursalId IS NULL OR d.abono.credito.sucursal.id = :sucursalId) " +
            "AND (:asesorId IS NULL OR d.abono.credito.asesor.id = :asesorId) " +
            "AND d.abono.fecha >= :desde AND d.abono.fecha <= :hasta")
    BigDecimal sumMontoMultaByScopeAndFechaRange(@Param("sucursalId") Long sucursalId,
            @Param("asesorId") Long asesorId,
            @Param("desde") java.time.LocalDate desde,
            @Param("hasta") java.time.LocalDate hasta);

    @Query("SELECT d.abono.credito.asesor.id, COALESCE(SUM(d.montoMulta), 0) " +
            "FROM AbonoCoberturaDetalle d " +
            "WHERE (:sucursalId IS NULL OR d.abono.credito.sucursal.id = :sucursalId) " +
            "AND (:asesorId IS NULL OR d.abono.credito.asesor.id = :asesorId) " +
            "AND d.abono.fecha >= :desde AND d.abono.fecha <= :hasta " +
            "GROUP BY d.abono.credito.asesor.id")
    List<Object[]> findMultasAbonosPorAsesorByScopeAndFechaRange(@Param("sucursalId") Long sucursalId,
            @Param("asesorId") Long asesorId,
            @Param("desde") java.time.LocalDate desde,
            @Param("hasta") java.time.LocalDate hasta);
}
