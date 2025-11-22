# imageee-cut

<p align="center">
  <a href="./README.md">English</a> | <b>中文</b>
</p>

基於 Vue 3、TypeScript 同 Vite 構建嘅網頁版圖片裁剪工具，專為製作**全屏貼文**而優化。

## 功能特色

- 🖼️ **圖片上傳**：透過檔案選擇器匯入圖片
- ✂️ **裁剪選擇**：拖曳選取裁剪區域，並顯示視覺化覆蓋層
- 📐 **長寬比控制**：鎖定長寬比，支援預設比例（1:1、16:9、9:16 等）或自訂比例
- 🎯 **微調控制**：使用數值輸入同方向鍵進行精確調整
- 📦 **多重裁剪區域**：建立多個裁剪區域（陰影裁剪）以進行批次處理
- 💾 **匯出選項**：以 PNG、JPEG 或 WebP 格式匯出，並可調整品質設定
- 📸 **元數據支援**：匯出 PNG/JPEG 時保留 EXIF 元數據
- 🌐 **多語言支援**：支援英文、簡體中文同繁體中文
- 📱 **響應式設計**：適用於桌面同流動裝置
- 🎨 **優雅介面**：緊湊簡約設計

## 專為社交媒體優化

專為製作全屏貼文而設計，提供多種長寬比選項：

**9:16** - 標準全屏格式，適用於：
- Instagram Stories 同 Reels
- TikTok
- YouTube Shorts
- Facebook Stories
- Snapchat

**9:15** - 替代垂直格式（稍寬），適合：
- 小紅書 - 全屏貼文最佳長寬比
- 需要更多寬度嘅 Instagram 貼文
- 適合較不極端垂直比例嘅內容
- 更適合某些流動裝置顯示

**4:5** - Instagram Feed 最佳格式（比 1:1 有更好嘅互動率）

**1:1** - 通用正方形格式，適用於 Instagram 同 Facebook

## 安裝

```bash
# 安裝依賴套件
npm install
# 或
bun install
```

## 開發

```bash
# 啟動開發伺服器
npm run dev
# 或
bun run dev
```

## 建置

```bash
# 建置生產版本
npm run build
# 或
bun run build
```

## 預覽

```bash
# 預覽生產版本
npm run preview
# 或
bun run preview
```

## 使用方式

1. 點擊「匯入圖片」上傳圖片
2. 喺圖片上拖曳建立裁剪選擇區域
3. 調整裁剪區域：
   - 拖曳角落/邊緣嘅控制點調整大小
   - 拖曳裁剪區域內部移動位置
   - 使用微調控制進行精確調整
4. 如需要，設定長寬比（勾選鎖定長寬比）
5. 點擊「匯出圖片」儲存裁剪後嘅圖片
6. 設定匯出選項（格式、品質、檔案名稱、元數據）

## 技術堆疊

- **Vue 3** - 漸進式 JavaScript 框架
- **TypeScript** - 型別安全嘅 JavaScript
- **Vite** - 新一代前端建置工具
- **Pinia** - 狀態管理
- **Canvas API** - 圖片處理
- **vue-i18n** - 國際化
- **piexifjs** - EXIF 元數據處理

## 作者

由 [deventw](https://github.com/deventw/imageee-cut) 開發

## 授權

本專案為開源專案，採用 MIT 授權條款。
