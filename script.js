/* =========================================================
   XIANGQI ENGINE
   board[row][col] -> {type, color} | null
   rows 0..9 (0 = black back rank, 9 = red back rank)
   cols 0..8
   ========================================================= */

/* Board geometry & starting layout are loaded from config.json at
   startup (see loadConfigAndInit at the bottom) so the whole game can be
   re-themed or re-configured without touching this file. */
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
    return !target; // true means can continue sliding
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
        if(crossedRiver(nr,p.color)) continue; // cannot cross river
        if(board[er][ec]) continue; // blocked eye
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
        if(inBounds(legR,legC) && board[legR][legC]) continue; // hobbled leg
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
              screenFound = true; // this is the screen piece
            }
          } else {
            if(target){
              if(target.color !== p.color){
                moves.push({r:nr,c:nc,capture:true});
              }
              break; // stop after first piece past screen regardless
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

/* ---------------- AI (minimax + alpha-beta) ---------------- */
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
    return 0; // stalemate
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

/* 10 difficulty levels: higher level = deeper search + less randomness.
   "noise" is added to each candidate move's score before picking the
   best one, so the AI doesn't always play the one "optimal" line —
   at low levels it visibly makes mistakes, at high levels it still
   varies between genuinely equal moves instead of repeating openings. */
const AI_LEVELS = [
  { depth:1, noise:900  }, // 1
  { depth:1, noise:600  }, // 2
  { depth:2, noise:400  }, // 3
  { depth:2, noise:260  }, // 4
  { depth:2, noise:150  }, // 5
  { depth:3, noise:90   }, // 6
  { depth:3, noise:50   }, // 7
  { depth:3, noise:25   }, // 8
  { depth:4, noise:10   }, // 9
  { depth:4, noise:0    }  // 10
];
const LEVEL_NAMES = [
  'Mới học','Vỡ lòng','Nghiệp dư','Khá','Giỏi',
  'Cao thủ','Chuyên nghiệp','Đại kiện tướng','Siêu đẳng','Bất khả chiến bại'
];

/* ---------------- Traditional Xiangqi move notation (Vietnamese) ----------------
   Columns are numbered 1-9 from each player's own right hand side
   (so "column 1" is a different screen column for red vs black). */
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
  const forwardSign = color==='red' ? -1 : 1; // which row-direction counts as "advancing" for this side
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
    const score = color==='red' ? raw : -raw; // normalise: higher = better for the side to move
    const noisy = cfg.noise>0 ? score + (Math.random()*2-1)*cfg.noise : score;
    if(noisy>bestNoisy){ bestNoisy=noisy; best=m; }
    if(color==='red'){ if(score>alpha) alpha=score; } else { if(-score<beta) beta=-score; }
  }
  return best;
}

/* ---------------- Sound effects (synthesized, no audio files needed) ---------------- */
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

/* ---------------- AI Commentary (rule-based + Web Speech) ---------------- */
/* Voice/TTS + AI comment đã gỡ — stubs giữ tương thích gọi cũ */
function commentOnMove(entry){ /* no-op */ }
function commentOnGameEnd(winnerColor, isDraw){ /* no-op */ }
function clearComments(){ if(window.speechSynthesis) try{ speechSynthesis.cancel(); }catch(e){} }
function appendComment(){ return; }
function speakComment(){ return; }

/* ---------------- Confetti (lightweight, no library) ---------------- */
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

/* ---------------- Board themes ---------------- */
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
  },
  ember: {
    wood1:'#8a2e12', wood2:'#5c1c0a', wood3:'#2f0e05',
    grain1:'#ffb27a', grain2:'#f07a3a', grain3:'#c44a18',
    accent:'#ffd36a', accentGlow:'#ffe6a8'
  },
  ocean: {
    wood1:'#0d4f6c', wood2:'#09384d', wood3:'#052433',
    grain1:'#9ee7ff', grain2:'#5ec8e8', grain3:'#2f9fbf',
    accent:'#f0c36a', accentGlow:'#ffe2a0'
  },
  bamboo: {
    wood1:'#3d6b2e', wood2:'#2a4c20', wood3:'#173012',
    grain1:'#d7f0a8', grain2:'#b4d978', grain3:'#86b34a',
    accent:'#e8c36a', accentGlow:'#f5dfa0'
  },
  golden: {
    wood1:'#8a6a18', wood2:'#6a5010', wood3:'#3f2f08',
    grain1:'#ffe7a0', grain2:'#f0ce8e', grain3:'#d4a84a',
    accent:'#3fae7a', accentGlow:'#7fe0b4'
  },
  frost: {
    wood1:'#5a6e82', wood2:'#3e4e5e', wood3:'#25313c',
    grain1:'#e8f3ff', grain2:'#c5daf0', grain3:'#9bb6d0',
    accent:'#7ec8ff', accentGlow:'#b8e0ff'
  },
  dragon: {
    wood1:'#6b1520', wood2:'#4a0e16', wood3:'#2a080d',
    grain1:'#ffd36a', grain2:'#e0b84a', grain3:'#b8922e',
    accent:'#ffd36a', accentGlow:'#fff0b0'
  },
  vietnam: {
    wood1:'#c62828', wood2:'#8e0000', wood3:'#4a0000',
    grain1:'#ffd54f', grain2:'#ffb300', grain3:'#ff8f00',
    accent:'#ffd700', accentGlow:'#fff59d'
  },
  japan: {
    wood1:'#f5f5f5', wood2:'#e0e0e0', wood3:'#bdbdbd',
    grain1:'#ffffff', grain2:'#fafafa', grain3:'#eeeeee',
    accent:'#d32f2f', accentGlow:'#ff6659'
  },
  china: {
    wood1:'#de2910', wood2:'#a01c0c', wood3:'#6b1008',
    grain1:'#ffd54f', grain2:'#ffc107', grain3:'#ff8f00',
    accent:'#ffd700', accentGlow:'#fff59d'
  },
  korea: {
    wood1:'#f7f7f7', wood2:'#e8e8e8', wood3:'#cfcfcf',
    grain1:'#ffffff', grain2:'#f5f5f5', grain3:'#eeeeee',
    accent:'#c60c30', accentGlow:'#ff5a6e'
  },
  france: {
    wood1:'#002395', wood2:'#001a6e', wood3:'#001047',
    grain1:'#e8eefc', grain2:'#c5d0f0', grain3:'#8fa0d0',
    accent:'#ed2939', accentGlow:'#ff7a85'
  },
  germany: {
    wood1:'#1a1a1a', wood2:'#0d0d0d', wood3:'#050505',
    grain1:'#ffd54f', grain2:'#dd0000', grain3:'#ffc107',
    accent:'#ffcc00', accentGlow:'#ffe566'
  },
  italy: {
    wood1:'#009246', wood2:'#006b34', wood3:'#004d26',
    grain1:'#f5f5f5', grain2:'#e8e8e8', grain3:'#ce2b37',
    accent:'#ce2b37', accentGlow:'#ff6b73'
  },
  brazil: {
    wood1:'#009c3b', wood2:'#007a2e', wood3:'#005c22',
    grain1:'#ffdf00', grain2:'#f5d000', grain3:'#002776',
    accent:'#ffdf00', accentGlow:'#fff59d'
  },
  thailand: {
    wood1:'#a51931', wood2:'#7a1224', wood3:'#4d0b16',
    grain1:'#f4f5f8', grain2:'#2d2a4a', grain3:'#a51931',
    accent:'#2d2a4a', accentGlow:'#8a85b5'
  },
  singapore: {
    wood1:'#ef3340', wood2:'#c41e2a', wood3:'#8e121b',
    grain1:'#ffffff', grain2:'#f5f5f5', grain3:'#eeeeee',
    accent:'#ffffff', accentGlow:'#ffe0e0'
  },
  usa: {
    wood1:'#3c3b6e', wood2:'#2a2950', wood3:'#1a1933',
    grain1:'#b22234', grain2:'#ffffff', grain3:'#3c3b6e',
    accent:'#b22234', accentGlow:'#ff6b7a'
  },
  uk: {
    wood1:'#012169', wood2:'#011447', wood3:'#000d2e',
    grain1:'#c8102e', grain2:'#ffffff', grain3:'#012169',
    accent:'#c8102e', accentGlow:'#ff5a73'
  },
  canada: {
    wood1:'#ff0000', wood2:'#c40000', wood3:'#8a0000',
    grain1:'#ffffff', grain2:'#f5f5f5', grain3:'#eeeeee',
    accent:'#ffffff', accentGlow:'#ffcccc'
  },
  india: {
    wood1:'#ff9933', wood2:'#e07a10', wood3:'#b35c00',
    grain1:'#ffffff', grain2:'#138808', grain3:'#ff9933',
    accent:'#000080', accentGlow:'#6666cc'
  },
  argentina: {
    wood1:'#74acdf', wood2:'#5a96c8', wood3:'#3d6f9c',
    grain1:'#ffffff', grain2:'#f0f7fc', grain3:'#74acdf',
    accent:'#f6b40e', accentGlow:'#ffd666'
  },
  spain: {
    wood1:'#c60b1e', wood2:'#9a0818', wood3:'#6b0510',
    grain1:'#ffc400', grain2:'#f5b800', grain3:'#c60b1e',
    accent:'#ffc400', accentGlow:'#ffe066'
  },
  portugal: {
    wood1:'#006600', wood2:'#004d00', wood3:'#003300',
    grain1:'#ff0000', grain2:'#ffff00', grain3:'#006600',
    accent:'#ffcc00', accentGlow:'#ffe066'
  }
};

const THEME_META = {
  wood:{ name:'Gỗ trầm', price:0 },
  jade:{ name:'Ngọc bích', price:0 },
  rosewood:{ name:'Hồng mộc', price:0 },
  marble:{ name:'Cẩm thạch', price:0 },
  royal:{ name:'Hoàng gia', price:30 },
  midnight:{ name:'Đêm xanh', price:30 },
  sakura:{ name:'Anh đào', price:40 },
  obsidian:{ name:'Hắc diệu', price:40 },
  ember:{ name:'Than hồng', price:50 },
  ocean:{ name:'Đại dương', price:50 },
  bamboo:{ name:'Trúc xanh', price:60 },
  golden:{ name:'Hoàng kim', price:80 },
  frost:{ name:'Sương giá', price:80 },
  dragon:{ name:'Long vân', price:100 },
  vietnam:{ name:'Việt Nam', price:50 },
  japan:{ name:'Nhật Bản', price:50 },
  china:{ name:'Trung Quốc', price:55 },
  korea:{ name:'Hàn Quốc', price:55 },
  france:{ name:'Pháp', price:55 },
  germany:{ name:'Đức', price:55 },
  italy:{ name:'Ý', price:55 },
  brazil:{ name:'Brazil', price:60 },
  thailand:{ name:'Thái Lan', price:55 },
  singapore:{ name:'Singapore', price:55 },
  usa:{ name:'Hoa Kỳ', price:60 },
  uk:{ name:'Anh', price:60 },
  canada:{ name:'Canada', price:55 },
  india:{ name:'Ấn Độ', price:55 },
  argentina:{ name:'Argentina', price:55 },
  spain:{ name:'Tây Ban Nha', price:55 },
  portugal:{ name:'Bồ Đào Nha', price:55 }
};

const THEME_FLAGS = {
  vietnam: 'vn',
  japan: 'jp',
  china: 'cn',
  korea: 'kr',
  france: 'fr',
  germany: 'de',
  italy: 'it',
  brazil: 'br',
  thailand: 'th',
  singapore: 'sg',
  usa: 'us',
  uk: 'gb',
  canada: 'ca',
  india: 'in',
  argentina: 'ar',
  spain: 'es',
  portugal: 'pt'
};

const THEME_CLUBS = {
  realmadrid: {
    slug: 'real-madrid',
    name: 'Real Madrid',
    price: 70,
    bg: '#FEBE10',
    wood1: '#00529F', wood2: '#003d78', wood3: '#00284f',
    grain1: '#FEBE10', grain2: '#ffffff', grain3: '#00529F',
    accent: '#FEBE10', accentGlow: '#ffe08a'
  },
  barcelona: {
    slug: 'fc-barcelona',
    name: 'FC Barcelona',
    price: 70,
    bg: '#A50044',
    wood1: '#A50044', wood2: '#004D98', wood3: '#6b0030',
    grain1: '#A50044', grain2: '#004D98', grain3: '#FFED02',
    accent: '#FFED02', accentGlow: '#fff59d'
  },
  manchesterunited: {
    slug: 'manchester-united',
    name: 'Manchester United',
    price: 70,
    bg: '#DA291C',
    wood1: '#DA291C', wood2: '#9b1c14', wood3: '#5c100c',
    grain1: '#DA291C', grain2: '#FBEA0E', grain3: '#000000',
    accent: '#FBEA0E', accentGlow: '#fff59d'
  },
  liverpool: {
    slug: 'liverpool-fc',
    name: 'Liverpool',
    price: 70,
    bg: '#C8102E',
    wood1: '#C8102E', wood2: '#8a0b20', wood3: '#4d0612',
    grain1: '#C8102E', grain2: '#00B2A9', grain3: '#F6EB61',
    accent: '#00B2A9', accentGlow: '#7ff0e8'
  },
  chelsea: {
    slug: 'chelsea',
    name: 'Chelsea',
    price: 70,
    bg: '#034694',
    wood1: '#034694', wood2: '#02346e', wood3: '#012047',
    grain1: '#034694', grain2: '#DBA111', grain3: '#ffffff',
    accent: '#DBA111', accentGlow: '#f5d56a'
  },
  arsenal: {
    slug: 'arsenal',
    name: 'Arsenal',
    price: 70,
    bg: '#EF0107',
    wood1: '#EF0107', wood2: '#9b0105', wood3: '#5c0003',
    grain1: '#EF0107', grain2: '#063672', grain3: '#9C824A',
    accent: '#9C824A', accentGlow: '#d4b87a'
  },
  bayern: {
    slug: 'bayern-munich',
    name: 'Bayern München',
    price: 70,
    bg: '#DC052D',
    wood1: '#DC052D', wood2: '#9a0320', wood3: '#5c0213',
    grain1: '#DC052D', grain2: '#0066B2', grain3: '#ffffff',
    accent: '#0066B2', accentGlow: '#66a3d9'
  },
  psg: {
    slug: 'paris-saint-germain-psg',
    name: 'PSG',
    price: 70,
    bg: '#004170',
    wood1: '#004170', wood2: '#002d4d', wood3: '#001a2e',
    grain1: '#004170', grain2: '#DA291C', grain3: '#ffffff',
    accent: '#DA291C', accentGlow: '#ff6b5c'
  },
  juventus: {
    slug: 'juventus',
    name: 'Juventus',
    price: 70,
    bg: '#000000',
    wood1: '#1a1a1a', wood2: '#0d0d0d', wood3: '#000000',
    grain1: '#ffffff', grain2: '#c0c0c0', grain3: '#000000',
    accent: '#ffffff', accentGlow: '#e0e0e0'
  },
  milan: {
    slug: 'ac-milan',
    name: 'AC Milan',
    price: 70,
    bg: '#FB090B',
    wood1: '#FB090B', wood2: '#8B0000', wood3: '#1a0000',
    grain1: '#FB090B', grain2: '#000000', grain3: '#ffffff',
    accent: '#ffffff', accentGlow: '#ffcccc'
  },
  inter: {
    slug: 'inter-milan',
    name: 'Inter Milan',
    price: 70,
    bg: '#010E80',
    wood1: '#010E80', wood2: '#010a5c', wood3: '#00063d',
    grain1: '#010E80', grain2: '#A8A9AD', grain3: '#000000',
    accent: '#A8A9AD', accentGlow: '#d0d0d4'
  },
  manchester_city: {
    slug: 'manchester-city',
    name: 'Manchester City',
    price: 70,
    bg: '#6CABDD',
    wood1: '#6CABDD', wood2: '#3d7eae', wood3: '#1e4d70',
    grain1: '#6CABDD', grain2: '#1C2C5B', grain3: '#FFC659',
    accent: '#FFC659', accentGlow: '#ffe0a0'
  }
};

function footyLogoUrl(slug, ext){
  ext = ext || 'png';
  return 'https://assets.footylogos.com/logos/' + slug + '/' + slug + '-logo-footylogos.' + ext;
}
function footyLogoImgHtml(slug, cls, alt){
  const png = footyLogoUrl(slug, 'png');
  const svg = footyLogoUrl(slug, 'svg');
  return '<img class="'+(cls||'gift-club-logo')+'" src="'+png+'" data-svg="'+svg+'" alt="'+(alt||'')+'" loading="lazy" onerror="if(this.dataset.svg&&this.src!==this.dataset.svg){this.src=this.dataset.svg;}else{this.style.display=\'none\';}"/>';
}

(function mergeClubThemes(){
  if(typeof THEME_CLUBS === 'undefined') return;
  Object.keys(THEME_CLUBS).forEach(id=>{
    const c = THEME_CLUBS[id];
    THEMES[id] = {
      wood1: c.wood1, wood2: c.wood2, wood3: c.wood3,
      grain1: c.grain1, grain2: c.grain2, grain3: c.grain3,
      accent: c.accent, accentGlow: c.accentGlow
    };
    THEME_META[id] = { name: c.name, price: c.price, club: true, slug: c.slug };
  });
})();





const THEME_STORAGE_KEY = 'co-tuong-theme';

const CHECKIN_REWARD = 15;

/** Cửa hàng quà ảo — 1000 món (sinh tự động) */
function buildShopCatalog(){
  const UNIQUE = [
    ['🧸','Gấu bông','plush',20],['🐻','Gấu nâu','plush',22],['🐼','Gấu trúc','plush',28],['🐰','Thỏ bông','plush',18],
    ['🦊','Cáo bông','plush',24],['🐨','Koala','plush',26],['🐯','Hổ bông','plush',30],['🦁','Sư tử bông','plush',30],
    ['🐮','Bò bông','plush',16],['🐷','Heo bông','plush',16],['🐸','Ếch bông','plush',15],['🐵','Khỉ bông','plush',18],
    ['🐔','Gà bông','plush',14],['🐧','Cánh cụt','plush',22],['🦄','Kỳ lân bông','plush',40],['🐙','Bạch tuộc bông','plush',20],
    ['🦋','Bướm bông','plush',15],['🐢','Rùa bông','plush',17],['🐳','Cá voi bông','plush',25],['🐬','Cá heo bông','plush',24],
    ['🌹','Hồng đỏ','flower',15],['🥀','Hồng héo','flower',12],['🌺','Dâm bụt','flower',14],['🌻','Hướng dương','flower',18],
    ['🌼','Cúc họa mi','flower',12],['🌷','Tulip','flower',16],['🌱','Mầm xanh','flower',8],['🌲','Thông','flower',10],
    ['🌳','Cây xanh','flower',10],['🌴','Cọ','flower',12],['🌵','Xương rồng','flower',11],['🌾','Lúa','flower',9],
    ['🌿','Lá thơm','flower',9],['☘️','Cỏ ba lá','flower',10],['🍀','Cỏ may mắn','flower',14],['🍁','Lá phong','flower',11],
    ['🍂','Lá thu','flower',10],['🍃','Lá bay','flower',9],['🍄','Nấm','flower',13],['🪸','San hô','flower',20],
    ['🪷','Hoa sen','flower',25],['🪻','Hoa lan','flower',22],['💐','Bó hoa','flower',35],['🌸','Anh đào','flower',17],
    ['🐱','Mèo','pet',40],['🐈','Mèo trắng','pet',42],['🐈‍⬛','Mèo đen','pet',42],['🐶','Cún','pet',45],
    ['🦮','Corgi','pet',48],['🐕','Chó săn','pet',44],['🐩','Poodle','pet',46],['🐇','Thỏ con','pet',35],
    ['🐹','Hamster','pet',28],['🐥','Gà con','pet',20],['🐦','Chim','pet',22],['🐤','Gà vàng','pet',18],
    ['🐉','Rồng con','pet',90],['🐟','Cá','pet',18],['🐠','Cá nhiệt đới','pet',20],['🐡','Cá nóc','pet',22],
    ['🐝','Ong','pet',16],['🐞','Bọ rùa','pet',14],['🦕','Khủng long cổ','pet',70],['🦖','T-Rex','pet',75],
    ['🐎','Ngựa','pet',50],['🦓','Ngựa vằn','pet',52],['🦍','Khỉ đột','pet',60],['🦘','Kangaroo','pet',48],
    ['🎂','Bánh kem','food',25],['🧁','Bánh cupcake','food',14],['🍩','Donut','food',12],['🍪','Bánh quy','food',10],
    ['🍬','Kẹo','food',8],['🍭','Kẹo mút','food',9],['🍫','Chocolate','food',14],['🍦','Kem ốc quế','food',15],
    ['🧋','Trà sữa','food',16],['☕','Cà phê','food',10],['🍵','Trà','food',9],['🧃','Nước ép','food',11],
    ['🍕','Pizza','food',18],['🍣','Sushi','food',20],[' dumpling','Bánh bao','food',12],['🍿','Bắp rang','food',11],
    ['🍎','Táo','food',8],['🍐','Lê','food',8],['🍊','Cam','food',8],['🍋','Chanh','food',7],
    ['🍌','Chuối','food',7],['🍉','Dưa hấu','food',10],['🍇','Nho','food',9],['🍓','Dâu','food',10],
    ['🍒','Cherry','food',9],['🍑','Đào','food',9],['🥭','Xoài','food',10],['🍍','Dứa','food',11],
    ['🥝','Kiwi','food',9],['🍅','Cà chua','food',7],['🥑','Bơ','food',12],['🌽','Ngô','food',8],
    ['❤️','Trái tim đỏ','special',10],['🧡','Trái tim cam','special',10],['💛','Trái tim vàng','special',10],['💚','Trái tim xanh','special',10],
    ['💙','Trái tim blue','special',10],['💜','Trái tim tím','special',10],['🖤','Trái tim đen','special',12],['🤍','Trái tim trắng','special',12],
    ['💕','Hai tim','special',14],['💖','Tim lấp lánh','special',15],['💘','Tim mũi tên','special',14],['💝','Tim hộp quà','special',18],
    ['⭐','Ngôi sao','special',12],['🌟','Sao sáng','special',14],['✨','Lấp lánh','special',11],['💫','Sao băng','special',16],
    ['👑','Vương miện','special',70],['💎','Ngọc','special',65],['💍','Nhẫn','special',55],['🏆','Cúp vàng','special',80],
    ['🥇','HC vàng','special',50],['🥈','HC bạc','special',40],['🥉','HC đồng','special',30],['🎖️','Huy chương','special',35],
    ['🎁','Hộp quà','special',40],['🎀','Nơ','special',15],['🎈','Bóng bay','special',12],['🎉','Party','special',20],
    ['🎆','Pháo hoa','special',30],['🎇','Pháo sáng','special',28],['🌈','Cầu vồng','special',28],['🌙','Trăng','special',32],
    ['☀️','Mặt trời','special',25],['⚡','Sét','special',22],['🔥','Lửa','special',24],['❄️','Tuyết','special',22],
    ['💧','Giọt nước','special',8],['🌊','Sóng','special',20],['🎵','Nốt nhạc','special',18],['🎶','Giai điệu','special',18],
    ['🔮','Quả cầu','special',45],['🧸','Teddy VIP','plush',35]
  ];
  const out = {};
  const seen = new Set();
  let i = 0;
  UNIQUE.forEach(row=>{
    let [emoji, name, cat, price] = row;
    if(emoji === ' dumpling') { emoji = '🥟'; name = 'Bánh bao'; }
    if(!emoji || seen.has(emoji)) return;
    seen.add(emoji);
    i++;
    const id = 'item_'+i;
    out[id] = {
      id, cat, type:'gift', name, emoji, price: Math.max(5, +price||10),
      desc: name + ' — quà ảo (emoji độc quyền)'
    };
  });
  const themeEmoji = {
    royal:'🏰', midnight:'🌃', sakura:'💮', obsidian:'🌑',
    ember:'🌋', ocean:'🛳️', bamboo:'🎋', golden:'🪙', frost:'☃️', dragon:'🐲'
  };
  if(typeof THEME_META !== 'undefined'){
    Object.keys(THEME_META).forEach(tid=>{
      const meta = THEME_META[tid];
      if(!meta || !meta.price) return;
      const flag = (typeof THEME_FLAGS !== 'undefined' && THEME_FLAGS[tid]) ? THEME_FLAGS[tid] : null;
      let em = themeEmoji[tid] || (flag ? '' : '🎨');
      if(!flag){
        if(seen.has(em)) em = '🎨';
        if(seen.has(em) && tid==='golden') em = '🏅';
        if(em) seen.add(em);
      }
      const id = 'theme_'+tid;
      out[id] = {
        id, cat:'theme', type:'theme', themeId:tid,
        name:'Giao diện '+meta.name,
        emoji: em || '',
        flag: flag || null,
        club: meta.club ? true : false,
        clubSlug: meta.slug || null,
        price: meta.price,
        desc: flag
          ? ('Giao diện cờ quốc gia · mở khóa bàn «'+meta.name+'»')
          : (meta.club
            ? ('Logo CLB (FootyLogos) · «'+meta.name+'»')
            : ('Mở khóa giao diện bàn «'+meta.name+'»'))
      };
    });
  }
  // Club themes (FootyLogos) — đảm bảo có trong shop
  if(typeof THEME_CLUBS !== 'undefined'){
    Object.keys(THEME_CLUBS).forEach(id=>{
      const c = THEME_CLUBS[id];
      const sid = 'theme_'+id;
      if(out[sid]) return;
      out[sid] = {
        id: sid, cat:'theme', type:'theme', themeId:id,
        name: 'Giao diện '+c.name,
        emoji: '⚽',
        flag: null,
        club: true,
        clubSlug: c.slug,
        price: c.price,
        desc: 'Logo CLB (FootyLogos) · «'+c.name+'»'
      };
    });
  }
  return out;
}
const SHOP_ITEMS = buildShopCatalog();
let shopTab = 'all';
let shopPage = 0;
const SHOP_PAGE_SIZE = 60;

let coinState = { coins: 0, unlocked: ['wood','jade','rosewood','marble'], lastCheckIn: '', inventory: {}, active: {} };

function todayStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function isThemeUnlocked(id){
  const meta = THEME_META[id] || { price:0 };
  if(!meta.price) return true;
  return (coinState.unlocked || []).includes(id);
}

function applyTheme(themeId, opts={}){
  if(!THEMES[themeId]) themeId = 'wood';
  if(!opts.force && !isThemeUnlocked(themeId)){
    setCheckInStatus('Giao diện «'+(THEME_META[themeId]?.name||themeId)+'» đang khóa. Đủ coin để mở.', true);
    return false;
  }
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

  document.querySelectorAll('.theme-swatch').forEach(b=>{
    b.classList.toggle('active', b.dataset.theme===themeId);
  });
  try{ updateBoardFlag(themeId); }catch(e){}
  if(!opts.preview){
    try{ localStorage.setItem(THEME_STORAGE_KEY, themeId); }catch(err){}
  }
  return true;
}

function updateBoardFlag(themeId){
  const layer = document.getElementById('boardFlagLayer');
  const bg = document.getElementById('boardBgRect');
  if(!layer) return;
  while(layer.firstChild) layer.removeChild(layer.firstChild);
  const ns = 'http://www.w3.org/2000/svg';
  const W = (typeof svgW !== 'undefined' ? svgW : 558);
  const H = (typeof svgH !== 'undefined' ? svgH : 620);
  const code = (typeof THEME_FLAGS !== 'undefined' && THEME_FLAGS[themeId]) ? THEME_FLAGS[themeId] : null;
  const club = (typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[themeId]) ? THEME_CLUBS[themeId] : null;

  const wrap = document.getElementById('boardWrap') || document.querySelector('.board-wrap');
  if(wrap){
    if(code || club) wrap.setAttribute('data-flag', themeId);
    else wrap.removeAttribute('data-flag');
  }

  if(!code && !club){
    if(bg) bg.setAttribute('fill', 'url(#woodGrain)');
    return;
  }

  if(club){
    if(bg) bg.setAttribute('fill', club.bg || '#111');
    let defs = svg.querySelector('defs');
    if(defs && !document.getElementById('flagShadowFilter')){
      const filter = document.createElementNS(ns, 'filter');
      filter.setAttribute('id', 'flagShadowFilter');
      filter.setAttribute('x', '-15%'); filter.setAttribute('y', '-15%');
      filter.setAttribute('width', '130%'); filter.setAttribute('height', '130%');
      filter.innerHTML = '<feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.4"/>';
      defs.appendChild(filter);
    }
    const size = Math.min(W, H) * 0.72;
    const ox = (W - size) / 2;
    const oy = (H - size) / 2;
    const img = document.createElementNS(ns, 'image');
    img.setAttribute('id', 'boardFlagImage');
    img.setAttribute('x', String(ox));
    img.setAttribute('y', String(oy));
    img.setAttribute('width', String(size));
    img.setAttribute('height', String(size));
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    img.setAttribute('opacity', '0.55');
    const urlPng = footyLogoUrl(club.slug, 'png');
    const urlSvg = footyLogoUrl(club.slug, 'svg');
    img.setAttribute('href', urlPng);
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', urlPng);
    img.addEventListener('error', ()=>{
      try{
        img.setAttribute('href', urlSvg);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', urlSvg);
      }catch(e){}
    });
    img.setAttribute('filter', 'url(#flagShadowFilter)');
    img.setAttribute('style', 'pointer-events:none');
    layer.appendChild(img);
    return;
  }

  if(bg) bg.setAttribute('fill', '#0a0a0a');

  let defs = svg.querySelector('defs');
  if(defs && !document.getElementById('flagShadowFilter')){
    const filter = document.createElementNS(ns, 'filter');
    filter.setAttribute('id', 'flagShadowFilter');
    filter.setAttribute('x', '-8%');
    filter.setAttribute('y', '-8%');
    filter.setAttribute('width', '116%');
    filter.setAttribute('height', '116%');
    filter.innerHTML =
      '<feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.28"/>'+
      '<feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#000000" flood-opacity="0.18"/>';
    defs.appendChild(filter);

    const soft = document.createElementNS(ns, 'filter');
    soft.setAttribute('id', 'flagGlowFilter');
    soft.setAttribute('x', '-5%');
    soft.setAttribute('y', '-5%');
    soft.setAttribute('width', '110%');
    soft.setAttribute('height', '110%');
    soft.innerHTML =
      '<feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#ffffff" flood-opacity="0.1"/>';
    defs.appendChild(soft);
  }

  const url4x3 = 'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/flags/4x3/' + code + '.svg';
  const url1x1 = 'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/flags/1x1/' + code + '.svg';

  const img = document.createElementNS(ns, 'image');
  img.setAttribute('id', 'boardFlagImage');
  img.setAttribute('x', '0');
  img.setAttribute('y', '0');
  img.setAttribute('width', String(W));
  img.setAttribute('height', String(H));
  img.setAttribute('preserveAspectRatio', 'none');
  img.setAttribute('opacity', '0.42');
  img.setAttribute('href', url4x3);
  img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url4x3);
  img.setAttribute('filter', 'url(#flagShadowFilter)');
  img.setAttribute('style', 'pointer-events:none');
  img.addEventListener('error', ()=>{
    try{
      img.setAttribute('href', url1x1);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url1x1);
    }catch(e){}
  });
  layer.appendChild(img);

  const rim = document.createElementNS(ns, 'rect');
  rim.setAttribute('x', '1.5');
  rim.setAttribute('y', '1.5');
  rim.setAttribute('width', String(W - 3));
  rim.setAttribute('height', String(H - 3));
  rim.setAttribute('rx', '10');
  rim.setAttribute('fill', 'none');
  rim.setAttribute('stroke', 'rgba(255,255,255,0.16)');
  rim.setAttribute('stroke-width', '1.5');
  rim.setAttribute('filter', 'url(#flagGlowFilter)');
  layer.appendChild(rim);
}

function shopItemIconHtml(it){
  if(it && it.flag){
    return '<span class="fi fi-'+it.flag+' fis gift-flag" title="'+(it.flag||'').toUpperCase()+'"></span>';
  }
  if(it && (it.club || it.clubSlug)){
    const slug = it.clubSlug || (THEME_META[it.themeId] && THEME_META[it.themeId].slug);
    if(slug) return footyLogoImgHtml(slug, 'gift-club-logo', it.name||'');
  }
  const em = (it && it.emoji && String(it.emoji).trim()) ? it.emoji : '🎁';
  return em;
}
function previewTheme(themeId){
  if(!THEMES[themeId]) return;
  applyTheme(themeId, { force:true, preview:true });
  const name = (THEME_META[themeId] && THEME_META[themeId].name) || themeId;
  setShopStatus('Đang xem thử «'+name+'» — tải lại trang sẽ mất bản xem thử.', false);
  try{
    showCoinPopup({
      icon: '👁️',
      title: 'Xem thử giao diện',
      html: '<div class="coin-popup-item">«<b>'+name+'</b>»</div>'+
        '<div class="coin-popup-hint">Chỉ xem tạm trên máy này. Tải lại trang sẽ trở về giao diện đã lưu / đã mở khóa. Bấm Mở khóa để mua vĩnh viễn.</div>'
    });
  }catch(e){}
}

function refreshThemeLocks(){
  document.querySelectorAll('.theme-swatch').forEach(btn=>{
    const id = btn.dataset.theme;
    const price = +(btn.dataset.price || THEME_META[id]?.price || 0);
    const unlocked = isThemeUnlocked(id);
    btn.classList.toggle('locked', !unlocked);
    btn.title = (THEME_META[id]?.name || id) + (unlocked ? (price? ' (Đã mở)' : ' (Miễn phí)') : ' · '+price+' coin — chạm để mua');
    let tag = btn.querySelector('.theme-lock-tag');
    if(!unlocked){
      if(!tag){
        tag = document.createElement('span');
        tag.className = 'theme-lock-tag';
        btn.appendChild(tag);
      }
      tag.textContent = price;
    } else if(tag) tag.remove();
  });
  const bal = document.getElementById('coinBalance');
  if(bal) bal.textContent = String(coinState.coins||0);
  const btn = document.getElementById('checkInBtn');
  if(btn){
    const done = !!(getCoinIdentity() && coinState.lastCheckIn === todayStr());
    btn.disabled = done;
    btn.innerHTML = done
      ? '<i class="fa-regular fa-circle-check"></i> Đã điểm danh'
      : '<i class="fa-regular fa-calendar-check"></i> Điểm danh (+'+CHECKIN_REWARD+')';
  }
  const sb = document.getElementById('shopCoinBalance');
  if(sb) sb.textContent = String(coinState.coins||0);
}

function setCheckInStatus(msg, warn){
  const el = document.getElementById('checkInStatus');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'online-status' + (warn ? ' warn' : msg ? ' live' : '');
}

function getCoinIdentity(){
  if(playerSession && playerSession.id){
    return {
      kind: 'player',
      id: playerSession.id,
      code: playerSession.code || '',
      name: playerSession.name || playerSession.code || 'Kỳ thủ'
    };
  }
  try{
    const meta = typeof getAdminSessionMeta === 'function' ? getAdminSessionMeta() : null;
    if(meta && meta.ok){
      if(meta.via === 'superadmin' && meta.playerId){
        return {
          kind: 'player',
          id: meta.playerId,
          code: meta.code || '',
          name: meta.name || meta.code || 'Admin chính'
        };
      }
      return {
        kind: 'admin',
        id: 'site_admin',
        code: 'ADMIN',
        name: 'Admin website'
      };
    }
  }catch(e){}
  return null;
}

async function loadCoinStateFromPlayer(){
  coinState = { coins: 0, unlocked: ['wood','jade','rosewood','marble'], lastCheckIn: '', inventory: {}, active: {} };
  const ident = getCoinIdentity();
  if(!ident){
    try{
      const raw = localStorage.getItem('co-tuong-coins-guest');
      if(raw){
        const g = JSON.parse(raw);
        if(Array.isArray(g.unlocked)) coinState.unlocked = Array.from(new Set([...coinState.unlocked, ...g.unlocked]));
      }
    }catch(e){}
    refreshThemeLocks();
    return;
  }
  try{
    await tcEnsureFb();
    if(ident.kind === 'player'){
      const snap = await fb.db.ref('players/'+ident.id).once('value');
      const p = snap.val() || {};
      coinState.coins = Math.max(0, +(p.coins||0));
      const unlocked = Array.isArray(p.unlockedThemes) ? p.unlockedThemes : [];
      coinState.unlocked = Array.from(new Set(['wood','jade','rosewood','marble', ...unlocked]));
      coinState.lastCheckIn = p.lastCheckIn || '';
      coinState.inventory = (p.inventory && typeof p.inventory === 'object') ? p.inventory : {};
      coinState.active = (p.activeItems && typeof p.activeItems === 'object') ? p.activeItems : {};
    } else {
      const snap = await fb.db.ref('admin/wallets/'+ident.id).once('value');
      const w = snap.val() || {};
      coinState.coins = Math.max(0, +(w.coins||0));
      coinState.lastCheckIn = w.lastCheckIn || '';
      coinState.inventory = (w.inventory && typeof w.inventory === 'object') ? w.inventory : {};
      coinState.active = {};
      try{
        const raw = localStorage.getItem('co-tuong-admin-themes');
        if(raw){
          const u = JSON.parse(raw);
          if(Array.isArray(u)) coinState.unlocked = Array.from(new Set([...coinState.unlocked, ...u]));
        }
      }catch(e){}
    }
  }catch(e){
    console.warn('loadCoinState', e);
  }
  refreshThemeLocks();
  applyActiveItemEffects();
  try{ renderShopList(); }catch(e){}
  try{ renderInventoryList(); }catch(e){}
}

async function saveCoinStateToPlayer(){
  const ident = getCoinIdentity();
  if(!ident) return;
  try{
    await tcEnsureFb();
    if(ident.kind === 'player'){
      await fb.db.ref('players/'+ident.id).update({
        coins: coinState.coins,
        unlockedThemes: coinState.unlocked,
        lastCheckIn: coinState.lastCheckIn || null,
        inventory: coinState.inventory || {},
        activeItems: coinState.active || {}
      });
    } else {
      await fb.db.ref('admin/wallets/'+ident.id).update({
        coins: coinState.coins,
        lastCheckIn: coinState.lastCheckIn || null,
        inventory: coinState.inventory || {},
        updatedAt: Date.now()
      });
      try{ localStorage.setItem('co-tuong-admin-themes', JSON.stringify(coinState.unlocked||[])); }catch(e){}
    }
  }catch(e){
    setCheckInStatus('Lưu coin thất bại: '+(e.message||e), true);
  }
}

async function doDailyCheckIn(){
  const ident = getCoinIdentity();
  if(!ident){
    setCheckInStatus('Đăng nhập Kỳ thủ hoặc Admin để điểm danh.', true);
    return;
  }
  const btn = document.getElementById('checkInBtn');
  if(btn) btn.disabled = true;
  try{
    await loadCoinStateFromPlayer();
    const today = todayStr();
    if(coinState.lastCheckIn === today){
      setCheckInStatus('Hôm nay «'+ident.name+'» đã điểm danh rồi.', true);
      refreshThemeLocks();
      return;
    }
    const reward = CHECKIN_REWARD;
    coinState.lastCheckIn = today;
    coinState.coins = Math.max(0, +(coinState.coins||0)) + reward;
    await saveCoinStateToPlayer();
    try{
      await fb.db.ref('admin/checkIns/'+today+'/'+ident.id).set({
        code: ident.code || '',
        name: ident.name || '',
        kind: ident.kind,
        ts: Date.now(),
        reward
      });
      if(ident.kind === 'player'){
        await fb.db.ref('players/'+ident.id).update({ lastCheckInTs: Date.now() });
      }
    }catch(e){ console.warn('checkIn log', e); }
    refreshThemeLocks();
    setCheckInStatus('Điểm danh thành công ('+ident.name+')! +'+reward+' coin · Số dư: '+coinState.coins, false);
  }catch(err){
    setCheckInStatus('Điểm danh thất bại: '+(err.message||err), true);
  }finally{
    refreshThemeLocks();
  }
}

async function trySelectTheme(themeId){
  if(!THEMES[themeId]) return;
  if(isThemeUnlocked(themeId)){
    applyTheme(themeId);
    return;
  }
  const price = THEME_META[themeId]?.price || 0;
  if(!playerSession){
    setCheckInStatus('Đăng nhập kỳ thủ để mua giao diện ('+price+' coin).', true);
    return;
  }
  await loadCoinStateFromPlayer();
  if(isThemeUnlocked(themeId)){
    applyTheme(themeId);
    return;
  }
  if(coinState.coins < price){
    setCheckInStatus('Không đủ coin (cần '+price+', đang có '+coinState.coins+'). Hãy điểm danh mỗi ngày.', true);
    return;
  }
  if(!confirm('Mở khóa «'+(THEME_META[themeId]?.name||themeId)+'» với '+price+' coin?')) return;
  coinState.coins -= price;
  if(!coinState.unlocked.includes(themeId)) coinState.unlocked.push(themeId);
  await saveCoinStateToPlayer();
  applyTheme(themeId, { force:true });
  refreshThemeLocks();
  setCheckInStatus('Đã mở «'+(THEME_META[themeId]?.name||themeId)+'». Còn '+coinState.coins+' coin.', false);
}

function applyActiveItemEffects(){
  document.documentElement.classList.remove('fx-piece-glow','fx-move-trail','fx-board-glow','fx-sfx-premium','fx-chat-gold');
}

function setShopStatus(msg, warn){
  const el = document.getElementById('shopStatus');
  if(el){ el.textContent = msg||''; el.className = 'online-status'+(warn?' warn': msg?' live':''); }
  setCheckInStatus(msg, warn);
}

function showCoinPopup(opts){
  const o = opts || {};
  const overlay = document.getElementById('coinPopupOverlay');
  if(!overlay){ alert(o.body || o.title || ''); return; }
  const icon = document.getElementById('coinPopupIcon');
  const title = document.getElementById('coinPopupTitle');
  const body = document.getElementById('coinPopupBody');
  if(icon) icon.textContent = o.icon || (o.warn ? '⚠️' : '💰');
  if(title) title.textContent = o.title || 'Thông báo';
  if(body){
    if(o.html) body.innerHTML = o.html;
    else body.textContent = o.body || '';
  }
  overlay.classList.add('show');
  overlay.classList.toggle('warn', !!o.warn);
}
function closeCoinPopup(){
  document.getElementById('coinPopupOverlay')?.classList.remove('show');
}

function setInvStatus(msg, warn){
  const el = document.getElementById('invStatus');
  if(el){ el.textContent = msg||''; el.className = 'online-status'+(warn?' warn': msg?' live':''); }
}

function openShopPanel(){
  document.getElementById('shopOverlay')?.classList.add('show');
  document.getElementById('invOverlay')?.classList.remove('show');
  closeDrawer();
  loadCoinStateFromPlayer().then(()=> renderShopList());
}
function closeShopPanel(){
  document.getElementById('shopOverlay')?.classList.remove('show');
}
function openInvPanel(){
  document.getElementById('invOverlay')?.classList.add('show');
  document.getElementById('shopOverlay')?.classList.remove('show');
  closeDrawer();
  loadCoinStateFromPlayer().then(()=> renderInventoryList());
}
function closeInvPanel(){
  document.getElementById('invOverlay')?.classList.remove('show');
}

function renderShopList(){
  const box = document.getElementById('shopList');
  if(!box) return;
  const tab = shopTab || 'all';
  const bal = document.getElementById('shopCoinBalance');
  if(bal) bal.textContent = String(coinState.coins||0);
  if(tab === 'auction'){
    renderAuctionList(box);
    return;
  }
  const inv = coinState.inventory || {};
  const items = Object.values(SHOP_ITEMS).filter(it => {
    if(!(tab==='all' || it.cat===tab)) return false;
    if(it.type === 'theme'){
      return !isThemeUnlocked(it.themeId);
    }
    if(+inv[it.id] > 0) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(items.length / SHOP_PAGE_SIZE));
  if(shopPage >= totalPages) shopPage = totalPages - 1;
  if(shopPage < 0) shopPage = 0;
  const slice = items.slice(shopPage * SHOP_PAGE_SIZE, shopPage * SHOP_PAGE_SIZE + SHOP_PAGE_SIZE);
  box.innerHTML = '';
  const pager = document.createElement('div');
  pager.className = 'shop-pager';
  pager.innerHTML =
    '<button type="button" class="action-btn" id="shopPrevPage">«</button>'+
    '<span class="shop-page-info">Trang '+(shopPage+1)+'/'+totalPages+' · '+items.length+' món</span>'+
    '<button type="button" class="action-btn" id="shopNextPage">»</button>';
  box.appendChild(pager);
  pager.querySelector('#shopPrevPage').addEventListener('click', ()=>{ shopPage--; renderShopList(); });
  pager.querySelector('#shopNextPage').addEventListener('click', ()=>{ shopPage++; renderShopList(); });

  if(!slice.length){
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.textContent = 'Không có vật phẩm.';
    box.appendChild(empty);
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'shop-grid';
  slice.forEach(it=>{
    const isTheme = it.type === 'theme';
    const ownedGift = +((coinState.inventory||{})[it.id]||0);
    const ownedTheme = isTheme && isThemeUnlocked(it.themeId);
    const card = document.createElement('div');
    card.className = 'gift-card'+(ownedTheme?' owned':'');
    const emoji = shopItemIconHtml(it);
    const descExtra = isTheme
      ? (ownedTheme ? ' · Đã mở' : ' · Mở khóa giao diện')
      : (ownedGift ? ' · Có: '+ownedGift : '');
    const btnLabel = isTheme ? (ownedTheme ? 'Dùng' : 'Mở khóa') : 'Mua';
    const priceHtml = (isTheme && ownedTheme)
      ? '<div class="gift-price">Đã có</div>'
      : '<div class="gift-price"><i class="fa-regular fa-coins"></i> '+it.price+'</div>';
    const previewBtn = isTheme
      ? '<button type="button" class="action-btn gift-preview-btn">Xem thử</button>'
      : '';
    card.innerHTML =
      '<div class="gift-emoji gift-emoji-icon">'+emoji+'</div>'+
      '<div class="gift-name">'+it.name+'</div>'+
      '<div class="gift-desc">'+it.desc+descExtra+'</div>'+
      priceHtml+
      '<div class="gift-actions">'+
        previewBtn+
        '<button type="button" class="action-btn gift-buy">'+btnLabel+'</button>'+
      '</div>';
    card.querySelector('.gift-buy').addEventListener('click', ()=>{
      if(isTheme && ownedTheme) applyTheme(it.themeId, { force:true });
      else buyShopItem(it.id);
    });
    const pb = card.querySelector('.gift-preview-btn');
    if(pb) pb.addEventListener('click', ()=> previewTheme(it.themeId));
    grid.appendChild(card);
  });
  box.appendChild(grid);
}

function renderInventoryList(){
  const box = document.getElementById('invList');
  if(!box) return;
  box.innerHTML = '';
  const inv = coinState.inventory || {};
  const keys = Object.keys(inv).filter(k => inv[k] > 0 && SHOP_ITEMS[k]);
  if(!keys.length){
    box.innerHTML = '<div class="admin-empty">Kho trống — mua trong Cửa hàng hoặc nhận bằng mã quà.</div>';
    return;
  }
  keys.sort((a,b)=> (SHOP_ITEMS[a].name||'').localeCompare(SHOP_ITEMS[b].name||'', 'vi'));
  keys.forEach(id=>{
    const it = SHOP_ITEMS[id];
    const qty = inv[id];
    const sellPrice = Math.floor((it.price||0) * 0.6);
    const card = document.createElement('div');
    card.className = 'gift-card owned';
    card.innerHTML =
      '<div class="gift-emoji">'+(it.emoji||'🎁')+'</div>'+
      '<div class="gift-name">'+it.name+'</div>'+
      '<div class="gift-desc">'+it.desc+' · ×'+qty+'</div>'+
      '<div class="gift-price">Bán lại: '+sellPrice+' coin <span style="opacity:.7">(−40%)</span></div>'+
      '<div class="gift-actions">'+
        '<button type="button" class="action-btn gift-code-btn">Mã</button>'+
        '<button type="button" class="action-btn gift-sell-btn">Bán</button>'+
        '<button type="button" class="action-btn gift-auction-btn">Đấu giá</button>'+
      '</div>';
    card.querySelector('.gift-code-btn').addEventListener('click', ()=> createGiftCode(id));
    card.querySelector('.gift-sell-btn').addEventListener('click', ()=> sellInventoryItem(id));
    card.querySelector('.gift-auction-btn').addEventListener('click', ()=> listItemForAuction(id));
    box.appendChild(card);
  });
}

function buildShopCard(){ return document.createElement('div'); }

async function buyShopItem(itemId){
  const it = SHOP_ITEMS[itemId];
  if(!it) return;
  if(!getCoinIdentity()){
    setShopStatus('Đăng nhập Kỳ thủ hoặc Admin để mua.', true);
    return;
  }
  await loadCoinStateFromPlayer();
  const have = Math.max(0, +(coinState.coins||0));
  const need = Math.max(0, +(it.price||0));
  const missing = Math.max(0, need - have);

  if(it.type === 'theme' && it.themeId){
    if(isThemeUnlocked(it.themeId)){
      setShopStatus('Bạn đã mở «'+it.name+'».', true);
      applyTheme(it.themeId, { force:true });
      renderShopList();
      return;
    }
    if(have < need){
      setShopStatus('Không đủ coin — có '+have+', cần '+need+', thiếu '+missing+'.', true);
      showCoinPopup({
        warn:true,
        icon: '💸',
        title: 'Không đủ coin',
        html: '<div class="coin-popup-item">'+(it.emoji||'')+' <b>'+it.name+'</b></div>'+
          '<ul class="coin-popup-list">'+
          '<li>Giá mở khóa: <b>'+need+'</b> coin</li>'+
          '<li>Bạn đang có: <b>'+have+'</b> coin</li>'+
          '<li>Còn thiếu: <b class="coin-miss">'+missing+'</b> coin</li>'+
          '</ul>'
      });
      return;
    }
    if(!confirm('Mở khóa '+(it.emoji||'')+' «'+it.name+'» với '+need+' coin?\nSố dư hiện tại: '+have+' coin.')) return;
    coinState.coins = have - need;
    if(!coinState.unlocked.includes(it.themeId)) coinState.unlocked.push(it.themeId);
    await saveCoinStateToPlayer();
    applyTheme(it.themeId, { force:true });
    refreshThemeLocks();
    renderShopList();
    setShopStatus('Đã mở '+(it.emoji||'')+' «'+it.name+'». Còn '+coinState.coins+' coin.', false);
    return;
  }

  if(have < need){
    setShopStatus('Không đủ coin — có '+have+', cần '+need+', thiếu '+missing+'.', true);
    showCoinPopup({
      warn:true,
      icon: '💸',
      title: 'Không đủ coin',
      html: '<div class="coin-popup-item">'+(it.emoji||'🎁')+' <b>'+it.name+'</b></div>'+
        '<ul class="coin-popup-list">'+
        '<li>Giá món: <b>'+need+'</b> coin</li>'+
        '<li>Bạn đang có: <b>'+have+'</b> coin</li>'+
        '<li>Còn thiếu: <b class="coin-miss">'+missing+'</b> coin</li>'+
        '</ul>'+
        '<div class="coin-popup-hint">Điểm danh mỗi ngày hoặc bán vật phẩm trong kho để có thêm coin.</div>'
    });
    return;
  }
  if(!confirm('Mua '+(it.emoji||'🎁')+' «'+it.name+'» với '+need+' coin?\nSố dư hiện tại: '+have+' → còn '+(have-need)+' coin.')) return;
  coinState.coins = have - need;
  if(!coinState.inventory) coinState.inventory = {};
  coinState.inventory[it.id] = (coinState.inventory[it.id]||0) + 1;
  await saveCoinStateToPlayer();
  refreshThemeLocks();
  renderShopList();
  try{ renderInventoryList(); }catch(e){}
  setShopStatus('Đã mua '+(it.emoji||'🎁')+' «'+it.name+'». Còn '+coinState.coins+' coin.', false);
  try{
    const ident = getCoinIdentity();
    await fb.db.ref('admin/shopLog').push({
      ts: Date.now(), playerId: ident && ident.id, code: (ident && ident.code)||'',
      itemId: it.id, name: it.name, price: need
    });
  }catch(e){}
}

/* ---- Mã hóa mã quà tặng ---- */
const GIFT_SECRET = 'CoTuongGift#2026!x';

function bytesToB64Url(str){
  try{
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }catch(e){
    return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
}
function b64UrlToBytes(s){
  s = String(s||'').replace(/-/g,'+').replace(/_/g,'/');
  while(s.length % 4) s += '=';
  try{ return decodeURIComponent(escape(atob(s))); }catch(e){ return atob(s); }
}
function xorCrypt(text, key){
  let out = '';
  for(let i=0;i<text.length;i++){
    out += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}
function encodeGiftToken(payload){
  const raw = JSON.stringify(payload);
  const x = xorCrypt(raw, GIFT_SECRET);
  return 'CT'+bytesToB64Url(x);
}
function decodeGiftToken(token){
  if(!token || !String(token).startsWith('CT')) return null;
  try{
    const x = b64UrlToBytes(String(token).slice(2));
    const raw = xorCrypt(x, GIFT_SECRET);
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function randomGiftNonce(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for(let i=0;i<10;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}
function randomGiftCode(){
  return randomGiftNonce();
}

async function createGiftCode(itemId){
  const it = SHOP_ITEMS[itemId];
  const ident = getCoinIdentity();
  if(!it || !ident){ setInvStatus('Cần đăng nhập để tạo mã quà.', true); return; }
  await loadCoinStateFromPlayer();
  if(!((coinState.inventory||{})[itemId] > 0)){ setInvStatus('Không còn món này trong kho.', true); return; }
  try{
    await tcEnsureFb();
    const nonce = randomGiftNonce();
    const token = encodeGiftToken({
      v:1, n: nonce, i: itemId, f: ident.id, t: Date.now()
    });
    const storeKey = 'n_'+nonce;
    coinState.inventory[itemId] -= 1;
    if(coinState.inventory[itemId] <= 0) delete coinState.inventory[itemId];
    await saveCoinStateToPlayer();
    await fb.db.ref('giftCodes/'+storeKey).set({
      itemId,
      name: it.name,
      emoji: it.emoji,
      fromId: ident.id,
      fromCode: ident.code || '',
      fromName: ident.name || '',
      createdAt: Date.now(),
      used: false,
      tokenHint: token.slice(0, 12)+'…'
    });
    renderInventoryList();
    try{ renderShopList(); }catch(e){}
    try{ await navigator.clipboard.writeText(token); }catch(e){}
    setInvStatus('Đã tạo mã mã hóa — đã copy clipboard.', false);
    alert('Mã quà đã mã hóa:\n\n'+token+'\n\n'+(it.emoji||'')+' '+it.name+'\n\nGửi toàn bộ chuỗi này cho người nhận.\nHọ dán vào Kho đồ → Nhận.');
  }catch(err){
    setInvStatus('Tạo mã thất bại: '+(err.message||err), true);
  }
}

async function redeemGiftCode(){
  const raw = (document.getElementById('giftRedeemCode')?.value||'').trim();
  const ident = getCoinIdentity();
  if(!ident){ setInvStatus('Đăng nhập để nhận quà.', true); return; }
  if(!raw){ setInvStatus('Dán mã quà đã mã hóa.', true); return; }
  try{
    await tcEnsureFb();
    let data = null, ref = null, itemId = null;
    if(raw.startsWith('CT')){
      const payload = decodeGiftToken(raw);
      if(!payload || !payload.n || !payload.i){
        setInvStatus('Mã không hợp lệ hoặc bị hỏng.', true); return;
      }
      itemId = payload.i;
      ref = fb.db.ref('giftCodes/n_'+payload.n);
      const snap = await ref.once('value');
      data = snap.val();
      if(!data){ setInvStatus('Mã không tồn tại trên hệ thống.', true); return; }
      if(data.itemId && data.itemId !== itemId){
        setInvStatus('Mã không khớp dữ liệu server.', true); return;
      }
    } else {
      const code = raw.toUpperCase();
      ref = fb.db.ref('giftCodes/'+code);
      const snap = await ref.once('value');
      data = snap.val();
      if(!data){ setInvStatus('Mã không tồn tại.', true); return; }
      itemId = data.itemId;
    }
    if(data.used){ setInvStatus('Mã đã được sử dụng.', true); return; }
    if(data.fromId && data.fromId === ident.id){ setInvStatus('Không thể tự nhận mã của chính mình.', true); return; }
    if(!itemId || !SHOP_ITEMS[itemId]){ setInvStatus('Vật phẩm không còn hợp lệ.', true); return; }
    await loadCoinStateFromPlayer();
    if(!coinState.inventory) coinState.inventory = {};
    coinState.inventory[itemId] = (coinState.inventory[itemId]||0) + 1;
    await saveCoinStateToPlayer();
    await ref.update({ used:true, usedBy: ident.id, usedCode: ident.code||'', usedAt: Date.now() });
    const em = data.emoji || SHOP_ITEMS[itemId].emoji || '🎁';
    document.getElementById('giftRedeemCode').value = '';
    renderInventoryList();
    try{ renderShopList(); }catch(e){}
    setInvStatus('Đã nhận '+em+' «'+(data.name||SHOP_ITEMS[itemId].name)+'» vào kho!', false);
  }catch(err){
    setInvStatus('Nhận quà thất bại: '+(err.message||err), true);
  }
}

async function sellInventoryItem(itemId){
  const it = SHOP_ITEMS[itemId];
  const ident = getCoinIdentity();
  if(!it || !ident){ setInvStatus('Cần đăng nhập để bán.', true); return; }
  const sellPrice = Math.floor((it.price||0) * 0.6);
  if(sellPrice < 1){ setInvStatus('Món này không bán được.', true); return; }
  if(!confirm('Bán '+it.emoji+' «'+it.name+'» lấy '+sellPrice+' coin?\n(Mất 40% so với giá mua '+it.price+')')) return;
  await loadCoinStateFromPlayer();
  if(!((coinState.inventory||{})[itemId] > 0)){ setInvStatus('Không còn món này.', true); return; }
  coinState.inventory[itemId] -= 1;
  if(coinState.inventory[itemId] <= 0) delete coinState.inventory[itemId];
  coinState.coins = Math.max(0, +(coinState.coins||0)) + sellPrice;
  await saveCoinStateToPlayer();
  refreshThemeLocks();
  renderInventoryList();
  try{ renderShopList(); }catch(e){}
  setInvStatus('Đã bán '+it.emoji+' «'+it.name+'» · +'+sellPrice+' coin · Số dư: '+coinState.coins, false);
}

/* ---- Đấu giá ---- */
async function listItemForAuction(itemId){
  const it = SHOP_ITEMS[itemId];
  const ident = getCoinIdentity();
  if(!it || !ident){ setInvStatus('Cần đăng nhập.', true); return; }
  const minStart = Math.max(1, Math.floor((it.price||10) * 0.5));
  const startStr = prompt('Giá khởi điểm (coin), tối thiểu '+minStart+':', String(minStart));
  if(startStr == null) return;
  const startPrice = Math.floor(+startStr);
  if(!startPrice || startPrice < minStart){ setInvStatus('Giá khởi điểm không hợp lệ.', true); return; }
  const hoursStr = prompt('Thời gian đấu giá (giờ): 1 / 6 / 12 / 24', '6');
  if(hoursStr == null) return;
  let hours = Math.floor(+hoursStr);
  if(![1,6,12,24].includes(hours)) hours = 6;
  await loadCoinStateFromPlayer();
  if(!((coinState.inventory||{})[itemId] > 0)){ setInvStatus('Không còn món này.', true); return; }
  try{
    await tcEnsureFb();
    coinState.inventory[itemId] -= 1;
    if(coinState.inventory[itemId] <= 0) delete coinState.inventory[itemId];
    await saveCoinStateToPlayer();
    const id = 'A'+Date.now().toString(36).toUpperCase()+randomGiftNonce().slice(0,4);
    const endsAt = Date.now() + hours * 3600 * 1000;
    await fb.db.ref('auctions/'+id).set({
      id,
      itemId,
      name: it.name,
      emoji: it.emoji,
      shopPrice: it.price,
      sellerId: ident.id,
      sellerCode: ident.code || '',
      sellerName: ident.name || '',
      startPrice,
      currentBid: startPrice,
      currentBidderId: null,
      currentBidderCode: null,
      bids: 0,
      createdAt: Date.now(),
      endsAt,
      status: 'open'
    });
    renderInventoryList();
    try{ renderShopList(); }catch(e){}
    setInvStatus('Đã đưa '+it.emoji+' lên đấu giá · bắt đầu '+startPrice+' coin · '+hours+'h.', false);
  }catch(err){
    setInvStatus('Đăng đấu giá thất bại: '+(err.message||err), true);
  }
}

async function settleAuctionIfNeeded(a){
  if(!a || a.status !== 'open') return a;
  if(Date.now() < (a.endsAt||0)) return a;
  try{
    await tcEnsureFb();
    if(a.currentBidderId){
      const wSnap = await fb.db.ref('players/'+a.currentBidderId).once('value');
      let path = 'players/'+a.currentBidderId;
      let w = wSnap.val();
      if(!w){
        const aw = await fb.db.ref('admin/wallets/'+a.currentBidderId).once('value');
        if(aw.val()){ path = 'admin/wallets/'+a.currentBidderId; w = aw.val(); }
      }
      if(w){
        const inv = (w.inventory && typeof w.inventory==='object') ? {...w.inventory} : {};
        inv[a.itemId] = (inv[a.itemId]||0) + 1;
        await fb.db.ref(path).update({ inventory: inv });
      }
      const pay = Math.floor(a.currentBid || a.startPrice || 0);
      let sp = 'players/'+a.sellerId;
      let sSnap = await fb.db.ref(sp).once('value');
      let s = sSnap.val();
      if(!s){
        sp = 'admin/wallets/'+a.sellerId;
        sSnap = await fb.db.ref(sp).once('value');
        s = sSnap.val() || {};
      }
      const coins = Math.max(0, +(s.coins||0) + pay);
      await fb.db.ref(sp).update({ coins });
      await fb.db.ref('auctions/'+a.id).update({ status:'sold', settledAt: Date.now(), finalPrice: pay });
      a.status = 'sold';
    } else {
      let sp = 'players/'+a.sellerId;
      let sSnap = await fb.db.ref(sp).once('value');
      let s = sSnap.val();
      if(!s){
        sp = 'admin/wallets/'+a.sellerId;
        sSnap = await fb.db.ref(sp).once('value');
        s = sSnap.val() || {};
      }
      const inv = (s.inventory && typeof s.inventory==='object') ? {...s.inventory} : {};
      inv[a.itemId] = (inv[a.itemId]||0) + 1;
      await fb.db.ref(sp).update({ inventory: inv });
      await fb.db.ref('auctions/'+a.id).update({ status:'expired', settledAt: Date.now() });
      a.status = 'expired';
    }
  }catch(e){ console.warn('settleAuction', e); }
  return a;
}

async function placeBid(auctionId){
  const ident = getCoinIdentity();
  if(!ident){ setShopStatus('Đăng nhập để đấu giá.', true); return; }
  try{
    await tcEnsureFb();
    const ref = fb.db.ref('auctions/'+auctionId);
    const snap = await ref.once('value');
    let a = snap.val();
    if(!a){ setShopStatus('Phiên đấu giá không tồn tại.', true); return; }
    a = await settleAuctionIfNeeded(a);
    if(a.status !== 'open'){ setShopStatus('Phiên đã kết thúc.', true); renderShopList(); return; }
    if(a.sellerId === ident.id){ setShopStatus('Không thể tự trả giá món của mình.', true); return; }
    const minBid = Math.floor((a.currentBid||a.startPrice||0) + 1);
    const bidStr = prompt('Trả giá (tối thiểu '+minBid+' coin):', String(minBid));
    if(bidStr == null) return;
    const bid = Math.floor(+bidStr);
    if(!bid || bid < minBid){ setShopStatus('Giá trả không hợp lệ.', true); return; }
    await loadCoinStateFromPlayer();
    if(coinState.coins < bid){ const miss=bid-coinState.coins; setShopStatus('Không đủ coin — có '+coinState.coins+', cần '+bid+', thiếu '+miss+'.', true); showCoinPopup({warn:true,icon:'💸',title:'Không đủ coin để trả giá',html:'<ul class="coin-popup-list"><li>Cần: <b>'+bid+'</b> coin</li><li>Bạn có: <b>'+coinState.coins+'</b> coin</li><li>Còn thiếu: <b class="coin-miss">'+miss+'</b> coin</li></ul>'}); return; }
    if(a.currentBidderId && a.currentBid){
      const prev = a.currentBidderId;
      let pp = 'players/'+prev;
      let ps = await fb.db.ref(pp).once('value');
      let pv = ps.val();
      if(!pv){
        pp = 'admin/wallets/'+prev;
        ps = await fb.db.ref(pp).once('value');
        pv = ps.val() || {};
      }
      await fb.db.ref(pp).update({ coins: Math.max(0, +(pv.coins||0) + Math.floor(a.currentBid)) });
    }
    coinState.coins -= bid;
    await saveCoinStateToPlayer();
    await ref.update({
      currentBid: bid,
      currentBidderId: ident.id,
      currentBidderCode: ident.code || '',
      currentBidderName: ident.name || '',
      bids: (a.bids||0) + 1,
      lastBidAt: Date.now()
    });
    setShopStatus('Đã trả '+bid+' coin cho '+(a.emoji||'')+' «'+a.name+'».', false);
    renderShopList();
  }catch(err){
    setShopStatus('Trả giá thất bại: '+(err.message||err), true);
  }
}

async function renderAuctionList(box){
  box.innerHTML = '<div class="admin-empty">Đang tải đấu giá…</div>';
  try{
    await tcEnsureFb();
    const snap = await fb.db.ref('auctions').once('value');
    const all = snap.val() || {};
    let list = Object.values(all);
    for(let i=0;i<list.length;i++){
      if(list[i].status==='open') list[i] = await settleAuctionIfNeeded(list[i]);
    }
    list = list.filter(a => a && a.status === 'open').sort((a,b)=> (a.endsAt||0)-(b.endsAt||0));
    box.innerHTML = '';
    const pager = document.createElement('div');
    pager.className = 'shop-pager';
    pager.innerHTML = '<span class="shop-page-info">'+list.length+' phiên đang diễn ra</span>'+
      '<button type="button" class="action-btn" id="auctionRefreshBtn"><i class="fa-regular fa-arrows-rotate"></i> Làm mới</button>';
    box.appendChild(pager);
    pager.querySelector('#auctionRefreshBtn').addEventListener('click', ()=> renderShopList());
    if(!list.length){
      const empty = document.createElement('div');
      empty.className = 'admin-empty';
      empty.textContent = 'Chưa có phiên đấu giá. Vào Kho đồ → Đấu giá để đăng bán.';
      box.appendChild(empty);
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'shop-grid';
    list.forEach(a=>{
      const leftMs = Math.max(0, (a.endsAt||0) - Date.now());
      const leftH = Math.floor(leftMs/3600000);
      const leftM = Math.floor((leftMs%3600000)/60000);
      const card = document.createElement('div');
      card.className = 'gift-card auction-card';
      card.innerHTML =
        '<div class="gift-emoji">'+(a.emoji||'🎁')+'</div>'+
        '<div class="gift-name">'+(a.name||'')+'</div>'+
        '<div class="gift-desc">Shop: '+(a.shopPrice||'?')+' · Từ '+(a.sellerCode||a.sellerName||'?')+'</div>'+
        '<div class="gift-price">Hiện tại: <b>'+(a.currentBid||a.startPrice)+'</b> coin</div>'+
        '<div class="gift-desc">Còn '+leftH+'h '+leftM+'p · '+(a.bids||0)+' lượt</div>'+
        '<button type="button" class="action-btn gift-buy">Trả giá</button>';
      card.querySelector('.gift-buy').addEventListener('click', ()=> placeBid(a.id));
      grid.appendChild(card);
    });
    box.appendChild(grid);
  }catch(err){
    box.innerHTML = '<div class="admin-empty">Lỗi tải đấu giá: '+(err.message||err)+'<br><span style="opacity:.8">Nếu permission_denied: cập nhật Rules (file firebase-rules.json) trong Firebase Console → Realtime Database → Rules.</span></div>';
  }
}

async function sendGiftToPlayer(){ /* deprecated: dùng createGiftCode */ }

async function toggleShopItem(){ /* removed */ }

async function toggleShopItem(){ /* removed */ }

function decorateThemeSwatches(){
  document.querySelectorAll('.theme-swatch[data-theme]').forEach(btn=>{
    const tid = btn.dataset.theme;
    const code = THEME_FLAGS && THEME_FLAGS[tid];
    const club = THEME_CLUBS && THEME_CLUBS[tid];
    if(code){
      btn.classList.add('theme-swatch-has-flag');
      if(!btn.querySelector('.fi')){
        const span = document.createElement('span');
        span.className = 'fi fi-'+code+' fis theme-swatch-flag';
        btn.appendChild(span);
      }
      return;
    }
    if(club){
      btn.classList.add('theme-swatch-has-flag', 'theme-swatch-club');
      if(!btn.querySelector('.theme-swatch-club-logo')){
        const img = document.createElement('img');
        img.className = 'theme-swatch-club-logo';
        img.src = footyLogoUrl(club.slug, 'png');
        img.dataset.svg = footyLogoUrl(club.slug, 'svg');
        img.alt = club.name;
        img.loading = 'lazy';
        img.onerror = function(){
          if(this.dataset.svg && this.src !== this.dataset.svg) this.src = this.dataset.svg;
          else this.style.display = 'none';
        };
        btn.appendChild(img);
      }
    }
  });
}
function loadSavedTheme(){
  try{ decorateThemeSwatches(); }catch(e){}

  let saved = 'wood';
  try{ saved = localStorage.getItem(THEME_STORAGE_KEY) || 'wood'; }catch(err){}
  if(!isThemeUnlocked(saved)) saved = 'wood';
  applyTheme(saved, { force:true });
  refreshThemeLocks();
}

/* =========================================================
   RENDERING + UI STATE
   ========================================================= */

let GLYPHS = {};

let state = {
  board: emptyBoard(),
  turn: 'red',
  selected: null,
  legalTargets: [],
  history: [],       // {from,to,captured,boardBefore}
  mode: 'pvp',        // pvp | pve
  aiLevel: 5,         // 1 (weakest) .. 10 (strongest)
  humanColor: 'red',
  gameOver: false,
  lastMove: null,
  aiThinking: false,
  aiTimeoutId: null,
  online: { active:false, room:null, color:null, pollTimer:null, version:0, transport:null, roomCode:null, spectator:false },
  cheat: { killMode:false },
  currentSave: null, // save code (string) once a save is made or loaded, else null
  soundOn: true,
  commentVoice: false,
  voicePreset: 'bac_nu',  // bac_nam | bac_nu | nam_nam | nam_nu
  voiceRate: 1.05,
  voicePitch: 1.15,
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
  bg.setAttribute('id','boardBgRect');
  svg.appendChild(bg);

  const flagLayer = document.createElementNS(ns,'g');
  flagLayer.setAttribute('id','boardFlagLayer');
  svg.appendChild(flagLayer);

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
  const quiet = !!state._quietRender; // full-sync: không pop-in hàng loạt (tránh nháy)

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
      if(quiet){
        void group.getBoundingClientRect();
        requestAnimationFrame(()=>{ group.style.transition = ''; });
      } else {
        group.classList.add('piece-enter');
        void group.getBoundingClientRect();
        requestAnimationFrame(()=>{
          group.style.transition = '';
          group.classList.remove('piece-enter');
        });
      }
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

/* ---------------- Interaction ---------------- */

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

  commentOnMove(state.history[state.history.length-1]);

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

function setFriendStatus(msg, warn){
  const el = document.getElementById('friendStatus');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'online-status' + (warn ? ' warn' : msg ? ' live' : '');
}
async function loadFriendsUI(){
  const list = document.getElementById('friendList');
  const reqBox = document.getElementById('friendReqList');
  const betBox = document.getElementById('betChallengeList');
  if(!playerSession || !playerSession.id){
    if(list) list.innerHTML = '<div class="admin-empty">Đăng nhập kỳ thủ để dùng bạn bè.</div>';
    if(reqBox) reqBox.innerHTML = '<div class="admin-empty">—</div>';
    if(betBox) betBox.innerHTML = '<div class="admin-empty">—</div>';
    return;
  }
  try{
    await tcEnsureFb();
    const myId = playerSession.id;
    const pSnap = await fb.db.ref('players/'+myId).once('value');
    const me = pSnap.val() || {};
    const friends = me.friends && typeof me.friends==='object' ? me.friends : {};
    const allSnap = await fb.db.ref('players').once('value');
    const all = allSnap.val() || {};
    if(list){
      const ids = Object.keys(friends).filter(id => friends[id]);
      if(!ids.length) list.innerHTML = '<div class="admin-empty">Chưa có bạn.</div>';
      else {
        list.innerHTML = '';
        ids.forEach(fid=>{
          const f = all[fid] || {};
          const div = document.createElement('div');
          div.className = 'admin-item';
          div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+(f.code||fid)+'</div><div class="admin-item-meta">'+(f.name||'')+'</div></div>';
          const btn = document.createElement('button');
          btn.className = 'action-btn';
          btn.textContent = 'Hủy';
          btn.addEventListener('click', ()=> removeFriend(fid));
          div.appendChild(btn);
          list.appendChild(div);
        });
      }
    }
    if(reqBox){
      const reqSnap = await fb.db.ref('friendRequests/'+myId).once('value');
      const reqs = reqSnap.val() || {};
      const keys = Object.keys(reqs);
      if(!keys.length) reqBox.innerHTML = '<div class="admin-empty">Không có.</div>';
      else {
        reqBox.innerHTML = '';
        keys.forEach(fromId=>{
          const r = reqs[fromId] || {};
          const div = document.createElement('div');
          div.className = 'admin-item';
          div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+(r.fromCode||fromId)+'</div><div class="admin-item-meta">'+(r.fromName||'')+'</div></div>';
          const ok = document.createElement('button'); ok.className='action-btn'; ok.textContent='Chấp nhận';
          ok.addEventListener('click', ()=> acceptFriend(fromId, r));
          const no = document.createElement('button'); no.className='action-btn'; no.textContent='Xóa';
          no.addEventListener('click', async ()=>{ await fb.db.ref('friendRequests/'+myId+'/'+fromId).remove(); loadFriendsUI(); });
          div.appendChild(ok); div.appendChild(no); reqBox.appendChild(div);
        });
      }
    }
    if(betBox){
      const cSnap = await fb.db.ref('betChallenges').once('value');
      const allC = cSnap.val() || {};
      const open = Object.values(allC).filter(c => c && c.status==='pending' && c.toId===myId);
      if(!open.length) betBox.innerHTML = '<div class="admin-empty">Không có.</div>';
      else {
        betBox.innerHTML = '';
        open.forEach(c=>{
          const div = document.createElement('div');
          div.className = 'admin-item';
          div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+(c.fromCode||'')+' cược '+c.stake+' coin</div><div class="admin-item-meta">Phòng: '+(c.roomCode||'—')+'</div></div>';
          const ok = document.createElement('button'); ok.className='action-btn'; ok.textContent='Chấp nhận';
          ok.addEventListener('click', ()=> acceptBetChallenge(c));
          const no = document.createElement('button'); no.className='action-btn'; no.textContent='Từ chối';
          no.addEventListener('click', async ()=>{ await fb.db.ref('betChallenges/'+c.id).update({ status:'declined' }); loadFriendsUI(); });
          div.appendChild(ok); div.appendChild(no); betBox.appendChild(div);
        });
      }
    }
  }catch(err){ setFriendStatus('Lỗi tải bạn bè: '+(err.message||err), true); }
}
async function sendFriendRequest(){
  if(!playerSession || !playerSession.id){ setFriendStatus('Đăng nhập kỳ thủ trước.', true); return; }
  const code = (document.getElementById('friendAddCode')?.value||'').trim().toUpperCase();
  if(!code){ setFriendStatus('Nhập mã kỳ thủ.', true); return; }
  if(code === (playerSession.code||'').toUpperCase()){ setFriendStatus('Không thể tự kết bạn.', true); return; }
  try{
    await tcEnsureFb();
    const snap = await fb.db.ref('players').once('value');
    const all = snap.val() || {};
    const target = Object.values(all).find(p => (p.code||'').toUpperCase()===code);
    if(!target){ setFriendStatus('Không tìm thấy kỳ thủ «'+code+'».', true); return; }
    const me = (await fb.db.ref('players/'+playerSession.id).once('value')).val() || {};
    if(me.friends && me.friends[target.id]){ setFriendStatus('Đã là bạn rồi.', true); return; }
    // Mọi role đều kết bạn được (player, vip, mod, caster, admin, superadmin)
    await fb.db.ref('friendRequests/'+target.id+'/'+playerSession.id).set({
      fromId: playerSession.id, fromCode: playerSession.code || '', fromName: playerSession.name || '', ts: Date.now()
    });
    setFriendStatus('Đã gửi lời mời tới '+code+'.', false);
    document.getElementById('friendAddCode').value = '';
  }catch(err){ setFriendStatus('Lỗi: '+(err.message||err), true); }
}
async function acceptFriend(fromId, r){
  if(!playerSession) return;
  try{
    await tcEnsureFb();
    const myId = playerSession.id;
    await fb.db.ref('players/'+myId+'/friends/'+fromId).set(true);
    await fb.db.ref('players/'+fromId+'/friends/'+myId).set(true);
    await fb.db.ref('friendRequests/'+myId+'/'+fromId).remove();
    setFriendStatus('Đã kết bạn với '+(r.fromCode||fromId)+'.', false);
    loadFriendsUI();
  }catch(err){ setFriendStatus('Lỗi: '+(err.message||err), true); }
}
async function removeFriend(fid){
  if(!playerSession) return;
  if(!confirm('Hủy kết bạn?')) return;
  try{
    await tcEnsureFb();
    await fb.db.ref('players/'+playerSession.id+'/friends/'+fid).remove();
    await fb.db.ref('players/'+fid+'/friends/'+playerSession.id).remove();
    loadFriendsUI();
  }catch(err){ setFriendStatus('Lỗi: '+(err.message||err), true); }
}
async function createOnlineRoomCodeIfNeeded(){
  if(state.online && state.online.active && state.online.roomCode) return state.online.roomCode;
  if(typeof fbCreateRoom === 'function'){
    await fbCreateRoom();
    if(state.online && state.online.roomCode) return state.online.roomCode;
  }
  await tcEnsureFb();
  await fbEnsureAuth();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for(let i=0;i<5;i++) code += chars[Math.floor(Math.random()*chars.length)];
  let boardJSON = '[]';
  try{ if(typeof boardToJSON === 'function') boardJSON = boardToJSON(state.board); }catch(e){}
  await fb.db.ref('rooms/'+code).set({ boardJSON, turn:'red', createdAt: Date.now(), version:1, betPending:true });
  if(typeof fbJoinRoom === 'function') await fbJoinRoom(code);
  return (state.online && state.online.roomCode) || code;
}
async function sendBetChallenge(){
  if(!playerSession || !playerSession.id){ setFriendStatus('Đăng nhập kỳ thủ trước.', true); return; }
  const code = (document.getElementById('betFriendCode')?.value||'').trim().toUpperCase();
  const stake = Math.floor(+(document.getElementById('betStakeInput')?.value||0));
  if(!code){ setFriendStatus('Nhập mã bạn bè.', true); return; }
  if(!stake || stake<1){ setFriendStatus('Số coin cược không hợp lệ.', true); return; }
  try{
    await tcEnsureFb();
    await loadCoinStateFromPlayer();
    if(coinState.coins < stake){
      setFriendStatus('Không đủ coin (có '+coinState.coins+', cần '+stake+').', true);
      showCoinPopup({warn:true,icon:'💸',title:'Không đủ coin để cược',html:'<ul class="coin-popup-list"><li>Cược: <b>'+stake+'</b></li><li>Bạn có: <b>'+coinState.coins+'</b></li><li>Thiếu: <b class="coin-miss">'+(stake-coinState.coins)+'</b></li></ul>'});
      return;
    }
    const snap = await fb.db.ref('players').once('value');
    const all = snap.val() || {};
    const target = Object.values(all).find(p => (p.code||'').toUpperCase()===code);
    if(!target){ setFriendStatus('Không tìm thấy «'+code+'».', true); return; }
    const me = (await fb.db.ref('players/'+playerSession.id).once('value')).val() || {};
    if(!(me.friends && me.friends[target.id])){
      setFriendStatus('Cần kết bạn trước khi cược. Mọi vai trò (player/VIP/mod/admin…) đều kết bạn & cược được.', true);
      return;
    }
    coinState.coins -= stake;
    await saveCoinStateToPlayer();
    const roomCode = await createOnlineRoomCodeIfNeeded();
    const id = 'B'+Date.now().toString(36).toUpperCase();
    await fb.db.ref('betChallenges/'+id).set({
      id, fromId: playerSession.id, fromCode: playerSession.code||'', fromName: playerSession.name||'',
      toId: target.id, toCode: target.code||'', stake, roomCode, status:'pending', createdAt: Date.now()
    });
    await fb.db.ref('rooms/'+roomCode+'/bet').set({
      challengeId: id, stake, players: { [playerSession.id]: true }, locked: stake, status: 'waiting'
    });
    setFriendStatus('Đã thách '+code+' cược '+stake+' coin · phòng '+roomCode+'.', false);
    showCoinPopup({icon:'🎲', title:'Đã gửi thách cược', html:'<ul class="coin-popup-list"><li>Bạn: <b>'+code+'</b></li><li>Cược: <b>'+stake+'</b> coin (đã khóa)</li><li>Phòng: <b>'+roomCode+'</b></li></ul>'});
  }catch(err){ setFriendStatus('Lỗi: '+(err.message||err), true); }
}
async function acceptBetChallenge(c){
  if(!playerSession || !c) return;
  try{
    await tcEnsureFb();
    await loadCoinStateFromPlayer();
    const stake = Math.floor(c.stake||0);
    if(coinState.coins < stake){ setFriendStatus('Không đủ coin để nhận cược ('+stake+').', true); return; }
    coinState.coins -= stake;
    await saveCoinStateToPlayer();
    await fb.db.ref('betChallenges/'+c.id).update({ status:'accepted', acceptedAt: Date.now() });
    await fb.db.ref('rooms/'+c.roomCode+'/bet').update({
      status: 'active', ['players/'+playerSession.id]: true, totalPot: stake * 2
    });
    setFriendStatus('Đã nhận cược '+stake+' coin · vào phòng '+c.roomCode, false);
    const input = document.getElementById('fbRoomCodeInput');
    if(input) input.value = c.roomCode;
    document.getElementById('fbJoinRoomBtn')?.click();
  }catch(err){ setFriendStatus('Lỗi: '+(err.message||err), true); }
}
async function settleOnlineBet(winnerColor){
  if(!state.online.active || !fb.roomRef) return;
  try{
    await tcEnsureFb();
    const roomCode = state.online.roomCode;
    const betSnap = await fb.db.ref('rooms/'+roomCode+'/bet').once('value');
    const bet = betSnap.val();
    if(!bet || bet.status !== 'active' || bet.settled) return;
    const stake = Math.floor(bet.stake||0);
    const pot = Math.floor(bet.totalPot || stake*2);
    const seatsSnap = await fb.db.ref('rooms/'+roomCode+'/seats').once('value');
    const seats = seatsSnap.val() || {};
    let winnerId = null;
    if(winnerColor === 'red' && seats.red) winnerId = seats.red.playerId || seats.red.uid || seats.red.id;
    if(winnerColor === 'black' && seats.black) winnerId = seats.black.playerId || seats.black.uid || seats.black.id;
    if(!winnerColor){
      const ids = Object.keys(bet.players||{});
      for(const id of ids){
        const p = (await fb.db.ref('players/'+id).once('value')).val() || {};
        await fb.db.ref('players/'+id).update({ coins: Math.max(0, +(p.coins||0) + stake) });
      }
      await fb.db.ref('rooms/'+roomCode+'/bet').update({ status:'draw_refund', settled:true, settledAt:Date.now() });
      setFriendStatus('Cược hòa — hoàn '+stake+' coin mỗi bên.', false);
      await loadCoinStateFromPlayer();
      return;
    }
    if(winnerId){
      const w = (await fb.db.ref('players/'+winnerId).once('value')).val() || {};
      await fb.db.ref('players/'+winnerId).update({ coins: Math.max(0, +(w.coins||0) + pot) });
      await fb.db.ref('rooms/'+roomCode+'/bet').update({ status:'settled', settled:true, winnerId, settledAt:Date.now() });
      if(playerSession && playerSession.id === winnerId){
        showCoinPopup({icon:'🏆', title:'Thắng cược!', html:'<ul class="coin-popup-list"><li>Nhận: <b>'+pot+'</b> coin</li></ul>'});
      } else {
        showCoinPopup({warn:true, icon:'💨', title:'Thua cược', html:'<ul class="coin-popup-list"><li>Mất tiền cược đã khóa.</li></ul>'});
      }
      await loadCoinStateFromPlayer();
    }
  }catch(e){ console.warn('settleOnlineBet', e); }
}

function checkGameEnd(){
  const moves = allLegalMoves(state.board, state.turn);
  const inCheck = isInCheck(state.board, state.turn);
  if(moves.length===0 && !state.gameOver){
    state.gameOver = true;
    let resultWinner = null;
    if(inCheck){
      const winner = state.turn==='red' ? 'black' : 'red';
      resultWinner = winner;
      showGameOver(
        winner==='red' ? 'Đỏ Thắng!' : 'Đen Thắng!',
        `Chiếu bí — ${winner==='red'?'Đỏ':'Đen'} đã hạ tướng đối phương.`
      );
      sfxGameResult(winner, false);
      commentOnGameEnd(winner, false);
      fireConfetti();
    } else {
      showGameOver('Hòa Cờ', 'Bên đi không còn nước hợp lệ — ván cờ kết thúc hòa.');
      sfxGameResult(null, true);
      commentOnGameEnd(null, true);
    }
    deleteFinishedSave();
    clearOnlineChatIfActive();
    syncTournamentResult(resultWinner);
    try{ settleOnlineBet(resultWinner); }catch(e){}
  }
}

/** Đồng bộ kết quả ván online → rooms + matches (BXH RR / DE). */
async function syncTournamentResult(winnerColor){
  if(!state.online.active || !fb.roomRef) return;
  const roomCode = state.online.roomCode;
  const payload = {
    gameOver: true,
    result: winnerColor ? (winnerColor + '_win') : 'draw',
    finishedAt: Date.now()
  };
  try{ await fb.roomRef.update(payload); }catch(e){ console.warn('room result', e); }
  try{
    if(!fbAvailable()) return;
    await fbEnsureAuth();
    let match = null;
    if(tcData && tcData.matches){
      match = Object.values(tcData.matches).find(m => m.roomCode === roomCode && m.status !== 'finished');
    }
    if(!match){
      const snap = await fb.db.ref('matches').once('value');
      const all = snap.val() || {};
      match = Object.values(all).find(m => m.roomCode === roomCode && m.status !== 'finished');
      if(match && tcData){ tcData.matches = tcData.matches || {}; tcData.matches[match.id] = match; }
    }
    if(!match) return;
    const winnerPlayerId = winnerColor === 'red' ? match.red
      : winnerColor === 'black' ? match.black : null;
    const patch = {
      status: 'finished',
      winner: winnerPlayerId,
      result: payload.result,
      finishedAt: Date.now()
    };
    await fb.db.ref('matches/'+match.id).update(patch);
    if(tcData && tcData.matches[match.id]) Object.assign(tcData.matches[match.id], patch);

    if(match.kind === 'de_w' && winnerPlayerId && match.nextLoser){
      const loserId = winnerPlayerId === match.red ? match.black : match.red;
      const loserName = winnerPlayerId === match.red ? match.blackName : match.redName;
      const lSnap = await fb.db.ref('matches/'+match.nextLoser).once('value');
      const lMatch = lSnap.val();
      if(lMatch){
        const lPatch = {};
        if(!lMatch.red){ lPatch.red = loserId; lPatch.redName = loserName || 'TBD'; }
        else if(!lMatch.black){ lPatch.black = loserId; lPatch.blackName = loserName || 'TBD'; }
        if(Object.keys(lPatch).length){
          await fb.db.ref('matches/'+match.nextLoser).update(lPatch);
          if(tcData && tcData.matches[match.nextLoser]) Object.assign(tcData.matches[match.nextLoser], lPatch);
        }
      }
    }
  }catch(e){ console.warn('syncTournamentResult', e); }
}

function clearOnlineChatIfActive(){
  if(!state.online.active) return;
  clearChatUI();
  if(fb.roomRef) fb.roomRef.child('chat').remove();
}

function showGameOver(title, text){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalText').textContent = text;
  document.getElementById('modalRematchBtn').style.display =
    (state.online.active && !state.online.spectator) ? '' : 'none';
  document.getElementById('modalOverlay').classList.add('show');
}

/* ---------------- Cheat Mode (vs AI only) ---------------- */

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
  state.history.push({
    kind: 'remove',
    from: {r,c}, to: {r,c},
    piece: { type: target.type, color: target.color },
    captured: { type: target.type, color: target.color }
  });
  addHistoryEntry(state.history[state.history.length-1]);
  addCapturedChip(target);
  renderPieces();
  renderMarkers();
  sfxCapture();

  if(wasGeneral){
    finishWithCheatWin();
    return;
  }
  updateStatus();
  updateUndoBtn();
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
        const piece = {type:'chariot', color:'red'};
        state.board[r][c] = piece;
        state.lastMove = {from:{r,c}, to:{r,c}};
        state.history.push({
          kind: 'spawn',
          from: {r,c}, to: {r,c},
          piece: { type: piece.type, color: piece.color },
          captured: null
        });
        addHistoryEntry(state.history[state.history.length-1]);
        renderPieces();
        renderMarkers();
        updateUndoBtn();
        return;
      }
    }
  }
}

/* ---------------- Save / Load via Firebase Realtime Database ----------------
   Reuses the same config.json "firebase" block as online play — no extra
   setup needed. Each save gets a short code and its own path
   (saves/{code}), and gets auto-deleted once that match finishes. */

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
    flashStatus('Chưa cấu hình Firebase trong config.json — xem hướng dẫn ở README.', true, 'saveStatus');
    return;
  }
  const code = generateSaveCode();
  const content = JSON.stringify(serializeGame());
  try{
    await fbEnsureAuth();
    await fb.db.ref('saves/'+code).set({ content, savedAt: Date.now() });
    document.getElementById('saveCodeInput').value = code;
    state.currentSave = code;
    flashStatus(`🔥 Đã lưu! Mã ván đấu: ${code} — ghi lại để tải lại sau.`, false, 'saveStatus');
  }catch(err){
    flashStatus('Lưu thất bại — kiểm tra cấu hình Firebase/luật bảo mật.', true, 'saveStatus');
  }
}

async function loadGame(){
  if(!fbAvailable()){
    flashStatus('Chưa cấu hình Firebase trong config.json — xem hướng dẫn ở README.', true, 'saveStatus');
    return;
  }
  const code = document.getElementById('saveCodeInput').value.trim().toUpperCase();
  if(!code){
    flashStatus('Nhập mã ván đấu trước đã.', true, 'saveStatus');
    return;
  }
  try{
    await fbEnsureAuth();
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
    flashStatus(`✅ Đã tải ván đấu "${code}".`, false, 'saveStatus');
  }catch(err){
    flashStatus('Không tìm thấy ván đấu với mã này.', true, 'saveStatus');
  }
}

async function deleteFinishedSave(){
  const code = state.currentSave;
  if(!code) return;
  state.currentSave = null;
  try{
    await fbEnsureAuth();
    await fb.db.ref('saves/'+code).remove();
    flashStatus(`🗑️ Ván đã kết thúc — đã xoá file lưu "${code}".`, false, 'saveStatus');
  }catch(err){
    /* best-effort cleanup, no need to bother the user if this fails */
  }
}

function flashStatus(text, isWarn, targetId){
  const el = document.getElementById(targetId || 'onlineStatus');
  el.textContent = text;
  el.classList.toggle('warn', !!isWarn);
  el.classList.toggle('live', !isWarn);
  setTimeout(()=>{ if(el.textContent===text){ el.textContent=''; el.classList.remove('warn','live'); } }, 4000);
}

/* ---------------- Remote play: Firebase Realtime Database (real-time) ----------------
   Requires config.json's "firebase" block to be filled in with your own
   project's config (see README) — the buttons simply explain that if
   it's missing. */

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
    document.getElementById('roomCodeDisplay').textContent = 'Chỉ xem';
    const base = 'Đang xem trực tiếp — bạn không thể đi quân.';
    document.getElementById('onlineRoleLabel').textContent =
      state.online.roomCode ? `${base} · Mã phòng: ${state.online.roomCode}` : base;
    return;
  }

  document.getElementById('roomCodeDisplay').textContent = state.online.color==='red' ? 'Đỏ' : 'Đen';
  const base = state.turn===state.online.color
    ? 'Đến lượt bạn — cứ đi, đối thủ sẽ thấy ngay.'
    : 'Đang chờ đối thủ đi (thời gian thực).';
  document.getElementById('onlineRoleLabel').textContent =
    state.online.roomCode ? `${base} · Mã phòng: ${state.online.roomCode}` : base;
}

/* ---------------- Online: share room via link / QR code ---------------- */

function buildRoomShareUrl(code){
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
  return url.toString();
}

function openShareRoomModal(){
  if(!state.online.roomCode) return;

  document.getElementById('shareRoomCode').textContent = state.online.roomCode;

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

  document.getElementById('shareRoomModalOverlay').classList.add('show');
}

function closeShareRoomModal(){
  document.getElementById('shareRoomModalOverlay').classList.remove('show');
}

function copyShareLink(){
  const input = document.getElementById('shareLinkInput');
  input.select();
  navigator.clipboard?.writeText(input.value)
    .then(()=>flashStatus('📋 Đã sao chép link phòng.', false))
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
  return fbConfigured() && typeof firebase !== 'undefined' && typeof firebase.auth === 'function';
}

function setFbStatus(text, warn){
  const el = document.getElementById('fbStatus');
  if(!el) return;
  el.textContent = text;
  el.classList.toggle('warn', !!warn);
  el.classList.toggle('live', !warn);
}

/** Khởi tạo App + Auth + Database. Trả về Promise user Anonymous. */
function fbInit(){
  if(fb.app) return fb._authReady || Promise.resolve(fb.auth && fb.auth.currentUser);
  fb.app = firebase.initializeApp(CONFIG.firebase);
  fb.auth = firebase.auth();
  fb.db = firebase.database();
  fb._authReady = new Promise((resolve, reject)=>{
    const unsub = fb.auth.onAuthStateChanged(async (user)=>{
      try{
        if(user){
          unsub();
          fb.uid = user.uid;
          resolve(user);
          return;
        }
        const cred = await fb.auth.signInAnonymously();
        fb.uid = cred.user.uid;
        unsub();
        resolve(cred.user);
      }catch(err){
        unsub();
        reject(err);
      }
    });
  });
  return fb._authReady;
}

/** Đảm bảo đã Auth Anonymous trước khi đọc/ghi RTDB. */
async function fbEnsureAuth(){
  if(!fbAvailable()) throw new Error('Firebase Auth/SDK chưa sẵn sàng');
  const user = await fbInit();
  if(!user) throw new Error('Anonymous Auth thất bại — bật Anonymous trong Firebase Console');
  return user;
}

const ROOM_SESSION_KEY = 'co-tuong-room-session';
function saveRoomSession(code, color){
  try{ localStorage.setItem(ROOM_SESSION_KEY, JSON.stringify({code, color})); }catch(err){}
}
function clearRoomSession(){
  try{ localStorage.removeItem(ROOM_SESSION_KEY); }catch(err){}
}
function loadRoomSession(){
  try{
    const raw = localStorage.getItem(ROOM_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(err){ return null; }
}

async function fbAutoRejoin(){
  const session = loadRoomSession();
  if(!session || !fbAvailable()) return;
  try{ await fbEnsureAuth(); }catch(err){ return; }
  let snap;
  try{ snap = await fb.db.ref('rooms/'+session.code).once('value'); }catch(err){ return; }
  const data = snap.val();
  if(!data || fbRoomExpired(data)){ clearRoomSession(); return; }

  fb.room = session.code;
  fb.roomRef = fb.db.ref('rooms/'+session.code);
  startRemoteGame(session.color);
  state.online.roomCode = session.code;
  state.online.version = 0;
  fbListen();
  fbListenUndoRequest();
  fbListenChat();
  fbSetupPresence(session.color);
  fbApplyState(data);
  setFbStatus(`🔄 Đã tự động vào lại phòng ${session.code} (${session.color==='red'?'Đỏ':'Đen'}).`, false);
  showOnlineActive();
}

function fbCurrentUid(){
  try{
    if(fb.auth && fb.auth.currentUser) return fb.auth.currentUser.uid;
  }catch(e){}
  return 'local_'+Math.random().toString(36).slice(2,10);
}

/**
 * Chiếm ghế Đỏ/Đen bằng transaction Firebase — tránh 2 máy cùng nhận 1 màu.
 * preferred: 'red' | 'black' | null
 */
async function fbClaimSeat(roomRef, preferred){
  const uid = fbCurrentUid();
  const now = Date.now();

  for(const color of ['red','black']){
    try{
      const snap = await roomRef.child('seats/'+color).once('value');
      const val = snap.val();
      if(val && val.uid === uid){
        await roomRef.child('seats/'+color).update({ ts: now });
        return color;
      }
    }catch(e){}
  }

  const order = preferred === 'red' ? ['red','black']
    : preferred === 'black' ? ['black','red']
    : ['black','red']; // vào thường: ưu tiên Đen (chủ phòng đã là Đỏ)

  for(const color of order){
    const seatRef = roomRef.child('seats/'+color);
    try{
      const tx = await seatRef.transaction(current=>{
        const t = Date.now();
        if(current && current.uid && current.uid !== uid){
          if(current.ts && (t - current.ts) < ROOM_EMPTY_GRACE_MS) return;
        }
        const seat = { uid, ts: t };
        try{
          if(typeof playerSession !== 'undefined' && playerSession && playerSession.id){
            seat.playerId = playerSession.id;
            seat.code = playerSession.code || '';
            seat.name = playerSession.name || '';
          }
        }catch(e){}
        return seat;
      });
      if(tx.committed){
        const val = tx.snapshot.val();
        if(val && val.uid === uid) return color;
      }
    }catch(e){
      console.warn('claim seat', color, e);
    }
  }
  return null;
}

async function fbCreateRoom(){
  if(!fbAvailable()){
    setFbStatus('Chưa cấu hình Firebase trong config.json — xem hướng dẫn ở README.', true);
    return;
  }
  try{ await fbEnsureAuth(); }catch(err){ setFbStatus('Lỗi Firebase/Auth: '+(err.message||err)+' — bật Anonymous trong Console.', true); return; }
  fbSweepExpiredRooms();

  const code = randomRoomCode();
  const uid = fbCurrentUid();
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
    createdAt: Date.now(),
    seats: {
      red: { uid, ts: Date.now() }
    }
  };
  try{
    await fb.roomRef.set(payload);
  }catch(err){
    setFbStatus('Không tạo được phòng — kiểm tra config/luật bảo mật Firebase.', true);
    return;
  }
  fbListen();
  fbListenUndoRequest();
  fbListenChat();
  fbSetupPresence('red');
  saveRoomSession(code, 'red');
  setFbStatus(`🟢 Đã tạo phòng ${code} — bạn cầm quân Đỏ. Gửi mã cho đối thủ (họ sẽ cầm Đen). Phòng tự xoá 3 phút sau khi cả 2 cùng thoát.`, false);
  showOnlineActive();
  pushSystemChat('Phòng '+code+' đã mở · Chat realtime sẵn sàng (chơi 2 người).');
}

async function fbJoinRoom(){
  if(!fbAvailable()){
    setFbStatus('Chưa cấu hình Firebase trong config.json — xem hướng dẫn ở README.', true);
    return;
  }
  const code = document.getElementById('fbJoinCodeInput').value.trim().toUpperCase();
  if(!code){ setFbStatus('Nhập mã phòng trước đã.', true); return; }
  try{ await fbEnsureAuth(); }catch(err){ setFbStatus('Lỗi Firebase/Auth: '+(err.message||err)+' — bật Anonymous trong Console.', true); return; }

  const ref = fb.db.ref('rooms/'+code);
  let snap;
  try{
    snap = await ref.once('value');
  }catch(err){
    setFbStatus('Không đọc được phòng — kiểm tra mã hoặc luật bảo mật Firebase.', true);
    return;
  }
  const data = snap.val();
  if(!data){ setFbStatus('Không tìm thấy phòng này.', true); return; }
  if(fbRoomExpired(data)){ ref.remove(); setFbStatus('Phòng này đã trống quá 3 phút nên đã bị xoá.', true); return; }

  const pref = window._preferredJoinColor || null;
  window._preferredJoinColor = null;

  let preferred = pref; // 'red' | 'black' | null
  if(!preferred){
    const session = loadRoomSession();
    if(session && session.code === code && (session.color === 'red' || session.color === 'black')){
      preferred = session.color;
    }
  }

  const myColor = await fbClaimSeat(ref, preferred);
  if(!myColor){
    setFbStatus('Phòng đã đủ 2 người chơi. Bạn có thể vào chế độ Chỉ xem.', true);
    return;
  }

  fb.room = code;
  fb.roomRef = ref;
  startRemoteGame(myColor);
  state.online.roomCode = code;
  state.online.version = 0; // force-apply whatever the host currently has
  fbListen();
  fbListenUndoRequest();
  fbListenChat();
  fbSetupPresence(myColor);
  saveRoomSession(code, myColor);
  fbApplyState(data);
  markMatchPlayingByRoom(code);
  const colorName = myColor === 'red' ? 'Đỏ' : 'Đen';
  setFbStatus(`🟢 Đã vào phòng ${code} — bạn cầm quân ${colorName}. Chat realtime đã bật.`, false);
  showOnlineActive();
  pushSystemChat((playerSession && playerSession.name ? playerSession.name : colorName) + ' đã vào phòng.');
}

/** Cập nhật matches/{id}.status = playing theo mã phòng (Firebase + cache). */
async function markMatchPlayingByRoom(roomCode){
  if(!roomCode || !fbAvailable()) return;
  try{
    await fbEnsureAuth();
    let match = null;
    if(tcData && tcData.matches){
      match = Object.values(tcData.matches).find(x =>
        (x.roomCode||'').toUpperCase() === roomCode.toUpperCase() && x.status !== 'finished'
      );
    }
    if(!match){
      const snap = await fb.db.ref('matches').once('value');
      const all = snap.val() || {};
      if(tcData) tcData.matches = all;
      match = Object.values(all).find(x =>
        (x.roomCode||'').toUpperCase() === roomCode.toUpperCase() && x.status !== 'finished'
      );
    }
    if(!match) return;
    if(match.status === 'playing') return;
    await fb.db.ref('matches/'+match.id).update({ status: 'playing', startedAt: Date.now() });
    match.status = 'playing';
    if(tcData && tcData.matches) tcData.matches[match.id] = match;
  }catch(e){ console.warn('markMatchPlayingByRoom', e); }
}

async function fbJoinRoomPreferred(color){
  window._preferredJoinColor = color === 'red' ? 'red' : 'black';
  return fbJoinRoom();
}

async function fbSpectateRoom(){
  if(!fbAvailable()){
    setFbStatus('Chưa cấu hình Firebase trong config.json — xem hướng dẫn ở README.', true);
    return;
  }
  const code = document.getElementById('fbJoinCodeInput').value.trim().toUpperCase();
  if(!code){ setFbStatus('Nhập mã phòng trước đã.', true); return; }
  try{ await fbEnsureAuth(); }catch(err){ setFbStatus('Lỗi Firebase/Auth: '+(err.message||err)+' — bật Anonymous trong Console.', true); return; }

  const ref = fb.db.ref('rooms/'+code);
  let snap;
  try{
    snap = await ref.once('value');
  }catch(err){
    setFbStatus('Không đọc được phòng — kiểm tra mã hoặc luật bảo mật Firebase.', true);
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
  state.online.version = -1;
  fbListen();
  fbListenChat();
  fbApplyState(data);
  setFbStatus(`👁 Đang xem phòng ${code} · lượt ${data.turn==='black'?'Đen':'Đỏ'} · v${data.version||0}. Có thể chat.`, false);
  showOnlineActive();
}

const ROOM_EMPTY_GRACE_MS = 3 * 60 * 1000; // 3 phút không heartbeat = rời ghế
const ROOM_WAITING_MAX_MS = 6 * 60 * 60 * 1000; // phòng giải chờ tối đa 6 giờ chưa ai vào

function fbRoomExpired(data){
  if(!data) return false;
  const now = Date.now();
  const seen = data.lastSeen || {};
  const seats = data.seats || {};

  function lastBeat(color){
    const tSeen = typeof seen[color] === 'number' ? seen[color] : null;
    const seat = seats[color];
    const tSeat = seat && typeof seat === 'object' && typeof seat.ts === 'number' ? seat.ts : null;
    if(tSeen != null && tSeat != null) return Math.max(tSeen, tSeat);
    if(tSeen != null) return tSeen;
    if(tSeat != null) return tSeat;
    return null;
  }

  const redTs = lastBeat('red');
  const blackTs = lastBeat('black');

  if(redTs == null && blackTs == null){
    const created = typeof data.createdAt === 'number' ? data.createdAt : 0;
    if(!created) return false;
    return (now - created) > ROOM_WAITING_MAX_MS;
  }

  const redGone = redTs == null || (now - redTs) > ROOM_EMPTY_GRACE_MS;
  const blackGone = blackTs == null || (now - blackTs) > ROOM_EMPTY_GRACE_MS;
  return redGone && blackGone;
}

async function fbSweepExpiredRooms(){
  try{
    const snap = await fb.db.ref('rooms').once('value');
    const rooms = snap.val();
    if(!rooms) return;
    for(const code in rooms){
      if(fbRoomExpired(rooms[code])) fb.db.ref('rooms/'+code).remove();
    }
  }catch(err){ /* no list-read permission or offline — safe to ignore */ }
}

let fbHeartbeatTimer = null;

function fbSetupPresence(color){
  if(!fb.roomRef || !color) return;
  const uid = fbCurrentUid();
  const seenRef = fb.roomRef.child('lastSeen/'+color);
  const seatRef = fb.roomRef.child('seats/'+color);
  const beat = ()=>{
    const ts = Date.now();
    seenRef.set(ts);
    seatRef.update({ uid, ts });
  };
  beat();
  seenRef.onDisconnect().remove();
  seatRef.onDisconnect().remove();
  if(fbHeartbeatTimer) clearInterval(fbHeartbeatTimer);
  fbHeartbeatTimer = setInterval(()=>{
    if(fb.roomRef && state.online.color===color) beat();
    else clearInterval(fbHeartbeatTimer);
  }, 20000);
}

function fbStopHeartbeat(){
  if(fbHeartbeatTimer){ clearInterval(fbHeartbeatTimer); fbHeartbeatTimer = null; }
}

function fbListen(){
  if(!fb.roomRef) return;
  fb.roomRef.on('value', snap=>{
    const data = snap.val();
    if(data) fbApplyState(data);
  });
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

  const prevVer = state.online.version || 0;
  const sequential = prevVer > 0 && data.version === prevVer + 1;
  let movingPiece = null;
  if(sequential && lastMove && lastMove.from && state.board[lastMove.from.r]){
    movingPiece = state.board[lastMove.from.r][lastMove.from.c];
  }

  if(sequential && lastMove && movingPiece){
    const capturedPiece = state.board[lastMove.to.r][lastMove.to.c];
    state.board[lastMove.to.r][lastMove.to.c] = movingPiece;
    state.board[lastMove.from.r][lastMove.from.c] = null;
    if(capturedPiece){
      addCapturedChip(capturedPiece);
    }
    state.history.push({from:{...lastMove.from}, to:{...lastMove.to}, piece:movingPiece, captured:capturedPiece||null});
    addHistoryEntry(state.history[state.history.length-1]);
    if(!state.online.spectator && movingPiece && state.online.color && movingPiece.color !== state.online.color){
      commentOnMove(state.history[state.history.length-1]);
    }
    state.turn = data.turn || 'red';
    state.lastMove = lastMove;
    state.online.version = data.version;
    state.selected = null;
    state.legalTargets = [];
    state.gameOver = !!data.gameOver;
    if(!state.gameOver) document.getElementById('modalOverlay').classList.remove('show');
    renderPieces(); // giữ identity quân → CSS slide
    renderMarkers();
    updateStatus();
    updateUndoBtn();
    if(!state.online.spectator) checkGameEnd();
    showOnlineActive();
    return;
  }

  let board;
  try{ board = JSON.parse(data.boardJSON); }catch(err){ return; }
  if(!Array.isArray(board) || board.length !== ROWS){
    console.warn('boardJSON không hợp lệ', board);
    return;
  }
  board = board.map(row => (row||[]).map(p => p ? { type:p.type, color:p.color } : null));
  resetPieceLayer();
  state.board = board;
  state.history = [];
  document.getElementById('capturedRed').innerHTML = '';
  document.getElementById('capturedBlack').innerHTML = '';
  document.getElementById('historyBox').innerHTML = '';

  state.turn = data.turn || 'red';
  state.lastMove = lastMove;
  state.online.version = data.version;
  state.selected = null;
  state.legalTargets = [];
  state.gameOver = !!data.gameOver;
  if(!state.gameOver) document.getElementById('modalOverlay').classList.remove('show');
  state._quietRender = true;
  try{
    renderPieces();
  } finally {
    state._quietRender = false;
  }
  renderMarkers();
  updateStatus();
  updateUndoBtn();
  if(!state.online.spectator) checkGameEnd();
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
  if(state.online.roomCode && state.online.version <= 3){
    markMatchPlayingByRoom(state.online.roomCode);
  }
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
  setFbStatus('⚔️ Đã bắt đầu ván mới — đối thủ sẽ thấy ngay.', false);
  showOnlineActive();
}

/* ---------------- Online: "xin đi lại" (undo request, needs opponent's OK) ---------------- */

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
  setFbStatus('🤝 Đã đồng ý đi lại.', false);
}

function declineOnlineUndo(){
  if(fb.roomRef) fb.roomRef.child('undoRequest').update({status:'declined'});
  document.getElementById('undoModalOverlay').classList.remove('show');
}

/** Tin hệ thống trong phòng (2 người thường hoặc giải). */
function pushSystemChat(text){
  if(!fb.roomRef) return;
  fb.roomRef.child('chat').push({
    color: 'spectator',
    name: 'Hệ thống',
    role: 'system',
    text: text,
    ts: Date.now(),
    system: true
  }).catch(()=>{});
}

/* ---------------- Online: realtime chat ---------------- */

let chatSeenKeys = new Set();
let chatUnread = 0;
let floatChatCollapsed = false;

function clearChatUI(){
  chatSeenKeys = new Set();
  chatUnread = 0;
  const a = document.getElementById('chatMessages');
  const b = document.getElementById('floatChatMessages');
  if(a) a.innerHTML = '';
  if(b) b.innerHTML = '';
  updateChatUnreadBadge();
}

function showFloatChat(show){
  const el = document.getElementById('floatChat');
  if(!el) return;
  el.style.display = show ? '' : 'none';
  if(show){
    const room = document.getElementById('floatChatRoom');
    if(room) room.textContent = state.online.roomCode || '—';
  }
}

function updateChatUnreadBadge(){
  const badge = document.getElementById('floatChatUnread');
  if(!badge) return;
  if(chatUnread > 0 && floatChatCollapsed){
    badge.style.display = '';
    badge.textContent = chatUnread > 99 ? '99+' : String(chatUnread);
  } else {
    badge.style.display = 'none';
  }
}

function fbListenChat(){
  if(!fb.roomRef) return;
  fb.roomRef.child('chat').off('child_added');
  clearChatUI();
  showFloatChat(true);
  floatChatCollapsed = false;
  const body = document.getElementById('floatChatBody');
  if(body) body.style.display = '';
  fb.roomRef.child('chat').limitToLast(80).on('child_added', snap=>{
    const key = snap.key;
    if(key && chatSeenKeys.has(key)) return;
    if(key) chatSeenKeys.add(key);
    appendChatMessage(snap.val(), { fromNetwork: true });
  });
}

function chatSenderLabel(msg){
  if(msg.system || (msg.text && /^\[(BTC|TRỌNG TÀI|HỆ THỐNG)\]/i.test(msg.text))){
    return msg.name || 'Hệ thống';
  }
  if(msg.name) return msg.name;
  if(msg.code) return msg.code;
  if(msg.color === 'red') return 'Đỏ';
  if(msg.color === 'black') return 'Đen';
  return 'Khán giả';
}

function buildChatMsgEl(msg){
  const div = document.createElement('div');
  let roleClass = 'chat-spectator';
  if(msg.system) roleClass = 'chat-system';
  else if(msg.color === 'red') roleClass = 'chat-red';
  else if(msg.color === 'black') roleClass = 'chat-black';
  div.className = 'chat-msg ' + roleClass + (msg.flair==='gold' ? ' chat-flair-gold' : '');

  const head = document.createElement('div');
  head.className = 'chat-msg-head';

  const senderSpan = document.createElement('span');
  senderSpan.className = 'chat-sender';
  senderSpan.textContent = chatSenderLabel(msg);
  head.appendChild(senderSpan);

  const role = (msg.role || '').toLowerCase();
  if(role && role !== 'player'){
    const badge = document.createElement('span');
    badge.className = 'role-badge ' + role;
    badge.textContent = typeof roleLabel === 'function' ? roleLabel(role) : role;
    head.appendChild(badge);
  } else if(msg.color === 'red' || msg.color === 'black'){
    const side = document.createElement('span');
    side.className = 'chat-side-badge ' + (msg.color === 'red' ? 'side-red' : 'side-black');
    side.textContent = msg.color === 'red' ? 'Đỏ' : 'Đen';
    head.appendChild(side);
  }

  if(msg.ts){
    const t = document.createElement('span');
    t.className = 'chat-time';
    const d = new Date(msg.ts);
    t.textContent = d.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' });
    head.appendChild(t);
  }

  div.appendChild(head);
  const body = document.createElement('div');
  body.className = 'chat-msg-body';
  body.textContent = msg.text || '';
  div.appendChild(body);
  return div;
}

function appendChatMessage(msg, opts={}){
  if(!msg || !msg.text) return;
  const el1 = document.getElementById('chatMessages');
  const el2 = document.getElementById('floatChatMessages');
  const node1 = buildChatMsgEl(msg);
  if(el1){ el1.appendChild(node1); el1.scrollTop = el1.scrollHeight; }
  if(el2){
    el2.appendChild(buildChatMsgEl(msg));
    el2.scrollTop = el2.scrollHeight;
  }
  if(opts.fromNetwork && floatChatCollapsed){
    chatUnread++;
    updateChatUnreadBadge();
  }
}

function resolveChatSenderMeta(){
  const meta = {
    name: '',
    code: '',
    role: 'player'
  };
  if(playerSession){
    meta.name = playerSession.name || playerSession.code || '';
    meta.code = playerSession.code || '';
    meta.role = playerSession.role || 'player';
  }
  try{
    const adm = typeof getAdminSessionMeta === 'function' ? getAdminSessionMeta() : null;
    if(adm && adm.ok && state.online.spectator){
      if(adm.via === 'superadmin' && adm.name){
        meta.name = adm.name;
        meta.code = adm.code || meta.code;
        meta.role = 'superadmin';
      } else if(adm.via === 'site'){
        meta.name = meta.name || 'Admin';
        meta.role = 'admin';
      }
    }
  }catch(e){}
  if(!meta.name){
    if(state.online.spectator) meta.name = 'Khán giả';
    else if(state.online.color === 'red') meta.name = 'Đỏ';
    else if(state.online.color === 'black') meta.name = 'Đen';
    else meta.name = 'Người chơi';
  }
  return meta;
}

function sendChat(fromFloat){
  const input = document.getElementById(fromFloat ? 'floatChatInput' : 'chatInput');
  const alt = document.getElementById(fromFloat ? 'chatInput' : 'floatChatInput');
  const text = (input && input.value || '').trim().slice(0, 200);
  if(!text || !fb.roomRef || !state.online.active) return;
  const myColor = state.online.spectator ? 'spectator' : (state.online.color || 'spectator');
  const meta = resolveChatSenderMeta();
  const payload = {
    color: myColor,
    name: meta.name,
    code: meta.code || null,
    role: meta.role || 'player',
    text,
    ts: Date.now(),
    system: false
  };
  fb.roomRef.child('chat').push(payload).catch(err=>{
    setFbStatus('Gửi chat thất bại: '+(err.message||err), true);
  });
  if(input) input.value = '';
  if(alt) alt.value = '';
}

function leaveRoom(){
  if(fb.roomRef){
    const roomRef = fb.roomRef;
    const myColor = state.online.color;
    if(myColor){
      const seenRef = roomRef.child('lastSeen/'+myColor);
      seenRef.onDisconnect().cancel();
      seenRef.remove();
      try{
        roomRef.child('seats/'+myColor).onDisconnect().cancel();
        roomRef.child('seats/'+myColor).remove();
      }catch(e){}
    }
    roomRef.child('undoRequest').off();
    roomRef.child('chat').off();
  }
  fbStopHeartbeat();
  fbStopListening();
  clearRoomSession();
  clearChatUI();
  showFloatChat(false);
  state.online.active = false;
  state.online.color = null;
  state.online.spectator = false;
  state.online.transport = null;
  state.online.roomCode = null;
  document.getElementById('onlineIdle').style.display = '';
  document.getElementById('onlineActive').style.display = 'none';
  closeShareRoomModal();
  document.getElementById('fbJoinCodeInput').value = '';
  document.getElementById('undoModalOverlay').classList.remove('show');
  setFbStatus('', false);
  resetGame();
}

function openDrawer(){
  try{ loadSpectatorPolls(); }catch(e){}
  try{ updateAdminMenuUI(); }catch(e){}
  try{ loadCoinStateFromPlayer(); }catch(e){}
  try{ loadFriendsUI(); }catch(e){}

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

/* ---------------- UI helpers ---------------- */

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
    msg.textContent = `⚠ ${state.turn==='red'?'Đỏ':'Đen'} đang bị chiếu tướng!`;
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

function sideClass(color){
  return color==='red' ? 'side-red' : 'side-black';
}

function sideLabel(color){
  return color==='red' ? 'Đỏ' : 'Đen';
}

/** Build colored HTML for a move line (history / comments). */
function formatMoveHtml(entry, opts={}){
  if(!entry || !entry.piece) return '';
  const color = entry.piece.color;
  let html = '';
  if(opts.withNumber){
    html += `<span class="move-num">${opts.withNumber}.</span> `;
  }

  if(entry.kind === 'spawn'){
    const name = VN_PIECE_NAME[entry.piece.type] || entry.piece.type;
    html += `<span class="${sideClass(color)} side-tag">[Gian lận]</span> `;
    html += `<span class="${sideClass(color)} piece-name">Hồi sinh ${name}</span>`;
    return html;
  }
  if(entry.kind === 'remove'){
    const name = VN_PIECE_NAME[entry.piece.type] || entry.piece.type;
    html += `<span class="${sideClass(color)} side-tag">[Gian lận]</span> `;
    html += `<span class="${sideClass(color)} piece-name">Xóa ${name}</span>`;
    return html;
  }

  const notation = moveNotation(entry.piece, entry.from, entry.to);
  const space = notation.indexOf(' ');
  const pieceName = space>0 ? notation.slice(0, space) : notation;
  const rest = space>0 ? notation.slice(space) : '';

  html += `<span class="${sideClass(color)} side-tag">[${sideLabel(color)}]</span> `;
  html += `<span class="${sideClass(color)} piece-name">${pieceName}</span>`;
  html += `<span class="move-rest">${rest}</span>`;

  if(entry.captured){
    const capColor = entry.captured.color;
    const glyph = GLYPHS[capColor][entry.captured.type];
    const capName = VN_PIECE_NAME[entry.captured.type] || '';
    html += ` <span class="move-cap">(ăn <span class="${sideClass(capColor)} piece-name">${capName||glyph}</span>)</span>`;
  }
  if(opts.check){
    html += ` <span class="move-check">chiếu</span>`;
  }
  return html;
}

function addHistoryEntry(entry){
  const box = document.getElementById('historyBox');
  const div = document.createElement('div');
  div.className = 'history-item ' + sideClass(entry.piece.color);
  div.innerHTML = formatMoveHtml(entry, { withNumber: state.history.length });
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function updateUndoBtn(){
  document.getElementById('undoBtn').disabled = state.history.length===0;
}

function undo(){
  if(state.history.length===0 || state.online.active) return;
  if(state.aiTimeoutId){ clearTimeout(state.aiTimeoutId); state.aiTimeoutId = null; state.aiThinking = false; }
  const steps = (state.mode!=='pvp') ? 2 : 1; // undo AI + human move together
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

/* ---------------- Replay a finished match ---------------- */

let replayTimer = null;

function stopReplayIfActive(){
  if(replayTimer){ clearInterval(replayTimer); replayTimer=null; }
  if(!state.replay.active) return;
  state.replay.active = false;
  document.getElementById('replayBar').style.display = 'none';
  const btn = document.getElementById('replayPlayBtn');
  btn.innerHTML = '<i class="fa-regular fa-play"></i>';
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
    if(!mv || !mv.piece) continue;
    if(mv.kind === 'spawn'){
      board[mv.to.r][mv.to.c] = { type: mv.piece.type, color: mv.piece.color };
      lastMove = { from: mv.to, to: mv.to };
      continue;
    }
    if(mv.kind === 'remove'){
      board[mv.from.r][mv.from.c] = null;
      lastMove = { from: mv.from, to: mv.from };
      continue;
    }
    board[mv.to.r][mv.to.c] = { type: mv.piece.type, color: mv.piece.color };
    board[mv.from.r][mv.from.c] = null;
    lastMove = { from: mv.from, to: mv.to };
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
    if(mv && mv.kind === 'spawn'){
      state.board[mv.to.r][mv.to.c] = { type: mv.piece.type, color: mv.piece.color };
      state.lastMove = { from: mv.to, to: mv.to };
    } else if(mv && mv.kind === 'remove'){
      state.board[mv.from.r][mv.from.c] = null;
      state.lastMove = { from: mv.from, to: mv.from };
    } else {
      const moving = mv && state.board[mv.from.r][mv.from.c];
      if(moving){
        state.board[mv.to.r][mv.to.c] = moving;
        state.board[mv.from.r][mv.from.c] = null;
        state.lastMove = {from:mv.from, to:mv.to};
      } else {
        rebuildReplayBoard(targetIndex);
        resetPieceLayer();
      }
    }
  } else if(targetIndex === cur-1){
    const mv = state.replay.moves[targetIndex];
    if(mv && mv.kind === 'spawn'){
      state.board[mv.to.r][mv.to.c] = null;
      state.lastMove = targetIndex>0 ? {from:state.replay.moves[targetIndex-1].from, to:state.replay.moves[targetIndex-1].to} : null;
    } else if(mv && mv.kind === 'remove'){
      state.board[mv.from.r][mv.from.c] = mv.piece ? {type:mv.piece.type, color:mv.piece.color} : null;
      state.lastMove = targetIndex>0 ? {from:state.replay.moves[targetIndex-1].from, to:state.replay.moves[targetIndex-1].to} : null;
    } else {
      const moving = mv && state.board[mv.to.r][mv.to.c];
      if(moving){
        state.board[mv.from.r][mv.from.c] = moving;
        state.board[mv.to.r][mv.to.c] = mv.captured ? {type:mv.captured.type, color:mv.captured.color} : null;
        state.lastMove = targetIndex>0 ? {from:state.replay.moves[targetIndex-1].from, to:state.replay.moves[targetIndex-1].to} : null;
      } else {
        rebuildReplayBoard(targetIndex);
        resetPieceLayer();
      }
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
    btn.innerHTML = '<i class="fa-regular fa-play"></i>';
    btn.classList.remove('playing');
    return;
  }
  btn.innerHTML = '<i class="fa-regular fa-pause"></i>';
  btn.classList.add('playing');
  replayTimer = setInterval(()=>{
    if(state.replay.index >= state.replay.moves.length){
      clearInterval(replayTimer); replayTimer = null;
      btn.innerHTML = '<i class="fa-regular fa-play"></i>';
      btn.classList.remove('playing');
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
  clearComments();
  document.getElementById('modalOverlay').classList.remove('show');
  resetPieceLayer();
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
}

/* ---------------- Wire up controls ---------------- */

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
document.getElementById('shareRoomBtn').addEventListener('click', openShareRoomModal);
document.getElementById('shareRoomCloseBtn').addEventListener('click', closeShareRoomModal);
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

document.getElementById('chatSendBtn').addEventListener('click', ()=> sendChat(false));
document.getElementById('chatInput').addEventListener('keydown', (e)=>{
  if(e.key==='Enter') sendChat(false);
});
document.getElementById('floatChatSendBtn')?.addEventListener('click', ()=> sendChat(true));
document.getElementById('floatChatInput')?.addEventListener('keydown', (e)=>{
  if(e.key==='Enter') sendChat(true);
});
document.getElementById('floatChatMinBtn')?.addEventListener('click', ()=>{
  floatChatCollapsed = !floatChatCollapsed;
  const body = document.getElementById('floatChatBody');
  if(body) body.style.display = floatChatCollapsed ? 'none' : '';
  if(!floatChatCollapsed){ chatUnread = 0; updateChatUnreadBadge(); }
  else updateChatUnreadBadge();
});
document.getElementById('floatChatHeader')?.addEventListener('click', (e)=>{
  if(e.target.closest('.float-chat-min')) return;
  if(floatChatCollapsed){
    floatChatCollapsed = false;
    const body = document.getElementById('floatChatBody');
    if(body) body.style.display = '';
    chatUnread = 0;
    updateChatUnreadBadge();
  }
});

document.getElementById('soundToggle').addEventListener('change', (e)=>{
  state.soundOn = e.target.checked;
});
state.commentVoice = false;
document.querySelectorAll('.theme-swatch').forEach(btn=>{
  btn.addEventListener('click', ()=> trySelectTheme(btn.dataset.theme));
});
document.getElementById('checkInBtn')?.addEventListener('click', ()=>{ doDailyCheckIn(); });
document.getElementById('friendAddBtn')?.addEventListener('click', sendFriendRequest);
document.getElementById('betChallengeBtn')?.addEventListener('click', sendBetChallenge);
document.getElementById('openShopBtn')?.addEventListener('click', openShopPanel);
document.getElementById('openInvBtn')?.addEventListener('click', openInvPanel);
document.getElementById('shopCloseBtn')?.addEventListener('click', closeShopPanel);
document.getElementById('invCloseBtn')?.addEventListener('click', closeInvPanel);
document.getElementById('shopToInvBtn')?.addEventListener('click', ()=>{ closeShopPanel(); openInvPanel(); });
document.getElementById('invToShopBtn')?.addEventListener('click', ()=>{ closeInvPanel(); openShopPanel(); });
document.getElementById('giftRedeemBtn')?.addEventListener('click', redeemGiftCode);
document.getElementById('giftRedeemCode')?.addEventListener('keydown', e=>{ if(e.key==='Enter') redeemGiftCode(); });
document.querySelectorAll('#shopTabs .shop-tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    shopTab = btn.dataset.shopTab || 'all';
    shopPage = 0;
    document.querySelectorAll('#shopTabs .shop-tab').forEach(b=>b.classList.toggle('active', b===btn));
    renderShopList();
  });
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

/* ---------------- Admin panel (secure) ---------------- */
const ADMIN_SESSION_KEY = 'co-tuong-admin-session';
const ADMIN_PWD_OVERRIDE_KEY = 'co-tuong-admin-pwd-hash';
const ADMIN_FAIL_KEY = 'co-tuong-admin-fails';
const ADMIN_DEFAULT_HASH = 'f12bf52e9626871977f72d931114a2cdfbc6e3d7b760548c625b276dbee66155';

function adminCfg(){
  const a = (CONFIG && CONFIG.admin) || {};
  return {
    passwordHash: a.passwordHash || ADMIN_DEFAULT_HASH,
    maxFailedAttempts: Math.max(1, +(a.maxFailedAttempts || 5)),
    lockoutMinutes: Math.max(1, +(a.lockoutMinutes || 5)),
    sessionMinutes: Math.max(1, +(a.sessionMinutes || 30))
  };
}

async function sha256Hex(text){
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function getStoredPasswordHash(){
  try{
    const override = localStorage.getItem(ADMIN_PWD_OVERRIDE_KEY);
    if(override && /^[a-f0-9]{64}$/i.test(override)) return override.toLowerCase();
  }catch(e){}
  return (adminCfg().passwordHash || ADMIN_DEFAULT_HASH).toLowerCase();
}

function isAdminUnlocked(){
  try{
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data || !data.ok || !data.exp) return false;
    if(Date.now() > data.exp){
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      return false;
    }
    return true;
  }catch(e){ return false; }
}

function setAdminUnlocked(v, meta){
  try{
    if(!v){
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      return;
    }
    const mins = adminCfg().sessionMinutes;
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
      ok: true,
      exp: Date.now() + mins * 60 * 1000,
      via: (meta && meta.via) || 'site',
      code: (meta && meta.code) || '',
      name: (meta && meta.name) || '',
      playerId: (meta && meta.playerId) || ''
    }));
  }catch(e){}
}

function getAdminSessionMeta(){
  try{
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(!data || !data.ok || !data.exp || Date.now() > data.exp) return null;
    return data;
  }catch(e){ return null; }
}

function getFailState(){
  try{
    const raw = localStorage.getItem(ADMIN_FAIL_KEY);
    if(!raw) return { count: 0, lockedUntil: 0 };
    const data = JSON.parse(raw);
    return {
      count: Math.max(0, +(data.count || 0)),
      lockedUntil: +(data.lockedUntil || 0)
    };
  }catch(e){ return { count: 0, lockedUntil: 0 }; }
}

function setFailState(count, lockedUntil){
  try{
    localStorage.setItem(ADMIN_FAIL_KEY, JSON.stringify({ count, lockedUntil: lockedUntil || 0 }));
  }catch(e){}
}

function clearFailState(){ setFailState(0, 0); }

function setAdminLoginStatus(msg, isError){
  const el = document.getElementById('adminLoginStatus');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'online-status' + (isError ? ' warn' : msg ? ' live' : '');
}

function setAdminStatus(msg, kind){
  const el = document.getElementById('adminStatus');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'admin-status' + (kind === 'ok' ? ' ok' : kind === 'err' ? ' err' : '');
}

function setAdminPwdStatus(msg, kind){
  const el = document.getElementById('adminPwdStatus');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'admin-status' + (kind === 'ok' ? ' ok' : kind === 'err' ? ' err' : '');
}

async function tryAdminLogin(){
  const input = document.getElementById('adminPasswordInput');
  const idInput = document.getElementById('adminLoginId');
  const pwd = (input && input.value || '');
  const loginId = (idInput && idInput.value || '').trim().toUpperCase();
  const cfg = adminCfg();
  const fails = getFailState();
  const now = Date.now();

  if(fails.lockedUntil && now < fails.lockedUntil){
    const left = Math.ceil((fails.lockedUntil - now) / 60000);
    setAdminLoginStatus(`Đã khóa tạm. Thử lại sau ~${left} phút.`, true);
    return;
  }
  if(fails.lockedUntil && now >= fails.lockedUntil) clearFailState();

  if(!pwd.trim()){
    setAdminLoginStatus('Nhập mật khẩu trước.', true);
    return;
  }

  const hash = await sha256Hex(pwd);
  const expected = getStoredPasswordHash();

  if(hash === expected){
    clearFailState();
    setAdminUnlocked(true, { via: 'site' });
    if(input) input.value = '';
    if(idInput) idInput.value = '';
    setAdminLoginStatus(`Đăng nhập Admin website · phiên ${cfg.sessionMinutes} phút. Bấm «Vào panel» khi cần.`, false);
    updateAdminMenuUI();
    try{ loadCoinStateFromPlayer(); }catch(e){}
    return;
  }

  try{
    await fbEnsureAuth();
    const snap = await fb.db.ref('players').once('value');
    const players = snap.val() || {};
    const supers = Object.values(players).filter(p => (p.role || '') === 'superadmin');
    if(!supers.length){
    } else {
      let matched = null;
      for(const p of supers){
        if(loginId && (p.code || '').toUpperCase() !== loginId) continue;
        const okHash = p.passwordHash && p.passwordHash === hash;
        const okPlain = p.password && p.password === pwd;
        if(okHash || okPlain){ matched = p; break; }
      }
      if(!matched && !loginId){
        for(const p of supers){
          const okHash = p.passwordHash && p.passwordHash === hash;
          const okPlain = p.password && p.password === pwd;
          if(okHash || okPlain){ matched = p; break; }
        }
      }
      if(matched){
        if(matched.password && !matched.passwordHash){
          try{
            await fb.db.ref('players/'+matched.id).update({ passwordHash: hash, password: null });
          }catch(e){}
        }
        clearFailState();
        setAdminUnlocked(true, {
          via: 'superadmin',
          code: matched.code || '',
          name: matched.name || '',
          playerId: matched.id || ''
        });
        if(tcData) tcData.players = players;
        if(input) input.value = '';
        if(idInput) idInput.value = '';
        setAdminLoginStatus(
          'Đăng nhập Admin chính «'+(matched.code||matched.name)+'» · phiên '+cfg.sessionMinutes+' phút. Bấm «Vào panel» khi cần.',
          false
        );
        updateAdminMenuUI();
        try{ loadCoinStateFromPlayer(); }catch(e){}
        return;
      }
    }
  }catch(err){
    console.warn('superadmin login check failed', err);
  }

  const nextCount = (getFailState().count || 0) + 1;
  if(nextCount >= cfg.maxFailedAttempts){
    const until = Date.now() + cfg.lockoutMinutes * 60 * 1000;
    setFailState(nextCount, until);
    setAdminLoginStatus(`Sai ${nextCount} lần — khóa ${cfg.lockoutMinutes} phút.`, true);
  } else {
    setFailState(nextCount, 0);
    setAdminLoginStatus(
      loginId
        ? `Sai ID/mật khẩu superadmin (${nextCount}/${cfg.maxFailedAttempts}).`
        : `Sai mật khẩu (${nextCount}/${cfg.maxFailedAttempts}).`,
      true
    );
  }
  if(input) input.value = '';
}

function updateAdminMenuUI(){
  const idle = document.getElementById('adminLoginIdle');
  const active = document.getElementById('adminLoginActive');
  if(!idle || !active) return;
  if(isAdminUnlocked()){
    idle.style.display = 'none';
    active.style.display = '';
    const meta = (typeof getAdminSessionMeta === 'function') ? getAdminSessionMeta() : null;
    const title = document.getElementById('adminSessionTitle');
    const sub = document.getElementById('adminSessionMeta');
    if(meta && meta.via === 'superadmin'){
      if(title) title.textContent = meta.name || meta.code || 'Admin chính';
      if(sub) sub.textContent = 'Admin chính' + (meta.code ? ' · '+meta.code : '') + ' · còn phiên';
    } else {
      if(title) title.textContent = 'Admin website';
      if(sub){
        let left = '';
        try{
          if(meta && meta.exp){
            const m = Math.max(0, Math.ceil((meta.exp - Date.now())/60000));
            left = ' · còn ~'+m+' phút';
          }
        }catch(e){}
        sub.textContent = 'Phiên quản trị' + left;
      }
    }
  } else {
    idle.style.display = '';
    active.style.display = 'none';
  }
}

function openAdminPanel(){
  if(!isAdminUnlocked()){
    setAdminLoginStatus('Phiên đã hết hạn. Đăng nhập lại.', true);
    return;
  }
  document.getElementById('adminOverlay').classList.add('show');
  const box = document.getElementById('adminChangePwdBox');
  if(box) box.style.display = 'none';
  adminLoadData();
}

function closeAdminPanel(){
  document.getElementById('adminOverlay').classList.remove('show');
}

function adminLogout(){
  setAdminUnlocked(false);
  closeAdminPanel();
  setAdminLoginStatus('Đã đăng xuất.', false);
  updateAdminMenuUI();
}

function toggleChangePwdBox(show){
  const box = document.getElementById('adminChangePwdBox');
  if(!box) return;
  box.style.display = show ? '' : 'none';
  if(show){
    document.getElementById('adminNewPwd').value = '';
    document.getElementById('adminNewPwd2').value = '';
    setAdminPwdStatus('', null);
  }
}

async function saveNewAdminPassword(){
  if(!isAdminUnlocked()){
    setAdminPwdStatus('Phiên hết hạn — đăng nhập lại.', 'err');
    return;
  }
  const p1 = (document.getElementById('adminNewPwd').value || '');
  const p2 = (document.getElementById('adminNewPwd2').value || '');
  if(p1.length < 6){
    setAdminPwdStatus('Mật khẩu tối thiểu 6 ký tự.', 'err');
    return;
  }
  if(p1 !== p2){
    setAdminPwdStatus('Hai lần nhập không khớp.', 'err');
    return;
  }
  try{
    const hash = await sha256Hex(p1);
    localStorage.setItem(ADMIN_PWD_OVERRIDE_KEY, hash);
    document.getElementById('adminNewPwd').value = '';
    document.getElementById('adminNewPwd2').value = '';
    setAdminPwdStatus('Đã đổi mật khẩu (lưu trên trình duyệt này).', 'ok');
    setTimeout(()=> toggleChangePwdBox(false), 1200);
  }catch(err){
    setAdminPwdStatus('Không đổi được: ' + (err.message || err), 'err');
  }
}

function formatAge(ms){
  if(ms == null || !isFinite(ms)) return '—';
  const s = Math.floor(ms / 1000);
  if(s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if(m < 60) return m + ' phút';
  const h = Math.floor(m / 60);
  return h + ' giờ ' + (m % 60) + 'p';
}

function formatTime(ts){
  if(!ts) return '—';
  try{
    return new Date(ts).toLocaleString('vi-VN', { hour12:false });
  }catch(e){ return '—'; }
}

async function adminEnsureFb(){
  if(!fbAvailable()) throw new Error('Firebase chưa cấu hình trong config.json');
  await fbEnsureAuth();
}

async function adminLoadData(){
  setAdminStatus('Đang tải dữ liệu…');
  const roomsList = document.getElementById('adminRoomsList');
  const savesList = document.getElementById('adminSavesList');
  if(roomsList) roomsList.innerHTML = '<div class="admin-empty">Đang tải…</div>';
  if(savesList) savesList.innerHTML = '<div class="admin-empty">Đang tải…</div>';
  const setTxt = (id,v)=>{ const n=document.getElementById(id); if(n) n.textContent=v; };

  let rooms = null, saves = null;
  try{
    await adminEnsureFb();
    const [roomsSnap, savesSnap] = await Promise.all([
      fb.db.ref('rooms').once('value'),
      fb.db.ref('saves').once('value')
    ]);
    rooms = roomsSnap.val() || {};
    saves = savesSnap.val() || {};
  }catch(err){
    setAdminStatus('Không đọc được dữ liệu: ' + (err.message || err), 'err');
    if(roomsList) roomsList.innerHTML = '<div class="admin-empty">Lỗi tải phòng. Kiểm tra luật bảo mật Firebase (cần quyền list rooms/).</div>';
    if(savesList) savesList.innerHTML = '<div class="admin-empty">Lỗi tải ván lưu.</div>';
    setTxt('adminRoomCount','—'); setTxt('adminActiveCount','—'); setTxt('adminSaveCount','—');
    return;
  }

  const codes = Object.keys(rooms);
  const saveCodes = Object.keys(saves);
  let active = 0, expired = 0;
  const now = Date.now();

  codes.forEach(code=>{
    if(fbRoomExpired(rooms[code])) expired++;
    else {
      const seen = rooms[code].lastSeen || {};
      const redOk = seen.red && (now - seen.red) < ROOM_EMPTY_GRACE_MS;
      const blackOk = seen.black && (now - seen.black) < ROOM_EMPTY_GRACE_MS;
      if(redOk || blackOk) active++;
    }
  });
  setTxt('adminRoomCount', codes.length);
  setTxt('adminActiveCount', active);
  setTxt('adminSaveCount', saveCodes.length);

  if(roomsList){
    if(codes.length === 0){
      roomsList.innerHTML = '<div class="admin-empty">Không có phòng nào.</div>';
    } else {
      roomsList.innerHTML = '';
      codes.sort((a,b)=>{
        const ta = (rooms[a].createdAt || 0);
        const tb = (rooms[b].createdAt || 0);
        return tb - ta;
      }).forEach(code=>{
        const data = rooms[code];
        const isExp = fbRoomExpired(data);
        const seen = data.lastSeen || {};
        const redAge = seen.red != null ? now - seen.red : null;
        const blackAge = seen.black != null ? now - seen.black : null;
        const redLive = redAge != null && redAge < ROOM_EMPTY_GRACE_MS;
        const blackLive = blackAge != null && blackAge < ROOM_EMPTY_GRACE_MS;

        let badgeClass = 'idle', badgeText = 'Không hoạt động';
        if(isExp){ badgeClass = 'expired'; badgeText = 'Hết hạn'; }
        else if(redLive || blackLive){ badgeClass = 'live'; badgeText = 'Đang chơi'; }

        const item = document.createElement('div');
        item.className = 'admin-item';
        item.innerHTML =
          '<div class="admin-item-main">' +
            '<div class="admin-item-code">' + code +
              '<span class="admin-item-badge ' + badgeClass + '">' + badgeText + '</span>' +
            '</div>' +
            '<div class="admin-item-meta">' +
              'Tạo: ' + formatTime(data.createdAt) +
              ' · Lượt: ' + (data.turn === 'red' ? 'Đỏ' : data.turn === 'black' ? 'Đen' : '—') +
              (data.gameOver ? ' · Đã kết thúc' : '') +
              '<br>Đỏ: ' + (redLive ? 'online (' + formatAge(redAge) + ')' : redAge != null ? 'offline (' + formatAge(redAge) + ')' : 'chưa vào') +
              ' · Đen: ' + (blackLive ? 'online (' + formatAge(blackAge) + ')' : blackAge != null ? 'offline (' + formatAge(blackAge) + ')' : 'chưa vào') +
            '</div>' +
          '</div>' +
          '<div class="admin-item-actions">' +
            '<button class="action-btn cheat-danger admin-del-room" data-code="' + code + '"><i class="fa-regular fa-trash"></i> Xóa</button>' +
          '</div>';
        roomsList.appendChild(item);
      });
      roomsList.querySelectorAll('.admin-del-room').forEach(btn=>{
        btn.addEventListener('click', ()=> adminDeleteRoom(btn.dataset.code));
      });
    }
  }

  if(savesList){
    if(saveCodes.length === 0){
      savesList.innerHTML = '<div class="admin-empty">Không có ván đã lưu.</div>';
    } else {
      savesList.innerHTML = '';
      saveCodes.sort((a,b)=>{
        const ta = (saves[a].savedAt || 0);
        const tb = (saves[b].savedAt || 0);
        return tb - ta;
      }).forEach(code=>{
        const data = saves[code];
        const item = document.createElement('div');
        item.className = 'admin-item';
        item.innerHTML =
          '<div class="admin-item-main">' +
            '<div class="admin-item-code">' + code + '</div>' +
            '<div class="admin-item-meta">Lưu lúc: ' + formatTime(data.savedAt) + '</div>' +
          '</div>' +
          '<div class="admin-item-actions">' +
            '<button class="action-btn cheat-danger admin-del-save" data-code="' + code + '"><i class="fa-regular fa-trash"></i> Xóa</button>' +
          '</div>';
        savesList.appendChild(item);
      });
      savesList.querySelectorAll('.admin-del-save').forEach(btn=>{
        btn.addEventListener('click', ()=> adminDeleteSave(btn.dataset.code));
      });
    }
  }

  setAdminStatus('Đã tải ' + codes.length + ' phòng · ' + saveCodes.length + ' ván lưu.', 'ok');
  updateDashboardStats();
}

async function adminDeleteRoom(code){
  if(!code || !confirm('Xóa phòng ' + code + '?')) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('rooms/' + code).remove();
    setAdminStatus('Đã xóa phòng ' + code + '.', 'ok');
    adminLoadData();
  }catch(err){
    setAdminStatus('Xóa phòng thất bại: ' + (err.message || err), 'err');
  }
}

async function adminDeleteSave(code){
  if(!code || !confirm('Xóa ván lưu ' + code + '?')) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('saves/' + code).remove();
    setAdminStatus('Đã xóa ván lưu ' + code + '.', 'ok');
    adminLoadData();
  }catch(err){
    setAdminStatus('Xóa ván lưu thất bại: ' + (err.message || err), 'err');
  }
}

async function adminSweepExpired(){
  setAdminStatus('Đang quét phòng hết hạn…');
  try{
    await adminEnsureFb();
    await fbSweepExpiredRooms();
    setAdminStatus('Đã quét xong phòng hết hạn.', 'ok');
    adminLoadData();
  }catch(err){
    setAdminStatus('Quét thất bại: ' + (err.message || err), 'err');
  }
}

async function adminDeleteAllRooms(){
  if(!confirm('XÓA TẤT CẢ phòng online? Hành động này không thể hoàn tác.')) return;
  if(!confirm('Xác nhận lần cuối: xóa toàn bộ rooms/?')) return;
  setAdminStatus('Đang xóa tất cả phòng…');
  try{
    await adminEnsureFb();
    await fb.db.ref('rooms').remove();
    setAdminStatus('Đã xóa tất cả phòng.', 'ok');
    adminLoadData();
  }catch(err){
    setAdminStatus('Xóa thất bại: ' + (err.message || err), 'err');
  }
}

async function adminDeleteAllSaves(){
  if(!confirm('XÓA TẤT CẢ ván đã lưu? Hành động này không thể hoàn tác.')) return;
  if(!confirm('Xác nhận lần cuối: xóa toàn bộ saves/?')) return;
  setAdminStatus('Đang xóa tất cả ván lưu…');
  try{
    await adminEnsureFb();
    await fb.db.ref('saves').remove();
    setAdminStatus('Đã xóa tất cả ván lưu.', 'ok');
    adminLoadData();
  }catch(err){
    setAdminStatus('Xóa thất bại: ' + (err.message || err), 'err');
  }
}

/* ===== Tournament Control Center state (Firebase RTDB) =====
   Paths:
     tournaments/{id}
     players/{id}
     matches/{id}
     groups/{tournamentId}
     admin/broadcast
     admin/refLog/{pushId}
     admin/bcLog/{pushId}
*/
let tcData = {
  tournaments: {},
  players: {},
  matches: {},
  groups: {},
  refLog: [],
  broadcast: { featured:'', title:'', streamUrl:'', spectatorMode:'open', ticker:'' },
  bcLog: []
};
let liveAutoTimer = null;
let tcLoaded = false;

async function tcEnsureFb(){
  if(!fbAvailable()) throw new Error('Firebase chưa cấu hình');
  await fbEnsureAuth();
}

/** Load toàn bộ dữ liệu giải từ RTDB → tcData (bộ nhớ tạm để render UI). */
async function tcLoad(){
  try{
    await tcEnsureFb();
    const [tnSnap, plSnap, mSnap, gSnap, bcSnap, refSnap, bcLogSnap] = await Promise.all([
      fb.db.ref('tournaments').once('value'),
      fb.db.ref('players').once('value'),
      fb.db.ref('matches').once('value'),
      fb.db.ref('groups').once('value'),
      fb.db.ref('admin/broadcast').once('value'),
      fb.db.ref('admin/refLog').limitToLast(50).once('value'),
      fb.db.ref('admin/bcLog').limitToLast(30).once('value')
    ]);
    tcData.tournaments = tnSnap.val() || {};
    tcData.players = plSnap.val() || {};
    tcData.matches = mSnap.val() || {};
    tcData.groups = gSnap.val() || {};
    tcData.broadcast = bcSnap.val() || { featured:'', title:'', streamUrl:'', spectatorMode:'open', ticker:'' };

    const refVal = refSnap.val() || {};
    tcData.refLog = Object.keys(refVal)
      .map(k => Object.assign({ _key:k }, refVal[k]))
      .sort((a,b)=> (b.ts||0)-(a.ts||0));

    const bcVal = bcLogSnap.val() || {};
    tcData.bcLog = Object.keys(bcVal)
      .map(k => Object.assign({ _key:k }, bcVal[k]))
      .sort((a,b)=> (b.ts||0)-(a.ts||0));

    tcLoaded = true;
  }catch(err){
    console.warn('tcLoad failed:', err);
    setAdminStatus('Không tải được dữ liệu giải từ Firebase: ' + (err.message||err), 'err');
  }
}

/** Ghi một node lên RTDB. */
async function tcSet(path, value){
  await tcEnsureFb();
  await fb.db.ref(path).set(value);
}
async function tcUpdate(path, value){
  await tcEnsureFb();
  await fb.db.ref(path).update(value);
}
async function tcRemove(path){
  await tcEnsureFb();
  await fb.db.ref(path).remove();
}
async function tcPush(path, value){
  await tcEnsureFb();
  return fb.db.ref(path).push(value);
}

/** Không còn dùng localStorage cho dữ liệu giải. Giữ stub để tránh lỗi nếu còn chỗ gọi. */
function tcSave(){ /* no-op — mỗi thao tác ghi thẳng Firebase */ }

function randomCode(len, prefix){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = prefix || '';
  for(let i=0;i<(len||5);i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function formatStatus(st){
  return ({ draft:'Nháp', registration:'Đăng ký', ongoing:'Đang diễn ra', finished:'Kết thúc' })[st] || st;
}
function formatFmt(f){
  return ({
    single_elim:'Loại trực tiếp', double_elim:'Loại kép',
    round_robin:'Vòng tròn', swiss:'Thụy Sĩ', group_knockout:'Chia bảng + KO'
  })[f] || f;
}

function switchAdminSection(sec){
  document.querySelectorAll('.admin-nav-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.section === sec);
  });
  document.querySelectorAll('.admin-section').forEach(p=>{
    p.classList.toggle('active', p.id === 'adminSec-'+sec);
  });
  if(sec === 'dashboard') adminLoadData();
  if(sec === 'tournament') renderTournamentList();
  if(sec === 'players'){ fillTournamentSelects(); renderPlayerList(); }
  if(sec === 'bracket'){ fillTournamentSelects(); renderBracketList(); }
  if(sec === 'referee') renderRefLog();
  if(sec === 'format'){ fillTournamentSelects(); renderGroups(); }
  if(sec === 'live') renderLiveMonitor();
  if(sec === 'broadcast'){ loadBroadcastForm(); renderBcLog(); }
  if(sec === 'system') adminLoadData();
}

function fillTournamentSelects(){
  const opts = Object.values(tcData.tournaments).map(t=>
    `<option value="${t.id}">${t.name} (${t.code})</option>`
  ).join('');
  ['playerTournament','bracketTournament','groupTournament'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    const cur = el.value;
    const empty = id==='playerTournament' ? '<option value="">— Chưa gắn —</option>' : '';
    el.innerHTML = empty + opts;
    if(cur) el.value = cur;
  });
}

function updateDashboardStats(){
  const tCount = Object.keys(tcData.tournaments).length;
  const pCount = Object.keys(tcData.players).length;
  const mCount = Object.keys(tcData.matches).length;
  const el = (id,v)=>{ const n=document.getElementById(id); if(n) n.textContent=v; };
  el('statTournamentCount', tCount);
  el('statPlayerCount', pCount);
  el('statMatchCount', mCount);
  el('playerCountBadge', pCount);
  const live = Object.values(tcData.matches).filter(m=>m.status==='playing').length;
  const wait = Object.values(tcData.matches).filter(m=>m.status==='pending').length;
  const done = Object.values(tcData.matches).filter(m=>m.status==='finished').length;
  el('liveActiveMatches', live);
  el('liveWaiting', wait);
  el('liveFinished', done);
}

/* ---- Tournament ---- */
async function createTournament(){
  const name = (document.getElementById('tourName').value||'').trim();
  if(!name){ setAdminStatus('Nhập tên giải đấu.', 'err'); return; }
  let code = (document.getElementById('tourCode').value||'').trim().toUpperCase() || randomCode(6,'T');
  if(Object.values(tcData.tournaments).some(t=>t.code===code)){
    setAdminStatus('Mã giải đã tồn tại.', 'err'); return;
  }
  const id = 'tn_'+Date.now().toString(36);
  const row = {
    id, code, name,
    start: document.getElementById('tourStart').value || '',
    end: document.getElementById('tourEnd').value || '',
    format: document.getElementById('tourFormat').value,
    maxPlayers: +document.getElementById('tourMaxPlayers').value || 32,
    timeControl: +document.getElementById('tourTimeControl').value || 15,
    status: document.getElementById('tourStatus').value,
    desc: (document.getElementById('tourDesc').value||'').trim(),
    createdAt: Date.now()
  };
  try{
    await tcSet('tournaments/'+id, row);
    tcData.tournaments[id] = row;
    document.getElementById('tourName').value = '';
    document.getElementById('tourCode').value = '';
    document.getElementById('tourDesc').value = '';
    setAdminStatus('Đã tạo giải «'+name+'» ('+code+') trên Firebase.', 'ok');
    renderTournamentList();
    fillTournamentSelects();
    updateDashboardStats();
  }catch(err){
    setAdminStatus('Tạo giải thất bại: '+(err.message||err), 'err');
  }
}

async function deleteTournament(id){
  if(!confirm('Xóa giải đấu này và các trận liên quan trên Firebase?')) return;
  try{
    await tcRemove('tournaments/'+id);
    delete tcData.tournaments[id];
    const matchIds = Object.keys(tcData.matches).filter(mid => tcData.matches[mid].tournamentId===id);
    await Promise.all(matchIds.map(mid => tcRemove('matches/'+mid).then(()=> delete tcData.matches[mid])));
    await tcRemove('groups/'+id);
    delete tcData.groups[id];
    renderTournamentList();
    fillTournamentSelects();
    updateDashboardStats();
    setAdminStatus('Đã xóa giải đấu trên Firebase.', 'ok');
  }catch(err){
    setAdminStatus('Xóa giải thất bại: '+(err.message||err), 'err');
  }
}

function renderTournamentList(){
  const box = document.getElementById('tourList');
  if(!box) return;
  const list = Object.values(tcData.tournaments).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  if(!list.length){ box.innerHTML = '<div class="admin-empty">Chưa có giải đấu nào.</div>'; return; }
  box.innerHTML = '';
  list.forEach(t=>{
    const players = Object.values(tcData.players).filter(p=>p.tournamentId===t.id).length;
    const matches = Object.values(tcData.matches).filter(m=>m.tournamentId===t.id).length;
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML =
      '<div class="admin-item-main">'+
        '<div class="admin-item-code">'+t.code+
          '<span class="admin-item-badge '+(t.status==='ongoing'?'live':t.status==='finished'?'expired':'idle')+'">'+formatStatus(t.status)+'</span>'+
        '</div>'+
        '<div class="admin-item-meta">'+t.name+' · '+formatFmt(t.format)+
          '<br>'+players+' kỳ thủ · '+matches+' trận · TG '+t.timeControl+'′'+
          (t.start?' · '+t.start:'')+(t.end?' → '+t.end:'')+
        '</div>'+
      '</div>'+
      '<div class="admin-item-actions">'+
        '<button class="action-btn cheat-danger tc-del-tn" data-id="'+t.id+'"><i class="fa-regular fa-trash"></i></button>'+
      '</div>';
    box.appendChild(div);
  });
  box.querySelectorAll('.tc-del-tn').forEach(b=> b.addEventListener('click', ()=> deleteTournament(b.dataset.id)));
}

/* ---- Players ---- */
async function createPlayer(){
  const name = (document.getElementById('playerName').value||'').trim();
  if(!name){ setAdminStatus('Nhập họ tên kỳ thủ.', 'err'); return; }
  let code = (document.getElementById('playerCode').value||'').trim().toUpperCase() || randomCode(4,'P');
  if(Object.values(tcData.players).some(p=>p.code===code)){
    setAdminStatus('Mã kỳ thủ đã tồn tại.', 'err'); return;
  }
  const customPwd = (document.getElementById('playerPassword').value||'').trim();
  const pwd = customPwd || randomCode(6,'').toLowerCase();
  const id = 'pl_'+Date.now().toString(36);
  const role = document.getElementById('playerRole').value || 'player';
  if(isProtectedRole(role) && !isAdminUnlocked()){
    setAdminStatus('Chỉ Admin website mới được tạo tài khoản admin / admin chính.', 'err');
    return;
  }
  const pwdHash = await sha256Hex(pwd);
  const row = {
    id, code, name,
    nick: (document.getElementById('playerNick').value||'').trim(),
    elo: +document.getElementById('playerElo').value || 1500,
    club: (document.getElementById('playerClub').value||'').trim(),
    tournamentId: document.getElementById('playerTournament').value || '',
    role,
    passwordHash: pwdHash,
    createdAt: Date.now()
  };
  try{
    await tcSet('players/'+id, row);
    tcData.players[id] = row;
    clearPlayerForm();
    setAdminStatus('Đã tạo '+name+' · '+code+' · role '+row.role+' · MK (chỉ hiện 1 lần): '+pwd, 'ok');
    renderPlayerList();
    updateDashboardStats();
  }catch(err){
    setAdminStatus('Tạo kỳ thủ thất bại: '+(err.message||err), 'err');
  }
}

function clearPlayerForm(){
  ['playerName','playerNick','playerCode','playerClub','playerPassword'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('playerEditId').value = '';
  document.getElementById('playerElo').value = 1500;
  document.getElementById('playerRole').value = 'player';
  document.getElementById('playerCreateBtn').style.display = '';
  document.getElementById('playerUpdateBtn').style.display = 'none';
  document.getElementById('playerCancelEditBtn').style.display = 'none';
}

function startEditPlayer(id){
  const p = tcData.players[id];
  if(!p) return;
  document.getElementById('playerEditId').value = id;
  document.getElementById('playerName').value = p.name || '';
  document.getElementById('playerNick').value = p.nick || '';
  document.getElementById('playerCode').value = p.code || '';
  document.getElementById('playerElo').value = p.elo || 1500;
  document.getElementById('playerClub').value = p.club || '';
  document.getElementById('playerTournament').value = p.tournamentId || '';
  document.getElementById('playerRole').value = p.role || 'player';
  document.getElementById('playerPassword').value = '';
  document.getElementById('playerCreateBtn').style.display = 'none';
  document.getElementById('playerUpdateBtn').style.display = '';
  document.getElementById('playerCancelEditBtn').style.display = '';
  setAdminStatus('Đang sửa '+p.code+' — đổi xong bấm Lưu chỉnh sửa.', 'ok');
}

async function updatePlayer(){
  const id = document.getElementById('playerEditId').value;
  if(!id || !tcData.players[id]){ setAdminStatus('Không có bản ghi đang sửa.', 'err'); return; }
  const name = (document.getElementById('playerName').value||'').trim();
  if(!name){ setAdminStatus('Nhập họ tên.', 'err'); return; }
  const code = (document.getElementById('playerCode').value||'').trim().toUpperCase();
  const newRole = document.getElementById('playerRole').value || 'player';
  const oldRole = (tcData.players[id] && tcData.players[id].role) || 'player';
  if(!canAssignRole(newRole, oldRole)){
    setAdminStatus('Không đủ quyền gán/hạ role admin. Cần đăng nhập Admin website.', 'err');
    return;
  }
  if(oldRole === 'superadmin' && newRole !== 'superadmin' && countSuperadmins() <= 1){
    setAdminStatus('Không thể hạ Admin chính duy nhất — cần giữ ít nhất 1 superadmin.', 'err');
    return;
  }
  const patch = {
    name, code,
    nick: (document.getElementById('playerNick').value||'').trim(),
    elo: +document.getElementById('playerElo').value || 1500,
    club: (document.getElementById('playerClub').value||'').trim(),
    tournamentId: document.getElementById('playerTournament').value || '',
    role: newRole
  };
  const newPwd = (document.getElementById('playerPassword').value||'').trim();
  if(newPwd){
    if(newPwd.length < 4){ setAdminStatus('Mật khẩu tối thiểu 4 ký tự.', 'err'); return; }
    patch.passwordHash = await sha256Hex(newPwd);
    patch.password = null; // xóa plaintext cũ nếu có
  }
  if(Object.values(tcData.players).some(p => p.id !== id && (p.code||'').toUpperCase() === code)){
    setAdminStatus('Mã kỳ thủ đã tồn tại.', 'err'); return;
  }
  try{
    await tcUpdate('players/'+id, patch);
    Object.assign(tcData.players[id], patch);
    if(patch.passwordHash) delete tcData.players[id].password;
    clearPlayerForm();
    setAdminStatus('Đã cập nhật kỳ thủ trên Firebase.', 'ok');
    renderPlayerList();
  }catch(err){
    setAdminStatus('Cập nhật thất bại: '+(err.message||err), 'err');
  }
}

async function generateBulkPlayers(){
  const tnId = document.getElementById('playerTournament').value;
  const role = document.getElementById('playerRole').value || 'player';
  const n = prompt('Số kỳ thủ cần sinh hàng loạt?', '8');
  const count = Math.min(64, Math.max(1, parseInt(n,10)||0));
  if(!count) return;
  const created = [];
  const writes = [];
  for(let i=0;i<count;i++){
    const code = randomCode(4,'P');
    const pwd = randomCode(6,'').toLowerCase();
    const id = 'pl_'+Date.now().toString(36)+'_'+i;
    const pwdHash = await sha256Hex(pwd);
    const row = {
      id, code, name: 'Kỳ thủ '+code, nick: code, elo: 1400+Math.floor(Math.random()*200),
      club: '', tournamentId: tnId||'', role, passwordHash: pwdHash, createdAt: Date.now()
    };
    tcData.players[id] = row;
    writes.push(tcSet('players/'+id, row));
    created.push(code+':'+pwd);
  }
  try{
    await Promise.all(writes);
    setAdminStatus('Đã sinh '+count+' tài khoản. Mã:MK → '+created.slice(0,5).join(', ')+(created.length>5?'…':''), 'ok');
    renderPlayerList();
    updateDashboardStats();
  }catch(err){
    setAdminStatus('Sinh hàng loạt thất bại: '+(err.message||err), 'err');
  }
}

async function deletePlayer(id){
  const p = tcData.players[id];
  if(p && p.role === 'superadmin'){
    if(countSuperadmins() <= 1){
      setAdminStatus('Không thể xóa Admin chính duy nhất.', 'err');
      return;
    }
    if(!isAdminUnlocked()){
      setAdminStatus('Chỉ Admin website mới được xóa tài khoản Admin chính.', 'err');
      return;
    }
    if(!confirm('Xóa Admin chính «'+(p.code||id)+'»?')) return;
  } else if(!confirm('Xóa kỳ thủ này trên Firebase?')) return;
  try{
    await tcRemove('players/'+id);
    delete tcData.players[id];
    renderPlayerList();
    updateDashboardStats();
  }catch(err){
    setAdminStatus('Xóa kỳ thủ thất bại: '+(err.message||err), 'err');
  }
}

function roleLabel(r){
  return ({
    player: 'Tuyển thủ',
    vip: 'VIP',
    mod: 'Mod',
    caster: 'Caster',
    admin: 'Admin phụ',
    superadmin: 'Admin chính'
  })[r] || r || 'player';
}

/** Các role nhạy cảm — chỉ session Admin website mới được gán/hạ. */
const PROTECTED_ROLES = ['admin', 'superadmin'];
function isProtectedRole(role){
  return PROTECTED_ROLES.includes(role || '');
}

/** Kiểm tra được phép gán role mới (và hạ role cũ nếu cần). */
function canAssignRole(newRole, oldRole){
  if(!isAdminUnlocked()){
    if(isProtectedRole(newRole) || isProtectedRole(oldRole)) return false;
  }
  return true;
}

function countSuperadmins(){
  return Object.values(tcData.players || {}).filter(p => (p.role || '') === 'superadmin').length;
}

function renderPlayerList(){
  const box = document.getElementById('playerList');
  if(!box) return;
  const list = Object.values(tcData.players).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  const badge = document.getElementById('playerCountBadge');
  if(badge) badge.textContent = list.length;
  if(!list.length){ box.innerHTML = '<div class="admin-empty">Chưa có kỳ thủ.</div>'; return; }
  box.innerHTML = '';
  list.forEach(p=>{
    const tn = tcData.tournaments[p.tournamentId];
    const role = p.role || 'player';
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML =
      '<div class="admin-item-main">'+
        '<div class="admin-item-code">'+p.code+
          '<span class="role-badge '+role+'">'+roleLabel(role)+'</span>'+
        '</div>'+
        '<div class="admin-item-meta">'+p.name+(p.nick?' («'+p.nick+'»)':'')+
          ' · Elo '+p.elo+(p.club?' · '+p.club:'')+
          (tn?' · '+tn.code:'')+
          '<br>MK: <code>'+(p.password || (p.passwordHash ? '•••••• (đã mã hoá)' : '—'))+'</code>'+
        '</div>'+
      '</div>'+
      '<div class="admin-item-actions">'+
        '<button class="action-btn tc-edit-pl" data-id="'+p.id+'"><i class="fa-regular fa-pen"></i></button>'+
        '<button class="action-btn cheat-danger tc-del-pl" data-id="'+p.id+'"><i class="fa-regular fa-trash"></i></button>'+
      '</div>';
    box.appendChild(div);
  });
  box.querySelectorAll('.tc-del-pl').forEach(b=> b.addEventListener('click', ()=> deletePlayer(b.dataset.id)));
  box.querySelectorAll('.tc-edit-pl').forEach(b=> b.addEventListener('click', ()=> startEditPlayer(b.dataset.id)));
}

/* ---- Bracket ---- */
async function generateBracket(){
  const tnId = document.getElementById('bracketTournament').value;
  if(!tnId || !tcData.tournaments[tnId]){ setAdminStatus('Chọn giải đấu.', 'err'); return; }
  const players = Object.values(tcData.players).filter(p=>p.tournamentId===tnId);
  if(players.length < 2){ setAdminStatus('Cần ít nhất 2 kỳ thủ trong giải.', 'err'); return; }
  try{
    const oldIds = Object.keys(tcData.matches).filter(mid => tcData.matches[mid].tournamentId===tnId);
    await Promise.all(oldIds.map(mid => tcRemove('matches/'+mid)));
    oldIds.forEach(mid => delete tcData.matches[mid]);

    const seeded = players.slice().sort((a,b)=> (b.elo||0)-(a.elo||0));
    const n = seeded.length;
    let size = 1; while(size < n) size *= 2;
    const slots = [];
    for(let i=0;i<size;i++) slots.push(seeded[i] || null);
    const tables = +document.getElementById('bracketTables').value || 8;
    const writes = [];
    const roundMatches = [];
    for(let i=0;i<size/2;i++){
      const a = slots[i];
      const b = slots[size-1-i];
      const mid = 'm_'+tnId+'_r1_'+i;
      const row = {
        id: mid, tournamentId: tnId, round: 1, index: i,
        red: a ? a.id : null, black: b ? b.id : null,
        redName: a ? a.name : 'BYE', blackName: b ? b.name : 'BYE',
        roomCode: '', status: (!a || !b) ? 'finished' : 'pending',
        winner: !a ? (b?b.id:null) : (!b ? (a?a.id:null) : null),
        table: (i % tables) + 1
      };
      tcData.matches[mid] = row;
      writes.push(tcSet('matches/'+mid, row));
      roundMatches.push(mid);
    }
    await Promise.all(writes);
    setAdminStatus('Đã sinh nhánh trên Firebase: '+roundMatches.length+' trận vòng 1 ('+n+' kỳ thủ, bracket '+size+').', 'ok');
    renderBracketList();
    updateDashboardStats();
  }catch(err){
    setAdminStatus('Sinh nhánh thất bại: '+(err.message||err), 'err');
  }
}

async function clearBracket(){
  const tnId = document.getElementById('bracketTournament').value;
  if(!tnId) return;
  if(!confirm('Xóa toàn bộ nhánh của giải này trên Firebase?')) return;
  try{
    const ids = Object.keys(tcData.matches).filter(mid => tcData.matches[mid].tournamentId===tnId);
    await Promise.all(ids.map(mid => tcRemove('matches/'+mid)));
    ids.forEach(mid => delete tcData.matches[mid]);
    renderBracketList();
    updateDashboardStats();
    setAdminStatus('Đã xóa nhánh trên Firebase.', 'ok');
  }catch(err){
    setAdminStatus('Xóa nhánh thất bại: '+(err.message||err), 'err');
  }
}

function renderBracketList(){
  const box = document.getElementById('bracketList');
  if(!box) return;
  const tnId = document.getElementById('bracketTournament')?.value;
  let list = Object.values(tcData.matches);
  if(tnId) list = list.filter(m=>m.tournamentId===tnId);
  list.sort((a,b)=> (a.round-b.round) || (a.index-b.index));
  if(!list.length){ box.innerHTML = '<div class="admin-empty">Chưa có trận.</div>'; return; }
  box.innerHTML = '';
  list.forEach(m=>{
    const stCls = m.status==='playing'?'live':m.status==='finished'?'expired':'idle';
    const stLabel = m.status==='playing'?'Đang đấu':m.status==='finished'?'Xong':'Chờ';
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML =
      '<div class="admin-item-main">'+
        '<div class="admin-item-code">'+m.id+
          '<span class="admin-item-badge '+stCls+'">'+stLabel+'</span>'+
        '</div>'+
        '<div class="admin-item-meta">V'+m.round+' · Bàn '+m.table+
          ' · <span class="side-red">'+m.redName+'</span> vs <span class="side-black">'+m.blackName+'</span>'+
          (m.roomCode?' · Phòng <b>'+m.roomCode+'</b>':'')+
          (m.winner?' · Thắng: '+(m.winner===m.red?m.redName:m.blackName):'')+
        '</div>'+
      '</div>'+
      (m.roomCode
        ? '<div class="admin-item-actions">'+
            '<button type="button" class="action-btn bracket-watch-btn" data-room="'+m.roomCode+'" title="Xem trực tiếp">'+
              '<i class="fa-regular fa-eye"></i> Xem</button>'+
          '</div>'
        : '');
    box.appendChild(div);
  });
  box.querySelectorAll('.bracket-watch-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> adminWatchRoom(btn.getAttribute('data-room')));
  });
}

/** Tạo node rooms/{code} chuẩn cho giải (chưa ai ngồi). */
async function ensureTournamentRoom(code, match){
  await adminEnsureFb();
  const ref = fb.db.ref('rooms/'+code);
  const snap = await ref.once('value');
  if(snap.val()) return false; // đã có
  const board = boardToPlain(initialBoard());
  await ref.set({
    boardJSON: JSON.stringify(board),
    turn: 'red',
    lastMoveJSON: 'null',
    version: 1,
    gameOver: false,
    createdAt: Date.now(),
    matchId: match ? match.id : null,
    tournamentId: match ? match.tournamentId : null,
    seats: {}
  });
  return true;
}

async function assignMatchRoom(){
  const mid = (document.getElementById('matchAssignId').value||'').trim();
  const room = (document.getElementById('matchRoomCode').value||'').trim().toUpperCase();
  const m = tcData.matches[mid] || Object.values(tcData.matches).find(x=>x.id===mid);
  if(!m){ setAdminStatus('Không tìm thấy trận.', 'err'); return; }
  if(!room){ setAdminStatus('Nhập mã phòng.', 'err'); return; }
  try{
    const created = await ensureTournamentRoom(room, m);
    m.roomCode = room;
    await tcUpdate('matches/'+m.id, { roomCode: room });
    setAdminStatus(
      (created ? 'Đã tạo & gán phòng ' : 'Đã gán phòng có sẵn ')+room+' cho trận '+m.id,
      'ok'
    );
    renderBracketList();
  }catch(err){
    setAdminStatus('Gán phòng thất bại: '+(err.message||err), 'err');
  }
}

async function createAndAssignRoom(){
  const mid = (document.getElementById('matchAssignId').value||'').trim();
  const m = tcData.matches[mid] || Object.values(tcData.matches).find(x=>x.id===mid);
  if(!m){ setAdminStatus('Không tìm thấy trận.', 'err'); return; }
  try{
    await adminEnsureFb();
    const code = randomCode(5,'');
    await ensureTournamentRoom(code, m);
    const check = await fb.db.ref('rooms/'+code).once('value');
    if(!check.val()) throw new Error('Firebase không lưu được rooms/'+code);
    m.roomCode = code;
    m.status = 'pending';
    await tcUpdate('matches/'+m.id, { roomCode: code, status: 'pending' });
    document.getElementById('matchRoomCode').value = code;
    setAdminStatus('Đã tạo phòng '+code+' và gán cho '+m.id, 'ok');
    renderBracketList();
  }catch(err){
    setAdminStatus('Tạo phòng thất bại: '+(err.message||err), 'err');
  }
}

/* ---- Referee ---- */
async function refLog(action, target, note){
  const entry = { ts: Date.now(), action, target, note: note||'', by: 'admin' };
  try{
    const ref = await tcPush('admin/refLog', entry);
    entry._key = ref.key;
    tcData.refLog.unshift(entry);
    if(tcData.refLog.length > 100) tcData.refLog.length = 100;
    renderRefLog();
  }catch(err){
    console.warn('refLog push failed', err);
    tcData.refLog.unshift(entry);
    renderRefLog();
  }
}

async function refCommand(action){
  const target = (document.getElementById('refTarget').value||'').trim().toUpperCase();
  const note = (document.getElementById('refNote').value||'').trim();
  if(!target){ setAdminStatus('Nhập mã phòng hoặc mã trận.', 'err'); return; }
  let roomCode = target;
  const match = tcData.matches[target] || Object.values(tcData.matches).find(m=>m.id===target || m.roomCode===target);
  if(match && match.roomCode) roomCode = match.roomCode;

  try{
    await adminEnsureFb();
    const ref = fb.db.ref('rooms/'+roomCode);
    const snap = await ref.once('value');
    if(!snap.val()){ setAdminStatus('Không tìm thấy phòng '+roomCode, 'err'); return; }

    const payload = { referee: { action, note, ts: Date.now() } };
    if(action === 'pause') payload.paused = true;
    if(action === 'resume') payload.paused = false;
    if(action === 'force_draw'){ payload.gameOver = true; payload.result = 'draw'; }
    if(action === 'red_win'){ payload.gameOver = true; payload.result = 'red'; }
    if(action === 'black_win'){ payload.gameOver = true; payload.result = 'black'; }
    if(action === 'reset'){
      payload.boardJSON = JSON.stringify(boardToPlain ? boardToPlain(initialBoard()) : []);
      payload.turn = 'red';
      payload.gameOver = false;
      payload.result = null;
      payload.paused = false;
    }
    if(action === 'message'){
      payload.chat = null; // will push below
      await ref.child('chat').push({ color:'spectator', text:'[TRỌNG TÀI] '+(note||'Thông báo'), ts: Date.now() });
    } else {
      await ref.update(payload);
    }
    if(match){
      if(action==='red_win'){ match.status='finished'; match.winner=match.red; }
      if(action==='black_win'){ match.status='finished'; match.winner=match.black; }
      if(action==='force_draw'){ match.status='finished'; match.winner=null; }
      if(action==='resume' || action==='pause') match.status = action==='pause' ? 'paused' : 'playing';
      try{
        await tcUpdate('matches/'+match.id, {
          status: match.status,
          winner: match.winner == null ? null : match.winner
        });
      }catch(e){ console.warn('match update failed', e); }
    }
    await refLog(action, roomCode, note);
    setAdminStatus('Đã gửi lệnh «'+action+'» tới phòng '+roomCode, 'ok');
  }catch(err){
    setAdminStatus('Lệnh thất bại: '+(err.message||err), 'err');
  }
}

function renderRefLog(){
  const box = document.getElementById('refLogList');
  if(!box) return;
  if(!tcData.refLog.length){ box.innerHTML = '<div class="admin-empty">Chưa có lệnh nào.</div>'; return; }
  box.innerHTML = '';
  tcData.refLog.slice(0,40).forEach(e=>{
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+e.action+
      '</div><div class="admin-item-meta">'+formatTime(e.ts)+' · '+e.target+(e.note?' · '+e.note:'')+'</div></div>';
    box.appendChild(div);
  });
}

/* ---- Groups / Format ---- */
async function generateGroups(){
  const tnId = document.getElementById('groupTournament').value;
  if(!tnId){ setAdminStatus('Chọn giải.', 'err'); return; }
  const nGroups = Math.max(1, +document.getElementById('groupCount').value || 4);
  const method = document.getElementById('groupMethod').value;
  let players = Object.values(tcData.players).filter(p=>p.tournamentId===tnId);
  if(players.length < nGroups){ setAdminStatus('Không đủ kỳ thủ để chia '+nGroups+' bảng.', 'err'); return; }
  if(method === 'elo') players = players.slice().sort((a,b)=> (b.elo||0)-(a.elo||0));
  else if(method === 'random') players = players.slice().sort(()=> Math.random()-0.5);

  const groups = {};
  for(let g=0;g<nGroups;g++) groups[String.fromCharCode(65+g)] = [];
  let gi = 0, dir = 1;
  players.forEach(p=>{
    const key = String.fromCharCode(65+gi);
    groups[key].push({ id:p.id, name:p.name, code:p.code, elo:p.elo });
    gi += dir;
    if(gi >= nGroups){ gi = nGroups-1; dir = -1; }
    if(gi < 0){ gi = 0; dir = 1; }
  });
  const row = { method, groups, createdAt: Date.now() };
  try{
    await tcSet('groups/'+tnId, row);
    tcData.groups[tnId] = row;
    setAdminStatus('Đã chia '+nGroups+' bảng trên Firebase ('+method+').', 'ok');
    renderGroups();
  }catch(err){
    setAdminStatus('Chia bảng thất bại: '+(err.message||err), 'err');
  }
}

async function clearGroups(){
  const tnId = document.getElementById('groupTournament').value;
  if(!tnId) return;
  try{
    await tcRemove('groups/'+tnId);
    delete tcData.groups[tnId];
    renderGroups();
    setAdminStatus('Đã xóa bảng trên Firebase.', 'ok');
  }catch(err){
    setAdminStatus('Xóa bảng thất bại: '+(err.message||err), 'err');
  }
}

/* renderGroups: dùng bản nâng cao (có BXH) bên dưới */

async function saveFormatConfig(){
  const tnId = document.getElementById('groupTournament').value;
  if(!tnId || !tcData.tournaments[tnId]){ setAdminStatus('Chọn giải.', 'err'); return; }
  const patch = {
    swissRounds: +document.getElementById('swissRounds').value || 5,
    knockoutTop: +document.getElementById('knockoutTop').value || 8,
    scoreScheme: document.getElementById('scoreScheme').value || '1 / 0.5 / 0'
  };
  try{
    await tcUpdate('tournaments/'+tnId, patch);
    Object.assign(tcData.tournaments[tnId], patch);
    setAdminStatus('Đã lưu cấu hình thể thức trên Firebase.', 'ok');
  }catch(err){
    setAdminStatus('Lưu thể thức thất bại: '+(err.message||err), 'err');
  }
}

/* ---- Live monitor ---- */
/* renderLiveMonitor: dùng bản async (grid + anomaly) bên dưới */

function toggleLiveAutoRefresh(){
  const btn = document.getElementById('liveAutoRefreshBtn');
  if(liveAutoTimer){
    clearInterval(liveAutoTimer); liveAutoTimer = null;
    btn.innerHTML = '<i class="fa-regular fa-clock"></i> Tự làm mới: Tắt';
    return;
  }
  liveAutoTimer = setInterval(()=> renderLiveMonitor(), 8000);
  btn.innerHTML = '<i class="fa-regular fa-clock"></i> Tự làm mới: Bật';
}

/* ---- Broadcast ---- */
function loadBroadcastForm(){
  const b = tcData.broadcast || {};
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
  set('bcFeatured', b.featured);
  set('bcTitle', b.title);
  set('bcStreamUrl', b.streamUrl);
  set('bcSpectatorMode', b.spectatorMode||'open');
  set('bcTicker', b.ticker);
  updateBcShareLink();
}

async function saveBroadcast(){
  const row = {
    featured: (document.getElementById('bcFeatured').value||'').trim(),
    title: (document.getElementById('bcTitle').value||'').trim(),
    streamUrl: (document.getElementById('bcStreamUrl').value||'').trim(),
    spectatorMode: document.getElementById('bcSpectatorMode').value,
    ticker: (document.getElementById('bcTicker').value||'').trim()
  };
  try{
    await tcSet('admin/broadcast', row);
    tcData.broadcast = row;
    updateBcShareLink();
    setAdminStatus('Đã lưu cấu hình phát sóng trên Firebase.', 'ok');
  }catch(err){
    setAdminStatus('Lưu phát sóng thất bại: '+(err.message||err), 'err');
  }
}

function updateBcShareLink(){
  const featured = (document.getElementById('bcFeatured')?.value||tcData.broadcast.featured||'').trim();
  const input = document.getElementById('bcShareLink');
  if(!input) return;
  if(!featured){ input.value = ''; return; }
  const url = location.origin + location.pathname + '?room=' + encodeURIComponent(featured);
  input.value = url;
}

async function pushTicker(){
  const text = (document.getElementById('bcTicker').value||'').trim();
  if(!text){ setAdminStatus('Nhập nội dung thông báo.', 'err'); return; }
  const entry = { ts: Date.now(), text };
  try{
    const ref = await tcPush('admin/bcLog', entry);
    entry._key = ref.key;
    tcData.bcLog.unshift(entry);
    if(tcData.bcLog.length > 50) tcData.bcLog.length = 50;
    tcData.broadcast.ticker = text;
    await tcUpdate('admin/broadcast', { ticker: text });
    renderBcLog();
    setAdminStatus('Đã đẩy thông báo lên Firebase.', 'ok');
  }catch(err){
    setAdminStatus('Đẩy thông báo thất bại: '+(err.message||err), 'err');
  }
}

function renderBcLog(){
  const box = document.getElementById('bcLogList');
  if(!box) return;
  if(!tcData.bcLog.length){ box.innerHTML = '<div class="admin-empty">Chưa có thông báo.</div>'; return; }
  box.innerHTML = '';
  tcData.bcLog.slice(0,20).forEach(e=>{
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = '<div class="admin-item-main"><div class="admin-item-meta">'+formatTime(e.ts)+' — '+e.text+'</div></div>';
    box.appendChild(div);
  });
}

function copyBcLink(){
  const input = document.getElementById('bcShareLink');
  if(!input || !input.value) return;
  input.select();
  try{ navigator.clipboard.writeText(input.value); setAdminStatus('Đã copy link.', 'ok'); }
  catch(e){ setAdminStatus('Copy thủ công: Ctrl+C', 'err'); }
}

async function wipeTournamentData(){
  if(!confirm('Xóa toàn bộ GIẢI ĐẤU + trận + bảng + log trên Firebase?\n\nKỳ thủ (players) sẽ ĐƯỢC GIỮ LẠI.')) return;
  if(!confirm('Xác nhận lần cuối — không hoàn tác được? (Kỳ thủ vẫn còn)')) return;
  try{
    await Promise.all([
      tcRemove('tournaments'),
      tcRemove('matches'),
      tcRemove('groups'),
      tcRemove('admin/refLog'),
      tcRemove('admin/bcLog'),
      tcRemove('admin/broadcast')
    ]);
    const keptPlayers = tcData.players || {};
    tcData = {
      tournaments: {},
      players: keptPlayers,
      matches: {},
      groups: {},
      refLog: [],
      broadcast: { featured:'', title:'', streamUrl:'', spectatorMode:'open', ticker:'' },
      bcLog: []
    };
    updateDashboardStats();
    renderTournamentList();
    renderPlayerList();
    renderBracketList();
    renderGroups();
    renderRefLog();
    renderBcLog();
    if(typeof renderRoleManager === 'function') renderRoleManager();
    setAdminStatus('Đã xóa giải/trận/bảng/log. Kỳ thủ vẫn giữ ('+Object.keys(keptPlayers).length+' tài khoản).', 'ok');
  }catch(err){
    setAdminStatus('Xóa thất bại: '+(err.message||err), 'err');
  }
}

/* ---- Wire admin UI ---- */

document.getElementById('adminLoginBtn').addEventListener('click', tryAdminLogin);
document.getElementById('adminPasswordInput').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') tryAdminLogin();
});
document.getElementById('adminOpenPanelBtn')?.addEventListener('click', ()=>{
  if(!isAdminUnlocked()){ updateAdminMenuUI(); setAdminLoginStatus('Phiên đã hết hạn. Đăng nhập lại.', true); return; }
  openAdminPanel();
  closeDrawer();
});
document.getElementById('adminMenuLogoutBtn')?.addEventListener('click', ()=>{
  adminLogout();
});
document.getElementById('adminCloseBtn').addEventListener('click', closeAdminPanel);
document.getElementById('adminRefreshBtn').addEventListener('click', async ()=>{
  await adminLoadData();
  await tcLoad();
  updateDashboardStats();
  renderTournamentList();
  renderPlayerList();
  renderBracketList();
  renderGroups();
  renderRefLog();
  renderBcLog();
  setAdminStatus('Đã làm mới toàn bộ từ Firebase.', 'ok');
});
document.getElementById('adminSweepBtn').addEventListener('click', adminSweepExpired);
document.getElementById('adminDeleteAllRoomsBtn').addEventListener('click', adminDeleteAllRooms);
document.getElementById('adminDeleteAllSavesBtn').addEventListener('click', adminDeleteAllSaves);
document.getElementById('adminSavePwdBtn').addEventListener('click', saveNewAdminPassword);
document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);
document.getElementById('adminNewPwd2').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') saveNewAdminPassword();
});

document.querySelectorAll('.admin-nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> switchAdminSection(btn.dataset.section));
});

document.getElementById('tourCreateBtn').addEventListener('click', createTournament);
document.getElementById('playerCreateBtn').addEventListener('click', createPlayer);
document.getElementById('playerGenAccountsBtn').addEventListener('click', generateBulkPlayers);
document.getElementById('bracketGenerateBtn').addEventListener('click', generateBracket);
document.getElementById('bracketClearBtn').addEventListener('click', clearBracket);
document.getElementById('bracketTournament').addEventListener('change', renderBracketList);
document.getElementById('matchAssignBtn').addEventListener('click', assignMatchRoom);
document.getElementById('matchCreateRoomBtn').addEventListener('click', createAndAssignRoom);

document.getElementById('refPauseBtn').addEventListener('click', ()=> refCommand('pause'));
document.getElementById('refResumeBtn').addEventListener('click', ()=> refCommand('resume'));
document.getElementById('refForceDrawBtn').addEventListener('click', ()=> refCommand('force_draw'));
document.getElementById('refRedWinBtn').addEventListener('click', ()=> refCommand('red_win'));
document.getElementById('refBlackWinBtn').addEventListener('click', ()=> refCommand('black_win'));
document.getElementById('refResetBoardBtn').addEventListener('click', ()=> refCommand('reset'));
document.getElementById('refMessageBtn').addEventListener('click', ()=> refCommand('message'));

document.getElementById('groupGenerateBtn').addEventListener('click', generateGroups);
document.getElementById('groupClearBtn').addEventListener('click', clearGroups);
document.getElementById('groupTournament').addEventListener('change', renderGroups);
document.getElementById('formatSaveBtn').addEventListener('click', saveFormatConfig);

document.getElementById('liveRefreshBtn').addEventListener('click', renderLiveMonitor);
document.getElementById('adminWatchBtn')?.addEventListener('click', ()=> adminWatchRoom());
document.getElementById('adminWatchCode')?.addEventListener('keydown', e=>{ if(e.key==='Enter') adminWatchRoom(); });
document.getElementById('liveAutoRefreshBtn').addEventListener('click', toggleLiveAutoRefresh);

document.getElementById('bcSaveBtn').addEventListener('click', saveBroadcast);
document.getElementById('bcPushTickerBtn').addEventListener('click', pushTicker);
document.getElementById('bcCopyLinkBtn').addEventListener('click', copyBcLink);
document.getElementById('bcFeatured').addEventListener('input', updateBcShareLink);
document.getElementById('adminWipeTournamentBtn').addEventListener('click', wipeTournamentData);

document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    const ov = document.getElementById('adminOverlay');
    if(ov && ov.classList.contains('show')) closeAdminPanel();
  }
});

/* ===== Player login session ===== */
const PLAYER_SESSION_KEY = 'co-tuong-player-session';
let playerSession = null;

function loadPlayerSession(){
  try{
    const raw = sessionStorage.getItem(PLAYER_SESSION_KEY);
    playerSession = raw ? JSON.parse(raw) : null;
  }catch(e){ playerSession = null; }
  renderPlayerSessionUI();
}
function savePlayerSession(s){
  playerSession = s;
  try{ loadCoinStateFromPlayer(); }catch(e){}
  try{
    if(s) sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(PLAYER_SESSION_KEY);
  }catch(e){}
  renderPlayerSessionUI();
}
function renderPlayerSessionUI(){
  const idle = document.getElementById('playerLoginIdle');
  const active = document.getElementById('playerLoginActive');
  if(!idle || !active) return;
  if(playerSession && playerSession.code){
    idle.style.display = 'none';
    active.style.display = '';
    document.getElementById('playerSessionName').textContent =
      (playerSession.name || playerSession.code) + (playerSession.role && playerSession.role!=='player' ? ' · '+roleLabel(playerSession.role) : '');
    document.getElementById('playerSessionMeta').textContent =
      'ID '+playerSession.code + (playerSession.tnCode ? ' · Giải '+playerSession.tnCode : '') +
      (playerSession.role ? ' · '+roleLabel(playerSession.role) : '');
  } else {
    idle.style.display = '';
    active.style.display = 'none';
  }
}

async function tryPlayerLogin(){
  const tnCode = (document.getElementById('playerLoginTnCode').value||'').trim().toUpperCase();
  const pid = (document.getElementById('playerLoginId').value||'').trim().toUpperCase();
  const pwd = (document.getElementById('playerLoginPwd').value||'');
  const st = document.getElementById('playerLoginStatus');
  const setSt = (m, warn)=>{ if(st){ st.textContent=m; st.className='online-status'+(warn?' warn': m?' live':''); } };
  if(!pid || !pwd){ setSt('Nhập ID kỳ thủ và mật khẩu.', true); return; }
  try{
    await tcEnsureFb();
    const [plSnap, tnSnap] = await Promise.all([
      fb.db.ref('players').once('value'),
      fb.db.ref('tournaments').once('value')
    ]);
    const players = plSnap.val() || {};
    const tournaments = tnSnap.val() || {};

    let tn = null;
    if(tnCode){
      tn = Object.values(tournaments).find(t => (t.code||'').toUpperCase() === tnCode);
      if(!tn){ setSt('Không tìm thấy mã giải «'+tnCode+'».', true); return; }
    }

    const candidates = Object.values(players).filter(p => (p.code||'').toUpperCase() === pid);
    let player = null;
    const pwdHash = await sha256Hex(pwd);
    for(const p of candidates){
      if(tn && p.tournamentId && p.tournamentId !== tn.id) continue;
      const okHash = p.passwordHash && p.passwordHash === pwdHash;
      const okPlain = p.password && p.password === pwd; // tương thích tài khoản cũ
      if(okHash || okPlain){ player = p; break; }
    }
    if(!player){
      setSt(tnCode ? 'Sai ID/mật khẩu hoặc không thuộc giải này.' : 'Sai ID hoặc mật khẩu.', true);
      return;
    }
    if(player.password && !player.passwordHash){
      try{
        await tcUpdate('players/'+player.id, { passwordHash: pwdHash, password: null });
        player.passwordHash = pwdHash; delete player.password;
      }catch(e){}
    }

    if(!tn && player.tournamentId && tournaments[player.tournamentId]){
      tn = tournaments[player.tournamentId];
    }
    savePlayerSession({
      id: player.id, code: player.code, name: player.name,
      role: player.role || 'player',
      tnId: tn ? tn.id : (player.tournamentId || ''),
      tnCode: tn ? tn.code : '',
      tournamentId: player.tournamentId || (tn ? tn.id : '')
    });
    document.getElementById('playerLoginPwd').value = '';
    setSt('Đăng nhập thành công'+(tn ? ' · Giải '+tn.code : '')+'.', false);
    tcData.players = players;
    tcData.tournaments = tournaments;
    try{
      const mSnap = await fb.db.ref('matches').once('value');
      tcData.matches = mSnap.val() || {};
    }catch(e){}
  }catch(err){
    setSt('Lỗi: '+(err.message||err), true);
  }
}

function playerLogout(){
  savePlayerSession(null);
  const st = document.getElementById('playerLoginStatus');
  if(st){ st.textContent='Đã đăng xuất.'; st.className='online-status live'; }
}

async function playerJoinMyMatch(){
  if(!playerSession) return;
  const st = document.getElementById('playerSessionStatus');
  const setSt = (msg, warn)=>{
    if(st){ st.textContent = msg; st.className = 'online-status'+(warn?' warn':' live'); }
  };
  setSt('Đang tìm bàn được gán…', false);
  try{
    await tcEnsureFb();
    const mSnap = await fb.db.ref('matches').once('value');
    tcData.matches = mSnap.val() || {};
  }catch(err){
    setSt('Không tải được danh sách trận: '+(err.message||err), true);
    return;
  }

  const pid = playerSession.id;
  const pcode = (playerSession.code || '').toUpperCase();
  const isMe = (slot)=>{
    if(slot == null || slot === '') return false;
    if(pid && slot === pid) return true;
    if(pcode && String(slot).toUpperCase() === pcode) return true;
    if(typeof slot === 'object'){
      if(pid && slot.id === pid) return true;
      if(pcode && String(slot.code||'').toUpperCase() === pcode) return true;
    }
    return false;
  };

  const allMine = Object.values(tcData.matches||{}).filter(m =>
    isMe(m.red) || isMe(m.black)
  );
  const withRoom = allMine.filter(m => m.status !== 'finished' && m.roomCode);
  const pendingNoRoom = allMine.filter(m => m.status !== 'finished' && !m.roomCode);

  if(!withRoom.length){
    if(pendingNoRoom.length){
      setSt('Có '+pendingNoRoom.length+' trận của bạn nhưng chưa được gán mã phòng. Nhờ BTC gán trong Nhánh & Bàn.', true);
    } else if(allMine.length){
      setSt('Các trận của bạn đã kết thúc hoặc chưa có phòng.', true);
    } else {
      setSt('Không thấy trận nào gắn với tài khoản «'+(playerSession.code||'')+'». Kiểm tra nhánh đấu đã sinh đúng kỳ thủ chưa.', true);
    }
    return;
  }

  const m = withRoom[0];
  const preferColor = isMe(m.red) ? 'red' : 'black';
  const roomCode = (m.roomCode||'').toUpperCase();
  try{
    const rSnap = await fb.db.ref('rooms/'+roomCode).once('value');
    if(!rSnap.val()){
      await ensureTournamentRoom(roomCode, m);
      setSt('Phòng '+roomCode+' đã được tạo lại — đang vào…', false);
    }
  }catch(err){
    setSt('Không kiểm tra được phòng: '+(err.message||err), true);
    return;
  }

  const joinInput = document.getElementById('fbJoinCodeInput');
  if(joinInput) joinInput.value = roomCode;
  setSt('Đang vào phòng '+roomCode+' ('+(preferColor==='red'?'Đỏ':'Đen')+')…', false);
  try{
    await fbJoinRoomPreferred(preferColor);
    if(state.online.active && state.online.roomCode === roomCode){
      setSt('Đã vào phòng '+roomCode+' · cầm '+(state.online.color==='red'?'Đỏ':'Đen'), false);
      closeDrawer();
    } else {
      const fbSt = document.getElementById('fbStatus');
      const detail = fbSt && fbSt.textContent ? fbSt.textContent : 'Không vào được phòng.';
      setSt(detail, true);
    }
  }catch(err){
    setSt('Vào phòng thất bại: '+(err.message||err), true);
  }
}

/* ===== Round-robin schedule + Double Elimination ===== */
function parseScoreScheme(){
  const raw = (document.getElementById('scoreScheme')?.value || '3 / 1 / 0');
  const parts = raw.split(/[/|,]/).map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n));
  return { win: parts[0]??3, draw: parts[1]??1, loss: parts[2]??0 };
}

/** Circle method for single RR; doubles if homeAway. */
function buildRRPairs(playerList, homeAway){
  const arr = playerList.slice();
  if(arr.length % 2 === 1) arr.push(null); // bye
  const n = arr.length;
  const rounds = [];
  const half = n / 2;
  let list = arr.slice();
  for(let r=0;r<n-1;r++){
    const pairs = [];
    for(let i=0;i<half;i++){
      const a = list[i], b = list[n-1-i];
      if(a && b) pairs.push([a,b]);
    }
    rounds.push(pairs);
    const fixed = list[0];
    const rest = list.slice(1);
    rest.unshift(rest.pop());
    list = [fixed].concat(rest);
  }
  if(homeAway){
    const back = rounds.map(pairs => pairs.map(([a,b]) => [b,a]));
    return rounds.concat(back);
  }
  return rounds;
}

async function generateRRSchedule(){
  const tnId = document.getElementById('groupTournament').value;
  if(!tnId || !tcData.groups[tnId]){ setAdminStatus('Chia bảng trước đã.', 'err'); return; }
  const homeAway = document.getElementById('homeAway').value === 'true';
  const scheme = parseScoreScheme();
  try{
    const old = Object.keys(tcData.matches).filter(id => tcData.matches[id].tournamentId===tnId && tcData.matches[id].kind==='rr');
    await Promise.all(old.map(id => tcRemove('matches/'+id)));
    old.forEach(id => delete tcData.matches[id]);

    const groups = tcData.groups[tnId].groups;
    const writes = [];
    let idx = 0;
    Object.keys(groups).sort().forEach(gKey=>{
      const members = groups[gKey];
      const rounds = buildRRPairs(members, homeAway);
      rounds.forEach((pairs, r)=>{
        pairs.forEach(([a,b], pi)=>{
          const mid = 'rr_'+tnId+'_'+gKey+'_r'+(r+1)+'_'+pi;
          const row = {
            id: mid, tournamentId: tnId, kind: 'rr', group: gKey,
            round: r+1, index: pi,
            red: a.id, black: b.id,
            redName: a.name, blackName: b.name,
            roomCode: '', status: 'pending', winner: null,
            table: (idx % 8) + 1,
            homeAway: homeAway,
            scoreScheme: scheme
          };
          tcData.matches[mid] = row;
          writes.push(tcSet('matches/'+mid, row));
          idx++;
        });
      });
    });
    await Promise.all(writes);
    await tcUpdate('tournaments/'+tnId, { scoreScheme: document.getElementById('scoreScheme').value, homeAway });
    setAdminStatus('Đã sinh lịch Round-Robin ('+writes.length+' trận'+(homeAway?', lượt đi+về':'')+').', 'ok');
    renderRRSchedule();
    updateDashboardStats();
  }catch(err){
    setAdminStatus('Sinh RR thất bại: '+(err.message||err), 'err');
  }
}

async function generateDoubleElim(){
  const tnId = document.getElementById('groupTournament').value;
  if(!tnId){ setAdminStatus('Chọn giải.', 'err'); return; }
  const players = Object.values(tcData.players).filter(p=>p.tournamentId===tnId)
    .sort((a,b)=>(b.elo||0)-(a.elo||0));
  if(players.length < 2){ setAdminStatus('Cần ≥2 kỳ thủ.', 'err'); return; }
  try{
    const old = Object.keys(tcData.matches).filter(id => tcData.matches[id].tournamentId===tnId && (tcData.matches[id].kind==='de_w'||tcData.matches[id].kind==='de_l'));
    await Promise.all(old.map(id => tcRemove('matches/'+id)));
    old.forEach(id => delete tcData.matches[id]);

    let size = 1; while(size < players.length) size *= 2;
    const slots = [];
    for(let i=0;i<size;i++) slots.push(players[i]||null);
    const writes = [];
    for(let i=0;i<size/2;i++){
      const a = slots[i], b = slots[size-1-i];
      const mid = 'de_w_'+tnId+'_r1_'+i;
      const row = {
        id: mid, tournamentId: tnId, kind: 'de_w', bracket: 'winners',
        round: 1, index: i,
        red: a?a.id:null, black: b?b.id:null,
        redName: a?a.name:'BYE', blackName: b?b.name:'BYE',
        roomCode: '', status: (!a||!b)?'finished':'pending',
        winner: !a?(b?b.id:null):(!b?(a?a.id:null):null),
        table: i+1, nextLoser: 'de_l_'+tnId+'_r1_'+i
      };
      tcData.matches[mid] = row;
      writes.push(tcSet('matches/'+mid, row));
      const lid = 'de_l_'+tnId+'_r1_'+i;
      const lrow = {
        id: lid, tournamentId: tnId, kind: 'de_l', bracket: 'losers',
        round: 1, index: i,
        red: null, black: null, redName: 'TBD', blackName: 'TBD',
        roomCode: '', status: 'pending', winner: null, table: i+1
      };
      tcData.matches[lid] = lrow;
      writes.push(tcSet('matches/'+lid, lrow));
    }
    await Promise.all(writes);
    await tcUpdate('tournaments/'+tnId, { format: 'double_elim' });
    setAdminStatus('Đã sinh Double Elimination: nhánh thắng + nhánh thua (vòng 1).', 'ok');
    renderRRSchedule();
    updateDashboardStats();
  }catch(err){
    setAdminStatus('Sinh DE thất bại: '+(err.message||err), 'err');
  }
}

function computeGroupStandings(tnId, gKey){
  const scheme = parseScoreScheme();
  const members = (tcData.groups[tnId]?.groups?.[gKey]) || [];
  const stats = {};
  members.forEach(m => { stats[m.id] = { id:m.id, name:m.name, code:m.code, pts:0, w:0, d:0, l:0 }; });
  Object.values(tcData.matches).filter(m =>
    m.tournamentId===tnId && m.kind==='rr' && m.group===gKey && m.status==='finished'
  ).forEach(m=>{
    if(!stats[m.red] || !stats[m.black]) return;
    if(m.winner === m.red){ stats[m.red].pts += scheme.win; stats[m.red].w++; stats[m.black].pts += scheme.loss; stats[m.black].l++; }
    else if(m.winner === m.black){ stats[m.black].pts += scheme.win; stats[m.black].w++; stats[m.red].pts += scheme.loss; stats[m.red].l++; }
    else { stats[m.red].pts += scheme.draw; stats[m.black].pts += scheme.draw; stats[m.red].d++; stats[m.black].d++; }
  });
  return Object.values(stats).sort((a,b)=> b.pts-a.pts || b.w-a.w);
}

function renderGroups(){
  const box = document.getElementById('groupResult');
  if(!box) return;
  const tnId = document.getElementById('groupTournament')?.value;
  const data = tnId && tcData.groups[tnId];
  if(!data){ box.innerHTML = '<div class="admin-empty">Chưa chia bảng.</div>'; return; }
  box.innerHTML = '';
  Object.keys(data.groups).sort().forEach(g=>{
    const standings = computeGroupStandings(tnId, g);
    const members = data.groups[g];
    const div = document.createElement('div');
    div.className = 'admin-item';
    const table = standings.length
      ? standings.map((s,i)=> (i+1)+'. '+s.code+' '+s.name+' — '+s.pts+'đ (W'+s.w+' D'+s.d+' L'+s.l+')').join('<br>')
      : members.map(m=>m.code+' '+m.name+' ('+m.elo+')').join(' · ');
    div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">Bảng '+g+
      '</div><div class="admin-item-meta">'+table+'</div></div>';
    box.appendChild(div);
  });
}

function renderRRSchedule(){
  const box = document.getElementById('rrScheduleList');
  if(!box) return;
  const tnId = document.getElementById('groupTournament')?.value;
  let list = Object.values(tcData.matches||{}).filter(m =>
    m.tournamentId===tnId && (m.kind==='rr' || m.kind==='de_w' || m.kind==='de_l')
  );
  list.sort((a,b)=> (a.kind||'').localeCompare(b.kind||'') || (a.round-b.round) || (a.index-b.index));
  if(!list.length){ box.innerHTML = '<div class="admin-empty">Chưa sinh lịch.</div>'; return; }
  box.innerHTML = '';
  list.forEach(m=>{
    const kind = m.kind==='rr' ? ('RR Bảng '+(m.group||'?')) : (m.kind==='de_w'?'DE Nhánh thắng':'DE Nhánh thua');
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+m.id+
      '<span class="admin-item-badge '+(m.status==='finished'?'expired':m.status==='playing'?'live':'idle')+'">'+m.status+'</span></div>'+
      '<div class="admin-item-meta">'+kind+' · V'+m.round+' · '+m.redName+' vs '+m.blackName+
      (m.roomCode?' · Phòng '+m.roomCode:'')+'</div></div>';
    box.appendChild(div);
  });
}

/* ===== Live grid + anomaly + tech chat ===== */

/** Admin: đóng panel → xem trực tiếp phòng trên bàn chính (spectator). */
async function adminWatchRoom(code){
  code = (code || document.getElementById('adminWatchCode')?.value || '').trim().toUpperCase();
  if(!code){
    setAdminStatus('Nhập hoặc chọn mã phòng trước.', 'err');
    return;
  }
  const input = document.getElementById('fbJoinCodeInput');
  if(input) input.value = code;
  const quick = document.getElementById('adminWatchCode');
  if(quick) quick.value = code;
  closeAdminPanel();
  try{
    await fbSpectateRoom();
    setFbStatus('👁 Admin đang xem phòng '+code+' (chỉ xem).', false);
  }catch(err){
    setFbStatus('Không xem được phòng '+code+': '+(err.message||err), true);
  }
}

async function renderLiveMonitor(){
  updateDashboardStats();
  const box = document.getElementById('liveMatchList');
  const grid = document.getElementById('liveGrid');
  const alertBox = document.getElementById('liveAlertList');
  const list = Object.values(tcData.matches||{}).filter(m =>
    m.status==='playing' || m.status==='pending' || m.status==='paused'
  );
  list.sort((a,b)=> (a.status==='playing'?0:1)-(b.status==='playing'?0:1));

  let rooms = {};
  try{
    await tcEnsureFb();
    const snap = await fb.db.ref('rooms').once('value');
    rooms = snap.val() || {};
  }catch(e){}

  const alerts = [];
  const now = Date.now();
  const GRACE = 60 * 1000;

  if(grid){
    if(!list.length) grid.innerHTML = '<div class="admin-empty">Không có bàn đang theo dõi.</div>';
    else {
      grid.innerHTML = '';
      list.forEach(m=>{
        const room = m.roomCode ? rooms[m.roomCode] : null;
        let effStatus = m.status || 'pending';
        if(room && effStatus !== 'finished'){
          const seats = room.seats || {};
          const seatCount = ['red','black'].filter(c => seats[c] && seats[c].uid).length;
          if(room.version > 1 || seatCount > 0) effStatus = 'playing';
          if(effStatus === 'playing' && m.status === 'pending' && m.id){
            m.status = 'playing';
            try{ fb.db.ref('matches/'+m.id).update({ status: 'playing' }); }catch(e){}
          }
        }
        let alert = false, reason = '';
        if(room && effStatus==='playing'){
          const seen = room.lastSeen || {};
          const redAge = seen.red != null ? now - seen.red : Infinity;
          const blackAge = seen.black != null ? now - seen.black : Infinity;
          if(redAge > GRACE || blackAge > GRACE){
            alert = true;
            reason = 'Mất kết nối >1 phút';
            alerts.push({ match:m.id, room:m.roomCode, type:'disconnect', text: reason });
          }
          if(room.createdAt && (now - room.createdAt) > ((tcData.tournaments[m.tournamentId]?.timeControl||15)*2*60*1000)){
            alert = true;
            reason = reason || 'Ván kéo dài quá quy định';
            alerts.push({ match:m.id, room:m.roomCode, type:'overtime', text:'Ván kéo dài quá thời gian quy định' });
          }
          if(room.version && room.createdAt){
            const elapsedMin = Math.max(0.5, (now - room.createdAt)/60000);
            const mpm = room.version / elapsedMin;
            if(mpm > 25 && room.version > 10){
              alert = true;
              alerts.push({ match:m.id, room:m.roomCode, type:'fast', text:'Nước đi quá nhanh (~'+mpm.toFixed(0)+'/phút) — nghi auto' });
            }
          }
        }
        const stLabel = effStatus==='playing'?'Đang đấu':effStatus==='paused'?'Tạm dừng':effStatus==='finished'?'Xong':'Chờ';
        const tile = document.createElement('div');
        tile.className = 'live-tile'+(effStatus==='playing'?' playing':'')+(alert?' alert':'');
        tile.innerHTML =
          '<div class="live-tile-dot"></div>'+
          '<div class="live-tile-title">Bàn '+(m.table||'?')+' · '+(m.roomCode||'—')+'</div>'+
          '<div class="live-tile-meta">'+m.redName+' vs '+m.blackName+
          '<br>'+stLabel+(reason?' · ⚠ '+reason:'')+'</div>'+
          (m.roomCode
            ? '<div class="live-tile-actions">'+
                '<button type="button" class="action-btn live-watch-btn" data-room="'+m.roomCode+'"><i class="fa-regular fa-eye"></i> Xem</button>'+
              '</div>'
            : '');
        if(m.roomCode){
          tile.style.cursor = 'pointer';
          tile.title = 'Bấm Xem để theo dõi trực tiếp';
          tile.addEventListener('click', (e)=>{
            if(e.target.closest('.live-watch-btn')) return;
            document.getElementById('fbJoinCodeInput').value = m.roomCode;
            const quick = document.getElementById('adminWatchCode');
            if(quick) quick.value = m.roomCode;
            setAdminStatus('Đã chọn phòng '+m.roomCode+' — bấm Xem trực tiếp', 'ok');
          });
        }
        grid.appendChild(tile);
      });
      grid.querySelectorAll('.live-watch-btn').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          e.stopPropagation();
          adminWatchRoom(btn.getAttribute('data-room'));
        });
      });
    }
  }

  const alertCount = document.getElementById('liveAlertCount');
  if(alertCount) alertCount.textContent = alerts.length;
  if(alertBox){
    if(!alerts.length) alertBox.innerHTML = '<div class="admin-empty">Không có cảnh báo.</div>';
    else {
      alertBox.innerHTML = '';
      alerts.forEach(a=>{
        const div = document.createElement('div');
        div.className = 'admin-item';
        div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+a.type+
          '</div><div class="admin-item-meta">'+a.text+' · '+a.match+(a.room?' · '+a.room:'')+'</div></div>';
        alertBox.appendChild(div);
      });
    }
  }

  if(box){
    if(!list.length) box.innerHTML = '<div class="admin-empty">Không có trận đang theo dõi.</div>';
    else {
      box.innerHTML = '';
      list.forEach(m=>{
        const div = document.createElement('div');
        div.className = 'admin-item';
        div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+m.id+
          '</div><div class="admin-item-meta">Bàn '+(m.table||'?')+' · '+m.redName+' vs '+m.blackName+
          (m.roomCode?' · <b>'+m.roomCode+'</b>':'')+'</div></div>';
        box.appendChild(div);
      });
    }
  }
}

async function sendTechChat(broadcastAll){
  const target = (document.getElementById('techChatTarget').value||'').trim().toUpperCase();
  const msg = (document.getElementById('techChatMsg').value||'').trim();
  if(!msg){ setAdminStatus('Nhập nội dung.', 'err'); return; }
  try{
    await tcEnsureFb();
    if(broadcastAll){
      const snap = await fb.db.ref('rooms').once('value');
      const rooms = snap.val() || {};
      await Promise.all(Object.keys(rooms).map(code =>
        fb.db.ref('rooms/'+code+'/chat').push({ color:'spectator', text:'[BTC] '+msg, ts: Date.now() })
      ));
      setAdminStatus('Đã broadcast tới '+Object.keys(rooms).length+' phòng.', 'ok');
    } else if(target){
      let roomCode = target;
      const match = tcData.matches[target] || Object.values(tcData.matches||{}).find(m=>m.roomCode===target);
      if(match && match.roomCode) roomCode = match.roomCode;
      await fb.db.ref('rooms/'+roomCode+'/chat').push({ color:'spectator', text:'[BTC] '+msg, ts: Date.now() });
      setAdminStatus('Đã gửi tới phòng '+roomCode, 'ok');
    } else {
      await tcPush('admin/techChat', { text: msg, ts: Date.now(), scope: 'system' });
      setAdminStatus('Đã ghi thông báo hệ thống.', 'ok');
    }
    document.getElementById('techChatMsg').value = '';
    await tcPush('admin/techChat', { text: msg, ts: Date.now(), target: target||'ALL' });
    renderTechChatLog();
  }catch(err){
    setAdminStatus('Gửi chat thất bại: '+(err.message||err), 'err');
  }
}

async function renderTechChatLog(){
  const box = document.getElementById('techChatLog');
  if(!box) return;
  try{
    await tcEnsureFb();
    const snap = await fb.db.ref('admin/techChat').limitToLast(30).once('value');
    const val = snap.val() || {};
    const list = Object.keys(val).map(k=>Object.assign({_key:k}, val[k])).sort((a,b)=>(b.ts||0)-(a.ts||0));
    if(!list.length){ box.innerHTML = '<div class="admin-empty">Chưa có tin nhắn kỹ thuật.</div>'; return; }
    box.innerHTML = '';
    list.forEach(e=>{
      const div = document.createElement('div');
      div.className = 'admin-item';
      div.innerHTML = '<div class="admin-item-main"><div class="admin-item-meta">'+formatTime(e.ts)+
        ' · '+(e.target||'system')+' — '+e.text+'</div></div>';
      box.appendChild(div);
    });
  }catch(e){
    box.innerHTML = '<div class="admin-empty">Không tải được log.</div>';
  }
}

/* ===== Caster + Polls ===== */
async function assignCaster(){
  const code = (document.getElementById('casterPlayerCode').value||'').trim().toUpperCase();
  const room = (document.getElementById('casterRoomCode').value||'').trim().toUpperCase();
  if(!code || !room){ setAdminStatus('Nhập mã caster và mã phòng.', 'err'); return; }
  const player = Object.values(tcData.players).find(p=>(p.code||'').toUpperCase()===code);
  if(!player){ setAdminStatus('Không tìm thấy kỳ thủ.', 'err'); return; }
  try{
    await tcUpdate('players/'+player.id, { role: 'caster', casterRoom: room });
    player.role = 'caster';
    player.casterRoom = room;
    setAdminStatus('Đã gán caster '+code+' → phòng '+room, 'ok');
    renderCasterList();
    renderPlayerList();
  }catch(err){
    setAdminStatus('Gán caster thất bại: '+(err.message||err), 'err');
  }
}

function renderCasterList(){
  const box = document.getElementById('casterList');
  if(!box) return;
  const list = Object.values(tcData.players||{}).filter(p=>p.role==='caster');
  if(!list.length){ box.innerHTML = '<div class="admin-empty">Chưa gán caster.</div>'; return; }
  box.innerHTML = '';
  list.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+p.code+
      '</div><div class="admin-item-meta">'+p.name+' · phòng '+(p.casterRoom||'—')+'</div></div>';
    box.appendChild(div);
  });
}

async function createPoll(){
  const q = (document.getElementById('pollQuestion').value||'').trim();
  const a = (document.getElementById('pollOptA').value||'').trim();
  const b = (document.getElementById('pollOptB').value||'').trim();
  const match = (document.getElementById('pollMatch').value||'').trim();
  if(!q || !a || !b){ setAdminStatus('Nhập câu hỏi và 2 phương án.', 'err'); return; }
  const id = 'poll_'+Date.now().toString(36);
  const row = { id, question:q, optA:a, optB:b, match, votesA:0, votesB:0, open:true, createdAt: Date.now() };
  try{
    await tcSet('polls/'+id, row);
    setAdminStatus('Đã tạo poll.', 'ok');
    document.getElementById('pollQuestion').value = '';
    renderPollList();
  }catch(err){
    setAdminStatus('Tạo poll thất bại: '+(err.message||err), 'err');
  }
}

async function closeOpenPolls(){
  try{
    await tcEnsureFb();
    const snap = await fb.db.ref('polls').once('value');
    const polls = snap.val() || {};
    const updates = [];
    Object.keys(polls).forEach(id=>{
      if(polls[id].open) updates.push(tcUpdate('polls/'+id, { open:false }));
    });
    await Promise.all(updates);
    setAdminStatus('Đã đóng '+updates.length+' poll.', 'ok');
    renderPollList();
  }catch(err){
    setAdminStatus('Đóng poll thất bại: '+(err.message||err), 'err');
  }
}

async function renderPollList(){
  const box = document.getElementById('pollList');
  if(!box) return;
  try{
    await tcEnsureFb();
    const snap = await fb.db.ref('polls').once('value');
    const polls = snap.val() || {};
    const list = Object.values(polls).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(!list.length){ box.innerHTML = '<div class="admin-empty">Chưa có poll.</div>'; return; }
    box.innerHTML = '';
    list.forEach(p=>{
      const total = (p.votesA||0)+(p.votesB||0);
      const div = document.createElement('div');
      div.className = 'admin-item';
      div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+(p.open?'🟢':'🔒')+' '+p.question+
        '</div><div class="admin-item-meta">A: '+p.optA+' ('+(p.votesA||0)+') · B: '+p.optB+' ('+(p.votesB||0)+') · Tổng '+total+
        (p.match?' · '+p.match:'')+'</div></div>';
      box.appendChild(div);
    });
  }catch(e){
    box.innerHTML = '<div class="admin-empty">Không tải poll.</div>';
  }
}

async function updateRolePassword(){
  const code = (document.getElementById('rolePwdCode').value||'').trim().toUpperCase();
  const pwd = (document.getElementById('rolePwdNew').value||'').trim();
  const role = document.getElementById('rolePwdRole').value;
  const st = document.getElementById('rolePwdStatus');
  const setSt = (m,k)=>{ if(st){ st.textContent=m; st.className='admin-status'+(k==='ok'?' ok':k==='err'?' err':''); } };
  if(!code){ setSt('Nhập mã kỳ thủ.', 'err'); return; }
  if(pwd && pwd.length < 4){ setSt('Mật khẩu tối thiểu 4 ký tự.', 'err'); return; }
  const player = Object.values(tcData.players).find(p=>(p.code||'').toUpperCase()===code);
  if(!player){ setSt('Không tìm thấy «'+code+'».', 'err'); return; }
  const oldRole = player.role || 'player';
  if(role && !canAssignRole(role, oldRole)){
    setSt('Không đủ quyền gán role admin — cần session Admin website.', 'err'); return;
  }
  if(role && oldRole === 'superadmin' && role !== 'superadmin' && countSuperadmins() <= 1){
    setSt('Không thể hạ Admin chính duy nhất.', 'err'); return;
  }
  const patch = {};
  if(pwd){ patch.passwordHash = await sha256Hex(pwd); patch.password = null; }
  if(role) patch.role = role;
  if(!Object.keys(patch).length){ setSt('Không có gì để cập nhật.', 'err'); return; }
  try{
    await tcUpdate('players/'+player.id, patch);
    Object.assign(player, patch);
    if(patch.passwordHash) delete player.password;
    setSt('Đã cập nhật '+code+(pwd?' · MK mới':'')+(role?' · role '+role:''), 'ok');
    renderPlayerList();
  }catch(err){
    setSt('Lỗi: '+(err.message||err), 'err');
  }
}

/* ===== Spectator poll vote ===== */
async function loadSpectatorPolls(){
  const box = document.getElementById('spectatorPollBox');
  if(!box) return;
  try{
    if(!fbAvailable()){ box.innerHTML = '<div class="admin-empty" style="padding:8px;">Cần Firebase.</div>'; return; }
    await fbEnsureAuth();
    const snap = await fb.db.ref('polls').once('value');
    const polls = snap.val() || {};
    const open = Object.values(polls).filter(p => p.open).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(!open.length){ box.innerHTML = '<div class="admin-empty" style="padding:8px;">Chưa có poll đang mở.</div>'; return; }
    box.innerHTML = '';
    open.forEach(p=>{
      const total = (p.votesA||0)+(p.votesB||0);
      const div = document.createElement('div');
      div.style.cssText = 'margin-bottom:10px;padding:8px;border:1px solid rgba(200,151,63,0.25);border-radius:8px;';
      div.innerHTML =
        '<div style="font-size:13px;color:var(--jade-glow);margin-bottom:6px;">'+p.question+'</div>'+
        '<div class="action-row" style="gap:6px;">'+
          '<button class="action-btn poll-vote" data-id="'+p.id+'" data-opt="A" style="flex:1;font-size:12px;">'+p.optA+' ('+(p.votesA||0)+')</button>'+
          '<button class="action-btn poll-vote" data-id="'+p.id+'" data-opt="B" style="flex:1;font-size:12px;">'+p.optB+' ('+(p.votesB||0)+')</button>'+
        '</div>'+
        '<div style="font-size:11px;color:var(--muted);margin-top:4px;">Tổng '+total+(p.match?' · '+p.match:'')+'</div>';
      box.appendChild(div);
    });
    box.querySelectorAll('.poll-vote').forEach(btn=>{
      btn.addEventListener('click', ()=> votePoll(btn.dataset.id, btn.dataset.opt));
    });
  }catch(e){
    box.innerHTML = '<div class="admin-empty" style="padding:8px;">Không tải poll.</div>';
  }
}

async function votePoll(id, opt){
  const votedKey = 'poll-voted-'+id;
  if(localStorage.getItem(votedKey)){
    setFbStatus('Bạn đã bình chọn poll này rồi.', true);
    return;
  }
  try{
    await fbEnsureAuth();
    const ref = fb.db.ref('polls/'+id);
    await ref.transaction(cur=>{
      if(!cur || !cur.open) return cur;
      if(opt==='A') cur.votesA = (cur.votesA||0)+1;
      else cur.votesB = (cur.votesB||0)+1;
      return cur;
    });
    localStorage.setItem(votedKey, '1');
    setFbStatus('Đã bình chọn.', false);
    loadSpectatorPolls();
  }catch(e){
    setFbStatus('Bình chọn thất bại.', true);
  }
}

document.getElementById('playerLoginBtn')?.addEventListener('click', tryPlayerLogin);
document.getElementById('playerLoginPwd')?.addEventListener('keydown', e=>{ if(e.key==='Enter') tryPlayerLogin(); });
document.getElementById('playerLogoutBtn')?.addEventListener('click', playerLogout);
document.getElementById('playerJoinMatchBtn')?.addEventListener('click', playerJoinMyMatch);
document.getElementById('playerUpdateBtn')?.addEventListener('click', updatePlayer);
document.getElementById('playerCancelEditBtn')?.addEventListener('click', clearPlayerForm);

document.getElementById('rrScheduleBtn')?.addEventListener('click', generateRRSchedule);
document.getElementById('deBracketBtn')?.addEventListener('click', generateDoubleElim);

document.getElementById('techChatSendBtn')?.addEventListener('click', ()=> sendTechChat(false));
document.getElementById('techChatBroadcastBtn')?.addEventListener('click', ()=> sendTechChat(true));

document.getElementById('casterAssignBtn')?.addEventListener('click', assignCaster);
document.getElementById('pollCreateBtn')?.addEventListener('click', createPoll);
document.getElementById('pollCloseBtn')?.addEventListener('click', closeOpenPolls);

/* ===== Quản lý vai trò ===== */
function renderRoleManager(){
  const box = document.getElementById('roleManageList');
  if(!box) return;
  const filter = (document.getElementById('roleFilter')?.value || '').trim();
  const q = (document.getElementById('roleSearch')?.value || '').trim().toLowerCase();
  const list = Object.values(tcData.players || {});
  const counts = { player:0, vip:0, mod:0, caster:0, admin:0, superadmin:0 };
  list.forEach(p=>{
    const r = p.role || 'player';
    if(counts[r] != null) counts[r]++;
    else counts.player++;
  });
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent = v; };
  set('roleStatPlayer', counts.player);
  set('roleStatVip', counts.vip);
  set('roleStatMod', counts.mod);
  set('roleStatCaster', counts.caster);
  set('roleStatAdmin', counts.admin);
  set('roleStatSuper', counts.superadmin);

  let shown = list.slice().sort((a,b)=> (a.code||'').localeCompare(b.code||''));
  if(filter) shown = shown.filter(p => (p.role||'player') === filter);
  if(q) shown = shown.filter(p =>
    (p.code||'').toLowerCase().includes(q) ||
    (p.name||'').toLowerCase().includes(q) ||
    (p.nick||'').toLowerCase().includes(q)
  );
  if(!shown.length){
    box.innerHTML = '<div class="admin-empty">Không có tài khoản phù hợp.</div>';
    return;
  }
  box.innerHTML = '';
  shown.forEach(p=>{
    const role = p.role || 'player';
    const tn = tcData.tournaments[p.tournamentId];
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML =
      '<div class="admin-item-main">'+
        '<div class="admin-item-code">'+p.code+
          '<span class="role-badge '+role+'">'+roleLabel(role)+'</span>'+
        '</div>'+
        '<div class="admin-item-meta">'+p.name+(p.nick?' «'+p.nick+'»':'')+
          (tn?' · Giải '+tn.code:'')+
        '</div>'+
      '</div>'+
      '<div class="admin-item-actions" style="min-width:140px;">'+
        '<select class="role-quick-select" data-id="'+p.id+'" data-old="'+role+'" title="Đổi vai trò">'+
          '<option value="player"'+(role==='player'?' selected':'')+'>player</option>'+
          '<option value="vip"'+(role==='vip'?' selected':'')+'>vip</option>'+
          '<option value="mod"'+(role==='mod'?' selected':'')+'>mod</option>'+
          '<option value="caster"'+(role==='caster'?' selected':'')+'>caster</option>'+
          '<option value="admin"'+(role==='admin'?' selected':'')+'>admin phụ</option>'+
          '<option value="superadmin"'+(role==='superadmin'?' selected':'')+'>admin chính</option>'+
        '</select>'+
      '</div>';
    box.appendChild(div);
  });
  box.querySelectorAll('.role-quick-select').forEach(sel=>{
    sel.addEventListener('change', async ()=>{
      const id = sel.dataset.id;
      const newRole = sel.value;
      const p = tcData.players[id];
      if(!p) return;
      const oldRole = p.role || 'player';
      if(!canAssignRole(newRole, oldRole)){
        setAdminStatus('🔒 Role admin/admin chính chỉ đổi được trong session Admin website.', 'err');
        sel.value = oldRole;
        return;
      }
      if(oldRole === 'superadmin' && newRole !== 'superadmin' && countSuperadmins() <= 1){
        setAdminStatus('Không thể hạ Admin chính duy nhất.', 'err');
        sel.value = oldRole;
        return;
      }
      try{
        await tcUpdate('players/'+id, { role: newRole });
        p.role = newRole;
        setAdminStatus('Đã đổi '+p.code+' → '+roleLabel(newRole), 'ok');
        renderRoleManager();
        renderPlayerList();
      }catch(err){
        setAdminStatus('Đổi vai trò thất bại: '+(err.message||err), 'err');
        sel.value = p.role || 'player';
      }
    });
  });
}

document.getElementById('rolePwdSaveBtn')?.addEventListener('click', updateRolePassword);
document.getElementById('adminChatRefreshBtn')?.addEventListener('click', loadAdminChatRooms);
document.getElementById('coinGrantBtn')?.addEventListener('click', adminGrantCoins);
document.getElementById('coinDeductBtn')?.addEventListener('click', adminDeductCoins);
document.getElementById('coinPopupOk')?.addEventListener('click', closeCoinPopup);
document.getElementById('coinPopupOverlay')?.addEventListener('click', (e)=>{ if(e.target.id==='coinPopupOverlay') closeCoinPopup(); });
document.getElementById('shopGrantBtn')?.addEventListener('click', adminGrantShopItem);
document.getElementById('coinRefreshBtn')?.addEventListener('click', renderAdminCoins);
document.getElementById('adminChatClearRoomBtn')?.addEventListener('click', clearAdminChatRoom);
document.getElementById('roleFilter')?.addEventListener('change', renderRoleManager);
document.getElementById('roleSearch')?.addEventListener('input', renderRoleManager);

/* ===== Admin: quản lý chat mọi phòng ===== */
let adminChatSelectedRoom = null;
let adminChatCache = {}; // roomCode -> { key: msg }

async function loadAdminChatRooms(){
  const box = document.getElementById('adminChatRoomList');
  if(!box) return;
  box.innerHTML = '<div class="admin-empty">Đang tải…</div>';
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('rooms').once('value');
    const rooms = snap.val() || {};
    adminChatCache = {};
    const rows = [];
    for(const code of Object.keys(rooms)){
      const chat = rooms[code].chat;
      if(!chat || typeof chat !== 'object') continue;
      const msgs = Object.entries(chat).map(([k,v])=>({ key:k, ...(v||{}) }));
      if(!msgs.length) continue;
      msgs.sort((a,b)=> (a.ts||0)-(b.ts||0));
      adminChatCache[code] = msgs;
      const last = msgs[msgs.length-1];
      rows.push({
        code,
        count: msgs.length,
        lastText: (last && last.text) || '',
        lastTs: (last && last.ts) || 0
      });
    }
    rows.sort((a,b)=> b.lastTs - a.lastTs);
    if(!rows.length){
      box.innerHTML = '<div class="admin-empty">Chưa có phòng nào có chat.</div>';
      return;
    }
    box.innerHTML = '';
    rows.forEach(r=>{
      const div = document.createElement('div');
      div.className = 'admin-item'+(adminChatSelectedRoom===r.code?' active-chat-room':'');
      div.style.cursor = 'pointer';
      const t = r.lastTs ? new Date(r.lastTs).toLocaleString('vi-VN') : '';
      div.innerHTML =
        '<div class="admin-item-main">'+
          '<div class="admin-item-code">'+r.code+
            '<span class="admin-item-badge live">'+r.count+' tin</span>'+
          '</div>'+
          '<div class="admin-item-meta">'+(r.lastText? r.lastText.slice(0,60):'—')+(t?' · '+t:'')+'</div>'+
        '</div>';
      div.addEventListener('click', ()=> selectAdminChatRoom(r.code));
      box.appendChild(div);
    });
  }catch(err){
    box.innerHTML = '<div class="admin-empty">Lỗi tải: '+(err.message||err)+'</div>';
  }
}

function selectAdminChatRoom(code){
  adminChatSelectedRoom = code;
  const label = document.getElementById('adminChatRoomLabel');
  if(label) label.textContent = code;
  document.querySelectorAll('#adminChatRoomList .admin-item').forEach(el=>{
    const is = el.querySelector('.admin-item-code')?.childNodes[0]?.textContent?.trim() === code;
    el.classList.toggle('active-chat-room', is);
  });
  renderAdminChatMessages();
}

function renderAdminChatMessages(){
  const box = document.getElementById('adminChatMsgList');
  if(!box) return;
  const code = adminChatSelectedRoom;
  if(!code){
    box.innerHTML = '<div class="admin-empty">Chọn một phòng bên trái.</div>';
    return;
  }
  const msgs = adminChatCache[code] || [];
  if(!msgs.length){
    box.innerHTML = '<div class="admin-empty">Phòng này không còn tin nhắn.</div>';
    return;
  }
  box.innerHTML = '';
  msgs.forEach(m=>{
    const div = document.createElement('div');
    div.className = 'admin-item';
    const who = m.name || (m.color==='red'?'Đỏ':m.color==='black'?'Đen':(m.system?'Hệ thống':'?'));
    const role = m.role && m.role!=='player' && m.role!=='system'
      ? '<span class="role-badge '+m.role+'">'+(typeof roleLabel==='function'?roleLabel(m.role):m.role)+'</span>'
      : '';
    const time = m.ts ? new Date(m.ts).toLocaleString('vi-VN') : '';
    const safeText = (m.text||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    div.innerHTML =
      '<div class="admin-item-main" style="min-width:0;flex:1;">'+
        '<div class="admin-item-code" style="font-size:13px;">'+who+' '+role+
          '<span class="admin-item-meta" style="margin-left:8px;">'+time+'</span>'+
        '</div>'+
        '<div class="admin-item-meta admin-chat-text" data-key="'+m.key+'">'+safeText+'</div>'+
      '</div>'+
      '<div class="admin-item-actions">'+
        '<button type="button" class="action-btn admin-chat-edit" data-key="'+m.key+'" title="Sửa"><i class="fa-regular fa-pen"></i></button>'+
        '<button type="button" class="action-btn cheat-danger admin-chat-del" data-key="'+m.key+'" title="Xóa"><i class="fa-regular fa-trash"></i></button>'+
      '</div>';
    box.appendChild(div);
  });
  box.querySelectorAll('.admin-chat-edit').forEach(btn=>{
    btn.addEventListener('click', ()=> editAdminChatMsg(btn.dataset.key));
  });
  box.querySelectorAll('.admin-chat-del').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteAdminChatMsg(btn.dataset.key));
  });
}

async function editAdminChatMsg(key){
  const code = adminChatSelectedRoom;
  if(!code || !key) return;
  const msgs = adminChatCache[code] || [];
  const m = msgs.find(x=>x.key===key);
  if(!m) return;
  const next = prompt('Sửa nội dung tin nhắn:', m.text || '');
  if(next == null) return;
  const text = next.trim().slice(0, 500);
  if(!text){ setAdminStatus('Nội dung trống — không lưu.', 'err'); return; }
  try{
    await adminEnsureFb();
    await fb.db.ref('rooms/'+code+'/chat/'+key).update({ text, editedAt: Date.now(), editedBy: 'admin' });
    m.text = text;
    m.editedAt = Date.now();
    renderAdminChatMessages();
    setAdminStatus('Đã sửa tin trong phòng '+code, 'ok');
  }catch(err){
    setAdminStatus('Sửa thất bại: '+(err.message||err), 'err');
  }
}

async function deleteAdminChatMsg(key){
  const code = adminChatSelectedRoom;
  if(!code || !key) return;
  if(!confirm('Xóa tin nhắn này trong phòng '+code+'?')) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('rooms/'+code+'/chat/'+key).remove();
    adminChatCache[code] = (adminChatCache[code]||[]).filter(x=>x.key!==key);
    renderAdminChatMessages();
    if(!(adminChatCache[code]||[]).length) await loadAdminChatRooms();
    setAdminStatus('Đã xóa tin nhắn.', 'ok');
  }catch(err){
    setAdminStatus('Xóa thất bại: '+(err.message||err), 'err');
  }
}

async function clearAdminChatRoom(){
  const code = adminChatSelectedRoom;
  if(!code){ setAdminStatus('Chọn phòng trước.', 'err'); return; }
  if(!confirm('XÓA TOÀN BỘ chat phòng '+code+'?')) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('rooms/'+code+'/chat').remove();
    adminChatCache[code] = [];
    adminChatSelectedRoom = null;
    document.getElementById('adminChatRoomLabel').textContent = '—';
    await loadAdminChatRooms();
    renderAdminChatMessages();
    setAdminStatus('Đã xóa hết chat phòng '+code, 'ok');
  }catch(err){
    setAdminStatus('Xóa phòng chat thất bại: '+(err.message||err), 'err');
  }
}

async function adminGrantShopItem(){
  const code = (document.getElementById('coinGrantCode')?.value||'').trim().toUpperCase();
  const itemId = document.getElementById('shopGrantItem')?.value || '';
  if(!code){ setAdminStatus('Nhập mã kỳ thủ.', 'err'); return; }
  if(!itemId || !SHOP_ITEMS[itemId]){ setAdminStatus('Chọn vật phẩm.', 'err'); return; }
  const it = SHOP_ITEMS[itemId];
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('players').once('value');
    const all = snap.val() || {};
    const p = Object.values(all).find(x => (x.code||'').toUpperCase() === code);
    if(!p){ setAdminStatus('Không tìm thấy «'+code+'».', 'err'); return; }
    const inv = (p.inventory && typeof p.inventory==='object') ? {...p.inventory} : {};
    inv[it.id] = (inv[it.id]||0) + 1;
    await fb.db.ref('players/'+p.id).update({ inventory: inv });
    setAdminStatus('Đã tặng '+it.emoji+' «'+it.name+'» cho '+code, 'ok');
  }catch(err){
    setAdminStatus('Tặng thất bại: '+(err.message||err), 'err');
  }
}

function fillShopGrantSelect(){
  const sel = document.getElementById('shopGrantItem');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Chọn vật phẩm —</option>';
  Object.values(SHOP_ITEMS).forEach(it=>{
    const opt = document.createElement('option');
    opt.value = it.id;
    opt.textContent = (it.emoji ? it.emoji+' ' : '') + it.name + ' · '+it.price+' coin';
    sel.appendChild(opt);
  });
  if(cur) sel.value = cur;
}
/* ===== Admin Coin ===== */
async function renderAdminCoins(){
  const listBox = document.getElementById('coinCheckInList');
  const topBox = document.getElementById('coinTopList');
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('players').once('value');
    const players = Object.values(snap.val() || {});
    if(tcData) tcData.players = snap.val() || {};
    const today = todayStr();
    let totalCoins = 0, withCoins = 0;
    const checked = [];
    players.forEach(p=>{
      const c = +(p.coins||0);
      totalCoins += c;
      if(c>0) withCoins++;
      if(p.lastCheckIn === today) checked.push(p);
    });
    const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
    set('coinStatToday', checked.length);
    set('coinStatTotal', totalCoins);
    set('coinStatPlayers', withCoins);

    if(listBox){
      if(!checked.length) listBox.innerHTML = '<div class="admin-empty">Chưa ai điểm danh hôm nay.</div>';
      else {
        listBox.innerHTML = '';
        checked.sort((a,b)=> (b.lastCheckInTs||0)-(a.lastCheckInTs||0));
        checked.forEach(p=>{
          const div = document.createElement('div');
          div.className = 'admin-item';
          div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+(p.code||p.id)+
            '</div><div class="admin-item-meta">'+(p.name||'')+' · '+(p.coins||0)+' coin</div></div>';
          listBox.appendChild(div);
        });
      }
    }
    if(topBox){
      const top = players.filter(p=>+(p.coins||0)>0).sort((a,b)=> +(b.coins||0)-+(a.coins||0)).slice(0,30);
      if(!top.length) topBox.innerHTML = '<div class="admin-empty">Chưa có dữ liệu coin.</div>';
      else {
        topBox.innerHTML = '';
        top.forEach((p,i)=>{
          const div = document.createElement('div');
          div.className = 'admin-item';
          div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">#'+(i+1)+' '+(p.code||'')+
            '<span class="admin-item-badge live">'+(p.coins||0)+' coin</span></div>'+
            '<div class="admin-item-meta">'+(p.name||'')+(p.lastCheckIn?' · điểm danh '+p.lastCheckIn:'')+'</div></div>';
          topBox.appendChild(div);
        });
      }
    }
  }catch(err){
    if(listBox) listBox.innerHTML = '<div class="admin-empty">Lỗi: '+(err.message||err)+'</div>';
  }
}

async function adminAdjustCoins(sign){
  const code = (document.getElementById('coinGrantCode')?.value||'').trim().toUpperCase();
  const amount = Math.floor(+(document.getElementById('coinGrantAmount')?.value||0));
  const delta = sign >= 0 ? amount : -amount;
  if(!code){ setAdminStatus('Nhập mã kỳ thủ.', 'err'); return; }
  if(!amount || amount<1){ setAdminStatus('Số coin không hợp lệ.', 'err'); return; }
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('players').once('value');
    const all = snap.val() || {};
    const p = Object.values(all).find(x => (x.code||'').toUpperCase() === code);
    if(!p){ setAdminStatus('Không tìm thấy kỳ thủ «'+code+'».', 'err'); return; }
    const cur = Math.max(0, +(p.coins||0));
    const next = Math.max(0, cur + delta);
    if(sign < 0 && next === cur && cur === 0){
      setAdminStatus(code+' đã hết coin (0).', 'err'); return;
    }
    await fb.db.ref('players/'+p.id).update({ coins: next });
    p.coins = next;
    if(tcData && tcData.players) tcData.players[p.id] = p;
    setAdminStatus(
      (sign>=0 ? ('Đã cộng +'+amount) : ('Đã trừ −'+amount)) +
      ' coin cho '+code+' · '+cur+' → '+next, 'ok'
    );
    renderAdminCoins();
  }catch(err){
    setAdminStatus('Cập nhật coin thất bại: '+(err.message||err), 'err');
  }
}
async function adminGrantCoins(){ return adminAdjustCoins(1); }
async function adminDeductCoins(){ return adminAdjustCoins(-1); }

const _switchAdminSection = switchAdminSection;
switchAdminSection = function(sec){
  _switchAdminSection(sec);
  if(sec==='format'){ renderGroups(); renderRRSchedule(); }
  if(sec==='live'){ renderLiveMonitor(); renderTechChatLog(); }
  if(sec==='broadcast'){ renderCasterList(); renderPollList(); }
  if(sec==='roles'){ renderRoleManager(); }
  if(sec==='chats'){ loadAdminChatRooms(); }
  if(sec==='coins'){ fillShopGrantSelect(); renderAdminCoins(); }
};

const _openAdminPanelOrig = openAdminPanel;
openAdminPanel = async function(){
  _openAdminPanelOrig();
  setAdminStatus('Đang tải dữ liệu giải từ Firebase…');
  await tcLoad();
  updateDashboardStats();
  switchAdminSection('dashboard');
  setAdminStatus(tcLoaded ? 'Đã đồng bộ dữ liệu giải từ Firebase.' : 'Chưa tải được dữ liệu giải — kiểm tra Rules.', tcLoaded ? 'ok' : 'err');
};

loadPlayerSession();
try{ updateAdminMenuUI(); }catch(e){}

updateCheatPanelVisibility();
updateAiLevelBoxVisibility();
updateAiLevelBadge();

/* ---------------- Init: load config.json, then boot the game ---------------- */
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
  state.commentVoice = false;
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();

  if(new URLSearchParams(location.search).get('room')){
    checkRoomLinkParam();
  } else {
    fbAutoRejoin();
  }

  if(fbConfigured()){
    setInterval(()=>{
      (async ()=>{
        try{ await fbEnsureAuth(); fbSweepExpiredRooms(); }catch(err){}
      })();
    }, 60000);
    fbEnsureAuth().then(u=>{
      console.log('[Firebase] Anonymous uid:', u && u.uid);
    }).catch(err=>{
      console.warn('[Firebase] Auth:', err.message||err);
    });
  }
}

loadConfigAndInit();

