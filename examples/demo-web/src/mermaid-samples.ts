// One deliberately large sample per Mermaid diagram type recorded in test/fixtures/mermaid-diagram-types.json.
// Keys are the ids `mermaid.detectType` returns; the page and the coverage test both read this file.

/** A flowchart with 90+ nodes in three subgraphs, so the package's single-fade path runs. */
function largeFlowchart(): string {
  const lines = ['flowchart LR'];
  const stages = ['ingest', 'parse', 'index', 'rank', 'render'];
  for (const stage of stages) {
    lines.push(`  subgraph ${stage}_group["${stage.toUpperCase()} stage"]`);
    for (let index = 0; index < 18; index += 1) lines.push(`    ${stage}${index}["${stage} step ${index}"]`);
    lines.push('  end');
  }
  for (let index = 0; index < stages.length - 1; index += 1) {
    lines.push(`  ${stages[index]}17 --> ${stages[index + 1]}0`);
  }
  for (const stage of stages) {
    for (let index = 0; index < 17; index += 1) lines.push(`  ${stage}${index} --> ${stage}${index + 1}`);
  }
  lines.push('  render17 -. retry .-> ingest0');
  return lines.join('\n');
}

export const MERMAID_SAMPLES: Record<string, string> = {
  architecture: `architecture-beta
  group cloud(cloud)[Cloud]
  group edge(internet)[Edge] in cloud
  service web(server)[Web] in edge
  service api(server)[API] in cloud
  service db(database)[Database] in cloud
  service cache(disk)[Cache] in cloud
  service queue(server)[Queue] in cloud
  web:R --> L:api
  api:B --> T:db
  api:R --> L:cache
  api:B --> T:queue`,

  block: `block-beta
  columns 3
  a["Ingest"] b["Parse"] c["Store"]
  d("Queue") space e{{"Route"}}
  f["Render"]:2 g[("Index")]
  a --> b
  b --> c
  b --> d
  d --> e
  e --> f
  f --> g`,

  c4: `C4Context
  title System context
  Person(user, "User", "Writes docs")
  System(app, "Docs Site", "Renders diagrams")
  System_Ext(mail, "Mail", "Sends notices")
  SystemDb(db, "Store", "Holds pages")
  Rel(user, app, "Uses")
  Rel(app, db, "Reads and writes")
  Rel(app, mail, "Notifies")`,

  class: `classDiagram
  class Animal {
    +int age
    +String name
    +eat() void
  }
  class Duck {
    +swim() void
    +quack() void
  }
  class Fish
  class Pond {
    +int depth
  }
  Animal <|-- Duck
  Animal <|-- Fish
  Duck --> Pond : lives in
  Fish "1" --o "*" Pond : swims in`,

  classDiagram: `classDiagram-v2
  class Shape {
    <<interface>>
    +area() double
  }
  class Circle {
    +double radius
  }
  class Square {
    +double side
  }
  class Canvas
  Shape <|.. Circle
  Shape <|.. Square
  Canvas o-- Shape : draws
  Canvas *-- Square : owns`,

  cynefin: `cynefin-beta
  clear
    "Standard process"
    "Routine request"
  complicated
    "Expert review"
    "Architecture change"
  complex
    "New market"
  chaotic
    "Outage"`,

  er: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "is sold as"
  CUSTOMER {
    string name
    string email PK
    int loyalty_points
  }
  ORDER {
    int id PK
    date placed_at
    string status
  }
  LINE_ITEM {
    int quantity
    decimal price
  }
  PRODUCT {
    string sku PK
    string title
    decimal list_price
  }`,

  eventmodeling: `eventmodeling
  tf 01 cmd CreateOrder
  tf 02 evt OrderCreated
  tf 03 rmo OrderSummary
  tf 04 cmd ShipOrder
  tf 05 evt OrderShipped`,

  'flowchart-v2': largeFlowchart(),

  'flowchart-elk': `flowchart-elk LR
  subgraph frontend["Frontend"]
    ui["Editor"] --> preview["Preview"]
  end
  subgraph backend["Backend"]
    api["API"] --> worker["Worker"]
    worker --> store[("Store")]
  end
  preview --> api
  api --> ui`,

  gantt: `gantt
  title Release plan
  dateFormat YYYY-MM-DD
  section Design
  Research :done, r1, 2026-01-01, 7d
  Prototype :active, p1, after r1, 5d
  section Build
  Core :c1, after p1, 10d
  Web :w1, after p1, 8d
  Tests :t1, after c1, 4d
  section Launch
  Docs :d1, after w1, 3d
  Release :milestone, m1, after t1, 0d`,

  gitGraph: `gitGraph
  commit id: "init"
  branch develop
  checkout develop
  commit id: "feat-a"
  commit id: "feat-b"
  checkout main
  commit id: "hotfix"
  merge develop
  branch release
  commit id: "rc1"
  checkout main
  merge release tag: "v1.0"`,

  info: `info showInfo`,

  ishikawa: `ishikawa-beta
  Slow release
    Process
      Manual steps
      Review queue
    People
      Few reviewers
    Tooling
      Flaky tests`,

  journey: `journey
  title Onboarding
  section Sign up
    Open page: 5: User
    Create account: 3: User
  section Setup
    Install CLI: 2: User, Admin
    Configure: 4: User
  section Use
    First run: 5: User`,

  kanban: `kanban
  Todo
    t1[Write spec]
    t2[Review draft]
  In progress
    t3[Build feature]
  Done
    t4[Ship release]
    t5[Update docs]`,

  mindmap: `mindmap
  root((Hagilight))
    Packages
      core
      astro
      starlight
      docusaurus
      mermaid
    Demo
      pages
      samples
    Release
      npm
      CI`,

  packet: `packet-beta
  title TCP header
  0-15: "Source port"
  16-31: "Destination port"
  32-63: "Sequence number"
  64-95: "Acknowledgment number"
  96-99: "Offset"
  100-105: "Reserved"
  106-111: "Flags"
  112-127: "Window"`,

  pie: `pie showData title Pets adopted
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15
  "Birds" : 5`,

  quadrantChart: `quadrantChart
  title Reach and engagement
  x-axis Low reach --> High reach
  y-axis Low engagement --> High engagement
  quadrant-1 We should expand
  quadrant-2 Need to promote
  quadrant-3 Re-evaluate
  quadrant-4 May be improved
  Campaign A: [0.3, 0.6]
  Campaign B: [0.45, 0.23]
  Campaign C: [0.57, 0.69]
  Campaign D: [0.78, 0.34]
  Campaign E: [0.4, 0.34]
  Campaign F: [0.35, 0.78]`,

  radar: `radar-beta
  title Skills
  axis a["Design"], b["Code"], c["Test"], d["Docs"], e["Ops"]
  curve team1["Team A"]{ 4, 3, 5, 2, 3 }
  curve team2["Team B"]{ 2, 5, 3, 4, 4 }
  max 5`,

  railroad: `railroad-beta
  expression = sequence(terminal("a"), nonterminal("b")) ;`,

  railroadAbnf: `railroad-abnf-beta
  title Rule
  rule = "a" / "b" ;`,

  railroadEbnf: `railroad-ebnf-beta
  title Identifier
  identifier = letter, { letter | digit } ;`,

  railroadPeg: `railroad-peg-beta
  pair <- key ":" value ;`,

  requirement: `requirementDiagram
  requirement login_req {
    id: 1
    text: The system shall authenticate users.
    risk: high
    verifymethod: test
  }
  element login_test {
    type: simulation
  }
  element auth_service {
    type: module
  }
  login_test - verifies -> login_req
  auth_service - satisfies -> login_req`,

  sankey: `sankey-beta
Agriculture,Food processing,60
Agriculture,Exports,20
Food processing,Households,30
Food processing,Restaurants,25
Food processing,Waste,5
Exports,Overseas,20`,

  sequence: `sequenceDiagram
  autonumber
  participant U as User
  participant W as Web
  participant A as API
  participant D as Database
  U->>W: Open page
  W->>A: GET /pages
  loop every refresh
    A->>D: query
    D-->>A: rows
  end
  alt cache hit
    A-->>W: cached
  else cache miss
    A->>D: fetch
    D-->>A: result
    A-->>W: fresh
  end
  opt error
    A--xW: failed
  end
  Note over W,A: rendered in place
  par notify
    W-->>U: show
  and log
    A->>A: write log
  end`,

  stateDiagram: `stateDiagram-v2
  [*] --> Idle
  Idle --> Loading : fetch
  state Loading {
    [*] --> Queued
    Queued --> Running
    Running --> [*]
  }
  Loading --> Ready : done
  Loading --> Failed : error
  Failed --> Idle : retry
  Ready --> [*]
  note right of Ready : terminal`,

  swimlane: `swimlane-beta
  a1["Place order"]
  a2["Pick items"]
  a3["Pack box"]
  a4["Deliver"]
  a1 --> a2
  a2 --> a3
  a3 --> a4`,

  timeline: `timeline
  title Release history
  section 2025
    Q1 : Prototype
    Q2 : Alpha : Beta
  section 2026
    Q1 : Public preview
    Q3 : General availability`,

  treeView: `treeView-beta
  "src"
    "components"
      "Button.tsx"
      "Card.tsx"
    "utils"
      "theme.ts"
  "package.json"`,

  treemap: `treemap-beta
"Root"
    "Packages"
        "core": 40
        "astro": 25
        "mermaid": 20
    "Demo"
        "pages": 10
        "samples": 15`,

  venn: `venn-beta
  title Team skills
  set A["Design"]
  set B["Engineering"]
  set C["Product"]
  union A,B["Prototype"]
  union B,C["Spec"]
  union A,B,C["Launch"]`,

  wardley: `wardley-beta
  title Hosting
  component User [0.9, 0.1]
  component Website [0.75, 0.3]
  component Database [0.55, 0.5]
  component Compute [0.4, 0.7]
  component Storage [0.25, 0.85]
  User -> Website
  Website -> Database
  Database -> Compute
  Compute -> Storage`,

  xychart: `xychart-beta
  title "Monthly visitors"
  x-axis [Jan, Feb, Mar, Apr, May, Jun]
  y-axis "Visitors" 0 --> 5000
  bar [1200, 1800, 2400, 3100, 3900, 4500]
  line [1000, 1600, 2300, 3000, 3700, 4300]`,
};
