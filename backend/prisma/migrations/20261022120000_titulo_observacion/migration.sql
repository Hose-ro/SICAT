-- La jefatura llama "observación" a lo que antes era "seguimiento": los títulos
-- ya guardados de los casos con un docente pasan a "Observación con …".
-- Idempotente: solo toca los que todavía empiezan con "Seguimiento con".
UPDATE "AlertaCarrera"
SET "titulo" = regexp_replace("titulo", '^Seguimiento con', 'Observación con')
WHERE "tipo" = 'SEGUIMIENTO_DOCENTE'
  AND "titulo" LIKE 'Seguimiento con%';
