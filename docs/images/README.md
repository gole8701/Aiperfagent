# Screenshots

The README shows these images. They are real captures of the dashboard scanning `fixtures/demo-shop`; never draw or edit them.

| File              | Screen                                    | Route                              |
| ----------------- | ----------------------------------------- | ---------------------------------- |
| `globe.jpg`       | 3D globe with score, vitals and chips     | `/`                                |
| `deep-dive.jpg`   | Deep dive on the lazy hero image          | `/issues/general/lcp-image-lazy@…` |
| `flow.jpg`        | Flow diagram opened at `src/components`   | `/flow/src/components`             |
| `charts.jpg`      | Charts, Overview tab                      | `/charts/overview`                 |
| `compare.jpg`     | Compare, lowest vs highest project scan   | `/compare`                         |
| `guide.jpg`       | LCP guide, diagram paused after the paint | `/guide/lcp`                       |
| `settings-ai.jpg` | AI connections with Cursor picked         | `/settings/ai`                     |

## How to capture

1. Build and start: `pnpm build`, then `pnpm demo` in one terminal and `node packages/cli/dist/bin.js --root fixtures/demo-shop --no-open` in another. Note the token in the printed URL.
2. Scan at least twice from the dashboard so Compare has two project scans.
3. Run `PERFAGENT_TOKEN=<token> node docs/images/capture.mjs`. It uses your installed Chrome at 1440×900, 2× pixels, dark theme, and overwrites the `.jpg` files here.
4. Look at every image before committing: no other sites, names, emails, tokens or paths outside the project.
