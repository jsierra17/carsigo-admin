<script setup>
/** Campos de formulario reutilizables: label, hint, error y control. */
defineProps({
  label: { type: String, required: true },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  step: { type: [String, Number], default: undefined },
  min: { type: [String, Number], default: undefined },
})
</script>

<template>
  <label class="block">
    <span class="mb-1 block text-xs font-medium text-neutral-600">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </span>
    <slot />
    <span v-if="error" class="mt-1 block text-xs text-red-600">{{ error }}</span>
    <span v-else-if="hint" class="mt-1 block text-xs text-neutral-400">{{ hint }}</span>
  </label>
</template>
