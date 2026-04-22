#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLAYWRIGHT_CACHE_DIR="${HOME}/.cache/ms-playwright"
LOCAL_LIB_ROOT="${ROOT_DIR}/scripts/playwright-libs"
LOCAL_LIB_DIR="${LOCAL_LIB_ROOT}/usr/lib/x86_64-linux-gnu"

find_firefox_lib_dir() {
  find "${PLAYWRIGHT_CACHE_DIR}" -maxdepth 2 -type d -path "${PLAYWRIGHT_CACHE_DIR}/firefox-*/firefox" | sort -V | tail -n1
}

ensure_firefox_runtime() {
  local firefox_dir
  firefox_dir="$(find_firefox_lib_dir || true)"
  if [[ -n "${firefox_dir}" ]]; then
    printf '%s\n' "${firefox_dir}"
    return
  fi

  >&2 echo "Playwright Firefox runtime not found. Installing the bundled Firefox browser..."
  (cd "${ROOT_DIR}" && npx playwright install firefox >/dev/null)

  firefox_dir="$(find_firefox_lib_dir || true)"
  if [[ -z "${firefox_dir}" ]]; then
    >&2 echo "Failed to locate Playwright Firefox runtime after installation."
    exit 1
  fi

  printf '%s\n' "${firefox_dir}"
}

ensure_alsa_runtime() {
  if [[ -f "${LOCAL_LIB_DIR}/libasound.so.2" ]]; then
    return
  fi

  local temp_dir deb_path
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "${temp_dir}"' RETURN

  >&2 echo "Bootstrapping local ALSA runtime for Playwright Chromium..."
  (cd "${temp_dir}" && apt download libasound2t64 >/dev/null)

  deb_path="$(find "${temp_dir}" -maxdepth 1 -name 'libasound2t64_*.deb' | head -n1)"
  if [[ -z "${deb_path}" ]]; then
    >&2 echo "Unable to download libasound2t64 for the local Playwright runtime."
    exit 1
  fi

  mkdir -p "${LOCAL_LIB_ROOT}"
  dpkg-deb -x "${deb_path}" "${LOCAL_LIB_ROOT}"
  rm -rf "${temp_dir}"
  trap - RETURN
}

FIREFOX_LIB_DIR="$(ensure_firefox_runtime)"
ensure_alsa_runtime

export LD_LIBRARY_PATH="${FIREFOX_LIB_DIR}:${LOCAL_LIB_DIR}${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"

if [[ -z "${PLAYWRIGHT_MOBILE_BROWSER:-}" && -z "${CI:-}" ]]; then
  export PLAYWRIGHT_MOBILE_BROWSER="chromium"
fi

cd "${ROOT_DIR}"
exec npx playwright test "$@"
