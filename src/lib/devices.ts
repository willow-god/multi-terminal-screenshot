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
  /** 抓图视口；mshots 上限为 1280×960，四个视口都按屏幕比例取值 */
  viewport: { w: number; h: number }
  /** 高清源（thum.io）请求的图片宽度 */
  outputWidth: number
  /** 海报中的位置，1920×1080 设计空间 */
  poster: Rect & { layer: number }
}

export const POSTER = { w: 1920, h: 1080 }

export const DEVICES: DeviceSpec[] = [
  {
    key: 'computer',
    name: '电脑',
    slug: 'desktop',
    frame: computerFrame,
    frameSize: { w: 2311, h: 2038 },
    screen: { x: 318, y: 315, w: 1680, h: 1100 },
    viewport: { w: 1280, h: 840 },
    outputWidth: 1920,
    poster: { x: 439, y: -31, w: 1197, h: 1059, layer: 0 },
  },
  {
    key: 'tablet',
    name: '平板',
    slug: 'tablet',
    frame: tabletFrame,
    frameSize: { w: 1255, h: 1529 },
    screen: { x: 218, y: 217, w: 820, h: 1096 },
    viewport: { w: 720, h: 960 },
    outputWidth: 1440,
    poster: { x: 1297, y: 343, w: 571, h: 696, layer: 1 },
  },
  {
    key: 'laptop',
    name: '笔记本',
    slug: 'laptop',
    frame: laptopFrame,
    frameSize: { w: 2045, h: 1331 },
    screen: { x: 369, y: 231, w: 1305, h: 815 },
    viewport: { w: 1280, h: 805 },
    outputWidth: 1920,
    poster: { x: 44, y: 424, w: 929, h: 607, layer: 2 },
  },
  {
    key: 'phone',
    name: '手机',
    slug: 'mobile',
    frame: phoneFrame,
    frameSize: { w: 656, h: 1142 },
    screen: { x: 118, y: 116, w: 420, h: 911 },
    viewport: { w: 390, h: 844 },
    outputWidth: 780,
    poster: { x: 1199, y: 478, w: 298, h: 522, layer: 3 },
  },
]

export const DEVICE_MAP: Record<DeviceKey, DeviceSpec> = DEVICES.reduce(
  (acc, item) => {
    acc[item.key] = item
    return acc
  },
  {} as Record<DeviceKey, DeviceSpec>,
)
