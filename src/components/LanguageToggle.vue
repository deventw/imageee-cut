<template>
  <div class="language-toggle">
    <select :value="locale" @change="handleChange" class="language-select">
      <option value="en_US">EN</option>
      <option value="zh_CN">简</option>
      <option value="zh_TW">繁</option>
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
  padding: 0.4rem 0.5rem;
  border: 1px solid rgba(212, 196, 176, 0.3);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 0.7rem;
  min-height: 28px;
  touch-action: manipulation;
  color: #6b5d4f;
  flex-shrink: 0;
  white-space: nowrap;
  transition: all 0.2s ease;
  font-weight: 400;
}

.language-select:hover {
  background: rgba(240, 235, 227, 0.3);
  border-color: rgba(212, 196, 176, 0.6);
}

.language-select:focus {
  outline: 1px solid rgba(166, 124, 82, 0.4);
  outline-offset: 1px;
  background: rgba(240, 235, 227, 0.3);
}

.language-select:active {
  border-color: rgba(184, 169, 154, 0.6);
}
</style>

