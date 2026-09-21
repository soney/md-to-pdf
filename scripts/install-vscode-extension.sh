#!/usr/bin/env bash
# Make vscode-extension/ self-contained (fonts + vendored markdown-it-container),
# then symlink it into every VS Code extensions directory present. Reload VS
# Code windows ("Developer: Reload Window") after running this.
set -euo pipefail
cd "$(dirname "$0")/.."

ext=vscode-extension
mkdir -p "$ext/fonts" "$ext/node_modules"

cp node_modules/@fontsource/alegreya/files/alegreya-latin-400-normal.woff2 \
   node_modules/@fontsource/alegreya/files/alegreya-latin-400-italic.woff2 \
   node_modules/@fontsource/alegreya/files/alegreya-latin-700-normal.woff2 \
   node_modules/@fontsource/alegreya/files/alegreya-latin-700-italic.woff2 \
   node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2 \
   node_modules/@fontsource/inter/files/inter-latin-300-normal.woff2 \
   "$ext/fonts/"

rm -rf "$ext/node_modules/markdown-it-container"
cp -r node_modules/markdown-it-container "$ext/node_modules/"
cp src/worksheet.cjs "$ext/worksheet.cjs"

installed=0
for dir in "$HOME/.vscode/extensions" "$HOME/.vscode-server/extensions" \
           "$HOME/.vscode-insiders/extensions" "$HOME/.vscode-oss/extensions"; do
    if [ -d "$dir" ]; then
        ln -sfn "$PWD/$ext" "$dir/local.spot-markdown-preview-0.1.0"
        echo "linked $dir/local.spot-markdown-preview-0.1.0"
        installed=1
    fi
done

if [ "$installed" = 0 ]; then
    echo "no VS Code extensions directory found" >&2
    exit 1
fi
echo "done — reload VS Code windows to pick it up"
