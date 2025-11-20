import { computed } from 'vue'
import { useEditorStore } from '@/stores/editorStore'
import { tr } from '@/utils/i18n'

export function useI18n() {
  const store = useEditorStore()
  
  const $t = (key: string) => {
    return tr(key, store.locale)
  }
  
  return {
    $t,
    locale: computed(() => store.locale)
  }
}

