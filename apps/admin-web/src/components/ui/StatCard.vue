<script setup>
/** Tarjeta de métrica para el dashboard. */
defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: 0 },
  hint: { type: String, default: '' },
  icon: { type: Object, default: null },
  tone: { type: String, default: 'default' },
})

const tones = {
  default: 'bg-neutral-50 text-neutral-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
  brand: 'bg-carsigo-50 text-carsigo-600',
}
</script>

<template>
  <div class="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-xs font-medium uppercase tracking-wide text-neutral-500">
          {{ label }}
        </p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{{ value }}</p>
        <p v-if="hint" class="mt-0.5 truncate text-xs text-neutral-400">{{ hint }}</p>
      </div>
      <span
        v-if="icon"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        :class="tones[tone] || tones.default"
      >
        <component :is="icon" :size="18" />
      </span>
    </div>
  </div>
</template>
