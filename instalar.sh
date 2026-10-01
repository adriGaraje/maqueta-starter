#!/usr/bin/env bash
# =============================================================================
#  instalar.sh — arranca maqueta-starter en una máquina sin preparar.
#
#  Uso:  bash instalar.sh [--sin-instalar] [--port <n>] [--no-open] [...]
#        curl -fsSL <raw>/instalar.sh | bash -s -- [opciones]
#
#  Comprueba git, Node ≥ 20, npm ≥ 9, acceso al repo y el puerto; luego lanza
#  `npx github:adriGaraje/maqueta-starter`. Si falta Node pregunta por /dev/tty
#  cómo instalar Node 24 (nvm · Homebrew · nada); sin terminal, usa nvm.
#  `--sin-instalar` no instala nada y solo dice qué falta. El resto de
#  argumentos pasan tal cual al asistente.
#  macOS y Linux. Sin sudo: todo queda en tu usuario.
# =============================================================================
set -uo pipefail

REPO="adriGaraje/maqueta-starter"
REPO_URL="https://github.com/${REPO}.git"
NODE_INSTALAR=24
NVM_VERSION="v0.40.3"

ok() { printf '\033[32m✔\033[0m %s\n' "$*"; }
mal() { printf '\033[31m✖\033[0m %s\n' "$*"; }
nota() { printf '    %s\n' "$*"; }

PUERTO=4747
VIA_NODE=""

final() {
  printf '\n┌──────────────────────────────────────────────────────┐\n'
  printf '│ Si el navegador no se abre, entra en                 │\n'
  printf '│   http://localhost:%-34s│\n' "${PUERTO}"
  if [ "$VIA_NODE" = nvm ]; then
    printf '│ Node %s se ha instalado con nvm: en una terminal     │\n' "${NODE_INSTALAR}"
    printf '│ nueva, cárgalo con  nvm use %-25s│\n' "${NODE_INSTALAR}"
  fi
  printf '└──────────────────────────────────────────────────────┘\n'
}

carga_nvm() {
  command -v nvm >/dev/null 2>&1 && return 0
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [ -s "$NVM_DIR/nvm.sh" ] || return 1
  # nvm.sh devuelve ≠ 0 si aún no hay ningún Node instalado: no es un fallo.
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" || true
  command -v nvm >/dev/null 2>&1
}

hay_tty() { (exec </dev/tty) 2>/dev/null; }

instrucciones_node() {
  nota "Para instalar Node a mano, cualquiera de las dos:"
  nota "  nvm (recomendado, por usuario):"
  nota "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh | bash"
  nota "    nvm install ${NODE_INSTALAR} && nvm use ${NODE_INSTALAR}"
  nota "  Homebrew (macOS, global):"
  nota "    brew install node@${NODE_INSTALAR} && brew link --force --overwrite node@${NODE_INSTALAR}"
  nota "Y vuelve a lanzar este script."
}

instala_con_nvm() {
  if ! carga_nvm; then
    command -v curl >/dev/null 2>&1 || {
      mal "Para instalar nvm hace falta curl."
      return 1
    }
    nota "Instalando nvm ${NVM_VERSION}…"
    if ! curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash >/dev/null 2>&1; then
      mal "No he podido instalar nvm."
      nota "Mira https://github.com/nvm-sh/nvm#installing-and-updating"
      return 1
    fi
    carga_nvm || {
      mal "nvm se ha instalado pero no carga; abre una terminal nueva y repite."
      return 1
    }
    ok "nvm instalado en ${NVM_DIR}"
  fi
  nota "Instalando Node ${NODE_INSTALAR} con nvm…"
  if ! nvm install "$NODE_INSTALAR" >/dev/null 2>&1 || ! nvm use "$NODE_INSTALAR" >/dev/null 2>&1; then
    mal "nvm no ha podido instalar Node ${NODE_INSTALAR}."
    return 1
  fi
  VIA_NODE=nvm
}

instala_con_brew() {
  nota "Instalando node@${NODE_INSTALAR} con Homebrew (global: lo verá todo el sistema)…"
  if ! brew install "node@${NODE_INSTALAR}"; then
    mal "brew no ha podido instalar node@${NODE_INSTALAR}."
    return 1
  fi
  # node@N es keg-only: sin link no está en el PATH.
  if ! brew link --force --overwrite "node@${NODE_INSTALAR}" >/dev/null 2>&1; then
    nota "brew link ha fallado; lo pongo en el PATH solo para esta sesión."
    nota "Para siempre: echo 'export PATH=\"$(brew --prefix "node@${NODE_INSTALAR}")/bin:\$PATH\"' >> ~/.zprofile"
  fi
  export PATH="$(brew --prefix "node@${NODE_INSTALAR}")/bin:$PATH"
  hash -r
  VIA_NODE=brew
}

version_mayor() { # node|npm → número mayor, o vacío
  case "$1" in
    node) command -v node >/dev/null 2>&1 && node -p 'process.versions.node.split(".")[0]' 2>/dev/null ;;
    npm) command -v npm >/dev/null 2>&1 && npm --version 2>/dev/null | cut -d. -f1 ;;
  esac
}

main() {
  local sin_instalar=0 args=() a i
  for a in "$@"; do
    if [ "$a" = "--sin-instalar" ]; then sin_instalar=1; else args+=("$a"); fi
  done
  for ((i = 0; i < ${#args[@]}; i++)); do
    case "${args[$i]}" in
      --port | --puerto) PUERTO="${args[$((i + 1))]:-4747}" ;;
    esac
  done
  trap final EXIT

  echo "maqueta-starter · comprobaciones previas"
  echo

  # 1. git
  if command -v git >/dev/null 2>&1; then
    ok "git $(git --version | awk '{print $3}')"
  else
    mal "No encuentro git."
    if [ "$(uname)" = "Darwin" ]; then
      nota "Instálalo con: xcode-select --install"
    else
      nota "Instálalo con el gestor de tu sistema (p. ej. sudo apt install git)."
    fi
    return 1
  fi

  # 2. Node ≥ 20 — antes, nvm instalado pero sin cargar (shell no interactivo, curl | bash).
  local node_v
  node_v="$(version_mayor node)"
  if [ -z "$node_v" ] || [ "$node_v" -lt 20 ]; then
    carga_nvm && node_v="$(version_mayor node)"
  fi
  if [ -z "$node_v" ] || [ "$node_v" -lt 20 ]; then
    if [ -z "$node_v" ]; then mal "No encuentro Node."; else mal "Node $(node --version) es viejo: hace falta 20 o más."; fi
    local via=1 hay_brew=0
    [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1 && hay_brew=1
    if [ "$sin_instalar" = 1 ]; then
      via=3
    elif hay_tty; then
      # Con curl | bash el stdin es el script: la pregunta va por /dev/tty.
      echo "    ¿Cómo lo instalo?"
      echo "      1) nvm (recomendado): por usuario, varias versiones, lo que usa el equipo"
      [ "$hay_brew" = 1 ] && echo "      2) Homebrew: node@${NODE_INSTALAR}, global para todo el sistema"
      echo "      3) No instalar nada: te digo cómo hacerlo y salgo"
      read -r -p "    Elige [1]: " via </dev/tty
      via="${via:-1}"
    else
      nota "Sin terminal: instalo Node ${NODE_INSTALAR} con nvm sin preguntar."
    fi
    case "$via" in
      1) instala_con_nvm || return 1 ;;
      2)
        if [ "$hay_brew" = 1 ]; then instala_con_brew || return 1; else
          mal "No hay Homebrew en esta máquina."
          instrucciones_node
          return 1
        fi
        ;;
      *)
        nota "No instalo nada."
        instrucciones_node
        return 1
        ;;
    esac
    # Se vuelve a mirar en esta misma sesión: que la instalación haya ido bien no basta.
    node_v="$(version_mayor node)"
    if [ -z "$node_v" ] || [ "$node_v" -lt 20 ]; then
      mal "Tras instalar, node sigue sin responder con 20 o más ($(node --version 2>/dev/null || echo 'no encontrado'))."
      instrucciones_node
      return 1
    fi
  fi
  ok "Node $(node --version)"

  # 3. npm ≥ 9; desde npm 12, npx no baja paquetes de git sin --allow-git.
  local npm_v npx_flags=(--yes)
  npm_v="$(version_mayor npm)"
  if [ -z "$npm_v" ] || [ "$npm_v" -lt 9 ]; then
    mal "npm ${npm_v:-no encontrado}: hace falta 9 o más."
    nota "Actualízalo con: npm install -g npm@latest"
    return 1
  fi
  [ "$npm_v" -ge 12 ] && npx_flags+=(--allow-git=all)
  ok "npm $(npm --version)"

  # 4. Acceso al repo, sin pedir credenciales por teclado.
  if GIT_TERMINAL_PROMPT=0 git ls-remote "$REPO_URL" >/dev/null 2>&1; then
    ok "Acceso a github.com/${REPO}"
  else
    mal "No puedo leer github.com/${REPO}."
    nota "Lo más probable: sin red, o un proxy/VPN que corta GitHub."
    nota "  Prueba: git ls-remote ${REPO_URL}"
    nota "  Tras un proxy: git config --global http.proxy http://<proxy>:<puerto>"
    nota "Si el repo volviera a ser privado, además hace falta aceptar la invitación"
    nota "(https://github.com/${REPO}/invitations) y tener git autenticado ('gh auth login')."
    return 1
  fi

  # 5. Puerto libre
  local quien=""
  if command -v lsof >/dev/null 2>&1; then
    quien="$(lsof -nP -iTCP:"$PUERTO" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1 " (PID " $2 ")"}')"
  elif command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 "$PUERTO" 2>/dev/null; then
    quien="otro proceso"
  fi
  if [ -n "$quien" ]; then
    # Si quien lo tiene es un asistente anterior (un starter que se quedó colgado),
    # se cierra solo y se sigue; cualquier otro proceso se respeta.
    local pid_viejo
    pid_viejo="$(lsof -nP -iTCP:"$PUERTO" -sTCP:LISTEN -t 2>/dev/null | head -1)"
    if [ -n "$pid_viejo" ] && ps -o command= -p "$pid_viejo" 2>/dev/null | grep -q "servidor.mjs"; then
      kill "$pid_viejo" 2>/dev/null; sleep 1
      ok "Puerto ${PUERTO}: había un asistente anterior (PID ${pid_viejo}); cerrado"
    else
      mal "El puerto ${PUERTO} está ocupado por ${quien}."
      nota "Ciérralo o elige otro: bash instalar.sh --port $((PUERTO + 1))"
      return 1
    fi
  else
    ok "Puerto ${PUERTO} libre"
  fi
  return 0

  # 6. Lanzar. stdin desde /dev/null: con curl | bash, npx se comería el resto del script.
  echo
  echo "Lanzando: npx ${npx_flags[*]} github:${REPO} ${args[*]:-}"
  echo "(la primera vez descarga el asistente; puede tardar un minuto)"
  echo
  # El asistente corre como hijo; si esta shell muere (cerrar la terminal, Ctrl+C,
  # Ctrl+Z, kill), el hijo muere con ella y el puerto queda libre.
  npx "${npx_flags[@]}" "github:${REPO}" ${args[@]+"${args[@]}"} </dev/null &
  HIJO=$!
  mata_hijo() { kill "$HIJO" 2>/dev/null; wait "$HIJO" 2>/dev/null; }
  trap 'mata_hijo; final; exit 130' INT TERM HUP TSTP
  wait "$HIJO"
}

main "$@"
