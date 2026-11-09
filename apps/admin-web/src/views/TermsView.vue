<script setup>
/**
 * Términos y condiciones del panel (ruta pública /terminos).
 * Documento informativo estático: describe el uso del panel admin,
 * los datos que procesa y el contacto del responsable.
 */
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-200">
    <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <button
        class="inline-flex items-center gap-2 text-sm font-medium text-neutral-400 transition hover:text-carsigo-400"
        @click="router.back()"
      >
        <ArrowLeft :size="16" />
        Volver
      </button>

      <img
        src="/assets/logo.png"
        alt="CarSiGo"
        class="mt-8 h-10 w-auto"
      />

      <h1 class="mt-6 text-2xl font-bold tracking-tight text-neutral-50">
        Términos y condiciones
      </h1>
      <p class="mt-1 text-sm text-neutral-500">
        Última actualización: noviembre de 2026
      </p>

      <div class="mt-8 space-y-6 text-sm leading-relaxed text-neutral-300">
        <section>
          <h2 class="text-base font-semibold text-neutral-100">1. Objeto</h2>
          <p class="mt-2">
            CarSiGo es una plataforma de transporte hiperlocal que conecta
            pasajeros y conductores dentro del municipio de El Carmen de
            Bolívar (Bolívar, Colombia). Este sitio administara la operación:
            zonas de cobertura, tarifas, turnos, conductores y viajes.
          </p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-neutral-100">2. Uso del panel</h2>
          <p class="mt-2">
            El acceso al panel administrativo está restringido a personal
            autorizado por el titular de la operación. Las cuentas son
            personales e intransferibles; el administrador es responsable de
            la confidencialidad de sus credenciales.
          </p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-neutral-100">3. Datos tratados</h2>
          <p class="mt-2">
            La plataforma procesa datos de identificación, ubicación de viajes
            y documentación vehicular exclusivamente para operar el servicio:
            asignar viajes, liquidar comisiones y verificar conductores. No se
            venden ni comparten con terceros con fines ajenos a la operación.
          </p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-neutral-100">4. Tarifas</h2>
          <p class="mt-2">
            Las tarifas se calculan con la configuración vigente de cada zona
            (tarifa base, tramos por distancia, turnos y multiplicadores de
            precio dinámico). Las tarifas se muestran siempre antes de confirmar
            el viaje en la aplicación móvil.
          </p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-neutral-100">5. Contacto</h2>
          <p class="mt-2">
            Para consultas sobre estos términos escribe al correo del
            administrador de la plataforma registrado en la cuenta del
            servicio.
          </p>
        </section>
      </div>

      <p class="mt-12 text-xs text-neutral-600">
        © {{ new Date().getFullYear() }} CarSiGo · Transporte hiperlocal
      </p>
    </div>
  </div>
</template>
