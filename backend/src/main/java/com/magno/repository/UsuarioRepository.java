package com.magno.repository;

import com.magno.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long>,
        JpaSpecificationExecutor<Usuario> {

    Optional<Usuario> findByEmail(String email);

    List<Usuario> findByRolNombre(String rolNombre);

    List<Usuario> findBySucursalId(Long sucursalId);

    boolean existsByEmail(String email);
}
