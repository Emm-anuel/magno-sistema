package com.magno.service;

import com.magno.dto.cobros.AbonoCorrienteDTO;
import com.magno.dto.cobros.AbonoCorrienteRequest;
import com.magno.model.*;
import com.magno.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class AbonoCorrienteService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Mexico_City");

    private final AbonoCorrienteRepository abonoCorrienteRepo;
    private final AbonoCoberturaDetalleRepository abonoCoberturaRepo;
    private final CreditoRepository creditoRepo;
    private final UsuarioRepository usuarioRepo;
    private final CalendarioPagoRepository calendarioPagoRepo;
    private final MultaRepository multaRepo;

    public AbonoCorrienteService(
            AbonoCorrienteRepository abonoCorrienteRepo,
            AbonoCoberturaDetalleRepository abonoCoberturaRepo,
            CreditoRepository creditoRepo,
            UsuarioRepository usuarioRepo,
            CalendarioPagoRepository calendarioPagoRepo,
            MultaRepository multaRepo) {
        this.abonoCorrienteRepo = abonoCorrienteRepo;
        this.abonoCoberturaRepo = abonoCoberturaRepo;
        this.creditoRepo = creditoRepo;
        this.usuarioRepo = usuarioRepo;
        this.calendarioPagoRepo = calendarioPagoRepo;
        this.multaRepo = multaRepo;
    }

    @Transactional
    public AbonoCorrienteDTO registrarAbono(AbonoCorrienteRequest req, Long usuarioId) {
        Usuario registrador = usuarioRepo.findById(usuarioId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + usuarioId));
        String rol = registrador.getRol().getNombre();

        Credito credito = creditoRepo.findById(req.creditoId())
                .orElseThrow(() -> new EntityNotFoundException("Crédito no encontrado: " + req.creditoId()));

        if (credito.getEstado() != EstadoCredito.ACTIVO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El crédito no está activo");
        }

        if ("ASESOR_COBRADOR".equals(rol)) {
            if (credito.getAsesor() == null || !credito.getAsesor().getId().equals(usuarioId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes acceso a este crédito");
            }
        } else if ("SUPERVISOR_CAMPO".equals(rol)) {
            if (!credito.getCliente().getSucursal().getId().equals(registrador.getSucursal().getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes acceso a este crédito");
            }
        }

        LocalDate hoy = LocalDate.now(BUSINESS_ZONE);
        LocalDate fechaOperacion = resolverFecha(req.fechaPago(), rol, hoy);

        List<CalendarioPago> slots = calendarioPagoRepo.findSlotsCubrir(credito.getId(), fechaOperacion);
        if (slots.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No hay días atrasados para cubrir en este crédito");
        }

        BigDecimal saldo = req.montoRecibido();
        List<AbonoCoberturaDetalle> coberturas = new ArrayList<>();
        List<Multa> multasCubiertas = new ArrayList<>();

        for (CalendarioPago slot : slots) {
            if (saldo.compareTo(BigDecimal.ZERO) <= 0) break;

            List<Multa> multasDia = multaRepo.findPendientesByCreditoIdAndFecha(
                    credito.getId(), slot.getFechaProgramada());
            BigDecimal totalMultasDia = multasDia.stream()
                    .map(Multa::getMonto).reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal yaAbonado = abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(slot.getId());
            BigDecimal multaYaAbonada = abonoCoberturaRepo.sumMontoMultaByCalendarioPagoId(slot.getId());

            BigDecimal costoRestante = slot.getMontoEsperado()
                    .add(totalMultasDia)
                    .subtract(yaAbonado);

            if (costoRestante.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal aplicar = saldo.min(costoRestante);
            saldo = saldo.subtract(aplicar);
            boolean esCompleto = aplicar.compareTo(costoRestante) >= 0;

            BigDecimal multaRestante = totalMultasDia.subtract(multaYaAbonada).max(BigDecimal.ZERO);
            BigDecimal montoMultaAplicado = aplicar.min(multaRestante);
            BigDecimal montoCuotaAplicado = aplicar.subtract(montoMultaAplicado);

            AbonoCoberturaDetalle cobertura = AbonoCoberturaDetalle.builder()
                    .calendarioPago(slot)
                    .numeroPago(slot.getNumeroPago())
                    .montoCuota(montoCuotaAplicado)
                    .montoMulta(montoMultaAplicado)
                    .totalAplicado(aplicar)
                    .esParcial(!esCompleto)
                    .build();
            coberturas.add(cobertura);

            slot.setEstado(esCompleto ? EstadoCalendarioPago.RECUPERADO : EstadoCalendarioPago.RECUPERADO_PARCIAL);
            calendarioPagoRepo.save(slot);

            if (multaYaAbonada.add(montoMultaAplicado).compareTo(totalMultasDia) >= 0) {
                multasCubiertas.addAll(multasDia);
            }
        }

        BigDecimal totalDistribuido = req.montoRecibido().subtract(saldo);

        AbonoCorriente abono = AbonoCorriente.builder()
                .credito(credito)
                .fecha(fechaOperacion)
                .montoTotal(req.montoRecibido())
                .montoDistribuido(totalDistribuido)
                .montoSobrante(saldo)
                .registradoPor(registrador)
                .build();
        abono = abonoCorrienteRepo.save(abono);

        final AbonoCorriente abonoFinal = abono;
        for (AbonoCoberturaDetalle c : coberturas) {
            c.setAbono(abonoFinal);
            abonoCoberturaRepo.save(c);
        }

        for (Multa m : multasCubiertas) {
            m.setCobrada(true);
            m.setCobradaEnAbono(abonoFinal);
            multaRepo.save(m);
        }

        return AbonoCorrienteDTO.from(abono, coberturas);
    }

    public List<AbonoCorrienteDTO> getAbonosPorCredito(Long creditoId) {
        List<AbonoCorriente> abonos = abonoCorrienteRepo.findByCreditoIdOrderByFechaDesc(creditoId);
        return abonos.stream().map(a -> {
            List<AbonoCoberturaDetalle> coberturas =
                    abonoCoberturaRepo.findByAbonoIdOrderByNumeroPagoAsc(a.getId());
            return AbonoCorrienteDTO.from(a, coberturas);
        }).toList();
    }

    private LocalDate resolverFecha(LocalDate fechaSolicitada, String rol, LocalDate hoy) {
        if (fechaSolicitada == null) return hoy;
        boolean esRolCampo = "ASESOR_COBRADOR".equals(rol) || "SUPERVISOR_CAMPO".equals(rol);
        if (esRolCampo && !hoy.equals(fechaSolicitada)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Solo Gerente General y Gerente de Sucursal pueden registrar en fechas históricas");
        }
        return fechaSolicitada;
    }
}
