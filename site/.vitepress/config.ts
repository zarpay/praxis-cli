import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/praxis-cli/',
  title: 'Praxis',
  description: 'Structured knowledge for humans and AI agents',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  appearance: false,
  vite: {
    server: {
      allowedHosts: true,
    },
  },
  themeConfig: {
    siteTitle: 'Praxis',
    search: {
      provider: 'local',
    },
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quick Start', link: '/getting-started/' },
      { text: 'Concepts', link: '/concepts/knowledge-primitives' },
      { text: 'Commands', link: '/commands/init' },
      { text: 'Validation', link: '/validation/writing-specs' },
      { text: 'Plugins', link: '/plugins/overview' },
      { text: 'Design', link: '/design/decisions' },
      { text: 'Reference', link: '/reference/config' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Home', link: '/' },
          { text: 'Quick Start', link: '/getting-started/' },
        ],
      },
      {
        text: 'Concepts',
        items: [
          { text: 'Knowledge Primitives', link: '/concepts/knowledge-primitives' },
          { text: 'The Compiler Pipeline', link: '/concepts/compiler-pipeline' },
          { text: 'Validation Domains', link: '/concepts/validation-domains' },
          { text: 'Agent Profiles', link: '/concepts/agent-profiles' },
        ],
      },
      {
        text: 'Commands',
        items: [
          { text: 'praxis init', link: '/commands/init' },
          { text: 'praxis add', link: '/commands/add' },
          { text: 'praxis compile', link: '/commands/compile' },
          { text: 'praxis status', link: '/commands/status' },
          { text: 'praxis validate', link: '/commands/validate' },
          { text: 'praxis config', link: '/commands/config' },
        ],
      },
      {
        text: 'Validation',
        items: [
          { text: 'Writing Specs', link: '/validation/writing-specs' },
          { text: 'Cross-Directory Validation', link: '/validation/cross-directory' },
          { text: 'Caching', link: '/validation/caching' },
          { text: 'CI Integration', link: '/validation/ci' },
        ],
      },
      {
        text: 'Plugins',
        items: [
          { text: 'Overview', link: '/plugins/overview' },
          { text: 'Claude Code Plugin', link: '/plugins/claude-code' },
        ],
      },
      {
        text: 'Design',
        items: [
          { text: 'Design Decisions', link: '/design/decisions' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Configuration', link: '/reference/config' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/zarpay/praxis-cli' }],
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    docFooter: {
      prev: 'Previous page',
      next: 'Next page',
    },
    footer: {
      message: 'Built for teams that want both humans and AI agents to operate from the same knowledge.',
      copyright: 'Released under the MIT License',
    },
  },
});
