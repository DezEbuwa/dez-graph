/***********************
 * Logic system (Blueprint-style runtime)
 ***********************/
import { Port, Node } from './models.js';
import { uid } from './utils.js';

export const Logic = {
  registry: new Map(),
  
  define(type, fn) {
    this.registry.set(type, fn);
  },

  async run(graph, debug) {
    debug('▶ Running graph...');
    const byNode = new Map(graph.nodes.map(n => [n.id, n]));
    const execOut = new Map();
    const dataIn = new Map();
    
    for (const e of graph.edges) {
      if (e.isExec) {
        const [from] = e.from.split(':');
        (execOut.get(from) || execOut.set(from, []).get(from)).push(e);
      } else {
        (dataIn.get(e.to) || dataIn.set(e.to, []).get(e.to)).push(e);
      }
    }
    
    const starts = graph.nodes.filter(n => n.kind === 'logic:start');
    for (const start of starts) {
      await step(start.id);
    }

    async function step(nodeId) {
      const node = byNode.get(nodeId);
      if (!node) return;
      
      const inputs = {};
      for (const p of node.ports.filter(p => p.direction === 'in' && !p.isExec)) {
        const key = `${node.id}:${p.name}`;
        const incoming = dataIn.get(key) || [];
        if (incoming.length) {
          const src = incoming[incoming.length - 1].from;
          const [srcNode, srcPort] = src.split(':');
          const n = byNode.get(srcNode);
          inputs[p.name] = n?.data[srcPort];
        } else {
          inputs[p.name] = node.data[p.name];
        }
      }
      
      const impl = Logic.registry.get(node.kind);
      const outputs = impl ? await impl(node, inputs, { log: debug }) : {};
      
      for (const p of node.ports.filter(p => p.direction === 'out' && !p.isExec)) {
        if (outputs && p.name in outputs) {
          node.data[p.name] = outputs[p.name];
        }
      }
      
      const outs = execOut.get(node.id) || [];
      for (const e of outs) {
        const toNodeId = e.to.split(':')[0];
        await step(toNodeId);
      }
    }
  }
};

// Port helper functions
export const logicPorts = {
  execIn: () => new Port(uid('p'), null, 'in', 'exec', 'in', true),
  execOut: () => new Port(uid('p'), null, 'out', 'exec', 'out', true),
  in: (name, type) => new Port(uid('p'), null, name, type, 'in', false),
  out: (name, type) => new Port(uid('p'), null, name, type, 'out', false)
};

// Built-in logic node evaluators
Logic.define('logic:add', (node, i, { log }) => {
  const a = Number(i.a ?? 0);
  const b = Number(i.b ?? 0);
  const out = a + b;
  log(`Add: ${a}+${b}=${out}`);
  return { out };
});

Logic.define('logic:mul', (node, i, { log }) => {
  const a = Number(i.a ?? 0);
  const b = Number(i.b ?? 0);
  const out = a * b;
  log(`Mul: ${a}*${b}=${out}`);
  return { out };
});

Logic.define('logic:vec3', (node, i, { log }) => {
  const v = {
    x: Number(i.x ?? 0),
    y: Number(i.y ?? 0),
    z: Number(i.z ?? 0)
  };
  log(`Vec3: (${v.x}, ${v.y}, ${v.z})`);
  return { v };
});

Logic.define('logic:dot', (node, i, { log }) => {
  const a = i.a || { x: 0, y: 0, z: 0 };
  const b = i.b || { x: 0, y: 0, z: 0 };
  const out = a.x * b.x + a.y * b.y + a.z * b.z;
  log(`Dot: ⟨a,b⟩=${out}`);
  return { out };
});

Logic.define('logic:length', (node, i, { log }) => {
  const a = i.a || { x: 0, y: 0, z: 0 };
  const out = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  log(`Length: ∥a∥=${out}`);
  return { out };
});

Logic.define('logic:print', (node, i, { log }) => {
  let v = i.in;
  if (typeof v === 'object') v = JSON.stringify(v);
  log(`Print: ${v}`);
  return {};
});

Logic.define('logic:start', () => ({}));

// Logic node factory function
export function makeLogicNode(kind, x, y) {
  const n = new Node({
    kind,
    x,
    y,
    w: 170,
    h: 80,
    label: kind.split(':')[1]
  });

  if (kind === 'logic:start') {
    n.ports = [logicPorts.execOut()];
    n.ports[0].nodeId = n.id;
    n.ports[0].name = 'out';
  } else if (kind === 'logic:add' || kind === 'logic:mul') {
    n.ports = [
      logicPorts.execIn(),
      logicPorts.execOut(),
      logicPorts.in('a', 'number'),
      logicPorts.in('b', 'number'),
      logicPorts.out('out', 'number')
    ];
    n.ports.forEach(p => p.nodeId = n.id);
    n.data.a = 1;
    n.data.b = 1;
  } else if (kind === 'logic:vec3') {
    n.ports = [
      logicPorts.in('x', 'number'),
      logicPorts.in('y', 'number'),
      logicPorts.in('z', 'number'),
      logicPorts.out('v', 'vector3')
    ];
    n.ports.forEach(p => p.nodeId = n.id);
    n.data.x = 0;
    n.data.y = 0;
    n.data.z = 0;
  } else if (kind === 'logic:dot') {
    n.ports = [
      logicPorts.execIn(),
      logicPorts.execOut(),
      logicPorts.in('a', 'vector3'),
      logicPorts.in('b', 'vector3'),
      logicPorts.out('out', 'number')
    ];
    n.ports.forEach(p => p.nodeId = n.id);
  } else if (kind === 'logic:length') {
    n.ports = [
      logicPorts.in('a', 'vector3'),
      logicPorts.out('out', 'number')
    ];
    n.ports.forEach(p => p.nodeId = n.id);
  } else if (kind === 'logic:print') {
    n.ports = [
      logicPorts.execIn(),
      logicPorts.in('in', 'any')
    ];
    n.ports.forEach(p => p.nodeId = n.id);
  }

  return n;
}
