export interface DeviceProfile {
  name: 'mobile' | 'desktop'
  viewport: { width: number; height: number }
  deviceScaleFactor: number
  isMobile: boolean
  userAgent?: string
  cpuThrottle: number
  network: { downloadKbps: number; uploadKbps: number; latencyMs: number }
}

/** Matches Lighthouse's defaults so numbers are comparable with PageSpeed Insights. */
export const PROFILES: Record<'mobile' | 'desktop', DeviceProfile> = {
  mobile: {
    name: 'mobile',
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 PerfAgent',
    cpuThrottle: 4,
    network: { downloadKbps: 1600, uploadKbps: 750, latencyMs: 150 },
  },
  desktop: {
    name: 'desktop',
    viewport: { width: 1350, height: 940 },
    deviceScaleFactor: 1,
    isMobile: false,
    cpuThrottle: 1,
    network: { downloadKbps: 10_240, uploadKbps: 10_240, latencyMs: 40 },
  },
}
