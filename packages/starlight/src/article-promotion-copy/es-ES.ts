import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'Banco de trabajo de HagiCode con un tablero kanban de sesiones en las columnas Pendiente, En curso y Archivado.';

export default {
  title: 'HagiCode',
  lead: 'HagiCode es un espacio de trabajo de programación con agentes: los flujos de trabajo de OpenSpec planifican el cambio, la ejecución multiagente lo lleva a cabo y Hero Dungeon hace visible el largo recorrido, para convertir ideas en software entregado.',
  subheadline: 'Convierte ideas en software útil con un flujo de trabajo con agentes más inteligente, rápido y ameno.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'Inteligente', description: 'Los flujos de trabajo de OpenSpec convierten la intención en un itinerario ejecutable, de la propuesta al diseño, las tareas y la entrega.' },
    { id: 'efficient', label: 'Eficiente', description: 'La ejecución multiagente avanza en paralelo con la investigación, la implementación y la revisión, en varios repositorios y con los Agent CLI que ya usas.' },
    { id: 'fun', label: 'Divertido', description: 'Hero Dungeon convierte las largas sesiones de programación en una aventura visible, con héroes, progreso y logros.' },
  ],
  visitLabel: 'Visitar HagiCode',
  docsLabel: 'Leer la documentación',
  galleryHeading: 'HagiCode de un vistazo',
  gallery: [
    {
      id: 'workbench',
      caption: 'El banco de trabajo: todas las sesiones en un solo tablero kanban.',
      alt: workbenchAlt,
    },
    {
      id: 'proposal-workflow',
      caption: 'Una propuesta pasa de creada a redactada, revisada, ejecutada y archivada.',
      alt: 'Barra de etapas de una propuesta de HagiCode, de Creada a Archivada, con la etapa Ejecución completada resaltada y un botón Archivar plan.',
    },
    {
      id: 'heroes',
      caption: 'Hero Dungeon: los héroes sacan adelante el trabajo mientras sigues el progreso, los niveles y la historia.',
      alt: 'Panel Hero Dungeon de HagiCode llamado Ember Keep, con tres héroes en ejecución y su nivel, progreso y texto de la historia.',
    },
  ],
  windowsLabel: 'Descargar para Windows',
  windowsStoreLabel: 'Obtenerlo en Microsoft Store',
  windowsStoreAriaLabel: 'Abrir HagiCode en Microsoft Store',
  allDownloadsLabel: 'Todas las descargas',
  shareLabel: 'Compartir HagiCode',
  shareText: 'HagiCode es un espacio de trabajo de programación con agentes, con flujos de trabajo de OpenSpec, ejecución multiagente y Hero Dungeon: https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
