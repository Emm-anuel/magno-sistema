package com.magno.dto;

import com.magno.dto.cliente.ClienteCreateRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ClienteCreateRequestValidationTest {

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
    void camposDeClasificacionObligatoriosRechazanNulosYVacios() {
        List.of("ineTipo", "domTipoVivienda", "negocioTipoLocal").forEach(property -> {
            assertThat(validator.validateValue(ClienteCreateRequest.class, property, null))
                    .as("%s rechaza null", property)
                    .isNotEmpty();
            assertThat(validator.validateValue(ClienteCreateRequest.class, property, ""))
                    .as("%s rechaza texto vacío", property)
                    .isNotEmpty();
            assertThat(validator.validateValue(ClienteCreateRequest.class, property, "VALOR"))
                    .as("%s acepta un valor", property)
                    .isEmpty();
        });
    }

    @Test
    void ingresosSemanalesEsObligatorio() {
        assertThat(validator.validateValue(ClienteCreateRequest.class, "ingresosSemanales", null))
                .isNotEmpty();
        assertThat(validator.validateValue(
                ClienteCreateRequest.class, "ingresosSemanales", new BigDecimal("1000.00")))
                .isEmpty();
    }
}
