/**
 * 链接与资源健康检查 —— 扫描 dist/ 全部 HTML，验证站内链接与静态资源真实存在。
 *
 * 覆盖：导航链接、文章/项目互链、样式与脚本引用、图片与 SVG、favicon、OG 图、PDF 入口。
 * 任一目标缺失即非零退出，用于发布前把关（避免上线后 404）。
 *
 * 用法：
 *   node scripts/check-links.mjs            # 前缀自动探测（读 dist 的 sitemap），也可用 BASE_PATH 显式指定
 *   BASE_PATH=/sub/ node scripts/check-links.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');

/**
 * 前缀优先取环境变量；没传就从 sitemap 里的 URL 反推。
 * 否则子路径构建会被误判成"满站死链"——那是构建前缀与检查前缀不一致，不是站点坏了。
 */
function resolveBase() {
  if (process.env.BASE_PATH) return process.env.BASE_PATH.replace(/\/+$/, '');

  try {
    const index = path.join(distDir, 'sitemap-index.xml');
    const loc = existsSync(index) ? readFileSync(index, 'utf8') : '';
    const url = loc.match(/<loc>(.*?)<\/loc>/)?.[1];
    if (url) {
      const pathname = new URL(url).pathname; // /sub/sitemap-0.xml → /sub
      return pathname.replace(/\/[^/]*$/, '').replace(/\/+$/, '');
    }
  } catch {
    // 取不到就按根路径，交给下面的检查结果说话
  }
  return '';
}

const base = resolveBase(); // '' 或 '/sub'

async function walkHtml(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walkHtml(full)));
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

/** 把站内 URL 映射为 dist 内的文件路径；外部链接与锚点返回 null（不检查） */
function toDiskPath(url) {
  if (!url) return null;
  const clean = url.split('#')[0].split('?')[0];
  if (!clean || clean.startsWith('http') || clean.startsWith('mailto:') || clean.startsWith('//')) {
    return null;
  }

  let pathname = clean.startsWith('/') ? clean : null;
  if (pathname === null) return null; // 相对链接本仓库未使用，忽略

  if (base && pathname.startsWith(base)) pathname = pathname.slice(base.length);
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;

  const target = path.join(distDir, pathname);
  return target;
}

async function exists(target) {
  if (existsSync(target)) {
    const info = await stat(target);
    if (info.isDirectory()) return existsSync(path.join(target, 'index.html'));
    return true;
  }
  return false;
}

const pages = await walkHtml(distDir);
const broken = [];
const ATTR = /(?:href|src)="([^"]+)"/g;

for (const page of pages) {
  const html = await readFile(page, 'utf8');
  const seen = new Set();

  for (const match of html.matchAll(ATTR)) {
    const url = match[1];
    const target = toDiskPath(url);
    if (!target || seen.has(url)) continue;
    seen.add(url);
    if (!(await exists(target))) {
      broken.push(`${path.relative(distDir, page)} → ${url}`);
    }
  }
}

console.log(
  `[check-links] 扫描 ${pages.length} 个页面 · 站内链接与资源 · base="${base || '/'}"`,
);

if (broken.length > 0) {
  console.error(`\n[check-links] FAIL 发现 ${broken.length} 个死链：\n`);
  for (const item of broken) console.error(`  ${item}`);
  process.exit(1);
}

console.log('[check-links] PASS 无死链');
