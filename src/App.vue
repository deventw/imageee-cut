<template>
  <div class="app-container">
    <header class="toolbar">
      <div class="toolbar-content">
      
        <LanguageToggle />
        <button @click="triggerFileInput" class="btn-import">
          {{ $t('import_image') }}
        </button>
        <input 
          ref="fileInputRef"
          type="file" 
          accept="image/*" 
          @change="handleFileSelect"
          style="display: none"
        />
        <span class="version-number">v{{ version }}</span>
        <a href="https://github.com/deventw/imageee-cut" target="_blank" rel="noopener noreferrer" class="author">by deventw</a>
      </div>
    </header>
    
    <main class="editor-area">
      <ImagePreview />
    </main>
    
    <!-- Side drawer overlay -->
    <div 
      class="drawer-overlay" 
      :class="{ 'is-open': showControls || showExportDialog }"
      @click="showControls = false; showExportDialog = false"
      v-if="showControls || showExportDialog"
    ></div>
    
    <!-- Crop Selection Drawer -->
    <div class="drawer" :class="{ 'is-open': showControls }">
      <div class="drawer-header">
        <h2>{{ $t('crop_selection') }}</h2>
        <button class="drawer-close" @click="showControls = false">✕</button>
      </div>
      <div class="drawer-content">
        <CropControls />
      </div>
    </div>
    
    <!-- Export Settings Drawer -->
    <div class="drawer export-drawer" :class="{ 'is-open': showExportDialog }">
      <div class="drawer-header">
        <h2>{{ $t('export_settings') }}</h2>
        <button class="drawer-close" @click="showExportDialog = false">✕</button>
      </div>
      <div class="drawer-content">
        <ExportDialog 
          :is-open="showExportDialog"
          @close="showExportDialog = false" 
        />
      </div>
    </div>
    
    <footer class="bottom-toolbar">
      <div class="bottom-toolbar-buttons">
        <button 
          @click="showControls = !showControls"
          :class="{ 'is-active': showControls }"
          :disabled="!hasImage"
          class="btn-crop"
        >
          {{ $t('crop_selection') }}
        </button>
        <button 
          @click="showExportDialog = true" 
          :disabled="!hasImage"
          class="btn-export"
        >
          {{ $t('export_image') }}
        </button>
      </div>
    </footer>
    
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import LanguageToggle from './components/LanguageToggle.vue'
import ImagePreview from './components/ImagePreview.vue'
import CropControls from './components/CropControls.vue'
import ExportDialog from './components/ExportDialog.vue'
import { useImageEditor } from './composables/useImageEditor'
import { useI18n } from './composables/useI18n'

const version = '1.0.3'
const { hasImage, loadImage } = useImageEditor()
const { $t } = useI18n()
const showExportDialog = ref(false)
const showControls = ref(false)
const fileInputRef = ref<HTMLInputElement>()

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file) {
      loadImage(file)
      // Reset input so same file can be selected again
      target.value = ''
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #fff;
  color: #333;
  touch-action: manipulation;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #f4f1eb;
  min-height: 0;
}

.toolbar {
  padding: 0.5rem;
  background: #faf8f4;
  border-bottom: 1px solid #d4c4b0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  z-index: 10;
  flex-shrink: 0;
}

.toolbar-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.toolbar-content::-webkit-scrollbar {
  display: none;
}

.version-number {
  font-size: 0.75rem;
  color: #6b5d4f;
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  background: #f0ebe3;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid #d4c4b0;
}

.author {
  font-size: 0.75rem;
  color: #6b5d4f;
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  background: #f0ebe3;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid #d4c4b0;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
  cursor: pointer;
}

.author:hover {
  background: #e8dfd4;
  color: #5a4d3f;
  border-color: #b8a99a;
}

.author:active {
  background: #d4c4b0;
}

.btn-import {
  padding: 0.75rem 1rem;
  border: 1px solid #8b6f47;
  border-radius: 6px;
  background: #a67c52;
  color: #faf8f4;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
  min-height: 44px;
  touch-action: manipulation;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-import:active {
  background: #8b6f47;
  border-color: #6b5638;
}

.editor-area {
  flex: 1 1 0;
  display: flex;
  overflow: hidden;
  position: relative;
  min-width: 0;
  min-height: 0;
  width: 100%;
}


.drawer-toggle-icon {
  font-size: 1.2rem;
  line-height: 1;
}

.drawer-toggle-text {
  white-space: nowrap;
}

.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 998;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.drawer-overlay.is-open {
  opacity: 1;
  pointer-events: all;
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  max-width: 85vw;
  background: #faf8f4;
  border-left: 1px solid #d4c4b0;
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.15);
  z-index: 999;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  overflow: hidden;
}

.export-drawer {
  width: 500px;
  max-width: 90vw;
}

.drawer.is-open {
  transform: translateX(0);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #d4c4b0;
  background: #f0ebe3;
  flex-shrink: 0;
}

.drawer-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #3c3c3c;
}

.drawer-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #3c3c3c;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
  touch-action: manipulation;
  padding: 0;
  line-height: 1;
}

.drawer-close:active {
  background: #e8dfd4;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0;
}

.bottom-toolbar {
  padding: 0.625rem 0.875rem;
  background: #faf8f4;
  border-top: 1px solid #d4c4b0;
  display: flex;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.bottom-toolbar-buttons {
  width: 100%;
  max-width: 600px;
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
}

.btn-crop,
.btn-export {
  flex: 1;
  padding: 0.875rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s;
  min-height: 44px;
  touch-action: manipulation;
  border: 1px solid;
}

.btn-crop {
  background: #faf8f4;
  color: #3c3c3c;
  border-color: #d4c4b0;
}

.btn-crop:active:not(:disabled) {
  background: #f0ebe3;
}

.btn-crop.is-active {
  background: #a67c52;
  color: #faf8f4;
  border-color: #8b6f47;
}

.btn-crop.is-active:active {
  background: #8b6f47;
  border-color: #6b5638;
}

.btn-crop:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-export {
  background: #7a9a68;
  color: #faf8f4;
  border-color: #6b8e5a;
}

.btn-export:active:not(:disabled) {
  background: #6b8e5a;
  border-color: #5a7a4a;
}

.btn-export:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .toolbar {
    padding: 0.75rem 1rem;
  }
  
  .toolbar-content {
    gap: 0.75rem;
    justify-content: flex-start;
  }
  
  .btn-import {
    padding: 0.875rem 1.25rem;
    font-size: 0.95rem;
  }
  
  .drawer {
    width: 360px;
  }
  
  .export-drawer {
    width: 600px;
  }
  
  .bottom-toolbar-buttons {
    max-width: 800px;
  }
}
</style>
