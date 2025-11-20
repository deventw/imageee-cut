import { ref } from 'vue'
import { cropImage } from '@/utils/imageProcessor'
import type { CropRect } from './useCrop'

export interface ExportSettings {
  format: 'png' | 'jpg' | 'webp'
  quality: number // 0-100 for jpg/webp
  includeMetadata: boolean
}

export function useExport() {
  const isExporting = ref(false)
  const exportProgress = ref(0)
  const exportStatus = ref('')
  const currentFile = ref(0)
  const totalFiles = ref(0)
  
  async function exportImage(
    sourceImage: HTMLImageElement,
    cropRect: CropRect | null,
    rotation: number,
    settings: ExportSettings,
    filename: string,
    shadowCrops: CropRect[] = []
  ): Promise<void> {
    isExporting.value = true
    exportProgress.value = 0
    exportStatus.value = ''
    currentFile.value = 0
    totalFiles.value = 0
    
    try {
      // Ensure we have valid crop coordinates
      const validCropRect = cropRect && cropRect.width > 0 && cropRect.height > 0 ? cropRect : null
      const validShadowCrops = shadowCrops.filter(c => c && c.width > 0 && c.height > 0)
      const cropsToExport = validCropRect ? [validCropRect, ...validShadowCrops] : []
      
      if (cropsToExport.length === 0) {
        // Export full image
        totalFiles.value = 1
        currentFile.value = 1
        exportStatus.value = 'Preparing image...'
        exportProgress.value = 20
        
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        
        // Apply rotation
        if (rotation === 90) {
          canvas.width = sourceImage.height
          canvas.height = sourceImage.width
          ctx.translate(canvas.width, 0)
          ctx.rotate(Math.PI / 2)
        } else if (rotation === 180) {
          canvas.width = sourceImage.width
          canvas.height = sourceImage.height
          ctx.translate(canvas.width, canvas.height)
          ctx.rotate(Math.PI)
        } else if (rotation === 270) {
          canvas.width = sourceImage.height
          canvas.height = sourceImage.width
          ctx.translate(0, canvas.height)
          ctx.rotate(-Math.PI / 2)
        } else {
          canvas.width = sourceImage.width
          canvas.height = sourceImage.height
        }
        
        ctx.drawImage(sourceImage, 0, 0)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        
        exportStatus.value = 'Exporting image...'
        exportProgress.value = 70
        
        await downloadCanvas(canvas, filename, settings)
        
        exportStatus.value = 'Complete!'
        exportProgress.value = 100
      } else {
        // Export cropped images
        const total = cropsToExport.length
        totalFiles.value = total
        currentFile.value = 0
        
        // iOS Safari requires delays between downloads to prevent blocking
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        const delayBetweenDownloads = isIOS ? 500 : 100
        
        for (let i = 0; i < cropsToExport.length; i++) {
          const rect = cropsToExport[i]
          if (!rect) continue
          
          currentFile.value = i + 1
          exportStatus.value = `Exporting ${i + 1} of ${total}...`
          exportProgress.value = Math.round((i / total) * 20) // 0-20% for preparation
          
          const croppedCanvas = cropImage(
            sourceImage,
            rect,
            rotation
          )
          
          exportProgress.value = Math.round((i / total) * 60 + 20) // 20-80% for processing
          
          const suffix = i === 0 ? '' : `_${i + 1}`
          await downloadCanvas(croppedCanvas, `${filename}${suffix}`, settings)
          
          exportProgress.value = Math.round(((i + 1) / total) * 90) // 90% max before completion
          
          // Add delay between downloads for iOS Safari compatibility
          if (i < cropsToExport.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenDownloads))
          }
        }
        
        exportStatus.value = 'Complete!'
        exportProgress.value = 100
      }
    } finally {
      isExporting.value = false
    }
  }
  
  function downloadCanvas(
    canvas: HTMLCanvasElement,
    filename: string,
    settings: ExportSettings
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'))
            return
          }
          
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${filename}.${settings.format}`
          
          // For iOS Safari, we need to trigger download differently
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
          
          if (isIOS) {
            // iOS Safari: open in new tab/window to trigger download
            const newWindow = window.open(url, '_blank')
            if (newWindow) {
              setTimeout(() => {
                newWindow.close()
                URL.revokeObjectURL(url)
                resolve()
              }, 100)
            } else {
              // Fallback: try regular download
              document.body.appendChild(a)
              a.click()
              setTimeout(() => {
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                resolve()
              }, 100)
            }
          } else {
            // Standard download for other browsers
            document.body.appendChild(a)
            a.click()
            setTimeout(() => {
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
              resolve()
            }, 100)
          }
        },
        `image/${settings.format}`,
        settings.format === 'png' ? undefined : settings.quality / 100
      )
    })
  }
  
  async function generatePreview(
    sourceImage: HTMLImageElement,
    cropRect: CropRect | null,
    rotation: number,
    maxSize: number = 150
  ): Promise<string> {
    let canvas: HTMLCanvasElement
    
    if (cropRect && cropRect.width > 0 && cropRect.height > 0) {
      canvas = cropImage(
        sourceImage,
        cropRect,
        rotation
      )
    } else {
      // Full image preview
      canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      if (rotation === 90) {
        canvas.width = sourceImage.height
        canvas.height = sourceImage.width
        ctx.translate(canvas.width, 0)
        ctx.rotate(Math.PI / 2)
      } else if (rotation === 180) {
        canvas.width = sourceImage.width
        canvas.height = sourceImage.height
        ctx.translate(canvas.width, canvas.height)
        ctx.rotate(Math.PI)
      } else if (rotation === 270) {
        canvas.width = sourceImage.height
        canvas.height = sourceImage.width
        ctx.translate(0, canvas.height)
        ctx.rotate(-Math.PI / 2)
      } else {
        canvas.width = sourceImage.width
        canvas.height = sourceImage.height
      }
      
      ctx.drawImage(sourceImage, 0, 0)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }
    
    // Resize for thumbnail
    const thumbCanvas = document.createElement('canvas')
    const thumbCtx = thumbCanvas.getContext('2d')!
    const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height)
    thumbCanvas.width = canvas.width * scale
    thumbCanvas.height = canvas.height * scale
    thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
    
    return thumbCanvas.toDataURL('image/png')
  }
  
  async function exportSingleImage(
    sourceImage: HTMLImageElement,
    cropRect: CropRect | null,
    rotation: number,
    settings: ExportSettings,
    filename: string
  ): Promise<void> {
    let canvas: HTMLCanvasElement
    
    if (cropRect && cropRect.width > 0 && cropRect.height > 0) {
      canvas = cropImage(
        sourceImage,
        cropRect,
        rotation
      )
    } else {
      // Export full image
      canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      if (rotation === 90) {
        canvas.width = sourceImage.height
        canvas.height = sourceImage.width
        ctx.translate(canvas.width, 0)
        ctx.rotate(Math.PI / 2)
      } else if (rotation === 180) {
        canvas.width = sourceImage.width
        canvas.height = sourceImage.height
        ctx.translate(canvas.width, canvas.height)
        ctx.rotate(Math.PI)
      } else if (rotation === 270) {
        canvas.width = sourceImage.height
        canvas.height = sourceImage.width
        ctx.translate(0, canvas.height)
        ctx.rotate(-Math.PI / 2)
      } else {
        canvas.width = sourceImage.width
        canvas.height = sourceImage.height
      }
      
      ctx.drawImage(sourceImage, 0, 0)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }
    
    await downloadCanvas(canvas, filename, settings)
  }
  
  return {
    isExporting,
    exportProgress,
    exportStatus,
    currentFile,
    totalFiles,
    exportImage,
    generatePreview,
    exportSingleImage
  }
}

