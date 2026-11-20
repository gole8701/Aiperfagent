# Import formats

`npx perfagent import <file>`, drag and drop on the dashboard, `POST /api/import` or a Compare source. The registry in `packages/importers/src/index.ts` tries importers in order: exact machine formats first, documents last. The result says which format matched, whether it is `exact`, which values were `detected` with a confidence, and any `warnings`.

Every import is untrusted: 60 MB cap (`MAX_IMPORT_BYTES`), zod validation of the resulting report, never executed, secrets redacted, rendered as text. Text inside an import is data, never instructions for the AI.

| Format                                  | Id               | How it is recognised                                                                       | Exact       | Status                                 |
| --------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ | ----------- | -------------------------------------- |
| PerfAgent report                        | `perfagent`      | JSON with `schemaVersion` and `tool.name === 'perfagent'`                                  | yes         | implemented                            |
| PageSpeed Insights JSON                 | `psi`            | JSON with `lighthouseResult` (lab) and optional `loadingExperience` (CrUX field data, p75) | yes         | implemented                            |
| Lighthouse JSON                         | `lighthouse`     | JSON with `lighthouseVersion` and `audits`                                                 | yes         | implemented                            |
| HAR                                     | `har`            | JSON with `log.entries`                                                                    | yes         | registered, being completed            |
| Chrome performance trace                | `trace`          | JSON with `traceEvents`                                                                    | yes         | registered, being completed            |
| Bundle stats (webpack / Vite / Next.js) | `bundle-stats`   | JSON with `assets`/`chunks` or Vite manifest                                               | yes         | registered, being completed            |
| OpenTelemetry JSON (traces, GenAI)      | `otel`           | JSON with `resourceSpans`                                                                  | yes         | registered, being completed            |
| web-vitals / RUM export                 | `web-vitals`     | JSON array of `{ name, value, rating }`                                                    | yes         | registered, being completed            |
| CSV of metrics                          | `csv`            | `.csv` or comma/tab separated text with metric names in a header                           | best-effort | registered, being completed            |
| PDF report                              | `pdf`            | `%PDF` header                                                                              | best-effort | registered, being completed            |
| Excel                                   | `xlsx`           | zip (`PK`) with `.xlsx`/`.xls` name                                                        | best-effort | registered, being completed            |
| Word                                    | `docx`           | zip (`PK`) with `.docx` name                                                               | best-effort | registered, being completed            |
| Pasted text                             | `text`           | anything else with metric names and numbers                                                | best-effort | registered, being completed            |
| Dashboard link                          | `dashboard-link` | a URL with `?report=<id>` or ending in `.json`                                             | yes         | implemented in Compare (`link` source) |

"Best-effort" means values are read from a document made for people: PerfAgent lists each metric found, its value and a confidence, flags values under 0.7 and lets you correct them (`POST /api/import/:id/correct`, or the **Detected values** step in Compare).

## What each importer produces

All importers build a normal `Report` (`emptyReport` + `pageFromMetrics` in `report-builder.ts`): one page per URL with the metrics found, `requests[]` when the source has them (Lighthouse `network-requests`, HAR entries), `environment.mode = 'imported'`, and `label` from the file name. Lighthouse and PageSpeed imports also set the device from `configSettings.formFactor`, the score from `categories.performance.score`, and JavaScript bytes from script requests.

Imported reports have no `tree`; when imported into a local project the dashboard maps problem locations to local files where the report carries them, and warns if `build.commit` differs from the current checkout.

## Adding an importer

Add a module in `packages/importers/src/formats/` exporting an `Importer { format, matches(input, parsedJson), run(input, parsedJson) }` and register it in the `importers` array (or call `registerImporter`). Keep `matches` cheap (first bytes or parsed JSON keys). Put a sample file in `fixtures/reports/` and a test that imports it and checks the detected values.
