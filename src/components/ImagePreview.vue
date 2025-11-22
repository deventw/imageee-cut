<template>
  <div class="image-preview-container" ref="containerRef">
    <div v-if="!hasImage" class="empty-state">
      <p>{{ $t('no_image_loaded') }}</p>
      <p class="hint">{{ $t('use_import_button') }}</p>
    </div>
    
    <div v-else class="canvas-wrapper">
      <canvas 
        ref="canvasRef"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseLeave"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        class="preview-canvas"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCrop } from '@/composables/useCrop'
import { useI18n } from '@/composables/useI18n'
import { useImageEditor } from '@/composables/useImageEditor'
import { useRotation } from '@/composables/useRotation'
import { fitImageToCanvas } from '@/utils/canvasUtils'
import { nextTick, onMounted, ref, watch } from 'vue'

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()

const { imageUrl, imageElement, hasImage, createImageElement } = useImageEditor()
const { cropRect, isDrawing, startCrop, updateCrop, finishCrop, shadowCrops, getResizeHandle } = useCrop()
const { rotation } = useRotation()
const { $t } = useI18n()

let displayImage: HTMLImageElement | null = null
let rafId: number | null = null
let isDrawingOverlay = false
let cachedImageData: ImageData | null = null
let cachedDrawParams: {
  drawX: number
  drawY: number
  drawWidth: number
  drawHeight: number
  centerX: number
  centerY: number
  scaleX: number
  scaleY: number
} | null = null

// Throttled draw function using requestAnimationFrame
function scheduleDraw() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    if (isDrawingOverlay && cachedImageData && cachedDrawParams) {
      drawOverlayOnly()
    } else {
      draw()
    }
  })
}

onMounted(() => {
  setupCanvas()
  
  watch([imageUrl, rotation], async () => {
    if (imageUrl.value) {
      // Reset displayImage when URL changes
      if (displayImage?.src !== imageUrl.value) {
        displayImage = await createImageElement(imageUrl.value)
        cachedImageData = null
      }
      await nextTick()
      resizeCanvas()
      await nextTick()
      scheduleDraw()
    }
  }, { immediate: true })
  
  watch(imageElement, async (newElement) => {
    if (newElement) {
      displayImage = newElement
      cachedImageData = null
      await nextTick()
      resizeCanvas()
      await nextTick()
      scheduleDraw()
    }
  })
  
  watch(hasImage, async (hasImg) => {
    if (hasImg) {
      await nextTick()
      resizeCanvas()
      await nextTick()
      scheduleDraw()
    }
  })
  
  // Watch cropRect separately for overlay-only updates
  watch(cropRect, () => {
    if (isDrawing.value && cachedImageData) {
      // Verify cache is still valid before using overlay-only mode
      const canvas = canvasRef.value
      if (canvas) {
        const wrapper = canvas.parentElement
        if (wrapper) {
          const wrapperRect = wrapper.getBoundingClientRect()
          const displayWidth = wrapperRect.width || canvas.offsetWidth
          const displayHeight = wrapperRect.height || canvas.offsetHeight
          
          // Only use overlay-only if dimensions match
          if (cachedImageData.width === displayWidth && cachedImageData.height === displayHeight) {
            isDrawingOverlay = true
            scheduleDraw()
            return
          }
        }
      }
    }
    // Fallback to full redraw
    isDrawingOverlay = false
    cachedImageData = null
    scheduleDraw()
  })
  
  // Clear cache when drawing stops and force full redraw
  watch(isDrawing, (drawing) => {
    if (!drawing) {
      isDrawingOverlay = false
      cachedImageData = null
      cachedDrawParams = null
      // Force full redraw when drawing stops to ensure image is fully visible
      scheduleDraw()
    }
  })
  
  watch(shadowCrops, () => {
    scheduleDraw()
  })
})

let resizeTimeout: number | null = null

function resizeCanvas() {
  if (!canvasRef.value) return
  
  const canvas = canvasRef.value
  const wrapper = canvas.parentElement
  
  if (wrapper) {
    const rect = wrapper.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    
    // Debounce resize to avoid excessive redraws
    if (resizeTimeout !== null) {
      cancelAnimationFrame(resizeTimeout)
    }
    
    resizeTimeout = requestAnimationFrame(() => {
      resizeTimeout = null
      if (!canvasRef.value) return
      
      const displayWidth = Math.floor(rect.width)
      const displayHeight = Math.floor(rect.height)
      
      // Reduce DPR on mobile for better performance
      const isMobile = window.innerWidth < 768
      const dpr = isMobile ? Math.min(window.devicePixelRatio || 1, 2) : (window.devicePixelRatio || 1)
      
      canvas.width = displayWidth * dpr
      canvas.height = displayHeight * dpr
      
      // Set CSS size to match wrapper (prevents scrollbars)
      canvas.style.width = displayWidth + 'px'
      canvas.style.height = displayHeight + 'px'
      
      // Scale context to handle device pixel ratio
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      
      // Clear cache on resize to force full redraw
      cachedImageData = null
      cachedDrawParams = null
      
      // Redraw after resize
      if (hasImage.value) {
        scheduleDraw()
      }
    })
  }
}

function setupCanvas() {
  resizeCanvas()
  
  // Use ResizeObserver for better resize handling with debouncing
  const wrapper = canvasRef.value?.parentElement
  if (wrapper) {
    let resizeObserverTimeout: number | null = null
    const resizeObserver = new ResizeObserver(() => {
      if (resizeObserverTimeout !== null) {
        cancelAnimationFrame(resizeObserverTimeout)
      }
      resizeObserverTimeout = requestAnimationFrame(() => {
        resizeObserverTimeout = null
        resizeCanvas()
      })
    })
    resizeObserver.observe(wrapper)
    
    // Also listen to window resize as fallback (debounced)
    let windowResizeTimeout: number | null = null
    const handleWindowResize = () => {
      if (windowResizeTimeout !== null) {
        cancelAnimationFrame(windowResizeTimeout)
      }
      windowResizeTimeout = requestAnimationFrame(() => {
        windowResizeTimeout = null
        resizeCanvas()
      })
    }
    window.addEventListener('resize', handleWindowResize, { passive: true })
    
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleWindowResize)
      if (resizeObserverTimeout !== null) cancelAnimationFrame(resizeObserverTimeout)
      if (windowResizeTimeout !== null) cancelAnimationFrame(windowResizeTimeout)
    }
  } else {
    let windowResizeTimeout: number | null = null
    const handleWindowResize = () => {
      if (windowResizeTimeout !== null) {
        cancelAnimationFrame(windowResizeTimeout)
      }
      windowResizeTimeout = requestAnimationFrame(() => {
        windowResizeTimeout = null
        resizeCanvas()
      })
    }
    window.addEventListener('resize', handleWindowResize, { passive: true })
    return () => {
      window.removeEventListener('resize', handleWindowResize)
      if (windowResizeTimeout !== null) cancelAnimationFrame(windowResizeTimeout)
    }
  }
}

async function draw() {
  if (!canvasRef.value || !hasImage.value) return
  
  const canvas = canvasRef.value
  
  // Ensure canvas has valid dimensions
  const wrapper = canvas.parentElement
  if (!wrapper) return
  
  const wrapperRect = wrapper.getBoundingClientRect()
  if (wrapperRect.width === 0 || wrapperRect.height === 0) {
    // Wait a bit for layout
    await new Promise(resolve => setTimeout(resolve, 50))
    resizeCanvas()
    // Get rect again after resize
    const newRect = wrapper.getBoundingClientRect()
    if (newRect.width === 0 || newRect.height === 0) return
  }
  
  // Use CSS dimensions for calculations (not canvas resolution)
  const displayWidth = wrapperRect.width || canvas.offsetWidth
  const displayHeight = wrapperRect.height || canvas.offsetHeight
  
  if (displayWidth === 0 || displayHeight === 0) return
  
  const ctx = canvas.getContext('2d')!
  
  // Clear canvas (using display dimensions since context is scaled)
  ctx.clearRect(0, 0, displayWidth, displayHeight)
  
  // Load image if needed
  if (!displayImage && imageUrl.value) {
    displayImage = await createImageElement(imageUrl.value)
  }
  
  if (!displayImage) return
  
  // Calculate rotated dimensions for fitting
  const rotatedWidth = rotation.value === 90 || rotation.value === 270 ? displayImage.height : displayImage.width
  const rotatedHeight = rotation.value === 90 || rotation.value === 270 ? displayImage.width : displayImage.height
  
  // Calculate fit using rotated dimensions
  const fit = fitImageToCanvas(rotatedWidth, rotatedHeight, displayWidth, displayHeight)
  
  // Calculate aspect ratios
  const imageAspect = displayImage.width / displayImage.height
  const fitAspect = fit.width / fit.height
  
  // Calculate actual draw dimensions (maintaining aspect ratio)
  let drawWidth = fit.width
  let drawHeight = fit.height
  
  if (imageAspect > fitAspect) {
    drawHeight = drawWidth / imageAspect
  } else {
    drawWidth = drawHeight * imageAspect
  }
  
  const drawX = fit.offsetX + (fit.width - drawWidth) / 2
  const drawY = fit.offsetY + (fit.height - drawHeight) / 2
  
  // Calculate center of the image
  const centerX = drawX + drawWidth / 2
  const centerY = drawY + drawHeight / 2
  
  // Cache draw parameters for overlay-only updates
  cachedDrawParams = {
    drawX,
    drawY,
    drawWidth,
    drawHeight,
    centerX,
    centerY,
    scaleX: drawWidth / displayImage.width,
    scaleY: drawHeight / displayImage.height
  }
  
  // Save context
  ctx.save()
  
  // Translate to center, rotate, then translate back
  ctx.translate(centerX, centerY)
  ctx.rotate((rotation.value * Math.PI) / 180)
  ctx.translate(-centerX, -centerY)
  
  // Draw image
  ctx.drawImage(
    displayImage,
    0, 0, displayImage.width, displayImage.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  )
  
  // Restore context
  ctx.restore()
  
  // Cache the image data for overlay-only updates (before drawing overlay)
  // Only cache if dimensions match and we're drawing
  if (isDrawing.value) {
    // Check if we need to update cache (dimensions changed or cache doesn't exist)
    if (!cachedImageData || 
        cachedImageData.width !== displayWidth || 
        cachedImageData.height !== displayHeight) {
      cachedImageData = ctx.getImageData(0, 0, displayWidth, displayHeight)
    }
  }
  
  // Draw crop overlay (needs to account for rotation)
  if (cropRect.value) {
    drawCropOverlay(ctx, fit, rotation.value)
  }
}

function drawOverlayOnly() {
  if (!canvasRef.value || !hasImage.value || !cachedImageData || !cachedDrawParams) {
    draw()
    return
  }
  
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')!
  
  // Get wrapper dimensions
  const wrapper = canvas.parentElement
  if (!wrapper) return
  
  const wrapperRect = wrapper.getBoundingClientRect()
  const displayWidth = wrapperRect.width || canvas.offsetWidth
  const displayHeight = wrapperRect.height || canvas.offsetHeight
  
  if (displayWidth === 0 || displayHeight === 0) return
  
  // Check if cached image data dimensions match current canvas dimensions
  // If not, invalidate cache and do full redraw
  if (cachedImageData.width !== displayWidth || cachedImageData.height !== displayHeight) {
    cachedImageData = null
    draw()
    return
  }
  
  // Restore cached image
  ctx.putImageData(cachedImageData, 0, 0)
  
  // Calculate fit for overlay
  const rotatedWidth = rotation.value === 90 || rotation.value === 270 ? displayImage!.height : displayImage!.width
  const rotatedHeight = rotation.value === 90 || rotation.value === 270 ? displayImage!.width : displayImage!.height
  const fit = fitImageToCanvas(rotatedWidth, rotatedHeight, displayWidth, displayHeight)
  
  // Draw crop overlay only
  if (cropRect.value) {
    drawCropOverlay(ctx, fit, rotation.value)
  }
}

function drawCropOverlay(ctx: CanvasRenderingContext2D, fit: { width: number; height: number; offsetX: number; offsetY: number }, rotationDegrees: number = 0) {
  if (!cropRect.value || !displayImage) return
  
  // Calculate actual draw dimensions (same as in draw())
  const imageAspect = displayImage.width / displayImage.height
  const fitAspect = fit.width / fit.height
  
  let drawWidth = fit.width
  let drawHeight = fit.height
  
  if (imageAspect > fitAspect) {
    drawHeight = drawWidth / imageAspect
  } else {
    drawWidth = drawHeight * imageAspect
  }
  
  const drawX = fit.offsetX + (fit.width - drawWidth) / 2
  const drawY = fit.offsetY + (fit.height - drawHeight) / 2
  
  // Convert crop coordinates (in image space) to display coordinates
  // Crop coordinates are in original image space, need to transform to display space
  const scaleX = drawWidth / displayImage.width
  const scaleY = drawHeight / displayImage.height
  
  // Convert crop rect from image coordinates to display coordinates (before rotation)
  let cropDisplayX = cropRect.value.x * scaleX
  let cropDisplayY = cropRect.value.y * scaleY
  let cropDisplayWidth = cropRect.value.width * scaleX
  let cropDisplayHeight = cropRect.value.height * scaleY
  
  // Apply rotation transformation to the crop rectangle
  const centerX = drawX + drawWidth / 2
  const centerY = drawY + drawHeight / 2
  
  const angle = (rotationDegrees * Math.PI) / 180
  
  // For overlay, we'll draw a simpler approach - draw the rotated rect directly
  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(angle)
  
  // Draw dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  
  // Clear crop area
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillRect(
    cropDisplayX - drawWidth / 2,
    cropDisplayY - drawHeight / 2,
    cropDisplayWidth,
    cropDisplayHeight
  )
  ctx.globalCompositeOperation = 'source-over'
  
  // Draw crop border
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.strokeRect(
    cropDisplayX - drawWidth / 2,
    cropDisplayY - drawHeight / 2,
    cropDisplayWidth,
    cropDisplayHeight
  )
  
  // Draw handles
  const handleSize = 8
  ctx.fillStyle = '#fff'
  const handleX = cropDisplayX - drawWidth / 2
  const handleY = cropDisplayY - drawHeight / 2
  ctx.fillRect(handleX - handleSize/2, handleY - handleSize/2, handleSize, handleSize)
  ctx.fillRect(handleX + cropDisplayWidth - handleSize/2, handleY - handleSize/2, handleSize, handleSize)
  ctx.fillRect(handleX - handleSize/2, handleY + cropDisplayHeight - handleSize/2, handleSize, handleSize)
  ctx.fillRect(handleX + cropDisplayWidth - handleSize/2, handleY + cropDisplayHeight - handleSize/2, handleSize, handleSize)
  
  ctx.restore()
  
  // Draw shadow crops
  shadowCrops.value.forEach((shadowRect) => {
    const shadowDisplayX = shadowRect.x * scaleX
    const shadowDisplayY = shadowRect.y * scaleY
    const shadowDisplayWidth = shadowRect.width * scaleX
    const shadowDisplayHeight = shadowRect.height * scaleY
    
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(angle)
    
    ctx.strokeStyle = '#ff0'
    ctx.lineWidth = 2
    ctx.strokeRect(
      shadowDisplayX - drawWidth / 2,
      shadowDisplayY - drawHeight / 2,
      shadowDisplayWidth,
      shadowDisplayHeight
    )
    
    ctx.restore()
  })
}

// Helper function to convert screen coordinates to image coordinates
function screenToImageCoords(screenX: number, screenY: number): { x: number; y: number } | null {
  if (!canvasRef.value || !displayImage) return null
  
  const canvas = canvasRef.value
  const wrapper = canvas.parentElement
  if (!wrapper) return null
  
  const wrapperRect = wrapper.getBoundingClientRect()
  const displayWidth = wrapperRect.width
  const displayHeight = wrapperRect.height
  
  // Calculate the same way as draw() does
  const rotatedWidth = rotation.value === 90 || rotation.value === 270 ? displayImage.height : displayImage.width
  const rotatedHeight = rotation.value === 90 || rotation.value === 270 ? displayImage.width : displayImage.height
  const fit = fitImageToCanvas(rotatedWidth, rotatedHeight, displayWidth, displayHeight)
  
  const imageAspect = displayImage.width / displayImage.height
  const fitAspect = fit.width / fit.height
  
  let drawWidth = fit.width
  let drawHeight = fit.height
  
  if (imageAspect > fitAspect) {
    drawHeight = drawWidth / imageAspect
  } else {
    drawWidth = drawHeight * imageAspect
  }
  
  const drawX = fit.offsetX + (fit.width - drawWidth) / 2
  const drawY = fit.offsetY + (fit.height - drawHeight) / 2
  
  // Convert screen coordinates to image coordinates
  const centerX = drawX + drawWidth / 2
  const centerY = drawY + drawHeight / 2
  
  // Translate to origin, rotate back, then translate to image space
  let relX = screenX - centerX
  let relY = screenY - centerY
  
  // Reverse rotation
  const angle = -(rotation.value * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const rotatedRelX = relX * cos - relY * sin
  const rotatedRelY = relX * sin + relY * cos
  
  // Convert to image coordinates (allow values outside image bounds for mobile-friendly selection)
  const imageX = ((rotatedRelX + drawWidth / 2) / drawWidth) * displayImage.width
  const imageY = ((rotatedRelY + drawHeight / 2) / drawHeight) * displayImage.height
  
  return { x: imageX, y: imageY }
}

function handleMouseDown(e: MouseEvent) {
  if (!canvasRef.value || !displayImage || !hasImage.value) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const coords = screenToImageCoords(x, y)
  if (coords && displayImage) {
    // Check if clicking inside existing crop before starting
    const existingCrop = cropRect.value
    const isInsideExisting = existingCrop && 
      coords.x >= existingCrop.x && coords.x <= existingCrop.x + existingCrop.width &&
      coords.y >= existingCrop.y && coords.y <= existingCrop.y + existingCrop.height
    
    startCrop(coords.x, coords.y, displayImage.width, displayImage.height)
    
    // Update cursor during drag
    if (canvasRef.value) {
      canvasRef.value.style.cursor = isInsideExisting ? 'grabbing' : 'crosshair'
    }
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!canvasRef.value || !displayImage) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const coords = screenToImageCoords(x, y)
  if (!coords || !displayImage) return
  
  // Update cursor based on state
  if (isDrawing.value) {
    // During drag, show grabbing cursor if moving, resize cursor if resizing, otherwise crosshair for new crop
    if (canvasRef.value) {
      // Check if we're resizing (handle exists) or creating new crop
      const handle = cropRect.value ? getResizeHandle(coords.x, coords.y, cropRect.value) : null
      if (handle) {
        const cursorMap: Record<string, string> = {
          'nw': 'nw-resize',
          'ne': 'ne-resize',
          'sw': 'sw-resize',
          'se': 'se-resize',
          'n': 'n-resize',
          's': 's-resize',
          'e': 'e-resize',
          'w': 'w-resize'
        }
        canvasRef.value.style.cursor = cursorMap[handle] || 'grabbing'
      } else {
        canvasRef.value.style.cursor = 'grabbing'
      }
    }
    // Handle drawing/moving/resizing crop
    updateCrop(coords.x, coords.y, displayImage.width, displayImage.height)
    scheduleDraw()
  } else if (cropRect.value) {
    // Check for resize handles first
    const handle = getResizeHandle(coords.x, coords.y, cropRect.value)
    if (handle && canvasRef.value) {
      // Set appropriate resize cursor based on handle
      const cursorMap: Record<string, string> = {
        'nw': 'nw-resize',
        'ne': 'ne-resize',
        'sw': 'sw-resize',
        'se': 'se-resize',
        'n': 'n-resize',
        's': 's-resize',
        'e': 'e-resize',
        'w': 'w-resize'
      }
      canvasRef.value.style.cursor = cursorMap[handle] || 'move'
    } else {
      // When not drawing, show move cursor if hovering over crop
      const rect = cropRect.value
      const isInside = coords.x >= rect.x && coords.x <= rect.x + rect.width &&
                       coords.y >= rect.y && coords.y <= rect.y + rect.height
      if (canvasRef.value) {
        canvasRef.value.style.cursor = isInside ? 'move' : 'default'
      }
    }
  } else {
    // No crop, show crosshair to indicate new crop can be created
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'crosshair'
    }
  }
}

function handleMouseUp() {
  if (isDrawing.value) {
    finishCrop()
    // Reset cursor
    if (canvasRef.value) {
      canvasRef.value.style.cursor = cropRect.value ? 'move' : 'crosshair'
    }
  }
}

function handleMouseLeave() {
  if (isDrawing.value) {
    finishCrop()
  }
}

function handleTouchStart(e: TouchEvent) {
  e.preventDefault()
  if (!canvasRef.value || !displayImage || !hasImage.value) return
  
  const touch = e.touches[0]
  if (!touch) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top
  
  const coords = screenToImageCoords(x, y)
  if (coords && displayImage) {
    startCrop(coords.x, coords.y, displayImage.width, displayImage.height)
  }
}

function handleTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (!canvasRef.value || !displayImage || !isDrawing.value) return
  
  const touch = e.touches[0]
  if (!touch) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top
  
  const coords = screenToImageCoords(x, y)
  if (coords && displayImage) {
    updateCrop(coords.x, coords.y, displayImage.width, displayImage.height)
    scheduleDraw()
  }
}

function handleTouchEnd(e: TouchEvent) {
  e.preventDefault()
  if (isDrawing.value) {
    finishCrop()
  }
}
</script>

<style scoped>
.image-preview-container {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ede8e0;
  position: relative;
  overflow: hidden;
  touch-action: none;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.empty-state p {
  color: #6b5d4f;
  font-size: 1rem;
  line-height: 1.6;
  margin: 0.5rem 0;
}

.empty-state .hint {
  font-size: 0.9rem;
  color: #9c8a7a;
  font-style: italic;
}

.canvas-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
}

.preview-canvas {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  display: block;
  cursor: crosshair;
  border: 1px solid #d4c4b0;
  border-radius: 0;
  background: #faf8f4;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  object-fit: contain;
}

@media (min-width: 768px) {
  .canvas-wrapper {
    padding: 0.75rem;
  }
  
  .preview-canvas {
    border-radius: 6px;
    border: 1px solid #d4c4b0;
  }
}
</style>

