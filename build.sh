#!/bin/bash
# Stamp the version into index.html (?v=<hash> on css/js; GitHub Pages caches ~10 min) and versi.txt ("new version" chip).
set -e
cd "$(dirname "$0")"
H=$(cat index.src.html js/*.js css/*.css | shasum | cut -c1-12)
sed "s/%%VERSI%%/$H/g" index.src.html > index.html
echo "$H" > versi.txt
for f in js/*.js; do node --check "$f"; done
echo "versi $H"
