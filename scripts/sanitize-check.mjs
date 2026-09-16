/**
 * 脱敏扫描 —— 构建前置硬闸门。
 *
 * 读取禁出词表（CI：secret GLOSSARY_WORDS；本地：gitignored 的 GLOSSARY.local.md）
 * 的「2.1 精确词 / 2.2 正则模式」，扫描站点的内容与样式来源目录；命中即打印位置并以
 * 非零码退出，使构建失败——漏网内容物理上无法被发布。
 *
 * 词表缺失或为空视为闸门失效，同样失败（不允许"扫描器空转"通过）。
 * 命中词默认打码：公开仓库的 CI 日志同样公开，不能把要藏的词写进日志。
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 词表存放处 —— 公开仓库 MUST NOT 登记内部标识，词表因此不在仓库里：
 * CI 由 secret 注入全文，本地读已 gitignore 的 `GLOSSARY.local.md`。
 */
const wordsPath = path.join(root, 'GLOSSARY.local.md');

/** 公开仓库的 CI 日志同样公开：默认打码，本地要看全文设 SANITIZE_REVEAL=1 */
const REVEAL = process.env.SANITIZE_REVEAL === '1';
const maskToken = (token) => (REVEAL ? token : `${token.slice(0, 2)}***（${token.length} 字符）`);

/**
 * 扫描目标：内容、页面与组件的源码、图表源，以及仓库里的说明文档。
 * 规则文档同样公开 —— 早期禁出词表就是写在 `GLOSSARY.md` 与 `openspec/` 里漏出去的，
 * 所以这几处必须在范围内（根目录只扫一层，避免递归进 node_modules）。
 */
const scanRoots = [
  { dir: path.join(root, 'src'), extensions: ['.astro', '.ts', '.md', '.mdx', '.json'] },
  { dir: path.join(root, 'diagrams'), extensions: ['.mmd'] },
  // deck 的内容与样式直接进公开产物，必须与站点内容同一套闸门
  { dir: path.join(root, 'deck'), extensions: ['.mjs', '.js', '.css', '.md'] },
  { dir: root, extensions: ['.md'], deep: false },
  { dir: path.join(root, 'openspec'), extensions: ['.md', '.yaml', '.yml'] },
];

/** 硬跳过：词表自身命中词表，构建会永远失败 */
const IGNORE = ['GLOSSARY.local.md'];

/**
 * 豁免清单 —— 经作者确认需要按原文公开的对外文档。
 * 简历是主动投递的对外材料：雇主名称、内部产品名、个人经历本来就随简历对外。
 * 豁免不等于不检查：命中仍然打印告警，让"哪些内部标识被公开了"始终可见，只是不拦构建。
 */
const EXEMPT = [
  { path: 'src/pages/resume.astro', reason: '简历页：当前仅承载 PDF 容器，无履历文本；保留豁免以防文本回归（见 RESUME.md）' },
];

function exemptionFor(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  return EXEMPT.find((item) => item.path === rel);
}

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
  for (const { dir, extensions, deep = true } of scanRoots) {
    let entries = [];
    try {
      entries = await readdir(dir, { recursive: deep, withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue; // 目录尚未创建，跳过
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(entry.parentPath ?? entry.path, entry.name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      if (IGNORE.includes(rel)) continue;
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

const inlineWords = process.env.GLOSSARY_WORDS?.trim();
const glossary = inlineWords || (await readFile(wordsPath, 'utf8').catch(() => null));

if (!glossary) {
  console.error(
    '[sanitize] FAIL 取不到禁出词表 —— 闸门失效，构建中止\n' +
      `  本地：把词表写到 ${path.relative(root, wordsPath)}（不入库）\n` +
      '  CI：在仓库 secret 里配置 GLOSSARY_WORDS（值为词表全文）\n' +
      '  词表形态见 GLOSSARY.md 第一节',
  );
  process.exit(1);
}

const { exact, patterns } = parseGlossary(glossary);

if (exact.length === 0) {
  console.error('[sanitize] FAIL 词表的「2.1 精确词」为空 —— 闸门失效，构建中止');
  process.exit(1);
}

if (patterns.length === 0) {
  console.error('[sanitize] FAIL 词表的「2.2 正则模式」为空 —— 闸门失效，构建中止');
  process.exit(1);
}

const files = await collectFiles();
const reports = [];
const warnings = [];
let exemptCount = 0;

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const hits = scanText(text, exact, patterns);
  if (hits.length === 0) continue;

  const lines = hits
    .sort((a, b) => a.index - b.index)
    .map((hit) => `    第 ${lineOf(text, hit.index)} 行  命中「${maskToken(hit.token)}」`);

  const exempt = exemptionFor(file);
  const body = `  ${path.relative(root, file)}${exempt ? `（已豁免：${exempt.reason}）` : ''}\n${lines.join('\n')}`;

  if (exempt) {
    exemptCount += 1;
    warnings.push(body);
  } else {
    reports.push(body);
  }
}

console.log(
  `[sanitize] 扫描 ${files.length} 个文件 · 精确词 ${exact.length} 条 · 正则 ${patterns.length} 条 · 豁免 ${exemptCount} 个 · 词表来源=${inlineWords ? 'CI secret' : '本地文件'}`,
);

if (warnings.length > 0) {
  console.warn(
    `\n[sanitize] WARN 已豁免文件命中禁出词（不拦构建，但请确认这些都是可公开信息）：\n\n${warnings.join('\n\n')}\n`,
  );
}

if (reports.length > 0) {
  console.error(`\n[sanitize] FAIL 命中禁出词，构建中止：\n\n${reports.join('\n\n')}\n`);
  console.error('  处理方式：按词表第一节映射表替换为对外泛称，或区间化数字后重试。');
  console.error('  查看命中原文：本地设 SANITIZE_REVEAL=1 重跑。');
  process.exit(1);
}

console.log('[sanitize] PASS 未命中禁出词');
