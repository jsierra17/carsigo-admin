<script setup>
/**
 * Administradores: lista de usuarios con rol admin/superadmin.
 *
 * El cambio de rol se hace vía la Admin API (`POST /api/admin/users/:uid/role`),
 * que valida el custom claim `superadmin` y actualiza los custom claims de
 * Firebase Auth + el espejo en `users/{uid}.role`.
 */
import { onMounted, ref } from 'vue'
import { Pencil, Power, ShieldCheck } from 'lucide-vue-next'
import DataTable from '../components/ui/DataTable.vue'
import Modal from '../components/ui/Modal.vue'
import Badge from '../components/ui/Badge.vue'
import FormField from '../components/ui/FormField.vue'
import { administradoresService } from '../services/data.js'
import { adminApi } from '../services/api.js'
import { useAsyncData } from '../composables/useAsyncData.js'
import { useToast } from '../composables/useToast.js'
import { useAuthStore } from '../stores/auth.js'

const toast = useToast()
const authStore = useAuthStore()

const admins = ref([])
const roleModal = ref({ open: false, item: null, role: 'admin' })
const busy = ref(false)

const data = useAsyncData(() => administradoresService.list())

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'email', label: 'Correo' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'role', label: 'Rol' },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: '', align: 'right' },
]

async function load() {
  const result = await data.refresh()
  if (result) admins.value = result
}

onMounted(load)

function openRoleModal(item) {
  roleModal.value = { open: true, item, role: item.role === 'superadmin' ? 'superadmin' : 'admin' }
}

async function saveRole() {
  const { item, role } = roleModal.value
  if (!item || item.role === role) {
    roleModal.value.open = false
    return
  }
  busy.value = true
  try {
    await adminApi.setUserRole(item.id, role)
    toast.success(`Rol actualizado a ${role}`)
    roleModal.value.open = false
    await load()
    // Si el usuario actual cambió su propio rol, refresca su token
    if (item.id === authStore.user?.uid) await authStore.refreshToken()
  } catch (e) {
    toast.error(e?.message || 'No se pudo actualizar el rol')
  } finally {
    busy.value = false
  }
}

async function toggle(item) {
  try {
    await administradoresService.toggleStatus(item.id, item.status)
    toast.success(item.status === 'active' ? 'Administrador desactivado' : 'Administrador activado')
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo actualizar el estado')
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-neutral-900">Administradores</h2>
      <p class="text-sm text-neutral-500">
        {{ admins.length }} usuario(s) con acceso al panel
      </p>
    </div>

    <div
      v-if="!authStore.isSuperAdmin"
      class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <ShieldCheck :size="16" class="shrink-0" />
      Solo un <strong>super admin</strong> puede cambiar roles o crear administradores.
    </div>

    <DataTable
      :columns="columns"
      :rows="admins"
      :loading="data.loading.value"
      empty-text="No hay administradores"
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-2">
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full bg-carsigo-50 text-xs font-semibold text-carsigo-700"
          >
            {{ (row.name || '?').charAt(0).toUpperCase() }}
          </span>
          <span class="font-medium text-neutral-800">{{ row.name || '—' }}</span>
        </div>
      </template>

      <template #cell-role="{ row }">
        <Badge :label="row.role" />
      </template>

      <template #cell-status="{ row }">
        <Badge :label="row.status" />
      </template>

      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1">
          <button
            class="rounded p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-carsigo-600 disabled:opacity-40"
            title="Cambiar rol"
            :disabled="!authStore.isSuperAdmin"
            @click="openRoleModal(row)"
          >
            <Pencil :size="15" />
          </button>
          <button
            class="rounded p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-amber-600 disabled:opacity-40"
            title="Activar / desactivar"
            :disabled="!authStore.isSuperAdmin"
            @click="toggle(row)"
          >
            <Power :size="15" />
          </button>
        </div>
      </template>
    </DataTable>

    <Modal
      :model-value="roleModal.open"
      :title="`Rol de ${roleModal.item?.name || ''}`"
      size="sm"
      @update:model-value="roleModal.open = $event"
    >
      <FormField label="Rol" required hint="El cambio aplica a los custom claims de Firebase Auth">
        <select
          v-model="roleModal.role"
          class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
        >
          <option value="admin">Admin</option>
          <option value="superadmin">Super admin</option>
          <option value="driver">Conductor</option>
          <option value="passenger">Pasajero</option>
        </select>
      </FormField>

      <p class="mt-3 text-xs text-neutral-500">
        Tras el cambio, el usuario debe renovar su token para que el nuevo rol tenga efecto.
      </p>

      <template #footer>
        <button
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="roleModal.open = false"
        >
          Cancelar
        </button>
        <button
          class="rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700 disabled:opacity-60"
          :disabled="busy"
          @click="saveRole"
        >
          {{ busy ? 'Guardando…' : 'Guardar rol' }}
        </button>
      </template>
    </Modal>
  </div>
</template>
