<template>
  <div v-if="isOpen" class="export-dialog-overlay" @click.self="close">
    <div class="export-dialog">
      <h2>{{ $t('export_settings') }}</h2>
      
      <div class="dialog-content">
        <div class="control-group">
          <label>{{ $t('export_format') }}</label>
          <select 
            v-model="settings.format" 
            :key="`format-${settings.format}-${store.originalImageFormat || 'none'}`" 
            class="format-select"
          >
            <option value="png">PNG</option>
            <option value="jpg">JPEG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        
        <div class="control-group">
          <label>{{ $t('filename') }}</label>
          <input 
            type="text" 
            v-model="filename"
            :placeholder="$t('filename_placeholder')"
            class="filename-input"
            maxlength="100"
          />
        </div>
        
        <div class="control-group" v-if="settings.format !== 'png'">
          <label>{{ $t('quality') }}: {{ settings.quality }}%</label>
          <input 
            type="range" 
            v-model.number="settings.quality" 
            min="1" 
            max="100"
            class="quality-slider"
          />
        </div>
        
<div class="control-group metadata-group">
  <label class="metadata-label">
    <input 
      type="checkbox" 
      v-model="settings.includeMetadata" 
      :disabled="!metadataOptionEnabled"
    />
    Include metadata (PNG/JPEG only)
  </label>
  <p class="metadata-hint" :class="{ enabled: metadataOptionEnabled }">
    {{ metadataHint }}
  </p>
</div>
        
        <!-- Metadata Display -->
        <div class="control-group metadata-display-group" v-if="store.imageMetadata && store.imageMetadata.format === 'jpeg' && store.imageMetadata.jpegExif">
          <div class="metadata-header" @click="showMetadataDetails = !showMetadataDetails">
            <label class="metadata-display-label">
              <span class="metadata-icon">{{ showMetadataDetails ? '▼' : '▶' }}</span>
              Image Metadata
              <span class="metadata-count">({{ formattedMetadata.length }} fields)</span>
            </label>
          </div>
          <div v-if="showMetadataDetails" class="metadata-details">
            <div class="metadata-item" v-for="(item, index) in formattedMetadata" :key="index">
              <span class="metadata-key">{{ item.key }}:</span>
              <span class="metadata-value">{{ item.value }}</span>
            </div>
          </div>
        </div>
        
        <div class="control-group">
          <button 
            @click="generateExportItems" 
            :disabled="generatingPreviews || !imageElement"
            class="btn-generate"
          >
            {{ generatingPreviews ? $t('generating_previews') : $t('generate_previews') }}
          </button>
        </div>
      </div>
      
      <!-- Export list -->
      <div class="export-list-section">
        <h3 class="export-list-title">
          {{ $t('export_images') }}
          <span v-if="exportItems.length > 0" class="export-count">({{ exportItems.length }})</span>
        </h3>
        <div class="export-list" v-if="exportItems.length > 0">
          <div 
            v-for="(item, index) in exportItems" 
            :key="index"
            class="export-item"
          >
            <div class="export-item-preview">
              <div class="export-item-number">{{ index === 0 ? $t('main_crop') : `${index + 1}` }}</div>
              <img :src="item.preview" :alt="item.filename" />
            </div>
            <div class="export-item-info">
              <p class="export-item-label">{{ index === 0 ? $t('main_crop') : `${$t('crop')} ${index + 1}` }}</p>
              <p class="export-item-filename">{{ item.filename }}.{{ settings.format }}</p>
              <p class="export-item-size">{{ item.size }} px</p>
            </div>
            <button 
              @click="downloadItem(item)"
              :disabled="item.downloading"
              class="btn-download-item"
            >
              {{ item.downloading ? $t('downloading') : $t('download') }}
            </button>
          </div>
        </div>
        <div v-else-if="generatingPreviews" class="export-list-loading">
          <p>{{ $t('generating_previews') }}...</p>
        </div>
        <div v-else-if="!imageElement" class="export-list-empty">
          <p>{{ $t('no_image_loaded') }}</p>
        </div>
        <div v-else class="export-list-empty">
          <p>{{ $t('no_images_to_export') }}</p>
          <p class="hint-text">{{ $t('select_crop_area_first') }}</p>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button @click="close" class="btn-cancel">{{ $t('close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CropRect } from '@/composables/useCrop'
import { useCrop } from '@/composables/useCrop'
import { useExport, type ExportSettings } from '@/composables/useExport'
import { useI18n } from '@/composables/useI18n'
import { useImageEditor } from '@/composables/useImageEditor'
import { useRotation } from '@/composables/useRotation'
import { ref, watch, computed, nextTick } from 'vue'
import { useEditorStore } from '@/stores/editorStore'
import piexif from 'piexifjs'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { imageElement } = useImageEditor()
const store = useEditorStore()
const { cropRect, shadowCrops } = useCrop()
const { rotation } = useRotation()
const { generatePreview, exportSingleImage } = useExport()
const { $t } = useI18n()

// Initialize settings with format based on current image (if available)
function getInitialFormat(): 'png' | 'jpg' | 'webp' {
  if (store.originalImageFormat) {
    return store.originalImageFormat
  }
  if (store.imageMetadata?.format === 'jpeg') {
    return 'jpg'
  }
  if (store.imageMetadata?.format === 'png') {
    return 'png'
  }
  return 'png'
}

const settings = ref<ExportSettings>({
  format: getInitialFormat(),
  quality: 90,
  includeMetadata: false
})

const filename = ref('imageee-cut-export')
const showMetadataDetails = ref(false)
const formattedMetadata = ref<Array<{ key: string; value: string }>>([])

// Helper function to format EXIF data
function formatExifData(exifData: piexif.ExifDict): Array<{ key: string; value: string }> {
  const formatted: Array<{ key: string; value: string }> = []
  
  // 0th IFD tags
  const ifd0Tags: Record<number, string> = {
    256: 'ImageWidth',
    257: 'ImageHeight',
    258: 'BitsPerSample',
    259: 'Compression',
    262: 'PhotometricInterpretation',
    271: 'Make',
    272: 'Model',
    274: 'Orientation',
    277: 'SamplesPerPixel',
    282: 'XResolution',
    283: 'YResolution',
    284: 'PlanarConfiguration',
    296: 'ResolutionUnit',
    301: 'TransferFunction',
    305: 'Software',
    306: 'DateTime',
    315: 'Artist',
    316: 'HostComputer',
    531: 'YCbCrPositioning',
    532: 'ReferenceBlackWhite',
    33432: 'Copyright',
  }
  
  // EXIF IFD tags  
  const exifTags: Record<number, string> = {
    33434: 'ExposureTime',
    33437: 'FNumber',
    34850: 'ExposureProgram',
    34852: 'SpectralSensitivity',
    34855: 'ISOSpeedRatings',
    34856: 'OECF',
    34864: 'SensitivityType',
    34865: 'StandardOutputSensitivity',
    34866: 'RecommendedExposureIndex',
    34867: 'ISOSpeed',
    34868: 'ISOSpeedLatitudeYYY',
    34869: 'ISOSpeedLatitudeZZZ',
    36864: 'ExifVersion',
    36867: 'DateTimeOriginal',
    36868: 'DateTimeDigitized',
    37121: 'ComponentsConfiguration',
    37122: 'CompressedBitsPerPixel',
    37377: 'ShutterSpeedValue',
    37378: 'ApertureValue',
    37379: 'BrightnessValue',
    37380: 'ExposureBiasValue',
    37381: 'MaxApertureValue',
    37382: 'SubjectDistance',
    37383: 'MeteringMode',
    37384: 'LightSource',
    37385: 'Flash',
    37386: 'FocalLength',
    37396: 'SubjectArea',
    37500: 'MakerNote',
    37510: 'UserComment',
    37520: 'SubSecTime',
    37521: 'SubSecTimeOriginal',
    37522: 'SubSecTimeDigitized',
    40960: 'FlashPixVersion',
    40961: 'ColorSpace',
    40962: 'PixelXDimension',
    40963: 'PixelYDimension',
    40964: 'RelatedSoundFile',
    40965: 'InteroperabilityIFD',
    41483: 'FlashEnergy',
    41484: 'SpatialFrequencyResponse',
    41486: 'FocalPlaneXResolution',
    41487: 'FocalPlaneYResolution',
    41488: 'FocalPlaneResolutionUnit',
    41492: 'SubjectLocation',
    41493: 'ExposureIndex',
    41495: 'SensingMethod',
    41728: 'FileSource',
    41729: 'SceneType',
    41730: 'CFAPattern',
    41985: 'CustomRendered',
    41986: 'ExposureMode',
    41987: 'WhiteBalance',
    41988: 'DigitalZoomRatio',
    41989: 'FocalLengthIn35mmFilm',
    41990: 'SceneCaptureType',
    41991: 'GainControl',
    41992: 'Contrast',
    41993: 'Saturation',
    41994: 'Sharpness',
    41995: 'DeviceSettingDescription',
    41996: 'SubjectDistanceRange',
    42016: 'ImageUniqueID',
  }
  
  // GPS tags
  const gpsTags: Record<number, string> = {
    0: 'GPSVersionID',
    1: 'GPSLatitudeRef',
    2: 'GPSLatitude',
    3: 'GPSLongitudeRef',
    4: 'GPSLongitude',
    5: 'GPSAltitudeRef',
    6: 'GPSAltitude',
    7: 'GPSTimeStamp',
    8: 'GPSSatellites',
    9: 'GPSStatus',
    10: 'GPSMeasureMode',
    11: 'GPSDOP',
    12: 'GPSSpeedRef',
    13: 'GPSSpeed',
    14: 'GPSTrackRef',
    15: 'GPSTrack',
    16: 'GPSImgDirectionRef',
    17: 'GPSImgDirection',
    18: 'GPSMapDatum',
    19: 'GPSDestLatitudeRef',
    20: 'GPSDestLatitude',
    21: 'GPSDestLongitudeRef',
    22: 'GPSDestLongitude',
    23: 'GPSDestBearingRef',
    24: 'GPSDestBearing',
    25: 'GPSDestDistanceRef',
    26: 'GPSDestDistance',
    27: 'GPSProcessingMethod',
    28: 'GPSAreaInformation',
    29: 'GPSDateStamp',
    30: 'GPSDifferential',
    31: 'GPSHPositioningError',
  }
  
  function formatValue(tag: number, value: unknown, section: string): string {
    if (value === null || value === undefined) return ''
    
    // Handle arrays
    if (Array.isArray(value)) {
      if (section === 'GPS' && tag === 2) {
        // GPS Latitude: [degrees, minutes, seconds]
        const [deg, min, sec] = value
        return `${deg[0]}/${deg[1]}° ${min[0]}/${min[1]}' ${sec[0]}/${sec[1]}"`
      }
      if (section === 'GPS' && tag === 4) {
        // GPS Longitude
        const [deg, min, sec] = value
        return `${deg[0]}/${deg[1]}° ${min[0]}/${min[1]}' ${sec[0]}/${sec[1]}"`
      }
      return value.map(v => String(v)).join(', ')
    }
    
    // Handle fractions (arrays with 2 elements)
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      if (value[1] === 0) return String(value[0])
      if (value[1] === 1) return String(value[0])
      return `${value[0]}/${value[1]}`
    }
    
    // Special formatting for common tags
    if (section === '0th' && tag === 306) {
      // DateTime
      return String(value)
    }
    if (section === 'Exif' && tag === 33434) {
      // ExposureTime
      if (Array.isArray(value) && value.length === 2) {
        const num = value[0] / value[1]
        if (num < 1) return `1/${Math.round(1/num)}`
        return String(num)
      }
    }
    if (section === 'Exif' && tag === 33437) {
      // FNumber
      if (Array.isArray(value) && value.length === 2) {
        return `f/${(value[0] / value[1]).toFixed(1)}`
      }
    }
    if (section === 'Exif' && tag === 37378) {
      // ApertureValue
      if (Array.isArray(value) && value.length === 2) {
        const av = value[0] / value[1]
        const fNumber = Math.pow(2, av / 2)
        return `f/${fNumber.toFixed(1)}`
      }
    }
    if (section === 'Exif' && tag === 37386) {
      // FocalLength
      if (Array.isArray(value) && value.length === 2) {
        return `${(value[0] / value[1]).toFixed(0)} mm`
      }
    }
    if (section === 'Exif' && tag === 34855) {
      // ISOSpeedRatings
      if (Array.isArray(value)) {
        return `ISO ${value.map(v => String(v)).join(', ')}`
      }
    }
    if (section === 'Exif' && tag === 34867) {
      // ISOSpeed
      if (typeof value === 'number') {
        return `ISO ${value}`
      }
      if (Array.isArray(value) && value.length === 2) {
        return `ISO ${value[0] / value[1]}`
      }
    }
    if (section === 'Exif' && tag === 37385) {
      // Flash
      const flash = Number(value)
      if (flash === 0) return 'No'
      if (flash === 1) return 'Yes'
      return `Flash (${flash})`
    }
    if (section === 'Exif' && tag === 41987) {
      // WhiteBalance
      const wb = Number(value)
      if (wb === 0) return 'Auto'
      if (wb === 1) return 'Manual'
      return String(value)
    }
    
    return String(value)
  }
  
  function getTagName(tag: number, section: string): string {
    if (section === '0th') return ifd0Tags[tag] || `Tag ${tag}`
    if (section === 'Exif') return exifTags[tag] || `Tag ${tag}`
    if (section === 'GPS') return gpsTags[tag] || `GPS Tag ${tag}`
    return `${section} Tag ${tag}`
  }
  
  // Process each section
  Object.entries(exifData).forEach(([sectionName, section]) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return
    
    Object.entries(section as Record<string, unknown>).forEach(([tagStr, value]) => {
      const tag = Number(tagStr)
      if (isNaN(tag)) return
      
      const tagName = getTagName(tag, sectionName)
      const formattedValue = formatValue(tag, value, sectionName)
      
      if (formattedValue) {
        formatted.push({ key: tagName, value: formattedValue })
      }
    })
  })
  
  return formatted.sort((a, b) => a.key.localeCompare(b.key))
}

// Parse EXIF metadata from current image file
async function parseMetadata(): Promise<Array<{ key: string; value: string }>> {
  if (!store.currentImage || !store.imageMetadata || store.imageMetadata.format !== 'jpeg') {
    return []
  }
  
  try {
    // Use FileReader to convert file to data URL efficiently
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(store.currentImage!)
    })
    
    const exifData = piexif.load(dataUrl)
    return formatExifData(exifData)
  } catch (error) {
    console.error('Failed to parse metadata:', error)
    return []
  }
}

// Watch for image metadata changes and parse
watch(() => [store.imageMetadata, store.currentImage], async () => {
  if (store.imageMetadata && store.imageMetadata.format === 'jpeg' && store.currentImage) {
    formattedMetadata.value = await parseMetadata()
  } else {
    formattedMetadata.value = []
  }
}, { immediate: true })

const metadataOptionEnabled = computed(() => {
  if (settings.value.format === 'webp') return false
  if (!store.imageMetadata) return false
  if (settings.value.format === 'jpg') {
    return store.imageMetadata.format === 'jpeg' && (
      !!store.imageMetadata.jpegExif ||
      (!!store.imageMetadata.jpegSegments && store.imageMetadata.jpegSegments.length > 0)
    )
  }
  if (settings.value.format === 'png') {
    return store.imageMetadata.format === 'png' &&
      !!store.imageMetadata.pngChunks &&
      store.imageMetadata.pngChunks.length > 0
  }
  return false
})

const metadataHint = computed(() => {
  if (settings.value.format === 'webp') {
    return 'Metadata is only available when exporting PNG or JPEG files.'
  }
  
  if (!store.imageMetadata) {
    return 'Load a PNG or JPEG that already has metadata to enable this option.'
  }
  
  if (settings.value.format === 'jpg') {
    if (store.imageMetadata.format !== 'jpeg') {
      return 'Metadata can only be kept when exporting as JPEG from an original JPEG.'
    }
    if (!store.imageMetadata.jpegExif && 
        (!store.imageMetadata.jpegSegments || store.imageMetadata.jpegSegments.length === 0)) {
      return 'This JPEG does not contain metadata to keep.'
    }
  }
  
  if (settings.value.format === 'png') {
    if (store.imageMetadata.format !== 'png') {
      return 'Metadata can only be kept when exporting as PNG from an original PNG.'
    }
    if (!store.imageMetadata.pngChunks || store.imageMetadata.pngChunks.length === 0) {
      return 'This PNG does not contain metadata to keep.'
    }
  }
  
  return 'Keeps the metadata from the original PNG/JPEG image.'
})

interface ExportItem {
  preview: string
  filename: string
  size: string
  cropRect: CropRect | null
  downloading: boolean
}

const exportItems = ref<ExportItem[]>([])
const generatingPreviews = ref(false)

function close() {
  emit('close')
}

async function generateExportItems() {
  if (!imageElement.value) {
    exportItems.value = []
    return
  }
  
  generatingPreviews.value = true
  exportItems.value = []
  
  try {
    // Debug logging
    console.log('Generating export items...', {
      hasImage: !!imageElement.value,
      cropRect: cropRect.value,
      shadowCrops: shadowCrops.value,
      imageSize: imageElement.value ? `${imageElement.value.width}x${imageElement.value.height}` : 'N/A'
    })
    
    // Check for valid crop selection
    const validCropRect = cropRect.value && 
                         typeof cropRect.value.width === 'number' &&
                         typeof cropRect.value.height === 'number' &&
                         cropRect.value.width > 0 && 
                         cropRect.value.height > 0 ? cropRect.value : null
    const validShadowCrops = shadowCrops.value.filter(c => 
      c && 
      typeof c.width === 'number' &&
      typeof c.height === 'number' &&
      c.width > 0 && 
      c.height > 0
    )
    
    console.log('Valid crops:', { validCropRect, validShadowCrops })
    
    // Always show at least the full image or the selected crop
    const items: ExportItem[] = []
    
    // Check if we have a valid crop selection
    const hasValidCropSelection = validCropRect && 
                                 validCropRect.width > 0 && 
                                 validCropRect.height > 0 &&
                                 imageElement.value &&
                                 validCropRect.width <= imageElement.value.width * 1.1 && // Allow small overflow
                                 validCropRect.height <= imageElement.value.height * 1.1
    
    console.log('Has valid crop selection:', hasValidCropSelection)
    
    if (hasValidCropSelection) {
      // Show main crop + shadow crops
      const allCrops = [validCropRect, ...validShadowCrops]
      
      for (let i = 0; i < allCrops.length; i++) {
        const rect = allCrops[i]
        if (!rect || rect.width <= 0 || rect.height <= 0) continue
        
        try {
          const preview = await generatePreview(imageElement.value, rect, rotation.value)
          const suffix = i === 0 ? '' : `_${i + 1}`
          const itemFilename = `${filename.value.trim() || 'imageee-cut-export'}${suffix}`
          
          items.push({
            preview,
            filename: itemFilename,
            size: `${Math.round(rect.width)} × ${Math.round(rect.height)}`,
            cropRect: rect,
            downloading: false
          })
        } catch (error) {
          console.error('Failed to generate preview for crop', i, error)
        }
      }
    }
    
    // Always show full image as fallback if no crops or if crops failed
    if (items.length === 0) {
      try {
        const preview = await generatePreview(imageElement.value, null, rotation.value)
        const rotatedWidth = rotation.value === 90 || rotation.value === 270 
          ? imageElement.value.height 
          : imageElement.value.width
        const rotatedHeight = rotation.value === 90 || rotation.value === 270 
          ? imageElement.value.width 
          : imageElement.value.height
        
        items.push({
          preview,
          filename: filename.value.trim() || 'imageee-cut-export',
          size: `${rotatedWidth} × ${rotatedHeight}`,
          cropRect: null,
          downloading: false
        })
      } catch (error) {
        console.error('Failed to generate preview for full image', error)
      }
    }
    
    exportItems.value = items
  } catch (error) {
    console.error('Error generating export items:', error)
    exportItems.value = []
  } finally {
    generatingPreviews.value = false
  }
}

async function downloadItem(item: ExportItem) {
  if (!imageElement.value || item.downloading) return
  
  item.downloading = true
  
  try {
    await exportSingleImage(
      imageElement.value,
      item.cropRect,
      rotation.value,
      settings.value,
      item.filename
    )
  } finally {
    item.downloading = false
  }
}

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // Default format based on loaded image format for better UX
    // Use stored original format (set immediately on import) as primary source
    // Fallback to metadata format, then file detection
    let defaultFormat: 'png' | 'jpg' | 'webp' = 'png'
    
    // First priority: use stored original format (always available, set on import)
    if (store.originalImageFormat) {
      defaultFormat = store.originalImageFormat
    } 
    // Second priority: use metadata format
    else if (store.imageMetadata?.format === 'jpeg') {
      defaultFormat = 'jpg'
    } else if (store.imageMetadata?.format === 'png') {
      defaultFormat = 'png'
    }
    // Third priority: detect from file (fallback)
    else if (store.currentImage) {
      const fileName = store.currentImage.name.toLowerCase()
      const mimeType = (store.currentImage.type || '').toLowerCase()
      
      if (mimeType.includes('jpeg') || mimeType.includes('jpg') || 
          fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
        defaultFormat = 'jpg'
      } else if (mimeType.includes('png') || fileName.endsWith('.png')) {
        defaultFormat = 'png'
      } else if (mimeType.includes('webp') || fileName.endsWith('.webp')) {
        defaultFormat = 'webp'
      }
    }
    
    console.log('Export format detection:', {
      defaultFormat,
      originalFormat: store.originalImageFormat,
      metadataFormat: store.imageMetadata?.format,
      fileName: store.currentImage?.name,
      mimeType: store.currentImage?.type,
      currentSettingsFormat: settings.value.format
    })
    
    // Update settings reactively - completely replace the object to ensure Vue detects the change
    settings.value = {
      format: defaultFormat,
      quality: 90,
      includeMetadata: false
    }
    
    filename.value = 'imageee-cut-export'
    
    // Force Vue to detect the change
    await nextTick()
    console.log('Settings after update:', {
      format: settings.value.format,
      expectedFormat: defaultFormat,
      match: settings.value.format === defaultFormat,
      selectValue: (document.querySelector('.format-select') as HTMLSelectElement)?.value
    })
    
    // Double-check: if format doesn't match, force update again
    if (settings.value.format !== defaultFormat) {
      console.warn('Format mismatch detected, forcing update...')
      settings.value = {
        ...settings.value,
        format: defaultFormat
      }
      await nextTick()
    }
    
    // Triple-check: verify the select element has the correct value
    await nextTick()
    const selectElement = document.querySelector('.format-select') as HTMLSelectElement
    if (selectElement && selectElement.value !== defaultFormat) {
      console.warn('Select element value mismatch, forcing DOM update...')
      selectElement.value = defaultFormat
      // Trigger change event to ensure Vue knows
      selectElement.dispatchEvent(new Event('change', { bubbles: true }))
    }
    
    // Wait a bit to ensure imageElement is ready
    await new Promise(resolve => setTimeout(resolve, 100))
    await generateExportItems()
  } else {
    // Clear items when dialog closes
    exportItems.value = []
  }
})

// Watch for changes in crop selection
watch([() => cropRect.value, () => shadowCrops.value], async () => {
  if (props.isOpen && imageElement.value) {
    await generateExportItems()
  }
}, { deep: true, immediate: false })

// Watch for changes in filename, settings, rotation, or imageElement
watch([filename, () => settings.value.format, () => settings.value.quality, rotation, () => imageElement.value], async () => {
  if (props.isOpen && imageElement.value) {
    await generateExportItems()
  }
}, { deep: true })

watch(() => settings.value.format, () => {
  if (!metadataOptionEnabled.value) {
    settings.value.includeMetadata = false
  }
})

watch(() => store.imageMetadata, () => {
  if (!metadataOptionEnabled.value) {
    settings.value.includeMetadata = false
  }
  
  // Update format when metadata becomes available (if dialog is open)
  if (props.isOpen && store.imageMetadata?.format) {
    if (store.imageMetadata.format === 'jpeg' && settings.value.format !== 'jpg') {
      settings.value.format = 'jpg'
      console.log('Updated export format to jpg based on metadata')
    } else if (store.imageMetadata.format === 'png' && settings.value.format !== 'png') {
      settings.value.format = 'png'
      console.log('Updated export format to png based on metadata')
    }
  }
}, { immediate: false })
</script>

<style scoped>
.export-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.export-dialog {
  background: #faf8f4;
  border-radius: 8px;
  padding: 1.5rem;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #d4c4b0;
}

h2 {
  margin: 0 0 1.5rem 0;
}

.dialog-content {
  margin-bottom: 1.5rem;
  flex-shrink: 0;
}

.control-group {
  margin-bottom: 1rem;
}

.control-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.metadata-group {
  margin-top: 1rem;
}

.metadata-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.metadata-hint {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: #9c8a7a;
}

.metadata-hint.enabled {
  color: #3c3c3c;
}

.metadata-display-group {
  margin-top: 1rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  overflow: hidden;
}

.metadata-header {
  padding: 0.75rem 1rem;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.metadata-header:hover {
  background: #f0ebe3;
}

.metadata-display-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #3c3c3c;
  margin: 0;
}

.metadata-icon {
  font-size: 0.75rem;
  color: #a67c52;
  transition: transform 0.2s;
}

.metadata-count {
  font-size: 0.85rem;
  font-weight: normal;
  color: #9c8a7a;
  margin-left: auto;
}

.metadata-details {
  max-height: 300px;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  border-top: 1px solid #e8dfd4;
  background: #fff;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0ebe3;
  font-size: 0.9rem;
}

.metadata-item:last-child {
  border-bottom: none;
}

.metadata-key {
  font-weight: 500;
  color: #6b5d4f;
  flex: 0 0 40%;
  padding-right: 1rem;
}

.metadata-value {
  color: #3c3c3c;
  flex: 1;
  text-align: right;
  word-break: break-word;
}

.format-select {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  font-size: 1rem;
  min-height: 44px;
  cursor: pointer;
  touch-action: manipulation;
  color: #3c3c3c;
}

.format-select:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}

.filename-input {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  background: #faf8f4;
  font-size: 1rem;
  min-height: 44px;
  touch-action: manipulation;
  color: #3c3c3c;
}

.filename-input:focus {
  outline: 2px solid #a67c52;
  outline-offset: 2px;
  border-color: #a67c52;
}

.export-info {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f0ebe3;
  border-radius: 6px;
  border: 1px solid #d4c4b0;
}

.info-text {
  margin: 0;
  font-size: 0.9rem;
  color: #3c3c3c;
  text-align: center;
}

.quality-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #d4c4b0;
  border-radius: 3px;
  outline: none;
}

.quality-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #a67c52;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #faf8f4;
}

.quality-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #a67c52;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #faf8f4;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-cancel, .btn-export {
  padding: 0.875rem 1.5rem;
  border: 1px solid #d4c4b0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  min-height: 44px;
  touch-action: manipulation;
  flex: 1;
}

.btn-cancel {
  background: #f0ebe3;
  color: #3c3c3c;
}

.btn-cancel:active {
  background: #e8dfd4;
}

.btn-export {
  background: #7a9a68;
  color: #faf8f4;
  border-color: #6b8e5a;
}

.btn-export:active:not(:disabled) {
  background: #6b8e5a;
  border-color: #5a7a4a;
}

.btn-export:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-progress-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e8dfd4;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.progress-status {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: #3c3c3c;
}

.progress-count {
  margin: 0;
  font-size: 0.9rem;
  color: #6b5d4f;
}

.progress-bar {
  height: 8px;
  background: #e8dfd4;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: #7a9a68;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-percentage {
  margin: 0;
  text-align: center;
  font-size: 0.85rem;
  color: #6b5d4f;
  font-weight: 500;
}

.export-list-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-bottom: 1.5rem;
}

.export-list-title {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #3c3c3c;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.export-count {
  font-size: 0.9rem;
  font-weight: 400;
  color: #6b5d4f;
}

.export-list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  max-height: 400px;
  border: 1px solid #e8dfd4;
  border-radius: 6px;
  background: #fff;
  padding: 0.5rem;
}

.export-list-empty,
.export-list-loading {
  padding: 2rem;
  text-align: center;
  color: #6b5d4f;
  font-style: italic;
}

.export-list-loading {
  color: #3c3c3c;
}

.export-list-empty .hint-text {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #9c8a7a;
}

.export-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid #e8dfd4;
  transition: background 0.2s;
  position: relative;
}

.export-item:last-child {
  border-bottom: none;
}

.export-item:hover {
  background: #faf8f4;
}

.export-item-number {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  background: rgba(166, 124, 82, 0.95);
  color: #faf8f4;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  z-index: 2;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.export-item-label {
  margin: 0 0 0.25rem 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #a67c52;
}

.export-item-preview {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border: 1px solid #d4c4b0;
  border-radius: 4px;
  overflow: hidden;
  background: #f0ebe3;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.export-item-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.export-item-info {
  flex: 1;
  min-width: 0;
}

.export-item-filename {
  margin: 0 0 0.25rem 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: #3c3c3c;
  word-break: break-all;
}

.export-item-size {
  margin: 0;
  font-size: 0.85rem;
  color: #6b5d4f;
}

.btn-download-item {
  flex-shrink: 0;
  padding: 0.625rem 1rem;
  border: 1px solid #7a9a68;
  border-radius: 6px;
  background: #7a9a68;
  color: #faf8f4;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  min-height: 44px;
  transition: all 0.2s;
  touch-action: manipulation;
  white-space: nowrap;
}

.btn-download-item:active:not(:disabled) {
  background: #6b8e5a;
  border-color: #5a7a4a;
}

.btn-download-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-generate {
  width: 100%;
  padding: 0.875rem 1.5rem;
  border: 1px solid #a67c52;
  border-radius: 6px;
  background: #a67c52;
  color: #faf8f4;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  min-height: 44px;
  transition: all 0.2s;
  touch-action: manipulation;
}

.btn-generate:active:not(:disabled) {
  background: #8b6f47;
  border-color: #6b5638;
}

.btn-generate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  flex-shrink: 0;
  margin-top: auto;
}
</style>

