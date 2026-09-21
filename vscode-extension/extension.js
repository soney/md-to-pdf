/* Adds md-to-pdf's worksheet syntax (`::: answer`, `::: choices`,
   `::: columns`, question grouping, `\newpage`) to VS Code's built-in
   markdown preview, so worksheets render live the way the PDF will. Unlike
   the PDF's worksheet mode, the preview always shows answer contents (you
   are writing them); preview.css inks them blue.

   worksheet.cjs is a copy of src/worksheet.cjs and markdown-it-container is
   vendored into ./node_modules, both by scripts/install-vscode-extension.sh,
   so this folder is self-contained. */
const worksheet = require('./worksheet.cjs');

function activate() {
    return {
        extendMarkdownIt(md) {
            return md.use(worksheet);
        },
    };
}

module.exports = { activate };
