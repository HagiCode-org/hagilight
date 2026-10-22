import type { ArticlePromotionCopy } from '../article-promotion.js';

const workbenchAlt = '대기, 진행 중, 보관됨 세 열로 이루어진 세션 칸반 보드가 보이는 HagiCode 작업대 화면.';

export default {
  title: 'HagiCode',
  lead: 'HagiCode는 에이전트 코딩 작업 공간입니다. 풍부하고 편리한 UI 상호작용으로 계획 수립, 에이전트 실행, 프로젝트 작업을 쉽게 시작하고 따라가며 개발을 더 흥미로운 경험으로 만듭니다.',
  subheadline: '풍부하고 편리한 UI 상호작용으로 계획부터 프로젝트 작업까지 쉽게 따라갈 수 있습니다.',
  imageAlt: workbenchAlt,
  features: [
    { id: 'smart', label: '스마트', description: 'OpenSpec 워크플로는 의도를 제안, 설계, 작업을 거쳐 배포까지 이어지는 실행 가능한 경로로 바꿉니다.' },
    { id: 'efficient', label: '효율적', description: '다중 에이전트 실행으로 조사, 구현, 검토를 병렬로 진행하며 여러 저장소와 익숙한 Agent CLI를 지원합니다.' },
    { id: 'fun', label: '흥미로운', description: '풍부하고 편리한 UI 상호작용으로 계획 수립, 에이전트 실행, 프로젝트 작업을 쉽게 시작하고 따라갈 수 있습니다.' },
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
      caption: 'Hero Scenario: 영웅이 작업을 진행하고, 당신은 진행 상황과 레벨, 이야기를 지켜봅니다.',
      alt: 'Ember Keep이라는 이름의 HagiCode Hero Scenario 패널. 실행 중인 영웅 세 명의 레벨, 진행률, 이야기 문구가 표시됩니다.',
    },
    {
      id: 'cat-head',
      caption: '일러스트: HagiCode 일러스트 세트의 고양이 머리 초상. 방문할 때마다 바뀝니다.',
      alt: 'HagiCode 일러스트 세트의 양식화된 고양이 머리 일러스트.',
    },
  ],
  windowsLabel: 'Windows용 다운로드',
  windowsStoreLabel: 'Microsoft Store에서 받기',
  windowsStoreAriaLabel: 'Microsoft Store에서 HagiCode 열기',
  allDownloadsLabel: '모든 다운로드',
  shareLabel: 'HagiCode 공유',
  shareText: 'HagiCode는 풍부하고 편리한 UI 상호작용으로 계획 수립, 에이전트 실행, 프로젝트 작업을 쉽게 시작하고 따라갈 수 있게 합니다: https://www.hagicode.com/',
} satisfies ArticlePromotionCopy;
