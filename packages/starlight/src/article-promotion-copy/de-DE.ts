import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'HagiCode-Werkbank mit einem Kanban-Board der Sitzungen in den Spalten Ausstehend, In Bearbeitung und Archiviert.';

export default {
  title: 'HagiCode',
  lead: 'HagiCode ist ein agentischer Coding-Arbeitsplatz. Vielseitige, komfortable Interaktionen in der Benutzeroberfläche machen Planung, Agent-Ausführung und Projektarbeit zugänglich und leicht nachvollziehbar – für ein ansprechendes Entwicklungserlebnis.',
  subheadline: 'Entdecken Sie ein ansprechendes Entwicklungserlebnis mit vielseitigen, komfortablen Interaktionen in der Benutzeroberfläche.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'Intelligent', description: 'OpenSpec-Workflows machen aus einer Absicht einen umsetzbaren Weg vom Vorschlag über Design und Aufgaben bis zur Auslieferung.' },
    { id: 'efficient', label: 'Effizient', description: 'Multi-Agent-Ausführung führt Recherche, Umsetzung und Prüfung parallel aus, über mehrere Repositories und die Agent CLIs, die Sie bereits nutzen.' },
    { id: 'fun', label: 'Interessant', description: 'Vielseitige, komfortable Interaktionen in der Benutzeroberfläche machen Planung, Agent-Ausführung und Projektarbeit zugänglich und leicht nachvollziehbar.' },
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
  shareText: 'HagiCode macht Planung, Agent-Ausführung und Projektarbeit durch vielseitige, komfortable Interaktionen in der Benutzeroberfläche zugänglich: https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
