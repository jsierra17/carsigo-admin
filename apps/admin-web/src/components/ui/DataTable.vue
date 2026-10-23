<script setup>
/**
 * Tabla de datos genérica.
 *
 * `columns`: [{ key, label, align?, width?, format?, value? }]
 * Se expone la fila con `#cell-<key>="{ row, value }"` para contenido personalizado.
 */
import { Loader2 } from 'lucide-vue-next'

defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: 'Sin registros' },
  rowKey: { type: String, default: 'id' },
})

function valueOf(row, column) {
  const raw = column.value ? column.value(row) : row[column.key]
  if (column.format) return column.format(raw, row)
  return raw ?? '—'
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
    <div
      v-if="loading"
      class="flex items-center justify-center gap-2 p-10 text-sm text-neutral-500"
    >
      <Loader2 :size="16" class="animate-spin" />
      Cargando…
    </div>

    <div v-else-if="!rows.length" class="p-10 text-center text-sm text-neutral-500">
      {{ emptyText }}
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-full text-left text-sm">
        <thead
          class="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"
        >
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              class="whitespace-nowrap px-4 py-3 font-semibold"
              :class="
                column.align === 'right'
                  ? 'text-right'
                  : column.align === 'center'
                    ? 'text-center'
                    : ''
              "
              :style="column.width ? { width: column.width } : null"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          <tr v-for="row in rows" :key="row[rowKey]" class="hover:bg-neutral-50/60">
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 align-middle text-neutral-700"
              :class="
                column.align === 'right'
                  ? 'text-right tabular-nums'
                  : column.align === 'center'
                    ? 'text-center'
                    : ''
              "
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="valueOf(row, column)">
                {{ valueOf(row, column) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
