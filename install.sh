#!/usr/bin/env bash
#
# Aakash Cloud Emulator & Management Console - Production Docker Installer
#
set -Eeuo pipefail

TARGET_REPO="https://github.com/prathamrajbhar/aakash-system.git"
INSTALL_DIR="${AAKASH_INSTALL_DIR:-$HOME/.aakash}"

# If running directly inside repository, use current dir; otherwise clone/bootstrap into INSTALL_DIR
if [ -f "./docker-compose.yml" ] && [ -f "./Dockerfile" ]; then
  SCRIPT_DIR="$(pwd)"
else
  if ! command -v git >/dev/null 2>&1; then
    printf "Error: git is required to download Aakash. Please install git or clone the repo.\n" >&2
    exit 1
  fi
  if [ -d "$INSTALL_DIR/.git" ]; then
    printf "Updating existing Aakash installation at %s...\n" "$INSTALL_DIR"
    git -C "$INSTALL_DIR" pull --quiet
  else
    printf "Cloning Aakash System into %s...\n" "$INSTALL_DIR"
    git clone --depth 1 --quiet "$TARGET_REPO" "$INSTALL_DIR"
  fi
  SCRIPT_DIR="$INSTALL_DIR"
fi

cd "$SCRIPT_DIR"

# UI Theme Tokens
C_RESET=$'\033[0m'
C_BOLD=$'\033[1m'
C_DIM=$'\033[2m'
C_CYAN=$'\033[36m'
C_GREEN=$'\033[32m'
C_AMBER=$'\033[33m'
C_RED=$'\033[31m'

print_banner() {
  printf "\n%s" "${C_CYAN}"
  cat <<'EOF'
 ╭─────────────────────────────────────────────────────────────╮
 │          AAKASH AWS CLOUD EMULATOR & CONSOLE                │
 │               Production Docker Installer                   │
 ╰─────────────────────────────────────────────────────────────╯
EOF
  printf "%s\n" "${C_RESET}"
}

step()  { printf "%s[%s]%s %s%s%s\n" "${C_CYAN}" "$1" "${C_RESET}" "${C_BOLD}" "$2" "${C_RESET}"; }
ok()    { printf "  %s✓%s %s\n" "${C_GREEN}" "${C_RESET}" "$*"; }
warn()  { printf "  %s!%s %s\n" "${C_AMBER}" "${C_RESET}" "$*"; }
error() { printf "  %s✗%s %s\n" "${C_RED}" "${C_RESET}" "$*" >&2; exit 1; }

get_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    error "Docker Compose is required. Please install docker-compose-plugin."
  fi
}

check_prerequisites() {
  step "1/5" "Verifying Docker & Host Environment"
  if ! command -v docker >/dev/null 2>&1; then
    error "Docker is not installed. Please install Docker Engine: https://docs.docker.com/engine/install/"
  fi
  if ! docker info >/dev/null 2>&1; then
    error "Docker daemon is not running or accessible. Start Docker (e.g. 'sudo systemctl start docker')."
  fi
  local compose_cmd
  compose_cmd="$(get_compose_cmd)"
  ok "Docker Engine is active ($($compose_cmd version | tr -d '\n'))"

  for port in 4566 3050; do
    if command -v ss >/dev/null 2>&1 && ss -tulpn 2>/dev/null | grep -q ":${port}\b"; then
      warn "Port ${port} is currently bound on host. Ensure existing services do not conflict."
    fi
  done
  ok "Ports 4566 (emulator) and 3050 (console) checked"
}

setup_storage() {
  step "2/5" "Configuring Persistent Storage Volumes"
  mkdir -p aakash-data aakash-dashboard-data
  chmod 755 aakash-data aakash-dashboard-data 2>/dev/null || true
  ok "Mounted directories initialized (./aakash-data, ./aakash-dashboard-data)"
}

build_and_pull() {
  step "3/5" "Building Console Image & Pulling Emulator Engine"
  local compose_cmd
  compose_cmd="$(get_compose_cmd)"
  $compose_cmd pull aakash
  ok "Pulled latest Aakash emulator engine"
  $compose_cmd build dashboard
  ok "Compiled production Next.js standalone container"
}

deploy_containers() {
  step "4/5" "Deploying Production Containers"
  local compose_cmd
  compose_cmd="$(get_compose_cmd)"
  $compose_cmd up -d
  ok "Containers started (aakash + aakash-dashboard)"
}

verify_health() {
  step "5/5" "Verifying Stack Health & Endpoints"
  local attempts=0
  local max_attempts=30
  printf "  %sWaiting for endpoints to become ready...%s\n" "${C_DIM}" "${C_RESET}"
  while [ "$attempts" -lt "$max_attempts" ]; do
    if curl -fs "http://localhost:3050" >/dev/null 2>&1; then
      ok "Aakash Console is responding on http://localhost:3050"
      break
    fi
    sleep 1
    attempts=$((attempts + 1))
  done
  if [ "$attempts" -ge "$max_attempts" ]; then
    warn "Console took longer than expected to answer on port 3050. Check './install.sh --logs'."
  fi
  if curl -fs "http://localhost:4566" >/dev/null 2>&1 || curl -fs "http://localhost:4566/_health" >/dev/null 2>&1; then
    ok "Aakash AWS Emulator is responding on http://localhost:4566"
  fi
}

show_completion() {
  printf "\n%s" "${C_GREEN}"
  cat <<'EOF'
 ╭─────────────────────────────────────────────────────────────╮
 │  ✓ Aakash Cloud System Successfully Installed & Running!    │
 ├─────────────────────────────────────────────────────────────┤
 │  Console Web UI :  http://localhost:3050                    │
 │  AWS Emulator   :  http://localhost:4566                    │
 │  Persistent Data:  ./aakash-data & ./aakash-dashboard-data   │
 ├─────────────────────────────────────────────────────────────┤
 │  Management Commands:                                       │
 │    ./install.sh --status    Check container status          │
 │    ./install.sh --logs      Stream live service logs        │
 │    ./install.sh --stop      Stop all containers             │
 │    ./install.sh --restart   Restart all containers          │
 ╰─────────────────────────────────────────────────────────────╯
EOF
  printf "%s\n\n" "${C_RESET}"
}

run_install() {
  print_banner
  check_prerequisites
  setup_storage
  build_and_pull
  deploy_containers
  verify_health
  show_completion
}

show_help() {
  cat <<EOF
${C_BOLD}Aakash AWS Cloud Emulator & Console${C_RESET}

Usage:
  ./install.sh [option]

Options:
  --install, -i   Install & run production Docker stack (default)
  --status, -s    Display container status and ports
  --logs, -l      Stream live container logs
  --stop          Stop running Aakash Docker containers
  --restart       Restart running Aakash Docker containers
  --dev           Start local Node.js development server
  --verify        Run TypeScript check, linter, and tests
  --help, -h      Show this help message
EOF
}

ACTION="${1:---install}"
COMPOSE_CMD="$(get_compose_cmd 2>/dev/null || echo 'docker compose')"

case "$ACTION" in
  --install|-i|"")
    run_install
    ;;
  --status|-s|--ps)
    $COMPOSE_CMD ps
    ;;
  --logs|-l)
    $COMPOSE_CMD logs -f
    ;;
  --stop|--down)
    $COMPOSE_CMD down
    printf "%s✓%s Aakash stack stopped.\n" "${C_GREEN}" "${C_RESET}"
    ;;
  --restart)
    $COMPOSE_CMD restart
    printf "%s✓%s Aakash stack restarted.\n" "${C_GREEN}" "${C_RESET}"
    ;;
  --dev|-d)
    npm run dev
    ;;
  --verify|-v)
    npm run typecheck && npm run lint && npm run test
    ;;
  --help|-h)
    show_help
    ;;
  *)
    printf "%sUnknown option: %s%s\n\n" "${C_RED}" "$ACTION" "${C_RESET}"
    show_help
    exit 1
    ;;
esac
