package com.magno.service;

import com.magno.dto.dashboard.DashboardAsesorIngresoDTO;
import com.magno.dto.dashboard.DashboardCobroPendienteDTO;
import com.magno.dto.dashboard.DashboardKpisDTO;
import com.magno.dto.dashboard.DashboardRenovacionDTO;
import com.magno.dto.dashboard.DashboardResponseDTO;
import com.magno.model.CalendarioPago;
import com.magno.model.ConfigSucursal;
import com.magno.model.EstadoCalendarioPago;
import com.magno.model.EstadoCredito;
import com.magno.model.Renovacion;
import com.magno.model.Usuario;
import com.magno.repository.CalendarioPagoRepository;
import com.magno.repository.AbonoCoberturaDetalleRepository;
import com.magno.repository.AbonoCorrienteRepository;
import com.magno.repository.ClienteRepository;
import com.magno.repository.ConfigSucursalRepository;
import com.magno.repository.CreditoRepository;
import com.magno.repository.PagoRepository;
import com.magno.repository.RenovacionRepository;
import com.magno.repository.UsuarioRepository;
import com.magno.security.JwtPrincipal;
import com.magno.util.DateTimeUtils;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private static final List<EstadoCalendarioPago> ESTADOS_PENDIENTE = List.of(EstadoCalendarioPago.PENDIENTE,
            EstadoCalendarioPago.NO_PAGADO, EstadoCalendarioPago.PARCIAL, EstadoCalendarioPago.RECUPERADO_PARCIAL);

    private final PagoRepository pagoRepo;
    private final AbonoCorrienteRepository abonoCorrienteRepo;
    private final AbonoCoberturaDetalleRepository abonoCoberturaRepo;
    private final CreditoRepository creditoRepo;
    private final RenovacionRepository renovacionRepo;
    private final CalendarioPagoRepository calendarioRepo;
    private final UsuarioRepository usuarioRepo;
    private final ClienteRepository clienteRepo;
    private final ConfigSucursalRepository configSucursalRepo;

    public DashboardService(PagoRepository pagoRepo,
            AbonoCorrienteRepository abonoCorrienteRepo,
            AbonoCoberturaDetalleRepository abonoCoberturaRepo,
            CreditoRepository creditoRepo,
            RenovacionRepository renovacionRepo,
            CalendarioPagoRepository calendarioRepo,
            UsuarioRepository usuarioRepo,
            ClienteRepository clienteRepo,
            ConfigSucursalRepository configSucursalRepo) {
        this.pagoRepo = pagoRepo;
        this.abonoCorrienteRepo = abonoCorrienteRepo;
        this.abonoCoberturaRepo = abonoCoberturaRepo;
        this.creditoRepo = creditoRepo;
        this.renovacionRepo = renovacionRepo;
        this.calendarioRepo = calendarioRepo;
        this.usuarioRepo = usuarioRepo;
        this.clienteRepo = clienteRepo;
        this.configSucursalRepo = configSucursalRepo;
    }

    public DashboardResponseDTO getDashboard(Long sucursalId,
            Long asesorId,
            LocalDate desde,
            LocalDate hasta,
            JwtPrincipal principal) {
        LocalDate hoy = DateTimeUtils.hoyEnMagno();
        LocalDate desdeSafe = desde != null ? desde : hoy;
        LocalDate hastaSafe = hasta != null ? hasta : hoy;

        OffsetDateTime inicioTs = desdeSafe.atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();
        OffsetDateTime finTs = hastaSafe.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();

        BigDecimal pagosRuta = asesorId != null
                ? coalesce(pagoRepo.sumMontoCobradoByAsesorAndFechaRange(asesorId, desdeSafe, hastaSafe))
                : coalesce(pagoRepo.sumIngresoBySucursalAndFechaRange(sucursalId, desdeSafe, hastaSafe));
        BigDecimal abonosAdeudo = coalesce(abonoCorrienteRepo.sumMontoDistribuidoByScopeAndFechaRange(
                sucursalId, asesorId, desdeSafe, hastaSafe));
        BigDecimal totalCobrado = pagosRuta.add(abonosAdeudo);

        BigDecimal multasRuta = asesorId != null
                ? coalesce(pagoRepo.sumMultasByAsesorAndFechaRange(asesorId, desdeSafe, hastaSafe))
                : coalesce(pagoRepo.sumMultasBySucursalAndFechaRange(sucursalId, desdeSafe, hastaSafe));
        BigDecimal multasAbonos = coalesce(abonoCoberturaRepo.sumMontoMultaByScopeAndFechaRange(
                sucursalId, asesorId, desdeSafe, hastaSafe));
        BigDecimal multas = multasRuta.add(multasAbonos);

        BigDecimal desembolsosCreditos = coalesce(
                creditoRepo.sumDesembolsosByScopeAndFecha(sucursalId, asesorId, inicioTs, finTs));
        BigDecimal desembolsosRenov = coalesce(
                renovacionRepo.sumDesembolsosByScopeAndFecha(sucursalId, asesorId, desdeSafe, hastaSafe));
        BigDecimal desembolsos = desembolsosCreditos.add(desembolsosRenov);

        long creditosActivos = creditoRepo.countActivosByScope(sucursalId, asesorId);
        long creditosEnMora = calendarioRepo.countEnMoraByScope(hoy, sucursalId, asesorId);

        ConfigSucursal config = configSucursalRepo.findBySucursalId(sucursalId)
                .orElse(ConfigSucursal.builder().sucursalId(sucursalId).build());
        BigDecimal porcentajeAhorro = config.getPorcentajeAhorro() != null
                ? config.getPorcentajeAhorro()
                : new BigDecimal("0.2400");
        BigDecimal montoAhorroFijo = config.getMontoAhorroFijo() != null
                ? config.getMontoAhorroFijo()
                : BigDecimal.ZERO;
        BigDecimal montoAhorro = totalCobrado.multiply(porcentajeAhorro).setScale(2, RoundingMode.HALF_UP);

        DashboardKpisDTO kpis = new DashboardKpisDTO(
                totalCobrado,
                pagosRuta,
                abonosAdeudo,
                totalCobrado,
                creditosActivos,
                multas,
                multasRuta,
                multasAbonos,
                porcentajeAhorro,
                montoAhorro,
                montoAhorroFijo,
                desembolsos,
                creditosEnMora);

        List<CalendarioPago> pendientes = calendarioRepo.findPendientesByFechaAndScope(
                hoy,
                ESTADOS_PENDIENTE,
                EstadoCredito.ACTIVO,
                sucursalId,
                asesorId,
                PageRequest.of(0, 10));

        List<DashboardCobroPendienteDTO> cobrosPendientes = pendientes.stream()
                .map(cp -> new DashboardCobroPendienteDTO(
                        cp.getCredito().getId(),
                        cp.getCredito().getCliente().getNombreCompleto(),
                        cp.getCredito().getAsesor().getNombreCompleto(),
                        cp.getMontoEsperado(),
                        cp.getEstado().name()))
                .toList();

        List<Renovacion> renovacionesRaw = renovacionRepo.findColocaciones(
                desdeSafe, hastaSafe, asesorId, sucursalId);
        List<DashboardRenovacionDTO> renovaciones = renovacionesRaw.stream()
                .filter(r -> r.getCreditoNuevo() != null)
                .limit(10)
                .map(r -> new DashboardRenovacionDTO(
                        r.getId(),
                        r.getCliente().getNombreCompleto(),
                        r.getCreditoNuevo().getMontoCapital(),
                        r.getMontoDesembolso(),
                        r.getFecha()))
                .toList();

        List<DashboardAsesorIngresoDTO> ingresoPorAsesor = buildIngresoPorAsesor(
                sucursalId, asesorId, desdeSafe, hastaSafe, principal);

        return new DashboardResponseDTO(kpis, cobrosPendientes, renovaciones, ingresoPorAsesor);
    }

    private List<DashboardAsesorIngresoDTO> buildIngresoPorAsesor(Long sucursalId,
            Long asesorId,
            LocalDate desde,
            LocalDate hasta,
            JwtPrincipal principal) {
        Map<Long, IngresoAgg> ingresosMap = new HashMap<>();
        if (sucursalId != null) {
            for (Object[] row : pagoRepo.findIngresosPorAsesorBySucursalAndFechaRange(
                    sucursalId, desde, hasta, asesorId)) {
                Long id = ((Number) row[0]).longValue();
                String nombre = (String) row[1];
                long count = ((Number) row[2]).longValue();
                BigDecimal monto = coalesce((BigDecimal) row[3]);
                BigDecimal multas = coalesce((BigDecimal) row[4]);
                ingresosMap.put(id, new IngresoAgg(nombre, count, monto, multas));
            }
        }

        Map<Long, AbonoAgg> abonosMap = new HashMap<>();
        for (Object[] row : abonoCorrienteRepo.findAbonosPorAsesorByScopeAndFechaRange(
                sucursalId, asesorId, desde, hasta)) {
            Long id = ((Number) row[0]).longValue();
            String nombre = (String) row[1];
            long count = ((Number) row[2]).longValue();
            BigDecimal monto = coalesce((BigDecimal) row[3]);
            abonosMap.put(id, new AbonoAgg(nombre, count, monto));
        }

        Map<Long, BigDecimal> multasAbonosMap = new HashMap<>();
        for (Object[] row : abonoCoberturaRepo.findMultasAbonosPorAsesorByScopeAndFechaRange(
                sucursalId, asesorId, desde, hasta)) {
            Long id = ((Number) row[0]).longValue();
            BigDecimal monto = coalesce((BigDecimal) row[1]);
            multasAbonosMap.put(id, monto);
        }

        List<Usuario> asesores = resolveAsesores(sucursalId, asesorId, principal);
        List<DashboardAsesorIngresoDTO> salida = new ArrayList<>();

        for (Usuario asesor : asesores) {
            IngresoAgg agg = ingresosMap.get(asesor.getId());
            AbonoAgg abonoAgg = abonosMap.get(asesor.getId());
            BigDecimal pagosRuta = agg != null ? agg.monto : BigDecimal.ZERO;
            BigDecimal abonosAdeudo = abonoAgg != null ? abonoAgg.monto : BigDecimal.ZERO;
            BigDecimal ingreso = pagosRuta.add(abonosAdeudo);
            BigDecimal multasRuta = agg != null ? agg.multas : BigDecimal.ZERO;
            BigDecimal multasAbonos = multasAbonosMap.getOrDefault(asesor.getId(), BigDecimal.ZERO);
            BigDecimal multas = multasRuta.add(multasAbonos);

            BigDecimal desembolsosCreditos = coalesce(creditoRepo.sumDesembolsosByScopeAndFecha(
                    sucursalId, asesor.getId(),
                    desde.atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime(),
                    hasta.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime()));
            BigDecimal desembolsosRenov = coalesce(renovacionRepo.sumDesembolsosByScopeAndFecha(
                    sucursalId, asesor.getId(), desde, hasta));
            BigDecimal desembolsos = desembolsosCreditos.add(desembolsosRenov);

            long clientesActivos = clienteRepo.countByAsesorIdAndActivoTrue(asesor.getId());

            salida.add(new DashboardAsesorIngresoDTO(
                    asesor.getId(),
                    asesor.getNombreCompleto(),
                    ingreso,
                    pagosRuta,
                    abonosAdeudo,
                    ingreso,
                    desembolsos,
                    multas,
                    multasRuta,
                    multasAbonos,
                    clientesActivos));
        }

        return salida;
    }

    private List<Usuario> resolveAsesores(Long sucursalId, Long asesorId, JwtPrincipal principal) {
        if ("ASESOR_COBRADOR".equals(principal.rol())) {
            return usuarioRepo.findById(principal.userId()).stream().toList();
        }
        if (asesorId != null) {
            return usuarioRepo.findById(asesorId).stream().toList();
        }

        List<Usuario> base = sucursalId != null
                ? usuarioRepo.findBySucursalId(sucursalId)
                : usuarioRepo.findByRolNombre("ASESOR_COBRADOR");

        return base.stream()
                .filter(u -> "ASESOR_COBRADOR".equals(u.getRol().getNombre()))
                .filter(u -> Boolean.TRUE.equals(u.getActivo()))
                .toList();
    }

    private BigDecimal coalesce(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private record IngresoAgg(String nombre, long count, BigDecimal monto, BigDecimal multas) {
    }

    private record AbonoAgg(String nombre, long count, BigDecimal monto) {
    }
}
