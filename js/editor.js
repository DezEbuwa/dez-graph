/***********************
 * Editor and UI management
 ***********************/
import { Node, Edge, Port } from './models.js';
import { uid, clamp, hitNode, hitHandle } from './utils.js';
import { makeLogicNode } from './logic.js';

export class Editor {
  constructor(canvas, graph, renderer) {
    this.canvas = canvas;
    this.graph = graph;
    this.renderer = renderer;
    
    // UI elements
    this.propsPane = document.getElementById('props');
    this.portsPane = document.getElementById('ports');
    this.debugPane = document.getElementById('debug');
    
    // Editor state
    this.tool = 'select';
    this.mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, button: 0 };
    this.isPanning = false;
    this.dragStart = null;
    this.dragNode = null;
    this.dragHandle = null;
    this.dragGroup = null;
    this.draggingPort = null;
    this.dragMultiple = null;
    this.marqueeStart = null;
    this.marqueeAdd = false;
    
    this.setupEventHandlers();
  }

  log = (s) => {
    this.debugPane.textContent += `${s}`;
    this.debugPane.scrollTop = this.debugPane.scrollHeight;
  };

  debug = (s) => this.log(s);

  toWorld(evt) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left);
    const y = (evt.clientY - rect.top);
    const w = this.renderer.viewport.toWorld({ x, y });
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.wx = w.x;
    this.mouse.wy = w.y;
    return w;
  }

  setSelection(n, additive = false) {
    if (!additive) this.renderer.selection.clear();
    if (n) {
      if (this.renderer.selection.has(n.id) && additive) {
        this.renderer.selection.delete(n.id);
      } else {
        this.renderer.selection.add(n.id);
      }
    }
    this.updatePanels();
    this.renderer.draw();
  }

  updatePanels() {
    if (this.renderer.selection.size >= 1) {
      const id = [...this.renderer.selection][this.renderer.selection.size - 1];
      const n = this.graph.nodes.find(n => n.id === id);
      if (!n) {
        this.propsPane.textContent = 'No selection';
        return;
      }

      this.propsPane.innerHTML = '';
      this.propsPane.appendChild(this.row('Label', this.input(n.label, v => {
        n.label = v;
        this.renderer.draw();
      })));
      
      this.propsPane.appendChild(this.row('X', this.input(n.x, v => {
        n.x = Number(v);
        this.renderer.draw();
      }, 'number')));
      
      this.propsPane.appendChild(this.row('Y', this.input(n.y, v => {
        n.y = Number(v);
        this.renderer.draw();
      }, 'number')));
      
      this.propsPane.appendChild(this.row('W', this.input(n.w, v => {
        n.w = Number(v);
        this.renderer.draw();
      }, 'number')));
      
      this.propsPane.appendChild(this.row('H', this.input(n.h, v => {
        n.h = Number(v);
        this.renderer.draw();
      }, 'number')));

      if (n.kind === 'roundRect') {
        this.propsPane.appendChild(this.row('Radius', this.input(n.r || 8, v => {
          n.r = Number(v);
          this.renderer.draw();
        }, 'number')));
      }

      if (n.isGroup) {
        this.propsPane.appendChild(this.row('Members', this.text(n.members.join(', '))));
      }

      // Input ports (editable when not connected)
      const inPorts = (n.ports || []).filter(p => !p.isExec && p.direction === 'in');
      if (inPorts.length) {
        this.propsPane.appendChild(this.sectionTitle('Inputs'));
        inPorts.forEach(p => {
          const connected = this.isDataConnected(n.id, p.name);
          const current = this.getPortValue(n, p);
          const editor = this.portEditor(p, current, val => this.setPortValue(n, p, val));
          if (connected) {
            editor.disabled = true;
            editor.title = 'Value comes from connection';
          }
          this.propsPane.appendChild(this.row(`${p.name} : ${p.type}${connected ? ' (connected)' : ''}`, editor));
        });
      }

      // Output ports (read-only)
      const outPorts = (n.ports || []).filter(p => !p.isExec && p.direction === 'out');
      if (outPorts.length) {
        this.propsPane.appendChild(this.sectionTitle('Outputs'));
        outPorts.forEach(p => {
          const v = n.kind.startsWith('logic:') ? n.data[p.name] : (p.value ?? '');
          const displayValue = v == null ? '(run to update)' : (typeof v === 'object' ? JSON.stringify(v) : v);
          this.propsPane.appendChild(this.row(`${p.name} : ${p.type}`, this.readOnly(String(displayValue))));
        });
      }

      // Ports summary
      this.portsPane.innerHTML = '';
      const ports = n.ports || [];
      if (!ports.length) {
        this.portsPane.textContent = n.isGroup ? '(group container)' : '(no ports)';
        return;
      }
      
      const list = document.createElement('div');
      list.className = 'port-list';
      for (const p of ports) {
        const el = document.createElement('div');
        el.title = `${p.direction} ${p.isExec ? 'exec' : 'data'} ${p.type}`;
        el.innerHTML = `<span class="miniport ${p.isExec ? 'exec' : ''}"></span>${p.name}`;
        list.appendChild(el);
      }
      this.portsPane.appendChild(list);
    } else {
      this.propsPane.textContent = 'No selection';
      this.portsPane.textContent = 'No selection';
    }
  }

  // UI helper methods
  row(label, control) {
    const d = document.createElement('div');
    d.className = 'prop-row';
    const l = document.createElement('div');
    l.textContent = label;
    d.append(l, control);
    return d;
  }

  input(value, oninput, type = 'text') {
    const i = document.createElement('input');
    i.type = type;
    i.value = value;
    i.oninput = () => oninput(i.value);
    return i;
  }

  text(value) {
    const i = document.createElement('div');
    i.textContent = value;
    return i;
  }

  readOnly(value) {
    const i = document.createElement('div');
    i.className = 'kbd';
    i.textContent = value;
    return i;
  }

  sectionTitle(txt) {
    const h = document.createElement('h3');
    h.textContent = txt;
    return h;
  }

  portEditor(p, value, onChange) {
    if (p.type === 'number') {
      return this.input(value ?? 0, v => onChange(Number(v)), 'number');
    }
    if (p.type === 'boolean') {
      const el = document.createElement('input');
      el.type = 'checkbox';
      el.checked = !!value;
      el.oninput = () => onChange(el.checked);
      return el;
    }
    if (p.type === 'color') {
      const el = document.createElement('input');
      el.type = 'color';
      el.value = typeof value === 'string' ? value : '#ffffff';
      el.oninput = () => onChange(el.value);
      return el;
    }
    if (p.type === 'object') {
      const el = document.createElement('textarea');
      el.value = value ? JSON.stringify(value, null, 2) : '{}';
      el.onchange = () => {
        try {
          onChange(JSON.parse(el.value));
          el.style.borderColor = '';
        } catch {
          el.style.borderColor = 'var(--danger)';
        }
      };
      return el;
    }
    // default: string / any
    return this.input(value ?? '', onChange, 'text');
  }

  isDataConnected(nodeId, portName) {
    return this.graph.edges.some(e => 
      !e.isExec && typeof e.to === 'string' && e.to === `${nodeId}:${portName}`
    );
  }

  getPortValue(n, p) {
    return n.kind.startsWith('logic:') ? n.data[p.name] : p.value;
  }

  setPortValue(n, p, val) {
    if (n.kind.startsWith('logic:')) {
      n.data[p.name] = val;
      
      // For number nodes, automatically update the output value
      if (n.kind === 'logic:number' && p.name === 'num') {
        n.data.v = Number(val);
      }
    } else {
      p.value = val;
    }
    this.renderer.draw();
    
    // Refresh the properties panel to show updated output values
    if (this.selectedNode === n) {
      this.showNodeProps(n);
    }
  }

  validateConnection(fromPort, toPort) {
    if (fromPort.direction !== 'out' || toPort.direction !== 'in') return false;
    if (fromPort.isExec !== toPort.isExec && (fromPort.isExec || toPort.isExec)) return false;
    const t1 = fromPort.type, t2 = toPort.type;
    if (fromPort.isExec) return true;
    if (t1 === 'any' || t2 === 'any') return true;
    return t1 === t2; // simple type check
  }

  addShape(kind) {
    if (kind === 'group') return; // groups created via selection
    let n;
    if (kind.startsWith('logic:')) {
      n = makeLogicNode(kind, 100, 100);
    } else {
      n = new Node({
        kind,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 120,
        w: 160,
        h: 80,
        label: kind
      });
    }
    if (!kind.startsWith('logic:')) {
      n.ports = [
        new Port(uid('p'), n.id, 'in', 'number', 'in', false),
        new Port(uid('p'), n.id, 'out', 'number', 'out', false)
      ];
    }
    this.graph.nodes.push(n);
    this.setSelection(n);
    this.renderer.draw();
  }

  groupSelection() {
    if (this.renderer.selection.size === 0) return;
    const members = [...this.renderer.selection]
      .map(id => this.graph.nodes.find(n => n.id === id))
      .filter(n => n && !n.isGroup);
    if (members.length === 0) return;
    
    const pad = 16;
    const minX = Math.min(...members.map(n => n.x)) - pad;
    const minY = Math.min(...members.map(n => n.y)) - pad;
    const maxX = Math.max(...members.map(n => n.x + n.w)) + pad;
    const maxY = Math.max(...members.map(n => n.y + n.h)) + pad;
    
    const g = new Node({
      kind: 'group',
      isGroup: true,
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      label: 'Group',
      members: members.map(n => n.id)
    });
    
    this.graph.nodes.unshift(g);
    this.renderer.selection.clear();
    this.renderer.selection.add(g.id);
    this.updatePanels();
    this.renderer.draw();
  }

  ungroupSelection() {
    if (this.renderer.selection.size !== 1) return;
    const id = [...this.renderer.selection][0];
    const g = this.graph.nodes.find(n => n.id === id && n.isGroup);
    if (!g) return;
    
    this.graph.nodes = this.graph.nodes.filter(n => n !== g);
    this.renderer.selection.clear();
    this.renderer.draw();
    this.updatePanels();
  }

  setupEventHandlers() {
    // Resize observer
    const resizeObs = new ResizeObserver(() => this.renderer.resize());
    resizeObs.observe(this.canvas);

    // Wheel zoom (cursor-centric)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const mx = this.mouse.x, my = this.mouse.y;
      const before = this.renderer.viewport.toWorld({ x: mx, y: my });
      const scale = clamp(this.renderer.viewport.scale * (1 + (-Math.sign(e.deltaY) * 0.1)), 0.2, 3);
      this.renderer.viewport.scale = scale;
      this.renderer.viewport.tx = mx - before.x * scale;
      this.renderer.viewport.ty = my - before.y * scale;
      this.renderer.draw();
    }, { passive: false });

    // Keyboard events
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.isPanning = true;
      }
      if (e.key === 'Delete' && this.renderer.selection.size) {
        const ids = new Set(this.renderer.selection);
        this.graph.nodes = this.graph.nodes.filter(n => !ids.has(n.id));
        this.graph.edges = this.graph.edges.filter(e => {
          const f = typeof e.from === 'string' ? e.from.split(':')[0] : null;
          const t = typeof e.to === 'string' ? e.to.split(':')[0] : null;
          return !ids.has(f) && !ids.has(t);
        });
        this.renderer.selection.clear();
        this.updatePanels();
        this.renderer.draw();
      }
      if (e.key.toLowerCase() === 'v') this.tool = 'select';
      if (e.key.toLowerCase() === 'g') this.groupSelection();
      if (e.key === 'Escape') {
        this.renderer.dragEdge = null;
        this.draggingPort = null;
        this.tool = 'select';
        this.renderer.draw();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isPanning = false;
      }
    });

    this.setupMouseHandlers();
  }

  setupMouseHandlers() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => {
      const w = this.toWorld(e);
      this.mouse.down = true;
      this.mouse.button = e.button;
      
      if (this.isPanning || e.button === 1) {
        this.dragStart = { x: this.mouse.x, y: this.mouse.y };
        return;
      }

      if (this.tool === 'connector') {
        const hit = this.renderer.portAt(w, 'out');
        if (!hit) return;
        this.draggingPort = hit;
        this.renderer.dragEdge = new Edge({
          from: `${hit.node.id}:${hit.port.name}`,
          to: { _px: w.x, _py: w.y },
          isExec: hit.port.isExec
        });
        return;
      }

      if (this.tool === 'select') {
        const portHit = this.renderer.portAt(w, 'out');
        if (portHit && this.renderer.portAt({ x: portHit.port._px, y: portHit.port._py }, null)) {
          this.draggingPort = portHit;
          this.renderer.dragEdge = new Edge({
            from: `${portHit.node.id}:${portHit.port.name}`,
            to: { _px: w.x, _py: w.y },
            isExec: portHit.port.isExec
          });
          return;
        }

        const h = hitHandle({ x: w.x, y: w.y }, this.renderer.handles);
        if (h) {
          this.dragHandle = h;
          return;
        }

        const n = hitNode(w, this.graph);
        if (n) {
          // If clicking on a node that's already selected and we have multiple selections, start multi-drag
          if (this.renderer.selection.has(n.id) && this.renderer.selection.size > 1) {
            const selectedNodes = [...this.renderer.selection].map(id => this.graph.nodes.find(node => node.id === id)).filter(Boolean);
            this.dragMultiple = {
              nodes: selectedNodes,
              startPositions: selectedNodes.map(node => ({ id: node.id, x: node.x, y: node.y })),
              dx: w.x - n.x,
              dy: w.y - n.y
            };
            return;
          }
          
          this.setSelection(n, e.shiftKey);
          
          if (n.isGroup) {
            this.dragGroup = { node: n, dx: w.x - n.x, dy: w.y - n.y };
            return;
          }
          
          this.dragNode = { node: n, dx: w.x - n.x, dy: w.y - n.y };
          return;
        }

        // Start marquee selection
        this.marqueeStart = w;
        this.marqueeAdd = e.shiftKey;
        this.renderer.marquee = { x: w.x, y: w.y, w: 0, h: 0 };
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const w = this.toWorld(e);
      
      if (this.isPanning && this.mouse.down) {
        this.renderer.viewport.tx += (this.mouse.x - (this.dragStart?.x || this.mouse.x));
        this.renderer.viewport.ty += (this.mouse.y - (this.dragStart?.y || this.mouse.y));
        this.dragStart = { x: this.mouse.x, y: this.mouse.y };
        this.renderer.draw();
        return;
      }

      if (this.dragMultiple && this.mouse.down) {
        const dx = w.x - this.dragMultiple.dx;
        const dy = w.y - this.dragMultiple.dy;
        
        // Calculate the offset from the original click position
        const offsetX = dx - this.dragMultiple.startPositions[0].x;
        const offsetY = dy - this.dragMultiple.startPositions[0].y;
        
        this.dragMultiple.nodes.forEach((node, i) => {
          const start = this.dragMultiple.startPositions[i];
          node.x = start.x + offsetX;
          node.y = start.y + offsetY;
        });
        
        this.renderer.draw();
        this.updatePanels();
        return;
      }

      if (this.dragGroup && this.mouse.down) {
        const g = this.dragGroup.node;
        const nx = w.x - this.dragGroup.dx;
        const ny = w.y - this.dragGroup.dy;
        const dx = nx - g.x;
        const dy = ny - g.y;
        g.x = nx;
        g.y = ny;
        
        for (const id of g.members) {
          const child = this.graph.nodes.find(n => n.id === id);
          if (child) {
            child.x += dx;
            child.y += dy;
          }
        }
        
        this.renderer.draw();
        this.updatePanels();
        return;
      }

      if (this.dragNode && this.mouse.down) {
        const n = this.dragNode.node;
        n.x = w.x - this.dragNode.dx;
        n.y = w.y - this.dragNode.dy;
        this.renderer.draw();
        this.updatePanels();
        return;
      }

      if (this.dragHandle && this.mouse.down) {
        const n = this.dragHandle.node;
        if (this.dragHandle.c === 'se') {
          n.w = Math.max(40, w.x - n.x);
          n.h = Math.max(40, w.y - n.y);
        }
        if (this.dragHandle.c === 'ne') {
          n.w = Math.max(40, w.x - n.x);
          const by = w.y;
          n.h = Math.max(40, (n.y + n.h) - by);
          n.y = by;
        }
        if (this.dragHandle.c === 'sw') {
          n.h = Math.max(40, w.y - n.y);
          const bx = w.x;
          n.w = Math.max(40, (n.x + n.w) - bx);
          n.x = bx;
        }
        if (this.dragHandle.c === 'nw') {
          const bx = w.x, by = w.y;
          n.w = Math.max(40, (n.x + n.w) - bx);
          n.h = Math.max(40, (n.y + n.h) - by);
          n.x = bx;
          n.y = by;
        }
        this.renderer.draw();
        this.updatePanels();
        return;
      }

      if (this.renderer.dragEdge) {
        this.renderer.dragEdge.to = { _px: w.x, _py: w.y };

        const hit = this.renderer.portAt(w, 'in'); // nearest input
        if (hit && this.draggingPort) {
          this.renderer.hoverPort = hit;
          this.renderer.hoverValid = this.validateConnection(this.draggingPort.port, hit.port);
        } else {
          this.renderer.hoverPort = null;
          this.renderer.hoverValid = null;
        }
        this.renderer.draw();
      }

      if (this.renderer.marquee && this.mouse.down && !this.dragNode && !this.dragGroup && !this.dragHandle && !this.renderer.dragEdge && !this.dragMultiple) {
        this.renderer.marquee.w = w.x - this.marqueeStart.x;
        this.renderer.marquee.h = w.y - this.marqueeStart.y;

        const x1 = Math.min(this.marqueeStart.x, w.x);
        const y1 = Math.min(this.marqueeStart.y, w.y);
        const x2 = Math.max(this.marqueeStart.x, w.x);
        const y2 = Math.max(this.marqueeStart.y, w.y);

        const inside = n => n.x >= x1 && n.y >= y1 && (n.x + n.w) <= x2 && (n.y + n.h) <= y2;
        const ids = this.graph.nodes.filter(inside).map(n => n.id);

        this.renderer.selection = new Set(this.marqueeAdd ? [...this.renderer.selection, ...ids] : ids);
        this.updatePanels();
        this.renderer.draw();
        return;
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      const w = this.toWorld(e);

      if (this.renderer.marquee) {
        this.renderer.marquee = null;
        this.marqueeStart = null;
        this.marqueeAdd = false;
        this.renderer.draw();
        this.mouse.down = false;
        return;
      }

      if (this.renderer.dragEdge) {
        const hit = this.renderer.hoverPort || this.renderer.portAt(w, 'in');
        if (hit && this.draggingPort) {
          const from = this.draggingPort.port;
          const to = hit.port;
          if (this.validateConnection(from, to)) {
            this.renderer.dragEdge.to = `${hit.node.id}:${to.name}`;
            this.graph.edges.push(this.renderer.dragEdge);
          }
        }
        this.renderer.dragEdge = null;
        this.draggingPort = null;
        this.renderer.hoverPort = null;
        this.renderer.hoverValid = null;
        this.renderer.draw();
        if (this.tool === 'connector') this.tool = 'select';
        return;
      }

      this.mouse.down = false;
      this.dragNode = null;
      this.dragHandle = null;
      this.dragGroup = null;
      this.dragMultiple = null;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.renderer.dragEdge = null;
      this.draggingPort = null;
      this.renderer.draw();
    });
  }
}
