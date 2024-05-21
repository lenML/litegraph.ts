# litegraph.ts

Experimental port/refactor of litegraph.js (base on [litegraph.ts](https://github.com/space-nuko/litegraph.ts)) to TypeScript with ESM module support.

**NOTE:** The API/serialization format is not 100% compatible with vanilla litegraph.js. It's subject to change during development.

**NOTE2:** This project is mainly about publishing litegraph.ts to npm and carrying out some ongoing renovations and refactoring of this library, with plans as follows:
- [ ] Add an event bus to LGraph / LGraphCanvas
- [ ] Refactor contextmenu to enable the ability to customize the contextmenu
- [ ] Refactor scheduler to support step execution as well as sub-graph (graph theory) controls
- [ ] try enable `strictNullChecks`

# Document (typedoc exports)
https://lenml.github.io/litegraph.ts/

## install

```
npm install @litegraph-ts/core @litegraph-ts/nodes-basic
```

## Example Usage

``` typescript
import { LiteGraph, LGraph, LGraphCanvas } from "@litegraph-ts/core"
import { ConstantNumber, Watch } from "@litegraph-ts/nodes-basic"

// Include litegraph's css, required for the UI to function properly
import "@litegraph-ts/core/css/litegraph.css"

// Grab canvas element from the index.html
const root = document.getElementById("main") as HTMLDivElement;
const canvas = root.querySelector<HTMLCanvasElement>(".graphCanvas");

// Setup graph (nodes/logic) and graph canvas (rendering/canvas/UI)
const graph = new LGraph();
const graphCanvas = new LGraphCanvas(canvas, graph);
graphCanvas.background_image = "imgs/grid.png";
(window as any).graph = graph;
(window as any).graphCanvas = graphCanvas;

// Refresh graph on every draw tick in a loop
graph.onAfterExecute = () => {
    graphCanvas.draw(true);
};

// Create a ConstantNumber, sends a constant number on its output
var constNumber = LiteGraph.createNode(ConstantNumber);
constNumber.pos = [200, 200];
constNumber.setValue(4.5);

// Create a Watch, displays input value on its panel
var watch = LiteGraph.createNode(Watch);
watch.pos = [600, 300];

// Add components to the graph
graph.add(constNumber);
graph.add(watch);

// Connect the first output of the number (output 0) to the first input of the watch (input 0)
constNumber.connect(0, watch, 0);

// Begin executing logic on the graph
graph.start();
```
