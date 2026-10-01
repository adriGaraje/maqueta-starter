// Puerta de acceso del Storybook publicado. Se inyecta en el manager y en el
// preview (`.storybook/main.js`); en local no hace nada. Sin sesión, manda al
// login y vuelve a la URL pedida; con sesión, pinta un botón de cerrar sesión.
// No hay nada que configurar aquí: lo visible sale de `auth-config.js` y las
// claves de `firebase-config.js`.
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

if (!LOCAL) {
  const { initializeApp } =
    await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js')
  const { getAuth, onAuthStateChanged, signOut } =
    await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js')
  const { firebaseConfig } = await import('/firebase-config.js')
  const { authConfig } = await import('/auth-config.js')

  const auth = getAuth(initializeApp(firebaseConfig))

  const LOGOUT_SVG =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'

  const addLogout = () => {
    if (document.getElementById('auth-logout-bar')) return

    if (!document.getElementById('auth-logout-style')) {
      const st = document.createElement('style')
      st.id = 'auth-logout-style'
      st.textContent = [
        '#storybook-explorer-menu{padding-bottom:64px !important}',
        '.auth-logout{position:fixed;left:0;bottom:0;z-index:2147483000;display:inline-flex;align-items:center;padding:10px;background:#f5f5f5;border-radius:0 12px 0 0;box-shadow:0 -2px 14px rgba(0,0,0,.10)}',
        `.auth-logout__button{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border:1px solid ${authConfig.accent}33;border-radius:999px;background:#fff;color:${authConfig.accent};cursor:pointer;white-space:nowrap;font:600 12px/1 system-ui,sans-serif}`,
      ].join('\n')
      document.head.appendChild(st)
    }

    const bar = document.createElement('div')
    bar.id = 'auth-logout-bar'
    bar.className = 'auth-logout'

    const btn = document.createElement('button')
    btn.id = 'auth-logout'
    btn.className = 'auth-logout__button'
    btn.type = 'button'
    btn.innerHTML = LOGOUT_SVG + '<span>' + authConfig.logoutLabel + '</span>'
    btn.addEventListener('click', () => {
      signOut(auth).finally(() => window.location.replace(authConfig.loginPath))
    })
    bar.appendChild(btn)
    ;(document.body || document.documentElement).appendChild(bar)
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      const top = window.top || window
      const next = encodeURIComponent(top.location.pathname + top.location.search)
      top.location.replace(authConfig.loginPath + '?next=' + next)
      return
    }
    if (window === window.top) addLogout()
  })
}
