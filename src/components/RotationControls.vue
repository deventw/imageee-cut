<template>
  <div class="rotation-controls">
    <button @click="rotateLeft" :disabled="!hasImage" class="btn-rotate">
      {{ $t('rotate_left') }}
    </button>
    <button @click="rotateRight" :disabled="!hasImage" class="btn-rotate">
      {{ $t('rotate_right') }}
    </button>
    <button @click="rotate180" :disabled="!hasImage" class="btn-rotate">
      {{ $t('rotate_180') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRotation } from '@/composables/useRotation'
import { useImageEditor } from '@/composables/useImageEditor'
import { useEditorStore } from '@/stores/editorStore'
import { useI18n } from '@/composables/useI18n'

const { hasImage } = useImageEditor()
const { rotation, rotateLeft: rotateLeftFn, rotateRight: rotateRightFn, rotate180: rotate180Fn } = useRotation()
const store = useEditorStore()
const { $t } = useI18n()

// Sync rotation with store
watch(rotation, (val) => {
  store.setRotation(val)
})

function rotateLeft() {
  rotateLeftFn()
}

function rotateRight() {
  rotateRightFn()
}

function rotate180() {
  rotate180Fn()
}
</script>

<style scoped>
.rotation-controls {
  display: flex;
  gap: 0.375rem;
  flex-wrap: nowrap;
}

.btn-rotate {
  padding: 0.75rem 0.875rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
  min-height: 44px;
  min-width: 44px;
  touch-action: manipulation;
  flex-shrink: 0;
  white-space: nowrap;
  color: #3c3c3c;
}

.btn-rotate:active:not(:disabled) {
  background: #f0ebe3;
  border-color: #b8a99a;
}

.btn-rotate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

