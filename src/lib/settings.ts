import { DEVICES, RATIO_MAX, RATIO_MIN, type DeviceKey } from './devices'
import type { FitMode } from './poster'

export type CaptureMode = 'api' | 'iframe'

/** 截图服务：free = 免费公共服务（mshots/thum.io）；xxapi = 需要自备密钥的 XXAPI */
export type CaptureProvider = 'free' | 'xxapi'

/** 设备在海报画布里的位置（设计坐标，画布宽恒为 1920） */
export interface DevicePos {
  x: number
  y: number
}

/** 画布比例，纯数字，如 16:9 */
export interface Ratio {
  w: number
  h: number
}

export const RATIO_PRESETS: { label: string; ratio: Ratio }[] = [
  { label: '16:9', ratio: { w: 16, h: 9 } },
  { label: '4:3', ratio: { w: 4, h: 3 } },
  { label: '1:1', ratio: { w: 1, h: 1 } },
  { label: '3:4', ratio: { w: 3, h: 4 } },
  { label: '9:16', ratio: { w: 9, h: 16 } },
]

export interface Settings {
  url: string
  perDevice: boolean
  urls: Record<DeviceKey, string>
  enabled: Record<DeviceKey, boolean>
  /** 画布比例，宽高都是正整数 */
  ratio: Ratio
  /** 画布底色，null 表示透明 */
  background: string | null
  fit: FitMode
  /** 导出倍率 */
  scale: number
  mode: CaptureMode
  /** 截图服务提供方 */
  provider: CaptureProvider
  /** XXAPI 的访问密钥，只存在本机浏览器里 */
  apiKey: string
  /** 可选的反向代理前缀（如 https://proxy.example.com/），用来绕过对方的 CORS 限制；界面上不再暴露 */
  proxy: string
  /** 手动拖动过的设备位置；没记录的设备沿用 devices.ts 里的默认布局 */
  layout: Partial<Record<DeviceKey, DevicePos>>
}

export const BACKGROUNDS: { label: string; value: string | null }[] = [
  { label: '纸白', value: '#ffffff' },
  { label: '暖白', value: '#f4f3f0' },
  { label: '浅灰', value: '#e9e7e1' },
  { label: '墨黑', value: '#161513' },
  { label: '透明', value: null },
]

const STORAGE_KEY = 'multi-terminal-screenshot:settings:v2'
const KEYS: DeviceKey[] = DEVICES.map((item) => item.key)

/** 比例里的一个数：1–99 的整数，空/非法按 1 算 */
export function normRatioPart(value: unknown): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 1
  return Math.min(Math.max(n, 1), 99)
}

/**
 * 把比例收进画布允许的范围内：只动用户没强调的那条边，
 * 1:4 这种会变成 1:2，避免导出几千万像素的位图。
 */
export function fitRatio(ratio: Ratio): Ratio {
  let { w, h } = ratio
  let guard = 0
  while (w / h > RATIO_MAX && guard++ < 200) h += 1
  while (w / h < RATIO_MIN && guard++ < 200) w += 1
  return { w, h }
}

export function normRatio(ratio: Partial<Ratio> | undefined, fallback: Ratio): Ratio {
  if (!ratio || typeof ratio !== 'object') return { ...fallback }
  return fitRatio({ w: normRatioPart(ratio.w), h: normRatioPart(ratio.h) })
}

export function sameRatio(a: Ratio, b: Ratio): boolean {
  return a.w === b.w && a.h === b.h
}

export function defaultSettings(): Settings {
  return {
    url: 'www.liushen.fun',
    perDevice: false,
    urls: { computer: '', laptop: '', tablet: '', phone: '' },
    enabled: { computer: true, laptop: true, tablet: true, phone: true },
    ratio: { w: 16, h: 9 },
    background: '#f4f3f0',
    fit: 'cover',
    scale: 1,
    mode: 'api',
    provider: 'free',
    apiKey: '',
    proxy: '',
    layout: {},
  }
}

export function loadSettings(): Settings {
  const fallback = defaultSettings()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Partial<Settings>
    const settings: Settings = {
      ...fallback,
      url: typeof saved.url === 'string' ? saved.url : fallback.url,
      perDevice: saved.perDevice === true,
      ratio: normRatio(saved.ratio, fallback.ratio),
      background:
        saved.background === null || typeof saved.background === 'string'
          ? saved.background
          : fallback.background,
      fit: saved.fit === 'contain' ? 'contain' : 'cover',
      scale: saved.scale === 2 ? 2 : 1,
      mode: saved.mode === 'iframe' ? 'iframe' : 'api',
      provider: saved.provider === 'xxapi' ? 'xxapi' : 'free',
      apiKey: typeof saved.apiKey === 'string' ? saved.apiKey : '',
      proxy: typeof saved.proxy === 'string' ? saved.proxy : fallback.proxy,
      layout: {},
    }
    if (saved.urls) {
      for (const key of KEYS) {
        const value = saved.urls[key]
        if (typeof value === 'string') settings.urls[key] = value
      }
    }
    if (saved.enabled) {
      for (const key of KEYS) {
        const value = saved.enabled[key]
        if (typeof value === 'boolean') settings.enabled[key] = value
      }
      if (!KEYS.some((key) => settings.enabled[key])) settings.enabled = { ...fallback.enabled }
    }
    if (saved.layout) {
      for (const key of KEYS) {
        const pos = saved.layout[key] as Partial<DevicePos> | undefined
        if (!pos) continue
        if (Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
          settings.layout[key] = { x: Math.round(pos.x as number), y: Math.round(pos.y as number) }
        }
      }
    }
    return settings
  } catch {
    return fallback
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* 隐私模式下写入失败时忽略 */
  }
}
