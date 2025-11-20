import { computed } from 'vue'
import { useEditorStore } from '@/stores/editorStore'

export function useImageEditor() {
  const store = useEditorStore()
  
  const hasImage = computed(() => store.currentImage !== null && store.imageUrl !== null)
  
  async function loadImage(file: File) {
    // Revoke previous URL if exists
    if (store.imageUrl) {
      URL.revokeObjectURL(store.imageUrl)
    }
    
    store.setImage(file)
    
    // Create image element
    if (store.imageUrl) {
      const img = await createImageElement(store.imageUrl)
      store.setImageElement(img)
    }
  }
  
  function createImageElement(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }
  
  function clearImage() {
    store.clearImage()
  }
  
  return {
    imageFile: computed(() => store.currentImage),
    imageUrl: computed(() => store.imageUrl),
    imageElement: computed(() => store.imageElement),
    hasImage,
    loadImage,
    createImageElement,
    clearImage
  }
}

