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

export function fitImageToCanvas(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number
): { width: number; height: number; offsetX: number; offsetY: number } {
  const scale = Math.min(
    canvasWidth / imageWidth,
    canvasHeight / imageHeight
  )
  
  const width = imageWidth * scale
  const height = imageHeight * scale
  const offsetX = (canvasWidth - width) / 2
  const offsetY = (canvasHeight - height) / 2
  
  return { width, height, offsetX, offsetY }
}

