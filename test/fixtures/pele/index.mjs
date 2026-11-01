// Pele 1.13.0 markup fixtures for the Hagilight Pele engine adapters.
//
// Each SVG was rendered once with `render(source)` from the pinned `pele@1.13.0`
// (devDependency). Re-record a fixture only when the pin changes, and update the
// selectors below in the same change. test/mermaid-pele-markup.test.mjs checks
// every marker listed here against every fixture.
//
// Confirmed selectors (root is `svg.pele.pele-<type>`, `aria-roledescription` is the type):
//
// flowchart  node  g.pele-node[data-id] (ids keep underscores: my_node, other_node),
//                  box = child rect; group transform translate(x,y), rect x/y relative to it
//            edge  g.pele-edge[data-id] (L_my_node_other_node_0). First child path without
//                  .pele-marker is the line; path.pele-marker is the arrowhead.
// state      node  g.pele-node.pele-state[data-id] (Still, Moving); start node
//                  g.pele-node.pele-state-start[data-id=root_start], box = child circle
//            edge  g.pele-edge.pele-transition[data-id=edge0|edge1|edge2]
// class      node  g.pele-node.pele-class[data-id] (Animal, Duck); box = child rect
//            edge  g.pele-edge.pele-relation[data-id=id_Animal_Duck_1]
// er         node  g.pele-node.pele-entity[data-id] (CUSTOMER, ORDER); box = child rect
//            edge  g.pele-edge.pele-er-identifying[data-id=id_entity-CUSTOMER-0_entity-ORDER-1_0];
//                  first child path is the line, further path/circle children are markers
// pie        slice path.pele-slice[data-id=<label>] (Dogs, Cats); fill var(--pele-series-N, ...)
// sequence   actor g.pele-node.pele-actor[data-id] (Alice, Bob); box = child rect with absolute
//                  coordinates (no group transform); message g.pele-edge.pele-message[data-id=i0|i1]
//
// Edge identifiers are never parsed for endpoints in the adapters; they are only stable keys.

/** @type {ReadonlyArray<{ type: string, file: string, source: string, roledescription: string }>} */
export const PELE_FIXTURES = Object.freeze([
  {
    type: 'flowchart',
    file: 'flowchart.svg',
    source: 'flowchart LR\n  my_node[My node] --> other_node[Other node]\n  other_node --> third_node',
    roledescription: 'flowchart',
  },
  {
    type: 'state',
    file: 'state.svg',
    source: 'stateDiagram-v2\n  [*] --> Still\n  Still --> Moving\n  Moving --> Still',
    roledescription: 'state',
  },
  {
    type: 'class',
    file: 'class.svg',
    source: 'classDiagram\n  class Animal\n  class Duck\n  Animal <|-- Duck',
    roledescription: 'class',
  },
  {
    type: 'er',
    file: 'er.svg',
    source: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
    roledescription: 'er',
  },
  {
    type: 'pie',
    file: 'pie.svg',
    source: 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85',
    roledescription: 'pie',
  },
  {
    type: 'sequence',
    file: 'sequence.svg',
    source: 'sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi',
    roledescription: 'sequence',
  },
]);
