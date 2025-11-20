<template>
  <div class="language-toggle">
    <select :value="locale" @change="handleChange" class="language-select">
      <option value="en_US">English</option>
      <option value="zh_CN">简体中文</option>
      <option value="zh_TW">繁體中文</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editorStore'
import type { Locale } from '@/utils/i18n'

const store = useEditorStore()
const locale = computed(() => store.locale)

function handleChange(e: Event) {
  const target = e.target as HTMLSelectElement
  store.setLocale(target.value as Locale)
}
</script>

<style scoped>
.language-toggle {
  display: flex;
  align-items: center;
}

.language-select {
  padding: 0.75rem 0.875rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  cursor: pointer;
  font-size: 0.9rem;
  min-height: 44px;
  touch-action: manipulation;
  color: #3c3c3c;
  flex-shrink: 0;
  white-space: nowrap;
}

.language-select:focus {
  outline: 2px solid #a67c52;
  outline-offset: 2px;
}

.language-select:active {
  border-color: #b8a99a;
}
</style>

