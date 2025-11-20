# Developer Guide: Building imageee-cut with Vue3

This guide explains how to build an image editing application similar to `videooo-cut`, but for images instead of videos, using Vue3.

## Overview

**videooo-cut** is a desktop video editing application built with Python, PyQt6, and OpenCV. This guide will help you build **imageee-cut**, a web-based image editing application using Vue3, HTML5 Canvas, and modern web APIs.

## Feature Mapping: Video → Image

| videooo-cut Feature | imageee-cut Equivalent |
|---------------------|------------------------|
| Video Import | Image Upload (drag & drop, file picker) |
| Video Preview | Image Preview with zoom/pan |
| Frame-by-frame navigation | N/A (single image) |
| Rotation (90°, 180°, 270°) | Image Rotation |
| Crop Selection (drag to select) | Crop Selection (drag rectangle) |
| Aspect Ratio Lock | Aspect Ratio Lock |
| Custom Aspect Ratio | Custom Aspect Ratio Input |
| Shadow Cropping (multiple segments) | Multiple Crop Zones |
| Export with Quality Settings | Export with Format/Quality Options |
| Language Toggle (i18n) | Language Toggle (i18n) |
| Progress Visualization | Export Progress Indicator |

## Architecture Overview

### videooo-cut Architecture

```
videooo-cut/
├── main.py              # Main application logic
├── translations.py      # i18n strings
├── VideoPreviewWidget   # Custom widget for video display + crop
├── MainWindow           # Main UI container
└── ExportDialog         # Export settings dialog
```

### imageee-cut Architecture (Vue3)

```
imageee-cut/
├── src/
│   ├── components/
│   │   ├── ImagePreview.vue      # Image display + crop overlay
│   │   ├── CropControls.vue      # Crop settings panel
│   │   ├── RotationControls.vue  # Rotation buttons
│   │   ├── ExportDialog.vue      # Export settings modal
│   │   └── LanguageToggle.vue     # Language switcher
│   ├── composables/
│   │   ├── useImageEditor.ts     # Core image editing logic
│   │   ├── useCrop.ts             # Crop selection logic
│   │   ├── useRotation.ts        # Rotation logic
│   │   └── useExport.ts           # Export logic
│   ├── utils/
│   │   ├── imageProcessor.ts     # Image manipulation utilities
│   │   ├── canvasUtils.ts        # Canvas coordinate conversion
│   │   └── i18n.ts               # Translation utilities
│   ├── stores/
│   │   └── editorStore.ts        # State management (Pinia)
│   └── App.vue                   # Root component
```

## Core Concepts

### 1. Image Loading and Display

**videooo-cut approach:**
- Uses OpenCV to load video frames
- Converts BGR to RGB for display
- Caches first frame for crop mode

**imageee-cut approach:**
```typescript
// composables/useImageEditor.ts
import { ref, computed } from 'vue'

export function useImageEditor() {
  const imageFile = ref<File | null>(null)
  const imageUrl = ref<string | null>(null)
  const imageElement = ref<HTMLImageElement | null>(null)
  
  function loadImage(file: File) {
    imageFile.value = file
    imageUrl.value = URL.createObjectURL(file)
  }
  
  function createImageElement(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }
  
  return {
    imageFile,
    imageUrl,
    imageElement,
    loadImage,
    createImageElement
  }
}
```

### 2. Crop Selection with Canvas

**videooo-cut approach:**
- Custom QLabel widget with mouse event handlers
- Draws crop rectangle overlay on cached pixmap
- Converts between widget and frame coordinates

**imageee-cut approach:**

```vue
<!-- components/ImagePreview.vue -->
<template>
  <div class="image-preview-container" ref="containerRef">
    <canvas 
      ref="canvasRef"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useCrop } from '@/composables/useCrop'

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const { cropRect, isDrawing, startCrop, updateCrop, finishCrop } = useCrop()

function handleMouseDown(e: MouseEvent) {
  const rect = canvasRef.value!.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  startCrop(x, y)
}

function handleMouseMove(e: MouseEvent) {
  if (!isDrawing.value) return
  const rect = canvasRef.value!.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  updateCrop(x, y)
  drawCropOverlay()
}

function drawCropOverlay() {
  const canvas = canvasRef.value!
  const ctx = canvas.getContext('2d')!
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  // Draw image
  // Draw crop rectangle overlay
  // Draw handles
}
</script>
```

### 3. Coordinate Transformation

**videooo-cut approach:**
```python
def widget_to_frame_coords(self, widget_point):
    x = (widget_point.x() - self.widget_offset_x) / self.frame_to_widget_scale_x
    y = (widget_point.y() - self.widget_offset_y) / self.frame_to_widget_scale_y
    return QPoint(x, y)
```

**imageee-cut approach:**
```typescript
// utils/canvasUtils.ts
export function screenToImageCoords(
  screenX: number,
  screenY: number,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = image.width / canvas.width
  const scaleY = image.height / canvas.height
  
  const imageX = (screenX - rect.left) * scaleX
  const imageY = (screenY - rect.top) * scaleY
  
  return { x: imageX, y: imageY }
}

export function imageToScreenCoords(
  imageX: number,
  imageY: number,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / image.width
  const scaleY = canvas.height / image.height
  
  const screenX = imageX * scaleX + rect.left
  const screenY = imageY * scaleY + rect.top
  
  return { x: screenX, y: screenY }
}
```

### 4. Crop Selection Logic

**imageee-cut implementation:**

```typescript
// composables/useCrop.ts
import { ref, computed } from 'vue'

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export function useCrop() {
  const cropRect = ref<CropRect | null>(null)
  const isDrawing = ref(false)
  const startPoint = ref<{ x: number; y: number } | null>(null)
  const aspectRatio = ref<{ width: number; height: number } | null>(null)
  const lockAspectRatio = ref(false)
  
  function startCrop(x: number, y: number) {
    isDrawing.value = true
    startPoint.value = { x, y }
    cropRect.value = { x, y, width: 0, height: 0 }
  }
  
  function updateCrop(x: number, y: number) {
    if (!startPoint.value || !isDrawing.value) return
    
    let width = x - startPoint.value.x
    let height = y - startPoint.value.y
    
    // Apply aspect ratio constraint
    if (lockAspectRatio.value && aspectRatio.value) {
      const ratio = aspectRatio.value.width / aspectRatio.value.height
      if (Math.abs(width) > Math.abs(height)) {
        height = Math.sign(height) * Math.abs(width) / ratio
      } else {
        width = Math.sign(width) * Math.abs(height) * ratio
      }
    }
    
    cropRect.value = {
      x: Math.min(startPoint.value.x, startPoint.value.x + width),
      y: Math.min(startPoint.value.y, startPoint.value.y + height),
      width: Math.abs(width),
      height: Math.abs(height)
    }
  }
  
  function finishCrop() {
    isDrawing.value = false
    startPoint.value = null
  }
  
  function clearCrop() {
    cropRect.value = null
    isDrawing.value = false
    startPoint.value = null
  }
  
  return {
    cropRect,
    isDrawing,
    aspectRatio,
    lockAspectRatio,
    startCrop,
    updateCrop,
    finishCrop,
    clearCrop
  }
}
```

### 5. Image Rotation

**videooo-cut approach:**
```python
def apply_rotation(self, frame):
    if self.rotation == 90:
        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
    elif self.rotation == 180:
        frame = cv2.rotate(frame, cv2.ROTATE_180)
    elif self.rotation == 270:
        frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return frame
```

**imageee-cut approach:**

```typescript
// composables/useRotation.ts
import { ref } from 'vue'

export function useRotation() {
  const rotation = ref(0) // degrees: 0, 90, 180, 270
  
  function rotateLeft() {
    rotation.value = (rotation.value - 90 + 360) % 360
  }
  
  function rotateRight() {
    rotation.value = (rotation.value + 90) % 360
  }
  
  function rotate180() {
    rotation.value = (rotation.value + 180) % 360
  }
  
  function resetRotation() {
    rotation.value = 0
  }
  
  function applyRotation(canvas: HTMLCanvasElement, image: HTMLImageElement): HTMLCanvasElement {
    const rotatedCanvas = document.createElement('canvas')
    const ctx = rotatedCanvas.getContext('2d')!
    
    if (rotation.value === 90) {
      rotatedCanvas.width = image.height
      rotatedCanvas.height = image.width
      ctx.translate(rotatedCanvas.width, 0)
      ctx.rotate(Math.PI / 2)
    } else if (rotation.value === 180) {
      rotatedCanvas.width = image.width
      rotatedCanvas.height = image.height
      ctx.translate(rotatedCanvas.width, rotatedCanvas.height)
      ctx.rotate(Math.PI)
    } else if (rotation.value === 270) {
      rotatedCanvas.width = image.height
      rotatedCanvas.height = image.width
      ctx.translate(0, rotatedCanvas.height)
      ctx.rotate(-Math.PI / 2)
    } else {
      rotatedCanvas.width = image.width
      rotatedCanvas.height = image.height
    }
    
    ctx.drawImage(image, 0, 0)
    return rotatedCanvas
  }
  
  return {
    rotation,
    rotateLeft,
    rotateRight,
    rotate180,
    resetRotation,
    applyRotation
  }
}
```

### 6. Image Export

**videooo-cut approach:**
- Uses OpenCV VideoWriter
- Processes frames with rotation and crop
- Shows progress dialog

**imageee-cut approach:**

```typescript
// composables/useExport.ts
import { ref } from 'vue'

export interface ExportSettings {
  format: 'png' | 'jpg' | 'webp'
  quality: number // 0-100 for jpg/webp
  includeMetadata: boolean
}

export function useExport() {
  const isExporting = ref(false)
  const exportProgress = ref(0)
  
  async function exportImage(
    canvas: HTMLCanvasElement,
    settings: ExportSettings,
    filename: string
  ): Promise<void> {
    isExporting.value = true
    exportProgress.value = 0
    
    try {
      // Apply rotation if needed
      // Apply crop if needed
      
      exportProgress.value = 50
      
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to create blob'))
          },
          `image/${settings.format}`,
          settings.format === 'png' ? undefined : settings.quality / 100
        )
      })
      
      exportProgress.value = 90
      
      // Download file
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.${settings.format}`
      a.click()
      URL.revokeObjectURL(url)
      
      exportProgress.value = 100
    } finally {
      isExporting.value = false
    }
  }
  
  return {
    isExporting,
    exportProgress,
    exportImage
  }
}
```

### 7. Multiple Crop Zones (Shadow Cropping)

**imageee-cut implementation:**

```typescript
// composables/useCrop.ts (extended)
export function useCrop() {
  // ... existing code ...
  
  const shadowCount = ref(1) // Number of crop segments
  const shadowCrops = ref<CropRect[]>([])
  
  function updateShadowCrops() {
    if (!cropRect.value || shadowCount.value <= 1) {
      shadowCrops.value = []
      return
    }
    
    shadowCrops.value = []
    const { width, height, x, y } = cropRect.value
    
    // Create adjacent crops to the right
    for (let i = 1; i < shadowCount.value; i++) {
      shadowCrops.value.push({
        x: x + (width * i),
        y: y,
        width: width,
        height: height
      })
    }
  }
  
  watch([cropRect, shadowCount], updateShadowCrops, { immediate: true })
  
  return {
    // ... existing returns ...
    shadowCount,
    shadowCrops,
    updateShadowCrops
  }
}
```

### 8. Internationalization (i18n)

**videooo-cut approach:**
- Dictionary-based translations
- `tr()` function for lookups

**imageee-cut approach:**

```typescript
// utils/i18n.ts
export const translations = {
  en_US: {
    window_title: 'imageee-cut - Image Editor',
    import_image: 'Import Image',
    // ... more translations
  },
  zh_CN: {
    window_title: '图片剪辑 - 图片编辑器',
    import_image: '导入图片',
    // ... more translations
  },
  zh_TW: {
    window_title: '圖片剪輯 - 圖片編輯器',
    import_image: '匯入圖片',
    // ... more translations
  }
}

export function tr(key: string, locale: string = 'en_US'): string {
  return translations[locale as keyof typeof translations]?.[key] || key
}

// Or use vue-i18n:
import { createI18n } from 'vue-i18n'

export const i18n = createI18n({
  locale: 'en_US',
  messages: {
    en_US: { /* ... */ },
    zh_CN: { /* ... */ },
    zh_TW: { /* ... */ }
  }
})
```

## Vue3 Component Structure

### Main App Component

```vue
<!-- App.vue -->
<template>
  <div class="app-container">
    <header class="toolbar">
      <LanguageToggle />
      <button @click="importImage">{{ $t('import_image') }}</button>
      <RotationControls />
    </header>
    
    <main class="editor-area">
      <ImagePreview />
      <CropControls />
    </main>
    
    <footer class="bottom-toolbar">
      <button @click="exportImage" :disabled="!hasImage">
        {{ $t('export_image') }}
      </button>
    </footer>
    
    <ExportDialog v-if="showExportDialog" @close="showExportDialog = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageEditor } from '@/composables/useImageEditor'
import { useExport } from '@/composables/useExport'

const { hasImage } = useImageEditor()
const { exportImage } = useExport()
const showExportDialog = ref(false)

function importImage() {
  // File picker logic
}

function exportImage() {
  showExportDialog.value = true
}
</script>
```

## State Management (Pinia)

```typescript
// stores/editorStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEditorStore = defineStore('editor', () => {
  const currentImage = ref<File | null>(null)
  const imageUrl = ref<string | null>(null)
  const rotation = ref(0)
  const cropRect = ref<CropRect | null>(null)
  const locale = ref('en_US')
  
  function setImage(file: File) {
    currentImage.value = file
    imageUrl.value = URL.createObjectURL(file)
  }
  
  function setRotation(degrees: number) {
    rotation.value = degrees
  }
  
  return {
    currentImage,
    imageUrl,
    rotation,
    cropRect,
    locale,
    setImage,
    setRotation
  }
})
```

## Key Differences: Video vs Image

### 1. **No Frame Navigation**
- Images are static, no frame-by-frame playback
- Remove playback controls, frame slider

### 2. **Simpler Processing**
- No video encoding/decoding
- Direct canvas manipulation
- Faster operations (no frame-by-frame processing)

### 3. **Export Format**
- PNG, JPEG, WebP instead of video codecs
- Single file export instead of video segments
- Quality settings for lossy formats

### 4. **Multiple Crop Zones**
- Export multiple images instead of video segments
- Each crop zone becomes a separate image file

## Recommended Tech Stack

- **Framework**: Vue 3 (Composition API)
- **State Management**: Pinia
- **Image Processing**: HTML5 Canvas API
- **UI Components**: 
  - Tailwind CSS or Vuetify for styling
  - Custom canvas components for crop overlay
- **i18n**: vue-i18n or custom solution
- **Build Tool**: Vite
- **TypeScript**: Recommended for type safety

## Implementation Checklist

- [ ] Set up Vue3 project with Vite + TypeScript
- [ ] Create image upload component
- [ ] Implement canvas-based image preview
- [ ] Add crop selection with drag-to-select
- [ ] Implement aspect ratio locking
- [ ] Add custom aspect ratio input
- [ ] Implement rotation (90°, 180°, 270°)
- [ ] Add multiple crop zones (shadow cropping)
- [ ] Create export dialog with format/quality options
- [ ] Implement image export functionality
- [ ] Add progress indicator for export
- [ ] Set up internationalization (i18n)
- [ ] Add language toggle component
- [ ] Implement responsive design
- [ ] Add keyboard shortcuts
- [ ] Add undo/redo functionality (optional)
- [ ] Add image filters/effects (optional)

## Performance Considerations

1. **Large Images**: Use image compression or downscaling for preview
2. **Canvas Operations**: Use `requestAnimationFrame` for smooth animations
3. **Memory Management**: Revoke object URLs when done
4. **Export Optimization**: Use Web Workers for heavy processing if needed

## Testing Strategy

- Unit tests for utility functions (coordinate conversion, crop logic)
- Component tests for UI interactions
- E2E tests for complete workflows (import → crop → export)
- Visual regression tests for canvas rendering

## Additional Features to Consider

- **Zoom/Pan**: For large images
- **Undo/Redo**: History stack for operations
- **Image Filters**: Brightness, contrast, saturation
- **Batch Processing**: Process multiple images
- **Keyboard Shortcuts**: For power users
- **Touch Support**: For mobile/tablet devices

## Resources

- [Vue 3 Documentation](https://vuejs.org/)
- [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API)
- [Pinia Documentation](https://pinia.vuejs.org/)

---

This guide provides a foundation for building imageee-cut. Adapt the concepts and patterns from videooo-cut to the web-based Vue3 architecture, keeping in mind the differences between video and image processing.

