#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"
version="$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])' < /dev/null)"
name="fringe-detector-pilot-v${version}"
dist="$repo_root/dist"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

mkdir -p "$dist" "$stage/$name"

files=(
  LICENSE
  LISA_PILOT_GUIDE.md
  PRIVACY.md
  README.md
  RELEASE_SIGNING_KEY.pub
  SURVEY_SOURCES.md
  background.js
  badge.css
  content.js
  manifest.json
  popup.css
  popup.html
  popup.js
  shared.js
)

for file in "${files[@]}"; do
  cp "$repo_root/$file" "$stage/$name/$file"
done
cp -R "$repo_root/icons" "$stage/$name/icons"
cp -R "$repo_root/docs" "$stage/$name/docs"

archive="$dist/$name.zip"
checksum="$archive.sha256"
signature="$archive.sig"
rm -f "$archive" "$checksum" "$signature"

(
  cd "$stage"
  /usr/bin/zip -q -r "$archive" "$name" -x '*.DS_Store' '*/._*'
)

(
  cd "$dist"
  shasum -a 256 "$(basename "$archive")" > "$(basename "$checksum")"
)

if [[ -n "${FRINGE_SIGNING_KEY:-}" ]]; then
  ssh-keygen -Y sign -f "$FRINGE_SIGNING_KEY" -n file "$archive"
fi

python3 - "$archive" <<'PY'
import json
import sys
import zipfile

archive = sys.argv[1]
with zipfile.ZipFile(archive) as zf:
    manifests = [name for name in zf.namelist() if name.endswith("/manifest.json")]
    if len(manifests) != 1:
        raise SystemExit(f"expected one manifest, found {manifests}")
    manifest = json.loads(zf.read(manifests[0]))
    if manifest.get("manifest_version") != 3:
        raise SystemExit("release is not a Manifest V3 extension")
    forbidden = ("node_modules/", ".git/", "evaluation/", "test/")
    leaked = [name for name in zf.namelist() if any(part in name for part in forbidden)]
    if leaked:
        raise SystemExit(f"development files leaked into release: {leaked[:5]}")
print(f"validated {archive}: MV3 {manifest['version']}, {len(zf.namelist())} entries")
PY

printf '%s\n' "$archive" "$checksum"
if [[ -f "$signature" ]]; then
  printf '%s\n' "$signature"
fi
