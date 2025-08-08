/***********************
 * Main application entry point
 ***********************/
import { Graph, Node, Edge } from './models.js';
import { Renderer } from './renderer.js';
import { Editor } from './editor.js';
import { Logic, makeLogicNode } from './logic.js';

// Initialize the application
const canvas = document.getElementById('stage');
const graph = new Graph();
const renderer = new Renderer(canvas, graph);
const editor = new Editor(canvas, graph, renderer);

// Example graph (Vec3 dot product demo)
const loadExample = () => {
  graph.nodes.length = 0;
  graph.edges.length = 0;
  
  const start = makeLogicNode('logic:start', 80, 60);
  const v1 = makeLogicNode('logic:vec3', 280, 40);
  v1.data.x = 1;
  v1.data.y = 2;
  v1.data.z = 3;
  
  const v2 = makeLogicNode('logic:vec3', 280, 140);
  v2.data.x = 4;
  v2.data.y = 5;
  v2.data.z = 6;
  
  const dot = makeLogicNode('logic:dot', 520, 90);
  const prt = makeLogicNode('logic:print', 740, 90);
  
  const g = new Node({
    kind: 'group',
    isGroup: true,
    x: 40,
    y: 20,
    w: 760,
    h: 240,
    label: 'Vector Demo',
    members: [start.id, v1.id, v2.id, dot.id, prt.id]
  });
  
  graph.nodes.push(g, start, v1, v2, dot, prt);
  graph.edges.push(
    new Edge({ from: `${start.id}:out`, to: `${dot.id}:in`, isExec: true }),
    new Edge({ from: `${v1.id}:v`, to: `${dot.id}:a` }),
    new Edge({ from: `${v2.id}:v`, to: `${dot.id}:b` }),
    new Edge({ from: `${dot.id}:out`, to: `${prt.id}:in` }),
    new Edge({ from: `${dot.id}:out`, to: `${prt.id}:in`, isExec: true })
  );
  renderer.draw();
};

// Toolbar button handlers
document.getElementById('btn-rect').onclick = () => editor.addShape('rect');
document.getElementById('btn-round').onclick = () => editor.addShape('roundRect');
document.getElementById('btn-ellipse').onclick = () => editor.addShape('ellipse');
document.getElementById('btn-circle').onclick = () => editor.addShape('circle');
document.getElementById('btn-connector').onclick = () => editor.tool = 'connector';
document.getElementById('btn-select').onclick = () => editor.tool = 'select';
document.getElementById('btn-play').onclick = () => Logic.run(graph, editor.log);
document.getElementById('btn-example').onclick = loadExample;
document.getElementById('btn-group').onclick = () => editor.groupSelection();
document.getElementById('btn-ungroup').onclick = () => editor.ungroupSelection();

// Palette (logic nodes)
document.querySelectorAll('.tool[data-shape]').forEach(el => {
  el.onclick = () => {
    const kind = el.getAttribute('data-shape');
    const n = makeLogicNode(kind, 100 + Math.random() * 400, 100 + Math.random() * 300);
    graph.nodes.push(n);
    editor.setSelection(n);
    renderer.draw();
  };
});

// Bootstrap the application
renderer.resize();
loadExample();
editor.updatePanels();
