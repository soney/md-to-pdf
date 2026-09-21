'use strict';
/* The worksheet markdown-it plugin: every piece of syntax md-to-pdf adds on
   top of plain Markdown lives here, so the CLI renderer (src/render.js) and
   the VS Code preview (vscode-extension/extension.js, which loads the copy
   scripts/install-vscode-extension.sh makes) render exactly the same thing.

   Syntax, in the order a handout meets it:

     **1.** A question stem            paragraphs beginning with a bold number
                                       ("**1.**", "**7a.**", "**Q3.**") open a
                                       <div class="question"> that runs to the
                                       next stem, heading, rule or page break,
                                       so a question never splits across pages

     ::: choices [inline] [lower] [key=B]
     - first option                    a Markdown list, lettered A. B. C. by CSS;
     - second option                   `inline` puts them on one line, `lower`
     :::                               letters a. b. c., and `key=B` circles B
                                       in the answer key

     ::: answer [2in | 4 | none]       an answer box (unchanged); `none` draws
     :::                               no box for the student and prints the
                                       contents, unboxed, in the key

     ::: columns [N]                   a grid of N (default 2) equal columns;
     :::                               each question inside is one cell

     ::: question                      an explicit question wrapper, for a stem
     :::                               the bold-number rule does not recognise

     \newpage                          on a line by itself: a page break */
const container = require('markdown-it-container');

const HEIGHT_LENGTH = /^\d+(\.\d+)?(in|cm|mm|pt|px|em|rem)$/;
const HEIGHT_LINES = /^[1-9]\d*$/;
const QUESTION_STEM = /^\*\*Q?\d+[a-z]?\.[\s*]/;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const escapeHtml = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---- ::: answer -------------------------------------------------------- */

function answerOpenTag(info) {
    const arg = info.trim().replace(/^answer\s*/, '');
    if (arg === 'none' || arg === '0') {
        return '<div class="answer-note"><div class="answer-content">\n';
    }
    let style = '';
    if (HEIGHT_LENGTH.test(arg)) {
        style = ` style="min-height:${arg}"`;
    } else if (HEIGHT_LINES.test(arg)) {
        style = ` style="min-height:${Number(arg) * 1.6}em"`;
    }
    return `<div class="answer-box"${style}><div class="answer-content">\n`;
}

/* ---- ::: choices ------------------------------------------------------- */

function parseChoices(info) {
    const words = info.trim().replace(/^choices\s*/, '').split(/\s+/).filter(Boolean);
    const opts = { inline: false, lower: false, key: null, errors: [] };
    for (const word of words) {
        const m = /^key=([A-Za-z])$/.exec(word);
        if (word === 'inline') opts.inline = true;
        else if (word === 'stacked') opts.inline = false;
        else if (word === 'lower') opts.lower = true;
        else if (m) opts.key = m[1].toUpperCase();
        else opts.errors.push(word);
    }
    return opts;
}

function choicesOpenTag(token) {
    const opts = token.meta ?? parseChoices(token.info);
    const classes = ['choices', opts.inline && 'choices-inline', opts.lower && 'choices-lower']
        .filter(Boolean)
        .join(' ');
    const key = opts.key ? ` data-key="${opts.key}"` : '';
    const error = opts.errors.length
        ? `<p class="worksheet-error">::: choices: unknown option ${opts.errors.map(escapeHtml).join(', ')}</p>\n`
        : '';
    return `<div class="${classes}"${key}>\n${error}`;
}

/* Letter each list item inside a choices block, and mark the one `key=`
   names so the key can circle it. Runs as a core rule so the letters are
   attributes on the tokens, not a second pass over HTML. */
function letterChoices(tokens) {
    for (let i = 0; i < tokens.length; i++) {
        const open = tokens[i];
        if (open.type !== 'container_choices_open') continue;
        open.meta = parseChoices(open.info);
        let index = 0;
        for (let j = i + 1; j < tokens.length && tokens[j].level > open.level; j++) {
            const t = tokens[j];
            if (t.type !== 'list_item_open' || t.level !== open.level + 2) continue;
            const letter = LETTERS[index++] ?? '?';
            t.attrSet('data-letter', letter);
            if (letter === open.meta.key) t.attrJoin('class', 'choice-correct');
        }
    }
}

/* ---- \newpage ---------------------------------------------------------- */

function htmlBlock(state, html, level, meta) {
    const token = new state.Token('html_block', '', 0);
    token.content = html;
    token.level = level;
    token.block = true;
    if (meta) token.meta = meta;
    return token;
}

function replacePageBreaks(state) {
    const tokens = state.tokens;
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const isBreak =
            t.type === 'paragraph_open' &&
            tokens[i + 1]?.type === 'inline' &&
            tokens[i + 1].content.trim() === '\\newpage' &&
            tokens[i + 2]?.type === 'paragraph_close';
        if (isBreak) {
            out.push(htmlBlock(state, '<div class="page-break"></div>\n', t.level, { pageBreak: true }));
            i += 2;
        } else {
            out.push(t);
        }
    }
    state.tokens = out;
}

/* ---- question grouping ------------------------------------------------- */

/* Containers that lay questions out (columns, an explicit question) end the
   question before them; containers that belong to a question (answer,
   choices) do not. */
function isLayoutContainer(token) {
    return token.nesting === 1 && /^container_(columns|question)_open$/.test(token.type);
}

function isStem(tokens, i) {
    return (
        tokens[i].type === 'paragraph_open' &&
        tokens[i + 1]?.type === 'inline' &&
        QUESTION_STEM.test(tokens[i + 1].content)
    );
}

function groupQuestions(state) {
    const tokens = state.tokens;
    const out = [];
    let groupLevel = null; // level of the tokens inside the open group
    let manualLevel = null; // inside an explicit ::: question, do not auto-wrap

    const close = () => {
        out.push(htmlBlock(state, '</div>\n', groupLevel));
        groupLevel = null;
    };

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        if (manualLevel !== null && t.type === 'container_question_close' && t.level === manualLevel) {
            manualLevel = null;
        }

        if (groupLevel !== null) {
            const leaving = t.level < groupLevel;
            const boundary =
                t.level === groupLevel &&
                (t.type === 'heading_open' ||
                    t.type === 'hr' ||
                    isStem(tokens, i) ||
                    isLayoutContainer(t) ||
                    (t.type === 'html_block' && t.meta?.pageBreak));
            if (leaving || boundary) close();
        }

        if (groupLevel === null && manualLevel === null && isStem(tokens, i)) {
            groupLevel = t.level;
            out.push(htmlBlock(state, '<div class="question">\n', t.level));
        }

        if (manualLevel === null && t.type === 'container_question_open') manualLevel = t.level;

        out.push(t);
    }
    if (groupLevel !== null) close();
    state.tokens = out;
}

/* ---- the plugin -------------------------------------------------------- */

function simpleContainer(md, name, openTag) {
    md.use(container, name, {
        validate: (params) => new RegExp(`^${name}(\\s|$)`).test(params.trim()),
        render: (tokens, idx) => (tokens[idx].nesting === 1 ? openTag(tokens[idx]) : '</div>\n'),
    });
}

/**
 * @param {import('markdown-it')} md
 * @param {{groupQuestions?: boolean}} [options]
 */
function worksheet(md, { groupQuestions: group = true } = {}) {
    md.use(container, 'answer', {
        validate: (params) => /^answer(\s|$)/.test(params.trim()),
        render: (tokens, idx) =>
            tokens[idx].nesting === 1 ? answerOpenTag(tokens[idx].info) : '</div></div>\n',
    });
    simpleContainer(md, 'choices', choicesOpenTag);
    simpleContainer(md, 'question', () => '<div class="question">\n');
    simpleContainer(md, 'columns', (token) => {
        const n = token.info.trim().replace(/^columns\s*/, '');
        const style = /^[1-9]$/.test(n) ? ` style="--columns:${n}"` : '';
        return `<div class="columns"${style}>\n`;
    });

    md.core.ruler.push('worksheet', (state) => {
        replacePageBreaks(state);
        letterChoices(state.tokens);
        if (group) groupQuestions(state);
    });
}

module.exports = worksheet;
module.exports.answerOpenTag = answerOpenTag;
module.exports.parseChoices = parseChoices;
