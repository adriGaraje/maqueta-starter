// Lo que se ve en la puerta del Storybook. Es lo único que hay que tocar junto
// con `firebase-config.js`: `guard.js` y `login/index.html` leen de aquí.
export const authConfig = {
  brand: 'Storybook', // nombre que encabeza el login
  subtitle: 'Acceso privado', // una línea bajo el nombre; vacío para quitarla
  poweredBy: '', // pie del login («Powered by …»); vacío para quitarlo
  accent: '#2563eb', // botones, foco y enlaces
  ink: '#111827', // texto
  surface: '#f3f4f6', // fondo de la página de login (liso, sin degradado)
  loginPath: '/login/', // dónde vive la página de login
  logoutLabel: 'Cerrar sesión',
  errorMessage: 'Email o contraseña incorrectos.',
}
