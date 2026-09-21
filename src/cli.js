#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { renderHtml } from './render.js';
import { createPrinter } from './pdf.js';

const HELP = `Usage: md2pdf <input.md> [options]

Convert a Markdown document to a styled PDF. Fenced ::: answer blocks
become outlined answer boxes; their contents are hidden unless --key.

Options:
  -o, --output <file>   Output PDF path (default: <input>.pdf, or
                        <input>-key.pdf with --key)
      --key             Answer-key mode: show ::: answer contents in ink blue
      --bw              Black-and-white palette (same as frontmatter palette: bw)
      --html            Also keep the intermediate HTML next to the PDF
  -w, --watch           Rebuild the PDF whenever the input file changes
      --format <size>   Page size: letter (default) or a4
      --margin <len>    Page margin (default: 0.75in)
      --no-page-numbers Omit the page-number footer
  -h, --help            Show this help

Worksheet syntax (see README.md):
  **1.** A stem         a bold number opens a question that will not split
                        across pages; it runs to the next stem or heading
  ::: choices inline key=B
  - an option           a Markdown list, lettered A. B. C. automatically;
  :::                   inline = one line, lower = a. b. c., key=B = circled in key
  ::: answer            an answer box: default height (1.4in)
  ::: answer 2in        explicit height (any CSS length)
  ::: answer 4          height of ~4 blank lines
  ::: answer none       no box; contents appear in the key only
  The answer goes here; it only appears with --key.
  :::
  :::: columns          side-by-side questions (outer fence is one colon longer)
  \newpage              a page break
`;

function fail(message) {
    console.error(`md2pdf: ${message}`);
    process.exit(1);
}

let args;
try {
    args = parseArgs({
        allowPositionals: true,
        options: {
            output: { type: 'string', short: 'o' },
            key: { type: 'boolean', default: false },
            bw: { type: 'boolean', default: false },
            html: { type: 'boolean', default: false },
            watch: { type: 'boolean', short: 'w', default: false },
            format: { type: 'string', default: 'letter' },
            margin: { type: 'string', default: '0.75in' },
            'no-page-numbers': { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false },
        },
    });
} catch (err) {
    fail(err.message);
}

if (args.values.help || args.positionals.length === 0) {
    console.log(HELP);
    process.exit(args.values.help ? 0 : 1);
}
if (args.positionals.length > 1) fail('expected exactly one input file');

const input = path.resolve(args.positionals[0]);
if (!fs.existsSync(input)) fail(`no such file: ${args.positionals[0]}`);

const stem = path.join(path.dirname(input), path.basename(input, path.extname(input)));
const output = args.values.output
    ? path.resolve(args.values.output)
    : `${stem}${args.values.key ? '-key' : ''}.pdf`;

/* The temp HTML lives next to the input so relative image paths in the
   markdown resolve when Chrome loads it over file://. */
const htmlPath = args.values.html
    ? `${output.replace(/\.pdf$/i, '')}.html`
    : path.join(path.dirname(input), `.md2pdf-${process.pid}.html`);
const pdfOptions = {
    format: args.values.format,
    margin: args.values.margin,
    pageNumbers: !args.values['no-page-numbers'],
};

async function build(printer) {
    const source = fs.readFileSync(input, 'utf8');
    const html = renderHtml(source, {
        key: args.values.key,
        palette: args.values.bw ? 'bw' : undefined,
        fallbackTitle: path.basename(input, path.extname(input)),
    });
    fs.writeFileSync(htmlPath, html);
    try {
        await printer.print(htmlPath, output, pdfOptions);
    } finally {
        if (!args.values.html) fs.rmSync(htmlPath, { force: true });
    }
}

const printer = createPrinter();
try {
    await build(printer);
} catch (err) {
    await printer.close();
    fail(err.message);
}
console.log(`wrote ${path.relative(process.cwd(), output)}`);
if (args.values.html) console.log(`wrote ${path.relative(process.cwd(), htmlPath)}`);

if (!args.values.watch) {
    await printer.close();
    process.exit(0);
}

/* Watch the input's directory rather than the file: editors that save via
   atomic rename (vim, some formatters) replace the inode, which silently
   detaches a watcher pointed at the file itself. Filtering by basename also
   keeps our own temp-HTML and PDF writes from retriggering builds. */
console.log(`watching ${path.relative(process.cwd(), input)} (ctrl-c to stop)`);
let timer = null;
let building = false;
let dirty = false;

async function rebuild() {
    if (building) {
        dirty = true;
        return;
    }
    building = true;
    try {
        await build(printer);
        console.log(`[${new Date().toLocaleTimeString()}] rebuilt ${path.relative(process.cwd(), output)}`);
    } catch (err) {
        console.error(`md2pdf: ${err.message}`);
    }
    building = false;
    if (dirty) {
        dirty = false;
        rebuild();
    }
}

fs.watch(path.dirname(input), (eventType, filename) => {
    if (filename !== path.basename(input)) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 150);
});

process.on('SIGINT', async () => {
    await printer.close();
    process.exit(0);
});
