import { computed, watch } from 'vue'
import { useEditorStore } from '@/stores/editorStore'

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export function useCrop() {
  const store = useEditorStore()
  
  const cropRect = computed(() => store.cropRect)
  const isDrawing = computed(() => store.isDrawing)
  const shadowCrops = computed(() => store.shadowCrops)
  const lockAspectRatio = computed(() => store.lockAspectRatio)
  const aspectRatio = computed(() => store.aspectRatio)
  const shadowCount = computed(() => store.shadowCount)
  
  const hasCrop = computed(() => store.cropRect !== null)
  
  let startPoint: { x: number; y: number } | null = null
  let moveOffset: { x: number; y: number } | null = null
  let isMoving = false
  
  // Helper function to clamp crop rect to image bounds
  function clampCropToBounds(rect: CropRect, imageWidth: number, imageHeight: number): CropRect {
    let { x, y, width, height } = rect
    
    // Ensure width and height are positive
    if (width < 0) {
      x += width
      width = Math.abs(width)
    }
    if (height < 0) {
      y += height
      height = Math.abs(height)
    }
    
    // Clamp position to keep crop within image bounds
    x = Math.max(0, Math.min(x, imageWidth - width))
    y = Math.max(0, Math.min(y, imageHeight - height))
    
    // Ensure crop doesn't exceed image bounds
    if (x + width > imageWidth) {
      width = imageWidth - x
    }
    if (y + height > imageHeight) {
      height = imageHeight - y
    }
    
    // Ensure minimum size
    width = Math.max(1, width)
    height = Math.max(1, height)
    
    return { x, y, width, height }
  }
  
  function startCrop(x: number, y: number, imageWidth?: number, imageHeight?: number) {
    // Check if clicking inside existing crop rect (to move it)
    if (store.cropRect && imageWidth && imageHeight) {
      const rect = store.cropRect
      if (x >= rect.x && x <= rect.x + rect.width &&
          y >= rect.y && y <= rect.y + rect.height) {
        // Start moving existing crop
        isMoving = true
        moveOffset = {
          x: x - rect.x,
          y: y - rect.y
        }
        store.setIsDrawing(true)
        return
      }
    }
    
    // Start creating new crop
    isMoving = false
    moveOffset = null
    store.setIsDrawing(true)
    startPoint = { x, y }
    
    // Clamp start point to image bounds if provided
    if (imageWidth && imageHeight) {
      startPoint.x = Math.max(0, Math.min(startPoint.x, imageWidth))
      startPoint.y = Math.max(0, Math.min(startPoint.y, imageHeight))
    }
    
    store.setCropRect({ x: startPoint.x, y: startPoint.y, width: 0, height: 0 })
  }
  
  function updateCrop(x: number, y: number, imageWidth?: number, imageHeight?: number) {
    if (!store.isDrawing) return
    
    // Handle moving existing crop
    if (isMoving && moveOffset && store.cropRect && imageWidth && imageHeight) {
      const newX = x - moveOffset.x
      const newY = y - moveOffset.y
      const newRect = {
        ...store.cropRect,
        x: newX,
        y: newY
      }
      // When moving, the crop already has the correct aspect ratio from creation
      // Just clamp to bounds to keep it within image
      const clampedRect = clampCropToBounds(newRect, imageWidth, imageHeight)
      store.setCropRect(clampedRect)
      updateShadowCrops()
      return
    }
    
    // Handle creating new crop
    if (!startPoint) return
    
    let width = x - startPoint.x
    let height = y - startPoint.y
    
    // Apply aspect ratio constraint
    if (store.lockAspectRatio && store.aspectRatio) {
      const targetRatio = store.aspectRatio.width / store.aspectRatio.height
      const absWidth = Math.abs(width)
      const absHeight = Math.abs(height)
      
      // Calculate which dimension should be constrained
      // Use the dimension that would result in a larger crop area
      const widthBasedHeight = absWidth / targetRatio
      const heightBasedWidth = absHeight * targetRatio
      
      if (absWidth * absHeight < heightBasedWidth * absHeight) {
        // Constrain by height - use height-based width
        width = Math.sign(width) * heightBasedWidth
      } else {
        // Constrain by width - use width-based height
        height = Math.sign(height) * widthBasedHeight
      }
      
      // Ensure minimum size
      if (Math.abs(width) < 1) {
        width = Math.sign(width) || 1
        height = Math.sign(height) * Math.abs(width) / targetRatio
      }
      if (Math.abs(height) < 1) {
        height = Math.sign(height) || 1
        width = Math.sign(width) * Math.abs(height) * targetRatio
      }
    }
    
    let newRect: CropRect = {
      x: Math.min(startPoint.x, startPoint.x + width),
      y: Math.min(startPoint.y, startPoint.y + height),
      width: Math.abs(width),
      height: Math.abs(height)
    }
    
    // Clamp to image bounds if provided
    if (imageWidth && imageHeight) {
      newRect = clampCropToBounds(newRect, imageWidth, imageHeight)
    }
    
    store.setCropRect(newRect)
    updateShadowCrops()
  }
  
  function finishCrop() {
    store.setIsDrawing(false)
    startPoint = null
    moveOffset = null
    isMoving = false
  }
  
  function clearCrop() {
    store.setCropRect(null)
    store.setIsDrawing(false)
    startPoint = null
    store.setShadowCrops([])
  }
  
  function setAspectRatio(width: number, height: number) {
    store.setAspectRatio({ width, height })
    store.setLockAspectRatio(true)
  }
  
  function setFreeAspectRatio() {
    store.setLockAspectRatio(false)
    store.setAspectRatio(null)
  }
  
  function applyRatioToSelection(imageWidth?: number, imageHeight?: number) {
    if (!store.cropRect || !store.aspectRatio || !imageWidth || !imageHeight) return
    
    const targetRatio = store.aspectRatio.width / store.aspectRatio.height
    const currentRect = store.cropRect
    
    // Calculate new dimensions maintaining the center point
    let newWidth = currentRect.width
    let newHeight = currentRect.height
    
    // Adjust to match aspect ratio
    const currentRatio = newWidth / newHeight
    if (currentRatio > targetRatio) {
      // Too wide, adjust height
      newHeight = newWidth / targetRatio
    } else {
      // Too tall, adjust width
      newWidth = newHeight * targetRatio
    }
    
    // Keep center point
    const centerX = currentRect.x + currentRect.width / 2
    const centerY = currentRect.y + currentRect.height / 2
    
    const newRect: CropRect = {
      x: centerX - newWidth / 2,
      y: centerY - newHeight / 2,
      width: newWidth,
      height: newHeight
    }
    
    // Clamp to bounds
    const clampedRect = clampCropToBounds(newRect, imageWidth, imageHeight)
    store.setCropRect(clampedRect)
    updateShadowCrops()
  }
  
  function updateShadowCrops() {
    if (!store.cropRect || store.shadowCount <= 1) {
      store.setShadowCrops([])
      return
    }
    
    const crops: CropRect[] = []
    const { width, height, x, y } = store.cropRect
    
    // Create adjacent crops to the right
    for (let i = 1; i < store.shadowCount; i++) {
      crops.push({
        x: x + (width * i),
        y: y,
        width: width,
        height: height
      })
    }
    
    store.setShadowCrops(crops)
  }
  
  watch([cropRect, shadowCount], updateShadowCrops, { immediate: true })
  
  return {
    cropRect,
    isDrawing,
    aspectRatio,
    lockAspectRatio,
    shadowCount,
    shadowCrops,
    hasCrop,
    startCrop,
    updateCrop,
    finishCrop,
    clearCrop,
    setAspectRatio,
    setFreeAspectRatio,
    applyRatioToSelection,
    updateShadowCrops
  }
}

