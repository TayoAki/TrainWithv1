#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
case "${1:-}" in
  --help|-h) echo 'Usage: ./script/build_and_run.sh [--ios|--android|--web|--dev-client|--tunnel|--export-web|--doctor]'; exit 0;;
  --doctor) exec npx expo-doctor;;
  --export-web) exec npx expo export --platform web;;
  --ios|--android|--web|--dev-client|--tunnel) exec npx expo start "$@";;
  '') exec npx expo start;;
  *) echo "Unknown option: $1" >&2; exit 1;;
esac
