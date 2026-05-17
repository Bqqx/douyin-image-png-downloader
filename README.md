# douyin-image-png-downloader

抖音图集图片一键下载工具，支持选择图片并转换为 PNG。

A Chrome/Edge extension for downloading Douyin image posts as PNG files, with optional image selection.

## Features

- Download all images from the current Douyin image post as PNG.
- Select specific images before downloading.
- Convert the WebP image loaded by Douyin into PNG for better software compatibility.
- Ignore stale image-post DOM when the current Douyin item is a pure video.

## Install

1. Open `chrome://extensions/` or `edge://extensions/`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select the `chrome-extension` folder in this repository.

## Usage

1. Open a Douyin image post.
2. Click `下载PNG` to download all images.
3. Click `选择下载` to choose specific images, then download the selected images.

Downloaded files are saved under the browser download folder, usually in `douyin_images`.

## Notes

The extension converts the image already loaded by the page into PNG. PNG improves compatibility with other software, but it does not add detail beyond the source image.
