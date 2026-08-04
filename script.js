/* =========================================================
   XIANGQI ENGINE WITH AUDIO, REPLAY, CHAT & SPECTATOR
   ========================================================= */

let COLS = 9, ROWS = 10;
let CELL = 62, MARGIN = 34;
let svgW = 558, svgH = 620;
let CONFIG = null;

/* ---------------- Web Audio API Sound Synthesizer ---------------- */
const Sound = {
  ctx: null,
  init(){
    if(!this.ctx){
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if(AudioCtx) this.ctx = new AudioCtx();
    }
    if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  playMove(){
    this.init(); if(!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.08);
  },
  playCapture(){
    this.init(); if(!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.15);
  },
  playCheck(){
    this.init(); if(!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i)=>{
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(f, now + i*0.06);
      gain.gain.setValueAtTime(0.3, now + i*0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i*0.06 + 0.12);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now + i*0.06); osc.stop(now + i*0.06 + 0.12);
    });
  },
  playWin(){
    this.init(); if(!this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((f, i)=>{
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(f, now + i*0.1);
      gain.gain.setValueAtTime(0.4, now + i*0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i*0.1 + 0.3);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now + i*0.1); osc.stop(now + i*0.1 + 0.3);
    });
  }
};

/* ---------------- Confetti Engine ---------------- */
function launchConfetti(){
  const canvas = document.getElementById('confettiCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const particles = Array.from({length: 80}, ()=> ({
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 14,
    vy: (Math.random() - 0.7) * 14,
    size: Math.random() * 8 + 4,
    color: ['#c8973f', '#7fe0b4', '#b3211a', '#f4e8d0', '#f0ce8e'][Math.floor(Math.random()*5)],
    alpha: 1
  }));

  function draw(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;
    particles.forEach(p => {
      if(p.alpha > 0){
        active = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.alpha -= 0.015;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    });
    if(active) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

function emptyBoard(){ return Array.from({length:ROWS}, ()=>Array(COLS).fill(null)); }

function initialBoard(){
  const b = emptyBoard();
  const setup = CONFIG.initialSetup;
  for(let c=0;c<9;c++){
    b[0][c] = {type:setup.backRow[c], color:'black'};
    b[9][c] = {type:setup.backRow[c], color:'red'};
  }
  for(const [r,c] of setup.cannons){
    b[r][c] = {type:'cannon', color: r < 5 ? 'black' : 'red'};
  }
  for(const c of setup.soldierCols){
    b[setup.soldierRows.black][c] = {type:'soldier', color:'black'};
    b[setup.soldierRows.red][c] = {type:'soldier', color:'red'};
  }
  return b;
}

function cloneBoard(b){ return b.map(row=>row.map(p=>p?{type:p.type,color:p.color}:null)); }
function inBounds(r,c){ return r>=0 && r<ROWS && c>=0 && c<COLS; }
function inPalace(r,c,color){ if(c<3||c>5) return false; return color==='black' ? (r>=0&&r<=2) : (r>=7&&r<=9); }
function crossedRiver(r,color){ return color==='black' ? r>=5 : r<=4; }

function pieceMoves(board, r, c){
  const p = board[r][c]; if(!p) return [];
  const moves = [];
  const push = (nr,nc)=>{
    if(!inBounds(nr,nc)) return false;
    const target = board[nr][nc];
    if(target && target.color === p.color) return false;
    moves.push({r:nr,c:nc, capture: !!target});
    return !target;
  };

  switch(p.type){
    case 'general':
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) if(inPalace(r+dr,c+dc,p.color)) push(r+dr,c+dc);
      break;
    case 'advisor':
      for(const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) if(inPalace(r+dr,c+dc,p.color)) push(r+dr,c+dc);
      break;
    case 'elephant':
      for(const [dr,dc] of [[-2,-2],[-2,2],[2,-2],[2,2]]){
        const nr=r+dr, nc=c+dc;
        if(inBounds(nr,nc) && !crossedRiver(nr,p.color) && !board[r+dr/2][c+dc/2]) push(nr,nc);
      }
      break;
    case 'horse':
      for(const s of [
        {dr:-2,dc:-1,leg:[-1,0]},{dr:-2,dc:1,leg:[-1,0]},{dr:2,dc:-1,leg:[1,0]},{dr:2,dc:1,leg:[1,0]},
        {dr:-1,dc:-2,leg:[0,-1]},{dr:1,dc:-2,leg:[0,-1]},{dr:-1,dc:2,leg:[0,1]},{dr:1,dc:2,leg:[0,1]}
      ]){
        if(inBounds(r+s.leg[0],c+s.leg[1]) && !board[r+s.leg[0]][c+s.leg[1]]) push(r+s.dr,c+s.dc);
      }
      break;
    case 'chariot':
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        let nr=r+dr, nc=c+dc;
        while(inBounds(nr,nc)){ if(!push(nr,nc)) break; nr+=dr; nc+=dc; }
      }
      break;
    case 'cannon':
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        let nr=r+dr, nc=c+dc, screen = false;
        while(inBounds(nr,nc)){
          const target = board[nr][nc];
          if(!screen){
            if(!target) moves.push({r:nr,c:nc,capture:false});
            else screen = true;
          } else {
            if(target){ if(target.color !== p.color) moves.push({r:nr,c:nc,capture:true}); break; }
          }
          nr+=dr; nc+=dc;
        }
      }
      break;
    case 'soldier':
      const fwd = p.color==='red' ? -1 : 1;
      push(r+fwd, c);
      if(crossedRiver(r,p.color)){ push(r, c-1); push(r, c+1); }
      break;
  }
  return moves;
}

function findGeneral(board, color){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(board[r][c]?.type==='general' && board[r][c]?.color===color) return {r,c};
  }
  return null;
}

function generalsFacing(board){
  const red = findGeneral(board,'red'), black = findGeneral(board,'black');
  if(!red || !black || red.c !== black.c) return false;
  const [top,bot] = red.r < black.r ? [red,black] : [black,red];
  for(let r=top.r+1; r<bot.r; r++) if(board[r][red.c]) return false;
  return true;
}

function isInCheck(board, color){
  const g = findGeneral(board, color); if(!g) return true;
  const enemy = color==='red' ? 'black' : 'red';
  for(let rr=0; rr<ROWS; rr++) for(let cc=0; cc<COLS; cc++){
    if(board[rr][cc]?.color===enemy){
      if(pieceMoves(board, rr, cc).some(m=>m.r===g.r && m.c===g.c)) return true;
    }
  }
  return generalsFacing(board);
}

function allLegalMoves(board, color){
  const result = [];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(board[r][c]?.color===color){
      for(const m of pieceMoves(board, r, c)){
        const nb = cloneBoard(board);
        nb[m.r][m.c] = nb[r][c]; nb[r][c] = null;
        if(!isInCheck(nb, color)) result.push({from:{r,c}, to:{r:m.r,c:m.c}, capture:m.capture});
      }
    }
  }
  return result;
}

/* AI Engine Minimal Minimax */
let VALUES = {}, SOLDIER_CROSSED_BONUS = 90;
function evaluate(board){
  let score = 0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = board[r][c]; if(!p) continue;
    let v = VALUES[p.type] + (p.type==='soldier' && crossedRiver(r,p.color) ? SOLDIER_CROSSED_BONUS : 0);
    score += (p.color==='red') ? v : -v;
  }
  return score;
}

function minimax(board, depth, alpha, beta, color){
  const moves = allLegalMoves(board, color);
  if(moves.length===0) return isInCheck(board, color) ? (color==='red' ? -999000 : 999000) : 0;
  if(depth===0) return evaluate(board);
  moves.sort((a,b)=> (b.capture?1:0) - (a.capture?1:0));

  let best = color==='red' ? -Infinity : Infinity;
  for(const m of moves){
    const nb = cloneBoard(board);
    nb[m.to.r][m.to.c] = nb[m.from.r][m.from.c]; nb[m.from.r][m.from.c] = null;
    const val = minimax(nb, depth-1, alpha, beta, color==='red'?'black':'red');
    if(color==='red'){
      best = Math.max(best, val); alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, val); beta = Math.min(beta, best);
    }
    if(alpha>=beta) break;
  }
  return best;
}

const AI_LEVELS = [
  {depth:1, noise:900}, {depth:1, noise:600}, {depth:2, noise:400}, {depth:2, noise:260}, {depth:2, noise:150},
  {depth:3, noise:90},  {depth:3, noise:50},  {depth:3, noise:25},  {depth:4, noise:10},  {depth:4, noise:0}
];
const LEVEL_NAMES = ['Mới học','Vỡ lòng','Nghiệp dư','Khá','Giỏi','Cao thủ','Chuyên nghiệp','Đại kiện tướng','Siêu đẳng','Bất khả chiến bại'];

function aiBestMove(board, color, level){
  const cfg = AI_LEVELS[Math.min(Math.max(level,1),10) - 1];
  const moves = allLegalMoves(board, color); if(moves.length===0) return null;
  let alpha=-Infinity, beta=Infinity, best=null, bestNoisy=-Infinity;
  for(const m of moves){
    const nb = cloneBoard(board);
    nb[m.to.r][m.to.c] = nb[m.from.r][m.from.c]; nb[m.from.r][m.from.c] = null;
    const raw = minimax(nb, cfg.depth-1, alpha, beta, color==='red'?'black':'red');
    const score = color==='red' ? raw : -raw;
    const noisy = cfg.noise>0 ? score + (Math.random()*2-1)*cfg.noise : score;
    if(noisy>bestNoisy){ bestNoisy=noisy; best=m; }
    if(color==='red'){ if(score>alpha) alpha=score; } else { if(-score<beta) beta=-score; }
  }
  return best;
}

/* State Management */
let GLYPHS = {};
let state = {
  board: emptyBoard(),
  turn: 'red',
  selected: null,
  legalTargets: [],
  history: [],       // {from, to, piece, captured, boardSnapshot}
  viewIndex: -1,     // Index for Replay Mode (-1 means live)
  mode: 'pvp',
  aiLevel: 5,
  humanColor: 'red',
  gameOver: false,
  lastMove: null,
  aiThinking: false,
  aiTimeoutId: null,
  online: { active:false, room:null, color:null, version:0, roomCode:null, isSpectator:false },
  cheat: { killMode:false },
  currentSave: null
};

let fb = { app:null, db:null, roomRef:null, room:null, chatRef:null, undoRef:null };
const svg = document.getElementById('boardSvg');

function boardX(c){ return MARGIN + c*CELL; }
function boardY(r){ return MARGIN + r*CELL; }

function buildStaticBoard(){
  const ns = 'http://www.w3.org/2000/svg';
  while(svg.firstChild) svg.removeChild(svg.firstChild);

  const defs = document.createElementNS(ns,'defs');
  defs.innerHTML = `
    <linearGradient id="woodGrain" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e7c98d"/><stop offset="45%" stop-color="#dab976"/><stop offset="100%" stop-color="#c9a563"/>
    </linearGradient>
    <radialGradient id="redPieceGrad" cx="35%" cy="28%" r="75%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.55)"/><stop offset="18%" stop-color="rgba(255,190,170,0.55)"/>
      <stop offset="55%" stop-color="rgba(179,33,26,0.72)"/><stop offset="100%" stop-color="rgba(90,14,10,0.88)"/>
    </radialGradient>
    <radialGradient id="blackPieceGrad" cx="35%" cy="28%" r="75%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/><stop offset="18%" stop-color="rgba(160,160,160,0.4)"/>
      <stop offset="55%" stop-color="rgba(30,30,30,0.78)"/><stop offset="100%" stop-color="rgba(4,4,4,0.92)"/>
    </radialGradient>
  `;
  svg.appendChild(defs);

  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('x',0); bg.setAttribute('y',0); bg.setAttribute('width',svgW); bg.setAttribute('height',svgH);
  bg.setAttribute('rx',10); bg.setAttribute('class','board-bg');
  svg.appendChild(bg);

  const g = document.createElementNS(ns,'g'); g.setAttribute('id','gridGroup');

  for(let r=0;r<10;r++){
    const line = document.createElementNS(ns,'line');
    line.setAttribute('x1', boardX(0)); line.setAttribute('y1', boardY(r));
    line.setAttribute('x2', boardX(8)); line.setAttribute('y2', boardY(r));
    line.setAttribute('class', (r===0||r===9) ? 'border-line' : 'gridline');
    g.appendChild(line);
  }
  for(let c=0;c<9;c++){
    if(c===0 || c===8){
      const line = document.createElementNS(ns,'line');
      line.setAttribute('x1', boardX(c)); line.setAttribute('y1', boardY(0));
      line.setAttribute('x2', boardX(c)); line.setAttribute('y2', boardY(9));
      line.setAttribute('class','border-line'); g.appendChild(line);
    } else {
      const l1 = document.createElementNS(ns,'line');
      l1.setAttribute('x1', boardX(c)); l1.setAttribute('y1', boardY(0));
      l1.setAttribute('x2', boardX(c)); l1.setAttribute('y2', boardY(4));
      l1.setAttribute('class','gridline'); g.appendChild(l1);
      const l2 = document.createElementNS(ns,'line');
      l2.setAttribute('x1', boardX(c)); l2.setAttribute('y1', boardY(5));
      l2.setAttribute('x2', boardX(c)); l2.setAttribute('y2', boardY(9));
      l2.setAttribute('class','gridline'); g.appendChild(l2);
    }
  }

  function palaceX(pRow){
    const l1 = document.createElementNS(ns,'line');
    l1.setAttribute('x1', boardX(3)); l1.setAttribute('y1', boardY(pRow));
    l1.setAttribute('x2', boardX(5)); l1.setAttribute('y2', boardY(pRow+2));
    l1.setAttribute('class','palace-line'); g.appendChild(l1);
    const l2 = document.createElementNS(ns,'line');
    l2.setAttribute('x1', boardX(5)); l2.setAttribute('y1', boardY(pRow));
    l2.setAttribute('x2', boardX(3)); l2.setAttribute('y2', boardY(pRow+2));
    l2.setAttribute('class','palace-line'); g.appendChild(l2);
  }
  palaceX(0); palaceX(7);

  const riverText = document.createElementNS(ns,'text');
  riverText.setAttribute('x', svgW/2); riverText.setAttribute('y', boardY(4.5)+9);
  riverText.setAttribute('text-anchor','middle'); riverText.setAttribute('class','river-text');
  riverText.textContent = '楚 河          漢 界';
  g.appendChild(riverText);

  svg.appendChild(g);

  const hitLayer = document.createElementNS(ns,'g'); hitLayer.setAttribute('id','hitLayer');
  for(let r=0;r<10;r++) for(let c=0;c<9;c++){
    const rect = document.createElementNS(ns,'rect');
    rect.setAttribute('x', boardX(c)-CELL/2); rect.setAttribute('y', boardY(r)-CELL/2);
    rect.setAttribute('width', CELL); rect.setAttribute('height', CELL);
    rect.setAttribute('class','sq-hit');
    rect.addEventListener('click', ()=>onSquareClick(r,c));
    hitLayer.appendChild(rect);
  }
  svg.appendChild(hitLayer);

  const markerLayer = document.createElementNS(ns,'g'); markerLayer.setAttribute('id','markerLayer'); svg.appendChild(markerLayer);
  const pieceLayer = document.createElementNS(ns,'g'); pieceLayer.setAttribute('id','pieceLayer'); svg.appendChild(pieceLayer);
}

const pieceElements = new Map();

function createPieceElement(p){
  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns,'g'); group.setAttribute('class','piece-group');
  const visual = document.createElementNS(ns,'g'); visual.setAttribute('class','piece-visual');

  const shadow = document.createElementNS(ns,'circle');
  shadow.setAttribute('cx',1.5); shadow.setAttribute('cy',3); shadow.setAttribute('r',24); shadow.setAttribute('class','piece-shadow');
  visual.appendChild(shadow);

  const base = document.createElementNS(ns,'circle');
  base.setAttribute('cx',0); base.setAttribute('cy',0); base.setAttribute('r',24);
  base.setAttribute('fill', p.color==='red' ? 'url(#redPieceGrad)' : 'url(#blackPieceGrad)');
  base.setAttribute('stroke', p.color==='red' ? '#7a1410' : '#000'); base.setAttribute('stroke-width','1.6');
  visual.appendChild(base);

  const glyph = document.createElementNS(ns,'text');
  glyph.setAttribute('x',0); glyph.setAttribute('y',1); glyph.setAttribute('font-size', 23);
  glyph.setAttribute('class', 'piece-glyph ' + p.color);
  glyph.textContent = GLYPHS[p.color][p.type];
  visual.appendChild(glyph);

  const ring = document.createElementNS(ns,'circle');
  ring.setAttribute('cx',0); ring.setAttribute('cy',0); ring.setAttribute('r',27); ring.setAttribute('class','piece-ring');
  visual.appendChild(ring);

  group.appendChild(visual);
  group.addEventListener('click', (e)=>{ e.stopPropagation(); onSquareClick(+group.dataset.r, +group.dataset.c); });
  return group;
}

function getActiveBoard(){
  if(state.viewIndex >= 0 && state.viewIndex < state.history.length){
    return state.history[state.viewIndex].boardSnapshot;
  }
  return state.board;
}

function renderPieces(){
  const layer = document.getElementById('pieceLayer');
  const boardToRender = getActiveBoard();
  const stillOnBoard = new Set();

  for(let r=0;r<10;r++) for(let c=0;c<9;c++){
    const p = boardToRender[r][c]; if(!p) continue;
    stillOnBoard.add(p);
    const x = boardX(c), y = boardY(r);
    const isSel = state.selected && state.selected.r===r && state.selected.c===c;
    let group = pieceElements.get(p);

    if(!group){
      group = createPieceElement(p); pieceElements.set(p, group); layer.appendChild(group);
      group.style.transition = 'none'; group.setAttribute('transform', `translate(${x},${y})`);
      group.classList.add('piece-enter');
      void group.getBoundingClientRect();
      requestAnimationFrame(()=>{ group.style.transition = ''; group.classList.remove('piece-enter'); });
    } else {
      group.setAttribute('transform', `translate(${x},${y})`);
    }

    group.dataset.r = r; group.dataset.c = c;
    group.classList.toggle('piece-selected', !!isSel);
    group.classList.toggle('disabled', !isHumanTurn() || state.viewIndex !== -1 || state.online.isSpectator);
  }

  for(const [p, group] of pieceElements.entries()){
    if(!stillOnBoard.has(p)){
      group.classList.add('piece-captured');
      pieceElements.delete(p);
      setTimeout(()=>{ if(group.parentNode) group.parentNode.removeChild(group); }, 340);
    }
  }
}

function resetPieceLayer(){
  const layer = document.getElementById('pieceLayer');
  while(layer.firstChild) layer.removeChild(layer.firstChild);
  pieceElements.clear();
}

function renderMarkers(){
  const ns = 'http://www.w3.org/2000/svg';
  const layer = document.getElementById('markerLayer');
  while(layer.firstChild) layer.removeChild(layer.firstChild);

  let activeLastMove = state.lastMove;
  if(state.viewIndex >= 0 && state.viewIndex < state.history.length){
    const h = state.history[state.viewIndex];
    activeLastMove = {from: h.from, to: h.to};
  }

  if(activeLastMove){
    for(const pos of [activeLastMove.from, activeLastMove.to]){
      const rect = document.createElementNS(ns,'rect');
      rect.setAttribute('x', boardX(pos.c)-26); rect.setAttribute('y', boardY(pos.r)-26);
      rect.setAttribute('width', 52); rect.setAttribute('height', 52); rect.setAttribute('rx', 6);
      rect.setAttribute('class','last-move-marker'); layer.appendChild(rect);
    }
  }

  if(state.viewIndex === -1){
    for(const t of state.legalTargets){
      const x = boardX(t.c), y = boardY(t.r);
      const el = document.createElementNS(ns,'circle');
      el.setAttribute('cx',x); el.setAttribute('cy',y);
      if(t.capture){ el.setAttribute('r',27); el.setAttribute('class','move-dot capture-ring'); }
      else { el.setAttribute('r',7.5); el.setAttribute('class','move-dot'); }
      layer.appendChild(el);
    }
  }
}

function isHumanTurn(){
  if(state.online.isSpectator) return false;
  if(state.online.active) return state.turn === state.online.color;
  if(state.mode==='pvp') return true;
  return state.turn === state.humanColor;
}

function onSquareClick(r,c){
  if(state.gameOver || state.viewIndex !== -1 || state.online.isSpectator) return;

  if(state.cheat.killMode && state.mode!=='pvp' && !state.online.active){
    const target = state.board[r][c];
    if(target && target.color===(state.humanColor==='red'?'black':'red')){ cheatKillPiece(r,c); return; }
  }

  if(state.aiThinking || !isHumanTurn()) return;
  const p = state.board[r][c];

  if(state.selected){
    const target = state.legalTargets.find(t=>t.r===r && t.c===c);
    if(target){ doMove(state.selected, {r,c}); return; }
    if(p && p.color===state.turn){ selectSquare(r,c); return; }
    clearSelection(); return;
  }
  if(p && p.color===state.turn) selectSquare(r,c);
}

function selectSquare(r,c){
  const moves = allLegalMoves(state.board, state.turn).filter(m=>m.from.r===r && m.from.c===c);
  state.selected = {r,c};
  state.legalTargets = moves.map(m=>({r:m.to.r,c:m.to.c,capture:m.capture}));
  renderPieces(); renderMarkers();
}

function clearSelection(){
  state.selected = null; state.legalTargets = [];
  renderPieces(); renderMarkers();
}

function doMove(from, to){
  const movingPiece = state.board[from.r][from.c];
  const captured = state.board[to.r][to.c];

  state.board[to.r][to.c] = movingPiece;
  state.board[from.r][from.c] = null;
  state.lastMove = {from, to};
  state.selected = null; state.legalTargets = [];

  // Sound effects
  if(captured) Sound.playCapture();
  else Sound.playMove();

  state.history.push({
    from:{...from}, to:{...to},
    piece: movingPiece, captured: captured || null,
    boardSnapshot: cloneBoard(state.board)
  });

  if(captured) addCapturedChip(captured);
  addHistoryEntry(state.history[state.history.length-1]);

  state.turn = state.turn==='red' ? 'black' : 'red';

  renderPieces(); renderMarkers(); updateStatus(); updateUndoBtn();

  if(isInCheck(state.board, state.turn)) Sound.playCheck();

  checkGameEnd();

  if(state.online.active && !state.online.isSpectator){
    showOnlineActive(); fbPushState();
  }

  if(!state.gameOver && !state.online.active && state.mode!=='pvp' && state.turn!==state.humanColor){
    triggerAiMove();
  }
}

function triggerAiMove(){
  state.aiThinking = true; updateTurnIndicator();
  const cfg = AI_LEVELS[Math.min(Math.max(state.aiLevel,1),10) - 1];
  state.aiTimeoutId = setTimeout(()=>{
    state.aiTimeoutId = null;
    const move = aiBestMove(state.board, state.turn, state.aiLevel);
    state.aiThinking = false;
    if(move) doMove(move.from, move.to);
  }, 220 + cfg.depth * 90);
}

function checkGameEnd(){
  const moves = allLegalMoves(state.board, state.turn);
  if(moves.length===0){
    state.gameOver = true;
    if(isInCheck(state.board, state.turn)){
      const winner = state.turn==='red' ? 'black' : 'red';
      Sound.playWin();
      launchConfetti();
      showGameOver(winner==='red' ? 'Đỏ Thắng!' : 'Đen Thắng!', `Chiếu bí — ${winner==='red'?'Đỏ':'Đen'} đã hạ tướng đối phương.`);
    } else {
      showGameOver('Hòa Cờ', 'Bên đi không còn nước hợp lệ — ván cờ kết thúc hòa.');
    }
  }
}

function showGameOver(title, text){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalText').textContent = text;
  document.getElementById('modalBtns').innerHTML = `<button id="modalBtn" onclick="resetGame()">Ván Mới</button>`;
  document.getElementById('modalOverlay').classList.add('show');
}

/* ---------------- Chinese Chess Move Notation (Vietnamese Standard) ---------------- */
const PIECE_NAMES = { general: 'Tướng', advisor: 'Sĩ', elephant: 'Tượng', horse: 'Mã', chariot: 'Xe', cannon: 'Pháo', soldier: 'Binh' };
const NUM_MAP = ['1','2','3','4','5','6','7','8','9'];

function formatMoveNotation(entry){
  const p = entry.piece;
  const isRed = p.color === 'red';
  const name = PIECE_NAMES[p.type] || 'Quân';
  
  // Transform columns (Red: 9..1 from right to left, Black: 1..9 from left to right)
  const fromCol = isRed ? (9 - entry.from.c) : (entry.from.c + 1);
  const toCol = isRed ? (9 - entry.to.c) : (entry.to.c + 1);
  
  let action = '';
  if(entry.from.r === entry.to.r){
    action = `bình ${NUM_MAP[toCol-1]}`;
  } else {
    const isAdvancing = isRed ? (entry.to.r < entry.from.r) : (entry.to.r > entry.from.r);
    const steps = Math.abs(entry.to.r - entry.from.r);
    const verb = isAdvancing ? 'tấn' : 'thoái';
    
    if(['chariot', 'cannon', 'general', 'soldier'].includes(p.type) && entry.from.c === entry.to.c){
      action = `${verb} ${NUM_MAP[steps-1]}`;
    } else {
      action = `${verb} ${NUM_MAP[toCol-1]}`;
    }
  }
  return `${name} ${NUM_MAP[fromCol-1]} ${action}`;
}

function addHistoryEntry(entry){
  const box = document.getElementById('historyBox');
  const index = state.history.length - 1;
  const div = document.createElement('div');
  div.className = 'history-item';
  div.dataset.index = index;
  div.innerHTML = `<span><b>${index+1}.</b> [${entry.piece.color==='red'?'Đỏ':'Đen'}] ${formatMoveNotation(entry)}</span>${entry.captured? `<span style="color:#ff8b6a;">×${GLYPHS[entry.captured.color][entry.captured.type]}</span>`:''}`;
  div.addEventListener('click', ()=> jumpToReplay(index));
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  updateReplayUI();
}

/* ---------------- Replay System ---------------- */
function jumpToReplay(index){
  if(index < -1 || index >= state.history.length) return;
  state.viewIndex = index;
  renderPieces(); renderMarkers(); updateReplayUI();
}

function updateReplayUI(){
  document.querySelectorAll('.history-item').forEach((el, i)=>{
    el.classList.toggle('active', i === state.viewIndex);
  });
}

document.getElementById('repFirst').addEventListener('click', ()=> jumpToReplay(0));
document.getElementById('repPrev').addEventListener('click', ()=> jumpToReplay(state.viewIndex > 0 ? state.viewIndex - 1 : (state.viewIndex === -1 ? state.history.length - 2 : -1)));
document.getElementById('repNext').addEventListener('click', ()=> jumpToReplay(state.viewIndex < state.history.length - 1 ? state.viewIndex + 1 : -1));
document.getElementById('repLast').addEventListener('click', ()=> jumpToReplay(-1));

/* ---------------- Theme System ---------------- */
document.getElementById('themeSelect').addEventListener('change', (e)=>{
  document.body.className = '';
  if(e.target.value !== 'default') document.body.classList.add('theme-' + e.target.value);
});

/* ---------------- Online / Firebase Integration ---------------- */
function fbAvailable(){ return typeof firebase !== 'undefined' && CONFIG?.firebase?.apiKey; }
function fbInit(){ if(!fb.app){ fb.app = firebase.initializeApp(CONFIG.firebase); fb.db = firebase.database(); } }

function startRemoteGame(color, isSpectator=false){
  state.online.active = true;
  state.online.color = color;
  state.online.isSpectator = isSpectator;
  state.mode = 'pvp';
  resetGame();
  showOnlineActive();
}

function showOnlineActive(){
  document.getElementById('onlineIdle').style.display = 'none';
  document.getElementById('onlineActive').style.display = '';
  document.getElementById('roomCodeDisplay').textContent = state.online.isSpectator ? 'Khán Giả' : (state.online.color==='red' ? 'Đỏ' : 'Đen');
  document.getElementById('onlineRoleLabel').textContent = `Mã phòng: ${state.online.roomCode}`;
}

async function fbCreateRoom(){
  if(!fbAvailable()) return;
  fbInit();
  const code = Math.random().toString(36).substring(2,7).toUpperCase();
  fb.room = code; fb.roomRef = fb.db.ref('rooms/'+code);
  startRemoteGame('red');
  state.online.roomCode = code;
  await fb.roomRef.set({ boardJSON: JSON.stringify(state.board), turn: state.turn, version: 1 });
  fbListen();
}

async function fbJoinRoom(isSpectator=false){
  if(!fbAvailable()) return;
  const code = document.getElementById('fbJoinCodeInput').value.trim().toUpperCase();
  if(!code) return;
  fbInit();
  fb.room = code; fb.roomRef = fb.db.ref('rooms/'+code);
  const snap = await fb.roomRef.once('value');
  if(!snap.val()) return;
  startRemoteGame(isSpectator ? 'spectator' : 'black', isSpectator);
  state.online.roomCode = code;
  fbListen();
}

function fbListen(){
  if(!fb.roomRef) return;
  fb.roomRef.on('value', snap => {
    const data = snap.val();
    if(!data) return;
    if(data.version !== state.online.version){
      state.board = JSON.parse(data.boardJSON);
      state.turn = data.turn;
      state.online.version = data.version;
      renderPieces(); renderMarkers(); updateStatus();
    }
  });

  // Chat Listener
  fb.chatRef = fb.db.ref('chats/' + fb.room);
  fb.chatRef.on('child_added', snap => {
    const msg = snap.val();
    if(msg) renderChatMessage(msg);
  });

  // Undo Listener
  fb.undoRef = fb.db.ref('undos/' + fb.room);
  fb.undoRef.on('value', snap => {
    const val = snap.val();
    if(val && val.target === state.online.color && val.status === 'pending'){
      promptUndoRequest();
    } else if(val && val.sender === state.online.color && val.status === 'accepted'){
      undo();
      fb.undoRef.remove();
    }
  });
}

function fbPushState(){
  if(!fb.roomRef || state.online.isSpectator) return;
  state.online.version++;
  fb.roomRef.update({ boardJSON: JSON.stringify(state.board), turn: state.turn, version: state.online.version });
}

/* Chat Functions */
document.getElementById('sendChatBtn').addEventListener('click', sendChatMessage);
document.getElementById('chatInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendChatMessage(); });

function sendChatMessage(){
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text || !fb.chatRef) return;
  fb.chatRef.push({ sender: state.online.isSpectator ? 'Khán giả' : (state.online.color==='red'?'Đỏ':'Đen'), text });
  input.value = '';
}

function renderChatMessage(msg){
  const box = document.getElementById('chatMessages');
  const div = document.createElement('div');
  const isMe = msg.sender === (state.online.isSpectator ? 'Khán giả' : (state.online.color==='red'?'Đỏ':'Đen'));
  div.className = `chat-msg ${isMe ? 'me' : ''}`;
  div.textContent = `${msg.sender}: ${msg.text}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

/* Undo Request System */
function requestOnlineUndo(){
  if(state.online.active && !state.online.isSpectator && fb.undoRef){
    fb.undoRef.set({ sender: state.online.color, target: state.online.color==='red'?'black':'red', status: 'pending' });
    alert('Đã gửi yêu cầu xin đi lại tới đối thủ.');
  } else {
    undo();
  }
}

function promptUndoRequest(){
  document.getElementById('modalTitle').textContent = 'Yêu Cầu Đi Lại';
  document.getElementById('modalText').textContent = 'Đối thủ muốn xin đi lại nước vừa rồi. Bạn có đồng ý không?';
  document.getElementById('modalBtns').innerHTML = `
    <button onclick="acceptUndo()">Đồng ý</button>
    <button class="sec" onclick="rejectUndo()">Từ chối</button>
  `;
  document.getElementById('modalOverlay').classList.add('show');
}

function acceptUndo(){
  document.getElementById('modalOverlay').classList.remove('show');
  undo();
  if(fb.undoRef) fb.undoRef.update({ status: 'accepted' });
}

function rejectUndo(){
  document.getElementById('modalOverlay').classList.remove('show');
  if(fb.undoRef) fb.undoRef.remove();
}

/* UI Updates & Base Helpers */
function updateTurnIndicator(){
  const dot = document.getElementById('turnDot');
  const label = document.getElementById('turnLabel');
  dot.className = 'turn-dot ' + state.turn;
  label.textContent = state.aiThinking ? `Máy đang nghĩ...` : `Lượt của ${state.turn==='red'?'Đỏ':'Đen'}`;
}

function updateStatus(){
  const msg = document.getElementById('statusMsg');
  if(state.gameOver){ msg.textContent=''; return; }
  msg.textContent = isInCheck(state.board, state.turn) ? `⚠ ${state.turn==='red'?'Đỏ':'Đen'} đang bị chiếu!` : '';
  msg.classList.toggle('check', isInCheck(state.board, state.turn));
  updateTurnIndicator();
}

function addCapturedChip(piece){
  const container = document.getElementById(piece.color==='red' ? 'capturedRed' : 'capturedBlack');
  const chip = document.createElement('div');
  chip.className = 'cap-chip ' + piece.color;
  chip.textContent = GLYPHS[piece.color][piece.type];
  container.appendChild(chip);
}

function updateUndoBtn(){ document.getElementById('undoBtn').disabled = state.history.length===0; }

function undo(){
  if(state.history.length===0) return;
  const steps = (state.mode!=='pvp' && !state.online.active) ? 2 : 1;
  for(let i=0;i<steps;i++){
    const last = state.history.pop();
    if(!last) break;
    state.board[last.from.r][last.from.c] = last.piece;
    state.board[last.to.r][last.to.c] = last.captured;
    document.getElementById('historyBox').lastChild?.remove();
  }
  state.viewIndex = -1;
  state.turn = state.history.length ? (state.history[state.history.length-1].piece.color === 'red' ? 'black' : 'red') : 'red';
  state.gameOver = false;
  renderPieces(); renderMarkers(); updateStatus(); updateUndoBtn();
}

function resetGame(){
  state.board = initialBoard(); state.turn = 'red'; state.selected = null; state.legalTargets = [];
  state.history = []; state.viewIndex = -1; state.gameOver = false; state.lastMove = null;
  document.getElementById('capturedRed').innerHTML=''; document.getElementById('capturedBlack').innerHTML='';
  document.getElementById('historyBox').innerHTML=''; document.getElementById('modalOverlay').classList.remove('show');
  resetPieceLayer(); renderPieces(); renderMarkers(); updateStatus(); updateUndoBtn();
}

/* Cheat Functions */
function cheatKillPiece(r,c){
  const target = state.board[r][c]; if(!target) return;
  state.board[r][c] = null; addCapturedChip(target); renderPieces();
  if(target.type==='general') showGameOver('Đỏ Thắng!', 'Đã trảm tướng địch.');
}

/* Event Listeners Setup */
document.getElementById('menuFab').addEventListener('click', ()=> document.getElementById('drawer').classList.toggle('open'));
document.getElementById('drawerClose').addEventListener('click', ()=> document.getElementById('drawer').classList.remove('open'));
document.getElementById('undoBtn').addEventListener('click', requestOnlineUndo);
document.getElementById('resetBtn').addEventListener('click', resetGame);
document.getElementById('fbCreateRoomBtn').addEventListener('click', fbCreateRoom);
document.getElementById('fbJoinRoomBtn').addEventListener('click', ()=> fbJoinRoom(false));
document.getElementById('fbSpectateBtn').addEventListener('click', ()=> fbJoinRoom(true));

async function loadConfigAndInit(){
  try{
    const res = await fetch('config.json');
    CONFIG = await res.json();
  }catch(e){
    CONFIG = {
      board:{cols:9,rows:10,cell:62,margin:34,svgWidth:558,svgHeight:620},
      initialSetup:{backRow:["chariot","horse","elephant","advisor","general","advisor","elephant","horse","chariot"],cannons:[[2,1],[2,7],[7,1],[7,7]],soldierCols:[0,2,4,6,8],soldierRows:{black:3,red:6}},
      pieceValues:{general:100000,advisor:200,elephant:200,horse:450,chariot:900,cannon:480,soldier:100}, soldierCrossedBonus:90,
      glyphs:{red:{"general":"帥","advisor":"仕","elephant":"相","horse":"傌","chariot":"俥","cannon":"炮","soldier":"兵"},black:{"general":"將","advisor":"士","elephant":"象","horse":"馬","chariot":"車","cannon":"砲","soldier":"卒"}}
    };
  }
  VALUES = CONFIG.pieceValues; GLYPHS = CONFIG.glyphs;
  buildStaticBoard(); resetGame();
}

loadConfigAndInit();
