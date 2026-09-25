/** Datos de contacto que el docente puede completar desde la lista del grupo. */
export const CAMPOS_ALUMNO = [
  {
    campo: 'numeroControl',
    etiqueta: 'No. de control',
    faltante: 'No. de control',
    placeholder: 'Ej. 225Q0103',
    type: 'text',
    inputMode: 'text',
    autoCapitalize: 'characters',
  },
  {
    campo: 'email',
    etiqueta: 'Correo',
    faltante: 'correo',
    placeholder: 'Agregar correo',
    type: 'email',
    inputMode: 'email',
    autoCapitalize: 'none',
  },
  {
    campo: 'telefono',
    etiqueta: 'Teléfono',
    faltante: 'teléfono',
    placeholder: '10 dígitos',
    type: 'tel',
    inputMode: 'numeric',
    autoCapitalize: 'none',
  },
]

export const SEXOS = [
  { valor: 'HOMBRE', etiqueta: 'Hombre', corta: 'H' },
  { valor: 'MUJER', etiqueta: 'Mujer', corta: 'M' },
]

/** Nombres cortos de lo que le falta al alumno, en el orden en que se piden. */
export function datosFaltantes(alumno) {
  const faltan = alumno.sexo ? [] : ['sexo']
  for (const { campo, faltante } of CAMPOS_ALUMNO) {
    if (!alumno[campo]) faltan.push(faltante)
  }
  return faltan
}

/** Igual que la normalización del backend, para comparar sin falsos cambios. */
export function normalizarCampo(campo, valor) {
  const texto = String(valor ?? '').trim()
  if (campo === 'numeroControl') return texto.toUpperCase()
  if (campo === 'email') return texto.toLowerCase()
  if (campo === 'telefono') return texto.replace(/\D/g, '')
  return texto
}

/** Mismas reglas que CompletarAlumnoGrupoDto, para avisar antes de ir al servidor. */
export function validarCampo(campo, valor) {
  if (!valor) return 'No se puede dejar vacío'
  if (campo === 'numeroControl' && !/^\d{3}[A-Z]\d{4}$/.test(valor)) {
    return 'Usa el formato 225Q0103'
  }
  if (campo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
    return 'Correo no válido'
  }
  if (campo === 'telefono' && !/^\d{10}$/.test(valor)) {
    return 'Debe tener 10 dígitos'
  }
  return ''
}

/** Resumen del grupo: cuántos hay de cada sexo y qué dato falta a cuántos. */
export function resumirDatosAlumnos(alumnos) {
  const resumen = {
    hombres: 0,
    mujeres: 0,
    sinSexo: 0,
    incompletos: 0,
    sinCampo: Object.fromEntries(CAMPOS_ALUMNO.map(({ campo }) => [campo, 0])),
  }
  for (const alumno of alumnos) {
    if (alumno.sexo === 'HOMBRE') resumen.hombres += 1
    else if (alumno.sexo === 'MUJER') resumen.mujeres += 1
    else resumen.sinSexo += 1
    for (const { campo } of CAMPOS_ALUMNO) {
      if (!alumno[campo]) resumen.sinCampo[campo] += 1
    }
    if (datosFaltantes(alumno).length > 0) resumen.incompletos += 1
  }
  return resumen
}
