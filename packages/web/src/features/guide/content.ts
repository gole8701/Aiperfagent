import type { IconName } from './Icon'

export type GuideGroup = 'Get started' | 'Explore' | 'Metrics' | 'Live' | 'AI'
export const GROUPS: GuideGroup[] = ['Get started', 'Explore', 'Metrics', 'Live', 'AI']

/** One step of "How to check it": a real screenshot and the control to point at (keys from shots.ts). */
export interface CheckStep {
  shot: string
  at: string
  text: string
}

export interface TestStep {
  text: string
  code?: string
}

export interface Cause {
  cause: string
  fix: string
  /** PerfAgent rule id that finds it. */
  rule?: string
}

export interface TopicContent {
  group: GuideGroup
  icon: IconName
  /** One line for the home card. */
  line: string
  /** One plain sentence. */
  what: string
  /** The same idea in everyday life. */
  analogy: string
  /** Why it matters to your users and your business. */
  why: string
  check: CheckStep[]
  test?: TestStep[]
  causes?: Cause[]
}

const SITE = 'https://your-site.com'
const scan: TestStep = {
  text: 'Measure any page. Run this in a terminal; no account is needed.',
  code: `npx perfagent scan ${SITE}`,
}
const config: TestStep = {
  text: 'Measure the same pages every time: list them in perfagent.config.ts, then run "npx perfagent scan" with no address.',
  code: `export default defineConfig({\n  urls: ['${SITE}', '${SITE}/checkout'],\n})`,
}
const ci = (budget: string): TestStep => ({
  text: 'Stop it getting worse: add a budget to the config and run the check in CI. It fails the pull request when a page goes over.',
  code: `budgets: { '/': { ${budget} } },\n\n# in CI\nnpx perfagent ci`,
})
const metricTest = (budget: string | undefined, devtools: string): TestStep[] => [
  scan,
  config,
  ...(budget ? [ci(budget)] : []),
  { text: `Prefer Chrome DevTools? ${devtools}` },
]

export const TOPICS: Record<string, TopicContent> = {
  install: {
    group: 'Get started',
    icon: 'start',
    line: 'Install PerfAgent and open this dashboard.',
    what: 'PerfAgent is a tool you install in your project; it opens this dashboard on your own computer.',
    analogy:
      'Like a car diagnostic tool you plug in at home: it reads the engine and tells you what to fix.',
    why: 'Everything stays on your machine, so you can test private and unfinished pages safely.',
    check: [
      {
        shot: 'home',
        at: 'score',
        text: 'After the first scan, the home screen shows your score here.',
      },
      {
        shot: 'home',
        at: 'vitals',
        text: 'The main speed numbers sit underneath, each with a colour badge.',
      },
      {
        shot: 'home',
        at: 'guide',
        text: 'Stuck on any screen? The ? button opens the guide for that screen.',
      },
    ],
    test: [
      { text: 'Add PerfAgent to your project.', code: 'npm i -D perfagent' },
      { text: 'Create the config file.', code: 'npx perfagent init' },
      { text: 'Open the dashboard. It prints a private link with a token.', code: 'npx perfagent' },
    ],
  },
  'scan-project': {
    group: 'Get started',
    icon: 'scan',
    line: 'Measure your pages and read your code in one go.',
    what: 'A scan opens your pages in a real browser, measures them, and reads your code to find the causes.',
    analogy:
      'Like a doctor who takes your temperature and also reads your history to explain the fever.',
    why: 'You get the problem and the exact file and line to change, not just a number.',
    check: [
      {
        shot: 'home',
        at: 'url',
        text: 'Type the address of your page here, for example http://localhost:3000.',
      },
      { shot: 'home', at: 'scan', text: 'Press Scan. It takes about a minute.' },
      {
        shot: 'home',
        at: 'problems',
        text: 'When it finishes, the count of problems found appears here.',
      },
      { shot: 'home-list', at: 'table', text: 'Scroll down for the full list, biggest win first.' },
    ],
    test: [
      { text: 'Scan the pages listed in your config.', code: 'npx perfagent scan' },
      { text: 'Scan one page of your project.', code: 'npx perfagent scan http://localhost:3000' },
      {
        text: 'Desktop instead of phone, and more runs for steadier numbers.',
        code: 'npx perfagent scan --device desktop --runs 5',
      },
    ],
  },
  'test-url': {
    group: 'Get started',
    icon: 'link',
    line: 'Test any website address, even without its code.',
    what: 'Paste any web address and PerfAgent measures it, without needing the code behind it.',
    analogy:
      'Like timing a competitor’s delivery: you cannot see their warehouse, but you can see how long it takes.',
    why: 'Check your live site, a staging link or a competitor in a minute.',
    check: [
      { shot: 'home', at: 'url', text: 'Paste the address of any page into this box.' },
      { shot: 'home', at: 'scan', text: 'Press Scan and wait about a minute.' },
      {
        shot: 'home',
        at: 'vitals',
        text: 'The speed numbers appear here. Code links only appear for your own project.',
      },
    ],
    test: [
      {
        text: 'Measure any public page without reading code.',
        code: `npx perfagent scan ${SITE} --no-project`,
      },
      {
        text: 'Save the result to compare later.',
        code: `npx perfagent scan ${SITE} --no-project --json > before.json`,
      },
    ],
  },
  'security-local-mode': {
    group: 'Get started',
    icon: 'shield',
    line: 'What stays on your machine and what never leaves.',
    what: 'In local mode PerfAgent runs only on your computer and only you can open the dashboard.',
    analogy: 'Like a home safe: the key (the token in the link) is printed only for you.',
    why: 'Your code, keys and reports are not uploaded anywhere unless you choose to.',
    check: [
      {
        shot: 'home',
        at: 'mode',
        text: 'The badge in the top bar says “local mode” while you work locally.',
      },
      {
        shot: 'settings-ai',
        at: 'free',
        text: 'Built-in rules and local AI work without sending code out.',
      },
      { shot: 'settings-fix', at: 'protected', text: 'List folders AI fixes must never touch.' },
    ],
  },
  'themes-export': {
    group: 'Get started',
    icon: 'palette',
    line: 'Dark, light or high contrast, and share a report.',
    what: 'Change how the dashboard looks, and export a report to share with your team.',
    analogy: 'Like printing a summary of your bank statement to show your accountant.',
    why: 'Share results in a pull request, a ticket or a meeting without giving anyone access.',
    check: [
      {
        shot: 'settings-display',
        at: 'theme',
        text: 'Pick Dark, Light or High contrast under Settings › Display.',
      },
      { shot: 'export', at: 'export', text: 'Press Export to open the list of formats.' },
      {
        shot: 'export',
        at: 'markdown',
        text: 'Markdown is ready to paste into a pull-request comment.',
      },
      { shot: 'export', at: 'html', text: 'A single HTML file opens anywhere, offline.' },
    ],
    test: [
      {
        text: 'Export the latest report from the terminal.',
        code: 'npx perfagent export latest --format md --out report.md',
      },
    ],
  },

  globe: {
    group: 'Explore',
    icon: 'globe',
    line: 'Your whole project as a globe; red dots are problems.',
    what: 'The globe shows every file of your project as a point; glowing red and amber points are problems.',
    analogy: 'Like a weather map: you see at a glance where the storms are.',
    why: 'You see where problems cluster before reading a single line.',
    check: [
      {
        shot: 'home',
        at: 'globe',
        text: 'Drag to turn the globe. Red points pulse: those are critical problems.',
      },
      {
        shot: 'home',
        at: 'globeControls',
        text: 'Use these buttons to rotate, zoom or reset the view.',
      },
      {
        shot: 'home',
        at: 'chips',
        text: 'Filter the globe by metric to see only one kind of problem.',
      },
      {
        shot: 'home-list',
        at: 'heroRow',
        text: 'Or click a problem in the list: the globe flies to it.',
      },
    ],
  },
  chips: {
    group: 'Explore',
    icon: 'filter',
    line: 'Filter problems by metric or by area with one click.',
    what: 'Chips are filter buttons: click one and only the problems of that kind stay lit.',
    analogy: 'Like the filters in an online shop: show only shoes in my size.',
    why: 'Focus on one goal at a time, for example only what slows the main picture.',
    check: [
      { shot: 'home', at: 'chips', text: 'Each chip shows how many problems it has.' },
      { shot: 'home', at: 'chipLcp', text: 'Click LCP to see only what delays the main content.' },
      {
        shot: 'home-list',
        at: 'areas',
        text: 'Chips by area group problems by kind: images, fonts, server…',
      },
      { shot: 'home-list', at: 'table', text: 'The list below follows the same filter.' },
    ],
  },
  'deep-dive': {
    group: 'Explore',
    icon: 'search',
    line: 'One problem fully explained, with the fix.',
    what: 'The deep dive is the panel that explains one problem: where it is, why it happens and how to fix it.',
    analogy:
      'Like a mechanic’s report: which part, why it broke, what it costs to fix, and what you gain.',
    why: 'You know exactly what to change and how much faster the page will be.',
    check: [
      {
        shot: 'home-list',
        at: 'heroRow',
        text: 'Click a problem in the list, or a glowing point on the globe.',
      },
      {
        shot: 'issue',
        at: 'where',
        text: 'Where: the file and line, with a button to open it in your editor.',
      },
      {
        shot: 'issue',
        at: 'chain',
        text: 'Evidence: the chain from the slow number down to the line of code.',
      },
      {
        shot: 'issue-fix',
        at: 'steps',
        text: 'How to fix: the steps, with the code before and after.',
      },
      {
        shot: 'issue-fix',
        at: 'retest',
        text: 'After fixing, press Re-test to check the gain was real.',
      },
    ],
  },
  'flow-diagram': {
    group: 'Explore',
    icon: 'flow',
    line: 'Folders, files and components as a map.',
    what: 'The flow diagram draws your project from folders to files to components, with problems marked in red.',
    analogy:
      'Like a family tree for your code: follow the red line to the relative causing trouble.',
    why: 'See which part of the code a problem lives in and what it is connected to.',
    check: [
      { shot: 'flow', at: 'search', text: 'Type a file or component name to find it.' },
      {
        shot: 'flow',
        at: 'node',
        text: 'Click a box to open it. A red border means a problem inside.',
      },
      { shot: 'flow', at: 'problemsOnly', text: 'Tick “Problems only” to hide healthy files.' },
      {
        shot: 'flow',
        at: 'details',
        text: 'The side panel lists the problems inside, each with a link to its deep dive.',
      },
    ],
  },
  'open-in-editor': {
    group: 'Explore',
    icon: 'code',
    line: 'Jump from a problem to the exact line in your editor.',
    what: 'Open in editor opens the file of a problem in VS Code, Cursor or your usual editor, at the exact line.',
    analogy: 'Like a map pin that opens the street view at the right door.',
    why: 'No searching through files: one click and you are at the line to change.',
    check: [
      { shot: 'home-list', at: 'heroRow', text: 'Open a problem from the list.' },
      { shot: 'issue', at: 'editor', text: 'Press “Open in editor at this line”.' },
      {
        shot: 'settings-display',
        at: 'editor',
        text: 'Pick which editor opens under Settings › Display.',
      },
    ],
  },
  charts: {
    group: 'Explore',
    icon: 'chart',
    line: 'Every number as a simple chart in plain words.',
    what: 'The Charts view explains your performance with simple charts and one plain sentence each.',
    analogy: 'Like a health check-up summary: the doctor’s notes, but in words you understand.',
    why: 'Share it with anyone; no technical knowledge needed.',
    check: [
      { shot: 'home', at: 'navCharts', text: 'Open Charts in the top bar.' },
      {
        shot: 'charts',
        at: 'summary',
        text: 'Start with this summary: what is wrong and what to do first.',
      },
      { shot: 'charts', at: 'bars', text: 'Longer bar = more points you win by fixing it.' },
      {
        shot: 'charts',
        at: 'tabs',
        text: 'The tabs group charts by topic: speed, code, network, AI…',
      },
      { shot: 'charts', at: 'pdf', text: 'Export the charts as a PDF for a meeting.' },
    ],
  },
  'retest-compare': {
    group: 'Explore',
    icon: 'compare',
    line: 'Measure again and see before versus after.',
    what: 'Re-test measures one problem again after your change; Compare puts two scans side by side.',
    analogy: 'Like weighing yourself before and after a diet, on the same scale.',
    why: 'Prove a fix worked before you ship it, with real numbers.',
    check: [
      {
        shot: 'issue-fix',
        at: 'retest',
        text: 'In a problem’s deep dive, press Re-test to verify.',
      },
      { shot: 'home', at: 'navCompare', text: 'Open Compare in the top bar.' },
      { shot: 'compare', at: 'modes', text: 'Pick Before vs after, Page vs page, or Many pages.' },
      { shot: 'compare', at: 'compare', text: 'Choose two scans and press Compare.' },
    ],
    test: [
      {
        text: 'Compare two saved scans by their ids.',
        code: 'npx perfagent compare <before-id> <after-id>',
      },
    ],
  },
  'budgets-ci': {
    group: 'Explore',
    icon: 'ci',
    line: 'Fail a pull request when a page gets slower.',
    what: 'A budget is a limit, such as “LCP under 2.5 s”; CI checks it on every pull request.',
    analogy: 'Like a spending limit on a card: the payment is refused when you go over.',
    why: 'Speed does not slip back quietly after you fixed it.',
    check: [
      {
        shot: 'issue-fix',
        at: 'budget',
        text: 'Each problem suggests a budget under “Stop it coming back”.',
      },
      { shot: 'settings-display', at: 'urls', text: 'Budgets and pages are saved in your config.' },
      { shot: 'charts', at: 'summary', text: 'Check the score and metrics you want to protect.' },
    ],
    test: [
      {
        text: 'Add budgets per page to perfagent.config.ts.',
        code: "budgets: {\n  '/': { score: 85, lcp: 2500, cls: 0.1, js: '200kb' },\n}",
      },
      {
        text: 'Run the check. It exits with an error when a budget is over.',
        code: 'npx perfagent ci',
      },
      {
        text: 'Write the pull-request comment too.',
        code: 'npx perfagent ci --comment comment.md',
      },
    ],
  },
  'fix-production-locally': {
    group: 'Explore',
    icon: 'cloud',
    line: 'Scan your live site, fix it on your machine.',
    what: 'Scan the deployed site, bring the report home, and fix the problems in your local code.',
    analogy: 'Like a photo of a leak sent to the plumber, who then fixes the pipe in the workshop.',
    why: 'Production is where users are; your machine is where you can change things safely.',
    check: [
      { shot: 'export', at: 'json', text: 'Reports export as JSON that can be imported again.' },
      { shot: 'compare', at: 'testUrl', text: 'Or test the live address right inside Compare.' },
      { shot: 'compare', at: 'compare', text: 'Compare the live scan with your local one.' },
    ],
    test: [
      {
        text: 'On any machine: scan the live site.',
        code: `npx perfagent scan ${SITE} --no-project --json > perfagent-report.json`,
      },
      {
        text: 'On your machine: import it and open the dashboard.',
        code: 'npx perfagent import ./perfagent-report.json',
      },
    ],
  },

  score: {
    group: 'Metrics',
    icon: 'gauge',
    line: 'One 0–100 number for how fast the page feels.',
    what: 'The performance score sums up the main speed numbers into one grade from 0 to 100.',
    analogy: 'Like a school report average: several subjects, some count more than others.',
    why: 'An easy number to track and share. Most speed problems also lower sales and search ranking.',
    check: [
      {
        shot: 'home',
        at: 'score',
        text: 'Your score, and the score you could reach after all fixes.',
      },
      {
        shot: 'home',
        at: 'vitals',
        text: 'The metrics that make up the score, each with its colour.',
      },
      { shot: 'charts', at: 'bars', text: 'Which fixes win the most points.' },
    ],
    test: metricTest('score: 85', 'Open DevTools › Lighthouse › Performance › Analyze page load.'),
    causes: [
      {
        cause: 'The main picture loads late',
        fix: 'Load it first, never lazily',
        rule: 'general/lcp-image-lazy',
      },
      {
        cause: 'Too much JavaScript',
        fix: 'Split code and drop unused libraries',
        rule: 'general/big-javascript',
      },
      {
        cause: 'Outside scripts block the page',
        fix: 'Load them with async or defer',
        rule: 'general/blocking-third-party',
      },
    ],
  },
  lcp: {
    group: 'Metrics',
    icon: 'image',
    line: 'When the main picture or heading is on screen.',
    what: 'LCP (Largest Contentful Paint) is the time until the biggest picture or heading appears.',
    analogy: 'Like a restaurant: the bread came fast, but LCP is when your main dish arrives.',
    why: 'It is when people feel the page has loaded. Slow LCP makes them leave, and Google ranks it.',
    check: [
      {
        shot: 'home',
        at: 'lcp',
        text: 'Read your LCP here, with a Good, Needs work or Poor badge.',
      },
      { shot: 'home', at: 'chipLcp', text: 'Click the LCP chip to see only what delays it.' },
      {
        shot: 'charts-speed',
        at: 'filmstrip',
        text: 'See it second by second: the frame where the main picture appears is LCP.',
      },
      {
        shot: 'issue',
        at: 'chain',
        text: 'Open a problem: the chain names the element, e.g. the hero image, and its line.',
      },
      { shot: 'issue-fix', at: 'retest', text: 'After the fix, Re-test to see the new LCP.' },
    ],
    test: metricTest(
      'lcp: 2500',
      'Open DevTools › Performance, press the reload button and look for the LCP marker in the Timings row.',
    ),
    causes: [
      {
        cause: 'The main picture is lazy-loaded',
        fix: 'Remove loading="lazy", add fetchpriority="high"',
        rule: 'general/lcp-image-lazy',
      },
      {
        cause: 'Next.js image without priority',
        fix: 'Add the priority prop to the hero image',
        rule: 'next/image-priority',
      },
      {
        cause: 'The server is slow to answer',
        fix: 'Cache the page or the data',
        rule: 'general/slow-ttfb',
      },
      {
        cause: 'Large CSS blocks the first paint',
        fix: 'Remove unused CSS',
        rule: 'general/unused-css',
      },
    ],
  },
  inp: {
    group: 'Metrics',
    icon: 'tap',
    line: 'How long the screen takes to react to a tap.',
    what: 'INP (Interaction to Next Paint) is the delay between a tap or click and the screen changing.',
    analogy: 'Like a lift button: you press it, and INP is how long before the light comes on.',
    why: 'Slow reactions feel broken. People tap twice, give up, or leave the checkout.',
    check: [
      { shot: 'home', at: 'inp', text: 'Read your INP here.' },
      { shot: 'home', at: 'chipInp', text: 'Click the INP chip to see what makes taps slow.' },
      {
        shot: 'charts-code',
        at: 'redraws',
        text: 'See which parts of the screen redraw the most.',
      },
      {
        shot: 'home-list',
        at: 'table',
        text: 'Open a problem such as “redraws on every keystroke” for its fix.',
      },
    ],
    test: metricTest(
      'inp: 200',
      'Open DevTools › Performance; the live INP number updates as you click around the page.',
    ),
    causes: [
      {
        cause: 'One change redraws a big part of the screen',
        fix: 'Split the context so components get only what they need',
        rule: 'react/context-rerender',
      },
      {
        cause: 'Long JavaScript tasks',
        fix: 'Break up the work or move it off the main thread',
        rule: 'general/long-tasks',
      },
      {
        cause: 'Background work keeps running',
        fix: 'Clean up effects when leaving',
        rule: 'react/effect-without-cleanup',
      },
    ],
  },
  cls: {
    group: 'Metrics',
    icon: 'shift',
    line: 'How much the page jumps while it loads.',
    what: 'CLS (Cumulative Layout Shift) measures how much things move on the screen while you look at them.',
    analogy: 'Like reaching for a door handle and someone moves the door.',
    why: 'Jumps cause wrong taps, for example on an ad instead of “Buy”, and they feel cheap.',
    check: [
      {
        shot: 'home',
        at: 'cls',
        text: 'Read your CLS here. Lower is better: 0 means nothing moved.',
      },
      { shot: 'home', at: 'chipCls', text: 'Click the CLS chip to see what moves.' },
      {
        shot: 'charts-speed',
        at: 'filmstrip',
        text: 'Watch the frames: content that jumps between them is a shift.',
      },
      {
        shot: 'home-list',
        at: 'table',
        text: 'Open “A picture makes the page jump” for the exact image and line.',
      },
    ],
    test: metricTest(
      'cls: 0.1',
      'Open DevTools › Performance and reload; the Layout shifts row shows each jump.',
    ),
    causes: [
      {
        cause: 'Images without width and height',
        fix: 'Add width and height (or aspect-ratio)',
        rule: 'general/image-missing-dimensions',
      },
      {
        cause: 'A web font swaps in late',
        fix: 'Use font-display and a matching fallback',
        rule: 'general/font-display-missing',
      },
      { cause: 'Next.js fonts loaded by hand', fix: 'Use next/font', rule: 'next/font-missing' },
    ],
  },
  ttfb: {
    group: 'Metrics',
    icon: 'server',
    line: 'How long the server takes to start answering.',
    what: 'TTFB (Time to First Byte) is the time until the first piece of the page arrives from the server.',
    analogy: 'Like ordering at a counter: TTFB is the wait until they hand you the first item.',
    why: 'Nothing can show before it. A slow server delays every other number.',
    check: [
      { shot: 'home', at: 'ttfb', text: 'Read your TTFB here.' },
      { shot: 'home', at: 'chipTtfb', text: 'Click the TTFB chip for server problems.' },
      {
        shot: 'charts-speed',
        at: 'waterfall',
        text: '“What loads when” shows the wait before the first file.',
      },
      {
        shot: 'charts-live',
        at: 'server',
        text: 'In Live, see what the server spends its time on.',
      },
    ],
    test: metricTest(
      'ttfb: 800',
      'Open DevTools › Network, click the page request, then Timing: “Waiting for server response” is TTFB.',
    ),
    causes: [
      {
        cause: 'The same data is fetched on every visit',
        fix: 'Add a Cache-Control header',
        rule: 'general/uncached-api',
      },
      {
        cause: 'The server builds the page slowly',
        fix: 'Cache pages or move work out of the request',
        rule: 'general/slow-ttfb',
      },
      {
        cause: 'Next.js fetch with no-store everywhere',
        fix: 'Revalidate instead of skipping the cache',
        rule: 'next/fetch-no-store',
      },
    ],
  },
  tbt: {
    group: 'Metrics',
    icon: 'block',
    line: 'How long the page is too busy to respond.',
    what: 'TBT (Total Blocking Time) adds up every moment, while loading, when the page is too busy to react.',
    analogy: 'Like a cashier on a long phone call: the queue waits, however short your question.',
    why: 'It makes the page look ready while it ignores taps. It is 30% of the score.',
    check: [
      { shot: 'home', at: 'tbt', text: 'Read your TBT here.' },
      { shot: 'home', at: 'chipTbt', text: 'Click the TBT chip to see what keeps the page busy.' },
      {
        shot: 'charts-code',
        at: 'treemap',
        text: 'Big boxes are big pieces of code that take long to run.',
      },
      { shot: 'charts-code', at: 'unused', text: 'Code downloaded but never used is pure waste.' },
    ],
    test: metricTest(
      'tbt: 200',
      'Open DevTools › Performance and reload; long tasks have red corners, the part after 50 ms is blocking.',
    ),
    causes: [
      {
        cause: 'An outside script blocks the page',
        fix: 'Load it with async or defer, or later',
        rule: 'general/blocking-third-party',
      },
      {
        cause: 'Long tasks on load',
        fix: 'Split the work into smaller pieces',
        rule: 'general/long-tasks',
      },
      { cause: 'Too much JavaScript', fix: 'Split code by route', rule: 'general/big-javascript' },
    ],
  },
  fcp: {
    group: 'Metrics',
    icon: 'paint',
    line: 'When the first text or picture appears.',
    what: 'FCP (First Contentful Paint) is the time until the first text or picture appears on a blank screen.',
    analogy: 'Like a shop opening its shutters: you are not served yet, but you know it is open.',
    why: 'A long blank screen makes people think the site is broken and go back.',
    check: [
      { shot: 'home', at: 'fcp', text: 'Read your FCP here.' },
      {
        shot: 'home',
        at: 'chipFcp',
        text: 'Click the FCP chip to see what delays the first paint.',
      },
      { shot: 'charts-speed', at: 'filmstrip', text: 'The first frame that is not blank is FCP.' },
    ],
    test: metricTest(
      'score: 85',
      'Open DevTools › Performance and reload; FCP is marked in the Timings row.',
    ),
    causes: [
      {
        cause: 'Large stylesheet loaded on every page',
        fix: 'Remove unused CSS',
        rule: 'general/unused-css',
      },
      {
        cause: 'Files sent without compression',
        fix: 'Turn on Brotli or gzip',
        rule: 'general/no-compression',
      },
      { cause: 'Slow server answer', fix: 'Cache the page', rule: 'general/slow-ttfb' },
    ],
  },
  bundle: {
    group: 'Metrics',
    icon: 'box',
    line: 'How much code each visitor downloads.',
    what: 'Bundle size is how much JavaScript a visitor must download and run before the page works.',
    analogy:
      'Like packing for a weekend: every extra suitcase slows you down, even if you never open it.',
    why: 'Phones on mobile data pay for every kilobyte with waiting time and battery.',
    check: [
      {
        shot: 'home',
        at: 'facts',
        text: 'The Bundle card shows how much JavaScript the first load needs.',
      },
      {
        shot: 'home-list',
        at: 'chipBundle',
        text: 'Click the Bundle chip to see what makes it big.',
      },
      {
        shot: 'charts-code',
        at: 'treemap',
        text: 'Bigger box = more code. Spot the big libraries.',
      },
      { shot: 'charts-code', at: 'unused', text: 'See how much of it is never used.' },
    ],
    test: metricTest(
      "js: '200kb'",
      'Open DevTools › Coverage (Ctrl/Cmd + Shift + P, “Coverage”) and reload to see unused bytes.',
    ),
    causes: [
      {
        cause: 'A whole library for a few functions',
        fix: 'Import only what you use',
        rule: 'react/namespace-import',
      },
      {
        cause: 'Code for hidden parts loads up front',
        fix: 'Load it when it is shown',
        rule: 'react/eager-conditional-import',
      },
      {
        cause: 'One big file for every page',
        fix: 'Split code by route',
        rule: 'general/big-javascript',
      },
    ],
  },
  memory: {
    group: 'Metrics',
    icon: 'memory',
    line: 'Whether the app gets heavier the longer it is open.',
    what: 'Memory is how much space the page uses in the device; a leak means it keeps growing.',
    analogy:
      'Like a sink with the tap on and the plug in: fine for a minute, a flood after an hour.',
    why: 'Leaks slow down long sessions, drain batteries and crash tabs on cheap phones.',
    check: [
      {
        shot: 'home-list',
        at: 'chipMemory',
        text: 'Click the Memory chip to see leaks found in the code.',
      },
      {
        shot: 'live',
        at: 'memory',
        text: 'In Live, watch the memory chart while you use the page.',
      },
      { shot: 'charts-live', at: 'memory', text: 'A line that only goes up is a leak.' },
    ],
    test: metricTest(
      undefined,
      'Open DevTools › Memory, take a heap snapshot, use the page, take another and compare.',
    ),
    causes: [
      {
        cause: 'Timers or listeners never removed',
        fix: 'Return a cleanup function from the effect',
        rule: 'react/effect-without-cleanup',
      },
      {
        cause: 'Big live messages kept in memory',
        fix: 'Send smaller messages, keep less history',
        rule: 'realtime/large-messages',
      },
    ],
  },

  live: {
    group: 'Live',
    icon: 'live',
    line: 'Watch requests, WebSocket and memory as they happen.',
    what: 'Live mode watches your page while it runs: requests, live connections (WebSocket) and memory.',
    analogy: 'Like a heart monitor instead of a single check-up.',
    why: 'Some problems only show over time: reconnect storms, slow peaks, leaks.',
    check: [
      { shot: 'home', at: 'live', text: 'Press Live in the top bar.' },
      { shot: 'live', at: 'url', text: 'Check the address, then press Start.' },
      { shot: 'live', at: 'socket', text: 'WebSocket messages; vertical lines are reconnects.' },
      { shot: 'live', at: 'memory', text: 'Memory: a line that keeps rising is a leak.' },
    ],
    test: [
      {
        text: 'Watch real visitors: add the small agent script to your page while developing.',
        code: '<script src="http://127.0.0.1:4545/agent/perfagent.js" async></script>',
      },
      { text: 'Or open the Live screen and press Start to drive your page in a test browser.' },
      { text: 'Prefer Chrome DevTools? Network › WS shows each WebSocket message.' },
    ],
    causes: [
      {
        cause: 'Reconnects at once after a drop',
        fix: 'Wait longer between tries (backoff) with jitter',
        rule: 'realtime/reconnect-no-backoff',
      },
      {
        cause: 'Very large messages',
        fix: 'Send only what changed',
        rule: 'realtime/large-messages',
      },
    ],
  },
  locations: {
    group: 'Live',
    icon: 'map',
    line: 'How fast it is for people in other countries.',
    what: 'Location results show how fast your page is for visitors in other countries and on slower networks.',
    analogy: 'Like posting a letter abroad: the same letter takes longer to arrive.',
    why: 'Your fast office Wi-Fi hides what most visitors live with.',
    check: [
      { shot: 'charts', at: 'tabUsers', text: 'Open Charts › Users & places.' },
      { shot: 'charts-users', at: 'countries', text: 'Which countries wait the longest.' },
      { shot: 'charts-users', at: 'connection', text: 'How much the connection type matters.' },
    ],
    test: [
      {
        text: 'Import real-user data for a region (Chrome UX Report or PageSpeed JSON).',
        code: 'npx perfagent import ./crux-india.json',
      },
      { text: 'Test on a slow phone profile.', code: `npx perfagent scan ${SITE} --device mobile` },
    ],
  },

  'measure-ai': {
    group: 'AI',
    icon: 'ai',
    line: 'Measure the AI features inside your app.',
    what: 'PerfAgent can time and price every AI call your app makes: waiting time, speed and cost.',
    analogy: 'Like a taxi meter for your AI: time and money, for every ride.',
    why: 'AI answers are often the slowest and most expensive part of an app.',
    check: [
      { shot: 'home', at: 'chipToken', text: 'The AI chips show AI problems found in your code.' },
      { shot: 'charts', at: 'tabAi', text: 'Open Charts › AI.' },
      { shot: 'charts-ai', at: 'glance', text: 'First word, cost today and reuse at a glance.' },
    ],
    test: [
      {
        text: 'Wrap your AI client once; every call is measured.',
        code: "import { watchAI } from 'perfagent/ai'\nconst client = watchAI(new Anthropic())",
      },
      {
        text: 'Or route calls through the measuring proxy while developing.',
        code: 'npx perfagent ai-proxy --target https://api.openai.com --port 4547',
      },
    ],
    causes: [
      {
        cause: 'Answers are not streamed',
        fix: 'Stream the answer so words appear at once',
        rule: 'ai/no-streaming',
      },
      {
        cause: 'No timeout on AI calls',
        fix: 'Set a timeout and a fallback',
        rule: 'ai/no-timeout',
      },
    ],
  },
  'ai-first-token': {
    group: 'AI',
    icon: 'ai',
    line: 'How long users wait for the first word of an AI answer.',
    what: 'First token is the time from sending a question to the AI until the first word of the answer arrives.',
    analogy: 'Like asking a question in a shop: what matters is how soon someone starts answering.',
    why: 'Users stare at a spinner until then. Under a second feels responsive.',
    check: [
      { shot: 'home', at: 'chipToken', text: 'Click the First token chip for what slows it.' },
      {
        shot: 'charts-ai',
        at: 'wait',
        text: 'How long users wait for an AI answer: light bar = first word.',
      },
      { shot: 'home-list', at: 'chipAi', text: 'Open an AI problem for the fix and its line.' },
    ],
    test: [
      {
        text: 'Measure your AI calls (see “Measure AI in your app”).',
        code: 'const client = watchAI(new OpenAI())',
      },
      {
        text: 'Add a budget for the slowest 5% of answers.',
        code: "budgets: { '/chat': { aiFirstTokenMs: 1000 } },\n\nnpx perfagent ci",
      },
    ],
    causes: [
      {
        cause: 'AI steps run one after another',
        fix: 'Run independent calls at the same time',
        rule: 'ai/sequential-await',
      },
      {
        cause: 'Huge context sent every time',
        fix: 'Send only what the question needs',
        rule: 'ai/oversized-context',
      },
      { cause: 'The answer is not streamed', fix: 'Stream it', rule: 'ai/no-streaming' },
    ],
  },
  'ai-cost': {
    group: 'AI',
    icon: 'coin',
    line: 'What each AI answer costs, and what to save.',
    what: 'AI cost is the money each AI request costs, from the words sent in and the words that come back.',
    analogy: 'Like a phone bill: every minute counts, and long calls add up fast.',
    why: 'A small cost per answer becomes a big monthly bill with many users.',
    check: [
      { shot: 'home', at: 'chipCost', text: 'Click the AI cost chip for costly code.' },
      { shot: 'charts-ai', at: 'perRequest', text: 'What you pay for in one AI request.' },
      { shot: 'charts-ai', at: 'perDay', text: 'Cost per day, against your budget line.' },
    ],
    test: [
      { text: 'Set a daily budget line for the cost chart.', code: 'ai: { budgetUsdPerDay: 5 },' },
      {
        text: 'Keep reuse high: fail CI when the prompt cache hit rate drops.',
        code: "budgets: { '/chat': { aiCacheHitRate: 0.7 } },",
      },
    ],
    causes: [
      {
        cause: 'Long instructions paid for again every time',
        fix: 'Mark the stable start of the prompt as cacheable',
        rule: 'ai/no-prompt-cache',
      },
      {
        cause: 'A big model for a simple task',
        fix: 'Use a smaller model for easy steps',
        rule: 'ai/model-overkill',
      },
      { cause: 'No limit on answer length', fix: 'Set max_tokens', rule: 'ai/missing-max-tokens' },
    ],
  },
  'agent-readiness': {
    group: 'AI',
    icon: 'bot',
    line: 'Can AI assistants use your site?',
    what: 'Agent readiness is a 0–100 score for how well AI assistants can read and operate your page.',
    analogy: 'Like signs in a building: without labels on the doors, a visitor has to guess.',
    why: 'More visits come from assistants that shop and book for people; they skip pages they cannot use.',
    check: [
      { shot: 'home', at: 'chipAgents', text: 'Click the Agents chip for problems agents hit.' },
      {
        shot: 'charts-users',
        at: 'agents',
        text: '“Can AI assistants use your site?” shows the score and what is missing.',
      },
      {
        shot: 'home-list',
        at: 'table',
        text: 'Each problem names the button or link without a label.',
      },
    ],
    test: [
      scan,
      { text: 'Prefer Chrome DevTools? Elements › Accessibility shows the name each button gets.' },
    ],
    causes: [
      {
        cause: 'Buttons and links without names',
        fix: 'Give each one visible text or an aria-label',
        rule: 'agents/readiness-low',
      },
    ],
  },
  'fix-with-ai': {
    group: 'AI',
    icon: 'wand',
    line: 'Let your AI write the fix; you review it.',
    what: 'Fix with AI sends one problem to your AI, which suggests a code change you can accept or skip.',
    analogy: 'Like a spell-checker that suggests the word; you still decide.',
    why: 'Fast fixes without giving up control; nothing changes without your review.',
    check: [
      {
        shot: 'issue-fix',
        at: 'builtIn',
        text: 'Many problems have a built-in fix that needs no AI.',
      },
      { shot: 'issue-fix', at: 'aiFix', text: 'Otherwise press “Fix with my AI”.' },
      {
        shot: 'settings-fix',
        at: 'review',
        text: 'Keep “Review each change” on to see every diff first.',
      },
      { shot: 'issue-fix', at: 'retest', text: 'Re-test to confirm the gain.' },
    ],
  },
  'connect-ai': {
    group: 'AI',
    icon: 'key',
    line: 'Use your own AI key, or a free local model.',
    what: 'Connect an AI provider with your own key, or use a free model that runs on your computer.',
    analogy: 'Like choosing a taxi app: your account, your bill, or walk for free.',
    why: 'Better explanations and fixes, at a cost you control. Built-in rules always work for free.',
    check: [
      { shot: 'home', at: 'navSettings', text: 'Open Settings.' },
      { shot: 'settings-ai', at: 'free', text: 'Free options: built-in rules and local AI.' },
      {
        shot: 'settings-ai',
        at: 'providers',
        text: 'Or add your own key for Claude, OpenAI or Gemini.',
      },
      { shot: 'settings-ai', at: 'roles', text: 'Choose which AI explains and which one fixes.' },
    ],
  },
  'connect-mcp': {
    group: 'AI',
    icon: 'plug',
    line: 'Let Claude, Cursor or Copilot read your reports.',
    what: 'MCP connects AI assistants such as Claude Code or Cursor to PerfAgent so they can read your problems.',
    analogy: 'Like giving your assistant a key to the filing cabinet.',
    why: 'Ask your assistant “fix the worst problem” and it gets the exact file and fix.',
    check: [
      { shot: 'settings-ai', at: 'mcp', text: 'In Settings › AI, pick your assistant here.' },
      { shot: 'settings-ai', at: 'mcp', text: 'Copy the config it shows into your assistant.' },
      { shot: 'home-list', at: 'table', text: 'Then ask the assistant about these problems.' },
    ],
    test: [
      {
        text: 'Claude Code: add PerfAgent in one line.',
        code: 'claude mcp add perfagent -- npx -y perfagent mcp',
      },
    ],
  },
}

/** Old or alternative slugs still used by links in the app. */
export const ALIASES: Record<string, string> = {
  compare: 'retest-compare',
  themes: 'themes-export',
  caching: 'ttfb',
}
