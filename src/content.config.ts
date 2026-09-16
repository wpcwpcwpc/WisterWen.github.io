import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 关键数字登记项：口径的单一来源是 GLOSSARY.md 第三节，
// 此处只保存"页面上要展示什么"；两者的取值由 scripts/check-figures.mjs 在构建前强制一致。
const figure = z.object({
  /** 对应 GLOSSARY.md 第三节「指标区间化登记」的指标项（作为对照键） */
  register: z.string(),
  /** 页面上的短标签 */
  label: z.string(),
  /** 展示值，必须与登记的「对外表述」逐字一致 */
  value: z.string(),
});

// 项目集合：/projects/<id> 为对外引用路径（简历指向此处），id 由文件名决定，一经发布不得变更。
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string().max(80),
    summary: z.string(),
    order: z.number().default(100),
    featured: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updated: z.coerce.date().optional(),
    figures: z.array(figure).default([]),
  }),
});

// 文章集合：/posts/<id> 为文章路径。
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    publishedAt: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { projects, posts };
