<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Icon from './components/Icon.vue'
import PosterStage from './components/PosterStage.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { DEVICES, type DeviceKey, type DeviceSpec } from './lib/devices'
import { blobToImage, captureScreenshot, hostOf, normalizeTarget } from './lib/screenshot'
import { downloadCanvas, renderPoster, type Shot } from './lib/poster'
import { defaultSettings, loadSettings, saveSettings, type Settings } from './lib/settings'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface Slot {
  status: Status
  image: Shot | null
  error: string
  /** 这张截图对应哪个网址，用于提示网址变更后的过期状态 */
  target: string
}

const settings = reactive<Settings>(loadSettings())

const slots = reactive(
  DEVICES.reduce(
    (acc, spec) => {
      acc[spec.key] = { status: 'idle', image: null, error: '', target: '' } as Slot
      return acc
    },
    {} as Record<DeviceKey, Slot>,
  ),
)

/** 拖动时位置每帧都在变，写 localStorage 做一点防抖，避免拖一次存几十遍 */
let saveTimer = 0

function flushSave(): void {
  window.clearTimeout(saveTimer)
  saveTimer = 0
  saveSettings(settings)
}

watch(
  settings,
  (value) => {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => saveSettings(value), 220)
  },
  { deep: true },
)

const sheetOpen = ref(false)
const toastText = ref('')
let toastTimer = 0

function toast(message: string): void {
  toastText.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastText.value = ''
  }, 2600)
}

onBeforeUnmount(() => {
  window.clearTimeout(toastTimer)
  flushSave()
  cancelAll()
})

/** 布局编辑态：舞台上铺一层可拖动的热区 */
const editingLayout = ref(false)
const hasCustomLayout = computed(() => Object.keys(settings.layout).length > 0)

function moveDevice(key: DeviceKey, x: number, y: number): void {
  settings.layout[key] = { x, y }
}

function resetLayout(): void {
  if (!hasCustomLayout.value) return
  settings.layout = {}
  toast('设备位置已恢复默认')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && editingLayout.value) editingLayout.value = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function targetFor(spec: DeviceSpec): string {
  const raw = settings.perDevice ? settings.urls[spec.key] || settings.url : settings.url
  return normalizeTarget(raw)
}

/** 拖过位置的设备由 settings.layout 覆盖默认布局，其余设备沿用 devices.ts */
const layoutSpecs = computed<DeviceSpec[]>(() =>
  DEVICES.map((spec) => {
    const pos = settings.layout[spec.key]
    return pos ? { ...spec, poster: { ...spec.poster, x: pos.x, y: pos.y } } : spec
  }),
)

const enabledDevices = computed(() => layoutSpecs.value.filter((spec) => settings.enabled[spec.key]))
const enabledCount = computed(() => enabledDevices.value.length)
const readyCount = computed(() => enabledDevices.value.filter((s) => slots[s.key].status === 'ready').length)
const loadingCount = computed(() => enabledDevices.value.filter((s) => slots[s.key].status === 'loading').length)
const busy = computed(() => loadingCount.value > 0)
const doneCount = computed(
  () =>
    enabledDevices.value.filter((s) => ['ready', 'error'].includes(slots[s.key].status)).length,
)
const staleCount = computed(
  () =>
    enabledDevices.value.filter(
      (spec) => slots[spec.key].image && slots[spec.key].target !== targetFor(spec),
    ).length,
)

const canExport = computed(
  () => settings.mode === 'api' && readyCount.value > 0 && !busy.value,
)

const shotMap = computed<Record<string, Shot | null>>(() => {
  const map: Record<string, Shot | null> = {}
  for (const spec of DEVICES) map[spec.key] = slots[spec.key].image
  return map
})

const stageHint = computed(() => {
  if (settings.mode === 'iframe') {
    return enabledDevices.value.some((spec) => targetFor(spec)) ? '' : '填写网址后这里会实时加载页面'
  }
  if (busy.value) return `正在生成截图 · ${doneCount.value} / ${enabledCount.value}`
  if (!enabledCount.value) return '在设置里开启至少一台设备'
  if (!readyCount.value) return '填好网址，点「抓取截图」'
  if (staleCount.value) return `有 ${staleCount.value} 台设备的截图来自旧网址`
  return ''
})

function cancelAll(): void {
  for (const controller of controllers) controller.abort()
  controllers.clear()
}

const controllers = new Set<AbortController>()

async function captureOne(spec: DeviceSpec): Promise<void> {
  const slot = slots[spec.key]
  const target = targetFor(spec)
  if (!target) {
    slot.status = 'error'
    slot.error = '还没有填写这个设备的网址'
    return
  }

  const controller = new AbortController()
  controllers.add(controller)
  slot.status = 'loading'
  slot.error = ''

  try {
    const blob = await captureScreenshot(spec, target, controller.signal, {
      provider: settings.provider,
      apiKey: settings.apiKey,
      proxy: settings.proxy,
    })
    const image = await blobToImage(blob)
    if (controller.signal.aborted) return
    slot.image = image
    slot.target = target
    slot.status = 'ready'
  } catch (error) {
    if (controller.signal.aborted) return
    slot.status = 'error'
    slot.error = (error as Error).message || '截图失败'
  } finally {
    controllers.delete(controller)
  }
}

async function captureAll(): Promise<void> {
  if (settings.mode === 'iframe') {
    toast('iframe 预览模式不需要抓取')
    return
  }

  const queue = enabledDevices.value.filter((spec) => targetFor(spec))
  if (!queue.length) {
    toast('请先填写要截图的网址')
    return
  }

  const skipped = enabledCount.value - queue.length
  if (skipped > 0) toast(`已跳过 ${skipped} 台未填写网址的设备`)

  cancelAll()

  let cursor = 0
  // XXAPI 对并发比较敏感（会回「请求过于频繁」），同时只跑两台并错开一点起跑
  const xxapi = settings.provider === 'xxapi'
  const parallel = Math.min(xxapi ? 2 : 3, queue.length)
  const stagger = xxapi ? 600 : 0
  const workers = Array.from({ length: parallel }, async (_, index) => {
    if (stagger) await new Promise((resolve) => setTimeout(resolve, index * stagger))
    while (cursor < queue.length) {
      const spec = queue[cursor]
      cursor += 1
      await captureOne(spec)
    }
  })

  await Promise.all(workers)

  const ok = queue.filter((spec) => slots[spec.key].status === 'ready').length
  toast(ok === queue.length ? '四台设备截图已就绪' : `${ok} / ${queue.length} 台设备抓取成功`)
}

function onUpload(key: DeviceKey, file: File): void {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    slots[key].image = image
    slots[key].target = targetFor(DEVICES.find((spec) => spec.key === key) as DeviceSpec)
    slots[key].status = 'ready'
    slots[key].error = ''
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    toast('这张图片读不出来')
  }
  image.src = url
}

function stamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

async function exportPoster(): Promise<void> {
  if (!canExport.value) {
    if (settings.mode === 'iframe') toast('iframe 预览不支持导出，切到「接口截图」再导出')
    return
  }

  const specs = enabledDevices.value.filter((spec) => slots[spec.key].image)
  if (!specs.length) return

  const canvas = document.createElement('canvas')
  try {
    await renderPoster(canvas, specs, shotMap.value, {
      scale: settings.scale,
      fit: settings.fit,
      background: settings.background,
    })
    const host = hostOf(targetFor(specs[0])).replace(/^www\./, '').split(':')[0] || 'poster'
    await downloadCanvas(canvas, `${host}-${stamp()}.png`)
    toast(`已导出 ${settings.scale}× 海报`)
  } catch (error) {
    toast((error as Error).message || '导出失败')
  }
}

function resetAll(): void {
  Object.assign(settings, defaultSettings())
  for (const spec of DEVICES) {
    slots[spec.key].image = null
    slots[spec.key].status = 'idle'
    slots[spec.key].error = ''
    slots[spec.key].target = ''
  }
  cancelAll()
  toast('已恢复默认设置')
}

function urlFor(spec: DeviceSpec): string {
  return targetFor(spec)
}
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">
          <Icon name="frame" :size="17" />
        </span>
        <span class="brand-text">
          <strong>端影</strong>
          <small>一个网址，四块屏幕，一张海报</small>
        </span>
      </div>

      <div class="topbar-tools">
        <div class="segmented mode">
          <button
            type="button"
            :class="{ active: settings.mode === 'api' }"
            @click="settings.mode = 'api'"
          >
            接口截图
          </button>
          <button
            type="button"
            :class="{ active: settings.mode === 'iframe' }"
            @click="settings.mode = 'iframe'"
          >
            iframe 预览
          </button>
        </div>

        <button
          v-if="settings.mode === 'api'"
          class="btn hide-sm"
          type="button"
          :disabled="busy || !enabledCount"
          @click="captureAll"
        >
          <Icon name="refresh" :size="15" />
          {{ busy ? '抓取中…' : '抓取截图' }}
        </button>

        <button
          class="btn btn-primary hide-sm"
          type="button"
          :disabled="!canExport"
          @click="exportPoster"
        >
          <Icon name="download" :size="15" />
          导出海报
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="sidebar" :class="{ open: sheetOpen }">
        <span class="sheet-handle" />
        <div class="sidebar-head">
          <h2>设置</h2>
          <div class="sidebar-head-actions">
            <button class="text-btn" type="button" @click="resetAll">恢复默认</button>
            <button class="icon-btn only-sm" type="button" title="关闭" @click="sheetOpen = false">
              <Icon name="close" :size="16" />
            </button>
          </div>
        </div>
        <SettingsPanel
          :settings="settings"
          :slots="slots"
          :busy="busy"
          :mode="settings.mode"
          @upload="onUpload"
        />
      </aside>

      <div v-if="sheetOpen" class="scrim" @click="sheetOpen = false" />

      <section class="view">
        <div class="stage-shell">
          <PosterStage
            :mode="settings.mode"
            :specs="enabledDevices"
            :shots="shotMap"
            :url-for="urlFor"
            :background="settings.background"
            :fit="settings.fit"
            :editing="editingLayout"
            @move="moveDevice"
          >
            <template #overlay>
              <transition name="fade">
                <p v-if="stageHint && !editingLayout" class="stage-hint">{{ stageHint }}</p>
              </transition>
            </template>
          </PosterStage>

          <div class="layout-bar" :class="{ editing: editingLayout }">
            <template v-if="editingLayout">
              <span class="layout-note">拖动设备摆位置，方向键可微调</span>
              <button class="layout-btn" type="button" :disabled="!hasCustomLayout" @click="resetLayout">
                恢复默认
              </button>
              <button class="layout-btn solid" type="button" @click="editingLayout = false">完成</button>
            </template>
            <button v-else class="layout-btn" type="button" @click="editingLayout = true">
              <Icon name="move" :size="14" />
              调整布局
            </button>
          </div>
        </div>
      </section>
    </main>

    <footer class="page-foot">
      <span v-if="settings.mode === 'iframe'" class="mode-badge">
        <span class="dot" />实时预览
      </span>
      <span class="foot-text">
        <template v-if="settings.mode === 'api' && settings.provider === 'xxapi'">
          1920 × 1080 画布 · 截图由 XXAPI 实时渲染
        </template>
        <template v-else-if="settings.mode === 'api'">
          1920 × 1080 画布 · 截图由 WordPress mshots 渲染，首次约几秒、缓存 12 小时
        </template>
        <template v-else>实时加载目标站点，受 X-Frame-Options / CSP 限制时可能空白，不支持导出</template>
      </span>
    </footer>

    <div class="dock">
      <button class="dock-btn" type="button" :disabled="busy" @click="captureAll">
        <Icon name="refresh" :size="18" />
        <span>抓取</span>
      </button>
      <button class="dock-btn primary" type="button" :disabled="!canExport" @click="exportPoster">
        <Icon name="download" :size="18" />
        <span>导出</span>
      </button>
      <button class="dock-btn" type="button" @click="sheetOpen = true">
        <Icon name="sliders" :size="18" />
        <span>设置</span>
      </button>
    </div>

    <transition name="toast">
      <div v-if="toastText && !sheetOpen" class="toast">{{ toastText }}</div>
    </transition>
  </div>
</template>

<style scoped>
.app {
  /* 页面高度锁死在一屏内：右侧画布按剩余空间定高，左侧设置栏超了自己滚，
     不会被设置项变多拽着一起变高 */
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 64px;
  padding: 0 24px;
  background: rgba(244, 243, 240, 0.82);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--ink);
  color: #f7f6f3;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}

.brand-text strong {
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.brand-text small {
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
}

.topbar-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.segmented.mode button {
  padding: 0 12px;
  height: 30px;
}

.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: 304px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
  width: 100%;
  max-width: 1720px;
  margin: 0 auto;
  padding: 20px 22px 0;
  min-height: 0;
}

.sidebar {
  display: flex;
  flex-direction: column;
  padding: 0;
  border-radius: 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
  height: 100%;
  min-height: 0;
  /* 卡片自己不留滚动：滚动交给内部的 .panel-body，滚动条就不会戳出圆角 */
  overflow: hidden;
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--line);
}

.sidebar-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.sidebar-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.text-btn {
  padding: 4px 8px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--muted);
  font-size: 12.5px;
  cursor: pointer;
  transition: color 0.16s ease, background 0.16s ease;
}

.text-btn:hover {
  color: var(--ink);
  background: var(--surface-2);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}

.only-sm {
  display: none;
}

.sheet-handle {
  display: none;
}

.scrim {
  display: none;
}

.view {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.stage-shell {
  flex: 1;
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 0;
  border-radius: 20px;
  border: 1px solid var(--line);
  box-shadow: 0 1px 2px rgba(26, 22, 16, 0.06), 0 26px 60px -34px rgba(26, 22, 16, 0.5);
  overflow: hidden;
}

.layout-bar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid var(--line);
  box-shadow: 0 12px 28px -18px rgba(26, 22, 16, 0.6);
  backdrop-filter: blur(12px);
}

.layout-bar.editing {
  border-color: var(--line-strong);
}

.layout-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--ink);
  font-size: 12.5px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.16s ease, opacity 0.16s ease;
}

.layout-btn:hover:not(:disabled) {
  background: var(--surface-2);
}

.layout-btn:disabled {
  opacity: 0.38;
  cursor: default;
}

.layout-btn.solid {
  background: var(--ink);
  color: #f7f6f3;
}

.layout-btn.solid:hover {
  background: #2e2b26;
}

.layout-note {
  padding: 0 10px 0 12px;
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
}

.stage-hint {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  margin: 0;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(25, 24, 22, 0.72);
  color: #f7f6f3;
  font-size: 12.5px;
  white-space: nowrap;
  backdrop-filter: blur(6px);
  pointer-events: none;
}

.page-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 24px 16px;
  min-height: 44px;
}

.mode-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink);
  font-size: 11.5px;
}

.mode-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
}

.foot-text {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
  text-align: center;
}

.dock {
  display: none;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 62px;
  transform: translateX(-50%);
  padding: 9px 16px;
  border-radius: 999px;
  background: rgba(25, 24, 22, 0.92);
  color: #f7f6f3;
  font-size: 13px;
  z-index: 80;
  box-shadow: 0 18px 40px -20px rgba(0, 0, 0, 0.6);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (max-width: 1279px) {
  .workspace {
    grid-template-columns: 288px minmax(0, 1fr);
    gap: 18px;
    padding: 18px 18px 0;
  }
}

@media (max-width: 1023px) {
  .app {
    /* 小屏是抽屉式设置栏，回到普通文档流高度 */
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }

  .topbar {
    height: 58px;
    padding: 0 14px;
  }

  .hide-sm {
    display: none;
  }

  .only-sm {
    display: grid;
  }

  .brand-text small {
    display: none;
  }

  .workspace {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
    gap: 0;
    align-content: center;
    min-height: 0;
    padding: 14px 12px 0;
  }

  .stage-shell {
    flex: none;
    max-width: 100%;
  }

  .view {
    min-height: 0;
  }

  .page-foot {
    padding: 10px 12px calc(96px + env(safe-area-inset-bottom));
  }

  .sidebar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 70;
    height: auto;
    max-height: 82vh;
    border-radius: 22px 22px 0 0;
    border-bottom: 0;
    padding: 12px 0 calc(16px + env(safe-area-inset-bottom));
    transform: translateY(101%);
    transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
    box-shadow: 0 -20px 50px -24px rgba(26, 22, 16, 0.45);
    top: auto;
  }

  .sidebar-head {
    padding: 2px 18px 12px;
  }

  .sheet-handle {
    display: block;
    width: 38px;
    height: 4px;
    margin: 0 auto 4px;
    border-radius: 999px;
    background: var(--line-strong);
  }

  .sidebar.open {
    transform: translateY(0);
  }

  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 65;
    background: rgba(25, 24, 22, 0.38);
    backdrop-filter: blur(2px);
  }

  .dock {
    display: flex;
    align-items: center;
    gap: 6px;
    position: fixed;
    left: 50%;
    bottom: calc(16px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 60;
    padding: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid var(--line);
    box-shadow: 0 16px 40px -18px rgba(26, 22, 16, 0.5);
    backdrop-filter: blur(14px);
  }

  .dock-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--ink);
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.16s ease, opacity 0.16s ease;
  }

  .dock-btn:active {
    background: var(--surface-2);
  }

  .dock-btn:disabled {
    opacity: 0.38;
  }

  .dock-btn.primary {
    background: var(--ink);
    color: #f7f6f3;
  }

  .foot-text {
    font-size: 11.5px;
  }

  .toast {
    bottom: calc(84px + env(safe-area-inset-bottom));
  }
}

@media (max-width: 560px) {
  .brand-text strong {
    font-size: 13.5px;
  }

  .segmented.mode button {
    padding: 0 9px;
    font-size: 12px;
  }

  .stage-hint {
    /* 小屏上画布几乎贴满卡片，气泡无处可放，交给底部 dock 的「抓取」按钮引导 */
    display: none;
  }

  .layout-bar {
    top: 8px;
    left: 8px;
  }

  .layout-note {
    display: none;
  }
}
</style>
