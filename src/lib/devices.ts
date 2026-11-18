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
    frameSize: { w: 1594, h: 1510 },
    screen: { x: 150, y: 150, w: 1294, h: 848 },
    viewport: { w: 1280, h: 840 },
    outputWidth: 1920,
    poster: { x: 506, y: 36, w: 1064, h: 1008, layer: 0 },
  },
  {
    key: 'tablet',
    name: '平板',
    slug: 'tablet',
    frame: tabletFrame,
    frameSize: { w: 2354, h: 2978 },
    screen: { x: 278, y: 290, w: 1800, h: 2398 },
    viewport: { w: 720, h: 960 },
    outputWidth: 1440,
    poster: { x: 1337, y: 381, w: 490, h: 620, layer: 1 },
  },
  {
    key: 'laptop',
    name: '笔记本',
    slug: 'laptop',
    frame: laptopFrame,
    frameSize: { w: 2170, h: 1390 },
    screen: { x: 318, y: 168, w: 1530, h: 962 },
    viewport: { w: 1280, h: 805 },
    outputWidth: 1920,
    poster: { x: 85, y: 462, w: 849, h: 544, layer: 2 },
  },
  {
    key: 'phone',
    name: '手机',
    slug: 'mobile',
    frame: phoneFrame,
    frameSize: { w: 2400, h: 4450 },
    screen: { x: 306, y: 292, w: 1788, h: 3866 },
    viewport: { w: 390, h: 844 },
    outputWidth: 780,
    poster: { x: 1218, y: 498, w: 260, h: 483, layer: 3 },
  },
]

export const DEVICE_MAP: Record<DeviceKey, DeviceSpec> = DEVICES.reduce(
  (acc, item) => {
    acc[item.key] = item
    return acc
  },
  {} as Record<DeviceKey, DeviceSpec>,
)
