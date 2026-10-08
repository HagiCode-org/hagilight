import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'Bancada do HagiCode com um quadro kanban de sessões nas colunas Pendente, Em andamento e Arquivado.';

export default {
  title: 'HagiCode',
  lead: 'O HagiCode é um ambiente de programação com agentes: os fluxos de trabalho do OpenSpec planejam a mudança, a execução multiagente a realiza e o Hero Dungeon torna o longo percurso visível, para transformar ideias em software entregue.',
  subheadline: 'Transforme ideias em software útil com um fluxo de trabalho com agentes mais inteligente, rápido e agradável.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'Inteligente', description: 'Os fluxos de trabalho do OpenSpec transformam a intenção em um caminho executável, da proposta ao design, às tarefas e à entrega.' },
    { id: 'efficient', label: 'Eficiente', description: 'A execução multiagente mantém pesquisa, implementação e revisão em andamento em paralelo, em vários repositórios e com os Agent CLI que você já usa.' },
    { id: 'fun', label: 'Divertido', description: 'O Hero Dungeon transforma longas sessões de programação em uma aventura visível, com heróis, progresso e conquistas.' },
  ],
  visitLabel: 'Acessar HagiCode',
  docsLabel: 'Ler a documentação',
  galleryHeading: 'O HagiCode em resumo',
  gallery: [
    {
      id: 'workbench',
      caption: 'A bancada: todas as sessões em um único quadro kanban.',
      alt: workbenchAlt,
    },
    {
      id: 'proposal-workflow',
      caption: 'Uma proposta passa de criada a redigida, revisada, executada e arquivada.',
      alt: 'Barra de etapas de uma proposta do HagiCode, de Criada a Arquivada, com a etapa Execução concluída em destaque e um botão Arquivar plano.',
    },
    {
      id: 'heroes',
      caption: 'Hero Dungeon: os heróis tocam o trabalho enquanto você acompanha progresso, níveis e história.',
      alt: 'Painel Hero Dungeon do HagiCode chamado Ember Keep, com três heróis em execução e seu nível, progresso e texto da história.',
    },
  ],
  windowsLabel: 'Baixar para Windows',
  windowsStoreLabel: 'Obter na Microsoft Store',
  windowsStoreAriaLabel: 'Abrir o HagiCode na Microsoft Store',
  allDownloadsLabel: 'Todos os downloads',
  shareLabel: 'Compartilhar o HagiCode',
  shareText: 'O HagiCode é um ambiente de programação com agentes, com fluxos de trabalho do OpenSpec, execução multiagente e Hero Dungeon: https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
