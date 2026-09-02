export type CandidatoMateria = {
  id: number;
  clave: string;
  nombre: string;
};

export type CandidatoDocente = {
  id: number;
  nombre: string;
};

export function normalizarTexto(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function distanciaLevenshtein(a: string, b: string) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const anterior = Array.from({ length: b.length + 1 }, (_, index) => index);
  const actual = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    actual[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      actual[j] = Math.min(
        actual[j - 1] + 1,
        anterior[j] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) anterior[j] = actual[j];
  }
  return anterior[b.length];
}

export function similitudTexto(a?: string | null, b?: string | null) {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    return Math.min(
      0.96,
      Math.min(na.length, nb.length) / Math.max(na.length, nb.length) + 0.25,
    );
  }
  return 1 - distanciaLevenshtein(na, nb) / Math.max(na.length, nb.length);
}

export function encontrarMateria(
  claveDetectada: string | null | undefined,
  nombreDetectado: string | null | undefined,
  candidatos: CandidatoMateria[],
) {
  const clave = normalizarTexto(claveDetectada).replace(/\s/g, '');
  if (clave) {
    const exacta = candidatos.find(
      (item) => normalizarTexto(item.clave).replace(/\s/g, '') === clave,
    );
    if (exacta) return { candidato: exacta, confianza: 1 };
  }

  const resultados = candidatos
    .map((candidato) => ({
      candidato,
      confianza: Math.max(
        similitudTexto(nombreDetectado, candidato.nombre),
        similitudTexto(claveDetectada, candidato.clave) * 0.95,
      ),
    }))
    .sort((a, b) => b.confianza - a.confianza);
  const mejor = resultados[0];
  return mejor && mejor.confianza >= 0.48
    ? mejor
    : { candidato: null, confianza: mejor?.confianza ?? 0 };
}

export function encontrarDocente(
  nombreDetectado: string | null | undefined,
  candidatos: CandidatoDocente[],
) {
  const resultados = candidatos
    .map((candidato) => ({
      candidato,
      confianza: similitudTexto(nombreDetectado, candidato.nombre),
    }))
    .sort((a, b) => b.confianza - a.confianza);
  const mejor = resultados[0];
  return mejor && mejor.confianza >= 0.68
    ? mejor
    : { candidato: null, confianza: mejor?.confianza ?? 0 };
}
