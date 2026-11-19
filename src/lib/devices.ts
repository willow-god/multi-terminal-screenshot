import computerFrame from '../assets/images/new-model/computer.png'
import laptopFrame from '../assets/images/new-model/laptop.png'
import tabletFrame from '../assets/images/new-model/tablet.png'
import phoneFrame from '../assets/images/new-model/mobile.png'

export type DeviceKey = 'computer' | 'laptop' | 'tablet' | 'phone'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface DeviceSpec {
  key: DeviceKey
  /** 中文名称 */
  name: string
  /** 英文名称，用于导出文件名 */
  slug: string
  frame: string
  frameSize: { w: number; h: number }
  /** 截图的绘制区域（比透明屏幕略外扩几像素，避免边缘漏底） */
  screen: Rect
  /** 屏幕圆角（边框像素）；iframe 预览按它裁角，把四角藏进边框底下 */
  screenRadius: number
  /** 抓图视口；mshots 上限为 1280×960，四个视口都按屏幕比例取值 */
  viewport: { w: number; h: number }
  /** 高清源（thum.io）请求的图片宽度 */
  outputWidth: number
  /** 海报中的位置，1920×1080 设计空间 */
  poster: Rect & { layer: number }
  /**
   * 设备「看得见的部分」在 poster 矩形里的位置，单位同 poster。
   * 底图四周留了一圈透明边（给阴影渐变用），拖拽时按这块算边界，
   * 设备才能真的贴到画布边上，而不是被那圈空白挡住。
   */
  art: Rect
}

/** 画布设计宽度固定 1920；高度由比例决定，设备坐标都在这个设计空间里 */
export const POSTER_W = 1920
/** 16:9 时的高度，设备默认布局是按这个高度摆的 */
export const BASE_H = 1080
/** 比例的可选范围（宽 / 高）：太窄太长会导出几千万像素的位图 */
export const RATIO_MIN = 0.5
export const RATIO_MAX = 4

export interface PosterBox {
  w: number
  h: number
}

export function clampRatio(value: number): number {
  return Math.min(Math.max(value, RATIO_MIN), RATIO_MAX)
}

/** 比例 → 画布设计尺寸：宽度恒为 1920，高度按比例算 */
export function posterSize(ratio: { w: number; h: number }): PosterBox {
  const w = Number.isFinite(ratio.w) && ratio.w > 0 ? ratio.w : 16
  const h = Number.isFinite(ratio.h) && ratio.h > 0 ? ratio.h : 9
  return { w: POSTER_W, h: Math.round(POSTER_W / clampRatio(w / h)) }
}

/**
 * 把设备夹在画布里：画布就是整张海报，露出去的部分会被直接切掉，
 * 于是出现「边框少一截 / 屏幕不显示」的假象。
 * 边界按看得见的本体（art）算，底图自带的那圈透明边可以露到画布外，
 * 这样设备既能贴到边上，又不会真的缺一块。
 */
export function clampPoster(
  spec: DeviceSpec,
  x: number,
  y: number,
  box: PosterBox,
): { x: number; y: number } {
  const { art } = spec
  const minX = -art.x
  const maxX = Math.max(minX, box.w - art.x - art.w)
  const minY = -art.y
  const maxY = Math.max(minY, box.h - art.y - art.h)
  return {
    x: Math.round(Math.min(Math.max(x, minX), maxX)),
    y: Math.round(Math.min(Math.max(y, minY), maxY)),
  }
}

export const DEVICES: DeviceSpec[] = [
  {
    key: 'computer',
    name: '电脑',
    slug: 'desktop',
    frame: computerFrame,
    frameSize: { w: 1594, h: 1510 },
    screen: { x: 150, y: 150, w: 1294, h: 848 },
    screenRadius: 10,
    viewport: { w: 1280, h: 840 },
    outputWidth: 1920,
    poster: { x: 506, y: 36, w: 1064, h: 1008, layer: 0 },
    art: { x: 65, y: 79, w: 934, h: 797 },
  },
  {
    key: 'tablet',
    name: '平板',
    slug: 'tablet',
    frame: tabletFrame,
    frameSize: { w: 2354, h: 2978 },
    screen: { x: 278, y: 290, w: 1800, h: 2398 },
    screenRadius: 30,
    viewport: { w: 720, h: 960 },
    outputWidth: 1440,
    poster: { x: 1337, y: 381, w: 490, h: 620, layer: 1 },
    art: { x: 41, y: 42, w: 408, h: 553 },
  },
  {
    key: 'laptop',
    name: '笔记本',
    slug: 'laptop',
    frame: laptopFrame,
    frameSize: { w: 2170, h: 1390 },
    screen: { x: 318, y: 168, w: 1530, h: 962 },
    screenRadius: 10,
    viewport: { w: 1280, h: 805 },
    outputWidth: 1920,
    poster: { x: 85, y: 462, w: 849, h: 544, layer: 2 },
    art: { x: 46, y: 45, w: 756, h: 457 },
  },
  {
    key: 'phone',
    name: '手机',
    slug: 'mobile',
    frame: phoneFrame,
    frameSize: { w: 2400, h: 4450 },
    screen: { x: 306, y: 292, w: 1788, h: 3866 },
    screenRadius: 90,
    viewport: { w: 390, h: 844 },
    outputWidth: 780,
    poster: { x: 1218, y: 498, w: 260, h: 483, layer: 3 },
    art: { x: 24, y: 22, w: 212, h: 447 },
  },
]

export const DEVICE_MAP: Record<DeviceKey, DeviceSpec> = DEVICES.reduce(
  (acc, item) => {
    acc[item.key] = item
    return acc
  },
  {} as Record<DeviceKey, DeviceSpec>,
)
