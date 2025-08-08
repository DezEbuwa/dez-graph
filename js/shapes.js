/***********************
 * Shape registry and definitions
 ***********************/
import { clamp, drawLabel, roundRectPath } from './utils.js';

export const ShapeRegistry = {
  defs: new Map(),
  define(key, def) { 
    this.defs.set(key, def); 
  },
  get(key) { 
    return this.defs.get(key); 
  }
};

// Basic shapes
ShapeRegistry.define('rect', {
  draw(ctx, n) {
    ctx.fillStyle = n.fill;
    ctx.strokeStyle = n.stroke;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.rect(n.x, n.y, n.w, n.h);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, n);
  }
});

ShapeRegistry.define('roundRect', {
  draw(ctx, n) {
    const r = clamp(n.r || 8, 0, Math.min(n.w, n.h) / 2);
    ctx.fillStyle = n.fill;
    ctx.strokeStyle = n.stroke;
    ctx.lineWidth = 1.25;
    roundRectPath(ctx, n.x, n.y, n.w, n.h, r);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, n);
  }
});

ShapeRegistry.define('ellipse', {
  draw(ctx, n) {
    ctx.fillStyle = n.fill;
    ctx.strokeStyle = n.stroke;
    ctx.beginPath();
    ctx.ellipse(n.x + n.w / 2, n.y + n.h / 2, Math.abs(n.w / 2), Math.abs(n.h / 2), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, n);
  }
});

ShapeRegistry.define('circle', {
  draw(ctx, n) {
    const r = Math.max(8, Math.min(n.w, n.h) / 2);
    ctx.fillStyle = n.fill;
    ctx.strokeStyle = n.stroke;
    ctx.beginPath();
    ctx.arc(n.x + n.w / 2, n.y + n.h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, n);
  }
});

// Group container (drawn behind nodes)
ShapeRegistry.define('group', {
  draw(ctx, n) {
    ctx.fillStyle = 'rgba(14,37,51,0.55)';
    ctx.strokeStyle = '#1f4a66';
    roundRectPath(ctx, n.x, n.y, n.w, n.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#98c7e1';
    ctx.font = '12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(n.label || 'Group', n.x + 10, n.y + 8);
  }
});

// Logic node shapes
ShapeRegistry.define('logic:start', {
  draw(ctx, n) {
    ctx.fillStyle = '#153c2e';
    ctx.strokeStyle = '#1d6b52';
    roundRectPath(ctx, n.x, n.y, n.w, n.h, 10);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, { ...n, label: 'Start' });
  }
});

ShapeRegistry.define('logic:add', {
  draw(ctx, n) {
    ctx.fillStyle = '#1f2942';
    ctx.strokeStyle = '#2f4f8a';
    roundRectPath(ctx, n.x, n.y, n.w, n.h, 10);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, { ...n, label: 'Add' });
  }
});

ShapeRegistry.define('logic:mul', {
  draw(ctx, n) {
    ctx.fillStyle = '#2a1f42';
    ctx.strokeStyle = '#6b4fa8';
    roundRectPath(ctx, n.x, n.y, n.w, n.h, 10);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, { ...n, label: 'Multiply' });
  }
});

ShapeRegistry.define('logic:vec3', {
  draw(ctx, n) {
    ctx.fillStyle = '#21323f';
    ctx.strokeStyle = '#3a5f7a';
    roundRectPath(ctx, n.x, n.y, n.w, n.h, 10);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, { ...n, label: 'Vec3' });
  }
});

ShapeRegistry.define('logic:dot', {
  draw(ctx, n) {
    ctx.fillStyle = '#32243b';
    ctx.strokeStyle = '#6b4f8a';
    roundRectPath(ctx, n.x, n.y, n.w, n.h, 10);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, { ...n, label: 'Dot' });
  }
});

ShapeRegistry.define('logic:length', {
  draw(ctx, n) {
    ctx.fillStyle = '#243b2f';
    ctx.strokeStyle = '#3f7a5d';
    roundRectPath(ctx, n.x, n.y, n.w, n.h, 10);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, { ...n, label: 'Length' });
  }
});

ShapeRegistry.define('logic:print', {
  draw(ctx, n) {
    ctx.fillStyle = '#33261f';
    ctx.strokeStyle = '#8a5f2f';
    roundRectPath(ctx, n.x, n.y, n.w, n.h, 10);
    ctx.fill();
    ctx.stroke();
    drawLabel(ctx, { ...n, label: 'Print' });
  }
});
