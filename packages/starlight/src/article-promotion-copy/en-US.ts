import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'HagiCode workbench showing a session kanban board with Pending, In Progress, and Archived columns.';

export default {
  title: 'HagiCode',
  lead: 'HagiCode is an agentic coding workspace. Rich, convenient UI interactions make planning, agent execution, and project work approachable and easy to navigate, creating an engaging development experience.',
  subheadline: 'Explore an engaging development experience through rich, convenient UI interactions.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'Smart', description: 'OpenSpec workflows turn intent into an executable path, from proposal to design, tasks, and a shipped change.' },
    { id: 'efficient', label: 'Efficient', description: 'Multi-agent execution keeps research, implementation, and review moving in parallel, across several repositories and the Agent CLIs you already use.' },
    { id: 'fun', label: 'Interesting', description: 'Rich, convenient UI interactions make planning, agent execution, and project work approachable and easy to navigate.' },
  ],
  visitLabel: 'Visit HagiCode',
  docsLabel: 'Read the documentation',
  galleryHeading: 'HagiCode at a glance',
  gallery: [
    {
      id: 'workbench',
      caption: 'The workbench: every session on one kanban board.',
      alt: workbenchAlt,
    },
    {
      id: 'proposal-workflow',
      caption: 'A proposal moves from created to drafted, reviewed, executed, and archived.',
      alt: 'HagiCode proposal stage bar from Created to Archived, with the Execution Completed stage highlighted and an Archive Plan button.',
    },
    {
      id: 'heroes',
      caption: 'Hero Dungeon: heroes run the work while you follow progress, levels, and story.',
      alt: 'HagiCode Hero Dungeon panel named Ember Keep, listing three running heroes with their level, progress, and story text.',
    },
  ],
  windowsLabel: 'Download for Windows',
  windowsStoreLabel: 'Get it from Microsoft Store',
  windowsStoreAriaLabel: 'Open HagiCode on Microsoft Store',
  allDownloadsLabel: 'All downloads',
  shareLabel: 'Share HagiCode',
  shareText: 'HagiCode makes planning, agent execution, and project work approachable through rich, convenient UI interactions: https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
