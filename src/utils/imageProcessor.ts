export function createImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

export function drawImageOnCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  rotation: number = 0
): void {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  if (rotation === 0) {
    canvas.width = image.width
    canvas.height = image.height
    ctx.drawImage(image, 0, 0)
  } else if (rotation === 90) {
    canvas.width = image.height
    canvas.height = image.width
    ctx.translate(canvas.width, 0)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(image, 0, 0)
  } else if (rotation === 180) {
    canvas.width = image.width
    canvas.height = image.height
    ctx.translate(canvas.width, canvas.height)
    ctx.rotate(Math.PI)
    ctx.drawImage(image, 0, 0)
  } else if (rotation === 270) {
    canvas.width = image.height
    canvas.height = image.width
    ctx.translate(0, canvas.height)
    ctx.rotate(-Math.PI / 2)
    ctx.drawImage(image, 0, 0)
  }
  
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

export function cropImage(
  sourceImage: HTMLImageElement,
  cropRect: { x: number; y: number; width: number; height: number },
  rotation: number = 0
): HTMLCanvasElement {
  const croppedCanvas = document.createElement('canvas')
  const ctx = croppedCanvas.getContext('2d')!
  
  // First apply rotation if needed
  if (rotation !== 0) {
    // Create rotated image first
    const rotatedCanvas = document.createElement('canvas')
    let rotatedWidth: number
    let rotatedHeight: number
    
    if (rotation === 90) {
      rotatedWidth = sourceImage.height
      rotatedHeight = sourceImage.width
      rotatedCanvas.width = rotatedWidth
      rotatedCanvas.height = rotatedHeight
      const rotatedCtx = rotatedCanvas.getContext('2d')!
      rotatedCtx.translate(rotatedWidth, 0)
      rotatedCtx.rotate(Math.PI / 2)
      rotatedCtx.drawImage(sourceImage, 0, 0)
      rotatedCtx.setTransform(1, 0, 0, 1, 0, 0)
    } else if (rotation === 180) {
      rotatedWidth = sourceImage.width
      rotatedHeight = sourceImage.height
      rotatedCanvas.width = rotatedWidth
      rotatedCanvas.height = rotatedHeight
      const rotatedCtx = rotatedCanvas.getContext('2d')!
      rotatedCtx.translate(rotatedWidth, rotatedHeight)
      rotatedCtx.rotate(Math.PI)
      rotatedCtx.drawImage(sourceImage, 0, 0)
      rotatedCtx.setTransform(1, 0, 0, 1, 0, 0)
    } else if (rotation === 270) {
      rotatedWidth = sourceImage.height
      rotatedHeight = sourceImage.width
      rotatedCanvas.width = rotatedWidth
      rotatedCanvas.height = rotatedHeight
      const rotatedCtx = rotatedCanvas.getContext('2d')!
      rotatedCtx.translate(0, rotatedHeight)
      rotatedCtx.rotate(-Math.PI / 2)
      rotatedCtx.drawImage(sourceImage, 0, 0)
      rotatedCtx.setTransform(1, 0, 0, 1, 0, 0)
    } else {
      rotatedWidth = sourceImage.width
      rotatedHeight = sourceImage.height
    }
    
    // Transform crop coordinates from original image space to rotated image space
    // The crop coordinates are in the original (unrotated) image space
    // We need to find where they are in the rotated image
    let cropX = cropRect.x
    let cropY = cropRect.y
    let cropWidth = cropRect.width
    let cropHeight = cropRect.height
    
    if (rotation === 90) {
      // 90° clockwise rotation
      // Original point (x, y) maps to (y, originalWidth - x) in rotated space
      // But we need the crop region in rotated space
      const origX = cropX
      const origY = cropY
      cropX = origY
      cropY = sourceImage.width - origX - cropWidth
      const tempW = cropWidth
      cropWidth = cropHeight
      cropHeight = tempW
    } else if (rotation === 180) {
      // 180° rotation
      cropX = sourceImage.width - cropX - cropWidth
      cropY = sourceImage.height - cropY - cropHeight
    } else if (rotation === 270) {
      // 270° clockwise rotation
      const origX = cropX
      const origY = cropY
      cropX = sourceImage.height - origY - cropHeight
      cropY = origX
      const tempW = cropWidth
      cropWidth = cropHeight
      cropHeight = tempW
    }
    
    // Clamp coordinates to image bounds
    let clampedCropX = Math.max(0, Math.min(cropX, rotatedCanvas.width))
    let clampedCropY = Math.max(0, Math.min(cropY, rotatedCanvas.height))
    let clampedCropWidth = cropWidth
    let clampedCropHeight = cropHeight
    
    // Adjust if crop extends beyond image bounds
    if (clampedCropX + clampedCropWidth > rotatedCanvas.width) {
      clampedCropWidth = rotatedCanvas.width - clampedCropX
    }
    if (clampedCropY + clampedCropHeight > rotatedCanvas.height) {
      clampedCropHeight = rotatedCanvas.height - clampedCropY
    }
    
    // Ensure we have valid dimensions
    if (clampedCropWidth > 0 && clampedCropHeight > 0) {
      // Set canvas size to match clamped dimensions
      croppedCanvas.width = clampedCropWidth
      croppedCanvas.height = clampedCropHeight
      
      // Crop from rotated canvas using transformed coordinates
      ctx.drawImage(
        rotatedCanvas,
        clampedCropX, clampedCropY, clampedCropWidth, clampedCropHeight,
        0, 0, clampedCropWidth, clampedCropHeight
      )
    } else {
      // Invalid dimensions, create empty canvas
      croppedCanvas.width = 1
      croppedCanvas.height = 1
    }
  } else {
    // No rotation, crop directly from source using original coordinates
    // Clamp coordinates to image bounds
    let cropX = Math.max(0, Math.min(cropRect.x, sourceImage.width))
    let cropY = Math.max(0, Math.min(cropRect.y, sourceImage.height))
    let cropWidth = cropRect.width
    let cropHeight = cropRect.height
    
    // Adjust if crop extends beyond image bounds
    if (cropX + cropWidth > sourceImage.width) {
      cropWidth = sourceImage.width - cropX
    }
    if (cropY + cropHeight > sourceImage.height) {
      cropHeight = sourceImage.height - cropY
    }
    
    // Ensure we have valid dimensions
    if (cropWidth > 0 && cropHeight > 0) {
      // Set canvas size to match clamped dimensions
      croppedCanvas.width = cropWidth
      croppedCanvas.height = cropHeight
      
      ctx.drawImage(
        sourceImage,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      )
    } else {
      // Invalid dimensions, create empty canvas
      croppedCanvas.width = 1
      croppedCanvas.height = 1
    }
  }
  
  return croppedCanvas
}

