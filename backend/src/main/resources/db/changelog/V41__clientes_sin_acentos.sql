-- Quita acentos de vocales en nombres/apellidos de clientes existentes.
-- La ñ/Ñ se conserva: no es un acento, es una letra distinta.
UPDATE clientes SET
    nombre = translate(nombre, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'),
    apellido_paterno = translate(apellido_paterno, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'),
    apellido_materno = translate(apellido_materno, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')
WHERE nombre ~ '[áéíóúüÁÉÍÓÚÜ]'
   OR apellido_paterno ~ '[áéíóúüÁÉÍÓÚÜ]'
   OR apellido_materno ~ '[áéíóúüÁÉÍÓÚÜ]';
