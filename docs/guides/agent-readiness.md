---
title: Agent readiness
group: AI
summary: How easily AI browsers and assistants can read and use your site: named controls, structured data, llms.txt and page size.
order: 23
tryIt: /charts/users
metric: agentReadiness
---

## What it is

Agent readiness is a 0–100 score for how well an AI assistant or AI browser can understand and operate your page.

Agents do not see pixels; they read the accessibility tree, the names on buttons and links, structured data (JSON-LD) and, if present, `/llms.txt`. Missing names make them guess, and guessing fails.

## Why it matters

A growing share of visits come from assistants that shop, book and research on behalf of people. A page they cannot use is a page they skip. The same fixes also help screen-reader users and search engines.

## Use case

- Shops, booking and comparison sites.
- Documentation that assistants should be able to cite.
- Any site with icon-only buttons.

## How it helps your app

Works for the new wave of AI visitors, and is more accessible for everyone. The demo shop scores 85: every control has a name and `/llms.txt` exists, but there is no structured data, which costs 15 points.

## Good, needs work, poor

| Good | Needs work | Poor |
| ---- | ---------- | ---- |
| ≥ 80 | 50 – 79    | < 50 |

## How to do it in PerfAgent, step by step

1. **Globe:** the score is collected on the first run of every scan; click the **Agents** chip.
2. **Charts:** **Users & places → Can AI assistants use your site?** shows the gauge and the missing items.
3. **Globe:** open the problem to see the notes: controls without a name, missing JSON-LD, no `/llms.txt`, no `<main>`, no headings, or a very long page.
4. **Editor:** fix the named items: `aria-label` on icon buttons, `alt` on images, JSON-LD for products and articles, a `/llms.txt` that describes the site.
5. **Globe:** **Re-test** to see the new score.

## Expert detail

- Collected by `collectReadiness` (`packages/collectors/src/readiness.ts`) on the first run: counts `button, a[href], [role=button], input, select, textarea` without an accessible name (`aria-label`, `aria-labelledby`, `title`, text, a labelled input, or an `img[alt]` child), images without `alt`, presence of `script[type="application/ld+json"]`, `h1`/`h2` count, `main` landmark, text length, and a `GET /llms.txt` that returns a text content type.
- Score: start at 100; − up to 45 for the share of unnamed controls; − 2 per image without `alt` (max 15); − 15 without JSON-LD; − 10 without `/llms.txt`; − 5 without `<main>`; − 10 without headings; − 10 when the page text is over about 8,000 tokens (text length ÷ 4).
- Report fields: `readiness { score, missingLabels, interactiveWithoutName, hasLlmsTxt, hasStructuredData, pageTokens, notes[] }` and `page.features.agentReadiness`.
- Rule: `agents/readiness-low` fires under 70 with the count of unnamed controls in the chain.
- This is a heuristic, not a standard; it is labelled "estimate" and the notes list is the actionable part.

## Walkthrough

```walkthrough
[
  { "screen": "charts", "area": "chart-4", "title": "Can AI assistants use your site?", "text": "A gauge with the score and the missing items." },
  { "screen": "globe", "area": "chips", "title": "Agents chip", "text": "The readiness problem with its notes." },
  { "screen": "globe", "area": "deep-dive", "title": "What is missing", "text": "No structured data (JSON-LD) on the demo shop: 15 points." },
  { "screen": "editor", "area": "editor-line", "title": "Add names and data", "text": "aria-label on icon buttons, JSON-LD for products, a /llms.txt file." }
]
```

## Learn more

- [llms.txt](https://llmstxt.org)
- [MDN: Accessible name](https://developer.mozilla.org/docs/Glossary/Accessible_name)
- [schema.org: Getting started with JSON-LD](https://schema.org/docs/gs.html)

## हिन्दी

**यह क्या है:** एजेंट रेडीनेस 0–100 का स्कोर है जो बताता है कि AI असिस्टेंट या AI ब्राउज़र आपके पेज को कितनी आसानी से समझ और इस्तेमाल कर सकता है। एजेंट पिक्सेल नहीं, बटनों के नाम, स्ट्रक्चर्ड डेटा और `/llms.txt` पढ़ते हैं।

**उपयोग:** दुकानें, बुकिंग साइटें, दस्तावेज़, या सिर्फ़ आइकन वाले बटनों वाली कोई भी साइट।

## मराठी

**हे काय आहे:** एजंट रेडीनेस हा 0–100 स्कोअर आहे जो सांगतो की AI असिस्टंट किंवा AI ब्राउझर तुमचे पान किती सहज समजू आणि वापरू शकतो. एजंट पिक्सेल नाही तर बटणांची नावे, स्ट्रक्चर्ड डेटा आणि `/llms.txt` वाचतात.

**वापर:** दुकाने, बुकिंग साइट, दस्तऐवज, किंवा फक्त आयकॉन असलेली बटणे असलेली कोणतीही साइट.
