package com.magno.service;

import com.magno.dto.caja.MovimientoInversionDTO;
import com.magno.dto.caja.MovimientoInversionRequest;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.security.JwtPrincipal;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class InversionService {

    private final CajaDiaRepository cajaDiaRepo;
    private final CajaMovimientoInversionRepository movimientoRepo;
    private final ConceptoInversionRepository conceptoRepo;
    private final UsuarioRepository usuarioRepo;

    public InversionService(CajaDiaRepository cajaDiaRepo,
            CajaMovimientoInversionRepository movimientoRepo,
            ConceptoInversionRepository conceptoRepo,
            UsuarioRepository usuarioRepo) {
        this.cajaDiaRepo = cajaDiaRepo;
        this.movimientoRepo = movimientoRepo;
        this.conceptoRepo = conceptoRepo;
        this.usuarioRepo = usuarioRepo;
    }

    public List<MovimientoInversionDTO> getByDia(Long cajaId, JwtPrincipal principal) {
        CajaDia caja = cajaDiaRepo.findById(cajaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
        assertSucursalOwnership(caja, principal);
        return movimientoRepo.findByCajaDiaIdOrderByCreatedAtAsc(cajaId)
                .stream().map(this::toDTO).toList();
    }

    @Transactional
    public MovimientoInversionDTO registrar(Long cajaId, MovimientoInversionRequest req, JwtPrincipal principal) {
        CajaDia caja = cajaDiaRepo.findById(cajaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
        assertSucursalOwnership(caja, principal);
        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException(
                    "Solo se pueden registrar movimientos mientras la caja está abierta");
        }
        ConceptoInversion concepto = null;
        if (req.conceptoInversionId() != null) {
            concepto = conceptoRepo.findByIdAndDeletedAtIsNull(req.conceptoInversionId())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Concepto no encontrado: " + req.conceptoInversionId()));
        } else if (req.descripcion() == null || req.descripcion().isBlank()) {
            throw new IllegalArgumentException("La descripción es obligatoria cuando no se captura concepto");
        }

        CajaMovimientoInversion mov = CajaMovimientoInversion.builder()
                .cajaDia(caja)
                .conceptoInversion(concepto)
                .descripcion(req.descripcion())
                .monto(req.monto())
                .registradoPor(usuarioRepo.getReferenceById(principal.userId()))
                .build();
        return toDTO(movimientoRepo.save(mov));
    }

    @Transactional
    public void eliminar(Long cajaId, Long movimientoId, JwtPrincipal principal) {
        CajaDia caja = cajaDiaRepo.findById(cajaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
        assertSucursalOwnership(caja, principal);
        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException(
                    "Solo se pueden eliminar movimientos mientras la caja está abierta");
        }
        CajaMovimientoInversion mov = movimientoRepo.findById(movimientoId)
                .orElseThrow(() -> new EntityNotFoundException("Movimiento no encontrado: " + movimientoId));
        if (!mov.getCajaDia().getId().equals(cajaId)) {
            throw new IllegalArgumentException("El movimiento no pertenece a esta caja");
        }
        movimientoRepo.delete(mov);
    }

    private static void assertSucursalOwnership(CajaDia caja, JwtPrincipal principal) {
        if ("ADMINISTRADOR".equals(principal.rol())) return;
        if (!caja.getSucursal().getId().equals(principal.sucursalId())) {
            throw new IllegalArgumentException("No tienes acceso a la caja de otra sucursal");
        }
    }

    private MovimientoInversionDTO toDTO(CajaMovimientoInversion m) {
        return new MovimientoInversionDTO(
                m.getId(),
                m.getConceptoInversion() != null ? m.getConceptoInversion().getId() : null,
                m.getConceptoInversion() != null ? m.getConceptoInversion().getNombre() : null,
                m.getDescripcion(),
                m.getMonto(),
                m.getRegistradoPor().getId(),
                m.getRegistradoPor().getNombreCompleto(),
                m.getCreatedAt());
    }
}
