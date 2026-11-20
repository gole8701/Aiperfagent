# @perfagent/agent

A real-user snippet (5–6 KB minified, no dependencies) that reports Web Vitals, every fetch/XHR, WebSocket traffic, long tasks, JS errors, memory, soft navigations and browser-side AI calls to your local PerfAgent dashboard.

## Script tag

```html
<script
  src="http://127.0.0.1:4545/agent/perfagent.js"
  data-endpoint="http://127.0.0.1:4545/agent/collect"
  data-sample="1"
  data-route="/checkout"
  defer
></script>
```

- `data-endpoint`: where batches go (default `http://127.0.0.1:4545/agent/collect`). The dashboard accepts posts only from the origins in `config.urls` / `config.environments`.
- `data-sample`: share of sessions that report, 0–1 (default 1, use ~0.1 in production).
- `data-route`: route label; defaults to `location.pathname` (without query string).

### Subresource integrity

When you self-host the file, pin it:

```bash
openssl dgst -sha384 -binary perfagent.js | openssl base64 -A
```

```html
<script src="/static/perfagent.js" integrity="sha384-<hash>" crossorigin="anonymous" defer></script>
```

The hash changes with every PerfAgent release; the dashboard's own `/agent/perfagent.js` is served with `Cache-Control: public, max-age=3600` and is not meant for SRI pinning.

## npm

```bash
npm i @perfagent/agent
```

```ts
import { init } from '@perfagent/agent'
init({ endpoint: 'http://127.0.0.1:4545/agent/collect', sample: 0.1, route: '/checkout' })
```

## What it collects

| Event   | Fields                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `vital` | `name` (lcp, inp, cls, fcp, ttfb), `value`, `target` (CSS selector of the element)                                                   |
| `req`   | `url` (no query string or hash), `method`, `status`, `ms`, `size`                                                                    |
| `ai`    | fetches to known AI hosts: `firstTokenMs` from the first streamed chunk, `ms`, `model`, token counts when the response carries usage |
| `ws`    | per connection: open latency, messages and bytes in/out, reconnect count by URL                                                      |
| `task`  | long task duration                                                                                                                   |
| `err`   | error message and the top stack frame                                                                                                |
| `mem`   | `performance.memory` heap in MB, once per batch                                                                                      |
| `nav`   | soft navigation target path                                                                                                          |

## Privacy and safety

No cookies, no credentials (`credentials: 'omit'`), no query strings, no form values, no personal data. Every hook is wrapped so a failure inside the snippet never reaches your page. Batches go out with `navigator.sendBeacon` (fallback `fetch keepalive`) every 5 s and on `visibilitychange`/`pagehide`; when the collector is down nothing is retried more than once a minute.
