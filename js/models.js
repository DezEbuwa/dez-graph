/***********************
 * Model classes
 ***********************/
import { uid } from './utils.js';

export class Port {
  constructor(id, nodeId, name, type = 'number', direction = 'in', isExec = false) {
    Object.assign(this, { id, nodeId, name, type, direction, isExec });
  }
}

export class Node {
  constructor({
    id = uid('node'),
    x = 0,
    y = 0,
    w = 160,
    h = 70,
    r = 8,
    kind = 'rect',
    label = 'Node',
    fill = '#1e2636',
    stroke = '#2f3a52',
    ports = [],
    isGroup = false,
    members = []
  }) {
    Object.assign(this, { id, x, y, w, h, r, kind, label, fill, stroke, isGroup, members });
    this.ports = ports; // array<Port>
    this.data = {};     // outputs + default input values by name
  }

  get bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

export class Edge {
  constructor({ id = uid('edge'), from, to, isExec = false }) {
    Object.assign(this, { id, from, to, isExec });
  }
}

export class Graph {
  constructor() {
    this.nodes = [];
    this.edges = [];
  }

  toJSON() {
    return JSON.stringify({ nodes: this.nodes, edges: this.edges }, null, 2);
  }

  static fromJSON(json) {
    const g = new Graph();
    const o = JSON.parse(json);
    g.nodes = o.nodes.map(n => Object.assign(new Node({}), n));
    g.edges = o.edges.map(e => Object.assign(new Edge({}), e));
    return g;
  }
}

export class Viewport {
  constructor() {
    this.tx = 0;
    this.ty = 0;
    this.scale = 1;
  }

  toWorld(p) {
    return {
      x: (p.x - this.tx) / this.scale,
      y: (p.y - this.ty) / this.scale
    };
  }

  fromWorld(p) {
    return {
      x: p.x * this.scale + this.tx,
      y: p.y * this.scale + this.ty
    };
  }
}
