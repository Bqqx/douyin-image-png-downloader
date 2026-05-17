# Douyin Image Downloader Chrome Extension

Chrome/Edge 插件版抖音图集图片下载工具。当前版本会把页面里的 WebP 图片转换成 PNG 后下载。

## 安装

1. 打开 `chrome://extensions/` 或 `edge://extensions/`。
2. 开启右上角的「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择本目录：`chrome-extension`。

## 使用

1. 打开抖音图集作品页面。
2. 页面右下角会出现「下载PNG」和「选择下载」两个按钮。
3. 点击「下载PNG」会直接下载当前图集全部图片。
4. 点击「选择下载」会打开缩略图面板，选中需要的图片后下载；未选中任何图片时会下载全部。
5. 图片会下载到浏览器默认下载目录下的 `douyin_images` 文件夹。

如果浏览器不接受插件后台下载较大的 PNG，插件会退回页面内直接下载，文件仍是 PNG，但可能会直接落在默认下载目录而不是 `douyin_images` 文件夹。

## 当前提取规则

- 图集容器：`.GTuWw0eq.WtagMwIy.focusPanel`
- 图片页节点：`.dySwiperSlide`
- 主图选择器：`.Stp1qoNr > img[src]`
- 备用规则：当前 `.focusPanel` 内所有包含 `douyinpic.com` 和 `aweme_images` 的 `img[src]`

第一版只下载图集图片，不下载普通视频、封面、头像或评论区图片。PNG 是由网页加载到的图片解码后重新导出的格式，方便其他软件识别；它不会提升原图细节。
