<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { DEVICES, type DeviceKey, type DeviceSpec } from '../lib/devices'
import { BACKGROUNDS, type Settings } from '../lib/settings'

type Status = 'idle' | 'loading' | 'ready' | 'error'

const props = defineProps<{
  settings: Settings
  slots: Record<DeviceKey, { status: Status; error: string }>
  busy: boolean
  mode: 'api' | 'iframe'
}>()

const emit = defineEmits<{
  (event: 'upload', key: DeviceKey, file: File): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const uploadKey = ref<DeviceKey>('computer')
const keyVisible = ref(false)
/** 小小API（xxapi.cn）的密钥页 */
const API_KEY_URL = 'https://xxapi.cn/admin/api-keys'
/** 代理部署说明（gist） */
const PROXY_GUIDE_URL = 'https://gist.liushen.fun/LiuShen/cf-nginx'
/** XXAPI 的密钥（含 uak_ 前缀）最多 32 位，超了服务端会直接判为「参数不合法」 */
const keyTooLong = computed(() => props.settings.apiKey.trim().length > 32)

const STATUS_TEXT: Record<Status, string> = {
  idle: '未抓取',
  loading: '抓取中',
  ready: '就绪',
  error: '失败',
}

const ICON: Record<DeviceKey, string> = {
  computer: 'monitor',
  laptop: 'laptop',
  tablet: 'tablet',
  phone: 'phone',
}

function specName(spec: DeviceSpec): string {
  return spec.name
}

function pickUpload(key: DeviceKey): void {
  uploadKey.value = key
  fileInput.value?.click()
}

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('upload', uploadKey.value, file)
  input.value = ''
}

function toggleDevice(key: DeviceKey): void {
  props.settings.enabled[key] = !props.settings.enabled[key]
}

function onPerDevice(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  props.settings.perDevice = checked
  if (!checked) return
  const fallback = props.settings.url.trim()
  if (!fallback) return
  for (const spec of DEVICES) {
    if (!props.settings.urls[spec.key]) props.settings.urls[spec.key] = fallback
  }
}

function onCustomColor(event: Event): void {
  props.settings.background = (event.target as HTMLInputElement).value
}
</script>

<template>
  <div class="panel-body">
    <section class="group">
      <h3 class="group-title">网址</h3>
      <label class="field">
        <Icon name="link" :size="16" class="field-icon" />
        <input
          v-model.trim="settings.url"
          class="field-input"
          type="text"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="example.com"
        />
      </label>
      <label class="checkline">
        <input type="checkbox" :checked="settings.perDevice" @change="onPerDevice" />
        <span>每台设备使用不同网址</span>
      </label>
      <p v-if="mode === 'iframe'" class="group-hint">
        iframe 预览是实时嵌入目标站点，对方用 X-Frame-Options / CSP 禁止嵌入时会空白；这个模式只能看，不能导出。
      </p>
    </section>

    <section v-if="mode === 'api'" class="group">
      <h3 class="group-title">截图服务</h3>
      <div class="segmented small provider">
        <button
          type="button"
          :class="{ active: settings.provider === 'free' }"
          @click="settings.provider = 'free'"
        >
          免费服务
        </button>
        <button
          type="button"
          :class="{ active: settings.provider === 'xxapi' }"
          @click="settings.provider = 'xxapi'"
        >
          XXAPI
        </button>
      </div>

      <template v-if="settings.provider === 'xxapi'">
        <label class="field key-field">
          <input
            v-model.trim="settings.apiKey"
            class="field-input key-input"
            :type="keyVisible ? 'text' : 'password'"
            autocomplete="off"
            spellcheck="false"
            placeholder="Access Key"
          />
          <button class="key-toggle" type="button" @click="keyVisible = !keyVisible">
            {{ keyVisible ? '隐藏' : '显示' }}
          </button>
        </label>
        <p class="group-hint">
          小小API密钥
          <a :href="API_KEY_URL" target="_blank" rel="noreferrer noopener">获取密钥 ↗</a>
        </p>
        <p v-if="keyTooLong" class="group-hint warn">
          这串密钥有 {{ settings.apiKey.trim().length }} 个字符，Access Key 最多 32 位，
          很可能复制成了别的字段。
        </p>
      </template>
      <p v-else class="group-hint">公共截图服务，开箱即用，无需配置。</p>

      <label class="field proxy-field">
        <Icon class="field-icon" name="link" :size="15" />
        <input
          v-model.trim="settings.proxy"
          class="field-input"
          type="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="代理URL"
        />
      </label>
      <p class="group-hint">
        解决跨域代理，前往创建：
        <a :href="PROXY_GUIDE_URL" target="_blank" rel="noreferrer noopener">创建方法 ↗</a>
      </p>
    </section>

    <section class="group">
      <h3 class="group-title">设备</h3>
      <ul class="device-list">
        <li v-for="spec in DEVICES" :key="spec.key" class="device-row">
          <div class="device-head">
            <span class="device-icon"><Icon :name="ICON[spec.key]" :size="17" /></span>
            <span class="device-name">{{ specName(spec) }}</span>
            <span v-if="mode === 'api'" class="device-state" :class="slots[spec.key].status">
              {{ STATUS_TEXT[slots[spec.key].status] }}
            </span>
            <button
              v-if="mode === 'api'"
              class="icon-btn"
              type="button"
              title="上传自己的截图"
              @click="pickUpload(spec.key)"
            >
              <Icon name="upload" :size="15" />
            </button>
            <button
              class="toggle"
              type="button"
              :class="{ on: settings.enabled[spec.key] }"
              :aria-pressed="settings.enabled[spec.key]"
              :title="settings.enabled[spec.key] ? '从海报中隐藏' : '显示在海报中'"
              @click="toggleDevice(spec.key)"
            >
              <span />
            </button>
          </div>
          <input
            v-if="settings.perDevice"
            v-model.trim="settings.urls[spec.key]"
            class="device-url"
            type="text"
            inputmode="url"
            spellcheck="false"
            :placeholder="settings.url || 'example.com'"
          />
          <p v-if="mode === 'api' && slots[spec.key].status === 'error'" class="device-error">
            {{ slots[spec.key].error }}
          </p>
        </li>
      </ul>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
    </section>

    <section class="group">
      <h3 class="group-title">画布</h3>
      <div class="swatches">
        <button
          v-for="item in BACKGROUNDS"
          :key="item.label"
          type="button"
          class="swatch"
          :class="{ active: settings.background === item.value }"
          :style="{ background: item.value ?? 'transparent' }"
          :title="item.label"
          @click="settings.background = item.value"
        >
          <span v-if="item.value === null" class="swatch-alpha" />
        </button>
        <label class="swatch custom" title="自定义颜色">
          <input type="color" :value="settings.background || '#ffffff'" @input="onCustomColor" />
        </label>
      </div>

      <div class="row">
        <span class="row-label">画面适配</span>
        <div class="segmented small">
          <button
            type="button"
            :class="{ active: settings.fit === 'cover' }"
            @click="settings.fit = 'cover'"
          >
            填充
          </button>
          <button
            type="button"
            :class="{ active: settings.fit === 'contain' }"
            @click="settings.fit = 'contain'"
          >
            完整
          </button>
        </div>
      </div>

      <div v-if="mode === 'api'" class="row">
        <span class="row-label">导出倍率</span>
        <div class="segmented small">
          <button type="button" :class="{ active: settings.scale === 1 }" @click="settings.scale = 1">
            1×
          </button>
          <button type="button" :class="{ active: settings.scale === 2 }" @click="settings.scale = 2">
            2×
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.panel-body {
  display: flex;
  flex-direction: column;
  gap: 30px;
  flex: 1;
  min-height: 0;
  padding: 18px 20px 22px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

.panel-body::-webkit-scrollbar {
  width: 8px;
}

.panel-body::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: var(--line-strong);
  background-clip: content-box;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.group-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.field {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 12px;
  color: var(--muted);
  pointer-events: none;
}

.field-input {
  width: 100%;
  height: 40px;
  padding: 0 12px 0 36px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font-size: 14px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.field-input:focus {
  outline: none;
  border-color: var(--ink);
  box-shadow: 0 0 0 3px rgba(25, 24, 22, 0.08);
}

.checkline {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
}

.segmented.provider {
  align-self: flex-start;
}

.key-field .field-input {
  padding: 0 62px 0 12px;
  font-size: 13px;
  letter-spacing: 0.02em;
}

.key-toggle {
  position: absolute;
  right: 8px;
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}

.key-toggle:hover {
  color: var(--ink);
}

.group-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
}

.group-hint a {
  color: var(--ink);
  text-decoration: none;
  border-bottom: 1px solid var(--line-strong);
}

.group-hint.warn {
  color: var(--red);
}

.checkline input {
  width: 14px;
  height: 14px;
  accent-color: var(--ink);
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.device-row {
  padding: 6px 4px;
  border-radius: 10px;
}

.device-row:hover {
  background: var(--surface-2);
}

.device-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.device-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--ink);
}

.device-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: var(--ink);
}

.device-state {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

.device-state.ready {
  color: var(--green);
}

.device-state.error {
  color: var(--red);
}

.device-state.loading {
  color: var(--blue);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: color 0.16s ease, border-color 0.16s ease;
}

.icon-btn:hover {
  color: var(--ink);
  border-color: var(--line-strong);
}

.toggle {
  position: relative;
  width: 34px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--surface-2);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.toggle span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--muted);
  transition: transform 0.18s ease, background 0.18s ease;
}

.toggle.on {
  background: var(--ink);
  border-color: var(--ink);
}

.toggle.on span {
  background: #fff;
  transform: translateX(14px);
}

.device-url {
  width: 100%;
  margin-top: 8px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  font-size: 12.5px;
  color: var(--ink);
}

.device-url:focus {
  outline: none;
  border-color: var(--line-strong);
}

.device-error {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--red);
  line-height: 1.4;
}

.swatches {
  display: flex;
  align-items: center;
  gap: 8px;
}

.swatch {
  position: relative;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  cursor: pointer;
  transition: box-shadow 0.16s ease, transform 0.16s ease;
}

.swatch.active {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ink);
}

.swatch:hover {
  transform: translateY(-1px);
}

.swatch-alpha {
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background-image: linear-gradient(45deg, #ddd 25%, transparent 25%),
    linear-gradient(-45deg, #ddd 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ddd 75%),
    linear-gradient(-45deg, transparent 75%, #ddd 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0;
}

.swatch.custom {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: conic-gradient(#ff8a8a, #ffd28a, #a8f0b6, #8ad4ff, #c99bff, #ff8a8a);
}

.swatch.custom input {
  width: 200%;
  height: 200%;
  opacity: 0;
  cursor: pointer;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.row-label {
  font-size: 13px;
  color: var(--muted);
}
</style>
