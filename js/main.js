/***********************
   * Math & helpers
   ***********************/
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const dist2 = (a,b)=>{ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; };
  const uid = (()=>{ let i=1; return (p='id')=>`${p}_${i++}`; })();

  /***********************
   * Model types
   ***********************/
  class Port { constructor(id, nodeId, name, type='number', direction='in', isExec=false){ Object.assign(this, { id, nodeId, name, type, direction, isExec }); } }
  class Node {
    constructor({ id=uid('node'), x=0, y=0, w=160, h=70, r=8, kind='rect', label='Node', fill='#1e2636', stroke='#2f3a52', ports=[], isGroup=false, members=[] }){
      Object.assign(this, { id, x, y, w, h, r, kind, label, fill, stroke, isGroup, members });
      this.ports = ports; // array<Port>
      this.data = {};     // outputs + default input values by name
    }
    get bounds(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }
  }
  class Edge { constructor({ id=uid('edge'), from, to, isExec=false }){ Object.assign(this, { id, from, to, isExec }); } }
  class Graph { constructor(){ this.nodes=[]; this.edges=[]; }
    toJSON(){ return JSON.stringify({ nodes:this.nodes, edges:this.edges }, null, 2); }
    static fromJSON(json){ const g=new Graph(); const o=JSON.parse(json); g.nodes=o.nodes.map(n=>Object.assign(new Node({}), n)); g.edges=o.edges.map(e=>Object.assign(new Edge({}), e)); return g; }
  }

  /***********************
   * Shape registry (extend me)
   ***********************/
  const ShapeRegistry = {
    defs: new Map(),
    define(key, def){ this.defs.set(key, def); },
    get(key){ return this.defs.get(key); }
  };

  // Basic shapes
  ShapeRegistry.define('rect', { draw(ctx, n){
    ctx.fillStyle=n.fill; ctx.strokeStyle=n.stroke; ctx.lineWidth=1.25;
    ctx.beginPath(); ctx.rect(n.x, n.y, n.w, n.h); ctx.fill(); ctx.stroke();
    drawLabel(ctx,n);
  }});
  ShapeRegistry.define('roundRect', { draw(ctx, n){
    const r = clamp(n.r||8, 0, Math.min(n.w,n.h)/2);
    ctx.fillStyle=n.fill; ctx.strokeStyle=n.stroke; ctx.lineWidth=1.25;
    roundRectPath(ctx, n.x, n.y, n.w, n.h, r); ctx.fill(); ctx.stroke(); drawLabel(ctx,n);
  }});
  ShapeRegistry.define('ellipse', { draw(ctx, n){
    ctx.fillStyle=n.fill; ctx.strokeStyle=n.stroke; ctx.beginPath();
    ctx.ellipse(n.x+n.w/2, n.y+n.h/2, Math.abs(n.w/2), Math.abs(n.h/2), 0, 0, Math.PI*2);
    ctx.fill(); ctx.stroke(); drawLabel(ctx,n);
  }});
  ShapeRegistry.define('circle', { draw(ctx, n){
    const r = Math.max(8, Math.min(n.w, n.h)/2);
    ctx.fillStyle=n.fill; ctx.strokeStyle=n.stroke; ctx.beginPath();
    ctx.arc(n.x+n.w/2, n.y+n.h/2, r, 0, Math.PI*2);
    ctx.fill(); ctx.stroke(); drawLabel(ctx,n);
  }});

  // Group container (drawn behind nodes)
  ShapeRegistry.define('group', { draw(ctx,n){
    ctx.fillStyle = 'rgba(14,37,51,0.55)';
    ctx.strokeStyle = '#1f4a66';
    roundRectPath(ctx, n.x, n.y, n.w, n.h, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#98c7e1'; ctx.font='12px ui-monospace, monospace'; ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(n.label || 'Group', n.x + 10, n.y + 8);
  }});

  function drawLabel(ctx,n){
    ctx.fillStyle = '#d9e1f2';
    ctx.font = '12px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline='middle';
    ctx.fillText(n.label || n.kind, n.x + n.w/2, n.y + n.h/2);
  }
  function roundRectPath(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  /***********************
   * Rendering & viewport
   ***********************/
  class Viewport {
    constructor(){ this.tx=0; this.ty=0; this.scale=1; }
    toWorld(p){ return { x: (p.x - this.tx)/this.scale, y: (p.y - this.ty)/this.scale }; }
    fromWorld(p){ return { x: p.x*this.scale + this.tx, y: p.y*this.scale + this.ty }; }
  }

  class Renderer {
    constructor(canvas, graph){ 
      this.canvas=canvas; 
      this.ctx=canvas.getContext('2d'); 
      this.graph=graph; 
      this.viewport=new Viewport(); 
      this.selection=new Set(); 
      this.hoverPort=null; 
      this.dragEdge=null; 
      this.handles=[]; 
      this.hoverPort = null;
      this.hoverValid = null;
      this.marquee = null;
    }
    resize(){ this.canvas.width = this.canvas.clientWidth * devicePixelRatio; this.canvas.height = this.canvas.clientHeight * devicePixelRatio; this.ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); this.draw(); }
    clear(){ const c=this.canvas; this.ctx.clearRect(0,0,c.width,c.height); }
    drawGrid(){ const {ctx}=this; const s=this.viewport.scale; const step= 16*s; ctx.save();
      ctx.translate(this.viewport.tx%step, this.viewport.ty%step);
      ctx.strokeStyle = 'rgba(108,122,144,0.18)'; ctx.lineWidth=1; ctx.beginPath();
      for(let x=0;x<this.canvas.width;x+=step){ ctx.moveTo(x,0); ctx.lineTo(x,this.canvas.height); }
      for(let y=0;y<this.canvas.height;y+=step){ ctx.moveTo(0,y); ctx.lineTo(this.canvas.width,y); }
      ctx.stroke(); ctx.restore(); }
    draw(){ this.clear(); this.drawGrid();
      const {ctx} = this;
      ctx.save();
      ctx.translate(this.viewport.tx, this.viewport.ty);
      ctx.scale(this.viewport.scale, this.viewport.scale);
      for(const g of this.graph.nodes.filter(n=>n.isGroup)) this.drawNode(g);
      for(const e of this.graph.edges){ this.drawEdge(e); }
      for(const n of this.graph.nodes){ if(!n.isGroup) this.drawNode(n); }
      if(this.dragEdge){ this.drawEdge(this.dragEdge, true, this.hoverValid); }
      for(const n of this.graph.nodes){ if(this.selection.has(n.id)) this.drawSelection(n); }
      if (this.marquee) this.drawMarquee(this.marquee);
      ctx.restore();
    }
    drawNode(n){ const def = ShapeRegistry.get(n.kind) || ShapeRegistry.get('rect'); def.draw(this.ctx, n); this.drawPorts(n); }
    drawPorts(n){ 
      if(n.isGroup) return; 
      const {ctx}=this; 
      const ports=n.ports||[]; 
      const left=ports.filter(p=>p.direction==='in'); 
      const right=ports.filter(p=>p.direction==='out');
      const spacing = n.h / (Math.max(1,left.length)-0+1);
      
      left.forEach((p,i)=>{ 
        const y=n.y + spacing*(i+1); 
        const x=n.x - 6; 
        ctx.fillStyle=p.isExec?'#a78bfa':'#6ee7ff'; 
        ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); 
        ctx.fill(); p._px=x; p._py=y; 
        const isHover = this.hoverPort && this.hoverPort.port === p;
        if (isHover) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = this.hoverValid ? '#34d399' : '#ff6b6b';
          ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.stroke();
        }
      });
      const rspacing = n.h / (Math.max(1,right.length)-0+1);
      right.forEach((p,i)=>{ 
        const y=n.y + rspacing*(i+1); 
        const x=n.x + n.w + 6; 
        ctx.fillStyle=p.isExec?'#a78bfa':'#6ee7ff'; 
        ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); 
        ctx.fill(); p._px=x; p._py=y;
        const isHover = this.hoverPort && this.hoverPort.port === p;
        if (isHover) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = this.hoverValid ? '#34d399' : '#ff6b6b';
          ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.stroke();
        } 
      });
    }
    drawEdge(e, temp=false, highlightOk=null) {
      const {ctx}=this;
      const from = findPort(e.from);
      const to   = temp ? e.to : findPort(e.to);
      if (!from || !to) return;

      const a={x:from._px,y:from._py}, b={x:to._px,y:to._py};
      const mx=(a.x+b.x)/2;

      let color = e.isExec ? '#a78bfa' : '#6ee7ff';
      if (temp && highlightOk != null) color = highlightOk ? '#34d399' : '#ff6b6b';

      ctx.strokeStyle = color;
      ctx.lineWidth = e.isExec ? 2 : 1.5;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.bezierCurveTo(mx,a.y, mx,b.y, b.x,b.y); ctx.stroke();
    }
    drawSelection(n){ const {ctx}=this; ctx.save(); ctx.strokeStyle = '#5eead4'; ctx.setLineDash([6,4]); ctx.strokeRect(n.x-6, n.y-6, n.w+12, n.h+12); ctx.restore();
      const hs=[ {x:n.x-8,y:n.y-8,c:'nw'}, {x:n.x+n.w-8,y:n.y-8,c:'ne'}, {x:n.x-8,y:n.y+n.h-8,c:'sw'}, {x:n.x+n.w-8,y:n.y+n.h-8,c:'se'} ];
      this.handles = hs.map(h=>({ ...h, node:n }));
      for(const h of this.handles){ this.ctx.fillStyle='#5eead4'; this.ctx.fillRect(h.x,h.y,16,16); }
    }
    drawMarquee(m) {
      const {ctx}=this;
      const x=Math.min(m.x, m.x+m.w), y=Math.min(m.y, m.y+m.h);
      const w=Math.abs(m.w), h=Math.abs(m.h);
      ctx.save();
      ctx.fillStyle='rgba(94,234,212,0.08)';
      ctx.strokeStyle='#5eead4';
      ctx.setLineDash([4,3]);
      ctx.fillRect(x,y,w,h);
      ctx.strokeRect(x,y,w,h);
      ctx.restore();
    }
  }

  /***********************
   * Hit-testing & helpers
   ***********************/
  function pointInNode(p, n){ return p.x>=n.x && p.x<=n.x+n.w && p.y>=n.y && p.y<=n.y+n.h; }
  function hitNode(p, graph){ for(let i=graph.nodes.length-1;i>=0;i--){ const n=graph.nodes[i]; if(pointInNode(p,n)) return n; } return null; }
  function hitHandle(p, handles){ return handles.find(h=> p.x>=h.x && p.x<=h.x+16 && p.y>=h.y && p.y<=h.y+16 ); }
  function findPort(ref){ if(!ref || typeof ref!=='string') return null; const [nodeId, name] = ref.split(':'); const n = graph.nodes.find(n=>n.id===nodeId); return n?.ports.find(p=>p.name===name); }
  function portAt(world, want){ let best=null, bestd=9e9; for(const n of graph.nodes){ if(n.isGroup) continue; for(const p of (n.ports||[])){ if(want && p.direction!==want) continue; if(p._px==null) continue; const d=dist2({x:p._px,y:p._py}, world); if(d<bestd){ best={node:n, port:p}; bestd=d; } } } return (bestd<=100)?best:null; }

  /***********************
   * Logic (Blueprint-style) runtime
   ***********************/
  const Logic = {
    registry: new Map(),
    define(type, fn){ this.registry.set(type, fn); },
    async run(graph, debug){
      debug('▶ Running graph...');
      const byNode = new Map(graph.nodes.map(n=>[n.id,n]));
      const execOut = new Map(); const dataIn = new Map();
      for(const e of graph.edges){
        if(e.isExec){ const [from] = e.from.split(':'); (execOut.get(from)||execOut.set(from,[]).get(from)).push(e); }
        else { (dataIn.get(e.to)||dataIn.set(e.to,[]).get(e.to)).push(e); }
      }
      const starts = graph.nodes.filter(n=>n.kind==='logic:start');
      for(const start of starts){ await step(start.id); }

      async function step(nodeId){
        const node = byNode.get(nodeId); if(!node) return;
        const inputs = {};
        for(const p of node.ports.filter(p=>p.direction==='in' && !p.isExec)){
          const key = `${node.id}:${p.name}`; const incoming = dataIn.get(key)||[];
          if(incoming.length){ const src = incoming[incoming.length-1].from; const [srcNode, srcPort] = src.split(':'); const n = byNode.get(srcNode); inputs[p.name] = n?.data[srcPort]; }
          else inputs[p.name] = node.data[p.name];
        }
        const impl = Logic.registry.get(node.kind);
        const outputs = impl ? await impl(node, inputs, { log:debug }) : {};
        for(const p of node.ports.filter(p=>p.direction==='out' && !p.isExec)){
          if(outputs && p.name in outputs) node.data[p.name] = outputs[p.name];
        }
        const outs = execOut.get(node.id)||[]; for(const e of outs){ const toNodeId = e.to.split(':')[0]; await step(toNodeId); }
      }
    }
  };

  // Built-in logic nodes & port helpers
  const logicPorts = {
    execIn: ()=> new Port(uid('p'), null, 'in', 'exec', 'in', true),
    execOut: ()=> new Port(uid('p'), null, 'out', 'exec', 'out', true),
    in: (name,type)=> new Port(uid('p'), null, name, type, 'in', false),
    out: (name,type)=> new Port(uid('p'), null, name, type, 'out', false)
  };

  ShapeRegistry.define('logic:start', { draw(ctx,n){ ctx.fillStyle = '#153c2e'; ctx.strokeStyle='#1d6b52'; roundRectPath(ctx, n.x, n.y, n.w, n.h, 10); ctx.fill(); ctx.stroke(); drawLabel(ctx, {...n, label:'Start'}); }});
  ShapeRegistry.define('logic:add', { draw(ctx,n){ ctx.fillStyle='#1f2942'; ctx.strokeStyle='#2f4f8a'; roundRectPath(ctx,n.x,n.y,n.w,n.h,10); ctx.fill(); ctx.stroke(); drawLabel(ctx,{...n,label:'Add'}); }});
  ShapeRegistry.define('logic:mul', { draw(ctx,n){ ctx.fillStyle='#2a1f42'; ctx.strokeStyle='#6b4fa8'; roundRectPath(ctx,n.x,n.y,n.w,n.h,10); ctx.fill(); ctx.stroke(); drawLabel(ctx,{...n,label:'Multiply'}); }});
  ShapeRegistry.define('logic:vec3', { draw(ctx,n){ ctx.fillStyle='#21323f'; ctx.strokeStyle='#3a5f7a'; roundRectPath(ctx,n.x,n.y,n.w,n.h,10); ctx.fill(); ctx.stroke(); drawLabel(ctx,{...n,label:'Vec3'}); }});
  ShapeRegistry.define('logic:dot', { draw(ctx,n){ ctx.fillStyle='#32243b'; ctx.strokeStyle='#6b4f8a'; roundRectPath(ctx,n.x,n.y,n.w,n.h,10); ctx.fill(); ctx.stroke(); drawLabel(ctx,{...n,label:'Dot'}); }});
  ShapeRegistry.define('logic:length', { draw(ctx,n){ ctx.fillStyle='#243b2f'; ctx.strokeStyle='#3f7a5d'; roundRectPath(ctx,n.x,n.y,n.w,n.h,10); ctx.fill(); ctx.stroke(); drawLabel(ctx,{...n,label:'Length'}); }});
  ShapeRegistry.define('logic:print', { draw(ctx,n){ ctx.fillStyle='#33261f'; ctx.strokeStyle='#8a5f2f'; roundRectPath(ctx,n.x,n.y,n.w,n.h,10); ctx.fill(); ctx.stroke(); drawLabel(ctx,{...n,label:'Print'}); }});

  // Evaluators (can pass numbers, strings, objects)
  Logic.define('logic:add', (node, i, {log})=>{ const a=Number(i.a ?? 0), b=Number(i.b ?? 0); const out=a+b; log(`Add: ${a}+${b}=${out}`); return { out }; });
  Logic.define('logic:mul', (node, i, {log})=>{ const a=Number(i.a ?? 0), b=Number(i.b ?? 0); const out=a*b; log(`Mul: ${a}*${b}=${out}`); return { out }; });
  Logic.define('logic:vec3', (node, i, {log})=>{ const v={ x:Number(i.x ?? 0), y:Number(i.y ?? 0), z:Number(i.z ?? 0) }; log(`Vec3: (${v.x}, ${v.y}, ${v.z})`); return { v }; });
  Logic.define('logic:dot', (node, i, {log})=>{ const a=i.a||{x:0,y:0,z:0}, b=i.b||{x:0,y:0,z:0}; const out=a.x*b.x + a.y*b.y + a.z*b.z; log(`Dot: ⟨a,b⟩=${out}`); return { out }; });
  Logic.define('logic:length', (node, i, {log})=>{ const a=i.a||{x:0,y:0,z:0}; const out=Math.hypot(a.x||0,a.y||0,a.z||0); log(`Length: ∥a∥=${out}`); return { out }; });
  Logic.define('logic:print', (node, i, {log})=>{ let v=i.in; if(typeof v==='object') v=JSON.stringify(v); log(`Print: ${v}`); return {}; });
  Logic.define('logic:start', ()=>({}));

  function makeLogicNode(kind, x, y){
    const n = new Node({ kind, x, y, w:170, h:80, label:kind.split(':')[1] });
    if(kind==='logic:start'){
      n.ports = [ logicPorts.execOut() ]; n.ports[0].nodeId=n.id; n.ports[0].name='out';
    } else if(kind==='logic:add' || kind==='logic:mul'){
      n.ports = [ logicPorts.execIn(), logicPorts.execOut(), logicPorts.in('a','number'), logicPorts.in('b','number'), logicPorts.out('out','number') ];
      n.ports.forEach(p=>p.nodeId=n.id); n.data.a = 1; n.data.b = 1;
    } else if(kind==='logic:vec3'){
      n.ports = [ logicPorts.in('x','number'), logicPorts.in('y','number'), logicPorts.in('z','number'), logicPorts.out('v','vector3') ];
      n.ports.forEach(p=>p.nodeId=n.id); n.data.x=0; n.data.y=0; n.data.z=0;
    } else if(kind==='logic:dot'){
      n.ports = [ logicPorts.execIn(), logicPorts.execOut(), logicPorts.in('a','vector3'), logicPorts.in('b','vector3'), logicPorts.out('out','number') ];
      n.ports.forEach(p=>p.nodeId=n.id);
    } else if(kind==='logic:length'){
      n.ports = [ logicPorts.in('a','vector3'), logicPorts.out('out','number') ]; n.ports.forEach(p=>p.nodeId=n.id);
    } else if(kind==='logic:print'){
      n.ports = [ logicPorts.execIn(), logicPorts.in('in','any') ]; n.ports.forEach(p=>p.nodeId=n.id);
    }

    /*

    *** If your node is data-only (no exec), don’t try to wire Start to it.


    else if (kind === 'logic:myNode') {
      n.ports = [
        logicPorts.execIn(),        // ← accepts Start.out (exec)
        logicPorts.execOut(),       // optional but typical to continue flow
        logicPorts.in('a','number'),
        logicPorts.out('out','number')
      ];
      n.ports.forEach(p=>p.nodeId=n.id);
    }
    */
    return n;
  }

  /***********************
   * Editor state & input
   ***********************/
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const graph = new Graph();
  const R = new Renderer(canvas, graph);
  const propsPane = document.getElementById('props');
  const portsPane = document.getElementById('ports');
  const debugPane = document.getElementById('debug');
  const log = (s)=>{ debugPane.textContent += `${s}`; debugPane.scrollTop = debugPane.scrollHeight; };
  const debug = (s)=> log(s);

  // marquee
  let marqueeStart = null;
  let marqueeAdd = false;

  // Tools
  let tool = 'select';

  // Mouse state
  let mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, button: 0 };
  let isPanning = false;
  let dragStart = null;
  let dragNode = null;
  let dragHandle = null;
  let dragGroup = null;
  let draggingPort = null;
  let dragMultiple = null;

  const toWorld = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left);
    const y = (evt.clientY - rect.top);
    const w = R.viewport.toWorld({ x, y });
    mouse.x = x;
    mouse.y = y;
    mouse.wx = w.x;
    mouse.wy = w.y;
    return w;
  };

  const setSelection = (n, additive = false) => {
    if (!additive) R.selection.clear();
    if (n) {
      if (R.selection.has(n.id) && additive) {
        R.selection.delete(n.id);
      } else {
        R.selection.add(n.id);
      }
    }
    updatePanels();
    R.draw();
  };

  const updatePanels = () => {
    if (R.selection.size >= 1) {
      const id = [...R.selection][R.selection.size - 1];
      const n = graph.nodes.find(n => n.id === id);
      if (!n) {
        propsPane.textContent = 'No selection';
        return;
      }

      propsPane.innerHTML = '';
      propsPane.appendChild(row('Label', input(n.label, v => {
        n.label = v;
        R.draw();
      })));
      propsPane.appendChild(row('X', input(n.x, v => {
        n.x = Number(v);
        R.draw();
      }, 'number')));
      propsPane.appendChild(row('Y', input(n.y, v => {
        n.y = Number(v);
        R.draw();
      }, 'number')));
      propsPane.appendChild(row('W', input(n.w, v => {
        n.w = Number(v);
        R.draw();
      }, 'number')));
      propsPane.appendChild(row('H', input(n.h, v => {
        n.h = Number(v);
        R.draw();
      }, 'number')));

      if (n.kind === 'roundRect') {
        propsPane.appendChild(row('Radius', input(n.r || 8, v => {
          n.r = Number(v);
          R.draw();
        }, 'number')));
      }

      if (n.isGroup) {
        propsPane.appendChild(row('Members', text(n.members.join(', '))));
      }

      // Inputs (editable when not connected)
      const inPorts = (n.ports || []).filter(p => !p.isExec && p.direction === 'in');
      if (inPorts.length) {
        propsPane.appendChild(sectionTitle('Inputs'));
        inPorts.forEach(p => {
          const connected = isDataConnected(n.id, p.name);
          const current = getPortValue(n, p);
          const editor = portEditor(p, current, val => setPortValue(n, p, val));
          if (connected) {
            editor.disabled = true;
            editor.title = 'Value comes from connection';
          }
          propsPane.appendChild(row(`${p.name} : ${p.type}${connected ? ' (connected)' : ''}`, editor));
        });
      }

      // Outputs (read-only)
      const outPorts = (n.ports || []).filter(p => !p.isExec && p.direction === 'out');
      if (outPorts.length) {
        propsPane.appendChild(sectionTitle('Outputs'));
        outPorts.forEach(p => {
          const v = n.kind.startsWith('logic:') ? n.data[p.name] : (p.value ?? '');
          const displayValue = v == null ? '(run to update)' : (typeof v === 'object' ? JSON.stringify(v) : v);
          propsPane.appendChild(row(`${p.name} : ${p.type}`, readOnly(String(displayValue))));
        });
      }

      // Ports summary
      portsPane.innerHTML = '';
      const ports = n.ports || [];
      if (!ports.length) {
        portsPane.textContent = n.isGroup ? '(group container)' : '(no ports)';
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
      portsPane.appendChild(list);
    } else {
      propsPane.textContent = 'No selection';
      portsPane.textContent = 'No selection';
    }
  };

  const row = (label, control) => {
    const d = document.createElement('div');
    d.className = 'prop-row';
    const l = document.createElement('div');
    l.textContent = label;
    d.append(l, control);
    return d;
  };

  const input = (value, oninput, type = 'text') => {
    const i = document.createElement('input');
    i.type = type;
    i.value = value;
    i.oninput = () => oninput(i.value);
    return i;
  };

  const text = (value) => {
    const i = document.createElement('div');
    i.textContent = value;
    return i;
  };

  const readOnly = (value) => {
    const i = document.createElement('div');
    i.className = 'kbd';
    i.textContent = value;
    return i;
  };

  const sectionTitle = (txt) => {
    const h = document.createElement('h3');
    h.textContent = txt;
    return h;
  };

  const portEditor = (p, value, onChange) => {
    if (p.type === 'number') {
      return input(value ?? 0, v => onChange(Number(v)), 'number');
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
    return input(value ?? '', onChange, 'text');
  };

  const isDataConnected = (nodeId, portName) => 
    graph.edges.some(e => !e.isExec && typeof e.to === 'string' && e.to === `${nodeId}:${portName}`);

  const getPortValue = (n, p) => 
    n.kind.startsWith('logic:') ? n.data[p.name] : p.value;

  const setPortValue = (n, p, val) => {
    if (n.kind.startsWith('logic:')) {
      n.data[p.name] = val;
    } else {
      p.value = val;
    }
    R.draw();
  };

  // Resize behavior
  const resizeObs = new ResizeObserver(() => R.resize());
  resizeObs.observe(canvas);

  // Wheel zoom (cursor-centric)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const mx = mouse.x, my = mouse.y;
    const before = R.viewport.toWorld({ x: mx, y: my });
    const scale = clamp(R.viewport.scale * (1 + (-Math.sign(e.deltaY) * 0.1)), 0.2, 3);
    R.viewport.scale = scale;
    R.viewport.tx = mx - before.x * scale;
    R.viewport.ty = my - before.y * scale;
    R.draw();
  }, { passive: false });

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      isPanning = true;
    }
    if (e.key === 'Delete' && R.selection.size) {
      const ids = new Set(R.selection);
      graph.nodes = graph.nodes.filter(n => !ids.has(n.id));
      graph.edges = graph.edges.filter(e => {
        const f = typeof e.from === 'string' ? e.from.split(':')[0] : null;
        const t = typeof e.to === 'string' ? e.to.split(':')[0] : null;
        return !ids.has(f) && !ids.has(t);
      });
      R.selection.clear();
      updatePanels();
      R.draw();
    }
    if (e.key.toLowerCase() === 'v') tool = 'select';
    if (e.key.toLowerCase() === 'g') groupSelection();
    if (e.key === 'Escape') {
      R.dragEdge = null;
      draggingPort = null;
      tool = 'select';
      R.draw();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isPanning = false;
    }
  });

  // Mouse interactions
  canvas.addEventListener('mousedown', (e) => {
    const w = toWorld(e);
    mouse.down = true;
    mouse.button = e.button;
    
    if (isPanning || e.button === 1) {
      dragStart = { x: mouse.x, y: mouse.y };
      return;
    }

    if (tool === 'connector') {
      const hit = portAt(w, 'out');
      if (!hit) return;
      draggingPort = hit;
      R.dragEdge = new Edge({
        from: `${hit.node.id}:${hit.port.name}`,
        to: { _px: w.x, _py: w.y },
        isExec: hit.port.isExec
      });
      return;
    }

    if (tool === 'select') {
      const portHit = portAt(w, 'out');
      if (portHit && dist2({ x: portHit.port._px, y: portHit.port._py }, w) < 100) {
        draggingPort = portHit;
        R.dragEdge = new Edge({
          from: `${portHit.node.id}:${portHit.port.name}`,
          to: { _px: w.x, _py: w.y },
          isExec: portHit.port.isExec
        });
        return;
      }

      const h = hitHandle({ x: w.x, y: w.y }, R.handles);
      if (h) {
        dragHandle = h;
        return;
      }

      const n = hitNode(w, graph);
      if (n) {
        // If clicking on a node that's already selected and we have multiple selections, start multi-drag
        if (R.selection.has(n.id) && R.selection.size > 1) {
          const selectedNodes = [...R.selection].map(id => graph.nodes.find(node => node.id === id)).filter(Boolean);
          dragMultiple = {
            nodes: selectedNodes,
            startPositions: selectedNodes.map(node => ({ id: node.id, x: node.x, y: node.y })),
            dx: w.x - n.x,
            dy: w.y - n.y
          };
          return;
        }
        
        setSelection(n, e.shiftKey);
        
        if (n.isGroup) {
          dragGroup = { node: n, dx: w.x - n.x, dy: w.y - n.y };
          return;
        }
        
        dragNode = { node: n, dx: w.x - n.x, dy: w.y - n.y };
        return;
      }

      // Start marquee selection
      marqueeStart = w;
      marqueeAdd = e.shiftKey;
      R.marquee = { x: w.x, y: w.y, w: 0, h: 0 };
    }
  });
  canvas.addEventListener('mousemove', (e) => {
    const w = toWorld(e);
    
    if (isPanning && mouse.down) {
      R.viewport.tx += (mouse.x - (dragStart?.x || mouse.x));
      R.viewport.ty += (mouse.y - (dragStart?.y || mouse.y));
      dragStart = { x: mouse.x, y: mouse.y };
      R.draw();
      return;
    }

    if (dragMultiple && mouse.down) {
      const dx = w.x - dragMultiple.dx;
      const dy = w.y - dragMultiple.dy;
      
      // Calculate the offset from the original click position
      const offsetX = dx - dragMultiple.startPositions[0].x;
      const offsetY = dy - dragMultiple.startPositions[0].y;
      
      dragMultiple.nodes.forEach((node, i) => {
        const start = dragMultiple.startPositions[i];
        node.x = start.x + offsetX;
        node.y = start.y + offsetY;
      });
      
      R.draw();
      updatePanels();
      return;
    }

    if (dragGroup && mouse.down) {
      const g = dragGroup.node;
      const nx = w.x - dragGroup.dx;
      const ny = w.y - dragGroup.dy;
      const dx = nx - g.x;
      const dy = ny - g.y;
      g.x = nx;
      g.y = ny;
      
      for (const id of g.members) {
        const child = graph.nodes.find(n => n.id === id);
        if (child) {
          child.x += dx;
          child.y += dy;
        }
      }
      
      R.draw();
      updatePanels();
      return;
    }

    if (dragNode && mouse.down) {
      const n = dragNode.node;
      n.x = w.x - dragNode.dx;
      n.y = w.y - dragNode.dy;
      R.draw();
      updatePanels();
      return;
    }

    if (dragHandle && mouse.down) {
      const n = dragHandle.node;
      if (dragHandle.c === 'se') {
        n.w = Math.max(40, w.x - n.x);
        n.h = Math.max(40, w.y - n.y);
      }
      if (dragHandle.c === 'ne') {
        n.w = Math.max(40, w.x - n.x);
        const by = w.y;
        n.h = Math.max(40, (n.y + n.h) - by);
        n.y = by;
      }
      if (dragHandle.c === 'sw') {
        n.h = Math.max(40, w.y - n.y);
        const bx = w.x;
        n.w = Math.max(40, (n.x + n.w) - bx);
        n.x = bx;
      }
      if (dragHandle.c === 'nw') {
        const bx = w.x, by = w.y;
        n.w = Math.max(40, (n.x + n.w) - bx);
        n.h = Math.max(40, (n.y + n.h) - by);
        n.x = bx;
        n.y = by;
      }
      R.draw();
      updatePanels();
      return;
    }

    if (R.dragEdge) {
      R.dragEdge.to = { _px: w.x, _py: w.y };

      const hit = portAt(w, 'in'); // nearest input
      if (hit && draggingPort) {
        R.hoverPort = hit;
        R.hoverValid = validateConnection(draggingPort.port, hit.port);
      } else {
        R.hoverPort = null;
        R.hoverValid = null;
      }
      R.draw();
    }

    if (R.marquee && mouse.down && !dragNode && !dragGroup && !dragHandle && !R.dragEdge && !dragMultiple) {
      R.marquee.w = w.x - marqueeStart.x;
      R.marquee.h = w.y - marqueeStart.y;

      const x1 = Math.min(marqueeStart.x, w.x);
      const y1 = Math.min(marqueeStart.y, w.y);
      const x2 = Math.max(marqueeStart.x, w.x);
      const y2 = Math.max(marqueeStart.y, w.y);

      const inside = n => n.x >= x1 && n.y >= y1 && (n.x + n.w) <= x2 && (n.y + n.h) <= y2;
      const ids = graph.nodes.filter(inside).map(n => n.id);

      R.selection = new Set(marqueeAdd ? [...R.selection, ...ids] : ids);
      updatePanels();
      R.draw();
      return;
    }
  });
  canvas.addEventListener('mouseup', (e) => {
    const w = toWorld(e);

    if (R.marquee) {
      R.marquee = null;
      marqueeStart = null;
      marqueeAdd = false;
      R.draw();
      mouse.down = false;
      return;
    }

    if (R.dragEdge) {
      const hit = R.hoverPort || portAt(w, 'in');
      if (hit && draggingPort) {
        const from = draggingPort.port;
        const to = hit.port;
        if (validateConnection(from, to)) {
          R.dragEdge.to = `${hit.node.id}:${to.name}`;
          graph.edges.push(R.dragEdge);
        }
      }
      R.dragEdge = null;
      draggingPort = null;
      R.hoverPort = null;
      R.hoverValid = null;
      R.draw();
      if (tool === 'connector') tool = 'select';
      return;
    }

    mouse.down = false;
    dragNode = null;
    dragHandle = null;
    dragGroup = null;
    dragMultiple = null;
  });
  canvas.addEventListener('mouseleave', () => {
    R.dragEdge = null;
    draggingPort = null;
    R.draw();
  });

  const validateConnection = (fromPort, toPort) => {
    if (fromPort.direction !== 'out' || toPort.direction !== 'in') return false;
    if (fromPort.isExec !== toPort.isExec && (fromPort.isExec || toPort.isExec)) return false;
    const t1 = fromPort.type, t2 = toPort.type;
    if (fromPort.isExec) return true;
    if (t1 === 'any' || t2 === 'any') return true;
    return t1 === t2; // simple type check
  };

  const addShape = (kind) => {
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
    graph.nodes.push(n);
    setSelection(n);
    R.draw();
  };

  // Grouping helpers
  const groupSelection = () => {
    if (R.selection.size === 0) return;
    const members = [...R.selection]
      .map(id => graph.nodes.find(n => n.id === id))
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
    
    graph.nodes.unshift(g);
    R.selection.clear();
    R.selection.add(g.id);
    updatePanels();
    R.draw();
  };

  const ungroupSelection = () => {
    if (R.selection.size !== 1) return;
    const id = [...R.selection][0];
    const g = graph.nodes.find(n => n.id === id && n.isGroup);
    if (!g) return;
    
    graph.nodes = graph.nodes.filter(n => n !== g);
    R.selection.clear();
    R.draw();
    updatePanels();
  };

  // Example graph (Vec3 dot)
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
    R.draw();
  };

  // Toolbar buttons
  document.getElementById('btn-rect').onclick = () => addShape('rect');
  document.getElementById('btn-round').onclick = () => addShape('roundRect');
  document.getElementById('btn-ellipse').onclick = () => addShape('ellipse');
  document.getElementById('btn-circle').onclick = () => addShape('circle');
  document.getElementById('btn-connector').onclick = () => tool = 'connector';
  document.getElementById('btn-select').onclick = () => tool = 'select';
  document.getElementById('btn-play').onclick = () => Logic.run(graph, log);
  document.getElementById('btn-example').onclick = loadExample;
  document.getElementById('btn-group').onclick = groupSelection;
  document.getElementById('btn-ungroup').onclick = ungroupSelection;

  // Palette (logic nodes)
  document.querySelectorAll('.tool[data-shape]').forEach(el => {
    el.onclick = () => {
      const kind = el.getAttribute('data-shape');
      const n = makeLogicNode(kind, 100 + Math.random() * 400, 100 + Math.random() * 300);
      graph.nodes.push(n);
      setSelection(n);
      R.draw();
    };
  });

  // Boot
  R.resize();
  loadExample();
  updatePanels();