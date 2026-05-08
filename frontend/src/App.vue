<script setup lang="ts">
import type { ToasterProps } from "@nuxt/ui";
import ActivityBar from "@renderer/components/layout/ActivityBar.vue";
import AppHeader from "@renderer/components/layout/AppHeader.vue";
import AppLayout from "@renderer/layouts/AppLayout.vue";

const toasterOptions: ToasterProps = {
  position: "top-center",
  progress: false,
  duration: 2000,
};
</script>

<template>
  <Suspense>
    <UApp :toaster="toasterOptions">
      <AppLayout>
        <template #header>
          <AppHeader />
        </template>

        <template #side>
          <ActivityBar />
        </template>

        <RouterView />
      </AppLayout>
    </UApp>
  </Suspense>
</template>
