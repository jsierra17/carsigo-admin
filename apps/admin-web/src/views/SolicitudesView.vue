<script setup>
/**
 * Solicitudes de conductor: revisión de documentos y aprobación/rechazo.
 *
 * Colección `driver_applications`. Al aprobar, el usuario pasa a rol `driver`
 * y se crea su `driver_profile`.
 */
import { computed, onMounted, ref } from 'vue'
import { Check, FileText, X } from 'lucide-vue-next'
import Modal from '../components/ui/Modal.vue'
import Badge from '../components/ui/Badge.vue'
import { solicitudesService } from '../services/data.js'
import { useAsyncData } from '../composables/useAsyncData.js'
import { useToast } from '../composables/useToast.js'

const toast = useToast()

const applications = ref([])
const filter = ref('pending')
const detail = ref({ open: false, item: null })
const busy = ref(false)

const data = useAsyncData(() => solicitudesService.list(filter.value))

const FILTERS = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'approved', label: 'Aprobadas' },
  { id: 'rejected', label: 'Rechazadas' },
  { id: 'all', label: 'Todas' },
]

const counts = computed(() => ({
  pending: applications.value.filter((a) => a.status === 'pending').length,
}))

async function load() {
  const result = await data.refresh()
  if (result) applications.value = result
}

onMounted(load)

async function changeFilter(value) {
  filter.value = value
  await load()
}

async function review(item, status) {
  busy.value = true
  try {
    await solicitudesService.review(item.id, status)
    toast.success(status === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada')
    detail.value.open = false
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo actualizar la solicitud')
  } finally {
    busy.value = false
  }
}

const DOCUMENTS = [
  { key: 'cedula_frente_url', label: 'Cédula (frente)', required: true },
  { key: 'cedula_reverso_url', label: 'Cédula (reverso)', required: true },
  { key: 'licencia_url', label: 'Licencia de conducción', required: true },
  { key: 'propiedad_url', label: 'Tarjeta de propiedad', required: true },
  { key: 'seguro_url', label: 'Seguro', required: false },
  { key: 'soat_url', label: 'SOAT', required: false },
]

function formatDate(value) {
  if (!value) return '—'
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-neutral-900">Solicitudes de conductor</h2>
        <p class="text-sm text-neutral-500">
          Revisa los documentos antes de aprobar al conductor
        </p>
      </div>

      <div class="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
        <button
          v-for="f in FILTERS"
          :key="f.id"
          class="rounded-md px-3 py-1.5 text-sm font-medium transition"
          :class="
            filter === f.id ? 'bg-carsigo-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'
          "
          @click="changeFilter(f.id)"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <div
      v-if="data.loading.value"
      class="rounded-xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500"
    >
      Cargando solicitudes…
    </div>

    <div
      v-else-if="!applications.length"
      class="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center"
    >
      <FileText :size="30" class="mx-auto text-neutral-300" />
      <p class="mt-2 text-sm font-medium text-neutral-700">No hay solicitudes en este filtro</p>
    </div>

    <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="app in applications"
        :key="app.id"
        class="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="truncate text-sm font-semibold text-neutral-800">
              {{ app.full_name || app.name || 'Sin nombre' }}
            </h3>
            <p class="truncate text-xs text-neutral-500">
              {{ app.vehicle_type === 'car' ? 'Carro' : 'Moto' }}
              <template v-if="app.plate"> · {{ app.plate }}</template>
            </p>
          </div>
          <Badge :label="app.status" />
        </div>

        <dl class="mt-3 space-y-1 text-xs text-neutral-600">
          <div class="flex justify-between gap-2">
            <dt>Correo</dt>
            <dd class="truncate">{{ app.email || '—' }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt>Teléfono</dt>
            <dd>{{ app.phone || '—' }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt>Vehículo</dt>
            <dd class="truncate">
              {{ [app.brand, app.model, app.color].filter(Boolean).join(' · ') || '—' }}
            </dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt>Enviada</dt>
            <dd>{{ formatDate(app.created_at) }}</dd>
          </div>
        </dl>

        <div class="mt-4 flex gap-2 border-t border-neutral-100 pt-3">
          <button
            class="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
            @click="detail = { open: true, item: app }"
          >
            Ver documentos
          </button>
          <template v-if="app.status === 'pending'">
            <button
              class="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              :disabled="busy"
              title="Aprobar"
              @click="review(app, 'approved')"
            >
              <Check :size="14" />
            </button>
            <button
              class="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              :disabled="busy"
              title="Rechazar"
              @click="review(app, 'rejected')"
            >
              <X :size="14" />
            </button>
          </template>
        </div>
      </article>
    </div>

    <!-- Detalle de documentos -->
    <Modal
      :model-value="detail.open"
      :title="`Documentos · ${detail.item?.full_name || detail.item?.name || ''}`"
      size="lg"
      @update:model-value="detail.open = $event"
    >
      <div v-if="detail.item" class="space-y-4">
        <div class="grid gap-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600 sm:grid-cols-3">
          <div>
            <span class="block text-neutral-400">Cédula</span>
            <span class="font-medium text-neutral-800">{{ detail.item.id_number || '—' }}</span>
          </div>
          <div>
            <span class="block text-neutral-400">Vehículo</span>
            <span class="font-medium text-neutral-800">
              {{ detail.item.vehicle_type === 'car' ? 'Carro' : 'Moto' }} · {{ detail.item.plate || '—' }}
            </span>
          </div>
          <div>
            <span class="block text-neutral-400">Estado</span>
            <Badge :label="detail.item.status" />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="doc in DOCUMENTS"
            :key="doc.key"
            class="overflow-hidden rounded-lg border border-neutral-200"
          >
            <div class="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2">
              <span class="text-xs font-medium text-neutral-700">
                {{ doc.label }}
                <span v-if="doc.required" class="text-red-500">*</span>
              </span>
              <a
                v-if="detail.item[doc.key]"
                :href="detail.item[doc.key]"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs font-medium text-carsigo-600 hover:underline"
              >
                Abrir
              </a>
            </div>
            <div class="flex h-40 items-center justify-center bg-neutral-100">
              <img
                v-if="detail.item[doc.key]"
                :src="detail.item[doc.key]"
                :alt="doc.label"
                class="h-full w-full object-contain"
                loading="lazy"
              />
              <span v-else class="text-xs text-neutral-400">No adjunto</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <button
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="detail.open = false"
        >
          Cerrar
        </button>
        <template v-if="detail.item?.status === 'pending'">
          <button
            class="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            :disabled="busy"
            @click="review(detail.item, 'rejected')"
          >
            <X :size="14" class="mr-1 inline" />
            Rechazar
          </button>
          <button
            class="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            :disabled="busy"
            @click="review(detail.item, 'approved')"
          >
            <Check :size="14" class="mr-1 inline" />
            Aprobar
          </button>
        </template>
      </template>
    </Modal>
  </div>
</template>
