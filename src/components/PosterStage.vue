<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { POSTER, type DeviceSpec } from '../lib/devices'
import { renderPoster, type FitMode, type Shot } from '../lib/poster'

const props = defineProps<{
  mode: 'api' | 'iframe'
  specs: DeviceSpec[]
  shots: Record<string, Shot | null>
  urlFor: (spec: DeviceSpec) => string
  background: string | null
  fit: FitMode
}>()

const wrapEl = ref<HTMLDivElement | null>(null)
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

  return {
    left: `${screen.x * s}px`,
    top: `${screen.y * s}px`,
    width: `${spec.viewport.w}px`,
    /** 视口高度换算回缩放前的长度，保证正好铺满屏幕区域 */
    height: `${height / k}px`,
    transform: `scale(${k})`,
  }
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
</style>
