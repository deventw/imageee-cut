import { computed } from 'vue'
import { useEditorStore } from '@/stores/editorStore'

export function useRotation() {
  const store = useEditorStore()
  
  const rotation = computed(() => store.rotation)
  
  function rotateLeft() {
    const newRotation = (store.rotation - 90 + 360) % 360
    store.setRotation(newRotation)
  }
  
  function rotateRight() {
    const newRotation = (store.rotation + 90) % 360
    store.setRotation(newRotation)
  }
  
  function rotate180() {
    const newRotation = (store.rotation + 180) % 360
    store.setRotation(newRotation)
  }
  
  function resetRotation() {
    store.setRotation(0)
  }
  
  function setRotation(degrees: number) {
    store.setRotation(degrees % 360)
  }
  
  return {
    rotation,
    rotateLeft,
    rotateRight,
    rotate180,
    resetRotation,
    setRotation
  }
}

