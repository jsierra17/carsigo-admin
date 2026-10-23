<script setup>
/** Etiqueta de estado con paleta semántica automática. */
const props = defineProps({
  label: { type: String, required: true },
  tone: { type: String, default: 'auto' },
})

const TONES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  day: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  night: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  suspended: 'bg-red-50 text-red-700 ring-red-600/20',
  cancelled: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
  inactive: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
  accepted: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  activeTrip: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  superadmin: 'bg-carsigo-50 text-carsigo-700 ring-carsigo-600/20',
}

const LABELS = {
  active: 'Activo',
  approved: 'Aprobado',
  completed: 'Completado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
  inactive: 'Inactivo',
  accepted: 'Aceptado',
  inProgress: 'En curso',
  activeTrip: 'En curso',
  day: 'Día',
  night: 'Noche',
  car: 'Carro',
  moto: 'Moto',
  admin: 'Admin',
  superadmin: 'Super admin',
  passenger: 'Pasajero',
  driver: 'Conductor',
  weekday: 'Lun–Jue',
  weekend: 'Vie–Dom',
  special: 'Especial',
}

function resolveTone() {
  if (props.tone !== 'auto') return TONES[props.tone] || TONES.inactive
  return TONES[props.label] || TONES.inactive
}

function resolveLabel() {
  return LABELS[props.label] || props.label
}
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
    :class="resolveTone()"
  >
    {{ resolveLabel() }}
  </span>
</template>
