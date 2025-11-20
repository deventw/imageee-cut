<template>
  <div v-if="isOpen" class="export-dialog-overlay" @click.self="close">
    <div class="export-dialog">
      <h2>{{ $t('export_settings') }}</h2>
      
      <div class="dialog-content">
        <div class="control-group">
          <label>{{ $t('export_format') }}</label>
          <select v-model="settings.format" class="format-select">
            <option value="png">PNG</option>
            <option value="jpg">JPEG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        
        <div class="control-group">
          <label>{{ $t('filename') }}</label>
          <input 
            type="text" 
            v-model="filename"
            :placeholder="$t('filename_placeholder')"
            class="filename-input"
            maxlength="100"
          />
        </div>
        
        <div class="control-group" v-if="settings.format !== 'png'">
          <label>{{ $t('quality') }}: {{ settings.quality }}%</label>
          <input 
            type="range" 
            v-model.number="settings.quality" 
            min="1" 
            max="100"
            class="quality-slider"
          />
        </div>
        
        <div class="control-group">
          <label>
            <input type="checkbox" v-model="settings.includeMetadata" />
            Include Metadata
          </label>
        </div>
        
        <div class="control-group">
          <button 
            @click="generateExportItems" 
            :disabled="generatingPreviews || !imageElement"
            class="btn-generate"
          >
            {{ generatingPreviews ? $t('generating_previews') : $t('generate_previews') }}
          </button>
        </div>
      </div>
      
      <!-- Export list -->
      <div class="export-list-section">
        <h3 class="export-list-title">
          {{ $t('export_images') }}
          <span v-if="exportItems.length > 0" class="export-count">({{ exportItems.length }})</span>
        </h3>
        <div class="export-list" v-if="exportItems.length > 0">
          <div 
            v-for="(item, index) in exportItems" 
            :key="index"
            class="export-item"
          >
            <div class="export-item-preview">
              <div class="export-item-number">{{ index === 0 ? $t('main_crop') : `${index + 1}` }}</div>
              <img :src="item.preview" :alt="item.filename" />
            </div>
            <div class="export-item-info">
              <p class="export-item-label">{{ index === 0 ? $t('main_crop') : `${$t('crop')} ${index + 1}` }}</p>
              <p class="export-item-filename">{{ item.filename }}.{{ settings.format }}</p>
              <p class="export-item-size">{{ item.size }} px</p>
            </div>
            <button 
              @click="downloadItem(item)"
              :disabled="item.downloading"
              class="btn-download-item"
            >
              {{ item.downloading ? $t('downloading') : $t('download') }}
            </button>
          </div>
        </div>
        <div v-else-if="generatingPreviews" class="export-list-loading">
          <p>{{ $t('generating_previews') }}...</p>
        </div>
        <div v-else-if="!imageElement" class="export-list-empty">
          <p>{{ $t('no_image_loaded') }}</p>
        </div>
        <div v-else class="export-list-empty">
          <p>{{ $t('no_images_to_export') }}</p>
          <p class="hint-text">{{ $t('select_crop_area_first') }}</p>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button @click="close" class="btn-cancel">{{ $t('close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CropRect } from '@/composables/useCrop'
import { useCrop } from '@/composables/useCrop'
import { useExport, type ExportSettings } from '@/composables/useExport'
import { useI18n } from '@/composables/useI18n'
import { useImageEditor } from '@/composables/useImageEditor'
import { useRotation } from '@/composables/useRotation'
import { ref, watch } from 'vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { imageElement } = useImageEditor()
const { cropRect, shadowCrops } = useCrop()
const { rotation } = useRotation()
const { generatePreview, exportSingleImage } = useExport()
const { $t } = useI18n()

const settings = ref<ExportSettings>({
  format: 'png',
  quality: 90,
  includeMetadata: false
})

const filename = ref('imageee-cut-export')

interface ExportItem {
  preview: string
  filename: string
  size: string
  cropRect: CropRect | null
  downloading: boolean
}

const exportItems = ref<ExportItem[]>([])
const generatingPreviews = ref(false)

function close() {
  emit('close')
}

async function generateExportItems() {
  if (!imageElement.value) {
    exportItems.value = []
    return
  }
  
  generatingPreviews.value = true
  exportItems.value = []
  
  try {
    // Debug logging
    console.log('Generating export items...', {
      hasImage: !!imageElement.value,
      cropRect: cropRect.value,
      shadowCrops: shadowCrops.value,
      imageSize: imageElement.value ? `${imageElement.value.width}x${imageElement.value.height}` : 'N/A'
    })
    
    // Check for valid crop selection
    const validCropRect = cropRect.value && 
                         typeof cropRect.value.width === 'number' &&
                         typeof cropRect.value.height === 'number' &&
                         cropRect.value.width > 0 && 
                         cropRect.value.height > 0 ? cropRect.value : null
    const validShadowCrops = shadowCrops.value.filter(c => 
      c && 
      typeof c.width === 'number' &&
      typeof c.height === 'number' &&
      c.width > 0 && 
      c.height > 0
    )
    
    console.log('Valid crops:', { validCropRect, validShadowCrops })
    
    // Always show at least the full image or the selected crop
    const items: ExportItem[] = []
    
    // Check if we have a valid crop selection
    const hasValidCropSelection = validCropRect && 
                                 validCropRect.width > 0 && 
                                 validCropRect.height > 0 &&
                                 imageElement.value &&
                                 validCropRect.width <= imageElement.value.width * 1.1 && // Allow small overflow
                                 validCropRect.height <= imageElement.value.height * 1.1
    
    console.log('Has valid crop selection:', hasValidCropSelection)
    
    if (hasValidCropSelection) {
      // Show main crop + shadow crops
      const allCrops = [validCropRect, ...validShadowCrops]
      
      for (let i = 0; i < allCrops.length; i++) {
        const rect = allCrops[i]
        if (!rect || rect.width <= 0 || rect.height <= 0) continue
        
        try {
          const preview = await generatePreview(imageElement.value, rect, rotation.value)
          const suffix = i === 0 ? '' : `_${i + 1}`
          const itemFilename = `${filename.value.trim() || 'imageee-cut-export'}${suffix}`
          
          items.push({
            preview,
            filename: itemFilename,
            size: `${Math.round(rect.width)} × ${Math.round(rect.height)}`,
            cropRect: rect,
            downloading: false
          })
        } catch (error) {
          console.error('Failed to generate preview for crop', i, error)
        }
      }
    }
    
    // Always show full image as fallback if no crops or if crops failed
    if (items.length === 0) {
      try {
        const preview = await generatePreview(imageElement.value, null, rotation.value)
        const rotatedWidth = rotation.value === 90 || rotation.value === 270 
          ? imageElement.value.height 
          : imageElement.value.width
        const rotatedHeight = rotation.value === 90 || rotation.value === 270 
          ? imageElement.value.width 
          : imageElement.value.height
        
        items.push({
          preview,
          filename: filename.value.trim() || 'imageee-cut-export',
          size: `${rotatedWidth} × ${rotatedHeight}`,
          cropRect: null,
          downloading: false
        })
      } catch (error) {
        console.error('Failed to generate preview for full image', error)
      }
    }
    
    exportItems.value = items
  } catch (error) {
    console.error('Error generating export items:', error)
    exportItems.value = []
  } finally {
    generatingPreviews.value = false
  }
}

async function downloadItem(item: ExportItem) {
  if (!imageElement.value || item.downloading) return
  
  item.downloading = true
  
  try {
    await exportSingleImage(
      imageElement.value,
      item.cropRect,
      rotation.value,
      settings.value,
      item.filename
    )
  } finally {
    item.downloading = false
  }
}

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    settings.value = {
      format: 'png',
      quality: 90,
      includeMetadata: false
    }
    filename.value = 'imageee-cut-export'
    // Wait a bit to ensure imageElement is ready
    await new Promise(resolve => setTimeout(resolve, 100))
    await generateExportItems()
  } else {
    // Clear items when dialog closes
    exportItems.value = []
  }
})

// Watch for changes in crop selection
watch([() => cropRect.value, () => shadowCrops.value], async () => {
  if (props.isOpen && imageElement.value) {
    await generateExportItems()
  }
}, { deep: true, immediate: false })

// Watch for changes in filename, settings, rotation, or imageElement
watch([filename, () => settings.value.format, () => settings.value.quality, rotation, () => imageElement.value], async () => {
  if (props.isOpen && imageElement.value) {
    await generateExportItems()
  }
}, { deep: true })
</script>

<style scoped>
.export-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.export-dialog {
  background: #faf8f4;
  border-radius: 8px;
  padding: 1.5rem;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #d4c4b0;
}

h2 {
  margin: 0 0 1.5rem 0;
}

.dialog-content {
  margin-bottom: 1.5rem;
  flex-shrink: 0;
}

.control-group {
  margin-bottom: 1rem;
}

.control-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.format-select {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  font-size: 1rem;
  min-height: 44px;
  cursor: pointer;
  touch-action: manipulation;
  color: #3c3c3c;
}

.format-select:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}

.filename-input {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  font-size: 1rem;
  min-height: 44px;
  touch-action: manipulation;
  color: #3c3c3c;
}

.filename-input:focus {
  outline: 2px solid #a67c52;
  outline-offset: 2px;
  border-color: #a67c52;
}

.export-info {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f0ebe3;
  border-radius: 6px;
  border: 1px solid #d4c4b0;
}

.info-text {
  margin: 0;
  font-size: 0.9rem;
  color: #3c3c3c;
  text-align: center;
}

.quality-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #d4c4b0;
  border-radius: 3px;
  outline: none;
}

.quality-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #a67c52;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #faf8f4;
}

.quality-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #a67c52;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #faf8f4;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-cancel, .btn-export {
  padding: 0.875rem 1.5rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  min-height: 44px;
  touch-action: manipulation;
  flex: 1;
}

.btn-cancel {
  background: #f0ebe3;
  color: #3c3c3c;
}

.btn-cancel:active {
  background: #e8dfd4;
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

.export-progress-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e8dfd4;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.progress-status {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: #3c3c3c;
}

.progress-count {
  margin: 0;
  font-size: 0.9rem;
  color: #6b5d4f;
}

.progress-bar {
  height: 8px;
  background: #e8dfd4;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: #7a9a68;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-percentage {
  margin: 0;
  text-align: center;
  font-size: 0.85rem;
  color: #6b5d4f;
  font-weight: 500;
}

.export-list-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-bottom: 1.5rem;
}

.export-list-title {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #3c3c3c;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.export-count {
  font-size: 0.9rem;
  font-weight: 400;
  color: #6b5d4f;
}

.export-list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  max-height: 400px;
  border: 1px solid #e8dfd4;
  border-radius: 6px;
  background: #fff;
  padding: 0.5rem;
}

.export-list-empty,
.export-list-loading {
  padding: 2rem;
  text-align: center;
  color: #6b5d4f;
  font-style: italic;
}

.export-list-loading {
  color: #3c3c3c;
}

.export-list-empty .hint-text {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #9c8a7a;
}

.export-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid #e8dfd4;
  transition: background 0.2s;
  position: relative;
}

.export-item:last-child {
  border-bottom: none;
}

.export-item:hover {
  background: #faf8f4;
}

.export-item-number {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  background: rgba(166, 124, 82, 0.95);
  color: #faf8f4;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  z-index: 2;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.export-item-label {
  margin: 0 0 0.25rem 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #a67c52;
}

.export-item-preview {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border: 1px solid #d4c4b0;
  border-radius: 4px;
  overflow: hidden;
  background: #f0ebe3;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.export-item-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.export-item-info {
  flex: 1;
  min-width: 0;
}

.export-item-filename {
  margin: 0 0 0.25rem 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: #3c3c3c;
  word-break: break-all;
}

.export-item-size {
  margin: 0;
  font-size: 0.85rem;
  color: #6b5d4f;
}

.btn-download-item {
  flex-shrink: 0;
  padding: 0.625rem 1rem;
  border: 1px solid #7a9a68;
  border-radius: 6px;
  background: #7a9a68;
  color: #faf8f4;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  min-height: 44px;
  transition: all 0.2s;
  touch-action: manipulation;
  white-space: nowrap;
}

.btn-download-item:active:not(:disabled) {
  background: #6b8e5a;
  border-color: #5a7a4a;
}

.btn-download-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-generate {
  width: 100%;
  padding: 0.875rem 1.5rem;
  border: 1px solid #a67c52;
  border-radius: 6px;
  background: #a67c52;
  color: #faf8f4;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  min-height: 44px;
  transition: all 0.2s;
  touch-action: manipulation;
}

.btn-generate:active:not(:disabled) {
  background: #8b6f47;
  border-color: #6b5638;
}

.btn-generate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  flex-shrink: 0;
  margin-top: auto;
}
</style>

