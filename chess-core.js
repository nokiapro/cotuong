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
  const horsePST = [
    [0,0,2,4,4,4,2,0,0],[2,4,6,8,8,8,6,4,2],[4,6,10,12,14,12,10,6,4],
    [4,8,12,14,16,14,12,8,4],[4,8,12,14,16,14,12,8,4],[4,8,12,14,16,14,12,8,4],
    [4,6,10,12,14,12,10,6,4],[2,4,6,8,8,8,6,4,2],[0,2,4,6,6,6,4,2,0],[0,0,2,4,4,4,2,0,0]
  ];
  const cannonPST = [
    [2,2,4,6,6,6,4,2,2],[2,4,6,8,10,8,6,4,2],[4,6,8,10,12,10,8,6,4],
    [4,6,10,12,14,12,10,6,4],[4,6,10,12,14,12,10,6,4],[4,6,10,12,14,12,10,6,4],
    [4,6,8,10,12,10,8,6,4],[2,4,6,8,10,8,6,4,2],[2,2,4,6,8,6,4,2,2],[0,2,2,4,6,4,2,2,0]
  ];
  const chariotPST = [
    [4,6,8,10,12,10,8,6,4],[4,6,8,10,12,10,8,6,4],[6,8,10,12,14,12,10,8,6],
    [8,10,12,14,16,14,12,10,8],[8,10,12,14,16,14,12,10,8],[8,10,12,14,16,14,12,10,8],
    [6,8,10,12,14,12,10,8,6],[4,6,8,10,12,10,8,6,4],[4,6,8,10,12,10,8,6,4],[2,4,6,8,10,8,6,4,2]
  ];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const p = board[r][c];
    if(!p) continue;
    let v = (VALUES[p.type]||0) + soldierBonus(p,r);
    if(p.type==='horse') v += (horsePST[r]&&horsePST[r][c])||0;
    else if(p.type==='cannon') v += (cannonPST[r]&&cannonPST[r][c])||0;
    else if(p.type==='chariot') v += (chariotPST[r]&&chariotPST[r][c])||0;
    else if(p.type==='soldier'){
      v += Math.max(0, 4-Math.abs(c-4))*2;
      if(crossedRiver(r, p.color)) v += 12;
    } else if(p.type==='advisor' || p.type==='elephant'){ v += 4; }
    try{
      if(p.type==='horse' || p.type==='cannon' || p.type==='chariot')
        v += pieceMoves(board, r, c).length;
    }catch(e){}
    score += (p.color==='red') ? v : -v;
  }
  try{
    if(isInCheck(board, 'black')) score += 28;
    if(isInCheck(board, 'red')) score -= 28;
  }catch(e){}
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
  { depth:1, noise:420  },
  { depth:2, noise:280  },
  { depth:2, noise:160  },
  { depth:3, noise:100  },
  { depth:3, noise:55   },
  { depth:4, noise:30   },
  { depth:4, noise:12   },
  { depth:5, noise:6    },
  { depth:5, noise:2    },
  { depth:6, noise:0    }
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
  function moveKey(m){
    let k = m.capture ? 1000 : 0;
    try{
      const t = board[m.to.r][m.to.c];
      if(t) k += (VALUES[t.type]||0);
      const nb = cloneBoard(board);
      nb[m.to.r][m.to.c] = nb[m.from.r][m.from.c];
      nb[m.from.r][m.from.c] = null;
      if(isInCheck(nb, color==='red'?'black':'red')) k += 350;
    }catch(e){}
    k += Math.random()*0.01;
    return k;
  }
  moves.sort((a,b)=> moveKey(b) - moveKey(a));
  let alpha=-Infinity, beta=Infinity;
  const scored = [];
  for(const m of moves){
    const nb = cloneBoard(board);
    nb[m.to.r][m.to.c] = nb[m.from.r][m.from.c];
    nb[m.from.r][m.from.c] = null;
    let depth = Math.max(0, cfg.depth - 1);
    try{
      if(m.capture || isInCheck(nb, color==='red'?'black':'red')) depth = Math.min(depth+1, cfg.depth);
    }catch(e){}
    const raw = minimax(nb, depth, alpha, beta, color==='red'?'black':'red');
    const score = color==='red' ? raw : -raw;
    const noisy = cfg.noise>0 ? score + (Math.random()*2-1)*cfg.noise : score;
    scored.push({ m, score, noisy });
    if(color==='red'){ if(score>alpha) alpha=score; } else { if(-score<beta) beta=-score; }
  }
  scored.sort((a,b)=> b.noisy - a.noisy);
  const top = scored[0] ? scored[0].noisy : 0;
  const margin = cfg.noise > 0 ? Math.max(18, cfg.noise * 0.35) : 8;
  const pool = scored.filter(s => s.noisy >= top - margin);
  if(!pool.length) return scored[0] ? scored[0].m : moves[0];
  return pool[Math.floor(Math.random() * pool.length)].m;
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

function commentOnMove(entry){  }
function commentOnGameEnd(winnerColor, isDraw){  }
function clearComments(){ if(window.speechSynthesis) try{ speechSynthesis.cancel(); }catch(e){} }
function appendComment(){ return; }
function speakComment(){ return; }

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