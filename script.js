let COLS = 9, ROWS = 10;
let CELL = 62, MARGIN = 34;
let svgW = 558, svgH = 620;
let CONFIG = null;

function emptyBoard(){
  return Array.from({length:ROWS}, ()=>Array(COLS).fill(null));
}

function initialBoard(){
  const b = emptyBoard();
  const setup = CONFIG.initialSetup;
  for(let c=0;c<9;c++){
    b[0][c] = {type:setup.backRow[c], color:'black'};
    b[9][c] = {type:setup.backRow[c], color:'red'};
  }
  for(const [r,c] of setup.cannons){
    const color = r < 5 ? 'black' : 'red';
    b[r][c] = {type:'cannon', color};
  }
  for(const c of setup.soldierCols){
    b[setup.soldierRows.black][c] = {type:'soldier', color:'black'};
    b[setup.soldierRows.red][c] = {type:'soldier', color:'red'};
  }
  return b;
}

function cloneBoard(b){
  return b.map(row=>row.map(p=>p?{type:p.type,color:p.color}:null));
}

function inBounds(r,c){ return r>=0 && r<ROWS && c>=0 && c<COLS; }
function inPalace(r,c,color){
  if(c<3||c>5) return false;
  return color==='black' ? (r>=0&&r<=2) : (r>=7&&r<=9);
}
function crossedRiver(r,color){
  return color==='black' ? r>=5 : r<=4;
}

function pieceMoves(board, r, c){
  const p = board[r][c];
  if(!p) return [];
  const moves = [];
  const push = (nr,nc)=>{
    if(!inBounds(nr,nc)) return false;
    const target = board[nr][nc];
    if(target && target.color === p.color) return false;
    moves.push({r:nr,c:nc, capture: !!target});
    return !target;
  };

  switch(p.type){
    case 'general': {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for(const [dr,dc] of dirs){
        const nr=r+dr, nc=c+dc;
        if(inPalace(nr,nc,p.color)) push(nr,nc);
      }
      break;
    }
    case 'advisor': {
      const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
      for(const [dr,dc] of dirs){
        const nr=r+dr, nc=c+dc;
        if(inPalace(nr,nc,p.color)) push(nr,nc);
      }
      break;
    }
    case 'elephant': {
      const dirs = [[-2,-2],[-2,2],[2,-2],[2,2]];
      for(const [dr,dc] of dirs){
        const nr=r+dr, nc=c+dc;
        const er=r+dr/2, ec=c+dc/2;
        if(!inBounds(nr,nc)) continue;
        if(crossedRiver(nr,p.color)) continue;
        if(board[er][ec]) continue;
        push(nr,nc);
      }
      break;
    }
    case 'horse': {
      const steps = [
        {dr:-2,dc:-1, leg:[-1,0]}, {dr:-2,dc:1, leg:[-1,0]},
        {dr:2,dc:-1, leg:[1,0]},   {dr:2,dc:1, leg:[1,0]},
        {dr:-1,dc:-2, leg:[0,-1]}, {dr:1,dc:-2, leg:[0,-1]},
        {dr:-1,dc:2, leg:[0,1]},   {dr:1,dc:2, leg:[0,1]}
      ];
      for(const s of steps){
        const legR = r+s.leg[0], legC = c+s.leg[1];
        if(inBounds(legR,legC) && board[legR][legC]) continue;
        const nr=r+s.dr, nc=c+s.dc;
        push(nr,nc);
      }
      break;
    }
    case 'chariot': {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for(const [dr,dc] of dirs){
        let nr=r+dr, nc=c+dc;
        while(inBounds(nr,nc)){
          const cont = push(nr,nc);
          if(!cont) break;
          nr+=dr; nc+=dc;
        }
      }
      break;
    }
    case 'cannon': {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for(const [dr,dc] of dirs){
        let nr=r+dr, nc=c+dc;
        let screenFound = false;
        while(inBounds(nr,nc)){
          const target = board[nr][nc];
          if(!screenFound){
            if(!target){
              moves.push({r:nr,c:nc,capture:false});
            } else {
              screenFound = true;
            }
          } else {
            if(target){
              if(target.color !== p.color){
                moves.push({r:nr,c:nc,capture:true});
              }
              break;
            }
          }
          nr+=dr; nc+=dc;
        }
      }
      break;
    }
    case 'soldier': {
      const fwd = p.color==='red' ? -1 : 1;
      push(r+fwd, c);
      if(crossedRiver(r,p.color)){
        push(r, c-1);
        push(r, c+1);
      }
      break;
    }
  }
  return moves;
}

function findGeneral(board, color){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = board[r][c];
    if(p && p.type==='general' && p.color===color) return {r,c};
  }
  return null;
}

function isSquareAttacked(board, r, c, byColor){
  for(let rr=0; rr<ROWS; rr++){
    for(let cc=0; cc<COLS; cc++){
      const p = board[rr][cc];
      if(p && p.color===byColor){
        const mv = pieceMoves(board, rr, cc);
        for(const m of mv){
          if(m.r===r && m.c===c) return true;
        }
      }
    }
  }
  return false;
}

function generalsFacing(board){
  const red = findGeneral(board,'red');
  const black = findGeneral(board,'black');
  if(!red || !black) return false;
  if(red.c !== black.c) return false;
  const [top,bot] = red.r < black.r ? [red,black] : [black,red];
  for(let r=top.r+1; r<bot.r; r++){
    if(board[r][red.c]) return false;
  }
  return true;
}

function isInCheck(board, color){
  const g = findGeneral(board, color);
  if(!g) return true;
  const enemy = color==='red' ? 'black' : 'red';
  if(isSquareAttacked(board, g.r, g.c, enemy)) return true;
  if(generalsFacing(board)) return true;
  return false;
}

function allLegalMoves(board, color){
  const result = [];
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const p = board[r][c];
      if(p && p.color===color){
        const pseudo = pieceMoves(board, r, c);
        for(const m of pseudo){
          const nb = cloneBoard(board);
          nb[m.r][m.c] = nb[r][c];
          nb[r][c] = null;
          if(!isInCheck(nb, color)){
            result.push({from:{r,c}, to:{r:m.r,c:m.c}, capture:m.capture});
          }
        }
      }
    }
  }
  return result;
}

let VALUES = {};
let SOLDIER_CROSSED_BONUS = 90;
function soldierBonus(p, r){
  if(p.type!=='soldier') return 0;
  const crossed = crossedRiver(r, p.color);
  return crossed ? SOLDIER_CROSSED_BONUS : 0;
}

function evaluate(board){
  let score = 0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = board[r][c];
    if(!p) continue;
    let v = VALUES[p.type] + soldierBonus(p,r);
    if(p.type==='horse' || p.type==='cannon'){
      const centerDist = Math.abs(c-4);
      v += (4-centerDist)*3;
    }
    score += (p.color==='red') ? v : -v;
  }
  return score;
}

function minimax(board, depth, alpha, beta, color){
  const inCheckNow = isInCheck(board, color);
  const moves = allLegalMoves(board, color);
  if(moves.length===0){
    if(inCheckNow) return color==='red' ? -999000+depth : 999000-depth;
    return 0;
  }
  if(depth===0){
    return evaluate(board);
  }

  moves.sort((a,b)=> (b.capture?1:0) - (a.capture?1:0));

  if(color==='red'){
    let best = -Infinity;
    for(const m of moves){
      const nb = cloneBoard(board);
      nb[m.to.r][m.to.c] = nb[m.from.r][m.from.c];
      nb[m.from.r][m.from.c] = null;
      const val = minimax(nb, depth-1, alpha, beta, 'black');
      if(val>best) best = val;
      if(best>alpha) alpha = best;
      if(alpha>=beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for(const m of moves){
      const nb = cloneBoard(board);
      nb[m.to.r][m.to.c] = nb[m.from.r][m.from.c];
      nb[m.from.r][m.from.c] = null;
      const val = minimax(nb, depth-1, alpha, beta, 'red');
      if(val<best) best = val;
      if(best<beta) beta = best;
      if(alpha>=beta) break;
    }
    return best;
  }
}

const AI_LEVELS = [
  { depth:1, noise:900  },
  { depth:1, noise:600  },
  { depth:2, noise:400  },
  { depth:2, noise:260  },
  { depth:2, noise:150  },
  { depth:3, noise:90   },
  { depth:3, noise:50   },
  { depth:3, noise:25   },
  { depth:4, noise:10   },
  { depth:4, noise:0    }
];
const LEVEL_NAMES = [
  'Mới học','Vỡ lòng','Nghiệp dư','Khá','Giỏi',
  'Cao thủ','Chuyên nghiệp','Đại kiện tướng','Siêu đẳng','Bất khả chiến bại'
];

const VN_PIECE_NAME = {
  general:'Tướng', advisor:'Sĩ', elephant:'Tượng',
  horse:'Mã', chariot:'Xe', cannon:'Pháo', soldier:'Tốt'
};
function displayCol(c, color){ return color==='red' ? 9-c : c+1; }

function moveNotation(piece, from, to){
  const color = piece.color;
  const name = VN_PIECE_NAME[piece.type];
  const fromCol = displayCol(from.c, color);
  const toCol = displayCol(to.c, color);
  const forwardSign = color==='red' ? -1 : 1;
  let action, target;
  if(from.c === to.c){
    const rows = Math.abs(to.r-from.r);
    action = ((to.r-from.r)*forwardSign > 0) ? 'tiến' : 'thoái';
    target = rows;
  } else if(from.r === to.r){
    action = 'bình';
    target = toCol;
  } else {
    action = ((to.r-from.r)*forwardSign > 0) ? 'tiến' : 'thoái';
    target = toCol;
  }
  return `${name} ${fromCol} ${action} ${target}`;
}

function aiBestMove(board, color, level){
  const cfg = AI_LEVELS[Math.min(Math.max(level,1),10) - 1];
  const moves = allLegalMoves(board, color);
  if(moves.length===0) return null;
  moves.sort((a,b)=> (b.capture?1:0) - (a.capture?1:0));

  let alpha=-Infinity, beta=Infinity;
  let best=null, bestNoisy=-Infinity;
  for(const m of moves){
    const nb = cloneBoard(board);
    nb[m.to.r][m.to.c] = nb[m.from.r][m.from.c];
    nb[m.from.r][m.from.c] = null;
    const raw = minimax(nb, cfg.depth-1, alpha, beta, color==='red'?'black':'red');
    const score = color==='red' ? raw : -raw;
    const noisy = cfg.noise>0 ? score + (Math.random()*2-1)*cfg.noise : score;
    if(noisy>bestNoisy){ bestNoisy=noisy; best=m; }
    if(color==='red'){ if(score>alpha) alpha=score; } else { if(-score<beta) beta=-score; }
  }
  return best;
}

let audioCtx = null;
function getAudioCtx(){
  if(!audioCtx){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(Ctx) audioCtx = new Ctx();
  }
  return audioCtx;
}
function playTone(freq, duration, type, delay, gainStart){
  if(!state.soundOn) return;
  const ctx = getAudioCtx();
  if(!ctx) return;
  if(ctx.state==='suspended') ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + (delay||0);
  gain.gain.setValueAtTime(gainStart!=null?gainStart:0.15, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0+duration);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0+duration+0.02);
}
function sfxMove(){ playTone(340, 0.09, 'triangle'); }
function sfxCapture(){ playTone(200,0.07,'square'); playTone(130,0.09,'square',0.055); }
function sfxCheck(){ playTone(880,0.11,'sine'); playTone(1180,0.14,'sine',0.09); }
function sfxWin(){ [523,659,784,1047].forEach((f,i)=>playTone(f,0.18,'triangle',i*0.11,0.13)); }
function sfxLose(){ [420,360,300,240].forEach((f,i)=>playTone(f,0.22,'sawtooth',i*0.14,0.07)); }
function sfxDraw(){ [500,500].forEach((f,i)=>playTone(f,0.16,'sine',i*0.2,0.1)); }

function sfxGameResult(winnerColor, isDraw){
  if(isDraw){ sfxDraw(); return; }
  let myColor = null;
  if(state.online.active && !state.online.spectator) myColor = state.online.color;
  else if(state.mode==='pve') myColor = state.humanColor;
  if(myColor){
    (winnerColor===myColor) ? sfxWin() : sfxLose();
  } else {
    sfxWin();
  }
}

let confettiRunning = false;
function fireConfetti(){
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth*dpr;
  canvas.height = window.innerHeight*dpr;
  canvas.style.display = 'block';
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const colors = ['#c8973f','#f0ce8e','#3fae7a','#7fe0b4','#b3211a','#f4e8d0'];
  const pieces = [];
  const count = 120;
  for(let i=0;i<count;i++){
    pieces.push({
      x: Math.random()*window.innerWidth,
      y: -20 - Math.random()*window.innerHeight*0.4,
      vx: (Math.random()-0.5)*2.2,
      vy: 2 + Math.random()*2.5,
      size: 5 + Math.random()*5,
      rot: Math.random()*Math.PI*2,
      vrot: (Math.random()-0.5)*0.3,
      color: colors[Math.floor(Math.random()*colors.length)],
      life: 0
    });
  }
  confettiRunning = true;
  const start = performance.now();
  function frame(now){
    if(!confettiRunning) return;
    const elapsed = now-start;
    ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
    let anyAlive = false;
    for(const p of pieces){
      p.x += p.vx; p.y += p.vy; p.vy += 0.045; p.rot += p.vrot; p.life = elapsed;
      if(p.y < window.innerHeight+30) anyAlive = true;
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - elapsed/3200);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);
      ctx.restore();
    }
    if(anyAlive && elapsed<3200){
      requestAnimationFrame(frame);
    } else {
      confettiRunning = false;
      canvas.style.display = 'none';
    }
  }
  requestAnimationFrame(frame);
}

const THEMES = {
  wood: {
    wood1:'#8a5a34', wood2:'#6e4324', wood3:'#4a2c17',
    grain1:'#e7c98d', grain2:'#dab976', grain3:'#c9a563',
    accent:'#3fae7a', accentGlow:'#7fe0b4'
  },
  jade: {
    wood1:'#1f5e46', wood2:'#154536', wood3:'#0c2a20',
    grain1:'#bdeed8', grain2:'#8fd6b8', grain3:'#5fb894',
    accent:'#e0b84a', accentGlow:'#f5d888'
  },
  rosewood: {
    wood1:'#6e2a20', wood2:'#4f1a14', wood3:'#33100c',
    grain1:'#e8ab93', grain2:'#d68467', grain3:'#b96448',
    accent:'#7fe0b4', accentGlow:'#b7f2d8'
  },
  marble: {
    wood1:'#c9c0ac', wood2:'#a89c84', wood3:'#8a7d64',
    grain1:'#f7f2e8', grain2:'#ece2cf', grain3:'#d9c9ac',
    accent:'#3a6ea8', accentGlow:'#7fb0e0'
  },
  royal: {
    wood1:'#4a2d6e', wood2:'#34204f', wood3:'#211433',
    grain1:'#dcc8f5', grain2:'#c3a8ec', grain3:'#a58bd6',
    accent:'#e0b84a', accentGlow:'#f7dd8e'
  },
  midnight: {
    wood1:'#233a5e', wood2:'#182943', wood3:'#0e1a2c',
    grain1:'#c9dcf5', grain2:'#a8c4ea', grain3:'#87a8d6',
    accent:'#c8973f', accentGlow:'#f0ce8e'
  },
  sakura: {
    wood1:'#b95a72', wood2:'#8f3d52', wood3:'#602737',
    grain1:'#ffd9e4', grain2:'#ffb8cd', grain3:'#f294b3',
    accent:'#5fb894', accentGlow:'#9fe3c4'
  },
  obsidian: {
    wood1:'#2b2b2e', wood2:'#1c1c1f', wood3:'#101012',
    grain1:'#e8c976', grain2:'#c9a55a', grain3:'#a3823f',
    accent:'#c8973f', accentGlow:'#f0ce8e'
  }
};
const THEME_STORAGE_KEY = 'co-tuong-theme';

function applyTheme(themeId){
  const t = THEMES[themeId] || THEMES.wood;
  const root = document.documentElement.style;
  root.setProperty('--wood-1', t.wood1);
  root.setProperty('--wood-2', t.wood2);
  root.setProperty('--wood-3', t.wood3);
  root.setProperty('--jade', t.accent);
  root.setProperty('--jade-glow', t.accentGlow);

  const stops = document.querySelectorAll('#woodGrain stop');
  if(stops.length===3){
    stops[0].setAttribute('stop-color', t.grain1);
    stops[1].setAttribute('stop-color', t.grain2);
    stops[2].setAttribute('stop-color', t.grain3);
  }

  document.querySelectorAll('.theme-swatch').forEach(b=>b.classList.toggle('active', b.dataset.theme===themeId));
  try{ localStorage.setItem(THEME_STORAGE_KEY, themeId); }catch(err){}
}

function loadSavedTheme(){
  let saved = 'wood';
  try{ saved = localStorage.getItem(THEME_STORAGE_KEY) || 'wood'; }catch(err){}
  applyTheme(saved);
}

let GLYPHS = {};

let state = {
  board: emptyBoard(),
  turn: 'red',
  selected: null,
  legalTargets: [],
  history: [],
  mode: 'pvp',
  aiLevel: 5,
  humanColor: 'red',
  gameOver: false,
  lastMove: null,
  aiThinking: false,
  aiTimeoutId: null,
  online: { active:false, room:null, color:null, pollTimer:null, version:0, transport:null, roomCode:null, spectator:false },
  cheat: { killMode:false },
  currentSave: null,
  soundOn: true,
  replay: { active:false, moves:[], index:0, savedBoard:null, savedTurn:null }
};

let fb = { app:null, db:null, roomRef:null, room:null };

const svg = document.getElementById('boardSvg');

function boardX(c){ return MARGIN + c*CELL; }
function boardY(r){ return MARGIN + r*CELL; }

function buildStaticBoard(){
  const ns = 'http://www.w3.org/2000/svg';
  while(svg.firstChild) svg.removeChild(svg.firstChild);

  const defs = document.createElementNS(ns,'defs');
  defs.innerHTML = `
    <linearGradient id="woodGrain" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e7c98d"/>
      <stop offset="45%" stop-color="#dab976"/>
      <stop offset="100%" stop-color="#c9a563"/>
    </linearGradient>
    <radialGradient id="redPieceGrad" cx="35%" cy="28%" r="75%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.55)"/>
      <stop offset="18%" stop-color="rgba(255,190,170,0.55)"/>
      <stop offset="55%" stop-color="rgba(179,33,26,0.72)"/>
      <stop offset="100%" stop-color="rgba(90,14,10,0.88)"/>
    </radialGradient>
    <radialGradient id="blackPieceGrad" cx="35%" cy="28%" r="75%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
      <stop offset="18%" stop-color="rgba(160,160,160,0.4)"/>
      <stop offset="55%" stop-color="rgba(30,30,30,0.78)"/>
      <stop offset="100%" stop-color="rgba(4,4,4,0.92)"/>
    </radialGradient>
  `;
  svg.appendChild(defs);

  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('x',0); bg.setAttribute('y',0);
  bg.setAttribute('width',svgW); bg.setAttribute('height',svgH);
  bg.setAttribute('rx',10);
  bg.setAttribute('class','board-bg');
  svg.appendChild(bg);

  const g = document.createElementNS(ns,'g');
  g.setAttribute('id','gridGroup');

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
      line.setAttribute('class','border-line');
      g.appendChild(line);
    } else {
      const l1 = document.createElementNS(ns,'line');
      l1.setAttribute('x1', boardX(c)); l1.setAttribute('y1', boardY(0));
      l1.setAttribute('x2', boardX(c)); l1.setAttribute('y2', boardY(4));
      l1.setAttribute('class','gridline');
      g.appendChild(l1);
      const l2 = document.createElementNS(ns,'line');
      l2.setAttribute('x1', boardX(c)); l2.setAttribute('y1', boardY(5));
      l2.setAttribute('x2', boardX(c)); l2.setAttribute('y2', boardY(9));
      l2.setAttribute('class','gridline');
      g.appendChild(l2);
    }
  }

  function palaceX(pRow){
    const l1 = document.createElementNS(ns,'line');
    l1.setAttribute('x1', boardX(3)); l1.setAttribute('y1', boardY(pRow));
    l1.setAttribute('x2', boardX(5)); l1.setAttribute('y2', boardY(pRow+2));
    l1.setAttribute('class','palace-line');
    g.appendChild(l1);
    const l2 = document.createElementNS(ns,'line');
    l2.setAttribute('x1', boardX(5)); l2.setAttribute('y1', boardY(pRow));
    l2.setAttribute('x2', boardX(3)); l2.setAttribute('y2', boardY(pRow+2));
    l2.setAttribute('class','palace-line');
    g.appendChild(l2);
  }
  palaceX(0); palaceX(7);

  const riverText = document.createElementNS(ns,'text');
  riverText.setAttribute('x', svgW/2);
  riverText.setAttribute('y', boardY(4.5)+9);
  riverText.setAttribute('text-anchor','middle');
  riverText.setAttribute('class','river-text');
  riverText.textContent = '楚 河          漢 界';
  g.appendChild(riverText);

  const pointCols = [1,7];
  const pointRowsCannon = [2,7];
  const pointRowsSoldier = [3,6];
  function drawPoint(r,c){
    const x = boardX(c), y = boardY(r);
    const offs = [[-8,-8,-4,-8,-8,-4],[8,-8,4,-8,8,-4],[-8,8,-4,8,-8,4],[8,8,4,8,8,4]];

    const ticks = [
      {dx1:-9,dy1:-9,dx2:-4,dy2:-9},{dx1:-9,dy1:-9,dx2:-9,dy2:-4},
      {dx1:9,dy1:-9,dx2:4,dy2:-9},{dx1:9,dy1:-9,dx2:9,dy2:-4},
      {dx1:-9,dy1:9,dx2:-4,dy2:9},{dx1:-9,dy1:9,dx2:-9,dy2:4},
      {dx1:9,dy1:9,dx2:4,dy2:9},{dx1:9,dy1:9,dx2:9,dy2:4}
    ];
    if(c===0 || c===8){
    }
    for(const t of ticks){
      if((c===0 && (t.dx1<0)) || (c===8 && t.dx1>0)) continue;
      const ln = document.createElementNS(ns,'line');
      ln.setAttribute('x1', x+t.dx1); ln.setAttribute('y1', y+t.dy1);
      ln.setAttribute('x2', x+t.dx2); ln.setAttribute('y2', y+t.dy2);
      ln.setAttribute('class','point');
      g.appendChild(ln);
    }
  }
  for(const c of pointCols) for(const r of pointRowsCannon) drawPoint(r,c);
  for(let c=0;c<9;c+=2) for(const r of pointRowsSoldier) drawPoint(r,c);

  svg.appendChild(g);

  const hitLayer = document.createElementNS(ns,'g');
  hitLayer.setAttribute('id','hitLayer');
  for(let r=0;r<10;r++) for(let c=0;c<9;c++){
    const rect = document.createElementNS(ns,'rect');
    rect.setAttribute('x', boardX(c)-CELL/2);
    rect.setAttribute('y', boardY(r)-CELL/2);
    rect.setAttribute('width', CELL);
    rect.setAttribute('height', CELL);
    rect.setAttribute('class','sq-hit');
    rect.dataset.r = r; rect.dataset.c = c;
    rect.addEventListener('click', ()=>onSquareClick(r,c));
    hitLayer.appendChild(rect);
  }
  svg.appendChild(hitLayer);

  const markerLayer = document.createElementNS(ns,'g');
  markerLayer.setAttribute('id','markerLayer');
  svg.appendChild(markerLayer);

  const pieceLayer = document.createElementNS(ns,'g');
  pieceLayer.setAttribute('id','pieceLayer');
  svg.appendChild(pieceLayer);
}

const pieceElements = new Map();

function createPieceElement(p){
  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns,'g');
  group.setAttribute('class','piece-group');

  const hitArea = document.createElementNS(ns,'circle');
  hitArea.setAttribute('cx',0); hitArea.setAttribute('cy',0);
  hitArea.setAttribute('r', CELL/2);
  hitArea.setAttribute('class','piece-hit-area');
  group.appendChild(hitArea);

  const visual = document.createElementNS(ns,'g');
  visual.setAttribute('class','piece-visual');

  const shadow = document.createElementNS(ns,'circle');
  shadow.setAttribute('cx',1.5); shadow.setAttribute('cy',3);
  shadow.setAttribute('r',24);
  shadow.setAttribute('class','piece-shadow');
  visual.appendChild(shadow);

  const base = document.createElementNS(ns,'circle');
  base.setAttribute('cx',0); base.setAttribute('cy',0);
  base.setAttribute('r',24);
  base.setAttribute('fill', p.color==='red' ? 'url(#redPieceGrad)' : 'url(#blackPieceGrad)');
  base.setAttribute('stroke', p.color==='red' ? '#7a1410' : '#000');
  base.setAttribute('stroke-width','1.6');
  visual.appendChild(base);

  const rim = document.createElementNS(ns,'circle');
  rim.setAttribute('cx',0); rim.setAttribute('cy',0);
  rim.setAttribute('r',19.5);
  rim.setAttribute('fill','none');
  rim.setAttribute('stroke', p.color==='red' ? 'rgba(255,220,200,0.55)' : 'rgba(255,255,255,0.28)');
  rim.setAttribute('stroke-width','1.2');
  visual.appendChild(rim);

  const glyph = document.createElementNS(ns,'text');
  glyph.setAttribute('x',0); glyph.setAttribute('y',1);
  glyph.setAttribute('font-size', 23);
  glyph.setAttribute('class', 'piece-glyph ' + p.color);
  glyph.textContent = GLYPHS[p.color][p.type];
  visual.appendChild(glyph);

  const ring = document.createElementNS(ns,'circle');
  ring.setAttribute('cx',0); ring.setAttribute('cy',0);
  ring.setAttribute('r',27);
  ring.setAttribute('class','piece-ring');
  visual.appendChild(ring);

  group.appendChild(visual);
  group.addEventListener('click', (e)=>{
    e.stopPropagation();
    onSquareClick(+group.dataset.r, +group.dataset.c);
  });

  return group;
}

function renderPieces(){
  const layer = document.getElementById('pieceLayer');
  const stillOnBoard = new Set();

  for(let r=0;r<10;r++) for(let c=0;c<9;c++){
    const p = state.board[r][c];
    if(!p) continue;
    stillOnBoard.add(p);

    const x = boardX(c), y = boardY(r);
    const isSel = state.selected && state.selected.r===r && state.selected.c===c;
    let group = pieceElements.get(p);

    if(!group){
      group = createPieceElement(p);
      pieceElements.set(p, group);
      layer.appendChild(group);
      group.style.transition = 'none';
      group.setAttribute('transform', `translate(${x},${y})`);
      group.classList.add('piece-enter');
      void group.getBoundingClientRect();
      requestAnimationFrame(()=>{
        group.style.transition = '';
        group.classList.remove('piece-enter');
      });
    } else {
      group.setAttribute('transform', `translate(${x},${y})`);
    }

    group.dataset.r = r; group.dataset.c = c;
    group.classList.toggle('piece-selected', !!isSel);
    group.classList.toggle('disabled', !isHumanTurn());
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

  if(state.lastMove){
    for(const pos of [state.lastMove.from, state.lastMove.to]){
      const x = boardX(pos.c), y = boardY(pos.r);
      const rect = document.createElementNS(ns,'rect');
      rect.setAttribute('x', x-26); rect.setAttribute('y', y-26);
      rect.setAttribute('width', 52); rect.setAttribute('height', 52);
      rect.setAttribute('rx', 6);
      rect.setAttribute('class','last-move-marker');
      layer.appendChild(rect);
    }
  }

  for(const t of state.legalTargets){
    const x = boardX(t.c), y = boardY(t.r);
    if(t.capture){
      const ring = document.createElementNS(ns,'circle');
      ring.setAttribute('cx',x); ring.setAttribute('cy',y);
      ring.setAttribute('r',27);
      ring.setAttribute('class','move-dot capture-ring');
      layer.appendChild(ring);
    } else {
      const dot = document.createElementNS(ns,'circle');
      dot.setAttribute('cx',x); dot.setAttribute('cy',y);
      dot.setAttribute('r',7.5);
      dot.setAttribute('class','move-dot');
      layer.appendChild(dot);
    }
  }
}

function isHumanTurn(){
  if(state.online.active) return state.turn === state.online.color;
  if(state.mode==='pvp') return true;
  return state.turn === state.humanColor;
}

function onSquareClick(r,c){
  if(state.gameOver || state.replay.active) return;

  if(state.cheat.killMode && state.mode!=='pvp' && !state.online.active){
    const target = state.board[r][c];
    const aiColor = state.humanColor==='red' ? 'black' : 'red';
    if(target && target.color===aiColor){
      cheatKillPiece(r,c);
      return;
    }
  }

  if(state.aiThinking) return;
  if(!isHumanTurn()) return;

  const p = state.board[r][c];

  if(state.selected){
    const target = state.legalTargets.find(t=>t.r===r && t.c===c);
    if(target){
      doMove(state.selected, {r,c});
      return;
    }
    if(p && p.color===state.turn){
      selectSquare(r,c);
      return;
    }
    clearSelection();
    return;
  }

  if(p && p.color===state.turn){
    selectSquare(r,c);
  }
}

function selectSquare(r,c){
  const moves = allLegalMoves(state.board, state.turn).filter(m=>m.from.r===r && m.from.c===c);
  state.selected = {r,c};
  state.legalTargets = moves.map(m=>({r:m.to.r,c:m.to.c,capture:m.capture}));
  renderPieces();
  renderMarkers();
}

function clearSelection(){
  state.selected = null;
  state.legalTargets = [];
  renderPieces();
  renderMarkers();
}

function doMove(from, to, opts={}){
  const movingPiece = state.board[from.r][from.c];
  const captured = state.board[to.r][to.c];

  state.history.push({
    from:{...from}, to:{...to},
    piece: movingPiece,
    captured: captured || null
  });

  state.board[to.r][to.c] = movingPiece;
  state.board[from.r][from.c] = null;
  state.lastMove = {from, to};
  state.selected = null;
  state.legalTargets = [];

  if(captured) addCapturedChip(captured);
  addHistoryEntry(state.history[state.history.length-1]);

  state.turn = state.turn==='red' ? 'black' : 'red';

  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();

  captured ? sfxCapture() : sfxMove();
  if(isInCheck(state.board, state.turn)) sfxCheck();

  checkGameEnd();

  if(state.online.active){
    showOnlineActive();
    fbPushState();
  }

  if(!state.gameOver && !state.online.active && state.mode!=='pvp' && state.turn!==state.humanColor){
    triggerAiMove();
  }
}

function triggerAiMove(){
  state.aiThinking = true;
  updateTurnIndicator();
  const cfg = AI_LEVELS[Math.min(Math.max(state.aiLevel,1),10) - 1];
  const thinkDelay = 220 + cfg.depth * 90;
  state.aiTimeoutId = setTimeout(()=>{
    state.aiTimeoutId = null;
    const move = aiBestMove(state.board, state.turn, state.aiLevel);
    state.aiThinking = false;
    if(move){
      doMove(move.from, move.to);
    }
  }, thinkDelay);
}

function checkGameEnd(){
  const moves = allLegalMoves(state.board, state.turn);
  const inCheck = isInCheck(state.board, state.turn);
  if(moves.length===0 && !state.gameOver){
    state.gameOver = true;
    if(inCheck){
      const winner = state.turn==='red' ? 'black' : 'red';
      showGameOver(
        winner==='red' ? 'Đỏ Thắng!' : 'Đen Thắng!',
        `Chiếu bí - ${winner==='red'?'Đỏ':'Đen'} đã hạ tướng đối phương.`
      );
      sfxGameResult(winner, false);
      fireConfetti();
    } else {
      showGameOver('Hòa Cờ', 'Bên đi không còn nước hợp lệ - ván cờ kết thúc hòa.');
      sfxGameResult(null, true);
    }
    deleteFinishedSave();
    clearOnlineChatIfActive();
  }
}

function clearOnlineChatIfActive(){
  if(!state.online.active) return;
  const box = document.getElementById('chatMessages');
  if(box) box.innerHTML = '';
  if(fb.roomRef) fb.roomRef.child('chat').remove();
}

function showGameOver(title, text){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalText').textContent = text;
  document.getElementById('modalRematchBtn').style.display =
    (state.online.active && !state.online.spectator) ? '' : 'none';
  document.getElementById('modalOverlay').classList.add('show');
}

function aiSideColor(){
  return state.humanColor==='red' ? 'black' : 'red';
}

function cheatSkipAiTurn(){
  if(state.mode==='pvp' || state.online.active || state.gameOver) return;
  if(state.aiTimeoutId){
    clearTimeout(state.aiTimeoutId);
    state.aiTimeoutId = null;
  }
  state.aiThinking = false;
  state.turn = state.humanColor;
  state.selected = null;
  state.legalTargets = [];
  renderPieces();
  renderMarkers();
  updateStatus();
}

function cheatKillPiece(r,c){
  const target = state.board[r][c];
  if(!target) return;
  const wasGeneral = target.type==='general';

  state.board[r][c] = null;
  state.lastMove = {from:{r,c}, to:{r,c}};
  addCapturedChip(target);
  renderPieces();
  renderMarkers();
  sfxCapture();

  if(wasGeneral){
    finishWithCheatWin();
    return;
  }
  updateStatus();
}

function cheatBeheadGeneral(){
  if(state.mode==='pvp' || state.online.active || state.gameOver) return;
  const enemy = aiSideColor();
  const g = findGeneral(state.board, enemy);
  if(!g) return;
  cheatKillPiece(g.r, g.c);
}

function finishWithCheatWin(){
  state.gameOver = true;
  if(state.aiTimeoutId){ clearTimeout(state.aiTimeoutId); state.aiTimeoutId = null; }
  state.aiThinking = false;
  updateStatus();
  updateUndoBtn();
  showGameOver(
    state.humanColor==='red' ? 'Đỏ Thắng!' : 'Đen Thắng!',
    'Tướng địch đã bị tiêu diệt bằng chiêu gian lận.'
  );
  sfxGameResult(state.humanColor, false);
  fireConfetti();
  deleteFinishedSave();
}

function cheatReviveChariot(){
  if(state.mode==='pvp' || state.online.active || state.gameOver) return;
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      if(!state.board[r][c]){
        state.board[r][c] = {type:'chariot', color:'red'};
        state.lastMove = {from:{r,c}, to:{r,c}};
        renderPieces();
        renderMarkers();
        return;
      }
    }
  }
}

function serializeGame(){
  return {
    kind: 'co-tuong-save',
    board: state.board.map(row=>row.map(p=>p ? {type:p.type,color:p.color} : null)),
    turn: state.turn,
    mode: state.mode,
    aiLevel: state.aiLevel,
    humanColor: state.humanColor,
    remote: state.online.active ? {active:true, color:state.online.color} : null,
    savedAt: new Date().toISOString()
  };
}

function restoreGameData(data){
  resetPieceLayer();
  state.board = data.board.map(row=>row.map(p=>p ? {type:p.type,color:p.color} : null));
  state.turn = data.turn;
  state.mode = (data.mode==='pve-easy' || data.mode==='pve-hard') ? 'pve' : (data.mode || 'pvp');
  state.aiLevel = data.aiLevel || (data.mode==='pve-hard' ? 8 : data.mode==='pve-easy' ? 3 : 5);
  state.humanColor = data.humanColor || 'red';
  state.selected = null;
  state.legalTargets = [];
  state.history = [];
  state.gameOver = false;
  state.lastMove = null;
  state.aiThinking = false;
  document.getElementById('capturedRed').innerHTML='';
  document.getElementById('capturedBlack').innerHTML='';
  document.getElementById('historyBox').innerHTML='';
  document.getElementById('modalOverlay').classList.remove('show');
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode===state.mode));
  updateAiLevelBadge();
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
}

function generateSaveCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for(let i=0;i<5;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

async function saveGame(){
  if(!fbAvailable()){
    flashStatus('Chưa cấu hình Firebase.', true, 'saveStatus');
    return;
  }
  const code = generateSaveCode();
  const content = JSON.stringify(serializeGame());
  try{
    fbInit();
    await fb.db.ref('saves/'+code).set({ content, savedAt: Date.now() });
    document.getElementById('saveCodeInput').value = code;
    state.currentSave = code;
    flashStatus(`Đã lưu! Mã ván đấu: ${code} - ghi lại để tải lại sau.`, false, 'saveStatus');
  }catch(err){
    flashStatus('Lưu thất bại.', true, 'saveStatus');
  }
}

async function loadGame(){
  if(!fbAvailable()){
    flashStatus('Chưa cấu hình Firebase.', true, 'saveStatus');
    return;
  }
  const code = document.getElementById('saveCodeInput').value.trim().toUpperCase();
  if(!code){
    flashStatus('Nhập mã ván đấu trước đã.', true, 'saveStatus');
    return;
  }
  try{
    fbInit();
    const snap = await fb.db.ref('saves/'+code).once('value');
    const val = snap.val();
    if(!val) throw new Error('missing save');
    const data = JSON.parse(val.content);
    if(!data || data.kind!=='co-tuong-save' || !Array.isArray(data.board)) throw new Error('bad-format');
    state.online.active = false;
    state.online.color = null;
    document.getElementById('onlineIdle').style.display = '';
    document.getElementById('onlineActive').style.display = 'none';
    restoreGameData(data);
    updateCheatPanelVisibility();
    updateAiLevelBoxVisibility();
    state.currentSave = code;
    flashStatus(`Đã tải ván đấu "${code}".`, false, 'saveStatus');
  }catch(err){
    flashStatus('Không tìm thấy ván đấu với mã này.', true, 'saveStatus');
  }
}

async function deleteFinishedSave(){
  const code = state.currentSave;
  if(!code) return;
  state.currentSave = null;
  try{
    fbInit();
    await fb.db.ref('saves/'+code).remove();
    flashStatus(`Ván đã kết thúc - đã xoá file lưu "${code}".`, false, 'saveStatus');
  }catch(err){
  }
}

function flashStatus(text, isWarn, targetId){
  const el = document.getElementById(targetId || 'onlineStatus');
  el.textContent = text;
  el.classList.toggle('warn', !!isWarn);
  el.classList.toggle('live', !isWarn);
  setTimeout(()=>{ if(el.textContent===text){ el.textContent=''; el.classList.remove('warn','live'); } }, 4000);
}

function startRemoteGame(color){
  stopReplayIfActive();
  state.online.active = true;
  state.online.color = color;
  state.online.spectator = false;
  state.online.transport = 'firebase';
  state.mode = 'pvp';
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode==='pvp'));
  updateCheatPanelVisibility();
  updateAiLevelBoxVisibility();
  state.board = initialBoard();
  state.turn = 'red';
  state.selected = null;
  state.legalTargets = [];
  state.history = [];
  state.gameOver = false;
  state.lastMove = null;
  state.aiThinking = false;
  document.getElementById('capturedRed').innerHTML='';
  document.getElementById('capturedBlack').innerHTML='';
  document.getElementById('historyBox').innerHTML='';
  document.getElementById('modalOverlay').classList.remove('show');
  resetPieceLayer();
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
  showOnlineActive();
}

function showOnlineActive(){
  document.getElementById('onlineIdle').style.display = 'none';
  document.getElementById('onlineActive').style.display = '';
  document.getElementById('requestUndoBtn').style.display = state.online.spectator ? 'none' : '';

  if(state.online.spectator){
    document.getElementById('roomCodeDisplay').textContent = 'XEM';
    const base = 'Đang xem trực tiếp - bạn không thể đi quân.';
    document.getElementById('onlineRoleLabel').textContent =
      state.online.roomCode ? `${base} · Mã phòng: ${state.online.roomCode}` : base;
    return;
  }

  document.getElementById('roomCodeDisplay').textContent = state.online.color==='red' ? 'Đỏ' : 'Đen';
  const base = state.turn===state.online.color
    ? 'Đến lượt bạn - cứ đi, đối thủ sẽ thấy ngay.'
    : 'Đang chờ đối thủ đi (thời gian thực).';
  document.getElementById('onlineRoleLabel').textContent =
    state.online.roomCode ? `${base} · Mã phòng: ${state.online.roomCode}` : base;
}

function buildRoomShareUrl(code){
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
  return url.toString();
}

function toggleShareRoomBox(){
  const box = document.getElementById('shareRoomBox');
  const isOpen = box.style.display !== 'none';
  if(isOpen){ box.style.display = 'none'; return; }
  if(!state.online.roomCode) return;

  const url = buildRoomShareUrl(state.online.roomCode);
  document.getElementById('shareLinkInput').value = url;

  const qrBox = document.getElementById('qrCodeBox');
  qrBox.innerHTML = '';
  try{
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    qrBox.innerHTML = qr.createImgTag(4, 4);
  }catch(err){
    qrBox.textContent = 'Không tạo được mã QR.';
  }
  box.style.display = '';
}

function copyShareLink(){
  const input = document.getElementById('shareLinkInput');
  input.select();
  navigator.clipboard?.writeText(input.value)
    .then(()=>flashStatus('Đã sao chép link phòng.', false))
    .catch(()=>flashStatus('Không sao chép được, hãy tự bôi đen và copy.', true));
}

function checkRoomLinkParam(){
  const code = new URLSearchParams(location.search).get('room');
  if(!code) return;
  const upperCode = code.toUpperCase();
  document.getElementById('fbJoinCodeInput').value = upperCode;
  document.getElementById('roomInviteCode').textContent = upperCode;
  document.getElementById('roomInviteModalOverlay').classList.add('show');
  history.replaceState(null, '', location.pathname);
}

function randomRoomCode(len=5){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for(let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function boardToPlain(board){
  return board.map(row=>row.map(p=>p ? {type:p.type,color:p.color} : null));
}

function fbConfigured(){
  return !!(CONFIG && CONFIG.firebase && CONFIG.firebase.apiKey && CONFIG.firebase.databaseURL);
}

function fbAvailable(){
  return fbConfigured() && typeof firebase !== 'undefined';
}

function setFbStatus(text, warn){
  const el = document.getElementById('fbStatus');
  if(!el) return;
  el.textContent = text;
  el.classList.toggle('warn', !!warn);
  el.classList.toggle('live', !warn);
}

function fbInit(){
  if(fb.app) return;
  fb.app = firebase.initializeApp(CONFIG.firebase);
  fb.db = firebase.database();
}

async function fbCreateRoom(){
  if(!fbAvailable()){
    setFbStatus('Chưa cấu hình Firebase.', true);
    return;
  }
  try{ fbInit(); }catch(err){ setFbStatus('Lỗi khởi tạo Firebase: '+err.message, true); return; }
  fbSweepExpiredRooms();

  const code = randomRoomCode();
  startRemoteGame('red');
  state.online.roomCode = code;
  state.online.version = 1;
  fb.room = code;
  fb.roomRef = fb.db.ref('rooms/'+code);

  const payload = {
    boardJSON: JSON.stringify(boardToPlain(state.board)),
    turn: state.turn,
    lastMoveJSON: 'null',
    version: 1,
    gameOver: false,
    createdAt: Date.now()
  };
  try{
    await fb.roomRef.set(payload);
  }catch(err){
    setFbStatus('Không tạo được phòng.', true);
    return;
  }
  fbListen();
  fbListenUndoRequest();
  fbListenChat();
  fbSetupPresence('red');
  setFbStatus(`Đã tạo phòng ${code} - gửi mã này cho đối thủ. Phòng tự xoá sau 7 ngày hoặc khi cả 2 cùng thoát.`, false);
  showOnlineActive();
}

async function fbJoinRoom(){
  if(!fbAvailable()){
    setFbStatus('Chưa cấu hình Firebase.', true);
    return;
  }
  const code = document.getElementById('fbJoinCodeInput').value.trim().toUpperCase();
  if(!code){ setFbStatus('Nhập mã phòng trước đã.', true); return; }
  try{ fbInit(); }catch(err){ setFbStatus('Lỗi khởi tạo Firebase: '+err.message, true); return; }

  const ref = fb.db.ref('rooms/'+code);
  let snap;
  try{
    snap = await ref.once('value');
  }catch(err){
    setFbStatus('Không đọc được phòng - kiểm tra mã hoặc luật bảo mật Firebase.', true);
    return;
  }
  const data = snap.val();
  if(!data){ setFbStatus('Không tìm thấy phòng này.', true); return; }
  if(fbRoomExpired(data)){ ref.remove(); setFbStatus('Phòng này đã trống quá 3 phút nên đã bị xoá.', true); return; }

  fb.room = code;
  fb.roomRef = ref;
  startRemoteGame('black');
  state.online.roomCode = code;
  state.online.version = 0;
  fbListen();
  fbListenUndoRequest();
  fbListenChat();
  fbSetupPresence('black');
  fbApplyState(data);
  setFbStatus(`Đã vào phòng ${code}!`, false);
  showOnlineActive();
}

async function fbSpectateRoom(){
  if(!fbAvailable()){
    setFbStatus('Chưa cấu hình Firebase.', true);
    return;
  }
  const code = document.getElementById('fbJoinCodeInput').value.trim().toUpperCase();
  if(!code){ setFbStatus('Nhập mã phòng trước đã.', true); return; }
  try{ fbInit(); }catch(err){ setFbStatus('Lỗi khởi tạo Firebase: '+err.message, true); return; }

  const ref = fb.db.ref('rooms/'+code);
  let snap;
  try{
    snap = await ref.once('value');
  }catch(err){
    setFbStatus('Không đọc được phòng.', true);
    return;
  }
  const data = snap.val();
  if(!data){ setFbStatus('Không tìm thấy phòng này.', true); return; }
  if(fbRoomExpired(data)){ ref.remove(); setFbStatus('Phòng này đã trống quá 3 phút nên đã bị xoá.', true); return; }

  fb.room = code;
  fb.roomRef = ref;
  startRemoteGame(null);
  state.online.spectator = true;
  state.online.roomCode = code;
  state.online.version = 0;
  fbListen();
  fbListenChat();
  fbApplyState(data);
  setFbStatus(`Đang xem phòng ${code}.`, false);
  showOnlineActive();
}

const ROOM_EMPTY_GRACE_MS = 3 * 60 * 1000;
function fbRoomExpired(data){
  return !!(data && data.emptyAt && (Date.now() - data.emptyAt > ROOM_EMPTY_GRACE_MS));
}

async function fbSweepExpiredRooms(){
  try{
    const snap = await fb.db.ref('rooms').once('value');
    const rooms = snap.val();
    if(!rooms) return;
    for(const code in rooms){
      if(fbRoomExpired(rooms[code])) fb.db.ref('rooms/'+code).remove();
    }
  }catch(err){  }
}

function fbSetupPresence(color){
  if(!fb.roomRef || !color) return;
  const presenceRef = fb.roomRef.child('presence/'+color);
  presenceRef.set(true);
  presenceRef.onDisconnect().set(false);
}

function fbListenPresence(){
  if(!fb.roomRef) return;
  fb.roomRef.child('presence').on('value', snap=>{
    const p = snap.val() || {};
    const empty = p.red !== true && p.black !== true;
    if(empty){
      fb.roomRef.child('emptyAt').once('value').then(s=>{
        if(s.val()==null) fb.roomRef.child('emptyAt').set(Date.now());
      });
    } else {
      fb.roomRef.child('emptyAt').remove();
    }
  });
}

function fbListen(){
  if(!fb.roomRef) return;
  fb.roomRef.on('value', snap=>{
    const data = snap.val();
    if(data) fbApplyState(data);
  });
  fbListenPresence();
}

function fbStopListening(){
  if(fb.roomRef) fb.roomRef.off();
  fb.roomRef = null;
  fb.room = null;
}

function fbApplyState(data){
  if(!data || data.version==null || data.version === state.online.version) return;
  let lastMove = null;
  try{ lastMove = JSON.parse(data.lastMoveJSON); }catch(err){ lastMove = null; }

  const movingPiece = lastMove && state.board[lastMove.from.r][lastMove.from.c];
  if(lastMove && movingPiece){
    const capturedPiece = state.board[lastMove.to.r][lastMove.to.c];
    state.board[lastMove.to.r][lastMove.to.c] = movingPiece;
    state.board[lastMove.from.r][lastMove.from.c] = null;
    if(capturedPiece){
      addCapturedChip(capturedPiece);
    }
    state.history.push({from:{...lastMove.from}, to:{...lastMove.to}, piece:movingPiece, captured:capturedPiece||null});
    addHistoryEntry(state.history[state.history.length-1]);
  } else {
    let board;
    try{ board = JSON.parse(data.boardJSON); }catch(err){ return; }
    resetPieceLayer();
    state.board = board;
    state.history = [];
    document.getElementById('capturedRed').innerHTML = '';
    document.getElementById('capturedBlack').innerHTML = '';
    document.getElementById('historyBox').innerHTML = '';
  }

  state.turn = data.turn;
  state.lastMove = lastMove;
  state.online.version = data.version;
  state.selected = null;
  state.legalTargets = [];
  state.gameOver = !!data.gameOver;
  if(!state.gameOver) document.getElementById('modalOverlay').classList.remove('show');
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
  checkGameEnd();
  showOnlineActive();
}

function fbPushState(){
  if(!fb.roomRef) return;
  state.online.version++;
  const payload = {
    boardJSON: JSON.stringify(boardToPlain(state.board)),
    turn: state.turn,
    lastMoveJSON: JSON.stringify(state.lastMove),
    version: state.online.version,
    gameOver: state.gameOver
  };
  fb.roomRef.update(payload).catch(()=>setFbStatus('Gửi nước đi thất bại, kiểm tra mạng.', true));
}

function rematchOnline(){
  if(!state.online.active || state.online.spectator || !fb.roomRef) return;
  stopReplayIfActive();
  document.getElementById('modalOverlay').classList.remove('show');
  state.board = initialBoard();
  state.turn = 'red';
  state.selected = null;
  state.legalTargets = [];
  state.history = [];
  state.gameOver = false;
  state.lastMove = null;
  state.currentSave = null;
  document.getElementById('capturedRed').innerHTML = '';
  document.getElementById('capturedBlack').innerHTML = '';
  document.getElementById('historyBox').innerHTML = '';
  resetPieceLayer();
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
  fbPushState();
  setFbStatus('Đã bắt đầu ván mới - đối thủ sẽ thấy ngay.', false);
  showOnlineActive();
}

function requestUndo(){
  if(!fb.roomRef || !state.online.active || state.online.spectator) return;
  if(state.history.length===0) return;
  fb.roomRef.child('undoRequest').set({by: state.online.color, status:'pending', ts: Date.now()});
  setFbStatus('Đã gửi yêu cầu đi lại, đang chờ đối thủ...', false);
}

function fbListenUndoRequest(){
  if(!fb.roomRef) return;
  fb.roomRef.child('undoRequest').on('value', snap=>{
    const req = snap.val();
    const overlay = document.getElementById('undoModalOverlay');
    if(!req){ overlay.classList.remove('show'); return; }

    if(req.status==='pending' && !state.online.spectator && req.by !== state.online.color){
      document.getElementById('undoModalText').textContent =
        `Đối thủ (${req.by==='red'?'Đỏ':'Đen'}) xin đi lại nước vừa rồi.`;
      overlay.classList.add('show');
    } else if(req.status==='declined' && req.by === state.online.color){
      overlay.classList.remove('show');
      setFbStatus('Đối thủ đã từ chối yêu cầu đi lại.', true);
      fb.roomRef.child('undoRequest').remove();
    } else {
      overlay.classList.remove('show');
    }
  });
}

function acceptOnlineUndo(){
  if(state.history.length===0) return;
  const last = state.history.pop();
  state.board[last.from.r][last.from.c] = last.piece;
  state.board[last.to.r][last.to.c] = last.captured;
  if(last.captured){
    const container = document.getElementById(last.captured.color==='red' ? 'capturedRed' : 'capturedBlack');
    if(container.lastChild) container.removeChild(container.lastChild);
  }
  const box = document.getElementById('historyBox');
  if(box.lastChild) box.removeChild(box.lastChild);
  state.turn = last.piece.color;
  state.lastMove = state.history.length ? {from: state.history[state.history.length-1].from, to: state.history[state.history.length-1].to} : null;
  state.gameOver = false;
  state.selected = null;
  state.legalTargets = [];
  document.getElementById('modalOverlay').classList.remove('show');
  document.getElementById('undoModalOverlay').classList.remove('show');
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
  if(fb.roomRef){
    fb.roomRef.child('undoRequest').remove();
    fbPushState();
  }
  setFbStatus('Đã đồng ý đi lại.', false);
}

function declineOnlineUndo(){
  if(fb.roomRef) fb.roomRef.child('undoRequest').update({status:'declined'});
  document.getElementById('undoModalOverlay').classList.remove('show');
}

function fbListenChat(){
  if(!fb.roomRef) return;
  fb.roomRef.child('chat').limitToLast(50).on('child_added', snap=>{
    appendChatMessage(snap.val());
  });
}

function appendChatMessage(msg){
  if(!msg || !msg.text) return;
  const box = document.getElementById('chatMessages');
  const div = document.createElement('div');
  const roleClass = msg.color==='red' ? 'chat-red' : msg.color==='black' ? 'chat-black' : 'chat-spectator';
  const who = msg.color==='red' ? 'Đỏ' : msg.color==='black' ? 'Đen' : 'Khán giả';
  div.className = 'chat-msg ' + roleClass;
  const senderSpan = document.createElement('span');
  senderSpan.className = 'chat-sender';
  senderSpan.textContent = who + ':';
  div.appendChild(senderSpan);
  div.appendChild(document.createTextNode(' ' + msg.text));
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function sendChat(){
  const input = document.getElementById('chatInput');
  const text = input.value.trim().slice(0, 200);
  if(!text || !fb.roomRef) return;
  const myColor = state.online.spectator ? 'spectator' : state.online.color;
  fb.roomRef.child('chat').push({color: myColor, text, ts: Date.now()});
  input.value = '';
}

function leaveRoom(){
  if(fb.roomRef){
    const roomRef = fb.roomRef;
    const myColor = state.online.color;
    if(myColor){
      const presenceRef = roomRef.child('presence/'+myColor);
      presenceRef.onDisconnect().cancel();
      presenceRef.set(false).then(()=> roomRef.child('presence').once('value'))
        .then(snap=>{
          const p = snap.val() || {};
          if(p.red !== true && p.black !== true) roomRef.child('emptyAt').set(Date.now());
        })
        .catch(()=>{  });
    }
    roomRef.child('presence').off();
    roomRef.child('undoRequest').off();
    roomRef.child('chat').off();
  }
  fbStopListening();
  state.online.active = false;
  state.online.color = null;
  state.online.spectator = false;
  state.online.transport = null;
  state.online.roomCode = null;
  document.getElementById('onlineIdle').style.display = '';
  document.getElementById('onlineActive').style.display = 'none';
  document.getElementById('shareRoomBox').style.display = 'none';
  document.getElementById('fbJoinCodeInput').value = '';
  document.getElementById('undoModalOverlay').classList.remove('show');
  document.getElementById('chatMessages').innerHTML = '';
  setFbStatus('', false);
  resetGame();
}

function openDrawer(){
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('show');
  document.getElementById('menuFab').classList.add('open');
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('show');
  document.getElementById('menuFab').classList.remove('open');
}
function toggleDrawer(){
  document.getElementById('drawer').classList.contains('open') ? closeDrawer() : openDrawer();
}

function updateCheatPanelVisibility(){
  const panel = document.getElementById('cheatPanel');
  const show = state.mode!=='pvp' && !state.online.active;
  panel.style.display = show ? '' : 'none';
}

function updateAiLevelBoxVisibility(){
  const box = document.getElementById('aiLevelBox');
  box.style.display = (state.mode==='pve' && !state.online.active) ? '' : 'none';
}

function updateAiLevelBadge(){
  document.getElementById('aiLevelSlider').value = state.aiLevel;
  document.getElementById('aiLevelBadge').textContent = `${state.aiLevel} · ${LEVEL_NAMES[state.aiLevel-1]}`;
}

function updateTurnIndicator(){
  const dot = document.getElementById('turnDot');
  const label = document.getElementById('turnLabel');
  const indicator = document.getElementById('turnIndicator');
  dot.className = 'turn-dot ' + state.turn;
  const colorName = state.turn==='red' ? 'Đỏ' : 'Đen';
  if(state.aiThinking){
    label.textContent = `Máy (${colorName}) đang suy nghĩ…`;
    indicator.classList.add('thinking');
  } else {
    label.textContent = `Lượt của ${colorName}`;
    indicator.classList.remove('thinking');
  }
}

function updateStatus(){
  const msg = document.getElementById('statusMsg');
  if(state.gameOver){ msg.textContent=''; msg.classList.remove('check'); updateTurnIndicator(); return; }
  const inCheck = isInCheck(state.board, state.turn);
  if(inCheck){
    msg.textContent = `${state.turn==='red'?'Đỏ':'Đen'} đang bị chiếu tướng!`;
    msg.classList.add('check');
  } else {
    msg.textContent = '';
    msg.classList.remove('check');
  }
  updateTurnIndicator();
}

function addCapturedChip(piece){
  const container = document.getElementById(piece.color==='red' ? 'capturedRed' : 'capturedBlack');
  const chip = document.createElement('div');
  chip.className = 'cap-chip ' + piece.color;
  chip.textContent = GLYPHS[piece.color][piece.type];
  container.appendChild(chip);
}

function addHistoryEntry(entry){
  const box = document.getElementById('historyBox');
  const div = document.createElement('div');
  const n = state.history.length;
  const notation = moveNotation(entry.piece, entry.from, entry.to);
  div.textContent = `${n}. [${entry.piece.color==='red'?'Đỏ':'Đen'}] ${notation}${entry.captured? ' (ăn '+GLYPHS[entry.captured.color][entry.captured.type]+')':''}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function updateUndoBtn(){
  document.getElementById('undoBtn').disabled = state.history.length===0;
}

function undo(){
  if(state.history.length===0 || state.online.active) return;
  if(state.aiTimeoutId){ clearTimeout(state.aiTimeoutId); state.aiTimeoutId = null; state.aiThinking = false; }
  const steps = (state.mode!=='pvp') ? 2 : 1;
  for(let i=0;i<steps;i++){
    const last = state.history.pop();
    if(!last) break;
    state.board[last.from.r][last.from.c] = last.piece;
    state.board[last.to.r][last.to.c] = last.captured;
    if(last.captured){
      const container = document.getElementById(last.captured.color==='red' ? 'capturedRed' : 'capturedBlack');
      if(container.lastChild) container.removeChild(container.lastChild);
    }
    const box = document.getElementById('historyBox');
    if(box.lastChild) box.removeChild(box.lastChild);
    state.turn = last.piece.color;
  }
  state.lastMove = state.history.length ? {from: state.history[state.history.length-1].from, to: state.history[state.history.length-1].to} : null;
  state.gameOver = false;
  state.selected = null;
  state.legalTargets = [];
  document.getElementById('modalOverlay').classList.remove('show');
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
}

let replayTimer = null;

function stopReplayIfActive(){
  if(replayTimer){ clearInterval(replayTimer); replayTimer=null; }
  if(!state.replay.active) return;
  state.replay.active = false;
  document.getElementById('replayBar').style.display = 'none';
  const btn = document.getElementById('replayPlayBtn');
  btn.textContent = '▶';
  btn.classList.remove('playing');
}

function enterReplay(){
  if(state.history.length===0) return;
  document.getElementById('modalOverlay').classList.remove('show');
  closeDrawer();
  state.replay.active = true;
  state.replay.moves = state.history.slice();
  state.replay.savedBoard = state.board;
  state.replay.savedTurn = state.turn;
  state.replay.index = 0;
  rebuildReplayBoard(0);
  resetPieceLayer();
  document.getElementById('replayBar').style.display = '';
  renderPieces();
  renderMarkers();
  updateReplayUI();
}

function rebuildReplayBoard(index){
  const board = initialBoard();
  let lastMove = null;
  for(let i=0;i<index;i++){
    const mv = state.replay.moves[i];
    board[mv.to.r][mv.to.c] = {type:mv.piece.type, color:mv.piece.color};
    board[mv.from.r][mv.from.c] = null;
    lastMove = {from:mv.from, to:mv.to};
  }
  state.board = board;
  state.lastMove = lastMove;
}

function goToReplayIndex(targetIndex){
  targetIndex = Math.max(0, Math.min(targetIndex, state.replay.moves.length));
  const cur = state.replay.index;
  if(targetIndex === cur) return;

  if(targetIndex === cur+1){
    const mv = state.replay.moves[cur];
    const moving = state.board[mv.from.r][mv.from.c];
    if(moving){
      state.board[mv.to.r][mv.to.c] = moving;
      state.board[mv.from.r][mv.from.c] = null;
      state.lastMove = {from:mv.from, to:mv.to};
    } else {
      rebuildReplayBoard(targetIndex);
      resetPieceLayer();
    }
  } else if(targetIndex === cur-1){
    const mv = state.replay.moves[targetIndex];
    const moving = state.board[mv.to.r][mv.to.c];
    if(moving){
      state.board[mv.from.r][mv.from.c] = moving;
      state.board[mv.to.r][mv.to.c] = mv.captured ? {type:mv.captured.type, color:mv.captured.color} : null;
      state.lastMove = targetIndex>0 ? {from:state.replay.moves[targetIndex-1].from, to:state.replay.moves[targetIndex-1].to} : null;
    } else {
      rebuildReplayBoard(targetIndex);
      resetPieceLayer();
    }
  } else {
    rebuildReplayBoard(targetIndex);
    resetPieceLayer();
  }

  state.replay.index = targetIndex;
  renderPieces();
  renderMarkers();
  updateReplayUI();
}

function updateReplayUI(){
  const total = state.replay.moves.length;
  const idx = state.replay.index;
  document.getElementById('replayMoveLabel').textContent = `Nước ${idx} / ${total}`;
  document.getElementById('replayPrevBtn').disabled = idx===0;
  document.getElementById('replayStartBtn').disabled = idx===0;
  document.getElementById('replayNextBtn').disabled = idx===total;
  document.getElementById('replayEndBtn').disabled = idx===total;
}

function toggleReplayPlay(){
  const btn = document.getElementById('replayPlayBtn');
  if(replayTimer){
    clearInterval(replayTimer); replayTimer = null;
    btn.textContent = '▶'; btn.classList.remove('playing');
    return;
  }
  btn.textContent = '⏸'; btn.classList.add('playing');
  replayTimer = setInterval(()=>{
    if(state.replay.index >= state.replay.moves.length){
      clearInterval(replayTimer); replayTimer = null;
      btn.textContent = '▶'; btn.classList.remove('playing');
      return;
    }
    goToReplayIndex(state.replay.index+1);
  }, 750);
}

function exitReplay(){
  resetGame();
}

function resetGame(){
  stopReplayIfActive();
  state.board = initialBoard();
  state.turn = 'red';
  state.selected = null;
  state.legalTargets = [];
  state.history = [];
  state.gameOver = false;
  state.lastMove = null;
  state.aiThinking = false;
  state.currentSave = null;
  document.getElementById('capturedRed').innerHTML='';
  document.getElementById('capturedBlack').innerHTML='';
  document.getElementById('historyBox').innerHTML='';
  document.getElementById('modalOverlay').classList.remove('show');
  resetPieceLayer();
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
}

document.getElementById('menuFab').addEventListener('click', toggleDrawer);
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);

document.querySelectorAll('.mode-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(state.online.active) leaveRoom();
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    state.humanColor = 'red';
    updateCheatPanelVisibility();
    updateAiLevelBoxVisibility();
    resetGame();
  });
});

document.getElementById('aiLevelSlider').addEventListener('input', (e)=>{
  state.aiLevel = +e.target.value;
  updateAiLevelBadge();
});

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('resetBtn').addEventListener('click', resetGame);
document.getElementById('modalBtn').addEventListener('click', resetGame);

document.getElementById('saveBtn').addEventListener('click', saveGame);
document.getElementById('loadBtn').addEventListener('click', loadGame);
document.getElementById('saveCodeInput').addEventListener('keydown', (e)=>{
  if(e.key==='Enter') loadGame();
});

document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);

document.getElementById('fbCreateRoomBtn').addEventListener('click', fbCreateRoom);
document.getElementById('fbJoinRoomBtn').addEventListener('click', fbJoinRoom);
document.getElementById('fbSpectateBtn').addEventListener('click', fbSpectateRoom);
document.getElementById('shareRoomBtn').addEventListener('click', toggleShareRoomBox);
document.getElementById('copyShareLinkBtn').addEventListener('click', copyShareLink);
document.getElementById('fbJoinCodeInput').addEventListener('keydown', (e)=>{
  if(e.key==='Enter') fbJoinRoom();
});

document.getElementById('requestUndoBtn').addEventListener('click', requestUndo);
document.getElementById('undoModalAcceptBtn').addEventListener('click', acceptOnlineUndo);
document.getElementById('undoModalDeclineBtn').addEventListener('click', declineOnlineUndo);

document.getElementById('roomInviteJoinBtn').addEventListener('click', ()=>{
  document.getElementById('roomInviteModalOverlay').classList.remove('show');
  fbJoinRoom();
});
document.getElementById('roomInviteSpectateBtn').addEventListener('click', ()=>{
  document.getElementById('roomInviteModalOverlay').classList.remove('show');
  fbSpectateRoom();
});

document.getElementById('chatSendBtn').addEventListener('click', sendChat);
document.getElementById('chatInput').addEventListener('keydown', (e)=>{
  if(e.key==='Enter') sendChat();
});

document.getElementById('soundToggle').addEventListener('change', (e)=>{
  state.soundOn = e.target.checked;
});
document.querySelectorAll('.theme-swatch').forEach(btn=>{
  btn.addEventListener('click', ()=> applyTheme(btn.dataset.theme));
});

document.getElementById('modalReplayBtn').addEventListener('click', enterReplay);
document.getElementById('modalRematchBtn').addEventListener('click', rematchOnline);
document.getElementById('replayStartBtn').addEventListener('click', ()=>goToReplayIndex(0));
document.getElementById('replayPrevBtn').addEventListener('click', ()=>goToReplayIndex(state.replay.index-1));
document.getElementById('replayNextBtn').addEventListener('click', ()=>goToReplayIndex(state.replay.index+1));
document.getElementById('replayEndBtn').addEventListener('click', ()=>goToReplayIndex(state.replay.moves.length));
document.getElementById('replayPlayBtn').addEventListener('click', toggleReplayPlay);
document.getElementById('replayCloseBtn').addEventListener('click', exitReplay);

document.getElementById('skipAiBtn').addEventListener('click', cheatSkipAiTurn);
document.getElementById('beheadBtn').addEventListener('click', cheatBeheadGeneral);
document.getElementById('reviveChariotBtn').addEventListener('click', cheatReviveChariot);
document.getElementById('killModeToggle').addEventListener('change', (e)=>{
  state.cheat.killMode = e.target.checked;
  document.getElementById('cheatPanel').classList.toggle('killmode-on', state.cheat.killMode);
});

updateCheatPanelVisibility();
updateAiLevelBoxVisibility();
updateAiLevelBadge();

async function loadConfigAndInit(){
  try{
    const res = await fetch('config.json');
    if(!res.ok) throw new Error('config.json HTTP ' + res.status);
    CONFIG = await res.json();
  }catch(err){
    console.error('Không tải được config.json:', err);
    document.body.innerHTML =
      '<div style="color:#f4e8d0; font-family:sans-serif; padding:40px; text-align:center;">'
      + 'Không tải được <code>config.json</code>.<br>'
      + 'Nếu bạn mở file này trực tiếp (đường dẫn <code>file://</code>), trình duyệt sẽ chặn fetch — '
      + 'hãy chạy qua một server tĩnh (vd. <code>npx serve</code>, VS Code Live Server) hoặc GitHub Pages.'
      + '</div>';
    return;
  }

  COLS = CONFIG.board.cols;
  ROWS = CONFIG.board.rows;
  CELL = CONFIG.board.cell;
  MARGIN = CONFIG.board.margin;
  svgW = CONFIG.board.svgWidth;
  svgH = CONFIG.board.svgHeight;
  VALUES = CONFIG.pieceValues;
  SOLDIER_CROSSED_BONUS = CONFIG.soldierCrossedBonus;
  GLYPHS = CONFIG.glyphs;

  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

  state.board = initialBoard();

  buildStaticBoard();
  loadSavedTheme();
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
  checkRoomLinkParam();

  if(fbConfigured()){
    setInterval(()=>{
      try{ fbInit(); fbSweepExpiredRooms(); }catch(err){}
    }, 60000);
  }
}

loadConfigAndInit();
