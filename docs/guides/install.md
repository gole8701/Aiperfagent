---
title: Install & open the dashboard
group: Get started
summary: Add PerfAgent to a project and open the local dashboard in under a minute.
order: 1
tryIt: /
---

## What it is

PerfAgent is a tool you install in your project that opens a dashboard on your own computer.

It runs with `npx perfagent`. The dashboard is served from `127.0.0.1` with a secret token, so only you can open it. Nothing is uploaded anywhere.

## Why it matters

Most performance tools show numbers. PerfAgent shows the file and line behind each number, in plain language, and offers a fix. Installing it is the first step for everything else in this guide.

## Use case

- You have a website or web app and want to know why it feels slow.
- You want one place that shows page speed, code structure and AI call speed together.
- You want a non-technical teammate to read the same results in plain words.

## How it helps your app

After installing you get a scan of your pages and your code, a list of problems sorted by impact, and a dashboard you can share with your team by exporting a report.

## How to do it in PerfAgent, step by step

1. **Terminal:** open your project folder and run `npm i -D perfagent`.
2. **Terminal:** run `npx perfagent init`. It creates `perfagent.config.ts` and adds `.perfagent/` to `.gitignore`.
3. **Terminal:** run `npx perfagent`. The terminal prints `Dashboard: http://127.0.0.1:4545/?token=…` and opens your browser.
4. **Globe:** the home screen shows your project as a globe. Click **Scan** to measure the pages listed in `urls`.
5. **Guide:** press the **? Guide** button on any screen to come back here.

## Commands & config

```bash
npm i -D perfagent
npx perfagent init        # creates perfagent.config.ts
npx perfagent             # starts the dashboard at http://127.0.0.1:4545/?token=…
npx perfagent --help      # every command and option
```

```ts
// perfagent.config.ts (created by init)
import { defineConfig } from 'perfagent'

export default defineConfig({
  urls: ['http://localhost:3000'],
  root: '.',
  device: 'mobile',
  runs: 3,
})
```

Options on the command line: `--port 4545`, `--root .`, `--device mobile|desktop`, `--runs 3`, `--no-open`. Environment variables use the same names: `PERFAGENT_SERVER_PORT=5000`.

## Expert detail

- Requirements: Node.js 20 or newer. For `perfagent.config.ts` on Node 20–22 the `tsx` package must be installed; otherwise rename the file to `perfagent.config.js`. Node 23+ reads TypeScript config natively.
- Browser: PerfAgent uses the Google Chrome (or Edge) already on your machine through Playwright. If none is found, `npx playwright install chromium` downloads one.
- The server binds to `127.0.0.1` only and creates a fresh 32-byte token on every start. Requests without the token, or from another website, are rejected (`401` / `403`).
- Everything PerfAgent remembers lives in `.perfagent/` inside your project: `reports/`, `history.json`, `settings.json` and `audit.log`.
- The dashboard is a pre-built static app shipped inside the package. Your project does not need React or any other framework.
- Config load order: defaults → `perfagent.config.ts` → `PERFAGENT_*` environment variables → command-line flags.

## Learn more

- [web.dev: Web Vitals](https://web.dev/articles/vitals)
- [Playwright: Browsers](https://playwright.dev/docs/browsers)
- [Node.js: Running TypeScript natively](https://nodejs.org/en/learn/typescript/run-natively)

## हिन्दी

**यह क्या है:** PerfAgent एक टूल है जिसे आप अपने प्रोजेक्ट में इंस्टॉल करते हैं और जो आपके अपने कंप्यूटर पर एक डैशबोर्ड खोलता है। `npx perfagent` चलाइए; डैशबोर्ड `127.0.0.1` पर एक गुप्त टोकन के साथ खुलता है। कुछ भी कहीं अपलोड नहीं होता।

**उपयोग:** जब आपकी वेबसाइट धीमी लगे और आप जानना चाहें कि कौन सी फ़ाइल और लाइन इसकी वजह है।

## मराठी

**हे काय आहे:** PerfAgent हे एक साधन आहे जे तुम्ही तुमच्या प्रोजेक्टमध्ये इन्स्टॉल करता आणि जे तुमच्या स्वतःच्या संगणकावर डॅशबोर्ड उघडते. `npx perfagent` चालवा; डॅशबोर्ड `127.0.0.1` वर गुप्त टोकनसह उघडतो. काहीही कुठेही अपलोड होत नाही.

**वापर:** जेव्हा तुमची वेबसाइट हळू वाटते आणि कोणती फाइल व ओळ त्याला कारणीभूत आहे हे जाणून घ्यायचे असते.
