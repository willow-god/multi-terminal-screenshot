import { POSTER, type DeviceSpec } from './devices'

export type FitMode = 'cover' | 'contain'
export type Shot = HTMLImageElement | HTMLCanvasElement

export interface PosterOptions {
  /** 导出倍率，1 = 1920×1080 */
  scale: number
  fit: FitMode
  /** 画布底色；null 表示透明 */
  background: string | null
}

const frameCache = new Map<string, Promise<HTMLImageElement>>()

export function loadFrame(src: string): Promise<HTMLImageElement> {
  const cached = frameCache.get(src)
  if (cached) return cached

  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('设备边框加载失败'))
    img.src = src
  })
  frameCache.set(src, pending)
  return pending
}

interface DeviceCanvas {
  shot: Shot | null
  fit: FitMode
  letterbox: string
  canvas: HTMLCanvasElement
}

const deviceCache = new Map<string, DeviceCanvas>()

function drawFitted(
  ctx: CanvasRenderingContext2D,
  shot: Shot,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: FitMode,
): void {
  const ratio =
    fit === 'cover'
      ? Math.max(w / shot.width, h / shot.height)
      : Math.min(w / shot.width, h / shot.height)
  const dw = shot.width * ratio
  const dh = shot.height * ratio
  // 填充模式从顶部对齐：整页截图动辄上万像素高，居中会正好裁到中间那段空白
  const dy = fit === 'cover' ? y : y + (h - dh) / 2
  ctx.drawImage(shot, x + (w - dw) / 2, dy, dw, dh)
}

/** 设备图按 2 倍超采样，1× 预览走降采样、2× 导出正好 1:1 */
const SUPERSAMPLE = 2

const holeMaskCache = new Map<string, HTMLCanvasElement>()

/**
 * 屏幕洞口的遮罩：设备图中间那块「被边框包住的透明区域」。
 * 边框整块不透明，只有屏幕洞和画面外是透明的，从图片四边做一次泛洪填充
 * 就能把两者分开；截图按这块遮罩裁一遍，既不会溢出到设备外，
 * 四周圆角也正好贴着屏幕自己的弧度走。
 */
function holeMask(src: string, frame: HTMLImageElement, frameW: number, frameH: number): HTMLCanvasElement {
  const cached = holeMaskCache.get(src)
  if (cached) return cached

  // 半分辨率就够用：遮罩只决定边界，放大回画布时还有平滑
  const mw = Math.max(1, Math.round(frameW / 2))
  const mh = Math.max(1, Math.round(frameH / 2))
  const small = document.createElement('canvas')
  small.width = mw
  small.height = mh

  const sctx = small.getContext('2d', { willReadFrequently: true })
  if (!sctx) {
    holeMaskCache.set(src, small)
    return small
  }

  sctx.drawImage(frame, 0, 0, mw, mh)
  const image = sctx.getImageData(0, 0, mw, mh)
  const px = image.data
  const total = mw * mh
  // 缩放时洞口边缘会被平均成半透明，阈值放宽一点让洞口略微吃进边框，免得留缝
  const empty = (i: number): boolean => px[i * 4 + 3] < 128

  const outside = new Uint8Array(total)
  const stack = new Int32Array(total)
  let top = 0
  const seed = (i: number): void => {
    if (outside[i] || !empty(i)) return
    outside[i] = 1
    stack[top] = i
    top += 1
  }

  for (let x = 0; x < mw; x += 1) {
    seed(x)
    seed((mh - 1) * mw + x)
  }
  for (let y = 0; y < mh; y += 1) {
    seed(y * mw)
    seed(y * mw + mw - 1)
  }

  while (top > 0) {
    top -= 1
    const i = stack[top]
    const x = i % mw
    const y = (i - x) / mw
    if (x > 0) seed(i - 1)
    if (x < mw - 1) seed(i + 1)
    if (y > 0) seed(i - mw)
    if (y < mh - 1) seed(i + mw)
  }

  for (let i = 0; i < total; i += 1) {
    const o = i * 4
    const isHole = empty(i) && !outside[i]
    px[o] = 255
    px[o + 1] = 255
    px[o + 2] = 255
    px[o + 3] = isHole ? 255 : 0
  }

  sctx.putImageData(image, 0, 0)
  holeMaskCache.set(src, small)
  return small
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** 还没抓图时屏幕里放的占位稿：一张灰阶网页骨架，比纯色块更像「这台设备在这儿」 */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = '#f7f6f3'
  ctx.fillRect(x, y, w, h)

  const pad = w * 0.075
  const inner = w - pad * 2

  // 顶栏
  ctx.fillStyle = '#ecebe6'
  ctx.fillRect(x, y, w, h * 0.055)
  ctx.fillStyle = '#ddd9d1'
  roundRect(ctx, x + pad, y + h * 0.017, inner * 0.16, h * 0.02, h * 0.01)
  ctx.fill()
  ctx.fillStyle = '#e4e1da'
  roundRect(ctx, x + w - pad - inner * 0.22, y + h * 0.018, inner * 0.2, h * 0.018, h * 0.009)
  ctx.fill()

  // 主视觉
  ctx.fillStyle = '#e9e7e1'
  roundRect(ctx, x + pad, y + h * 0.1, inner, h * 0.28, w * 0.018)
  ctx.fill()

  // 两栏卡片
  const gap = pad * 0.6
  const cardW = (inner - gap) / 2
  const cardY = y + h * 0.44
  const cardH = h * 0.2
  for (let i = 0; i < 2; i += 1) {
    ctx.fillStyle = i === 0 ? '#e9e7e1' : '#eeece7'
    roundRect(ctx, x + pad + i * (cardW + gap), cardY, cardW, cardH, w * 0.014)
    ctx.fill()
  }

  // 文字行
  const lines = [0.62, 0.78, 0.48]
  lines.forEach((ratio, i) => {
    ctx.fillStyle = '#e7e4de'
    roundRect(ctx, x + pad, y + h * (0.7 + i * 0.045), inner * ratio, h * 0.024, h * 0.012)
    ctx.fill()
  })

  // 底部横块
  ctx.fillStyle = '#eeece7'
  roundRect(ctx, x + pad, y + h * 0.86, inner, h * 0.08, w * 0.014)
  ctx.fill()
}

/** 把截图和边框合成成一台设备的图片，按设备缓存，避免每帧重绘。 */
function deviceCanvas(
  spec: DeviceSpec,
  frame: HTMLImageElement,
  shot: Shot | null,
  fit: FitMode,
  letterbox: string,
): HTMLCanvasElement {
  const cached = deviceCache.get(spec.key)
  if (cached && cached.shot === shot && cached.fit === fit && cached.letterbox === letterbox) {
    return cached.canvas
  }

  const ss = SUPERSAMPLE
  const canvas = document.createElement('canvas')
  canvas.width = spec.frameSize.w * ss
  canvas.height = spec.frameSize.h * ss

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const screen = spec.screen
  const x = screen.x * ss
  const y = screen.y * ss
  const w = screen.w * ss
  const h = screen.h * ss

  if (shot) {
    if (fit === 'contain') {
      ctx.fillStyle = letterbox
      ctx.fillRect(x, y, w, h)
    }
    drawFitted(ctx, shot, x, y, w, h, fit)
  } else {
    drawPlaceholder(ctx, x, y, w, h)
  }

  // 只留下屏幕洞口里的像素：整页截图再长也会在屏幕边缘被切掉，不会糊到设备外面
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(
    holeMask(spec.frame, frame, spec.frameSize.w, spec.frameSize.h),
    0,
    0,
    canvas.width,
    canvas.height,
  )
  ctx.globalCompositeOperation = 'source-over'

  // 边框画在最上层，截图从透明屏幕里透出来
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)

  deviceCache.set(spec.key, { shot, fit, letterbox, canvas })
  return canvas
}

export function posterSize(scale: number): { w: number; h: number } {
  return { w: Math.round(POSTER.w * scale), h: Math.round(POSTER.h * scale) }
}

/**
 * 设备图（2 倍超采样，动辄 3000×3000）缩到海报尺寸是整条链路里最贵的一步，
 * 拖一次设备要重绘几十帧，每帧都缩一遍根本跟不上鼠标。
 * 这里按「设备 + 目标尺寸」缓存一份缩好的位图，之后每帧只做 1:1 贴图。
 */
const scaledCache = new Map<string, { src: HTMLCanvasElement; canvas: HTMLCanvasElement }>()

function scaledDevice(
  key: string,
  src: HTMLCanvasElement,
  dw: number,
  dh: number,
): HTMLCanvasElement {
  const id = `${key}@${dw}x${dh}`
  const hit = scaledCache.get(id)
  if (hit && hit.src === src) return hit.canvas

  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, dw, dh)
  scaledCache.set(id, { src, canvas })
  return canvas
}

/** 把若干设备合成到一张海报画布上（会重置画布尺寸）。 */
export async function renderPoster(
  canvas: HTMLCanvasElement,
  specs: DeviceSpec[],
  shots: Record<string, Shot | null>,
  options: PosterOptions,
): Promise<void> {
  const k = options.scale
  const size = posterSize(k)
  canvas.width = size.w
  canvas.height = size.h

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, size.w, size.h)
  if (options.background) {
    ctx.fillStyle = options.background
    ctx.fillRect(0, 0, size.w, size.h)
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const frames = await Promise.all(specs.map((spec) => loadFrame(spec.frame)))
  const ordered = specs
    .map((spec, index) => ({ spec, frame: frames[index] }))
    .sort((a, b) => a.spec.poster.layer - b.spec.poster.layer)

  for (const { spec, frame } of ordered) {
    const device = deviceCanvas(
      spec,
      frame,
      shots[spec.key] ?? null,
      options.fit,
      options.background || '#ffffff',
    )
    const { x, y, w, h } = spec.poster

    // 投影已经烘进设备图里（半透明黑 + 模糊），这里直接贴，换画布底色都不会露馅
    const dw = Math.round(w * k)
    const dh = Math.round(h * k)
    ctx.drawImage(scaledDevice(spec.key, device, dw, dh), x * k, y * k, dw, dh)
  }
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('图片导出失败'))
    }, 'image/png')
  })
}

export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToBlob(canvas)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
