import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * 内容查询统一入口 —— 草稿过滤与排序规则只在此处定义，
 * 列表页与详情页共用，避免规则散落导致"列表可见、详情 404"之类的不一致。
 */

export type ProjectEntry = CollectionEntry<'projects'>;
export type PostEntry = CollectionEntry<'posts'>;

/** 已发布项目，按 order 升序（数字小者靠前，同值按标题） */
export async function listProjects(): Promise<ProjectEntry[]> {
  const projects = await getCollection('projects', ({ data }) => !data.draft);
  return projects.sort(
    (a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title),
  );
}

/** 已发布文章，按发布日期倒序 */
export async function listPosts(): Promise<PostEntry[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
}
