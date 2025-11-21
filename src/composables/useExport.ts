import { ref } from 'vue'
import { cropImage } from '@/utils/imageProcessor'
import { useEditorStore } from '@/stores/editorStore'
import type { CropRect } from './useCrop'
import type { ImageMetadata } from '@/utils/metadata'
import { applyMetadataToBlob, metadataSupportedForFormat } from '@/utils/metadata'

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
  const store = useEditorStore()
  
  function resolveMetadataForExport(
    format: ExportSettings['format'],
    includeMetadata: boolean
  ): ImageMetadata | null {
    if (!includeMetadata) return null
    if (format !== 'jpg' && format !== 'png') return null
    return metadataSupportedForFormat(store.imageMetadata, format) ? store.imageMetadata : null
  }
  
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
      
      const metadataForExport = resolveMetadataForExport(settings.format, settings.includeMetadata)
      
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
        
        await downloadCanvas(canvas, filename, settings, metadataForExport)
        
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
          await downloadCanvas(croppedCanvas, `${filename}${suffix}`, settings, metadataForExport)
          
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
    settings: ExportSettings,
    metadata: ImageMetadata | null
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // For JPEG, ensure we use the correct MIME type and prepare canvas (remove transparency)
      let exportCanvas = canvas
      if (settings.format === 'jpg') {
        // Create a new canvas with white background to remove transparency
        const jpegCanvas = document.createElement('canvas')
        jpegCanvas.width = canvas.width
        jpegCanvas.height = canvas.height
        const jpegCtx = jpegCanvas.getContext('2d')!
        // Fill with white background
        jpegCtx.fillStyle = '#FFFFFF'
        jpegCtx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height)
        // Draw the original canvas on top
        jpegCtx.drawImage(canvas, 0, 0)
        exportCanvas = jpegCanvas
      }
      
      // Determine correct MIME type
      const mimeType = settings.format === 'jpg' 
        ? 'image/jpeg' 
        : settings.format === 'png'
        ? 'image/png'
        : 'image/webp'
      
      exportCanvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'))
            return
          }
          try {
            const metadataFormat = settings.format === 'jpg' || settings.format === 'png'
              ? settings.format
              : null
            
            let finalBlob = blob
            if (metadata && metadataFormat && settings.includeMetadata) {
              // Verify blob type matches the requested format before applying metadata
              const blobIsJpeg = blob.type.includes('jpeg') || blob.type.includes('jpg')
              const blobIsPng = blob.type.includes('png')
              const formatMatchesBlob = 
                (metadataFormat === 'jpg' && blobIsJpeg) ||
                (metadataFormat === 'png' && blobIsPng)
              
              if (formatMatchesBlob) {
                console.log('Applying metadata:', { format: metadataFormat, blobType: blob.type, metadata })
                finalBlob = await applyMetadataToBlob(blob, metadata, metadataFormat)
                console.log('Metadata applied, blob size:', finalBlob.size, 'original:', blob.size)
              } else {
                console.warn(`Skipping metadata: format mismatch - requested ${metadataFormat} but blob is ${blob.type}`)
              }
            } else {
              console.log('Skipping metadata:', { 
                hasMetadata: !!metadata, 
                metadataFormat, 
                includeMetadata: settings.includeMetadata 
              })
            }
            
            triggerBlobDownload(finalBlob, filename, settings.format, resolve)
          } catch (error) {
            console.error('Error in downloadCanvas:', error)
            reject(error)
          }
        },
        mimeType,
        settings.format === 'png' ? undefined : settings.quality / 100
      )
    })
  }
  
  function triggerBlobDownload(
    blob: Blob,
    filename: string,
    extension: string,
    resolve: () => void
  ) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.${extension}`
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    
    if (isIOS) {
      const newWindow = window.open(url, '_blank')
      if (newWindow) {
        setTimeout(() => {
          newWindow.close()
          URL.revokeObjectURL(url)
          resolve()
        }, 100)
      } else {
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          resolve()
        }, 100)
      }
    } else {
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        resolve()
      }, 100)
    }
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
    
    const metadataForExport = resolveMetadataForExport(settings.format, settings.includeMetadata)
    await downloadCanvas(canvas, filename, settings, metadataForExport)
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

