import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'Établi HagiCode affichant un tableau kanban des sessions avec les colonnes En attente, En cours et Archivé.';

export default {
  title: 'HagiCode',
  lead: 'HagiCode est un espace de développement agentique : les workflows OpenSpec planifient le changement, l’exécution multi-agent le réalise et Hero Dungeon rend le long parcours visible, pour transformer vos idées en logiciels livrés.',
  subheadline: 'Transformez vos idées en logiciels utiles grâce à un workflow agentique plus intelligent, rapide et agréable.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'Intelligent', description: 'Les workflows OpenSpec transforment une intention en parcours exécutable, de la proposition à la livraison en passant par la conception et les tâches.' },
    { id: 'efficient', label: 'Efficace', description: 'L’exécution multi-agent fait avancer recherche, réalisation et revue en parallèle, sur plusieurs dépôts et avec les Agent CLI que vous utilisez déjà.' },
    { id: 'fun', label: 'Ludique', description: 'Hero Dungeon transforme les longues sessions de code en une aventure visible, avec héros, progression et succès.' },
  ],
  visitLabel: 'Visiter HagiCode',
  docsLabel: 'Lire la documentation',
  galleryHeading: 'HagiCode en un coup d’œil',
  gallery: [
    {
      id: 'workbench',
      caption: 'L’établi : toutes les sessions sur un seul tableau kanban.',
      alt: workbenchAlt,
    },
    {
      id: 'proposal-workflow',
      caption: 'Une proposition passe de créée à rédigée, revue, exécutée puis archivée.',
      alt: 'Barre d’étapes d’une proposition HagiCode, de Créée à Archivée, avec l’étape Exécution terminée mise en évidence et un bouton Archiver le plan.',
    },
    {
      id: 'heroes',
      caption: 'Hero Dungeon : les héros avancent le travail pendant que vous suivez progression, niveaux et récit.',
      alt: 'Panneau Hero Dungeon de HagiCode nommé Ember Keep, listant trois héros en cours avec leur niveau, leur progression et le texte du récit.',
    },
  ],
  windowsLabel: 'Télécharger pour Windows',
  windowsStoreLabel: 'Obtenir sur le Microsoft Store',
  windowsStoreAriaLabel: 'Ouvrir HagiCode sur le Microsoft Store',
  allDownloadsLabel: 'Tous les téléchargements',
  shareLabel: 'Partager HagiCode',
  shareText: 'HagiCode est un espace de développement agentique avec workflows OpenSpec, exécution multi-agent et Hero Dungeon : https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
