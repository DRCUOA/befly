<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <router-link
              to="/"
              class="inline-flex items-center px-2 pt-1 text-sm font-medium text-gray-900"
            >
              Writing Platform
            </router-link>
          </div>
          <div class="flex space-x-4">
            <router-link
              to="/write"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Write
            </router-link>
            <router-link
              to="/themes"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Themes
            </router-link>
            <router-link
              to="/profile"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Profile
            </router-link>
          </div>
        </div>
      </div>
    </nav>
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
// Default layout wrapper
</script>
