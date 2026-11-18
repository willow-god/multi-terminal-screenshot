import type { DeviceSpec } from './devices'
import type { CaptureProvider } from './settings'

/** 两个截图源：mshots 快、走 WordPress CDN；thum.io 作为兜底与高清源 */
export type CaptureSource = 'mshots' | 'thumio'

export interface CaptureOptions {
  provider?: CaptureProvider
  apiKey?: string
  /** 可选反向代理前缀，填了就把请求都转发过去，绕开对方没开 CORS 的情况 */
  proxy?: string
}

/** 拿到 loading GIF 后的轮询间隔：服务端渲染越久，间隔越大 */
const GIF_DELAYS = [1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10_000]
const MAX_FAILURES = 3
const REQUEST_TIMEOUT = 45_000

interface SourceConfig {
  label: string
  /** 单张截图的整体预算 */
  budget: number
  build: (spec: DeviceSpec, target: string) => string
}

const SOURCES: Record<CaptureSource, SourceConfig> = {
  mshots: {
    label: 'WordPress mshots',
    budget: 40_000,
    build: (spec, target) => {
      const { w, h } = spec.viewport
      return `https://s0.wp.com/mshots/v1/${encodeURIComponent(target)}?w=${w}&h=${h}`
    },
  },
  thumio: {
    label: 'thum.io',
    budget: 120_000,
    build: (spec, target) => {
      const { w, h } = spec.viewport
      return `https://image.thum.io/get/viewportWidth/${w}/width/${spec.outputWidth}/crop/${h}/${target}`
    },
  },
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/** 把用户输入整理成完整 URL；没写协议时按 https 处理。 */
export function normalizeTarget(input: string): string {
  const value = input.trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  return `https://${value.replace(/^\/+/, '')}`
}

export function hostOf(target: string): string {
  try {
    return new URL(target).host || target
  } catch {
    return target
  }
}

export function buildCaptureUrl(source: CaptureSource, spec: DeviceSpec, target: string): string {
  return SOURCES[source].build(spec, target)
}

/** 代理约定：前缀 + 完整原地址，例如 https://proxy.example.com/https://target.com/a.png */
export function withProxy(url: string, proxy?: string): string {
  const prefix = (proxy || '').trim()
  if (!prefix) return url
  return prefix.replace(/\/+$/, '') + '/' + url
}

/** 先走代理，代理不通（断网 / 域名挂了）就自动回落直连，别让一个前缀把功能整个锁死 */
async function fetchWithFallback(
  url: string,
  signal: AbortSignal,
  timeout: number,
  proxy?: string,
  headers?: Record<string, string>,
): Promise<Response> {
  if (!proxy || !proxy.trim()) return fetchWithTimeout(url, signal, timeout, headers)
  try {
    return await fetchWithTimeout(withProxy(url, proxy), signal, timeout, headers)
  } catch (error) {
    if (signal.aborted) throw error
    return fetchWithTimeout(url, signal, timeout, headers)
  }
}

async function fetchWithTimeout(
  url: string,
  signal: AbortSignal,
  timeout: number,
  headers?: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort)
  const timer = window.setTimeout(abort, timeout)

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      mode: 'cors',
      credentials: 'omit',
      headers,
    })
  } finally {
    window.clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

/**
 * 轮询一个截图源，直到拿到真实图片。
 * 首次请求通常返回 loading GIF（服务端还在渲染），隔一会儿重试即可。
 */
async function captureFrom(
  source: CaptureSource,
  spec: DeviceSpec,
  target: string,
  signal: AbortSignal,
  proxy?: string,
): Promise<Blob> {
  const config = SOURCES[source]
  const url = config.build(spec, target)
  const deadline = Date.now() + config.budget
  let lastMessage = ''
  let failures = 0
  let gifWaits = 0

  while (Date.now() < deadline) {
    if (signal.aborted) throw new DOMException('已取消', 'AbortError')

    const budget = Math.max(1000, Math.min(REQUEST_TIMEOUT, deadline - Date.now()))

    let response: Response
    try {
      response = await fetchWithFallback(url, signal, budget, proxy)
    } catch (error) {
      if (signal.aborted) throw new DOMException('已取消', 'AbortError')
      lastMessage = (error as Error).name === 'AbortError' ? '截图服务响应超时' : '无法连接截图服务，请检查网络'
      failures += 1
      if (failures >= MAX_FAILURES) break
      await sleep(1200)
      continue
    }

    if (!response.ok) {
      lastMessage = `截图服务返回 ${response.status}`
      failures += 1
      if (failures >= MAX_FAILURES) break
      await sleep(1500)
      continue
    }

    const type = (response.headers.get('content-type') || '').toLowerCase()

    if (type.startsWith('image/') && !type.includes('gif')) {
      const blob = await response.blob()
      if (blob.size > 0) return blob
      lastMessage = '返回的截图为空'
    } else if (type.includes('gif')) {
      // 服务端还在渲染，按递增间隔轮询，直到拿到真实截图或超时
      lastMessage = '截图正在生成'
      const delay = GIF_DELAYS[Math.min(gifWaits, GIF_DELAYS.length - 1)]
      gifWaits += 1
      if (Date.now() + delay > deadline) break
      await sleep(delay)
      continue
    } else if (type.includes('text/html')) {
      lastMessage = '目标网站拒绝了截图请求'
      failures += 1
      if (failures >= MAX_FAILURES) break
    } else {
      lastMessage = '截图服务返回了未知内容'
      failures += 1
      if (failures >= MAX_FAILURES) break
    }

    await sleep(1200)
  }

  throw new Error(lastMessage === '截图正在生成' ? '截图生成超时，请稍后重试' : lastMessage || '截图失败')
}

const XXAPI_ENDPOINT = 'https://v2.xxapi.cn/api/screenshot'
/** 服务端限流 / 并发拒绝时给几次重试；密钥本身无效只试一次，别让人干等 */
const XXAPI_RETRY_DELAYS = [2500, 5000, 8000]
const XXAPI_RETRY_LIMIT: Record<number, number> = { 350706: 3, 980402: 1 }

interface XxapiBody {
  code?: number
  msg?: string
  data?: unknown
}

/**
 * XXAPI 截图。必须用 return=json：return=302 的跳转在浏览器里会被 CORS 拦掉
 * （跳到图片时跨域读不到），json 里拿到的图片地址才允许 fetch + 画进 canvas。
 * 密钥只在本机浏览器里用，代码里不留任何默认值。
 */
async function captureFromXxapi(
  spec: DeviceSpec,
  target: string,
  apiKey: string,
  signal: AbortSignal,
  proxy?: string,
): Promise<Blob> {
  const key = (apiKey || '').trim()
  if (!key) throw new Error('请先在设置里填写 XXAPI 密钥')

  // XXAPI 的 width 就是排版宽度（会返回整页长图），用设备视口宽才能拿到对应端的响应式版式
  const width = Math.round(Math.min(4096, Math.max(320, spec.viewport.w)))
  const url =
    `${XXAPI_ENDPOINT}?url=${encodeURIComponent(target)}` +
    `&return=json&width=${width}&timeout=15`

  let message = ''
  const tries: Record<number, number> = {}

  for (;;) {
    let response: Response
    try {
      response = await fetchWithFallback(url, signal, 90_000, proxy, { Authorization: `Bearer ${key}` })
    } catch (error) {
      if (signal.aborted || (error as Error).name === 'AbortError') {
        throw new DOMException('已取消', 'AbortError')
      }
      throw new Error('无法连接 XXAPI，请检查网络或稍后重试')
    }

    const type = (response.headers.get('content-type') || '').toLowerCase()

    // 正常情况是 JSON；万一服务端直接回图片也照收
    if (type.startsWith('image/')) {
      const blob = await response.blob()
      if (blob.size) return blob
      message = 'XXAPI 返回的截图为空'
    } else {
      let body: XxapiBody = {}
      try {
        body = (await response.json()) as XxapiBody
      } catch {
        throw new Error(`XXAPI 返回了未知内容（${response.status}）`)
      }

      if (body.code === 200 && typeof body.data === 'string' && body.data) {
        const blob = await fetchXxapiImage(body.data, signal, proxy)
        if (blob) return blob
        message = 'XXAPI 返回的截图读不出来'
      } else {
        message = body.msg
          ? body.code
            ? `${body.msg}（${body.code}）`
            : body.msg
          : `XXAPI 返回 ${response.status}`

        const code = body.code
        const limit = code === undefined ? 0 : XXAPI_RETRY_LIMIT[code] || 0
        const used = code === undefined ? 0 : tries[code] || 0
        if (code !== undefined && used < limit) {
          tries[code] = used + 1
          await sleep(XXAPI_RETRY_DELAYS[Math.min(used, XXAPI_RETRY_DELAYS.length - 1)])
          continue
        }
      }
    }

    throw new Error(message || 'XXAPI 截图失败')
  }
}

/** 把 XXAPI 给的图片地址取成 Blob；需要对方带 CORS 头，否则 canvas 会被污染。 */
async function fetchXxapiImage(
  imageUrl: string,
  signal: AbortSignal,
  proxy?: string,
): Promise<Blob | null> {
  try {
    const response = await fetchWithFallback(imageUrl, signal, 60_000, proxy)
    if (!response.ok) return null
    const blob = await response.blob()
    return blob.size ? blob : null
  } catch {
    return null
  }
}

/** 先用 mshots（通常几秒出图），失败再退回 thum.io；选了 XXAPI 就只走 XXAPI。 */
export async function captureScreenshot(
  spec: DeviceSpec,
  target: string,
  signal: AbortSignal,
  options: CaptureOptions = {},
): Promise<Blob> {
  if (options.provider === 'xxapi') {
    return captureFromXxapi(spec, target, options.apiKey || '', signal, options.proxy)
  }
  try {
    return await captureFrom('mshots', spec, target, signal, options.proxy)
  } catch (error) {
    if ((error as Error).name === 'AbortError' || signal.aborted) throw error
    return captureFrom('thumio', spec, target, signal, options.proxy)
  }
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('截图解码失败'))
    }
    img.src = url
  })
}
