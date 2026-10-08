import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'HagiCode-Werkbank mit einem Kanban-Board der Sitzungen in den Spalten Ausstehend, In Bearbeitung und Archiviert.';

export default {
  title: 'HagiCode',
  lead: 'HagiCode ist ein agentischer Coding-Arbeitsplatz: OpenSpec-Workflows planen die Änderung, Multi-Agent-Ausführung setzt sie um, und Hero Dungeon macht den langen Weg sichtbar, bis aus der Idee ausgelieferte Software wird.',
  subheadline: 'Mit einem intelligenteren, schnelleren und unterhaltsameren agentischen Workflow wird aus Ideen nutzbare Software.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'Intelligent', description: 'OpenSpec-Workflows machen aus einer Absicht einen umsetzbaren Weg vom Vorschlag über Design und Aufgaben bis zur Auslieferung.' },
    { id: 'efficient', label: 'Effizient', description: 'Multi-Agent-Ausführung führt Recherche, Umsetzung und Prüfung parallel aus, über mehrere Repositories und die Agent CLIs, die Sie bereits nutzen.' },
    { id: 'fun', label: 'Unterhaltsam', description: 'Hero Dungeon macht lange Coding-Sitzungen zu einem sichtbaren Abenteuer mit Helden, Fortschritt und Erfolgen.' },
  ],
  visitLabel: 'HagiCode besuchen',
  docsLabel: 'Dokumentation lesen',
  galleryHeading: 'HagiCode auf einen Blick',
  gallery: [
    {
      id: 'workbench',
      caption: 'Die Werkbank: alle Sitzungen auf einem Kanban-Board.',
      alt: workbenchAlt,
    },
    {
      id: 'proposal-workflow',
      caption: 'Ein Vorschlag wandert von Erstellt über Entwurf und Prüfung bis zu Ausführung und Archiv.',
      alt: 'Stufenleiste eines HagiCode-Vorschlags von Erstellt bis Archiviert; die Stufe Ausführung abgeschlossen ist hervorgehoben, dazu die Schaltfläche Plan archivieren.',
    },
    {
      id: 'heroes',
      caption: 'Hero Dungeon: Helden erledigen die Arbeit, Sie behalten Fortschritt, Level und Geschichte im Blick.',
      alt: 'Bereich Hero Dungeon von HagiCode namens Ember Keep mit drei laufenden Helden samt Level, Fortschritt und Geschichtstext.',
    },
  ],
  windowsLabel: 'Für Windows herunterladen',
  windowsStoreLabel: 'Im Microsoft Store erhalten',
  windowsStoreAriaLabel: 'HagiCode im Microsoft Store öffnen',
  allDownloadsLabel: 'Alle Downloads',
  shareLabel: 'HagiCode teilen',
  shareText: 'HagiCode ist ein agentischer Coding-Arbeitsplatz mit OpenSpec-Workflows, Multi-Agent-Ausführung und Hero Dungeon: https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
