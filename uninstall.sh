#!/usr/bin/env bash
#
# Aakash Cloud System - Complete Uninstaller & Purge Script
#
set -Eeuo pipefail

INSTALL_DIR="${AAKASH_INSTALL_DIR:-$HOME/.aakash}"

if [ -f "./docker-compose.yml" ] && [ -f "./Dockerfile" ]; then
  SCRIPT_DIR="$(pwd)"
elif [ -d "$INSTALL_DIR" ]; then
  SCRIPT_DIR="$INSTALL_DIR"
else
  SCRIPT_DIR="$(pwd)"
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

PURGE_DATA=true
PURGE_IMAGES=false
PURGE_DEPS=false
FORCE=false

print_banner() {
  printf "\n%s" "${C_RED}"
  cat <<'EOF'
 ╭─────────────────────────────────────────────────────────────╮
 │          AAKASH AWS CLOUD EMULATOR & CONSOLE                │
 │               System Uninstaller & Cleanup                  │
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
    echo ""
  fi
}

confirm_action() {
  if [ "$FORCE" = true ]; then
    return 0
  fi
  printf "%sAre you sure you want to uninstall and remove Aakash services? [y/N]: %s" "${C_AMBER}" "${C_RESET}"
  read -r response
  case "$response" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) printf "Uninstallation aborted.\n"; exit 0 ;;
  esac
}

stop_and_remove_containers() {
  step "1/4" "Stopping and Removing Docker Containers & Networks"
  local compose_cmd
  compose_cmd="$(get_compose_cmd)"
  if [ -n "$compose_cmd" ]; then
    $compose_cmd down --volumes --remove-orphans >/dev/null 2>&1 || true
    ok "Docker compose stack stopped and removed"
  fi

  for c in aakash aakash-dashboard; do
    if command -v docker >/dev/null 2>&1 && docker ps -a -q -f "name=^${c}$" | grep -q .; then
      docker rm -f "$c" >/dev/null 2>&1 || true
      ok "Removed container: $c"
    fi
  done

  if command -v docker >/dev/null 2>&1; then
    local spawned
    spawned="$(docker ps -a --filter "network=aakash_default" --format "{{.ID}}" 2>/dev/null || true)"
    if [ -n "$spawned" ]; then
      echo "$spawned" | xargs -r docker rm -f >/dev/null 2>&1 || true
      ok "Removed spawned child containers"
    fi
    docker network rm aakash_default >/dev/null 2>&1 || true
    ok "Removed Docker network: aakash_default"
  fi
}

clean_docker_images() {
  if [ "$PURGE_IMAGES" = true ] && command -v docker >/dev/null 2>&1; then
    step "2/4" "Purging Associated Docker Images"
    docker rmi -f aws_local-dashboard floci/floci:latest >/dev/null 2>&1 || true
    ok "Docker images removed"
  else
    step "2/4" "Skipping Docker Images (use --images or --all to purge)"
  fi
}

clean_persistent_data() {
  step "3/4" "Cleaning Data Volumes & Storage"
  if [ "$PURGE_DATA" = true ]; then
    rm -rf aakash-data aakash-dashboard-data
    ok "Persistent storage removed (./aakash-data, ./aakash-dashboard-data)"
  else
    warn "Persistent data preserved in ./aakash-data"
  fi
}

clean_local_artifacts() {
  step "4/4" "Cleaning Build Caches & Node Artifacts"
  rm -rf .next out dist .turbo tsconfig.tsbuildinfo
  ok "Removed Next.js build artifacts (.next, out, dist)"
  if [ "$PURGE_DEPS" = true ]; then
    rm -rf node_modules
    ok "Removed node_modules"
  fi
}

show_completion() {
  printf "\n%s" "${C_GREEN}"
  cat <<'EOF'
 ╭─────────────────────────────────────────────────────────────╮
 │  ✓ Aakash Cloud System Successfully Uninstalled!            │
 ├─────────────────────────────────────────────────────────────┤
 │  • Containers, networks, and child proxies stopped & removed│
 │  • Persistent data and configuration volumes purged         │
 │  • Next.js build caches and local artifacts cleared         │
 ╰─────────────────────────────────────────────────────────────╯
EOF
  printf "%s\n\n" "${C_RESET}"
}

show_help() {
  cat <<EOF
${C_BOLD}Aakash Cloud System Uninstaller${C_RESET}

Usage:
  ./uninstall.sh [options]

Options:
  --force, -f       Skip confirmation prompt
  --all, -a         Full purge: containers, data volumes, Docker images, and node_modules
  --images          Remove downloaded Docker images (floci & console dashboard)
  --keep-data       Remove containers & caches but preserve ./aakash-data
  --help, -h        Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f) FORCE=true; shift ;;
    --all|-a) PURGE_DATA=true; PURGE_IMAGES=true; PURGE_DEPS=true; FORCE=true; shift ;;
    --images) PURGE_IMAGES=true; shift ;;
    --keep-data) PURGE_DATA=false; shift ;;
    --help|-h) show_help; exit 0 ;;
    *) warn "Unknown argument: $1"; show_help; exit 1 ;;
  esac
done

print_banner
confirm_action
stop_and_remove_containers
clean_docker_images
clean_persistent_data
clean_local_artifacts
show_completion
