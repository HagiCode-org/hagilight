import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'Banco de trabajo de HagiCode con un tablero kanban de sesiones en las columnas Pendiente, En curso y Archivado.';

export default {
  title: 'HagiCode',
  lead: 'HagiCode es un espacio de programación con agentes. Las interacciones de interfaz, ricas y cómodas, hacen que planificar, ejecutar agentes y trabajar en proyectos sea accesible y fácil de seguir, para una experiencia de desarrollo atractiva.',
  subheadline: 'Una experiencia de desarrollo atractiva gracias a interacciones de interfaz ricas y cómodas.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'Inteligente', description: 'Los flujos de trabajo de OpenSpec convierten la intención en un itinerario ejecutable, de la propuesta al diseño, las tareas y la entrega.' },
    { id: 'efficient', label: 'Eficiente', description: 'La ejecución multiagente avanza en paralelo con la investigación, la implementación y la revisión, en varios repositorios y con los Agent CLI que ya usas.' },
    { id: 'fun', label: 'Interesante', description: 'Las interacciones de interfaz, ricas y cómodas, hacen que planificar, ejecutar agentes y trabajar en proyectos sea accesible y fácil de seguir.' },
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
      caption: 'Hero Scenario: los héroes sacan adelante el trabajo mientras sigues el progreso, los niveles y la historia.',
      alt: 'Panel Hero Scenario de HagiCode llamado Ember Keep, con tres héroes en ejecución y su nivel, progreso y texto de la historia.',
    },
    {
      id: 'hero-avatar',
      caption: 'Ilustración: un avatar de héroe de HagiCode, de un conjunto que cambia en cada visita.',
      alt: 'Ilustración estilizada de un avatar de héroe de HagiCode: un retrato de personaje.',
    },
  ],
  windowsLabel: 'Descargar para Windows',
  windowsStoreLabel: 'Obtenerlo en Microsoft Store',
  windowsStoreAriaLabel: 'Abrir HagiCode en Microsoft Store',
  allDownloadsLabel: 'Todas las descargas',
  shareLabel: 'Compartir HagiCode',
  shareText: 'HagiCode hace que la planificación, la ejecución de agentes y el trabajo en proyectos sean accesibles mediante interacciones de interfaz ricas y cómodas: https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
