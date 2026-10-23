<script setup>
/**
 * Componente raíz. Solo monta el <RouterView>: el layout (sidebar + header)
 * se aplica desde la definición de rutas.
 */
import { RouterView } from 'vue-router'
import ToastContainer from './components/ui/ToastContainer.vue'
</script>

<template>
  <RouterView />
  <ToastContainer />
</template>
