---
title: INP
group: Metrics
summary: Interaction to Next Paint is the delay between a tap, click or key press and the screen updating.
order: 12
tryIt: /charts/code
metric: inp
---

## What it is

INP (Interaction to Next Paint) is the time from a tap, click or key press until the screen shows a response.

It covers the whole visit, not just the load, and reports the slowest interaction (ignoring rare outliers). A high INP feels like "the app is laggy".

## Why it matters

Laggy forms, filters and menus make people retry, mistype and give up. INP replaced First Input Delay as a Core Web Vital because it measures what users feel throughout the visit.

## Use case

- Forms, coupon boxes, search-as-you-type, filters, menus.
- Pages that re-render large lists on every keystroke.
- After adding a heavy third-party script.

## How it helps your app

The app feels responsive instead of sluggish. On the demo shop, `CartSummary` subscribes to the whole cart context, so every character typed into the coupon box re-renders the full line list; PerfAgent points at `src/components/CartSummary.tsx` and suggests splitting the context and wrapping the list in `memo`.

## Good, needs work, poor

| Good     | Needs work      | Poor     |
| -------- | --------------- | -------- |
| ≤ 200 ms | 200 ms – 500 ms | > 500 ms |

## How to do it in PerfAgent, step by step

1. **Globe:** click the **INP** chip, or the **Re-renders** area chip.
2. **Globe:** open the problem. The chain shows the input, the component that re-renders and the hook line (`useCart()` / `useContext`).
3. **Charts:** **Code & files → Which parts of the screen redraw the most?** lists components by render count.
4. **Globe:** apply the fix: select only the slice of context the component needs, wrap the heavy child in `memo()`, compute derived lists with `useMemo`.
5. **Globe:** **Re-test**, then add `inp: 200` to the route's budget.

## Expert detail

- Measured with `PerformanceObserver({ type: 'event', durationThreshold: 16 })` and `interactionId`; the lab scan performs a scripted interaction, so a page with no interaction reports a low INP (16 ms on the demo shop home page). Field INP from real users (p75) is the number that matters for search; import it from CrUX or collect it with the agent snippet.
- Rules: `react/context-rerender` (component reads a context through `useContext` or a custom hook such as `useCart`, is not memoised, and renders a list or 12+ elements), `general/long-tasks` (tasks over 50 ms with the owning script from Long Animation Frames), `react/effect-without-cleanup` (leaked timers keep the main thread busy), `realtime/reconnect-no-backoff`.
- INP = input delay + processing time + presentation delay. Long tasks before the interaction raise the input delay; heavy handlers raise processing time; large layouts raise presentation delay.
- Long Animation Frames (`long-animation-frame`) give the script URL, function name and character position of the worst script in each frame; PerfAgent maps those to source when source maps are available.
- Fix patterns: `scheduler.yield()` or `setTimeout` to split work, `startTransition` for non-urgent updates, Web Workers for heavy computation, virtualised lists.

## Learn more

- [web.dev: Interaction to Next Paint](https://web.dev/articles/inp)
- [web.dev: Optimize INP](https://web.dev/articles/optimize-inp)
- [react.dev: memo](https://react.dev/reference/react/memo)
- [MDN: Long Animation Frames](https://developer.mozilla.org/docs/Web/API/Performance_API/Long_animation_frame_timing)

## हिन्दी

**यह क्या है:** INP (Interaction to Next Paint) टैप, क्लिक या की दबाने और स्क्रीन के जवाब देने के बीच की देरी है। यह पूरी विज़िट में सबसे धीमी प्रतिक्रिया बताता है।

**उपयोग:** फ़ॉर्म, कूपन बॉक्स, सर्च, फ़िल्टर और मेन्यू जो टाइप करते समय अटकते हैं।

## मराठी

**हे काय आहे:** INP (Interaction to Next Paint) म्हणजे टॅप, क्लिक किंवा की दाबल्यापासून स्क्रीन प्रतिसाद देईपर्यंतचा विलंब. तो संपूर्ण भेटीतील सर्वात हळू प्रतिसाद सांगतो.

**वापर:** फॉर्म, कूपन बॉक्स, शोध, फिल्टर आणि मेनू जे टाइप करताना अडखळतात.
