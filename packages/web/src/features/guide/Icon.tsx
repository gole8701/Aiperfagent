/** Small line icons for the guide cards, drawn on a 24 × 24 grid. */
const PATHS = {
  start: 'M8 5v14l11-7z',
  scan: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  shield: 'M12 3l7 3v6c0 4.4-3 7.5-7 9-4-1.5-7-4.6-7-9V6z',
  palette:
    'M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.5-1.5-1.5-1.5-3S13.5 14 15 14h2a4 4 0 0 0 4-4c0-3.9-4-7-9-7zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
  globe:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  filter: 'M4 5h16l-6 7.5V19l-4 1v-7.5z',
  search: 'M4 6h10M4 12h7M4 18h10M17.5 11a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM20 17.5 22 19.5',
  flow: 'M3 9h6v6H3zM15 3h6v6h-6zM15 15h6v6h-6zM9 12h3v-6h3M12 12v6h3',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  compare: 'M4 4h7v16H4zM13 4h7v16h-7zM7 9h1M16 12h1',
  ci: 'M5 12l4 4L19 6M4 20h16',
  cloud: 'M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18zM12 12v6M9.5 15.5 12 18l2.5-2.5',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-5M3 20h18',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M16 8.5h.01',
  tap: 'M9 11V5.5a1.5 1.5 0 0 1 3 0V10l5 1.2a2 2 0 0 1 1.5 2.3L17.5 20H10l-4-5.5a1.5 1.5 0 0 1 2.3-1.9L9 13.5',
  shift: 'M4 4h16v5H4zM4 15h16v5H4zM12 10v4M10 12.5 12 14.5l2-2',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  block: 'M3 12h4M17 12h4M7 8h10v8H7zM12 8v8',
  paint: 'M4 4h16v16H4zM8 9h8M8 13h5',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  memory: 'M6 6h12v12H6zM9 9h6v6H9zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3',
  live: 'M3 12h4l3-7 4 14 3-7h4',
  map: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  ai: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.5 8.5h-3.5a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9.5M12 6.5v1.5M12 16.5V18',
  bot: 'M5 9h14v10H5zM12 5v4M9 13h.01M15 13h.01M9 16h6M12 3.5h.01',
  wand: 'M4 20 15 9M14 4v2M19 9h2M17.5 5.5 19 4M17 13l1 1M10 6l1 1',
  key: 'M14.5 3a6.5 6.5 0 1 1-5.6 9.8L3 18.7V21h3v-2h2v-2h2l1.2-1.2A6.5 6.5 0 0 1 14.5 3zM16.5 7.5h.01',
  plug: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
