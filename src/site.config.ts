/**
 * 站点级元数据 —— 名称、定位、联系方式、导航的唯一真源。
 * 发布前请替换下面标 TODO 的占位值。
 */
export const SITE = {
  name: '文棚嶒', // 站点名：域名锚人，这里用真实姓名
  author: '文棚嶒',
  tagline: '写代码，也写为什么这样写。', // TODO: 一句话定位
  description: '个人技术站：游戏 QA 方向的 Agent 工程实践与技术笔记。',
  email: '786939553@qq.com', // 简历中对外使用的联系邮箱；如想换专用信箱，改这一处即可
  github: 'https://github.com/wpcwpcwpc',
  nav: [
    { label: '首页', href: '/' },
    { label: '关于', href: '/about' },
    { label: '简历', href: '/resume' },
  ],
} as const;
