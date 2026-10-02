export const EMAIL_AUTH_ENABLED =
  import.meta.env.VITE_EMAIL_AUTH_ENABLED === "true";

// La escuela da de alta a los alumnos y ellos activan su cuenta con un código.
// El autoregistro sólo vuelve si se habilita a propósito (y en el backend).
export const REGISTRO_PUBLICO_ENABLED =
  import.meta.env.VITE_REGISTRO_PUBLICO_ENABLED === "true";
