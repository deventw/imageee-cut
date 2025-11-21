import piexif from 'piexifjs'

export type MetadataExportFormat = 'png' | 'jpg'
export type StoredMetadataFormat = 'jpeg' | 'png'

export interface PngMetadataChunk {
  type: string
  data: string // base64 encoded chunk data
}

export interface JpegSegment {
  marker: number
  data: string // base64
}

export interface ImageMetadata {
  format: StoredMetadataFormat
  jpegSegments?: JpegSegment[]
  jpegExif?: string
  pngChunks?: PngMetadataChunk[]
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

const textEncoder = new TextEncoder()

interface PngChunk {
  type: string
  data: Uint8Array
}

export async function extractImageMetadata(file: File): Promise<ImageMetadata | null> {
  const format = detectImageFormat(file)
  if (!format) return null
  
  const buffer = await file.arrayBuffer()
  if (format === 'jpeg') {
    try {
      const segments = extractJpegSegments(buffer)
      console.log('Extracted JPEG segments:', segments.length)
      
      // Find the original EXIF segment (APP1, marker 0xFFE1)
      const exifSegment = segments.find(seg => isExifSegment(seg))
      
      let exifString: string | undefined
      
      // Try to extract EXIF using piexif for display/verification
      // But we'll preserve the original EXIF segment binary data for maximum compatibility
      try {
        const dataUrl = arrayBufferToDataURL(buffer, getMimeType(file, 'image/jpeg'))
        const exifData = piexif.load(dataUrl)
        console.log('Loaded EXIF data sections:', Object.keys(exifData))
        
        // Check each section for data
        const sectionsWithData: string[] = []
        Object.entries(exifData).forEach(([sectionName, section]) => {
          if (section && typeof section === 'object') {
            const keys = Object.keys(section as Record<string, unknown>)
            if (keys.length > 0) {
              sectionsWithData.push(`${sectionName}(${keys.length})`)
              console.log(`EXIF section '${sectionName}' has ${keys.length} keys:`, keys.slice(0, 10))
            }
          }
        })
        
        const hasData = sectionsWithData.length > 0
        
        if (hasData) {
          // Use piexif.dump() as backup, but prefer original segment
          exifString = piexif.dump(exifData)
          console.log('Dumped EXIF string length:', exifString.length, 'sections:', sectionsWithData.join(', '))
          console.log('Original EXIF segment found:', !!exifSegment)
        } else {
          console.log('No EXIF data found in image')
        }
      } catch (exifError) {
        console.warn('Failed to extract EXIF:', exifError)
      }
      
      // If we have the original EXIF segment, use it directly (preserves GPS, TIFF structure, etc.)
      // Otherwise fall back to piexif string
      if (exifSegment) {
        console.log('Using original EXIF segment for maximum compatibility (preserves GPS, TIFF, all IFD sections)')
      } else if (exifString) {
        console.log('Using piexif-dumped EXIF data')
      }
      
      if (!segments.length && !exifString) {
        console.log('No metadata found in JPEG')
        return { format: 'jpeg' }
      }
      
      const result = { 
        format: 'jpeg' as const, 
        jpegSegments: segments.length ? segments : undefined, 
        jpegExif: exifString 
      }
      console.log('Returning JPEG metadata:', {
        hasSegments: !!result.jpegSegments,
        segmentsCount: result.jpegSegments?.length || 0,
        hasExif: !!result.jpegExif,
        hasOriginalExifSegment: !!exifSegment
      })
      return result
    } catch (error) {
      console.error('Error extracting JPEG metadata:', error)
      return { format: 'jpeg' }
    }
  }
  
  if (format === 'png') {
    try {
      const chunks = extractPngMetadataChunks(buffer)
      return { format: 'png', pngChunks: chunks.length ? chunks : undefined }
    } catch {
      return { format: 'png' }
    }
  }
  
  return null
}

export function metadataSupportedForFormat(
  metadata: ImageMetadata | null,
  format: MetadataExportFormat
): boolean {
  if (!metadata) return false
  
  if (format === 'jpg') {
    return metadata.format === 'jpeg' && (
      !!metadata.jpegExif || 
      (!!metadata.jpegSegments && metadata.jpegSegments.length > 0)
    )
  }
  
  if (format === 'png') {
    return metadata.format === 'png' && !!metadata.pngChunks && metadata.pngChunks.length > 0
  }
  
  return false
}

export async function applyMetadataToBlob(
  blob: Blob,
  metadata: ImageMetadata | null,
  format: MetadataExportFormat
): Promise<Blob> {
  console.log('applyMetadataToBlob called:', { 
    hasMetadata: !!metadata, 
    format, 
    blobType: blob.type,
    metadataFormat: metadata?.format,
    hasJpegExif: !!metadata?.jpegExif,
    hasJpegSegments: !!metadata?.jpegSegments?.length,
    hasPngChunks: !!metadata?.pngChunks?.length
  })
  
  if (!metadataSupportedForFormat(metadata, format) || !metadata) {
    console.log('Metadata not supported for format, returning original blob')
    return blob
  }
  
  // Verify blob type matches format - this is a critical check
  // If blob type doesn't match, we can't apply metadata correctly
  if (format === 'jpg') {
    if (!blob.type.includes('jpeg') && !blob.type.includes('jpg')) {
      console.warn(`Format mismatch: expected JPEG but blob type is ${blob.type}. Skipping metadata insertion.`)
      return blob
    }
  } else if (format === 'png') {
    if (!blob.type.includes('png')) {
      console.warn(`Format mismatch: expected PNG but blob type is ${blob.type}. Skipping metadata insertion.`)
      return blob
    }
  }
  
  if (format === 'jpg' && metadata.format === 'jpeg') {
    try {
      const buffer = await blob.arrayBuffer()
      console.log('Processing JPEG, original buffer size:', buffer.byteLength)
      
      // Strategy: Preserve original EXIF segment directly for maximum compatibility
      // This preserves GPS, TIFF structure, and all IFD sections exactly as they were
      // Only use piexif.insert() as fallback if original segment is not available
      
      let processedBuffer = buffer
      const exifSegment = metadata.jpegSegments && metadata.jpegSegments.length > 0
        ? metadata.jpegSegments.find(seg => isExifSegment(seg))
        : undefined
      
      if (exifSegment) {
        // Use original EXIF segment directly - this preserves GPS, TIFF, all IFD sections
        console.log('Using original EXIF segment for maximum compatibility (preserves GPS, TIFF, all IFD sections)')
        
        // Remove any existing EXIF segments from the new JPEG, then insert original
        const view = new DataView(buffer)
        if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) {
          throw new Error('Invalid JPEG signature')
        }
        
        const bytes = new Uint8Array(buffer)
        let offset = 2
        
        // Skip all existing APP segments
        while (offset + 4 <= buffer.byteLength) {
          const marker = view.getUint16(offset)
          if (marker < 0xffe0 || marker > 0xffef) break
          const length = view.getUint16(offset + 2)
          offset += 2 + 2 + Math.max(0, length - 2)
        }
        
        // Reconstruct JPEG with original EXIF segment
        const header = bytes.subarray(0, 2)
        const rest = bytes.subarray(offset)
        
        // Insert original EXIF segment
        const exifData = base64ToUint8(exifSegment.data)
        const exifLength = exifData.length + 2
        const exifSegmentBytes = new Uint8Array(4 + exifData.length)
        const exifView = new DataView(exifSegmentBytes.buffer)
        exifView.setUint16(0, exifSegment.marker) // 0xFFE1
        exifView.setUint16(2, exifLength)
        exifSegmentBytes.set(exifData, 4)
        
        // Insert other non-EXIF segments
        const otherSegments = (metadata.jpegSegments || []).filter(seg => !isExifSegment(seg))
        const segmentBytes = otherSegments.map((segment) => {
          const data = base64ToUint8(segment.data)
          const length = data.length + 2
          const result = new Uint8Array(4 + data.length)
          const segView = new DataView(result.buffer)
          segView.setUint16(0, segment.marker)
          segView.setUint16(2, length)
          result.set(data, 4)
          return result
        })
        
        const totalLength = header.length + exifSegmentBytes.length + 
          segmentBytes.reduce((sum, seg) => sum + seg.length, 0) + rest.length
        const output = new Uint8Array(totalLength)
        let pos = 0
        output.set(header, pos)
        pos += header.length
        output.set(exifSegmentBytes, pos)
        pos += exifSegmentBytes.length
        
        segmentBytes.forEach((seg) => {
          output.set(seg, pos)
          pos += seg.length
        })
        
        output.set(rest, pos)
        processedBuffer = output.buffer
        console.log('Original EXIF segment inserted, buffer size:', processedBuffer.byteLength)
      } else if (metadata.jpegExif) {
        // Fallback: Use piexif.insert() if original segment not available
        console.log('Original EXIF segment not found, using piexif.insert() as fallback')
        try {
          // Verify blob type matches JPEG before proceeding
          if (!blob.type.includes('jpeg') && !blob.type.includes('jpg')) {
            console.warn(`Cannot apply JPEG EXIF to ${blob.type} blob, skipping metadata insertion`)
            return blob
          }
          
          // Convert blob to data URL using FileReader for reliability
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const result = reader.result as string
              // Verify it's a valid JPEG data URL
              if (!result.startsWith('data:image/jpeg') && !result.startsWith('data:image/jpg')) {
                reject(new Error(`Blob is not a JPEG image, got: ${result.substring(0, 30)}`))
                return
              }
              resolve(result)
            }
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          
          const updatedDataUrl = piexif.insert(metadata.jpegExif, dataUrl)
          processedBuffer = await dataURLToArrayBuffer(updatedDataUrl)
          console.log('EXIF inserted via piexif, new buffer size:', processedBuffer.byteLength)
        } catch (exifError) {
          console.error('Failed to insert EXIF data:', exifError)
          throw exifError
        }
      } else {
        console.log('No EXIF data found in metadata')
      }
      
      // Insert other APP segments if not already inserted
      if (metadata.jpegSegments && metadata.jpegSegments.length > 0 && !exifSegment && metadata.jpegExif) {
        // Only insert non-EXIF segments if we didn't already insert all segments above
        const nonExifSegments = metadata.jpegSegments.filter(seg => !isExifSegment(seg))
        
        console.log('Non-EXIF segments to insert:', nonExifSegments.length)
        
        if (nonExifSegments.length > 0) {
          const updatedBuffer = insertJpegSegments(processedBuffer, nonExifSegments)
          const slice = updatedBuffer.buffer.slice(
            updatedBuffer.byteOffset,
            updatedBuffer.byteOffset + updatedBuffer.byteLength
          ) as ArrayBuffer
          console.log('All segments inserted, final size:', slice.byteLength)
          return new Blob([slice], { type: 'image/jpeg' })
        }
      }
      
      const slice = processedBuffer.slice(0, processedBuffer.byteLength) as ArrayBuffer
      console.log('Returning final JPEG blob, size:', slice.byteLength)
      return new Blob([slice], { type: 'image/jpeg' })
    } catch (error) {
      console.error('Failed to apply JPEG metadata:', error)
      return blob
    }
  }
  
  if (format === 'png' && metadata.format === 'png' && metadata.pngChunks) {
    try {
      const buffer = await blob.arrayBuffer()
      const updatedBuffer = insertPngMetadata(buffer, metadata.pngChunks)
      const slice = updatedBuffer.buffer.slice(
        updatedBuffer.byteOffset,
        updatedBuffer.byteOffset + updatedBuffer.byteLength
      ) as ArrayBuffer
      return new Blob([slice], { type: 'image/png' })
    } catch {
      return blob
    }
  }
  
  return blob
}

function detectImageFormat(file: File): StoredMetadataFormat | null {
  const mime = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  
  if (mime.includes('jpeg') || mime.includes('jpg') || name.endsWith('.jpeg') || name.endsWith('.jpg')) {
    return 'jpeg'
  }
  
  if (mime.includes('png') || name.endsWith('.png')) {
    return 'png'
  }
  
  return null
}

function getMimeType(file: File, fallback: string): string {
  return file.type && file.type.length > 0 ? file.type : fallback
}

function extractPngMetadataChunks(buffer: ArrayBuffer): PngMetadataChunk[] {
  const bytes = new DataView(buffer)
  const signature = new Uint8Array(buffer, 0, 8)
  if (!compareUint8Arrays(signature, PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature')
  }
  
  const metadata: PngMetadataChunk[] = []
  let offset = 8
  
  while (offset + 8 <= buffer.byteLength) {
    const length = bytes.getUint32(offset)
    const typeBytes = new Uint8Array(buffer, offset + 4, 4)
    const type = String.fromCharCode(...typeBytes)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd > buffer.byteLength) break
    
    if (isMetadataChunk(type)) {
      const data = new Uint8Array(buffer.slice(dataStart, dataEnd))
      metadata.push({
        type,
        data: uint8ToBase64(data)
      })
    }
    
    offset = dataEnd + 4 // skip CRC
  }
  
  return metadata
}

function insertPngMetadata(
  buffer: ArrayBuffer,
  metadataChunks: PngMetadataChunk[]
): Uint8Array {
  if (!metadataChunks.length) {
    return new Uint8Array(buffer)
  }
  
  const chunks = parsePngChunks(buffer)
  const metadataChunkData = metadataChunks.map<PngChunk>((chunk) => ({
    type: chunk.type,
    data: base64ToUint8(chunk.data)
  }))
  
  const filteredChunks = chunks.filter(chunk => !isMetadataChunk(chunk.type))
  const output: PngChunk[] = []
  let inserted = false
  
  for (const chunk of filteredChunks) {
    output.push(chunk)
    if (!inserted && chunk.type === 'IHDR') {
      metadataChunkData.forEach((metaChunk) => output.push(metaChunk))
      inserted = true
    }
  }
  
  if (!inserted) {
    metadataChunkData.forEach((metaChunk) => output.push(metaChunk))
  }
  
  return buildPngFromChunks(output)
}

function parsePngChunks(buffer: ArrayBuffer): PngChunk[] {
  const bytes = new DataView(buffer)
  const signature = new Uint8Array(buffer, 0, 8)
  if (!compareUint8Arrays(signature, PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature')
  }
  
  const chunks: PngChunk[] = []
  let offset = 8
  
  while (offset + 8 <= buffer.byteLength) {
    const length = bytes.getUint32(offset)
    const typeBytes = new Uint8Array(buffer, offset + 4, 4)
    const type = String.fromCharCode(...typeBytes)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd > buffer.byteLength) break
    
    const data = new Uint8Array(buffer.slice(dataStart, dataEnd))
    chunks.push({ type, data })
    offset = dataEnd + 4 // skip CRC
  }
  
  return chunks
}

function buildPngFromChunks(chunks: PngChunk[]): Uint8Array {
  let totalLength = PNG_SIGNATURE.length
  for (const chunk of chunks) {
    totalLength += 12 + chunk.data.length
  }
  
  const result = new Uint8Array(totalLength)
  result.set(PNG_SIGNATURE, 0)
  const view = new DataView(result.buffer)
  let offset = PNG_SIGNATURE.length
  
  for (const chunk of chunks) {
    view.setUint32(offset, chunk.data.length)
    offset += 4
    
    const typeBytes = textEncoder.encode(chunk.type)
    result.set(typeBytes, offset)
    offset += 4
    
    result.set(chunk.data, offset)
    offset += chunk.data.length
    
    const crc = crc32(concatTypeAndData(chunk.type, chunk.data))
    view.setUint32(offset, crc)
    offset += 4
  }
  
  return result
}

function concatTypeAndData(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = textEncoder.encode(type)
  const combined = new Uint8Array(typeBytes.length + data.length)
  combined.set(typeBytes, 0)
  combined.set(data, typeBytes.length)
  return combined
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] ?? 0
    const tableValue = CRC_TABLE[(crc ^ byte) & 0xff] ?? 0
    crc = tableValue ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function arrayBufferToDataURL(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer)
  const base64 = uint8ToBase64(bytes)
  return `data:${mimeType};base64,${base64}`
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function compareUint8Arrays(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function isMetadataChunk(type: string): boolean {
  if (type.length !== 4) return false
  const firstChar = type.charCodeAt(0)
  // Ancillary chunks have lowercase first letter
  return firstChar >= 97 && firstChar <= 122
}

function extractJpegSegments(buffer: ArrayBuffer): JpegSegment[] {
  const view = new DataView(buffer)
  if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) {
    return []
  }
  
  const segments: JpegSegment[] = []
  let offset = 2
  
  while (offset + 4 <= buffer.byteLength) {
    const marker = view.getUint16(offset)
    offset += 2
    
    if (marker === 0xffda || marker === 0xffd9) {
      break
    }
    
    const length = view.getUint16(offset)
    offset += 2
    if (length < 2 || offset + length - 2 > buffer.byteLength) break
    
    const data = new Uint8Array(buffer.slice(offset, offset + length - 2))
    if (marker >= 0xffe0 && marker <= 0xffef) {
      segments.push({
        marker,
        data: uint8ToBase64(data)
      })
    }
    
    offset += length - 2
  }
  
  return segments
}

function insertJpegSegments(buffer: ArrayBuffer, segments: JpegSegment[]): Uint8Array {
  if (!segments.length) {
    return new Uint8Array(buffer)
  }
  
  const view = new DataView(buffer)
  if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) {
    return new Uint8Array(buffer)
  }
  
  const bytes = new Uint8Array(buffer)
  let offset = 2
  
  while (offset + 4 <= buffer.byteLength) {
    const marker = view.getUint16(offset)
    if (marker < 0xffe0 || marker > 0xffef) break
    const length = view.getUint16(offset + 2)
    offset += 2 + 2 + Math.max(0, length - 2)
  }
  
  const header = bytes.subarray(0, 2)
  const rest = bytes.subarray(offset)
  
  const segmentBytes = segments.map((segment) => {
    const data = base64ToUint8(segment.data)
    const length = data.length + 2
    const result = new Uint8Array(4 + data.length)
    const segView = new DataView(result.buffer)
    segView.setUint16(0, segment.marker)
    segView.setUint16(2, length)
    result.set(data, 4)
    return result
  })
  
  const totalLength = header.length + rest.length + segmentBytes.reduce((sum, seg) => sum + seg.length, 0)
  const output = new Uint8Array(totalLength)
  let pos = 0
  output.set(header, pos)
  pos += header.length
  
  segmentBytes.forEach((seg) => {
    output.set(seg, pos)
    pos += seg.length
  })
  
  output.set(rest, pos)
  return output
}

function isExifSegment(segment: JpegSegment): boolean {
  if (segment.marker !== 0xffe1) return false
  const data = base64ToUint8(segment.data)
  if (data.length < 6) return false
  const header = String.fromCharCode(...data.subarray(0, 6))
  return header === 'Exif\u0000\u0000'
}

async function dataURLToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const blob = dataURLToBlob(dataUrl)
  return blob.arrayBuffer()
}

function dataURLToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  if (parts.length < 2) {
    throw new Error('Invalid data URL')
  }
  const header = parts[0] ?? ''
  const base64 = parts[1] ?? ''
  const mimeMatch = header.match(/data:(.*?);base64/)
  const mime = mimeMatch?.[1] ?? 'application/octet-stream'
  const bytes = base64ToUint8(base64)
  const slice = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  return new Blob([slice], { type: mime })
}

