import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import matter from 'gray-matter';
import hljs from 'highlight.js';
import katex from '@vscode/markdown-it-katex';
import worksheet from './worksheet.cjs';

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

function makeMarkdownIt({ groupQuestions }) {
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
    md.use(worksheet, { groupQuestions });
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

const PALETTES = new Set(['bw']);
const DENSITIES = new Set(['compact']);

/* Frontmatter keys the worksheet syntax reads, over and above the title
   block: `palette: bw`, `density: compact`, `group_questions: false`. A CLI
   flag (--bw) wins over the file. */
function bodyClasses(data, { key, palette }) {
    const classes = [];
    if (key) classes.push('answer-key');
    const wanted = palette ?? data.palette;
    if (wanted && !PALETTES.has(String(wanted))) throw new Error(`unknown palette "${wanted}" (try: bw)`);
    if (wanted) classes.push(`palette-${wanted}`);
    if (data.density && !DENSITIES.has(String(data.density))) {
        throw new Error(`unknown density "${data.density}" (try: compact)`);
    }
    if (data.density) classes.push(String(data.density));
    return classes.join(' ');
}

/**
 * Render a markdown string to a complete HTML document.
 * @param {string} source raw markdown (may start with YAML frontmatter)
 * @param {{key?: boolean, palette?: string, fallbackTitle?: string}} options
 */
export function renderHtml(source, { key = false, palette, fallbackTitle = 'Document' } = {}) {
    const { data, content } = matter(source);
    const md = makeMarkdownIt({ groupQuestions: data.group_questions !== false });
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
<body class="${bodyClasses(data, { key, palette })}">
${headerBlock(data)}
${body}
</body>
</html>
`;
}
