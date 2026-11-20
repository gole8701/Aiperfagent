---
title: Live mode & WebSocket
group: Live & locations
summary: Watch requests, latency, WebSocket traffic, reconnects and memory as they happen, from a browser you control or from real users.
order: 18
tryIt: /live
---

## What it is

Live mode shows what the page does every second while it runs: requests per second, p95 latency, WebSocket messages and bytes, reconnects, round-trip time and memory.

There are two sources. **Browser mode** opens the page in a browser PerfAgent controls and streams what the Chrome DevTools Protocol sees; no change to the site is needed. **Real-user mode** adds a small script (`@perfagent/agent`, under 8 KB, no cookies, no personal data) to the site and receives sampled events from visitors.

## Why it matters

Launches, incidents and live features (chat, prices, notifications) break in ways a one-off scan cannot see: a reconnect storm, a peak at 9 am, a leak after an hour.

## Use case

- A WebSocket feature that "sometimes" floods the server.
- Watching a launch or a campaign in real time.
- Confirming a memory fix by using the app for ten minutes.

## How it helps your app

Problems become visible within two seconds of happening, with the request or socket that caused them. On the demo shop, `socket.ts:11` reconnects immediately in `onclose`; stop the backend during a live session and the reconnect counter climbs in front of you.

## How to do it in PerfAgent, step by step

1. **Live:** open **Live** from the menu and enter the page URL, then press **Start**.
2. **Live:** use the page in the opened browser. The charts update every second; peaks above `live.peakThresholdP95Ms` are marked.
3. **Live:** watch **Is the live connection stable?** for WebSocket reconnects, messages per second and round-trip time.
4. **Live:** press **Stop**. The session is saved as a report (`Live session hh:mm`) so you can compare it later.
5. **Settings:** for real users, add the agent snippet to your site and set `live.sampleRate`.

## Commands & config

```html
<!-- Real-user agent (served by your local PerfAgent during development) -->
<script src="http://127.0.0.1:4545/agent/perfagent.js" async></script>
```

```ts
export default defineConfig({
  live: {
    sampleRate: 0.1, // share of real-user sessions that report
    windowSeconds: 60, // chart window
    peakThresholdP95Ms: 1500, // p95 latency that counts as a peak
  },
})
```

## Expert detail

- Browser mode (`packages/collectors/src/live.ts`): `Network.enable` + `Performance.enable`; events `requestWillBeSent`, `loadingFinished`, `webSocketCreated`, `webSocketClosed`, `webSocketFrameSent`, `webSocketFrameReceived`; a tick per second with `requestsPerSec`, `p95LatencyMs`, `wsMessagesPerSec`, `wsBytesPerSec`, `wsReconnects`, `wsRttMs`, `memoryMb`, the five slowest URLs and an optional `peak`.
- Ticks reach the dashboard as `{ type: 'live:tick', tick }` over the WebSocket at `/ws`, which needs the same token and origin check as the HTTP routes.
- Routes: `POST /api/live/start { url }` (SSRF-checked), `POST /api/live/stop` (returns `LiveStats` and saves a report), `GET /api/live/status`, `POST /api/agent/collect { events[] }` for the agent snippet (no auth needed, size-limited, up to 500 events per batch; it only broadcasts ticks).
- Rules: `realtime/reconnect-no-backoff` (static: `onclose`/`'close'` handler that reconnects without a growing delay), `realtime/large-messages` (WebSocket frames over 2 MB). Metrics: `wsReconnects` (good ≤ 2, poor > 10) and `wsMessagesPerSec`.
- The agent snippet collects Web Vitals, fetch/XHR timings, WebSocket frames, long tasks, errors, memory and browser-side AI calls; it is async, sampled and fail-silent, and never reads cookies or form values. Hosted collection for production traffic is _planned_; today the snippet reports to your local PerfAgent during development.
- Clustering of live traffic into named groups (`live.clusters`) is part of the report format; after **Stop**, the **Recorded session** card on **Live** lists the clusters.

## Walkthrough

```walkthrough
[
  { "screen": "live", "area": "url-box", "title": "Start", "text": "Enter the page URL and press Start. A controlled browser opens it." },
  { "screen": "live", "area": "chart-1", "title": "Every second", "text": "Requests, p95 latency and memory stream in; peaks are marked." },
  { "screen": "live", "area": "websocket-chart", "title": "WebSocket", "text": "Messages per second, bytes, RTT and reconnects. Stop the backend and watch the storm." },
  { "screen": "globe", "area": "deep-dive", "title": "The cause", "text": "socket.ts:11 reconnects instantly in onclose. The fix adds exponential backoff with jitter." },
  { "screen": "live", "area": "stop", "title": "Save", "text": "Stop saves the session as a report you can compare with the next one." }
]
```

## Learn more

- [MDN: Writing WebSocket client applications](https://developer.mozilla.org/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications)
- [Chrome DevTools Protocol: Network domain](https://chromedevtools.github.io/devtools-protocol/tot/Network/)
- [web.dev: web-vitals library](https://github.com/GoogleChrome/web-vitals)
