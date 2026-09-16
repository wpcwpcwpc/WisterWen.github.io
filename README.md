# personal-site

个人技术门面站点：项目展示 + 技术写作。静态构建、零后端、零追踪。

- 技术栈：Astro（内容集合驱动）、Mermaid（构建期渲成 SVG）、Cloudflare Pages（托管）
- 内容：Markdown 存于版本库，新增内容 = 加一个文件
- 脱敏：构建前置扫描，命中禁出词即构建失败（详见 `GLOSSARY.md`）

## 快速开始

```bash
npm install
npm run dev          # 本地预览 http://localhost:4321
```

> `npm run dev` 会先自动生成图表 SVG（`predev` 钩子）——图源是 `diagrams/*.mmd`，
> 生成物不入库，克隆后无需手动准备。

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发预览 |
| `npm run sanitize` | 只跑脱敏扫描（可单独用） |
| `npm run diagrams` | `diagrams/*.mmd` → `src/assets/diagrams/*.svg` |
| `npm run og` | 生成 OG 分享图 `public/og/default.png` |
| `npm run build` | 脱敏扫描 → 口径校验 → PDF 审计 → 图表 → OG → 静态构建（一条命令，任一步失败即中止） |
| `npm run diagrams` | `diagrams/*.mmd` → `src/assets/diagrams/*.svg`（站内与 deck 共用同一批产物） |
| `npm run deck` | `deck/*` + 图表产物 → `public/deck/qa-agent/index.html`（自包含单文件，失败只告警） |
| `npm run pdf` | 用本机 Chromium 把项目页打印为 PDF（兜底产物，失败不阻塞） |
| `npm run pdf-audit` | 审计 `public/` 下所有待发布 PDF（PII + 禁出词）；加 `--dump` 可打印全文供人工通读 |
| `npm run check` | 链接与资源健康检查（无死链才通过） |
| `npm run mobile` | 用 CDP 强制 390px 真视口核对（`-- /projects/qa-agent --h 2400 --out _m.png`） |
| `npm run deploy` | 构建 → PDF → 再构建 → 检查 → 部署到 Cloudflare Pages |
| `npm run preview` | 本地预览已构建产物 |

## 目录结构

```
src/
  content/
    projects/*.md      项目页（/projects/<文件名>）
    posts/*.md         文章（/posts/<文件名>）
  content.config.ts    内容集合与 frontmatter 校验
  layouts/             站点骨架、项目页、文章页布局
  components/          Prose（长文排版）、Mermaid（图表）、ShotPlaceholder（截图占位）
  pages/               首页、关于、详情页、404、robots
  plugins/             rehype-diagram：把 ![x](diagram:名) 就地换成内联 SVG
  styles/              theme.css（设计令牌）、typography.css（排版规范）
  site.config.ts       站点名 / 定位 / 联系方式 / 导航（发布前替换 TODO）
  utils/               路径解析、URL 前缀、内容查询、图表加载
diagrams/*.mmd         图表唯一真源（见 diagrams/README.md）
deck/                  扫读版 deck 源（slides.mjs 内容 + theme.css 样式 + nav.js 翻页）
assets/og/default.svg  OG 图源
scripts/               构建流水线脚本（脱敏 / 口径 / PDF 审计 / 图表 / deck / OG / PDF / 链接 / 手机核对）
public/                favicon、OG 产物、PDF 产物、deck 产物
```

## URL 契约（勿改）

| 路径 | 用途 | 稳定性 |
|---|---|---|
| `/` | 首页 | 稳定 |
| `/about` | 关于 | 稳定 |
| `/projects/<slug>` | 项目页——**对外引用（简历等）指向此处** | **永不变更** |
| `/posts/<slug>` | 文章 | 发布后不变更 |
| `/deck/<slug>` | 概览 deck（子项目，可为空） | 稳定 |

新增项目只追加 `/projects/<新slug>`；域名锚"人"、路径锚"项目"，对外链接不因新增内容失效。

## 内容写法

**项目页**（`src/content/projects/<slug>.md`）

```yaml
---
title: 项目名
tagline: 一句话说明（≤80 字）
summary: 列表页摘要
order: 1          # 越小越靠前
featured: true    # 是否进首页精选
tags: [标签]
updated: 2026-09-15
---
```

**文章**（`src/content/posts/<slug>.md`）

```yaml
---
title: 标题
summary: 摘要
publishedAt: 2026-09-15
tags: [标签]
---
```

`draft: true` 的内容不会进入构建产物。文件名即 URL slug。

**配图**：在 Markdown 里直接按名引用图源，构建期内联为 SVG（不依赖前端 JS）：

```markdown
![图注文字](diagram:flow-site-pipeline)
```

**截图占位**：Markdown 无法使用组件，需要占位时在页面模板里用
`<ShotPlaceholder id="S01" title="..." hint="..." />`，并同步登记 `SHOTS.md`。

## 图表

- 源文件放 `diagrams/*.mmd`，命名 `<语义前缀>-<主题>.mmd`，规范见 `diagrams/README.md`
- 一处绘制、多处复用：站内页面、deck、PDF 共用同一批 SVG
- 产物 `src/assets/diagrams/*.svg` 是生成物，**禁止手改**（下次构建覆盖）

## 脱敏与发布

- `GLOSSARY.md`：泛化映射表 + 禁出词表 + 指标区间化登记（**口径单一来源**）
- 构建前自动扫描 `src/**`、`diagrams/**`；命中禁出词即失败，漏网内容无法发布
- `npm run figures` 校验页面数字与登记表述逐字一致；两处不一致即失败，数字打架进不了线上
- `npm run pdf-audit` 把 `public/` 下的 PDF 抽成文本再跑同一套词表（PDF 是文本闸门扫不到的盲区），
  并叠加 PII 模式（手机号 / 身份证 / 固话）
- 发布前按 `RELEASE-CHECKLIST.md` 逐条自检，终审结论记入该文件
- 截图占位状态在 `SHOTS.md` 跟踪；简历上站清单在 `RESUME.md`

## 部署

```bash
cp .env.example .env    # 填 SITE_URL / 凭据
npm run deploy
```

- 托管：Cloudflare Pages（免备案，可绑自定义域名）
- 路径前缀由 `BASE_PATH` 控制：根路径 `/`、子路径 `/xxx/`，换托管无需改源码
- 部署为无状态操作：回滚 = 重新部署上一版 `dist/`
- 凭据只从环境变量读取，绝不入库
- **deploy 里构建跑了两次**：PDF 与 deck 是由已构建的 `dist/` 产出的兜底/附加产物，
  项目页要按它们是否存在来决定是否出入口，因此必须在它们生成后再构建一次
  （第一次构建 → 产出 PDF → 第二次构建带上入口 → 检查 → 部署）

## GitHub Pages 部署

推送到 `main` 即自动构建并发布（`.github/workflows/deploy.yml`）。

- 站点前缀自动推导：仓库名为 `<用户>.github.io` 时用根路径，其它仓库用 `/<仓库名>/`
- **绑定自定义域名后必须覆盖前缀**：Pages 会把站点改到域名根路径，
  在 `Settings → Secrets and variables → Actions → Variables` 加两个变量即可：
  - `SITE_URL` = `https://你的域名`
  - `BASE_PATH` = `/`
- 四道闸门在 CI 上逐步执行，任何一道不过就不发布
- CI 上缺中文字体：PDF 与 OG 会**自动跳过**（仓库里已提交的产物兜底发布），
  不会因为环境缺字体卡住上线；改文案后在本机跑 `npm run pdf` / `npm run og` 更新产物并提交

## 视觉规范（勿绕过）

- 正文 ≥ 20px（目标 24px）、次级文字 ≥ 16px、行高 1.6~1.8、正文列宽 ≤ 72ch
- 一主色 + 灰阶，颜色一律走 `theme.css` 的 CSS 变量，禁止硬编码色值
- 约束落在 `typography.css` 与 `Prose.astro`，新增内容自动继承，不要写内联样式覆盖
