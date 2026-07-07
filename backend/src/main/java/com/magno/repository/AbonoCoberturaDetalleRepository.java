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

    List<AbonoCoberturaDetalle> findByCalendarioPagoId(Long calendarioPagoId);

    @Query("SELECT COALESCE(SUM(d.totalAplicado), 0) FROM AbonoCoberturaDetalle d WHERE d.calendarioPago.id = :cpId")
    BigDecimal sumTotalAplicadoByCalendarioPagoId(@Param("cpId") Long cpId);

    @Query("SELECT COALESCE(SUM(d.montoMulta), 0) FROM AbonoCoberturaDetalle d WHERE d.calendarioPago.id = :cpId")
    BigDecimal sumMontoMultaByCalendarioPagoId(@Param("cpId") Long cpId);

    @Query("SELECT COALESCE(SUM(d.montoCuota), 0) FROM AbonoCoberturaDetalle d WHERE d.calendarioPago.id = :cpId")
    BigDecimal sumMontoCuotaByCalendarioPagoId(@Param("cpId") Long cpId);
}
