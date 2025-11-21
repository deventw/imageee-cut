<template>
  <div class="crop-controls">
    <div class="control-group">
      <label>
        <input 
          type="checkbox" 
          v-model="lockAspectRatio"
          :disabled="!hasImage"
        />
        {{ $t('lock_aspect_ratio') }}
      </label>
    </div>
    
    <div class="control-group">
      <label>{{ $t('aspect_ratio') }}</label>
      
      <!-- Quick ratio buttons -->
      <div class="ratio-buttons">
        <button 
          v-for="ratio in commonRatios" 
          :key="ratio.value"
          @click="selectRatio(ratio.value)"
          :class="{ active: selectedAspectRatio === ratio.value && lockAspectRatio }"
          class="ratio-btn"
          :disabled="!hasImage"
        >
          {{ ratio.label }}
        </button>
      </div>
      
      <!-- Custom ratio option -->
      <div class="custom-ratio-section">
        <button 
          @click="selectRatio('custom')"
          :class="{ active: selectedAspectRatio === 'custom' && lockAspectRatio }"
          class="ratio-btn ratio-btn-custom"
          :disabled="!hasImage"
        >
          {{ $t('custom') }}
        </button>
        
        <button 
          @click="selectRatio('free')"
          :class="{ active: selectedAspectRatio === 'free' || !lockAspectRatio }"
          class="ratio-btn ratio-btn-free"
          :disabled="!hasImage"
        >
          {{ $t('free') }}
        </button>
      </div>
      
      <!-- Custom ratio inputs -->
      <div class="custom-aspect-inputs" v-if="selectedAspectRatio === 'custom' && lockAspectRatio">
        <input 
          type="number" 
          v-model.number="customWidth" 
          :placeholder="$t('width')"
          min="1"
          class="aspect-input"
        />
        <span>:</span>
        <input 
          type="number" 
          v-model.number="customHeight" 
          :placeholder="$t('height')"
          min="1"
          class="aspect-input"
        />
        <button @click="applyCustomAspectRatio" class="btn-apply">{{ $t('apply') }}</button>
      </div>
      
      <!-- Apply ratio to existing selection -->
      <div v-if="hasCrop && lockAspectRatio && aspectRatio" class="apply-ratio-hint">
        <button @click="applyRatioToExistingSelection" class="btn-apply-ratio">
          {{ $t('apply_ratio_to_selection') }}
        </button>
      </div>
    </div>
    
    <div class="control-group">
      <label>{{ $t('shadow_count') }}</label>
      <input 
        type="number" 
        v-model.number="shadowCount" 
        min="1" 
        max="10"
        :disabled="!hasCrop"
        class="shadow-input"
      />
    </div>
    
    <!-- Fine-tune Controls -->
    <div class="control-group finetune-group" v-if="hasCrop">
      <label class="finetune-label">
        <span>{{ $t('fine_tune') || 'Fine-tune Crop' }}</span>
        <span class="finetune-hint">({{ $t('fine_tune_hint') || 'Adjust crop position and size precisely' }})</span>
      </label>
      
      <div class="finetune-grid">
        <div class="finetune-item">
          <label class="finetune-item-label">X</label>
          <input 
            type="number" 
            v-model.number="fineTuneX" 
            @input="applyFineTune"
            :disabled="!hasCrop"
            class="finetune-input"
            step="1"
            :min="0"
            :max="maxDimensions.maxX"
          />
        </div>
        
        <div class="finetune-item">
          <label class="finetune-item-label">Y</label>
          <input 
            type="number" 
            v-model.number="fineTuneY" 
            @input="applyFineTune"
            :disabled="!hasCrop"
            class="finetune-input"
            step="1"
            :min="0"
            :max="maxDimensions.maxY"
          />
        </div>
        
        <div class="finetune-item">
          <label class="finetune-item-label">{{ $t('width') || 'W' }}</label>
          <input 
            type="number" 
            v-model.number="fineTuneWidth" 
            @input="applyFineTune"
            :disabled="!hasCrop"
            class="finetune-input"
            step="1"
            :min="1"
            :max="maxDimensions.maxWidth"
          />
        </div>
        
        <div class="finetune-item">
          <label class="finetune-item-label">{{ $t('height') || 'H' }}</label>
          <input 
            type="number" 
            v-model.number="fineTuneHeight" 
            @input="applyFineTune"
            :disabled="!hasCrop"
            class="finetune-input"
            step="1"
            :min="1"
            :max="maxDimensions.maxHeight"
          />
        </div>
      </div>
      
      <!-- Arrow key controls hint -->
      <div class="arrow-controls-hint">
        <div class="arrow-controls-row">
          <button 
            @click="adjustCrop('x', -1)" 
            :disabled="!hasCrop"
            class="arrow-btn"
            aria-label="Move left"
          >
            ←
          </button>
          <div class="arrow-controls-group">
            <button 
              @click="adjustCrop('y', -1)" 
              :disabled="!hasCrop"
              class="arrow-btn"
              aria-label="Move up"
            >
              ↑
            </button>
            <button 
              @click="adjustCrop('y', 1)" 
              :disabled="!hasCrop"
              class="arrow-btn"
              aria-label="Move down"
            >
              ↓
            </button>
          </div>
          <button 
            @click="adjustCrop('x', 1)" 
            :disabled="!hasCrop"
            class="arrow-btn"
            aria-label="Move right"
          >
            →
          </button>
        </div>
        <div class="arrow-controls-row">
          <button 
            @click="adjustCrop('width', -1)" 
            :disabled="!hasCrop"
            class="arrow-btn"
            aria-label="Decrease width"
          >
            ← W
          </button>
          <button 
            @click="adjustCrop('width', 1)" 
            :disabled="!hasCrop"
            class="arrow-btn"
            aria-label="Increase width"
          >
            W →
          </button>
        </div>
        <div class="arrow-controls-row">
          <button 
            @click="adjustCrop('height', -1)" 
            :disabled="!hasCrop"
            class="arrow-btn"
            aria-label="Decrease height"
          >
            ↑ H
          </button>
          <button 
            @click="adjustCrop('height', 1)" 
            :disabled="!hasCrop"
            class="arrow-btn"
            aria-label="Increase height"
          >
            H ↓
          </button>
        </div>
      </div>
    </div>
    
    <div class="control-group">
      <button @click="clearCrop" :disabled="!hasCrop" class="btn-clear">
        {{ $t('clear_crop') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useCrop } from '@/composables/useCrop'
import { useImageEditor } from '@/composables/useImageEditor'
import { useI18n } from '@/composables/useI18n'
import { useEditorStore } from '@/stores/editorStore'

const { hasImage, imageElement } = useImageEditor()
const { 
  lockAspectRatio, 
  shadowCount: shadowCountRef, 
  hasCrop,
  cropRect,
  clearCrop,
  setAspectRatio,
  setFreeAspectRatio,
  applyRatioToSelection,
  aspectRatio,
  updateCropRect
} = useCrop()
const store = useEditorStore()

// Make shadowCount writable
const shadowCount = computed({
  get: () => shadowCountRef.value,
  set: (val) => store.setShadowCount(val)
})

const { $t } = useI18n()

const selectedAspectRatio = ref<string>('free')
const customWidth = ref<number>(1)
const customHeight = ref<number>(1)

// Fine-tune values
const fineTuneX = ref<number>(0)
const fineTuneY = ref<number>(0)
const fineTuneWidth = ref<number>(0)
const fineTuneHeight = ref<number>(0)

// Calculate max dimensions based on aspect ratio and image bounds
const maxDimensions = computed(() => {
  if (!imageElement.value) {
    return { maxX: 0, maxY: 0, maxWidth: 0, maxHeight: 0 }
  }
  
  const imgWidth = imageElement.value.width
  const imgHeight = imageElement.value.height
  
  let maxWidth = imgWidth
  let maxHeight = imgHeight
  
  if (lockAspectRatio.value && aspectRatio.value) {
    const targetRatio = aspectRatio.value.width / aspectRatio.value.height
    // Calculate maximum possible dimensions while maintaining aspect ratio
    const maxWidthByHeight = imgHeight * targetRatio
    const maxHeightByWidth = imgWidth / targetRatio
    maxWidth = Math.min(imgWidth, maxWidthByHeight)
    maxHeight = Math.min(imgHeight, maxHeightByWidth)
  }
  
  return {
    maxX: imgWidth - 1,
    maxY: imgHeight - 1,
    maxWidth: maxWidth,
    maxHeight: maxHeight
  }
})

// Sync fine-tune values with crop rect
watch(cropRect, (rect) => {
  if (rect) {
    fineTuneX.value = Math.round(rect.x)
    fineTuneY.value = Math.round(rect.y)
    fineTuneWidth.value = Math.round(rect.width)
    fineTuneHeight.value = Math.round(rect.height)
  }
}, { immediate: true })

function applyFineTune() {
  if (!cropRect.value || !imageElement.value) return
  
  // Clamp values to max dimensions
  const max = maxDimensions.value
  const clampedX = Math.max(0, Math.min(fineTuneX.value, max.maxX))
  const clampedY = Math.max(0, Math.min(fineTuneY.value, max.maxY))
  let clampedWidth = Math.max(1, Math.min(fineTuneWidth.value, max.maxWidth))
  let clampedHeight = Math.max(1, Math.min(fineTuneHeight.value, max.maxHeight))
  
  // If aspect ratio is locked, adjust dimensions to maintain ratio
  if (lockAspectRatio.value && aspectRatio.value) {
    const targetRatio = aspectRatio.value.width / aspectRatio.value.height
    const currentRatio = clampedWidth / clampedHeight
    
    if (Math.abs(currentRatio - targetRatio) > 0.001) {
      // Adjust to match aspect ratio, preferring the dimension that fits
      if (clampedWidth / targetRatio <= max.maxHeight) {
        clampedHeight = clampedWidth / targetRatio
      } else {
        clampedWidth = clampedHeight * targetRatio
      }
    }
    
    // Ensure we don't exceed max dimensions
    if (clampedWidth > max.maxWidth) {
      clampedWidth = max.maxWidth
      clampedHeight = clampedWidth / targetRatio
    }
    if (clampedHeight > max.maxHeight) {
      clampedHeight = max.maxHeight
      clampedWidth = clampedHeight * targetRatio
    }
  }
  
  // Ensure crop doesn't exceed image bounds
  if (clampedX + clampedWidth > imageElement.value.width) {
    clampedWidth = imageElement.value.width - clampedX
    if (lockAspectRatio.value && aspectRatio.value) {
      clampedHeight = clampedWidth / (aspectRatio.value.width / aspectRatio.value.height)
    }
  }
  if (clampedY + clampedHeight > imageElement.value.height) {
    clampedHeight = imageElement.value.height - clampedY
    if (lockAspectRatio.value && aspectRatio.value) {
      clampedWidth = clampedHeight * (aspectRatio.value.width / aspectRatio.value.height)
    }
  }
  
  const newRect = {
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight
  }
  
  updateCropRect(newRect, imageElement.value.width, imageElement.value.height)
}

function adjustCrop(property: 'x' | 'y' | 'width' | 'height', delta: number) {
  if (!cropRect.value || !imageElement.value) return
  
  const step = 1 // Adjust step size as needed
  const adjustment = delta * step
  const max = maxDimensions.value
  
  let newRect = { ...cropRect.value }
  
  switch (property) {
    case 'x':
      fineTuneX.value = Math.max(0, Math.min(fineTuneX.value + adjustment, max.maxX))
      newRect.x = fineTuneX.value
      break
    case 'y':
      fineTuneY.value = Math.max(0, Math.min(fineTuneY.value + adjustment, max.maxY))
      newRect.y = fineTuneY.value
      break
    case 'width':
      fineTuneWidth.value = Math.max(1, Math.min(fineTuneWidth.value + adjustment, max.maxWidth))
      newRect.width = fineTuneWidth.value
      break
    case 'height':
      fineTuneHeight.value = Math.max(1, Math.min(fineTuneHeight.value + adjustment, max.maxHeight))
      newRect.height = fineTuneHeight.value
      break
  }
  
  updateCropRect(newRect, imageElement.value.width, imageElement.value.height)
}

// Common aspect ratios
const commonRatios = [
  { value: '1:1', label: '1:1', width: 1, height: 1 },
  { value: '16:9', label: '16:9', width: 16, height: 9 },
  { value: '9:16', label: '9:16', width: 9, height: 16 },
  { value: '9:15', label: '9:15', width: 9, height: 15 },
  { value: '4:3', label: '4:3', width: 4, height: 3 },
  { value: '3:4', label: '3:4', width: 3, height: 4 },
]

function selectRatio(ratioValue: string) {
  selectedAspectRatio.value = ratioValue
  
  if (ratioValue === 'free') {
    setFreeAspectRatio()
  } else if (ratioValue === 'custom') {
    // Just select custom, don't apply yet
    store.setLockAspectRatio(true)
  } else {
    const ratio = commonRatios.find(r => r.value === ratioValue)
    if (ratio) {
      setAspectRatio(ratio.width, ratio.height)
      // If there's an existing crop, apply the ratio to it
      if (hasCrop.value && imageElement.value) {
        applyRatioToSelection(imageElement.value.width, imageElement.value.height)
      }
    }
  }
}

function applyCustomAspectRatio() {
  if (customWidth.value > 0 && customHeight.value > 0) {
    setAspectRatio(customWidth.value, customHeight.value)
    // If there's an existing crop, apply the ratio to it
    if (hasCrop.value && imageElement.value) {
      applyRatioToSelection(imageElement.value.width, imageElement.value.height)
    }
  }
}

function applyRatioToExistingSelection() {
  if (imageElement.value && hasCrop.value && aspectRatio.value) {
    applyRatioToSelection(imageElement.value.width, imageElement.value.height)
  }
}

watch(lockAspectRatio, (val) => {
  if (!val) {
    selectedAspectRatio.value = 'free'
    setFreeAspectRatio()
  }
})

// Watch aspectRatio changes to update selectedAspectRatio
watch(() => store.aspectRatio, (newRatio) => {
  if (!newRatio) {
    selectedAspectRatio.value = 'free'
  } else {
    // Check if it matches a common ratio
    const ratio = commonRatios.find(r => 
      Math.abs(r.width / r.height - newRatio.width / newRatio.height) < 0.001
    )
    if (ratio) {
      selectedAspectRatio.value = ratio.value
    } else {
      selectedAspectRatio.value = 'custom'
      customWidth.value = newRatio.width
      customHeight.value = newRatio.height
    }
  }
}, { immediate: true })

// Watch lockAspectRatio to sync selectedAspectRatio
watch(lockAspectRatio, (val) => {
  if (!val) {
    selectedAspectRatio.value = 'free'
  }
})
</script>

<style scoped>
.crop-controls {
  padding: 1.25rem;
  background: #faf8f4;
}

.control-group {
  margin-bottom: 1.25rem;
}

.control-group label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 500;
  font-size: 0.95rem;
}

.control-group input[type="checkbox"] {
  width: 20px;
  height: 20px;
  margin-right: 0.5rem;
  cursor: pointer;
  accent-color: #a67c52;
}

.aspect-select {
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

.aspect-select:focus {
  outline: 2px solid #a67c52;
  outline-offset: 2px;
}

.custom-aspect-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.aspect-input {
  flex: 1;
  min-width: 80px;
  padding: 0.875rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  font-size: 1rem;
  min-height: 44px;
  touch-action: manipulation;
  color: #3c3c3c;
}

.aspect-input:focus {
  outline: 2px solid #a67c52;
  outline-offset: 2px;
}

.shadow-input {
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

.shadow-input:focus {
  outline: 2px solid #a67c52;
  outline-offset: 2px;
}

.btn-apply, .btn-clear {
  padding: 0.875rem 1.25rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  min-height: 44px;
  transition: all 0.2s;
  touch-action: manipulation;
  color: #3c3c3c;
}

.btn-apply:active, .btn-clear:active:not(:disabled) {
  background: #f0ebe3;
}

.btn-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-apply {
  background: #a67c52;
  color: #faf8f4;
  border-color: #8b6f47;
}

.btn-apply:active {
  background: #8b6f47;
  border-color: #6b5638;
}

.ratio-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.ratio-btn {
  padding: 0.75rem 0.5rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  min-height: 44px;
  transition: all 0.2s;
  touch-action: manipulation;
  color: #3c3c3c;
  white-space: nowrap;
}

.ratio-btn:active:not(:disabled) {
  background: #f0ebe3;
}

.ratio-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ratio-btn.active {
  background: #a67c52;
  color: #faf8f4;
  border-color: #8b6f47;
}

.ratio-btn.active:active {
  background: #8b6f47;
  border-color: #6b5638;
}

.custom-ratio-section {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.ratio-btn-custom,
.ratio-btn-free {
  flex: 1;
}

.apply-ratio-hint {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e8dfd4;
}

.btn-apply-ratio {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #a67c52;
  border-radius: 6px;
  background: #a67c52;
  color: #faf8f4;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  min-height: 44px;
  transition: all 0.2s;
  touch-action: manipulation;
}

.btn-apply-ratio:active {
  background: #8b6f47;
  border-color: #6b5638;
}

.finetune-group {
  border-top: 1px solid #e8dfd4;
  padding-top: 1rem;
  margin-top: 1rem;
}

.finetune-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.finetune-hint {
  font-size: 0.8rem;
  font-weight: normal;
  color: #6b5d4f;
  font-style: italic;
}

.finetune-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.finetune-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.finetune-item-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #6b5d4f;
}

.finetune-input {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  font-size: 1rem;
  min-height: 44px;
  touch-action: manipulation;
  color: #3c3c3c;
  text-align: center;
}

.finetune-input:focus {
  outline: 2px solid #a67c52;
  outline-offset: 2px;
  border-color: #a67c52;
}

.finetune-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.arrow-controls-hint {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e8dfd4;
}

.arrow-controls-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}

.arrow-controls-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.arrow-btn {
  min-width: 50px;
  min-height: 44px;
  padding: 0.75rem 1rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  transition: all 0.2s;
  touch-action: manipulation;
  color: #3c3c3c;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-btn:active:not(:disabled) {
  background: #a67c52;
  color: #faf8f4;
  border-color: #8b6f47;
}

.arrow-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .ratio-buttons {
    grid-template-columns: repeat(5, 1fr);
  }
  
  .finetune-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .arrow-btn {
    min-width: 60px;
    font-size: 1.2rem;
  }
}
</style>

