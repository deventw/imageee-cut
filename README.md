# imageee-cut

<p align="center">
  <b>English</b> | <a href="./README.zh-HK.md">中文</a>
</p>

A web-based image cropping and editing tool built with Vue 3, TypeScript, and Vite.

## Features

- 🖼️ **Image Upload**: Import images via file picker
- ✂️ **Crop Selection**: Drag to select crop area with visual overlay
- 📐 **Aspect Ratio Control**: Lock aspect ratio with preset ratios (1:1, 16:9, 9:16, etc.) or custom ratios
- 🎯 **Fine-tune Controls**: Precise adjustment with numeric inputs and arrow keys
- 📦 **Multiple Crop Zones**: Create multiple crop areas (shadow cropping) for batch processing
- 💾 **Export Options**: Export in PNG, JPEG, or WebP format with quality settings
- 🌐 **Multi-language Support**: English, Traditional Chinese, and more
- 📱 **Responsive Design**: Works on desktop and mobile devices

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
6. Configure export settings (format, quality, filename)

## Tech Stack

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Next generation frontend tooling
- **Pinia** - State management
- **Canvas API** - Image manipulation
- **vue-i18n** - Internationalization

## Author

Created by [deventw](https://github.com/deventw/imageee-cut)

## License

This project is open source and available under the MIT License.
