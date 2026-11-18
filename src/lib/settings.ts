import { DEVICES, type DeviceKey } from './devices'
import type { FitMode } from './poster'

export type CaptureMode = 'api' | 'iframe'

/** 截图服务：free = 免费公共服务（mshots/thum.io）；xxapi = 需要自备密钥的 XXAPI */
export type CaptureProvider = 'free' | 'xxapi'

export interface Settings {
  url: string
  perDevice: boolean
  urls: Record<DeviceKey, string>
  enabled: Record<DeviceKey, boolean>
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

export function defaultSettings(): Settings {
  return {
    url: 'www.liushen.fun',
    perDevice: false,
    urls: { computer: '', laptop: '', tablet: '', phone: '' },
    enabled: { computer: true, laptop: true, tablet: true, phone: true },
    background: '#f4f3f0',
    fit: 'cover',
    scale: 1,
    mode: 'api',
    provider: 'free',
    apiKey: '',
    proxy: '',
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
