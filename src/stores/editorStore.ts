import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Locale } from '@/utils/i18n'
import type { CropRect } from '@/composables/useCrop'
import type { ImageMetadata } from '@/utils/metadata'

// Helper function to safely get locale from localStorage
function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en_US'
  
  try {
    const stored = localStorage.getItem('imageee-cut-locale')
    if (stored && (stored === 'en_US' || stored === 'zh_CN' || stored === 'zh_TW')) {
      return stored as Locale
    }
  } catch (e) {
    // localStorage might not be available (private browsing, etc.)
    console.warn('Failed to read locale from localStorage:', e)
  }
  
  return 'en_US'
}

// Helper function to safely save locale to localStorage
function saveLocaleToStorage(locale: Locale) {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('imageee-cut-locale', locale)
  } catch (e) {
    // localStorage might not be available (private browsing, etc.)
    console.warn('Failed to save locale to localStorage:', e)
  }
}

export const useEditorStore = defineStore('editor', () => {
  const currentImage = ref<File | null>(null)
  const imageUrl = ref<string | null>(null)
  const imageElement = ref<HTMLImageElement | null>(null)
  const rotation = ref(0)
  const cropRect = ref<CropRect | null>(null)
  const shadowCrops = ref<CropRect[]>([])
  const isDrawing = ref(false)
  const lockAspectRatio = ref(false)
  const aspectRatio = ref<{ width: number; height: number } | null>(null)
  const shadowCount = ref(1)
  const locale = ref<Locale>(getStoredLocale())
  const imageMetadata = ref<ImageMetadata | null>(null)
  const originalImageFormat = ref<'png' | 'jpg' | 'webp' | null>(null)
  
  function detectFileFormat(file: File): 'png' | 'jpg' | 'webp' | null {
    const fileName = file.name.toLowerCase()
    const mimeType = (file.type || '').toLowerCase()
    
    if (mimeType.includes('jpeg') || mimeType.includes('jpg') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      return 'jpg'
    }
    if (mimeType.includes('png') || fileName.endsWith('.png')) {
      return 'png'
    }
    if (mimeType.includes('webp') || fileName.endsWith('.webp')) {
      return 'webp'
    }
    return null
  }
  
  function setImage(file: File) {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value)
    }
    currentImage.value = file
    imageUrl.value = URL.createObjectURL(file)
    // Store original file format immediately
    const detectedFormat = detectFileFormat(file)
    originalImageFormat.value = detectedFormat
    console.log('setImage - Format detection:', {
      fileName: file.name,
      mimeType: file.type,
      detectedFormat,
      originalImageFormat: originalImageFormat.value
    })
  }
  
  function setImageElement(element: HTMLImageElement) {
    imageElement.value = element
  }
  
  function setRotation(degrees: number) {
    rotation.value = degrees
  }
  
  function setCropRect(rect: CropRect | null) {
    cropRect.value = rect
  }
  
  function setShadowCrops(crops: CropRect[]) {
    shadowCrops.value = crops
  }
  
  function setIsDrawing(drawing: boolean) {
    isDrawing.value = drawing
  }
  
  function setLockAspectRatio(lock: boolean) {
    lockAspectRatio.value = lock
  }
  
  function setAspectRatio(ratio: { width: number; height: number } | null) {
    aspectRatio.value = ratio
  }
  
  function setShadowCount(count: number) {
    shadowCount.value = count
  }
  
  function setImageMetadata(metadata: ImageMetadata | null) {
    imageMetadata.value = metadata
  }
  
  function setLocale(newLocale: Locale) {
    locale.value = newLocale
    saveLocaleToStorage(newLocale)
  }
  
  function clearImage() {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value)
    }
    currentImage.value = null
    imageUrl.value = null
    imageElement.value = null
    rotation.value = 0
    cropRect.value = null
    shadowCrops.value = []
    isDrawing.value = false
    imageMetadata.value = null
    originalImageFormat.value = null
  }
  
  return {
    currentImage,
    imageUrl,
    imageElement,
    rotation,
    cropRect,
    shadowCrops,
    isDrawing,
    lockAspectRatio,
    aspectRatio,
    shadowCount,
    imageMetadata,
    originalImageFormat,
    locale,
    setImage,
    setImageElement,
    setRotation,
    setCropRect,
    setShadowCrops,
    setIsDrawing,
    setLockAspectRatio,
    setAspectRatio,
    setShadowCount,
    setImageMetadata,
    setLocale,
    clearImage
  }
})

