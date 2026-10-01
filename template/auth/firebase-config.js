// Config web de Firebase para la puerta de acceso del Storybook.
// La apiKey web NO es un secreto: identifica al proyecto en público y se puede
// commitear. El acceso lo controla Firebase Auth (solo existen las cuentas invitadas).
// Se saca de la consola de Firebase → Configuración del proyecto → Tus apps → SDK web.
export const firebaseConfig = {
  apiKey: 'TODO',
  authDomain: 'TODO.firebaseapp.com',
  projectId: 'TODO',
  storageBucket: 'TODO.firebasestorage.app',
  messagingSenderId: 'TODO',
  appId: 'TODO',
}
