import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'Рабочее место HagiCode: канбан-доска сессий со столбцами «Ожидает», «В работе» и «В архиве».';

export default {
  title: 'HagiCode',
  lead: 'HagiCode — агентная среда разработки: рабочие процессы OpenSpec планируют изменение, мультиагентное выполнение его реализует, а Hero Dungeon делает долгий путь наглядным, так что идеи становятся готовым ПО.',
  subheadline: 'Превращайте идеи в полезное ПО с более умным, быстрым и увлекательным агентным рабочим процессом.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'Умный', description: 'Рабочие процессы OpenSpec превращают намерение в исполнимый путь от предложения через дизайн и задачи до готового изменения.' },
    { id: 'efficient', label: 'Эффективный', description: 'Мультиагентное выполнение параллельно продвигает исследование, реализацию и проверку в нескольких репозиториях и с привычными Agent CLI.' },
    { id: 'fun', label: 'Увлекательный', description: 'Hero Dungeon превращает долгие сессии разработки в наглядное приключение с героями, прогрессом и достижениями.' },
  ],
  visitLabel: 'Перейти на HagiCode',
  docsLabel: 'Читать документацию',
  galleryHeading: 'HagiCode вкратце',
  gallery: [
    {
      id: 'workbench',
      caption: 'Рабочее место: все сессии на одной канбан-доске.',
      alt: workbenchAlt,
    },
    {
      id: 'proposal-workflow',
      caption: 'Предложение проходит путь от созданного до составленного, проверенного, выполненного и архивного.',
      alt: 'Полоса этапов предложения HagiCode от «Создано» до «В архиве»: выделен этап «Выполнение завершено», рядом кнопка «Архивировать план».',
    },
    {
      id: 'heroes',
      caption: 'Hero Dungeon: герои ведут работу, а вы следите за прогрессом, уровнями и сюжетом.',
      alt: 'Панель Hero Dungeon в HagiCode под названием Ember Keep: три работающих героя с уровнем, прогрессом и текстом сюжета.',
    },
  ],
  windowsLabel: 'Скачать для Windows',
  windowsStoreLabel: 'Получить в Microsoft Store',
  windowsStoreAriaLabel: 'Открыть HagiCode в Microsoft Store',
  allDownloadsLabel: 'Все загрузки',
  shareLabel: 'Поделиться HagiCode',
  shareText: 'HagiCode — агентная среда разработки с рабочими процессами OpenSpec, мультиагентным выполнением и Hero Dungeon: https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
