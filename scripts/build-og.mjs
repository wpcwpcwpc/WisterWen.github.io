/**
 * OG 分享图生成 —— 把 assets/og/default.svg 中的占位文本替换为站点配置值，
 * 再栅格化为 public/og/default.png（1200x630）。
 * 多数社交平台与聊天工具不渲染 SVG 缩略图，故必须产出 PNG。
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { SITE } from '../src/site.config.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = path.join(root, 'assets', 'og', 'default.svg');
const pngPath = path.join(root, 'public', 'og', 'default.png');

/** 转义 XML 文本节点，避免站点名中的特殊字符破坏 SVG 结构 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const siteUrl = (process.env.SITE_URL ?? 'https://example.com').replace(/^https?:\/\//, '');

const svg = (await readFile(svgPath, 'utf8'))
  .replace('NAME_TITLE', escapeXml(SITE.name))
  .replace('TAGLINE_TEXT', escapeXml(SITE.tagline))
  .replace('SITE_URL_TEXT', escapeXml(siteUrl));

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);

console.log(`[og] generated ${path.relative(root, pngPath)}`);
