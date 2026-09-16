/**
 * 脱敏扫描 —— 构建前置硬闸门。
 *
 * 读取 GLOSSARY.md 的「禁出词表」节（2.1 精确词 / 2.2 正则模式），扫描站点的
 * 内容与样式来源目录；命中即打印词与位置并以非零码退出，使构建失败——
 * 漏网内容物理上无法被发布。
 *
 * 词表缺失或为空视为闸门失效，同样失败（不允许"扫描器空转"通过）。
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const glossaryPath = path.join(root, 'GLOSSARY.md');

/** 扫描目标：内容、页面与组件的源码、图表源。GLOSSARY 与被扫描目录之外的文件不参与。 */
const scanRoots = [
  { dir: path.join(root, 'src'), extensions: ['.astro', '.ts', '.md', '.mdx', '.json'] },
  { dir: path.join(root, 'diagrams'), extensions: ['.mmd'] },
  // deck 的内容与样式直接进公开产物，必须与站点内容同一套闸门
  { dir: path.join(root, 'deck'), extensions: ['.mjs', '.js', '.css', '.md'] },
];

/** 从词表中取出 2.1 精确词（``` 代码块）与 2.2 正则模式（表格首列）。 */
function parseGlossary(text) {
  // 注意：不能用 '---' 做分隔——markdown 表格分隔行 |---|---| 里也含 '---'
  const sectionTwo = text.split('## 二、禁出词表')[1]?.split('\n## ')[0] ?? '';

  const exactSection = sectionTwo.split('### 2.1 精确词')[1]?.split('###')[0] ?? '';
  const seen = new Set();
  const exact = [];
  for (const line of (exactSection.match(/```[\s\S]*?```/)?.[0] ?? '').replace(/```/g, '').split('\n')) {
    const word = line.trim();
    const key = word.toLowerCase();
    if (!word || seen.has(key)) continue; // 大小写变体只保留一条，避免同一处重复上报
    seen.add(key);
    exact.push(word);
  }

  const regexSection = sectionTwo.split('### 2.2 正则模式')[1] ?? '';
  const patterns = [];
  for (const line of regexSection.split('\n')) {
    const match = line.match(/^\|\s*`(.+?)`\s*\|/);
    if (!match) continue;
    // 表格内的 \| 是 markdown 转义，还原为真正的正则或运算
    patterns.push(match[1].replace(/\\\|/g, '|'));
  }

  return { exact, patterns };
}

/** 递归收集扫描目标文件 */
async function collectFiles() {
  const files = [];
  for (const { dir, extensions } of scanRoots) {
    let entries = [];
    try {
      entries = await readdir(dir, { recursive: true, withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue; // 目录尚未创建，跳过
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(entry.parentPath ?? entry.path, entry.name);
      if (extensions.includes(path.extname(entry.name).toLowerCase())) files.push(full);
    }
  }
  return files;
}

/** 对单个文件做精确词与正则匹配，返回命中列表 */
function scanText(text, exact, patterns) {
  const hits = [];
  const lower = text.toLowerCase();

  for (const word of exact) {
    const needle = word.toLowerCase();
    let index = lower.indexOf(needle);
    while (index !== -1) {
      hits.push({ token: word, index });
      index = lower.indexOf(needle, index + needle.length);
    }
  }

  for (const source of patterns) {
    const re = new RegExp(source, 'gi');
    for (const match of text.matchAll(re)) {
      hits.push({ token: match[0], index: match.index ?? 0 });
    }
  }

  return hits;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

let glossary;
try {
  glossary = await readFile(glossaryPath, 'utf8');
} catch {
  console.error('[sanitize] FAIL GLOSSARY.md 不存在 —— 词表缺失视为闸门失效，构建中止');
  process.exit(1);
}

const { exact, patterns } = parseGlossary(glossary);

if (exact.length === 0) {
  console.error('[sanitize] FAIL GLOSSARY.md 的「2.1 精确词」为空 —— 闸门失效，构建中止');
  process.exit(1);
}

if (patterns.length === 0) {
  console.error('[sanitize] FAIL GLOSSARY.md 的「2.2 正则模式」为空 —— 闸门失效，构建中止');
  process.exit(1);
}

const files = await collectFiles();
const reports = [];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const hits = scanText(text, exact, patterns);
  if (hits.length === 0) continue;

  const lines = hits
    .sort((a, b) => a.index - b.index)
    .map((hit) => `    第 ${lineOf(text, hit.index)} 行  命中「${hit.token}」`);

  reports.push(`  ${path.relative(root, file)}\n${lines.join('\n')}`);
}

console.log(
  `[sanitize] 扫描 ${files.length} 个文件 · 精确词 ${exact.length} 条 · 正则 ${patterns.length} 条`,
);

if (reports.length > 0) {
  console.error(`\n[sanitize] FAIL 命中禁出词，构建中止：\n\n${reports.join('\n\n')}\n`);
  console.error('  处理方式：按 GLOSSARY.md 第一节替换为对外泛称，或区间化数字后重试。');
  process.exit(1);
}

console.log('[sanitize] PASS 未命中禁出词');
