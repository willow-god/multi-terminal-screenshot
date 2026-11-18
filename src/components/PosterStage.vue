<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { POSTER, type DeviceKey, type DeviceSpec } from '../lib/devices'
import { renderPoster, type FitMode, type Shot } from '../lib/poster'

const props = defineProps<{
  mode: 'api' | 'iframe'
  specs: DeviceSpec[]
  shots: Record<string, Shot | null>
  urlFor: (spec: DeviceSpec) => string
  background: string | null
  fit: FitMode
  /** 布局编辑态：铺一层可拖动的手柄 */
  editing?: boolean
}>()

const emit = defineEmits<{
  (event: 'move', key: DeviceKey, x: number, y: number): void
}>()

const wrapEl = ref<HTMLDivElement | null>(null)
const stageEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const stageScale = ref(0.5)

const ordered = computed(() => [...props.specs].sort((a, b) => a.poster.layer - b.poster.layer))

function frameScale(spec: DeviceSpec): number {
  return spec.poster.w / spec.frameSize.w
}

function deviceStyle(spec: DeviceSpec) {
  const { x, y, w, h } = spec.poster
  return { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }
}

function screenStyle(spec: DeviceSpec) {
  const s = frameScale(spec)
  const screen = spec.screen
  const width = screen.w * s
  const height = screen.h * s
  const k = width / spec.viewport.w
  /** 裁剪半径写在 iframe 自己的坐标系里，缩放后再乘 k 还原成舞台上的尺寸 */
  const radius = (spec.screenRadius * s) / k

  return {
    left: `${screen.x * s}px`,
    top: `${screen.y * s}px`,
    width: `${spec.viewport.w}px`,
    /** 视口高度换算回缩放前的长度，保证正好铺满屏幕区域 */
    height: `${height / k}px`,
    transform: `scale(${k})`,
    /** 四角按屏幕圆角裁掉，剩下的一点藏在设备边框底下，不会冒出来 */
    clipPath: `inset(0 round ${radius}px)`,
  }
}

/** 拖动时至少要留在画布内的边距，避免把设备甩到看不见的地方 */
const KEEP_VISIBLE = 80

interface DragState {
  key: DeviceKey
  pointerId: number
  /** 舞台缩放比，屏幕像素 → 设计坐标 */
  scale: number
  startX: number
  startY: number
  originX: number
  originY: number
  el: HTMLElement
}

const drag = ref<DragState | null>(null)

function clampPos(spec: DeviceSpec, x: number, y: number) {
  const keepX = Math.min(KEEP_VISIBLE, spec.poster.w)
  const keepY = Math.min(KEEP_VISIBLE, spec.poster.h)
  return {
    x: Math.round(Math.min(Math.max(x, keepX - spec.poster.w), POSTER.w - keepX)),
    y: Math.round(Math.min(Math.max(y, keepY - spec.poster.h), POSTER.h - keepY)),
  }
}

function startDrag(event: PointerEvent, spec: DeviceSpec) {
  if (!props.editing || event.button !== 0) return
  const stage = stageEl.value
  if (!stage) return
  event.preventDefault()
  const scale = stage.getBoundingClientRect().width / POSTER.w || 1
  drag.value = {
    key: spec.key,
    pointerId: event.pointerId,
    scale,
    startX: event.clientX,
    startY: event.clientY,
    originX: spec.poster.x,
    originY: spec.poster.y,
    el: event.currentTarget as HTMLElement,
  }
  drag.value.el.setPointerCapture(event.pointerId)
}

function onDrag(event: PointerEvent) {
  const state = drag.value
  if (!state || event.pointerId !== state.pointerId) return
  const spec = props.specs.find((item) => item.key === state.key)
  if (!spec) return
  // 始终按「起点 + 位移」算，避免逐帧累加带来的漂移
  const next = clampPos(
    spec,
    state.originX + (event.clientX - state.startX) / state.scale,
    state.originY + (event.clientY - state.startY) / state.scale,
  )
  emit('move', state.key, next.x, next.y)
}

function endDrag(event: PointerEvent) {
  const state = drag.value
  if (!state || event.pointerId !== state.pointerId) return
  if (state.el.hasPointerCapture(event.pointerId)) state.el.releasePointerCapture(event.pointerId)
  drag.value = null
}

const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** 方向键微调，按住 Shift 走 10 像素 */
function nudge(event: KeyboardEvent, spec: DeviceSpec) {
  const dir = NUDGE[event.key]
  if (!dir) return
  event.preventDefault()
  const step = event.shiftKey ? 10 : 1
  const next = clampPos(spec, spec.poster.x + dir[0] * step, spec.poster.y + dir[1] * step)
  emit('move', spec.key, next.x, next.y)
}

let token = 0

async function draw(): Promise<void> {
  if (props.mode !== 'api') return
  const canvas = canvasEl.value
  if (!canvas) return
  const mine = ++token
  await renderPoster(canvas, props.specs, props.shots, {
    scale: 1,
    fit: props.fit,
    background: props.background,
  })
  if (mine !== token) return
}

watch(
  () => [props.mode, props.specs, props.background, props.fit, props.specs.map((s) => props.shots[s.key])],
  () => {
    void draw()
  },
  // flush: 'post' 很重要：切回接口模式时 canvas 是 v-if 新建的，pre 阶段还拿不到 el，会画成空白
  { immediate: true, deep: false, flush: 'post' },
)

let observer: ResizeObserver | null = null

onMounted(() => {
  const el = wrapEl.value
  if (!el) return
  const measure = () => {
    const w = el.clientWidth / POSTER.w
    const h = el.clientHeight / POSTER.h
    stageScale.value = Math.max(0.01, Math.min(w, h))
  }
  measure()
  void draw()
  observer = new ResizeObserver(measure)
  observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div
    ref="wrapEl"
    class="stage-wrap"
    :class="{ 'is-transparent': background === null }"
    :style="background ? { background } : undefined"
  >
    <div
      ref="stageEl"
      class="stage"
      :style="{ transform: `translate(-50%, -50%) scale(${stageScale})` }"
    >
      <canvas v-if="mode === 'api'" ref="canvasEl" class="poster" width="1920" height="1080" />

      <template v-else>
        <div v-for="spec in ordered" :key="spec.key" class="device" :style="deviceStyle(spec)">
          <iframe
            v-if="urlFor(spec)"
            class="device-screen"
            :src="urlFor(spec)"
            :style="screenStyle(spec)"
            scrolling="no"
            loading="lazy"
            tabindex="-1"
            title="页面预览"
          />
          <img class="device-frame" :src="spec.frame" alt="" draggable="false" />
        </div>
      </template>

      <div v-if="editing" class="handles">
        <div
          v-for="spec in ordered"
          :key="`handle-${spec.key}`"
          class="handle"
          :class="{ active: drag?.key === spec.key }"
          :style="deviceStyle(spec)"
          role="button"
          tabindex="0"
          :aria-label="`移动${spec.name}`"
          @pointerdown="startDrag($event, spec)"
          @pointermove="onDrag"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @keydown="nudge($event, spec)"
        >
          <span class="handle-chip">{{ spec.name }}</span>
        </div>
      </div>
    </div>

    <slot name="overlay" />
  </div>
</template>

<style scoped>
.stage-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: inherit;
  background: #fbfaf8;
}

.stage-wrap.is-transparent {
  background-color: #ffffff;
  background-image: linear-gradient(45deg, rgba(25, 24, 22, 0.05) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(25, 24, 22, 0.05) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(25, 24, 22, 0.05) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(25, 24, 22, 0.05) 75%);
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
}

.stage {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1920px;
  height: 1080px;
  transform-origin: center center;
}

@media (max-width: 1023px) {
  .stage-wrap {
    height: auto;
    aspect-ratio: 16 / 9;
  }
}

.poster {
  display: block;
  width: 1920px;
  height: 1080px;
}

.device {
  position: absolute;
}

.device-screen {
  position: absolute;
  border: 0;
  background: #ffffff;
  transform-origin: top left;
  pointer-events: none;
}

.device-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
}

/* 编辑态的手柄层：尺寸都写在 1920×1080 设计空间里，跟着舞台一起缩放 */
.handles {
  position: absolute;
  inset: 0;
}

.handle {
  position: absolute;
  border: 3px dashed rgba(20, 19, 17, 0.45);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.4);
  cursor: grab;
  touch-action: none;
  outline: none;
}

.handle:hover {
  border-color: rgba(20, 19, 17, 0.72);
  background: rgba(255, 255, 255, 0.1);
}

.handle:focus-visible {
  border-style: solid;
  border-color: #e09a33;
}

.handle.active {
  border-style: solid;
  border-color: #e09a33;
  background: rgba(224, 154, 51, 0.16);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7), 0 0 46px rgba(224, 154, 51, 0.4);
  cursor: grabbing;
}

.handle-chip {
  position: absolute;
  top: 14px;
  left: 14px;
  padding: 8px 18px;
  border-radius: 999px;
  background: rgba(20, 19, 17, 0.8);
  color: #f7f3eb;
  font-size: 24px;
  line-height: 1.3;
  letter-spacing: 0.06em;
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(6px);
}
</style>
