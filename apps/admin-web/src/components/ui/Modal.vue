<script setup>
/** Modal genérico con overlay, cierre por Escape y por clic en el fondo. */
import { onBeforeUnmount, onMounted } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg | xl
})

const emit = defineEmits(['update:modelValue'])

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

function close() {
  emit('update:modelValue', false)
}

function onKeydown(e) {
  if (e.key === 'Escape' && props.modelValue) close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/50 p-4 backdrop-blur-sm"
      @click.self="close"
    >
      <div
        class="my-8 w-full rounded-2xl bg-white shadow-xl"
        :class="sizes[size] || sizes.md"
      >
        <div
          class="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4"
        >
          <h2 class="text-base font-semibold text-neutral-900">{{ title }}</h2>
          <button
            class="rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            @click="close"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="px-5 py-4">
          <slot />
        </div>

        <div
          v-if="$slots.footer"
          class="flex justify-end gap-2 border-t border-neutral-200 px-5 py-4"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
