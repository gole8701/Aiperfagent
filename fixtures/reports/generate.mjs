// Regenerates report.pdf, report.xlsx and report.docx with known values so the
// document importers can be tested. Run from the repo root:
//   node fixtures/reports/generate.mjs
// Expected: /checkout LCP 3.4 s, INP 210 ms, CLS 0.12, TTFB 820 ms, score 72;
// /home LCP 1.9 s (Excel and Word only).
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(path.resolve('packages/importers/package.json'))
const { PDFDocument, StandardFonts } = require('pdf-lib')
const { Workbook } = require('exceljs')
const { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel } = require('docx')

const here = path.dirname(fileURLToPath(import.meta.url))
const CHECKOUT = [['Largest Contentful Paint', '3.4 s'], ['Interaction to Next Paint', '210 ms'], ['Cumulative Layout Shift', '0.12'], ['Time to First Byte', '820 ms'], ['Performance score', '72/100']]

async function pdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  let y = 790
  const line = (text, size = 12) => { page.drawText(text, { x: 50, y, size, font }); y -= size + 10 }
  line('Performance report: demo shop (mobile)', 18)
  line('Date: 2026-11-18')
  line('Page: /checkout', 14)
  for (const [label, value] of CHECKOUT) {
    page.drawText(label, { x: 50, y, size: 12, font })
    page.drawText(value, { x: 300, y, size: 12, font })
    y -= 22
  }
  await writeFile(path.join(here, 'report.pdf'), await doc.save())
}

async function xlsx() {
  const wb = new Workbook()
  const summary = wb.addWorksheet('Summary')
  summary.addRow(['Performance report', 'demo shop (mobile)'])
  summary.addRow(['Date', new Date('2026-11-18T00:00:00Z')])
  summary.addRow(['Page', '/checkout'])
  for (const [label, value] of CHECKOUT) summary.addRow([label, value])
  const pages = wb.addWorksheet('Pages')
  pages.addRow(['Page', 'LCP (s)', 'INP (ms)', 'CLS', 'TTFB (ms)', 'Score'])
  pages.addRow(['/checkout', 3.4, 210, 0.12, 820, 72])
  pages.addRow(['/home', 1.9, 140, 0.05, 410, 88])
  await writeFile(path.join(here, 'report.xlsx'), Buffer.from(await wb.xlsx.writeBuffer()))
}

async function docx() {
  const cell = (text) => new TableCell({ children: [new Paragraph(text)] })
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'Performance report: demo shop (mobile)', heading: HeadingLevel.HEADING_1 }),
        new Paragraph('Date: 2026-11-18'),
        new Paragraph({ text: 'Page: /checkout', heading: HeadingLevel.HEADING_2 }),
        ...CHECKOUT.map(([label, value]) => new Paragraph(`${label}: ${value}`)),
        new Paragraph({ text: 'All pages', heading: HeadingLevel.HEADING_2 }),
        new Table({
          rows: [
            new TableRow({ children: ['Page', 'LCP', 'CLS', 'TTFB'].map(cell) }),
            new TableRow({ children: ['/checkout', '3.4 s', '0.12', '820 ms'].map(cell) }),
            new TableRow({ children: ['/home', '1.9 s', '0.05', '410 ms'].map(cell) }),
          ],
        }),
      ],
    }],
  })
  await writeFile(path.join(here, 'report.docx'), await Packer.toBuffer(doc))
}

await Promise.all([pdf(), xlsx(), docx()])
