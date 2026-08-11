package com.magno.dto;

import com.magno.dto.cliente.ClienteCreateRequest;
import com.magno.dto.cliente.ClienteUpdateRequest;
import com.magno.dto.sucursal.SucursalCreateRequest;
import com.magno.dto.sucursal.SucursalUpdateRequest;
import com.magno.dto.usuario.UsuarioCreateRequest;
import com.magno.dto.usuario.UsuarioUpdateRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PhoneValidationTest {

    private static jakarta.validation.ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        validatorFactory.close();
    }

    @Test
    void todosLosTelefonosRechazanValoresQueNoSeanDiezDigitos() {
        List<PhoneField> fields = List.of(
                new PhoneField(ClienteCreateRequest.class, "telefonoFijo"),
                new PhoneField(ClienteCreateRequest.class, "celular"),
                new PhoneField(ClienteCreateRequest.class, "ref1Telefono"),
                new PhoneField(ClienteCreateRequest.class, "ref2Telefono"),
                new PhoneField(ClienteCreateRequest.class, "avalTelefono"),
                new PhoneField(ClienteUpdateRequest.class, "telefonoFijo"),
                new PhoneField(ClienteUpdateRequest.class, "celular"),
                new PhoneField(ClienteUpdateRequest.class, "ref1Telefono"),
                new PhoneField(ClienteUpdateRequest.class, "ref2Telefono"),
                new PhoneField(ClienteUpdateRequest.class, "avalTelefono"),
                new PhoneField(UsuarioCreateRequest.class, "telefono"),
                new PhoneField(UsuarioCreateRequest.class, "ref1Telefono"),
                new PhoneField(UsuarioCreateRequest.class, "ref2Telefono"),
                new PhoneField(UsuarioUpdateRequest.class, "telefono"),
                new PhoneField(UsuarioUpdateRequest.class, "ref1Telefono"),
                new PhoneField(UsuarioUpdateRequest.class, "ref2Telefono"),
                new PhoneField(SucursalCreateRequest.class, "telefono"),
                new PhoneField(SucursalUpdateRequest.class, "telefono"));

        for (PhoneField field : fields) {
            assertThat(validator.validateValue(field.dtoClass(), field.property(), "5512345678"))
                    .as("%s.%s acepta 10 dígitos", field.dtoClass().getSimpleName(), field.property())
                    .isEmpty();
            assertThat(validator.validateValue(field.dtoClass(), field.property(), "551234567"))
                    .as("%s.%s rechaza 9 dígitos", field.dtoClass().getSimpleName(), field.property())
                    .isNotEmpty();
            assertThat(validator.validateValue(field.dtoClass(), field.property(), "55123456789"))
                    .as("%s.%s rechaza 11 dígitos", field.dtoClass().getSimpleName(), field.property())
                    .isNotEmpty();
            assertThat(validator.validateValue(field.dtoClass(), field.property(), "55A2345678"))
                    .as("%s.%s rechaza letras", field.dtoClass().getSimpleName(), field.property())
                    .isNotEmpty();
        }
    }

    private record PhoneField(Class<?> dtoClass, String property) {}
}
