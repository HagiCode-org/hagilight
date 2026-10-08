import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = '대기, 진행 중, 보관됨 세 열로 이루어진 세션 칸반 보드가 보이는 HagiCode 작업대 화면.';

export default {
  title: 'HagiCode',
  lead: 'HagiCode는 에이전트 코딩 작업 공간입니다. OpenSpec 워크플로로 변경을 계획하고, 다중 에이전트 실행으로 진행하며, Hero Dungeon으로 긴 작업의 진행 상황을 한눈에 보여 아이디어를 실제로 배포되는 소프트웨어로 만듭니다.',
  subheadline: '더 스마트하고 빠르며 즐거운 에이전트 워크플로로 유용한 소프트웨어를 만드세요.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: '스마트', description: 'OpenSpec 워크플로는 의도를 제안, 설계, 작업을 거쳐 배포까지 이어지는 실행 가능한 경로로 바꿉니다.' },
    { id: 'efficient', label: '효율적', description: '다중 에이전트 실행으로 조사, 구현, 검토를 병렬로 진행하며 여러 저장소와 익숙한 Agent CLI를 지원합니다.' },
    { id: 'fun', label: '즐거운', description: 'Hero Dungeon은 긴 코딩 세션을 영웅, 진행 상황, 업적이 보이는 모험으로 만듭니다.' },
  ],
  visitLabel: 'HagiCode 방문',
  docsLabel: '문서 읽기',
  galleryHeading: 'HagiCode 한눈에 보기',
  gallery: [
    {
      id: 'workbench',
      caption: '작업대: 모든 세션을 하나의 칸반 보드에 모았습니다.',
      alt: workbenchAlt,
    },
    {
      id: 'proposal-workflow',
      caption: '제안은 생성, 초안 작성, 검토를 거쳐 실행과 보관으로 이어집니다.',
      alt: '생성됨부터 보관됨까지의 단계 표시줄에서 실행 완료 단계가 강조되고 계획 보관 버튼이 있는 HagiCode 제안 화면.',
    },
    {
      id: 'heroes',
      caption: 'Hero Dungeon: 영웅이 작업을 진행하고, 당신은 진행 상황과 레벨, 이야기를 지켜봅니다.',
      alt: 'Ember Keep이라는 이름의 HagiCode Hero Dungeon 패널. 실행 중인 영웅 세 명의 레벨, 진행률, 이야기 문구가 표시됩니다.',
    },
  ],
  windowsLabel: 'Windows용 다운로드',
  windowsStoreLabel: 'Microsoft Store에서 받기',
  windowsStoreAriaLabel: 'Microsoft Store에서 HagiCode 열기',
  allDownloadsLabel: '모든 다운로드',
  shareLabel: 'HagiCode 공유',
  shareText: 'HagiCode는 OpenSpec 워크플로, 다중 에이전트 실행, Hero Dungeon을 갖춘 코딩 작업 공간입니다: https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
