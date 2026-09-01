import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import matter from 'gray-matter';
import hljs from 'highlight.js';
import katex from '@vscode/markdown-it-katex';

const require = createRequire(import.meta.url);
const srcDir = path.dirname(fileURLToPath(import.meta.url));

/* Stylesheets linked by absolute file:// URL so the temp HTML can live
   anywhere (it is written next to the input .md so relative image paths
   resolve). Font files are pulled in by each fontsource CSS relative to
   itself, which file:// handles fine. */
const STYLESHEETS = [
    '@fontsource/alegreya/400.css',
    '@fontsource/alegreya/400-italic.css',
    '@fontsource/alegreya/700.css',
    '@fontsource/alegreya/700-italic.css',
    '@fontsource/jetbrains-mono/400.css',
    '@fontsource/jetbrains-mono/700.css',
    '@fontsource/inter/300.css',
    'highlight.js/styles/github.css',
    'katex/dist/katex.min.css',
].map((id) => pathToFileURL(require.resolve(id)).href);

/* `::: answer` fences. The rest of the info string may give a height:
   a CSS length ("2in", "6cm") or a bare number meaning that many blank
   lines. Anything between the fences is the answer, shown only in key
   mode. */
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

function makeMarkdownIt() {
    const md = new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true,
        highlight(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
            }
            return '';
        },
    });
    md.use(katex.default ?? katex);
    md.use(container, 'answer', {
        validate: (params) => /^answer(\s|$)/.test(params.trim()) || params.trim() === 'answer',
        render: (tokens, idx) =>
            tokens[idx].nesting === 1 ? answerOpenTag(tokens[idx].info) : '</div></div>\n',
    });
    return md;
}

const escapeHtml = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function headerBlock(data) {
    if (!data.title) return '';
    const meta = [data.subtitle, data.author, data.date]
        .filter(Boolean)
        .map(escapeHtml)
        .join(' · ');
    return [
        '<header class="doc-header">',
        `<h1 class="doc-title">${escapeHtml(data.title)}</h1>`,
        meta ? `<p class="doc-meta">${meta}</p>` : '',
        '</header>',
    ].filter(Boolean).join('\n');
}

/**
 * Render a markdown string to a complete HTML document.
 * @param {string} source raw markdown (may start with YAML frontmatter)
 * @param {{key?: boolean, fallbackTitle?: string}} options
 */
export function renderHtml(source, { key = false, fallbackTitle = 'Document' } = {}) {
    const { data, content } = matter(source);
    const md = makeMarkdownIt();
    const body = md.render(content);
    const title = data.title ? String(data.title) : fallbackTitle;
    const links = STYLESHEETS.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n');
    const style = fs.readFileSync(path.join(srcDir, 'style.css'), 'utf8');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}${key ? ' (answer key)' : ''}</title>
${links}
<style>
${style}
</style>
</head>
<body class="${key ? 'answer-key' : ''}">
${headerBlock(data)}
${body}
</body>
</html>
`;
}
