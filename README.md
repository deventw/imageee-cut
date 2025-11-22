# imageee-cut

<p align="center">
  <b>English</b> | <a href="./README.zh-HK.md">中文</a>
</p>

A web-based image cropping tool optimized for creating **full-screen posts** for social media. Built with Vue 3, TypeScript, and Vite.

## Features

- 🖼️ **Image Upload**: Import images via file picker
- ✂️ **Crop Selection**: Drag to select crop area with visual overlay
- 📐 **Aspect Ratio Control**: Lock aspect ratio with preset ratios (1:1, 16:9, 9:16, etc.) or custom ratios
- 🎯 **Fine-tune Controls**: Precise adjustment with numeric inputs and arrow keys
- 📦 **Multiple Crop Zones**: Create multiple crop areas (shadow cropping) for batch processing
- 💾 **Export Options**: Export in PNG, JPEG, or WebP format with quality settings
- 📸 **Metadata Support**: Preserve EXIF metadata when exporting PNG/JPEG files
- 🌐 **Multi-language Support**: English, Simplified Chinese, and Traditional Chinese
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 🎨 **Elegant UI**: Compact and minimalist design

## Perfect for Social Media

Optimized for creating full-screen posts with multiple aspect ratio options:

**9:16** - Standard full-screen format for:
- Instagram Stories & Reels
- TikTok
- YouTube Shorts
- Facebook Stories
- Snapchat

**9:15** - Alternative vertical format (slightly wider), ideal for:
- 小紅書 (Xiaohongshu) - Best aspect ratio for full-screen posts
- Instagram posts that need more width
- Content that benefits from a less extreme vertical ratio
- Better fit for certain mobile displays

**4:5** - Instagram Feed optimal format (better engagement than 1:1)

**1:1** - Universal square format for Instagram and Facebook

## Installation

```bash
# Install dependencies
npm install
# or
bun install
```

## Development

```bash
# Start development server
npm run dev
# or
bun run dev
```

## Build

```bash
# Build for production
npm run build
# or
bun run build
```

## Preview

```bash
# Preview production build
npm run preview
# or
bun run preview
```

## Usage

1. Click "Import Image" to upload an image
2. Drag on the image to create a crop selection
3. Adjust the crop area using:
   - Drag handles on corners/edges to resize
   - Drag inside the crop area to move it
   - Use fine-tune controls for precise adjustments
4. Set aspect ratio if needed (lock aspect ratio checkbox)
5. Click "Export Image" to save the cropped image
6. Configure export settings (format, quality, filename, metadata)

## Tech Stack

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Next generation frontend tooling
- **Pinia** - State management
- **Canvas API** - Image manipulation
- **vue-i18n** - Internationalization
- **piexifjs** - EXIF metadata handling

## Author

Created by [deventw](https://github.com/deventw/imageee-cut)

## License

This project is open source and available under the MIT License.
