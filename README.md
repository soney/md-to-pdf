# md-to-pdf

Convert Markdown documents (worksheets, handouts, exams) to styled PDFs.
The look mirrors [spot-web](https://github.com/soney/spot-web): Alegreya
serif, near-black text on white, U-M blue links, warm-grey secondary text,
hairline rules.

## Usage

```
node src/cli.js input.md            # → input.pdf
node src/cli.js input.md --key      # → input-key.pdf, answers filled in
```

Or link it once (`npm link`) and use `md2pdf` anywhere.

| Option | Effect |
| --- | --- |
| `-o, --output <file>` | Output path (default `<input>.pdf`, `<input>-key.pdf` with `--key`) |
| `--key` | Show `::: answer` contents, in ink blue, and circle each `key=` choice |
| `--bw` | Black-and-white palette (same as `palette: bw` in the frontmatter) |
| `--html` | Keep the intermediate HTML next to the PDF |
| `-w, --watch` | Rebuild the PDF whenever the input file changes |
| `--format <size>` | `letter` (default) or `a4` |
| `--margin <len>` | Page margin, default `0.75in` |
| `--no-page-numbers` | Omit the footer |

## Answer boxes

A fenced `::: answer` block becomes a box with a faint grey outline and a
faint "answer" label in the bottom-right corner. Whatever you write inside
is hidden on the worksheet and revealed by `--key`:

```markdown
::: answer
Hidden until --key.
:::

::: answer 2in       ← any CSS length
:::

::: answer 4         ← ~4 blank lines tall
:::
```

## Questions

A paragraph that opens with a bold number (`**1.**`, `**7a.**`, `**Q3.**`)
starts a question. Everything up to the next such paragraph, heading,
horizontal rule or page break is kept on one page with it, so a stem is
never orphaned from its code block, options or answer box. Set
`group_questions: false` in the frontmatter to turn this off, or wrap a stem
the rule does not recognise in `::: question` ... `:::`.

## Multiple choice

`::: choices` wraps a Markdown list and letters it A. B. C. for you:

```markdown
**3.** What is the value of `"100" + "406"`?

::: choices inline key=C
- `506`
- `"506"`
- `"100406"`
- Python raises an error.
:::

::: answer none
**C.** Both operands are strings, so `+` joins them.
:::
```

| Option | Effect |
| --- | --- |
| `inline` | Options run along one line instead of one per line |
| `lower` | Letter a. b. c. instead of A. B. C. |
| `key=C` | Circle C when rendering with `--key`; nothing shows otherwise |

`::: answer none` draws no box on the worksheet and prints its contents,
unboxed and inked, in the key. That is where a multiple-choice explanation
or a grading note goes. An unknown option renders a red error box rather
than failing silently.

## Layout

`:::: columns` lays its questions out side by side (`:::: columns 3` for
three). Because it contains other fenced blocks, its own fence is one
colon longer:

```markdown
:::: columns

**8.** `d["name"]`

::: answer 0.5in
:::

**9.** `d["year"]`

::: answer 0.5in
:::

::::
```

`\newpage` on a line by itself forces a page break.

## Frontmatter

YAML frontmatter builds the title block; `subtitle`, `author`, and `date`
are joined with " · " under the title. Three more keys switch rendering:

```markdown
---
title: "Event-Driven Programming: Practice"
subtitle: SI 379
author: Steve Oney
date: September 1, 2026
palette: bw          # black text, rules, boxes and key ink, for photocopies
density: compact     # tighter spacing around headings, code and boxes
group_questions: false   # do not auto-wrap bold-numbered stems
---
```

## Preview in VS Code

```
npm run vscode:install
```

then reload VS Code windows ("Developer: Reload Window"). This links a
small local extension ([vscode-extension/](vscode-extension/)) into your
VS Code extensions folder(s). It hooks the **built-in** markdown preview
(`Ctrl+Shift+V` / `Ctrl+K V`), so worksheets render live as you type with
the same Alegreya styling, answer boxes, lettered choices and columns as
the PDF; the plugin is one file, `src/worksheet.cjs`, that the install
script copies in, so re-run it after updating. Unlike the
worksheet PDF, the preview always shows answer contents (inked blue),
since that's what you're writing. Math previews too — VS Code's built-in
KaTeX support uses the same `$...$` syntax.

Re-run the script after changing the extension; it re-vendors fonts and
markdown-it-container so the folder is self-contained.

The preview mirrors styling but not pagination. For a true-fidelity check,
run `md2pdf worksheet.md --watch` in a terminal and keep the PDF open in a
viewer that auto-reloads (evince/okular do; so does a VS Code PDF
extension) — every save regenerates it in about a second.

## Also supported

- Syntax highlighting in fenced code blocks (highlight.js)
- Math with `$...$` / `$$...$$` (KaTeX)
- Relative image paths (resolved from the .md file's directory)
- Tables, blockquotes, typographer quotes/dashes

See [examples/worksheet.md](examples/worksheet.md) for a full example
(`npm run example` regenerates its PDFs).
