-- El docente arma su propia lista de grupos ("Mis grupos"): hasta ahora un
-- grupo sólo se le relacionaba a través de los horarios que le programan, así
-- que no podía agregar a mano un grupo que ya existe en la base.

CREATE TABLE IF NOT EXISTS "_DocenteGrupo" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

ALTER TABLE "_DocenteGrupo"
  DROP CONSTRAINT IF EXISTS "_DocenteGrupo_A_fkey";
ALTER TABLE "_DocenteGrupo"
  ADD CONSTRAINT "_DocenteGrupo_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_DocenteGrupo"
  DROP CONSTRAINT IF EXISTS "_DocenteGrupo_B_fkey";
ALTER TABLE "_DocenteGrupo"
  ADD CONSTRAINT "_DocenteGrupo_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "_DocenteGrupo_AB_unique" ON "_DocenteGrupo"("A", "B");
CREATE INDEX IF NOT EXISTS "_DocenteGrupo_B_index" ON "_DocenteGrupo"("B");
