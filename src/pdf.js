import puppeteer from 'puppeteer';
import { pathToFileURL } from 'node:url';

const FOOTER = `
<div style="width:100%; text-align:center; font-family:Georgia,serif;
            font-size:9px; color:#000; padding-bottom:0.1in;">
  <span class="pageNumber"></span> / <span class="totalPages"></span>
</div>`;

async function launch() {
    try {
        return await puppeteer.launch();
    } catch {
        // Some Linux setups lack the kernel flags Chrome's sandbox needs.
        return await puppeteer.launch({ args: ['--no-sandbox'] });
    }
}

/**
 * A reusable printer that keeps the browser open between print() calls,
 * so watch mode doesn't pay the Chrome launch cost on every save. The
 * browser is (re)launched lazily, which also recovers from crashes.
 */
export function createPrinter() {
    let browser = null;
    return {
        async print(htmlPath, outPath, { format = 'letter', margin = '0.75in', pageNumbers = true } = {}) {
            if (!browser || !browser.connected) browser = await launch();
            const page = await browser.newPage();
            try {
                await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' });
                await page.evaluateHandle('document.fonts.ready');
                await page.pdf({
                    path: outPath,
                    format,
                    printBackground: true,
                    margin: { top: margin, right: margin, bottom: margin, left: margin },
                    displayHeaderFooter: pageNumbers,
                    headerTemplate: '<span></span>',
                    footerTemplate: FOOTER,
                });
            } finally {
                await page.close();
            }
        },
        async close() {
            if (browser) await browser.close();
            browser = null;
        },
    };
}

/** Print a single HTML file to PDF (one-shot; launches and closes Chrome). */
export async function htmlToPdf(htmlPath, outPath, options = {}) {
    const printer = createPrinter();
    try {
        await printer.print(htmlPath, outPath, options);
    } finally {
        await printer.close();
    }
}
