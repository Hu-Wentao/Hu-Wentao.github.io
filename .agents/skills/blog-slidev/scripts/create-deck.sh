#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo 'Usage: create-deck.sh <kebab-case-slug> [title]' >&2
  exit 64
fi

slug="$1"
title="${2:-$1}"

if [[ ! "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo 'The slug must use lowercase kebab-case.' >&2
  exit 64
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
repo_root="$(git -C "$skill_dir" rev-parse --show-toplevel)"
target="$repo_root/slides/$slug"

if [[ -e "$target" ]]; then
  echo "Refusing to overwrite existing path: $target" >&2
  exit 73
fi

mkdir -p "$repo_root/slides"
cp -R "$skill_dir/assets/deck-template" "$target"

escaped_slug="${slug//&/\\&}"
escaped_title="${title//&/\\&}"
sed -i.bak -e "s/__SLUG__/$escaped_slug/g" -e "s/__TITLE__/$escaped_title/g" \
  "$target/package.json" "$target/slides.md"
rm "$target/package.json.bak" "$target/slides.md.bak"

pnpm --dir "$target" install

echo "Created slides/$slug"
echo "Preview: pnpm --dir slides/$slug dev"
