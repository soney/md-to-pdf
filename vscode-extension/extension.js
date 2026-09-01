/* Adds the md-to-pdf `::: answer` container to VS Code's built-in
   markdown preview, so worksheets render live with the same answer boxes
   the PDF gets. Unlike the PDF's worksheet mode, the preview always shows
   answer contents (you are writing them); preview.css inks them blue.

   markdown-it-container is vendored into ./node_modules by
   scripts/install-vscode-extension.sh so this folder is self-contained. */
const container = require('markdown-it-container');

const HEIGHT_LENGTH = /^\d+(\.\d+)?(in|cm|mm|pt|px|em|rem)$/;
const HEIGHT_LINES = /^\d+$/;

function answerOpenTag(info) {
    const arg = info.trim().replace(/^answer\s*/, '');
    let style = '';
    if (HEIGHT_LENGTH.test(arg)) {
        style = ` style="min-height:${arg}"`;
    } else if (HEIGHT_LINES.test(arg)) {
        style = ` style="min-height:${Number(arg) * 1.6}em"`;
    }
    return `<div class="answer-box"${style}><div class="answer-content">\n`;
}

function activate() {
    return {
        extendMarkdownIt(md) {
            return md.use(container, 'answer', {
                validate: (params) => /^answer(\s|$)/.test(params.trim()) || params.trim() === 'answer',
                render: (tokens, idx) =>
                    tokens[idx].nesting === 1 ? answerOpenTag(tokens[idx].info) : '</div></div>\n',
            });
        },
    };
}

module.exports = { activate };
