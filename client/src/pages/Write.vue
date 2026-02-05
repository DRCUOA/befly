<template>
  <div>
    <h1 class="text-3xl font-bold mb-6">Write</h1>
    <form class="space-y-4">
      <div>
        <label for="title" class="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="title"
          type="text"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          placeholder="Enter title..."
        />
      </div>
      <div>
        <label for="body" class="block text-sm font-medium text-gray-700">
          Body
        </label>
        <textarea
          id="body"
          rows="10"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          placeholder="Write your thoughts..."
        />
      </div>
      <button
        type="submit"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Publish
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
// Write page - create/edit writing blocks
</script>
