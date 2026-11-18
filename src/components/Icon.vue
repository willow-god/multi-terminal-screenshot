<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    size?: number
    stroke?: number
  }>(),
  { size: 18, stroke: 1.8 },
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'monitor' || name === 'computer'">
      <rect x="2.5" y="3.5" width="19" height="13.5" rx="2.2" />
      <path d="M8.5 21h7M12 17v4" />
    </template>
    <template v-else-if="name === 'laptop'">
      <rect x="4.5" y="4" width="15" height="10.5" rx="1.6" />
      <path d="M2 18.5h20l-1.8-4H3.8z" />
    </template>
    <template v-else-if="name === 'tablet'">
      <rect x="4.5" y="2.5" width="15" height="19" rx="2.4" />
      <path d="M11 18.5h2" />
    </template>
    <template v-else-if="name === 'phone'">
      <rect x="7" y="2.5" width="10" height="19" rx="2.4" />
      <path d="M11 18.5h2" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M20.5 12a8.5 8.5 0 1 1-2.4-5.9" />
      <path d="M20.5 3.5v5.8h-5.8" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 3.5v11.5M7 10.5l5 5 5-5M4.5 20.5h15" />
    </template>
    <template v-else-if="name === 'upload'">
      <path d="M12 16V3.5M7 8.5l5-5 5 5M4.5 20.5h15" />
    </template>
    <template v-else-if="name === 'camera'">
      <path d="M3 8.5h3.2l1.7-2.6h8.2l1.7 2.6H21v10.6H3z" />
      <circle cx="12" cy="13.6" r="3.2" />
    </template>
    <template v-else-if="name === 'link'">
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18.5 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5h4.5" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12.5 4.5 4.5L19 6.5" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="M6 6l12 12M18 6 6 18" />
    </template>
    <template v-else-if="name === 'image'">
      <rect x="3" y="3.5" width="18" height="17" rx="2.6" />
      <circle cx="8.7" cy="9.2" r="1.5" />
      <path d="m20.5 15-4.6-4.6L6.5 20" />
    </template>
    <template v-else-if="name === 'expand'">
      <path d="M8.5 3.5H5A1.5 1.5 0 0 0 3.5 5v3.5M15.5 3.5H19A1.5 1.5 0 0 1 20.5 5v3.5M8.5 20.5H5A1.5 1.5 0 0 1 3.5 19v-3.5M15.5 20.5H19a1.5 1.5 0 0 0 1.5-1.5v-3.5" />
    </template>
    <template v-else-if="name === 'frame'">
      <rect x="3" y="4" width="12" height="16" rx="2" />
      <path d="M15 9h3.5a2.5 2.5 0 0 1 2.5 2.5V18a2 2 0 0 1-2 2H15" />
    </template>
    <template v-else-if="name === 'move'">
      <path d="M12 3.5v17M3.5 12h17" />
      <path d="m9 6.5 3-3 3 3M9 17.5l3 3 3-3M6.5 9l-3 3 3 3M17.5 9l3 3-3 3" />
    </template>
    <template v-else-if="name === 'sliders'">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="8" />
    </template>
  </svg>
</template>
