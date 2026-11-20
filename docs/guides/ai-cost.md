---
title: AI cost
group: AI
summary: What AI calls cost per request, per day and per user, how much of the prompt is reused from cache, and where to save.
order: 22
tryIt: /charts/ai
metric: aiCostUsd
---

## What it is

AI cost is the money spent on AI calls, worked out from input and output tokens times the model's price.

Next to it sits the cache hit rate: the share of the prompt that the provider served from cache instead of processing again. A high hit rate means cheaper and faster calls.

## Why it matters

AI bills grow with traffic and with prompt size, silently. A long system prompt, a whole chat history re-sent each turn, or the biggest model used for a yes/no question can multiply the bill without anyone noticing.

## Use case

- Budgeting an AI feature before launch.
- A bill that jumped after a change.
- Choosing a model for a simple task (classification, extraction, labels).

## How it helps your app

Lower bills and no surprises. On the demo shop, `ai/no-prompt-cache` flags the 9,800-token product guide sent uncached on every call and estimates 50–60 % less cost per message with `cache_control`.

## Good, needs work, poor

| Metric            | Good                    | Needs work      | Poor        |
| ----------------- | ----------------------- | --------------- | ----------- |
| AI cost           | within your budget line | near the budget | over budget |
| AI cache hit rate | ≥ 70 %                  | 30 – 70 %       | < 30 %      |

## How to do it in PerfAgent, step by step

1. **Settings:** set `ai.budgetUsdPerDay` so the cost chart shows the budget line.
2. **Charts:** **AI → How much does AI cost per day (vs budget)?** and **What do you pay for in one AI request (tokens)?**.
3. **Charts:** **How often is AI work reused (cache)?** is the cache hit gauge.
4. **Globe:** click the **AI cost** chip for static findings: uncached prompts, oversized context, model overkill, missing output limits, agent loops without limits, offline jobs that could use the batch API.
5. **Globe:** apply the fix and compare the next day's cost chart; add `aiCacheHitRate: 0.7` as a budget.

## Expert detail

- `costUsd` per sample = input tokens × input price + output tokens × output price − cached tokens × cache discount, from the price table in `@perfagent/ai`; shown as "estimate". Cached tokens come from the provider's usage fields (`cache_read_input_tokens` on Anthropic, `prompt_tokens_details.cached_tokens` on OpenAI).
- `aiCacheHitRate` = cached input tokens ÷ total input tokens over the window.
- Rules that target `aiCostUsd`: `ai/no-prompt-cache`, `ai/oversized-context` (whole history, files or `JSON.stringify(data)` in the prompt without trimming), `ai/model-overkill` (Opus/Sonnet/GPT-4-class model on a classify/extract/label task), `ai/missing-max-tokens`, `ai/no-semantic-cache`, `ai/embed-in-loop`, `ai/huge-tool-list` (over 20 tool definitions passed on every call), `ai/agent-loop` (`while (true)` without a step limit), `ai/client-side-key` (critical: a key in browser code can be used by strangers at your cost), `ai/no-batch-for-offline`.
- The AI that PerfAgent itself uses for fixes has its own limits: `ai.monthlyBudgetUsd` (default 20), `ai.maxPerFixUsd` (0.2) and `fix.maxCostUsd` (5), tracked in `.perfagent/` and shown under **Settings → AI**.
- Comparing models: **AI → Which AI option is the best deal?** plots speed × quality × cost per model from your own measured calls.

## Learn more

- [Anthropic: Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Anthropic: Batch processing](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- [OpenAI: Prompt caching](https://platform.openai.com/docs/guides/prompt-caching)
- [OWASP: Secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

## हिन्दी

**यह क्या है:** AI लागत वह पैसा है जो AI कॉल पर खर्च होता है, टोकन की संख्या × मॉडल की कीमत से। कैश हिट रेट बताता है कि प्रॉम्प्ट का कितना हिस्सा दोबारा प्रोसेस किए बिना कैश से आया।

**उपयोग:** लॉन्च से पहले बजट बनाना, अचानक बढ़ा हुआ बिल, या आसान काम के लिए मॉडल चुनना।

## मराठी

**हे काय आहे:** AI खर्च म्हणजे AI कॉलवर खर्च होणारे पैसे, टोकनची संख्या × मॉडेलची किंमत. कॅश हिट रेट सांगतो की प्रॉम्प्टचा किती भाग पुन्हा प्रक्रिया न करता कॅशमधून आला.

**वापर:** लॉन्चपूर्वी बजेट ठरवणे, अचानक वाढलेले बिल, किंवा सोप्या कामासाठी मॉडेल निवडणे.
