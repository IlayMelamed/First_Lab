/* Original, entirely offline Canvas artwork and effects for Iron Dome. */
(() => {
  'use strict';
  const W = 1200, H = 720;
  const SHIELD = { x: 600, y: 350, r: 76 };
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const TYPES = {
    drone: { color: '#dce9c7', size: 13 },
    uav: { color: '#f5df9e', size: 18 },
    cruise: { color: '#fff0cf', size: 19 },
    ballistic: { color: '#f6a76d', size: 23 },
    heavy: { color: '#ef7866', size: 28 },
  };
  const ZONES = [
    { id: 'lebanon', x: 590, y: 145, flag: 'lb' },
    { id: 'syria', x: 765, y: 165, flag: 'sy' },
    { id: 'iraq', x: 910, y: 240, flag: 'iq' },
    { id: 'iran', x: 1090, y: 300, flag: 'ir' },
    { id: 'yemen', x: 900, y: 625, flag: 'ye' },
    { id: 'gaza', x: 425, y: 440, flag: 'ps' },
  ];
  const COUNTRY_LABELS = [
    ['TÜRKIYE', 712, 42, 17], ['LEBANON', 612, 107, 12],
    ['SYRIA', 728, 227, 18], ['IRAQ', 920, 139, 19],
    ['IRAN', 1090, 204, 23], ['JORDAN', 703, 400, 14],
    ['SAUDI ARABIA', 882, 488, 21], ['YEMEN', 897, 684, 17],
    ['EGYPT', 319, 579, 24], ['GAZA', 425, 484, 12],
    ['ISRAEL', 602, 310, 13],
  ];
  function rounded(ctx, x, y, w, h, r = 8) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else {
      r = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
  }
  function path(ctx, points, close = true) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    if (close) ctx.closePath();
  }
  function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
  function spaced(ctx, label, x, y, spacing = 3) {
    const width = ctx.measureText(label).width + Math.max(0, label.length - 1) * spacing;
    let left = x - width / 2;
    for (const letter of label) { ctx.fillText(letter, left, y); left += ctx.measureText(letter).width + spacing; }
  }
  function overlaps(a, b, pad = 5) {
    return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
  }
  class IronRenderer {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
      this.background = document.createElement('canvas');
      this.background.width = W * 2; this.background.height = H * 2;
      this.effects = []; this.time = 0; this.labelOffsets = new Map(); this.scale = 1;
      this.paintBackground(); this.resize();
    }
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.width = Math.max(1, rect.width || W); this.height = Math.max(1, rect.height || H);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (this.canvas.width !== Math.round(this.width * dpr) || this.canvas.height !== Math.round(this.height * dpr)) {
        this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
      }
      this.dpr = dpr; this.scale = Math.min(this.width / W, this.height / H);
      this.offsetX = (this.width - W * this.scale) / 2;
      this.offsetY = (this.height - H * this.scale) / 2;
    }
    reset() { this.effects.length = 0; this.labelOffsets.clear(); this.time = 0; }
    effect(event) {
      if (!event || !event.type) return;
      const threat = event.threat ? { ...event.threat } : null;
      this.effects.push({ ...event, threat, start: this.time, seed: Math.random() * 10000,
        x: threat?.x ?? event.x ?? SHIELD.x, y: threat?.y ?? event.y ?? SHIELD.y });
      if (this.effects.length > 80) this.effects.splice(0, this.effects.length - 80);
    }
    paintBackground() {
      const c = this.background.getContext('2d'); c.scale(2, 2);
      const ocean = c.createLinearGradient(0, 0, 750, 720);
      ocean.addColorStop(0, '#1a5966'); ocean.addColorStop(.55, '#256c70'); ocean.addColorStop(1, '#397c79');
      c.fillStyle = ocean; c.fillRect(0, 0, W, H);
      // Water depths, cartographic grid, and hand-drawn wave dashes.
      c.fillStyle = 'rgba(11,55,69,.17)';
      c.beginPath(); c.ellipse(128, 224, 335, 218, -.35, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(173,221,204,.065)'; c.lineWidth = 1;
      for (let x = 30; x < W; x += 70) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      for (let y = 20; y < H; y += 70) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      for (let i = 0; i < 75; i++) {
        const x = 20 + hash(i + 4) * 500, y = 25 + hash(i + 91) * 450;
        c.strokeStyle = 'rgba(161,220,207,.12)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x - 8, y); c.quadraticCurveTo(x, y + 3, x + 8, y); c.stroke();
      }
      const countries = [
        { color: '#a4b99a', points: [[421,0],[1200,0],[1200,100],[1076,93],[1000,63],[900,92],[818,74],[745,90],[675,73],[605,101],[570,126],[551,93],[510,84],[482,42]] },
        { color: '#c5c4a0', points: [[570,126],[605,101],[675,73],[745,90],[818,74],[853,124],[829,179],[863,233],[793,284],[711,294],[628,261],[606,219],[576,203]] },
        { color: '#d3bd92', points: [[818,74],[900,92],[1000,63],[1031,122],[1006,184],[1044,248],[1030,309],[966,350],[897,349],[793,284],[863,233],[829,179],[853,124]] },
        { color: '#b4bc9c', points: [[1000,63],[1076,93],[1200,100],[1200,473],[1153,431],[1126,390],[1078,376],[1030,309],[1044,248],[1006,184],[1031,122]] },
        { color: '#8fae91', points: [[570,126],[576,203],[606,219],[608,254],[583,270],[566,240],[554,198],[558,162]] },
        { color: '#cbd0a7', points: [[566,240],[583,270],[608,254],[628,261],[627,302],[616,365],[593,426],[567,448],[550,423],[562,374],[550,322]] },
        { color: '#d3c09a', points: [[628,261],[711,294],[793,284],[775,337],[750,365],[795,423],[700,477],[647,483],[593,426],[616,365],[627,302]] },
        { color: '#ddc49b', points: [[897,349],[966,350],[1030,309],[1078,376],[1126,390],[1153,431],[1200,473],[1200,641],[1112,658],[1049,610],[998,613],[977,587],[893,593],[835,574],[751,600],[709,566],[680,530],[647,483],[700,477],[795,423],[750,365],[775,337],[793,284]] },
        { color: '#c8b793', points: [[751,600],[835,574],[893,593],[977,587],[998,613],[1049,610],[1112,658],[1097,706],[1047,720],[813,720],[801,692],[776,666]] },
        { color: '#d9c6a1', points: [[0,459],[188,444],[298,426],[374,414],[441,398],[480,366],[550,322],[562,374],[550,423],[567,448],[593,426],[647,483],[680,530],[709,566],[685,615],[646,634],[614,590],[596,557],[570,520],[544,497],[518,518],[527,566],[553,604],[577,647],[624,720],[0,720]] },
      ];
      // Coastal shelf creates depth without compromising the flat map view.
      c.save(); c.strokeStyle = 'rgba(159,221,195,.38)'; c.lineWidth = 13; c.lineJoin = 'round';
      countries.forEach(country => { path(c, country.points); c.stroke(); }); c.restore();
      for (const country of countries) {
        path(c, country.points); c.fillStyle = country.color; c.fill();
        c.lineWidth = 1.8; c.strokeStyle = 'rgba(255,246,215,.65)'; c.stroke();
      }
      // The Red Sea, Gulf of Aqaba and Persian Gulf.
      c.fillStyle = '#347e82';
      path(c, [[544,497],[570,520],[596,557],[614,590],[646,634],[685,615],[709,566],[725,608],[751,650],[781,720],[624,720],[577,647],[553,604],[527,566],[518,518]]); c.fill();
      c.strokeStyle = 'rgba(184,225,194,.5)'; c.lineWidth = 4; c.stroke();
      c.fillStyle = '#3c8584';
      path(c, [[1030,309],[1053,337],[1078,376],[1126,390],[1153,431],[1200,473],[1200,515],[1145,482],[1098,448],[1074,418],[1044,398],[1021,354]]); c.fill();
      c.strokeStyle = 'rgba(197,231,195,.5)'; c.lineWidth = 3; c.stroke();
      // Cyprus and islands.
      c.fillStyle = '#bac4a0';
      path(c, [[375,154],[402,153],[426,139],[420,155],[406,165],[393,173],[369,169],[358,162]]); c.fill();
      c.strokeStyle = '#a0c5ad'; c.lineWidth = 3; c.stroke();
      // River valleys, lakes, and the Nile delta.
      c.strokeStyle = 'rgba(116,152,122,.38)'; c.lineWidth = 22; c.lineCap = 'round';
      c.beginPath(); c.moveTo(285,720); c.bezierCurveTo(324,633,288,569,319,497); c.stroke();
      c.strokeStyle = '#679d92'; c.lineWidth = 4; c.stroke();
      c.lineWidth = 2; c.beginPath(); c.moveTo(319,497); c.lineTo(305,463); c.moveTo(319,497); c.lineTo(344,458); c.stroke();
      c.strokeStyle = '#82a894'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(848,111); c.bezierCurveTo(867,178,890,226,931,269); c.bezierCurveTo(961,289,979,302,996,335); c.stroke();
      c.beginPath(); c.moveTo(919,96); c.bezierCurveTo(905,151,930,200,931,269); c.stroke();
      c.fillStyle = '#5c9fa1'; c.beginPath(); c.ellipse(618,356,4,13,.18,0,TAU); c.fill();
      c.beginPath(); c.ellipse(619,294,3,5,.18,0,TAU); c.fill();
      // Desert contours and mountain clusters. Deterministic artwork, cached once.
      for (let i = 0; i < 66; i++) {
        const x = i < 22 ? 70 + hash(i + 88) * 410 : 785 + hash(i + 88) * 390;
        const y = i < 22 ? 505 + hash(i + 4) * 200 : 390 + hash(i + 4) * 170;
        if (x > 1080 && y < 500) continue;
        c.strokeStyle = 'rgba(145,115,76,.11)'; c.lineWidth = 1.4;
        c.beginPath(); c.ellipse(x,y,10+hash(i+1)*25,3+hash(i+7)*5,-.2,Math.PI,TAU); c.stroke();
        if (i % 3 === 0) { c.beginPath(); c.ellipse(x+7,y+7,12+hash(i+1)*25,4,-.2,Math.PI,TAU); c.stroke(); }
      }
      const mountainBands = [[1115,135,11,54],[1092,285,15,70],[683,121,9,65],[852,87,9,54],[580,200,6,24],[833,632,7,38]];
      for (const [bx,by,n,spread] of mountainBands) {
        for (let i = 0; i < n; i++) {
          const x = bx+(hash(i+bx)-.5)*spread*2, y = by+(hash(i+by)-.5)*spread;
          const size = 7+hash(i+90)*10;
          c.fillStyle = 'rgba(114,124,92,.17)'; path(c, [[x-size,y+size*.4],[x,y-size*.7],[x+size,y+size*.4]]); c.fill();
          c.fillStyle = 'rgba(249,241,208,.23)'; path(c, [[x,y-size*.7],[x+size,y+size*.4],[x+2,y+size*.4]]); c.fill();
        }
      }
      for (let i = 0; i < 43; i++) {
        const x = 561+hash(i+131)*45, y = 173+hash(i+39)*233;
        c.fillStyle = 'rgba(61,113,87,.27)'; c.beginPath(); c.ellipse(x,y,2.4,3.8,0,0,TAU); c.fill();
        c.fillStyle = 'rgba(237,239,190,.2)'; c.beginPath(); c.arc(x-.8,y-1,1.4,0,TAU); c.fill();
      }
      // Light road routes and small towns.
      c.save(); c.strokeStyle = 'rgba(255,244,215,.43)'; c.lineWidth = 1.2; c.setLineDash([3,5]);
      for (const route of [ [[585,170],[598,240],[594,350],[570,430]], [[648,250],[728,225],[801,259],[916,298]], [[652,390],[770,465],[908,546],[910,620]], [[338,470],[426,446],[493,417],[566,370]] ]) { path(c,route,false); c.stroke(); }
      c.restore();
      for (const [x,y] of [[594,335],[590,375],[602,282],[632,247],[706,232],[914,298],[908,546],[338,470],[1069,174]]) {
        c.fillStyle = 'rgba(131,113,83,.42)'; c.fillRect(x-2,y-2,3,3); c.fillRect(x+3,y,2,3); c.fillRect(x-1,y+3,2,2);
      }
      // Gaza's coastal outpost is deliberately exaggerated for readable play space.
      c.fillStyle = '#aebd8f'; path(c,[[417,428],[429,425],[439,447],[428,457],[420,446]]); c.fill();
      c.strokeStyle = 'rgba(255,245,210,.8)'; c.lineWidth = 1.3; c.stroke();
      // Subtle paper grain stays under every gameplay element.
      for (let i=0;i<2900;i++) {
        c.fillStyle = i%2 ? 'rgba(255,255,226,.028)' : 'rgba(35,58,50,.025)';
        c.fillRect(hash(i+561)*W,hash(i+1137)*H,1.3,1.3);
      }
      // A restrained atlas-style compass.
      c.save(); c.translate(72,630); c.strokeStyle='rgba(208,231,215,.48)'; c.fillStyle='rgba(222,236,217,.62)'; c.lineWidth=1;
      c.beginPath(); c.arc(0,0,23,0,TAU); c.stroke();
      path(c,[[0,-31],[5,0],[0,-5],[-5,0]]); c.fill();
      c.beginPath(); c.moveTo(-30,0); c.lineTo(30,0); c.moveTo(0,6); c.lineTo(0,29); c.stroke();
      c.font='600 11px sans-serif'; c.textAlign='center'; c.fillText('N',0,-39); c.restore();
    }
    draw(game, timeSeconds, options = {}) {
      this.time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
      this.options = { quality: 'high', reducedMotion: false, prefix: '', ...options };
      const rect = this.canvas.getBoundingClientRect();
      if (Math.abs(rect.width-this.width)>.5 || Math.abs(rect.height-this.height)>.5 || this.dpr !== Math.min(2,window.devicePixelRatio||1)) this.resize();
      const c = this.ctx, s = this.scale, t = this.options.reducedMotion ? 0 : this.time;
      c.setTransform(this.dpr,0,0,this.dpr,0,0);
      c.fillStyle='#205f69'; c.fillRect(0,0,this.width,this.height);
      c.translate(this.offsetX,this.offsetY); c.scale(s,s);
      c.drawImage(this.background,0,0,W,H);
      this.drawMapLabels(c);
      for (const zone of ZONES) this.drawZone(c,zone,t);
      this.drawDome(c,t,game);
      this.drawBattery(c,575,380,-.2); this.drawBattery(c,625,334,-2.6);
      const threats = game?.threats || [];
      if (game) {
        for (const threat of threats) this.drawThreat(c,threat,t);
      } else {
        this.drawAmbient(c,t);
      }
      this.drawEffects(c,this.time);
      if (game) this.drawLabels(c,threats,this.options.prefix.toLowerCase(),t);
      // Inner edge adds a finished inset map frame.
      c.strokeStyle='rgba(12,42,48,.24)'; c.lineWidth=2/s; c.strokeRect(1/s,1/s,W-2/s,H-2/s);
    }
    drawMapLabels(c) {
      const scale = this.scale;
      c.save(); c.textBaseline='middle';
      for (const [label,x,y,size] of COUNTRY_LABELS) {
        const font = Math.max(size,9.5/scale);
        c.font=`700 ${font}px ui-sans-serif, system-ui, sans-serif`;
        c.fillStyle = label==='ISRAEL' ? '#1f5b68' : 'rgba(64,74,57,.57)';
        spaced(c,label,x,y,label.length>8 ? 2 : 2.6);
      }
      c.fillStyle='rgba(199,229,215,.49)'; c.font=`italic ${Math.max(15,10/scale)}px Georgia, serif`;
      c.save(); c.translate(267,268); c.rotate(-.22); c.textAlign='center'; c.fillText('Mediterranean Sea',0,0); c.restore();
      c.font=`italic ${Math.max(12,9/scale)}px Georgia, serif`; c.textAlign='center';
      c.save(); c.translate(656,645); c.rotate(.93); c.fillText('Red Sea',0,0); c.restore();
      c.restore();
    }
    drawZone(c,zone,t) {
      const {x,y,flag}=zone;
      c.save(); c.translate(x,y);
      c.strokeStyle='rgba(190,89,57,.18)'; c.lineWidth=1.3;
      c.beginPath(); c.arc(0,0,19+Math.sin(t*1.8+x)*2,0,TAU); c.stroke();
      c.fillStyle='rgba(74,67,46,.13)'; c.beginPath(); c.ellipse(1,8,16,8,0,0,TAU); c.fill();
      c.fillStyle='#f7e9c7'; c.strokeStyle='#b07f57'; c.lineWidth=1.5;
      rounded(c,-13,-13,26,26,8); c.fill(); c.stroke();
      // Tiny regional flags provide orientation. Launch points are fictional outposts.
      c.save(); rounded(c,-9,-6,18,12,2); c.clip();
      const stripes=flag==='lb'?['#ce685c','#fff7e1','#ce685c']:flag==='ir'?['#5f9a77','#fff7e1','#ca6559']:flag==='sy'?['#5f9a77','#fff7e1','#405651']:flag==='ps'?['#405651','#fff7e1','#5f9a77']:['#ca6559','#fff7e1','#405651'];
      stripes.forEach((color,i)=>{c.fillStyle=color;c.fillRect(-9,-6+i*4,18,4);});
      if(flag==='ps'){c.fillStyle='#ce685c';path(c,[[-9,-6],[0,0],[-9,6]]);c.fill();}
      if(flag==='lb'){c.fillStyle='#588b67';path(c,[[0,-3],[3,2],[-3,2]]);c.fill();c.fillRect(-.6,1,1.2,3);}
      if(flag==='sy'||flag==='iq'||flag==='ir'){c.fillStyle=flag==='sy'?'#ca6559':'#67946e';for(let i=-1;i<=1;i++)c.fillRect(i*4-.6,-.6,1.3,1.3);}
      c.restore();
      c.fillStyle='#db8064'; c.beginPath(); c.arc(14,-12,3.5,0,TAU); c.fill();
      c.restore();
    }
    drawDome(c,t,game) {
      const {x,y,r}=SHIELD;
      let nearest=0;
      for(const threat of game?.threats||[]) {
        const distance=Math.hypot(threat.x-x,threat.y-y);
        nearest=Math.max(nearest,clamp((r+105-distance)/105,0,1));
      }
      const pulse=1+Math.sin(t*1.7)*.012;
      c.save(); c.translate(x,y);
      const halo=c.createRadialGradient(0,0,r*.65,0,0,r+27);
      halo.addColorStop(0,'rgba(75,205,255,0)');halo.addColorStop(.56,'rgba(65,206,255,.15)');halo.addColorStop(1,'rgba(65,206,255,0)');
      c.fillStyle=halo;c.beginPath();c.arc(0,0,r+27,0,TAU);c.fill();
      c.scale(pulse,pulse);
      const fill=c.createRadialGradient(-22,-28,4,0,0,r);
      fill.addColorStop(0,'rgba(181,245,255,.08)');fill.addColorStop(.7,'rgba(42,158,238,.14)');fill.addColorStop(1,'rgba(28,171,255,.29)');
      c.fillStyle=fill;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
      c.save();c.beginPath();c.arc(0,0,r-2,0,TAU);c.clip();
      c.strokeStyle='rgba(179,244,255,.25)';c.lineWidth=1;
      for(const z of [-.66,-.32,.32,.66]) {
        c.beginPath();c.ellipse(0,z*r,r*Math.sqrt(1-z*z),12,0,0,TAU);c.stroke();
      }
      for(const width of [23,52]) {c.beginPath();c.ellipse(0,0,width,r,0,0,TAU);c.stroke();}
      c.beginPath();c.moveTo(-r,0);c.lineTo(r,0);c.stroke();
      c.restore();
      c.shadowColor='#5cddff';c.shadowBlur=this.options.quality==='low'?0:15;
      c.strokeStyle='#73dcff';c.lineWidth=2.4;c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();
      c.shadowBlur=0;c.strokeStyle='rgba(225,255,255,.6)';c.lineWidth=1;c.beginPath();c.arc(0,0,r-4,-2.9,-1.0);c.stroke();
      c.strokeStyle='rgba(200,251,255,.65)';c.lineWidth=3;c.beginPath();c.arc(0,0,r,t*.3,t*.3+.5);c.stroke();
      if(nearest>.08){c.strokeStyle=`rgba(169,238,255,${nearest*.42})`;c.lineWidth=1.2;c.beginPath();c.arc(0,0,r+6+Math.sin(t*5)*3,0,TAU);c.stroke();}
      c.fillStyle='#c9f8ff';c.beginPath();c.arc(0,0,3,0,TAU);c.fill();
      c.strokeStyle='rgba(189,244,255,.48)';c.lineWidth=1;c.beginPath();c.arc(0,0,8,0,TAU);c.stroke();
      c.restore();
    }
    drawBattery(c,x,y,angle) {
      c.save();c.translate(x,y);c.rotate(angle);
      c.fillStyle='rgba(24,64,66,.22)';c.beginPath();c.ellipse(2,5,14,8,0,0,TAU);c.fill();
      c.fillStyle='#426d69';rounded(c,-9,-6,20,13,3);c.fill();c.strokeStyle='#b4d6bd';c.lineWidth=1;c.stroke();
      for(let i=-1;i<=1;i++){c.fillStyle='#e9ecc8';rounded(c,-6,-5+i*3,15,2,1);c.fill();}
      c.fillStyle='#f0bd67';c.fillRect(8,-3,3,6);c.restore();
    }
    drawThreat(c,threat,t,locked=false) {
      if(!Number.isFinite(threat.x)||!Number.isFinite(threat.y))return;
      const kind=TYPES[threat.type]||TYPES.cruise;
      const angle=Number.isFinite(threat.angle)?threat.angle:Math.atan2(SHIELD.y-threat.y,SHIELD.x-threat.x);
      const size=kind.size;
      c.save();c.translate(threat.x,threat.y);c.rotate(angle);
      if(locked)c.globalAlpha=.85;
      if(threat.type!=='drone'&&threat.type!=='uav') {
        const trail=c.createLinearGradient(-size-65,0,-size*.25,0);
        trail.addColorStop(0,'rgba(255,216,157,0)');trail.addColorStop(1,'rgba(255,225,171,.64)');
        c.strokeStyle=trail;c.lineWidth=threat.type==='heavy'?9:5;c.lineCap='round';
        c.beginPath();c.moveTo(-size-60,0);c.lineTo(-size*.5,0);c.stroke();
        c.fillStyle='#f29c55';path(c,[[-size*.6,-4],[-size*(1.3+.15*Math.sin(t*35+threat.x)),0],[-size*.6,4]]);c.fill();
        c.fillStyle='#ffe4a5';path(c,[[-size*.6,-2],[-size*1.13,0],[-size*.6,2]]);c.fill();
      } else {
        c.strokeStyle='rgba(242,237,200,.19)';c.lineWidth=2;
        for(const offset of [-7,7]){c.beginPath();c.moveTo(-size-24,offset);c.lineTo(-size,offset);c.stroke();}
      }
      c.save();c.translate(4,6);c.fillStyle='rgba(22,49,46,.18)';c.beginPath();c.ellipse(0,0,size*.8,size*.42,0,0,TAU);c.fill();c.restore();
      c.strokeStyle='#3c5857';c.lineWidth=1.3;c.fillStyle=kind.color;c.lineJoin='round';
      if(threat.type==='drone') {
        c.strokeStyle='#436763';c.lineWidth=3;
        for(const sy of [-1,1])for(const sx of [-1,1]) {
          c.beginPath();c.moveTo(0,0);c.lineTo(sx*9,sy*9);c.stroke();
          c.fillStyle='rgba(205,234,214,.28)';c.beginPath();c.arc(sx*9,sy*9,6,0,TAU);c.fill();
          c.save();c.translate(sx*9,sy*9);c.rotate(t*24+sx);c.strokeStyle='#f1eed1';c.lineWidth=1.6;
          c.beginPath();c.moveTo(-5,0);c.lineTo(5,0);c.moveTo(0,-5);c.lineTo(0,5);c.stroke();c.restore();
        }
        c.fillStyle=kind.color;c.strokeStyle='#436763';c.lineWidth=1.2;rounded(c,-8,-5,17,10,5);c.fill();c.stroke();
        c.fillStyle='#3d747b';c.beginPath();c.arc(5,0,2.5,0,TAU);c.fill();
      } else if(threat.type==='uav') {
        path(c,[[18,0],[2,-4],[-5,-19],[-10,-19],[-8,-3],[-15,-2],[-18,-8],[-22,-8],[-19,0],[-22,8],[-18,8],[-15,2],[-8,3],[-10,19],[-5,19],[2,4]]);c.fill();c.stroke();
        c.fillStyle='#6d9991';path(c,[[13,0],[4,-2],[4,2]]);c.fill();
        c.strokeStyle='#f6edc6';c.lineWidth=1.4;c.beginPath();c.moveTo(-19,-6*Math.cos(t*35));c.lineTo(-19,6*Math.cos(t*35));c.stroke();
      } else {
        const wide=threat.type==='heavy'?7:threat.type==='ballistic'?5.5:4;
        path(c,[[size,0],[size*.44,-wide],[-size*.4,-wide],[-size*.72,-wide*2.4],[-size*.98,-wide*2.4],[-size*.73,-wide*.65],[-size*.8,0],[-size*.73,wide*.65],[-size*.98,wide*2.4],[-size*.72,wide*2.4],[-size*.4,wide],[size*.44,wide]]);c.fill();c.stroke();
        c.fillStyle='#fff3d3';path(c,[[size,0],[size*.45,-wide],[size*.45,wide]]);c.fill();
        c.fillStyle=threat.type==='heavy'?'#874d52':'#cf795a';c.fillRect(-size*.25,-wide,4,wide*2);
        c.strokeStyle='rgba(255,255,229,.66)';c.lineWidth=1;c.beginPath();c.moveTo(-size*.42,-wide*.5);c.lineTo(size*.36,-wide*.5);c.stroke();
      }
      c.restore();
      if(threat.type==='heavy'&&(threat.progress??0)<.22) {
        c.save();c.strokeStyle=`rgba(166,64,50,${.35+Math.sin(t*5)*.12})`;c.lineWidth=1.3;c.setLineDash([3,5]);
        c.beginPath();c.arc(threat.x,threat.y,38,0,TAU);c.stroke();c.restore();
      }
    }
    drawAmbient(c,t) {
      const ambient=[['drone',470,210],['uav',825,210],['cruise',1010,352],['ballistic',835,580],['cruise',391,475]];
      ambient.forEach(([type,x,y],i)=>{
        const phase=(t*.025+i*.17)%1;
        const amount=.03+phase*.19;
        this.drawThreat(c,{type,x:mix(x,600,amount),y:mix(y,350,amount),progress:0},t);
      });
    }
    drawLabels(c,threats,prefix,t) {
      if(!threats.length){this.labelOffsets.clear();return;}
      const font=Math.max(17,13/this.scale), height=Math.max(31,24/this.scale);
      c.save();c.font=`600 ${font}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;c.textBaseline='middle';
      const matches=threats.filter(th=>prefix&&th.word.toLowerCase().startsWith(prefix));
      const unique=matches.length===1?matches[0].id:null;
      const rects=[];const visibleIds=new Set();
      const sorted=[...threats].sort((a,b)=>(a.remaining??100)-(b.remaining??100));
      for(const threat of sorted) {
        if(!threat.word)continue;
        const word=threat.word.toLowerCase(),matched=!!prefix&&word.startsWith(prefix),urgent=(threat.remaining??100)<3;
        const width=c.measureText(word).width+24, previous=this.labelOffsets.get(threat.id);
        const gap=height/2+22;
        const offsets=[];
        if(previous)offsets.push(previous);
        offsets.push([0,-gap],[0,gap],[-width*.45,-gap],[width*.45,-gap],[-width*.45,gap],[width*.45,gap]);
        for(let ring=2;ring<=5;ring++)for(let side=-1;side<=1;side++)offsets.push([side*width*.8,-gap-(ring-1)*(height+7)],[side*width*.8,gap+(ring-1)*(height+7)]);
        let best=null,bestScore=Infinity;
        for(const [dx,dy] of offsets) {
          const candidate={x:clamp(threat.x+dx-width/2,10,W-width-10),y:clamp(threat.y+dy-height/2,8,H-height-8),w:width,h:height};
          const collisions=rects.filter(rect=>overlaps(candidate,rect,7));
          const distance=Math.hypot(candidate.x+width/2-threat.x,candidate.y+height/2-threat.y);
          const score=collisions.length*100000+distance+(dy>0?9:0)+(previous&&dx===previous[0]&&dy===previous[1]?-19:0);
          if(score<bestScore){best=candidate;bestScore=score;}
          if(collisions.length===0&&previous&&dx===previous[0]&&dy===previous[1])break;
        }
        // A grid search guarantees a clear label even in unusually dense test scenarios.
        if(bestScore>10000) {
          for(let y=8;y<H-height;y+=height+8)for(let x=10;x<W-width;x+=Math.max(width*.5,60)) {
            const candidate={x,y,w:width,h:height};
            if(rects.some(rect=>overlaps(candidate,rect,7)))continue;
            const score=Math.hypot(x+width/2-threat.x,y+height/2-threat.y);
            if(score<bestScore){best=candidate;bestScore=score;}
          }
        }
        rects.push(best);visibleIds.add(threat.id);
        this.labelOffsets.set(threat.id,[best.x+width/2-threat.x,best.y+height/2-threat.y]);
        const lineX=clamp(threat.x,best.x+8,best.x+width-8),lineY=clamp(threat.y,best.y+5,best.y+height-5);
        c.strokeStyle=matched?'rgba(87,240,234,.85)':'rgba(31,54,56,.55)';c.lineWidth=1.4;
        c.beginPath();c.moveTo(threat.x,threat.y);c.lineTo(lineX,lineY);c.stroke();
        if(threat.id===unique) {
          c.save();c.strokeStyle='#9bf9ec';c.lineWidth=2;c.setLineDash([7,5]);c.lineDashOffset=-t*15;
          c.beginPath();c.arc(threat.x,threat.y,29+(threat.type==='heavy'?7:0),0,TAU);c.stroke();c.restore();
        }
        c.shadowColor='rgba(20,38,39,.22)';c.shadowBlur=6;c.shadowOffsetY=3;
        rounded(c,best.x,best.y,width,height,8);c.fillStyle=matched?'#123e4b':'#18313a';c.fill();
        c.shadowBlur=0;c.shadowOffsetY=0;
        c.strokeStyle=matched?'#85efdb':urgent?'#f9a66c':'rgba(238,230,193,.55)';c.lineWidth=matched?2:1;c.stroke();
        c.fillStyle=prefix&&!matched?'#c4d1c9':'#fff4d4';
        const tx=best.x+12,ty=best.y+height/2+.5;
        c.fillText(word,tx,ty);
        if(matched){c.fillStyle='#89f2ce';c.fillText(word.slice(0,prefix.length),tx,ty);}
        if(urgent){c.fillStyle='#ffae74';c.beginPath();c.arc(best.x+width-4,best.y+4,3,0,TAU);c.fill();}
      }
      for(const id of this.labelOffsets.keys())if(!visibleIds.has(id))this.labelOffsets.delete(id);
      c.restore();
    }
    drawEffects(c,t) {
      this.effects=this.effects.filter(effect=>{
        const age=Math.max(0,t-effect.start);
        if(effect.type==='intercept')return this.drawInterception(c,effect,age);
        if(effect.type==='breach'||effect.type==='impact')return this.drawBreach(c,effect,age);
        if(effect.type==='heart'||effect.type==='heartReward')return this.drawHeart(c,effect,age);
        if(effect.type==='victory'||effect.type==='complete')return this.drawVictory(c,effect,age);
        return age<1;
      });
    }
    drawInterception(c,e,age) {
      const start={x:e.seed%2<1?575:625,y:e.seed%2<1?380:334};
      const distance=Math.hypot(e.x-start.x,e.y-start.y);
      const flight=this.options.reducedMotion?.12:clamp(.25+distance/950,.32,.75);
      const control={x:(start.x+e.x)/2+(e.y-start.y)*.13,y:(start.y+e.y)/2-(e.x-start.x)*.13};
      const point=p=>({x:(1-p)**2*start.x+2*(1-p)*p*control.x+p*p*e.x,y:(1-p)**2*start.y+2*(1-p)*p*control.y+p*p*e.y});
      if(age<flight) {
        if(e.threat)this.drawThreat(c,e.threat,this.time,true);
        const p=clamp(age/flight,0,1), head=point(p), tail=point(Math.max(0,p-.2));
        c.save();c.strokeStyle='rgba(187,255,230,.85)';c.lineWidth=3;c.lineCap='round';
        c.shadowColor='#a4fff1';c.shadowBlur=this.options.quality==='low'?0:10;
        c.beginPath();c.moveTo(tail.x,tail.y);c.quadraticCurveTo(point(Math.max(0,p-.1)).x,point(Math.max(0,p-.1)).y,head.x,head.y);c.stroke();
        c.translate(head.x,head.y);c.rotate(Math.atan2(head.y-tail.y,head.x-tail.x));
        c.fillStyle='#f3fff4';path(c,[[9,0],[-6,-3],[-4,0],[-6,3]]);c.fill();c.restore();
      } else {
        const burst=age-flight;
        if(burst<.65)this.drawExplosion(c,e.x,e.y,burst,e.seed);
        if(burst<1.35) {
          c.save();c.globalAlpha=clamp(1-(burst-.5)/.85,0,1);
          c.font=`800 ${Math.max(23,16/this.scale)}px ui-sans-serif,system-ui,sans-serif`;c.textAlign='center';c.textBaseline='middle';
          c.strokeStyle='#214b48';c.lineWidth=3;c.strokeText(`+${e.points||50}`,e.x,e.y-18-burst*30);
          c.fillStyle='#e6ffb6';c.fillText(`+${e.points||50}`,e.x,e.y-18-burst*30);c.restore();
        }
      }
      return age<flight+1.35;
    }
    drawExplosion(c,x,y,age,seed) {
      const p=clamp(age/.65,0,1), count=this.options.quality==='low'?8:18;
      c.save();c.translate(x,y);
      if(p<.24){c.fillStyle=`rgba(255,247,198,${(1-p/.24)*.8})`;c.beginPath();c.arc(0,0,12+p*110,0,TAU);c.fill();}
      c.strokeStyle=`rgba(255,226,154,${(1-p)*.9})`;c.lineWidth=3*(1-p)+1;c.beginPath();c.arc(0,0,7+p*41,0,TAU);c.stroke();
      for(let i=0;i<count;i++) {
        const angle=hash(seed+i)*TAU,speed=25+hash(seed+i+90)*46,distance=speed*Math.sqrt(p);
        c.fillStyle=i%3===0?`rgba(120,140,126,${(1-p)*.4})`:i%2?`rgba(255,240,176,${1-p})`:`rgba(247,159,95,${1-p})`;
        c.beginPath();c.arc(Math.cos(angle)*distance,Math.sin(angle)*distance+p*p*11,Math.max(.5,(i%3===0?7:4)*(1-p)),0,TAU);c.fill();
      }
      c.restore();
    }
    drawBreach(c,e,age) {
      if(age>1)return false;
      const p=age;
      c.save();c.strokeStyle=`rgba(255,164,106,${(1-p)*.9})`;c.lineWidth=4*(1-p)+1;
      c.beginPath();c.arc(SHIELD.x,SHIELD.y,SHIELD.r+p*25,0,TAU);c.stroke();
      c.fillStyle=`rgba(255,180,118,${Math.max(0,.22-p*.65)})`;c.beginPath();c.arc(SHIELD.x,SHIELD.y,SHIELD.r,0,TAU);c.fill();
      c.strokeStyle=`rgba(255,228,175,${1-p})`;c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,5+p*53,0,TAU);c.stroke();
      if(p<.55)this.drawExplosion(c,e.x,e.y,p,e.seed);
      c.font=`800 ${Math.max(21,15/this.scale)}px ui-sans-serif,system-ui,sans-serif`;c.textAlign='center';c.globalAlpha=1-p;c.fillStyle='#fff0c8';c.strokeStyle='#824744';c.lineWidth=3;
      c.strokeText('−1 ♥',e.x,e.y-20-p*35);c.fillText('−1 ♥',e.x,e.y-20-p*35);c.restore();return true;
    }
    drawHeart(c,e,age) {
      if(age>1.8)return false;
      c.save();c.globalAlpha=clamp(1-(age-1)/.8,0,1);
      const y=SHIELD.y-105-age*15, text='+1 HEART';
      c.font=`800 ${Math.max(19,14/this.scale)}px ui-sans-serif,system-ui,sans-serif`;c.textAlign='center';
      c.strokeStyle='#275e54';c.lineWidth=4;c.strokeText(text,SHIELD.x,y);c.fillStyle='#e3ffa9';c.fillText(text,SHIELD.x,y);
      c.strokeStyle=`rgba(191,244,158,${Math.max(0,.7-age*.5)})`;c.lineWidth=2;c.beginPath();c.arc(SHIELD.x,SHIELD.y,SHIELD.r+age*30,0,TAU);c.stroke();c.restore();return true;
    }
    drawVictory(c,e,age) {
      if(age>3||this.options.reducedMotion)return false;
      c.save();const count=this.options.quality==='low'?22:65;
      for(let i=0;i<count;i++) {
        const x=W*hash(e.seed+i), y=-30+hash(e.seed+i+81)*H*.5+age*(90+hash(i+33)*85);
        c.save();c.translate(x+Math.sin(age*2+i)*15,y);c.rotate(age*2+i);c.globalAlpha=clamp(3-age,0,1);c.fillStyle=['#d6eaa7','#71d7cd','#f0bc75','#f4e7bf'][i%4];c.fillRect(-3,-5,6,10);c.restore();
      }
      c.restore();return true;
    }
  }
  window.IronRenderer = IronRenderer;
})();
