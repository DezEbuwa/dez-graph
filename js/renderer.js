/***********************
 * Renderer class
 ***********************/
import { Viewport } from './models.js';
import { ShapeRegistry } from './shapes.js';
import { dist2 } from './utils.js';

export class Renderer {
  constructor(canvas, graph) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.graph = graph;
    this.viewport = new Viewport();
    this.selection = new Set();
    this.hoverPort = null;
    this.dragEdge = null;
    this.handles = [];
    this.hoverValid = null;
    this.marquee = null;
  }

  resize() {
    this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    this.draw();
  }

  clear() {
    const c = this.canvas;
    this.ctx.clearRect(0, 0, c.width, c.height);
  }

  drawGrid() {
    const { ctx } = this;
    const s = this.viewport.scale;
    const step = 16 * s;
    
    ctx.save();
    ctx.translate(this.viewport.tx % step, this.viewport.ty % step);
    ctx.strokeStyle = 'rgba(108,122,144,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let x = 0; x < this.canvas.width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
    }
    
    for (let y = 0; y < this.canvas.height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
    }
    
    ctx.stroke();
    ctx.restore();
  }

  draw() {
    this.clear();
    this.drawGrid();
    
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.viewport.tx, this.viewport.ty);
    ctx.scale(this.viewport.scale, this.viewport.scale);
    
    // Draw groups first (behind everything)
    for (const g of this.graph.nodes.filter(n => n.isGroup)) {
      this.drawNode(g);
    }
    
    // Draw edges
    for (const e of this.graph.edges) {
      this.drawEdge(e);
    }
    
    // Draw nodes
    for (const n of this.graph.nodes) {
      if (!n.isGroup) this.drawNode(n);
    }
    
    // Draw drag edge if present
    if (this.dragEdge) {
      this.drawEdge(this.dragEdge, true, this.hoverValid);
    }
    
    // Draw selection handles
    for (const n of this.graph.nodes) {
      if (this.selection.has(n.id)) this.drawSelection(n);
    }
    
    // Draw marquee if present
    if (this.marquee) this.drawMarquee(this.marquee);
    
    ctx.restore();
  }

  drawNode(n) {
    const def = ShapeRegistry.get(n.kind) || ShapeRegistry.get('rect');
    def.draw(this.ctx, n);
    this.drawPorts(n);
  }

  drawPorts(n) {
    if (n.isGroup) return;
    
    const { ctx } = this;
    const ports = n.ports || [];
    const left = ports.filter(p => p.direction === 'in');
    const right = ports.filter(p => p.direction === 'out');
    const spacing = n.h / (Math.max(1, left.length) - 0 + 1);
    
    // Draw input ports (left side)
    left.forEach((p, i) => {
      const y = n.y + spacing * (i + 1);
      const x = n.x - 6;
      ctx.fillStyle = p.isExec ? '#a78bfa' : '#6ee7ff';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      p._px = x;
      p._py = y;
      
      const isHover = this.hoverPort && this.hoverPort.port === p;
      if (isHover) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.hoverValid ? '#34d399' : '#ff6b6b';
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    
    // Draw output ports (right side)
    const rspacing = n.h / (Math.max(1, right.length) - 0 + 1);
    right.forEach((p, i) => {
      const y = n.y + rspacing * (i + 1);
      const x = n.x + n.w + 6;
      ctx.fillStyle = p.isExec ? '#a78bfa' : '#6ee7ff';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      p._px = x;
      p._py = y;
      
      const isHover = this.hoverPort && this.hoverPort.port === p;
      if (isHover) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.hoverValid ? '#34d399' : '#ff6b6b';
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  drawEdge(e, temp = false, highlightOk = null) {
    const { ctx } = this;
    const from = this.findPort(e.from);
    const to = temp ? e.to : this.findPort(e.to);
    if (!from || !to) return;

    const a = { x: from._px, y: from._py };
    const b = { x: to._px, y: to._py };
    const mx = (a.x + b.x) / 2;

    let color = e.isExec ? '#a78bfa' : '#6ee7ff';
    if (temp && highlightOk != null) {
      color = highlightOk ? '#34d399' : '#ff6b6b';
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = e.isExec ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y);
    ctx.stroke();
  }

  drawSelection(n) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = '#5eead4';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(n.x - 6, n.y - 6, n.w + 12, n.h + 12);
    ctx.restore();
    
    const hs = [
      { x: n.x - 8, y: n.y - 8, c: 'nw' },
      { x: n.x + n.w - 8, y: n.y - 8, c: 'ne' },
      { x: n.x - 8, y: n.y + n.h - 8, c: 'sw' },
      { x: n.x + n.w - 8, y: n.y + n.h - 8, c: 'se' }
    ];
    
    this.handles = hs.map(h => ({ ...h, node: n }));
    
    for (const h of this.handles) {
      this.ctx.fillStyle = '#5eead4';
      this.ctx.fillRect(h.x, h.y, 16, 16);
    }
  }

  drawMarquee(m) {
    const { ctx } = this;
    const x = Math.min(m.x, m.x + m.w);
    const y = Math.min(m.y, m.y + m.h);
    const w = Math.abs(m.w);
    const h = Math.abs(m.h);
    
    ctx.save();
    ctx.fillStyle = 'rgba(94,234,212,0.08)';
    ctx.strokeStyle = '#5eead4';
    ctx.setLineDash([4, 3]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  findPort(ref) {
    if (!ref || typeof ref !== 'string') return null;
    const [nodeId, name] = ref.split(':');
    const n = this.graph.nodes.find(n => n.id === nodeId);
    return n?.ports.find(p => p.name === name);
  }

  portAt(world, want) {
    let best = null;
    let bestd = 9e9;
    
    for (const n of this.graph.nodes) {
      if (n.isGroup) continue;
      for (const p of (n.ports || [])) {
        if (want && p.direction !== want) continue;
        if (p._px == null) continue;
        const d = dist2({ x: p._px, y: p._py }, world);
        if (d < bestd) {
          best = { node: n, port: p };
          bestd = d;
        }
      }
    }
    
    return (bestd <= 100) ? best : null;
  }
}
