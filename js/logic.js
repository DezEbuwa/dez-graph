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
    debug('> Running graph...\n');
    const byNode = new Map(graph.nodes.map(n => [n.id, n]));
    const execOut = new Map();
    const dataIn = new Map();
    
    for (const e of graph.edges) {
      if (e.isExec) {
        const [from, fromPort] = e.from.split(':');
        // Only add to execOut if it's actually an execution output port
        if (fromPort === 'execOut') {
          (execOut.get(from) || execOut.set(from, []).get(from)).push(e);
        }
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
      
      // Collect inputs from connected data edges
      const inputs = {};
      for (const p of node.ports.filter(p => p.direction === 'in' && !p.isExec)) {
        const key = `${node.id}:${p.name}`;
        const incoming = dataIn.get(key) || [];
        if (incoming.length) {
          const src = incoming[incoming.length - 1].from;
          const [srcNode, srcPort] = src.split(':');
          const sourceNode = byNode.get(srcNode);
          // Get the value from the source node's output data
          inputs[p.name] = sourceNode?.data[srcPort];
        } else {
          // Use node's own data as fallback
          inputs[p.name] = node.data[p.name];
        }
      }
      
      // Execute the node's logic
      const impl = Logic.registry.get(node.kind);
      const outputs = impl ? await impl(node, inputs, { log: debug }) : {};
      
      // Store outputs in node data
      for (const p of node.ports.filter(p => p.direction === 'out' && !p.isExec)) {
        if (outputs && p.name in outputs) {
          node.data[p.name] = outputs[p.name];
        }
      }
      
      // Follow execution edges to next nodes
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
  execIn: () => new Port(uid('p'), null, 'exec', 'exec', 'in', true),
  execOut: () => new Port(uid('p'), null, 'exec', 'exec', 'out', true),
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

Logic.define('logic:number', (node, i, { log }) => {
  // Use input if provided, otherwise use the node's internal value
  const v = Number(i.num ?? node.data.num ?? 0);
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
  if (v === undefined || v === null) {
    log(`Print: <no input connected or undefined>`);
  } else if (typeof v === 'object') {
    log(`Print: ${JSON.stringify(v)}`);
  } else {
    log(`Print: ${v}`);
  }
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
    h: 100, // Increased height to accommodate port labels
    label: kind.split(':')[1]
  });

  if (kind === 'logic:start') {
    n.ports = [logicPorts.execOut()];
    n.ports[0].nodeId = n.id;
    n.ports[0].name = 'execOut';
  } else if (kind === 'logic:add' || kind === 'logic:mul') {
    n.ports = [
      logicPorts.execIn(),
      logicPorts.execOut(),
      logicPorts.in('a', 'number'),
      logicPorts.in('b', 'number'),
      logicPorts.out('out', 'number')
    ];
    n.ports.forEach(p => p.nodeId = n.id);
    // Set proper names for exec ports
    n.ports[0].name = 'execIn';
    n.ports[1].name = 'execOut';
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
  } else if (kind === 'logic:number') {
    n.ports = [
      logicPorts.in('num', 'number'),
      logicPorts.out('v', 'number')
    ];
    n.ports.forEach(p => p.nodeId = n.id);
    n.data.num = 0;
    // Initialize the output value immediately
    n.data.v = 0;
  } else if (kind === 'logic:dot') {
    n.ports = [
      logicPorts.execIn(),
      logicPorts.execOut(),
      logicPorts.in('a', 'vector3'),
      logicPorts.in('b', 'vector3'),
      logicPorts.out('out', 'number')
    ];
    n.ports.forEach(p => p.nodeId = n.id);
    // Set proper names for exec ports
    n.ports[0].name = 'execIn';
    n.ports[1].name = 'execOut';
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
    // Set proper name for exec port
    n.ports[0].name = 'execIn';
  }

  return n;
}
