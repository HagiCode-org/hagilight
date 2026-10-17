import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = 'Bancada do HagiCode com um quadro kanban de sessões nas colunas Pendente, Em andamento e Arquivado.';

export default {
  title: 'HagiCode',
  lead: 'O HagiCode é um ambiente de programação com agentes. Interações de interface ricas e práticas tornam o planejamento, a execução de agentes e o trabalho em projetos mais acessíveis e fáceis de acompanhar, criando uma experiência de desenvolvimento envolvente.',
  subheadline: 'Uma experiência de desenvolvimento envolvente, com interações de interface ricas e práticas.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: 'Inteligente', description: 'Os fluxos de trabalho do OpenSpec transformam a intenção em um caminho executável, da proposta ao design, às tarefas e à entrega.' },
    { id: 'efficient', label: 'Eficiente', description: 'A execução multiagente mantém pesquisa, implementação e revisão em andamento em paralelo, em vários repositórios e com os Agent CLI que você já usa.' },
    { id: 'fun', label: 'Interessante', description: 'Interações de interface ricas e práticas tornam o planejamento, a execução de agentes e o trabalho em projetos mais acessíveis e fáceis de acompanhar.' },
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
      caption: 'Hero Scenario: os heróis tocam o trabalho enquanto você acompanha progresso, níveis e história.',
      alt: 'Painel Hero Scenario do HagiCode chamado Ember Keep, com três heróis em execução e seu nível, progresso e texto da história.',
    },
  ],
  windowsLabel: 'Baixar para Windows',
  windowsStoreLabel: 'Obter na Microsoft Store',
  windowsStoreAriaLabel: 'Abrir o HagiCode na Microsoft Store',
  allDownloadsLabel: 'Todos os downloads',
  shareLabel: 'Compartilhar o HagiCode',
  shareText: 'O HagiCode torna o planejamento, a execução de agentes e o trabalho em projetos mais acessíveis por meio de interações de interface ricas e práticas: https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
