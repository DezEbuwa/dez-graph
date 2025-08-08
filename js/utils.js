/***********************
 * Math & utilities
 ***********************/

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const dist2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const uid = (() => {
  let i = 1;
  return (prefix = 'id') => `${prefix}_${i++}`;
})();

// Drawing utility functions
export function drawLabel(ctx, n) {
  ctx.fillStyle = '#d9e1f2';
  ctx.font = '12px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(n.label || n.kind, n.x + n.w / 2, n.y + n.h / 2);
}

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Hit testing functions
export function pointInNode(p, n) {
  return p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + n.h;
}

export function hitNode(p, graph) {
  for (let i = graph.nodes.length - 1; i >= 0; i--) {
    const n = graph.nodes[i];
    if (pointInNode(p, n)) return n;
  }
  return null;
}

export function hitHandle(p, handles) {
  return handles.find(h => 
    p.x >= h.x && p.x <= h.x + 16 && p.y >= h.y && p.y <= h.y + 16
  );
}
