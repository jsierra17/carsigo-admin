/**
 * Rutas del panel de administración.
 *
 * Las vistas se cargan de forma diferida (lazy) para no penalizar el bundle
 * inicial. Los archivos en `src/views/` son stubs: la implementación real de
 * cada pantalla se generará en la siguiente iteración.
 */
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true, title: 'Iniciar sesión' },
  },
  {
    path: '/',
    component: () => import('../layouts/AdminLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { title: 'Dashboard', icon: 'LayoutDashboard' },
      },
      {
        path: 'zonas',
        name: 'zonas',
        component: () => import('../views/ZonasView.vue'),
        meta: { title: 'Zonas y cobertura', icon: 'Map' },
      },
      {
        path: 'tarifas',
        name: 'tarifas',
        component: () => import('../views/TarifasView.vue'),
        meta: { title: 'Tarifas', icon: 'Coins' },
      },
      {
        path: 'precio-dinamico',
        name: 'precio-dinamico',
        component: () => import('../views/PrecioDinamicoView.vue'),
        meta: { title: 'Precio dinámico', icon: 'TrendingUp' },
      },
      {
        path: 'conductores',
        name: 'conductores',
        component: () => import('../views/ConductoresView.vue'),
        meta: { title: 'Conductores', icon: 'Car' },
      },
      {
        path: 'solicitudes',
        name: 'solicitudes',
        component: () => import('../views/SolicitudesView.vue'),
        meta: { title: 'Solicitudes', icon: 'ClipboardCheck' },
      },
      {
        path: 'viajes',
        name: 'viajes',
        component: () => import('../views/ViajesView.vue'),
        meta: { title: 'Viajes', icon: 'Route' },
      },
      {
        path: 'finanzas',
        name: 'finanzas',
        component: () => import('../views/FinanzasView.vue'),
        meta: { title: 'Finanzas', icon: 'Wallet' },
      },
      {
        path: 'administradores',
        name: 'administradores',
        component: () => import('../views/AdministradoresView.vue'),
        meta: { title: 'Administradores', icon: 'ShieldCheck' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { public: true, title: 'Página no encontrada' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * Guarda global: exige sesión para todo lo que no sea público.
 * Tras el login se redirige a la ruta solicitada (o al dashboard).
 */
router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // Espera a que la sesión se resuelva antes de decidir.
  if (authStore.loading) {
    await new Promise((resolve) => {
      const stop = setInterval(() => {
        if (!authStore.loading) {
          clearInterval(stop)
          resolve()
        }
      }, 50)
    })
  }

  document.title = to.meta?.title
    ? `${to.meta.title} · CarSiGo`
    : 'CarSiGo · Panel de administración'

  if (to.meta?.public) {
    // Si ya está autenticado y va al login, al dashboard.
    if (to.name === 'login' && authStore.isAuthenticated) return { name: 'dashboard' }
    return true
  }

  if (!authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  return true
})

export default router
