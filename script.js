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

// Kho logo CLB của bạn trên GitHub. Muốn thêm đội mới: tải file SVG logo đội đó
// từ football-logos.cc, đặt tên file đúng bằng "slug" của đội (xem field slug
// trong THEME_CLUBS ở catalog.js, vd Real Madrid -> slug 'real-madrid'), rồi
// upload vào thư mục /logo/ trong repo nokiapro/cotuong (nhánh main).
// Code sẽ tự động nhận logo mới, không cần sửa gì thêm ở đây.
const CLUB_LOGO_BASE = 'https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/logo/';
function footyLogoUrl(slug){
  return CLUB_LOGO_BASE + slug + '.svg';
}
function footyLogoImgHtml(slug, cls, alt){
  const svg = footyLogoUrl(slug);
  return '<img class="'+(cls||'gift-club-logo')+'" src="'+svg+'" alt="'+(alt||'')+'" loading="lazy" onerror="this.style.display=\'none\';"/>';
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

function getAchievementStats(){
  const freeThemes = ['wood','jade','rosewood','marble'];
  const unlockedList = (coinState && Array.isArray(coinState.unlocked)) ? coinState.unlocked : [];
  const paidUnlocked = unlockedList.filter(t => !freeThemes.includes(t)).length;
  const freeUnlocked = unlockedList.filter(t => freeThemes.includes(t)).length;
  const clubThemes = unlockedList.filter(t => THEME_META[t] && THEME_META[t].club).length;
  return {
    wins: (coinState && coinState.wins) || 0,
    checkInStreak: (coinState && coinState.checkInStreak) || 0,
    unlockedThemes: paidUnlocked + freeUnlocked,
    purchases: (coinState && coinState.purchases) || 0,
    friendCount: (coinState && coinState.friendCount) || 0,
    winStreak: (coinState && coinState.winStreak) || 0,
    aiWins: (coinState && coinState.aiWins) || 0,
    aiLevelBeat: (coinState && coinState.aiLevelBeat) || 0,
    onlineWins: (coinState && coinState.onlineWins) || 0,
    betWins: (coinState && coinState.betWins) || 0,
    totalGifts: (coinState && coinState.totalGifts) || 0,
    auctionWins: (coinState && coinState.auctionWins) || 0,
    giftCodesSent: (coinState && coinState.giftCodesSent) || 0,
    holidayWins: (coinState && coinState.holidayWins) || 0,
    elo: (coinState && coinState.elo) || 0,
    perfectGames: (coinState && coinState.perfectGames) || 0,
    checksInGame: (coinState && coinState.checksInGame) || 0,
    comebackWins: (coinState && coinState.comebackWins) || 0,
    sacrificeWins: (coinState && coinState.sacrificeWins) || 0,
    blitzWins: (coinState && coinState.blitzWins) || 0,
    marathonWins: (coinState && coinState.marathonWins) || 0,
    horseCheckmates: (coinState && coinState.horseCheckmates) || 0,
    cannonCheckmates: (coinState && coinState.cannonCheckmates) || 0,
    soldierCheckmates: (coinState && coinState.soldierCheckmates) || 0,
    chariotCaptures: (coinState && coinState.chariotCaptures) || 0,
    horseCaptures: (coinState && coinState.horseCaptures) || 0,
    cannonCaptures: (coinState && coinState.cannonCaptures) || 0,
    clubThemes: clubThemes,
    eventThemes: (coinState && coinState.eventThemes) || 0,
    chatMessages: (coinState && coinState.chatMessages) || 0,
    invites: (coinState && coinState.invites) || 0,
    coins: (coinState && coinState.coins) || 0,
    totalSpent: (coinState && coinState.totalSpent) || 0,
    totalGames: (coinState && coinState.totalGames) || 0,
    winRate: (coinState && coinState.winRate) || 0,
    summerWins: (coinState && coinState.summerWins) || 0,
    winterWins: (coinState && coinState.winterWins) || 0,
    generalCaptures: (coinState && coinState.generalCaptures) || 0,
    chariotSacrificeWins: (coinState && coinState.chariotSacrificeWins) || 0,
    checkmateCount: (coinState && coinState.checkmateCount) || 0,
    shortestWin: (coinState && coinState.shortestWin) || 999,
    luckyWins: (coinState && coinState.luckyWins) || 0,
    nightGames: (coinState && coinState.nightGames) || 0,
    honestGames: (coinState && coinState.honestGames) || 0,
    gamblerWins: (coinState && coinState.gamblerWins) || 0,
    drawStreak: (coinState && coinState.drawStreak) || 0
  };
}

function getUnlockedAchievementIds(){
  return (coinState && Array.isArray(coinState.achievements)) ? coinState.achievements.slice() : [];
}

const _shownAchSession = new Set();

async function evaluateAchievements(silent, opts){
  if(!getCoinIdentity()) return [];
  const o = opts || {};
  if(!o.skipReload){
    try{ await loadCoinStateFromPlayer(); }catch(e){}
  }
  if(!coinState.achievements) coinState.achievements = [];
  const stats = getAchievementStats();
  const newly = [];
  Object.values(ACHIEVEMENTS).forEach(a=>{
    if(coinState.achievements.includes(a.id)) return;
    try{
      if(a.check(stats)){
        coinState.achievements.push(a.id);
        newly.push(a);
      }
    }catch(e){}
  });
  if(newly.length){
    try{ await saveCoinStateToPlayer(); }catch(e){}
    if(!silent){
      const toShow = newly.filter(a => !_shownAchSession.has(a.id));
      toShow.forEach(a => _shownAchSession.add(a.id));
      if(toShow.length){
        const names = toShow.map(a => a.icon+' '+a.name).join(', ');
        try{ showCoinPopup({ icon:'🎖️', title:'Thành tựu mới!', html:'<div class="coin-popup-hint">'+names+'</div>' }); }catch(e){}
      }
    }
  }
  try{ renderAchievementsUI(); }catch(e){}
  return newly;
}

function renderAchievementsUI(){
  const box = document.getElementById('achievementList');
  if(!box) return;
  const dict = (typeof ACHIEVEMENTS !== 'undefined' && ACHIEVEMENTS) ? ACHIEVEMENTS : {};
  const have = new Set(getUnlockedAchievementIds());
  box.innerHTML = '';
  const list = Object.values(dict);
  if(!list.length){
    box.innerHTML = '<div class="admin-empty">Chưa có dữ liệu thành tựu.</div>';
    return;
  }
  list.forEach(a=>{
    if(!a || !a.id) return;
    const on = have.has(a.id);
    const div = document.createElement('div');
    div.className = 'achievement-item' + (on ? ' unlocked' : ' locked');
    div.innerHTML = '<span class="ach-icon">'+(a.icon||'🎖️')+'</span><div class="ach-meta"><b>'+(a.name||a.id)+'</b><span>'+(a.desc||'')+'</span></div>'+
      (on ? '<span class="ach-done">✓</span>' : '<span class="ach-lock">🔒</span>');
    box.appendChild(div);
  });
}

function achievementBadgesHtml(ids){
  if(!ids || !ids.length) return '';
  return ids.slice(0,4).map(id=>{
    const a = ACHIEVEMENTS[id];
    if(!a) return '';
    return '<span class="ach-badge" title="'+a.name+'">'+a.icon+'</span>';
  }).join('');
}

async function recordWinForAchievement(){
  if(!getCoinIdentity()) return;
  try{
    await loadCoinStateFromPlayer();
    coinState.wins = Math.max(0, +(coinState.wins||0)) + 1;
    await saveCoinStateToPlayer();
    await evaluateAchievements(false);
  }catch(e){}
}

async function saveReplayAndShare(winnerColor){
  if(!state.history || !state.history.length) return null;
  try{
    await tcEnsureFb();
    const id = 'R'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,6).toUpperCase();
    const moves = state.history.map(h=>({
      from: h.from, to: h.to,
      piece: h.piece, captured: h.captured || null,
      kind: h.kind || null
    }));
    const now = Date.now();
    const payload = {
      id,
      moves,
      winner: winnerColor || null,
      result: winnerColor ? (winnerColor+'_win') : 'draw',
      createdAt: now,
      expiresAt: now + REPLAY_TTL_MS,
      roomCode: (state.online && state.online.roomCode) || null,
      by: (playerSession && playerSession.code) || (getCoinIdentity() && getCoinIdentity().code) || 'guest'
    };
    await fb.db.ref('replays/'+id).set(payload);
    const url = location.origin + location.pathname + '?replay=' + id;
    try{ await navigator.clipboard.writeText(url); }catch(e){}
    const bar = document.getElementById('replayShareBar');
    if(bar){
      bar.hidden = false;
      bar.removeAttribute('hidden');
      bar.style.removeProperty('display');
      bar.style.display = 'block';
      const inp = document.getElementById('replayShareUrl');
      if(inp) inp.value = url;
    }
    return url;
  }catch(e){
    console.warn('saveReplay', e);
    return null;
  }
}

function stopReplayMode(){
  stopReplayIfActive();
}

async function loadReplayFromId(id){
  if(!id) return;
  try{
    await tcEnsureFb();
    const snap = await fb.db.ref('replays/'+id).once('value');
    const data = snap.val();
    if(!data || !data.moves || !data.moves.length){
      appAlert('Không tìm thấy replay «'+id+'».', 'Replay');
      return;
    }
    const exp = typeof data.expiresAt === 'number' ? data.expiresAt
      : (typeof data.createdAt === 'number' ? data.createdAt + REPLAY_TTL_MS : 0);
    if(exp && Date.now() > exp){
      try{ await fb.db.ref('replays/'+id).remove(); }catch(err){}
      appAlert('Replay «'+id+'» đã hết hạn (24 giờ) và đã bị xóa.', 'Replay');
      return;
    }
    if(state.online && state.online.active) leaveRoom();
    stopReplayIfActive();
    document.getElementById('modalOverlay')?.classList.remove('show');
    try{ closeDrawer(); }catch(e){}
    const moves = (data.moves || []).map(m => m && ({
      from: m.from, to: m.to,
      piece: m.piece || null,
      captured: m.captured || null,
      kind: m.kind || null
    })).filter(Boolean);
    state.gameOver = true;
    state.selected = null;
    state.legalTargets = [];
    state.aiThinking = false;
    if(state.aiTimeoutId){ clearTimeout(state.aiTimeoutId); state.aiTimeoutId = null; }
    state.replay = {
      active: true,
      moves,
      index: 0,
      id,
      savedBoard: null,
      savedTurn: null,
      fromCloud: true,
      winner: data.winner || null
    };
    try{ clearCaptured(); }catch(e){}
    const box = document.getElementById('historyBox');
    if(box) box.innerHTML = '';
    rebuildReplayBoard(0);
    resetPieceLayer();
    const oldBar = document.getElementById('replayControlBar');
    if(oldBar) oldBar.style.display = 'none';
    showReplayBar();
    renderPieces();
    renderMarkers();
    updateReplayUI();
    updateStatus();
    try{ setFriendStatus && setFriendStatus('Đang xem replay - dùng thanh điều khiển phía dưới.', false); }catch(e){}
  }catch(e){
    alert('Lỗi tải replay: '+(e.message||e));
  }
}

function replayStep(dir){
  if(!state.replay || !state.replay.active) return;
  goToReplayIndex(state.replay.index + (dir > 0 ? 1 : -1));
}

function copyReplayLink(){
  const inp = document.getElementById('replayShareUrl');
  if(!inp || !inp.value) return;
  navigator.clipboard.writeText(inp.value).then(()=>{
    setFriendStatus && setFriendStatus('Đã copy link replay.', false);
  }).catch(()=>{});
}

function closeReplayShareBar(){
  const bar = document.getElementById('replayShareBar');
  if(!bar) return;
  bar.style.setProperty('display', 'none', 'important');
  bar.hidden = true;
  bar.setAttribute('hidden', '');
  try{ console.log('[replay] share bar closed'); }catch(e){}
}
try{ window.closeReplayShareBar = closeReplayShareBar; window.copyReplayLink = copyReplayLink; }catch(e){}

function isHolidayActive(h){
  const now = new Date();
  const m = now.getMonth()+1, d = now.getDate();
  if(h.months){
    return h.months.some(([mm,dd]) => mm===m && Math.abs(d-dd) <= 1);
  }
  if(h.range && h.range.length===2){
    const [a,b] = h.range;
    const t = m*100+d, t0=a[0]*100+a[1], t1=b[0]*100+b[1];
    return t >= t0 && t <= t1;
  }
  return false;
}

function mergeHolidayThemes(){
  Object.keys(HOLIDAY_THEMES).forEach(key=>{
    const h = HOLIDAY_THEMES[key];
    const id = h.id;
    THEMES[id] = {
      wood1:h.wood1, wood2:h.wood2, wood3:h.wood3,
      grain1:h.grain1, grain2:h.grain2, grain3:h.grain3,
      accent:h.accent, accentGlow:h.accentGlow
    };
    const active = isHolidayActive(h);
    THEME_META[id] = {
      name: (h.badge? h.badge+' ' : '') + h.name + (active ? ' · Đang diễn ra' : ''),
      price: active ? 0 : 40,
      event: true,
      eventKey: key,
      activeEvent: active
    };
  });
}
mergeHolidayThemes();
try{ if(typeof rebuildShopItems==='function') rebuildShopItems(); else if(typeof buildShopCatalog==='function') SHOP_ITEMS = buildShopCatalog(); }catch(e){}

function isThemeUnlocked(id){
  if(!id) return false;
  if(String(id).startsWith('theme_')) id = String(id).slice(6);
  const free = ['wood','jade','rosewood','marble'];
  if(free.includes(id)) return true;
  const meta = (typeof THEME_META !== 'undefined') ? THEME_META[id] : null;
  if(meta && meta.activeEvent && meta.price === 0) return true;
  if(meta && meta.freeEvent && typeof HOLIDAY_THEMES !== 'undefined' && isHolidayActive(HOLIDAY_THEMES[meta.eventKey])) return true;
  const list = (coinState && coinState.unlocked) ? coinState.unlocked : [];
  if(list.includes(id)) return true;
  if(list.includes('theme_'+id)) return true;
  return false;
}

async function quickChallengeFriend(friendCode, friendId){
  if(!playerSession || !playerSession.id){ setFriendStatus('Đăng nhập kỳ thủ trước.', true); return; }
  const stakeEl = document.getElementById('betStakeInput');
  const stake = Math.floor(+(stakeEl && stakeEl.value || 10));
  if(!stake || stake < 1){ setFriendStatus('Nhập số coin cược trước.', true); return; }
  const codeEl = document.getElementById('betFriendCode');
  if(codeEl) codeEl.value = friendCode || '';
  await sendBetChallenge();
}

const THEME_STORAGE_KEY = 'co-tuong-theme';

const CHECKIN_REWARD = 15;

async function logCoinDaily(bucket, amount, extra){
  try{
    if(!amount && amount !== 0) return;
    await tcEnsureFb();
    const day = todayStr();
    const ref = fb.db.ref('admin/coinDaily/'+day+'/'+bucket);
    await ref.transaction(cur=>{
      const base = (cur && typeof cur === 'object') ? cur : { total:0, count:0 };
      return {
        total: Math.max(0, +(base.total||0)) + Math.floor(+amount||0),
        count: Math.max(0, +(base.count||0)) + 1,
        updatedAt: Date.now(),
        ...(extra && typeof extra === 'object' ? {} : {})
      };
    });
  }catch(e){ console.warn('logCoinDaily', bucket, e); }
}

const REPLAY_TTL_MS = 24 * 60 * 60 * 1000;

const CHEAT_DAILY_LIMIT = 20;
const CHEAT_BUY_USES = 10;
const CHEAT_BUY_COST = 30;
const AI_WIN_REWARD = [0, 2, 3, 4, 5, 7, 9, 12, 15, 20, 26];
const AI_PROFIT_PCT = [0, 0.05, 0.08, 0.10, 0.14, 0.20, 0.28, 0.38, 0.50, 0.65, 0.85];
const AI_STAKE_BANKROLL_FRAC = 0.25;

function buildShopCatalog(){
  const out = {};
  const seen = new Set();
  let i = 0;
  const gifts = (typeof SHOP_GIFTS !== 'undefined' && Array.isArray(SHOP_GIFTS)) ? SHOP_GIFTS : [];
  gifts.forEach(row=>{
    let emoji, name, cat, price, image;
    if(row && typeof row === 'object' && !Array.isArray(row)){
      emoji = row.emoji; name = row.name; cat = row.cat || 'special';
      price = row.price; image = row.image || row.img || null;
    } else if(Array.isArray(row)){
      emoji = row[0]; name = row[1]; cat = row[2]; price = row[3]; image = row[4] || null;
    } else return;
    if(emoji === ' dumpling'){ emoji = '🥟'; name = name || 'Bánh bao'; }
    if(!emoji && !image) return;
    if(emoji && seen.has(emoji) && !image) return;
    if(emoji) seen.add(emoji);
    i++;
    const id = 'item_'+i;
    out[id] = {
      id, cat: cat||'special', type:'gift', name: name||('Món '+i),
      emoji: emoji||'🎁', price: Math.max(5, +price||10), image: image||null,
      desc: (name||'Quà') + (image ? ' — ảnh: '+image : ' — quà ảo')
    };
  });
  const themeEmoji = {};
  if(typeof THEME_META !== 'undefined'){
    Object.keys(THEME_META).forEach(tid=>{
      const meta = THEME_META[tid];
      if(!meta || !meta.price) return;
      const flag = (typeof THEME_FLAGS !== 'undefined' && THEME_FLAGS[tid]) ? THEME_FLAGS[tid] : null;
      let em = themeEmoji[tid] || (flag ? '' : '🎨');
      if(!flag){ if(seen.has(em)) em = '🎨'; if(em) seen.add(em); }
      out['theme_'+tid] = {
        id:'theme_'+tid, cat:'theme', type:'theme', themeId:tid,
        name:'Giao diện '+meta.name, emoji: em||'', flag: flag||null,
        club: !!meta.club, clubSlug: meta.slug||null, price: meta.price,
        desc: flag ? ('Cờ «'+meta.name+'»') : (meta.club ? ('CLB «'+meta.name+'»') : ('Theme «'+meta.name+'»'))
      };
    });
  }
  if(typeof THEME_CLUBS !== 'undefined'){
    Object.keys(THEME_CLUBS).forEach(id=>{
      const cl = THEME_CLUBS[id];
      out['theme_'+id] = {
        id:'theme_'+id, cat:'theme', type:'theme', themeId:id,
        name:'Giao diện '+cl.name, emoji:'⚽', flag:null, club:true,
        clubSlug:cl.slug, price:cl.price||70, desc:'CLB «'+cl.name+'»'
      };
    });
  }
  return out;
}
let SHOP_ITEMS = buildShopCatalog();
let VIP_PACKAGES = {};
function sortedVipPackageList(){
  return Object.values(VIP_PACKAGES).sort((a,b)=>{
    const sa = (a.sortOrder != null) ? +a.sortOrder : 9999;
    const sb = (b.sortOrder != null) ? +b.sortOrder : 9999;
    if(sa !== sb) return sa - sb;
    return String(a.name||a.id).localeCompare(String(b.name||b.id), 'vi');
  });
}
function mergeVipPackagesIntoShop(){
  sortedVipPackageList().forEach(p=>{
    if(!p || !p.id) return;
    const id = p.id;
    const permanent = !!(p.permanent || p.days===0);
    const dayLabel = permanent ? 'vĩnh viễn' : ((p.days||1)+' ngày');
    const tier = p.tier || 'vip';
    SHOP_ITEMS[id] = {
      id, cat: 'vip', type: 'vip',
      name: p.name || ('VIP '+dayLabel),
      emoji: permanent ? '💎' : '👑',
      price: Math.max(1, +p.price||50),
      days: permanent ? 0 : Math.max(1, +p.days||1),
      permanent,
      tier,
      badge: p.badge || tier,
      bonusCoins: Math.max(0, +p.bonusCoins||0),
      sortOrder: (p.sortOrder != null) ? +p.sortOrder : 9999,
      desc: 'Gói '+dayLabel+(p.bonusCoins?' · +'+p.bonusCoins+' coin':'')
    };
  });
}
async function saveVipPackageOrder(orderedIds){
  try{
    await adminEnsureFb();
    const updates = {};
    orderedIds.forEach((id, i)=>{
      if(!id || !VIP_PACKAGES[id]) return;
      VIP_PACKAGES[id].sortOrder = i;
      updates[id+'/sortOrder'] = i;
    });
    if(Object.keys(updates).length){
      await fb.db.ref('admin/vipPackages').update(updates);
    }
    mergeVipPackagesIntoShop();
    rebuildShopItems();
  }catch(e){
    console.warn('saveVipPackageOrder', e);
    setAdminStatus('Lỗi lưu thứ tự: '+(e.message||e), 'err');
  }
}
async function moveVipPackage(id, dir){
  const list = sortedVipPackageList();
  const idx = list.findIndex(p => p.id === id);
  if(idx < 0) return;
  const j = idx + dir;
  if(j < 0 || j >= list.length) return;
  const ids = list.map(p => p.id);
  const tmp = ids[idx]; ids[idx] = ids[j]; ids[j] = tmp;
  await saveVipPackageOrder(ids);
  adminRenderVipPackages();
}
function rebuildShopItems(){
  try{ SHOP_ITEMS = buildShopCatalog(); mergeVipPackagesIntoShop(); }catch(e){}
}
async function loadVipPackages(){
  VIP_PACKAGES = {};
  try{
    if(!fbAvailable()) { mergeVipPackagesIntoShop(); return; }
    await fbEnsureAuthOptional();
    const snap = await fb.db.ref('admin/vipPackages').once('value');
    const all = snap.val() || {};
    /* Không còn gói mặc định — chỉ load từ Firebase */
    Object.keys(all).forEach(k=>{ VIP_PACKAGES[k] = Object.assign({ id:k }, all[k]); });
  }catch(e){
    console.warn('loadVipPackages', e);
    VIP_PACKAGES = {};
  }
  mergeVipPackagesIntoShop();
}
let shopTab = 'all';
let invTab = 'all';
let shopPage = 0;
const SHOP_PAGE_SIZE = 60;

let coinState = { coins: 0, unlocked: ['wood','jade','rosewood','marble'], lastCheckIn: '', inventory: {}, active: {}, cheatDate: '', cheatUsed: 0, cheatBonus: 0 };

function todayStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}


function themeLuminance(hex){
  if(!hex || typeof hex !== 'string') return 0.35;
  let h = hex.trim().replace('#','');
  if(h.length === 3) h = h.split('').map(c=>c+c).join('');
  if(h.length !== 6) return 0.35;
  const r = parseInt(h.slice(0,2),16)/255;
  const g = parseInt(h.slice(2,4),16)/255;
  const b = parseInt(h.slice(4,6),16)/255;
  const lin = v => (v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
  return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
}

function resolveThemeColors(themeId){
  const base = (THEMES && THEMES[themeId]) ? Object.assign({}, THEMES[themeId]) : Object.assign({}, THEMES.wood);
  const club = (typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[themeId]) ? THEME_CLUBS[themeId] : null;
  if(club){
    Object.keys(club).forEach(k=>{
      if(club[k] != null && k !== 'slug' && k !== 'name' && k !== 'price') base[k] = club[k];
    });
  }
  return base;
}

function applyClubLineAndGlyph(t){
  const root = document.documentElement.style;
  const L = themeLuminance(t.bg || t.wood1 || '#6e4324');

  let lineMode = t.line;
  if(lineMode !== 'white' && lineMode !== 'black'){
    lineMode = (L < 0.32) ? 'white' : 'black';
  }
  const lineStroke = (lineMode === 'white')
    ? 'rgba(255,255,255,0.72)'
    : 'rgba(20,12,8,0.62)';
  const borderStroke = (lineMode === 'white')
    ? 'rgba(255,255,255,0.88)'
    : 'rgba(15,8,5,0.78)';
  const riverFill = (lineMode === 'white')
    ? 'rgba(255,255,255,0.4)'
    : 'rgba(30,18,10,0.4)';
  root.setProperty('--line', lineStroke);

  const grid = document.getElementById('gridGroup');
  if(grid){
    grid.querySelectorAll('.gridline').forEach(el => el.setAttribute('stroke', lineStroke));
    grid.querySelectorAll('.border-line,.palace-line').forEach(el => el.setAttribute('stroke', borderStroke));
    grid.querySelectorAll('.point').forEach(el => el.setAttribute('stroke', lineStroke));
    grid.querySelectorAll('.river-text').forEach(el => el.setAttribute('fill', riverFill));
  }

  let glyphMode = t.glyph;
  if(glyphMode !== 'white' && glyphMode !== 'black'){
    glyphMode = (L < 0.32) ? 'white' : 'black';
  }
  if(glyphMode === 'white'){
    root.setProperty('--piece-glyph-red', '#fff5f0');
    root.setProperty('--piece-glyph-black', '#ffffff');
    root.setProperty('--piece-rim-red', 'rgba(255,230,210,0.7)');
    root.setProperty('--piece-rim-black', 'rgba(255,255,255,0.4)');
  } else {
    root.setProperty('--piece-glyph-red', '#4a0a06');
    root.setProperty('--piece-glyph-black', '#1a1a1a');
    root.setProperty('--piece-rim-red', 'rgba(120,30,20,0.45)');
    root.setProperty('--piece-rim-black', 'rgba(0,0,0,0.35)');
  }
  document.documentElement.dataset.lineMode = lineMode;
  document.documentElement.dataset.glyphMode = glyphMode;
}

function resetDefaultBoardAndGlyph(){
  const root = document.documentElement.style;
  root.setProperty('--line', '#3a2513');
  root.setProperty('--piece-glyph-red', '#4a0a06');
  root.setProperty('--piece-glyph-black', '#eee');
  root.setProperty('--piece-rim-red', 'rgba(255,220,200,0.55)');
  root.setProperty('--piece-rim-black', 'rgba(255,255,255,0.28)');
  delete document.documentElement.dataset.lineMode;
  delete document.documentElement.dataset.glyphMode;
  const grid = document.getElementById('gridGroup');
  if(grid){
    grid.querySelectorAll('.gridline,.border-line,.palace-line,.point').forEach(el => {
      el.removeAttribute('stroke');
    });
    grid.querySelectorAll('.river-text').forEach(el => el.removeAttribute('fill'));
  }
}

function applyTheme(themeId, opts={}){
  if(!THEMES[themeId] && !(typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[themeId])) themeId = 'wood';
  if(!opts.force && !isThemeUnlocked(themeId)){
    setCheckInStatus('Giao diện «'+(THEME_META[themeId]?.name||themeId)+'» đang khóa. Đủ coin để mở.', true);
    return false;
  }
  const isClub = !!(typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[themeId]);
  const t = resolveThemeColors(themeId);
  const root = document.documentElement.style;
  root.setProperty('--wood-1', t.wood1);
  root.setProperty('--wood-2', t.wood2);
  root.setProperty('--wood-3', t.wood3);
  root.setProperty('--jade', t.accent || '#3fae7a');
  root.setProperty('--jade-glow', t.accentGlow || '#7fe0b4');

  const stops = document.querySelectorAll('#woodGrain stop');
  if(stops.length===3){
    stops[0].setAttribute('stop-color', t.grain1 || t.wood1);
    stops[1].setAttribute('stop-color', t.grain2 || t.wood2);
    stops[2].setAttribute('stop-color', t.grain3 || t.wood3);
  }

  document.querySelectorAll('.theme-swatch').forEach(b=>{
    b.classList.toggle('active', b.dataset.theme===themeId);
  });
  try{ updateBoardFlag(themeId); }catch(e){}

  try{
    if(isClub) applyClubLineAndGlyph(t);
    else resetDefaultBoardAndGlyph();
  }catch(e){}

  if(!opts.preview){
    try{ localStorage.setItem(THEME_STORAGE_KEY, themeId); }catch(err){}
    try{ if(typeof coinState !== 'undefined') coinState.preferredTheme = themeId; }catch(e){}
    try{
      const ident = typeof getCoinIdentity === 'function' ? getCoinIdentity() : null;
      if(ident && ident.kind === 'player' && fb && fb.db){
        fb.db.ref('players/'+ident.id).update({ preferredTheme: themeId }).catch(()=>{});
      } else if(ident && ident.kind === 'admin' && fb && fb.db){
        fb.db.ref('admin/wallets/'+ident.id).update({ preferredTheme: themeId }).catch(()=>{});
      }
    }catch(e){}
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
    const svgRoot = getBoardSvg() || svg;
    let defs = svgRoot && svgRoot.querySelector('defs');
    if(defs){
      const oldF = document.getElementById('clubLogoOutlineFilter');
      if(oldF) oldF.remove();
      const outlineOn = club.outline !== false;
      const ow = Math.min(4, Math.max(0.5, +(club.outlineWidth != null ? club.outlineWidth : 1.25)));
      const oc = (club.outlineColor || '#ffffff').replace(/[^#a-fA-F0-9(),.% ]/g, '') || '#ffffff';
      const filter = document.createElementNS(ns, 'filter');
      filter.setAttribute('id', 'clubLogoOutlineFilter');
      filter.setAttribute('x', '-20%'); filter.setAttribute('y', '-20%');
      filter.setAttribute('width', '140%'); filter.setAttribute('height', '140%');
      if(outlineOn){
        filter.innerHTML =
          '<feMorphology in="SourceAlpha" operator="dilate" radius="'+ow+'" result="dilated"/>'+
          '<feFlood flood-color="'+oc+'" flood-opacity="0.95" result="flood"/>'+
          '<feComposite in="flood" in2="dilated" operator="in" result="outline"/>'+
          '<feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>'+
          '<feOffset in="blur" dx="0" dy="2" result="shadowOffset"/>'+
          '<feFlood flood-color="#000000" flood-opacity="0.35" result="shadowColor"/>'+
          '<feComposite in="shadowColor" in2="shadowOffset" operator="in" result="shadow"/>'+
          '<feMerge>'+
            '<feMergeNode in="shadow"/>'+
            '<feMergeNode in="outline"/>'+
            '<feMergeNode in="SourceGraphic"/>'+
          '</feMerge>';
      } else {
        filter.innerHTML = '<feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.4"/>';
      }
      defs.appendChild(filter);
    }
    const logoOpacity = Math.min(1, Math.max(0.05, +(club.opacity != null ? club.opacity : 0.55)));
    const logoScale = Math.min(0.95, Math.max(0.35, +(club.sizeLogo != null ? club.sizeLogo : 0.72)));
    const size = Math.min(W, H) * logoScale;
    const ox = (W - size) / 2;
    const oy = (H - size) / 2;
    const img = document.createElementNS(ns, 'image');
    img.setAttribute('id', 'boardFlagImage');
    img.setAttribute('x', String(ox));
    img.setAttribute('y', String(oy));
    img.setAttribute('width', String(size));
    img.setAttribute('height', String(size));
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    img.setAttribute('opacity', String(logoOpacity));
    const urlSvg = footyLogoUrl(club.slug);
    img.setAttribute('href', urlSvg);
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', urlSvg);
    img.setAttribute('filter', 'url(#clubLogoOutlineFilter)');
    img.setAttribute('style', 'pointer-events:none');
    layer.appendChild(img);
    return;
  }

  if(bg) bg.setAttribute('fill', '#0a0a0a');

  const svgRoot2 = getBoardSvg() || svg;
  let defs = svgRoot2 && svgRoot2.querySelector('defs');
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

  if(bg) bg.setAttribute('fill', (themeId==='japan'||code==='jp') ? '#f5f5f5' : '#da251d');
  const base = document.createElementNS(ns,'rect');
  base.setAttribute('x','0'); base.setAttribute('y','0');
  base.setAttribute('width',String(W)); base.setAttribute('height',String(H));
  base.setAttribute('rx','8'); base.setAttribute('style','pointer-events:none');
  if(themeId==='vietnam'||code==='vn'){
    base.setAttribute('fill','#da251d'); layer.appendChild(base);
    const cx=W/2,cy=H/2,R=Math.min(W,H)*0.22,r=R*0.38; let d='';
    for(let i=0;i<5;i++){ const a=-Math.PI/2+i*2*Math.PI/5,b=a+Math.PI/5;
      d+=(i===0?'M':'L')+(cx+Math.cos(a)*R).toFixed(2)+','+(cy+Math.sin(a)*R).toFixed(2)
        +' L'+(cx+Math.cos(b)*r).toFixed(2)+','+(cy+Math.sin(b)*r).toFixed(2)+' '; }
    d+='Z';
    const star=document.createElementNS(ns,'path');
    star.setAttribute('d',d); star.setAttribute('fill','#ffd700'); star.setAttribute('opacity','0.95');
    star.setAttribute('style','pointer-events:none'); layer.appendChild(star);
  } else if(themeId==='japan'||code==='jp'){
    base.setAttribute('fill','#f5f5f5'); layer.appendChild(base);
    const disc=document.createElementNS(ns,'circle');
    disc.setAttribute('cx',String(W/2)); disc.setAttribute('cy',String(H/2));
    disc.setAttribute('r',String(Math.min(W,H)*0.18));
    disc.setAttribute('fill','#bc002d'); disc.setAttribute('opacity','0.96');
    disc.setAttribute('style','pointer-events:none'); layer.appendChild(disc);
  }
  const rim=document.createElementNS(ns,'rect');
  rim.setAttribute('x','1.5'); rim.setAttribute('y','1.5');
  rim.setAttribute('width',String(W-3)); rim.setAttribute('height',String(H-3));
  rim.setAttribute('rx','10'); rim.setAttribute('fill','none');
  rim.setAttribute('stroke','rgba(0,0,0,0.12)'); rim.setAttribute('stroke-width','1.5');
  rim.setAttribute('style','pointer-events:none'); layer.appendChild(rim);
  const grid=document.getElementById('gridGroup');
  if(grid){
    const dark=(themeId==='japan'||code==='jp');
    const stroke=dark?'rgba(40,20,20,0.5)':'rgba(255,245,200,0.55)';
    const border=dark?'rgba(20,10,10,0.72)':'rgba(255,250,220,0.72)';
    grid.querySelectorAll('.gridline').forEach(el=>el.setAttribute('stroke',stroke));
    grid.querySelectorAll('.border-line,.palace-line').forEach(el=>el.setAttribute('stroke',border));
  }
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
  setShopStatus('Đang xem thử «'+name+'» - tải lại trang sẽ mất bản xem thử.', false);
  try{
    showCoinPopup({
      icon: '👁️',
      title: 'Xem thử giao diện',
      html: '<div class="coin-popup-item">«<b>'+name+'</b>»</div>'+
        '<div class="coin-popup-hint">Chỉ xem tạm trên máy này. Tải lại trang sẽ trở về giao diện đã lưu / đã mở khóa. Bấm Mở khóa để mua vĩnh viễn.</div>'
    });
  }catch(e){}
}

function ensureThemeSwatches(){
  const row = document.getElementById('themeRow');
  if(!row) return;
  const existing = new Set();
  row.querySelectorAll('.theme-swatch[data-theme]').forEach(b=> existing.add(b.dataset.theme));
  const ids = new Set();
  ['wood','jade','rosewood','marble'].forEach(id=> ids.add(id));
  if(typeof THEME_META !== 'undefined') Object.keys(THEME_META).forEach(id=> ids.add(id));
  if(typeof THEME_CLUBS !== 'undefined') Object.keys(THEME_CLUBS).forEach(id=> ids.add(id));
  if(typeof THEMES !== 'undefined') Object.keys(THEMES).forEach(id=> ids.add(id));
  if(coinState && Array.isArray(coinState.unlocked)) coinState.unlocked.forEach(id=> ids.add(id));
  ids.forEach(id=>{
    if(!id || existing.has(id)) return;
    if(!(THEMES && THEMES[id]) && !(typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[id]) && !(THEME_META && THEME_META[id])) return;
    const meta = (THEME_META && THEME_META[id]) || {};
    const club = (typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[id]) || null;
    const price = +(meta.price || (club ? 70 : 0));
    const name = meta.name || (club && club.name) || id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-swatch theme-'+id+(price? ' locked':'');
    btn.dataset.theme = id;
    btn.dataset.price = String(price);
    btn.title = name + (price ? ' · '+price+' coin' : ' (Miễn phí)');
    btn.addEventListener('click', ()=> trySelectTheme(id));
    row.appendChild(btn);
    existing.add(id);
  });
  try{ decorateThemeSwatches(); }catch(e){}
}

function refreshThemeLocks(){
  try{ ensureThemeSwatches(); }catch(e){}
  document.querySelectorAll('.theme-swatch').forEach(btn=>{
    const id = btn.dataset.theme;
    const price = +(btn.dataset.price || THEME_META[id]?.price || 0);
    const unlocked = isThemeUnlocked(id);
    btn.style.display = unlocked ? '' : 'none';
    btn.classList.toggle('locked', !unlocked);
    const name = (THEME_META[id]?.name) || (THEME_CLUBS && THEME_CLUBS[id] && THEME_CLUBS[id].name) || id;
    btn.title = name + (unlocked ? (price ? ' (Đã mở)' : ' (Miễn phí)') : (price ? ' · '+price+' coin' : ''));
    const tag = btn.querySelector('.theme-lock-tag');
    if(tag) tag.remove();
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
  try{ renderAchievementsUI(); }catch(e){}
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
  coinState = {
    coins: 0,
    unlocked: ['wood','jade','rosewood','marble'],
    lastCheckIn: '',
    inventory: {},
    active: {},
    achievements: [],
    wins: 0,
    purchases: 0,
    checkInStreak: 0,
    friendCount: 0,
    preferredTheme: null
  };
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
      coinState.unlocked = Array.from(new Set(['wood','jade','rosewood','marble', ...unlocked.map(x=> String(x).startsWith('theme_')?String(x).slice(6):x)]));
      coinState.lastCheckIn = p.lastCheckIn || '';
      coinState.inventory = (p.inventory && typeof p.inventory === 'object') ? p.inventory : {};
      coinState.active = (p.activeItems && typeof p.activeItems === 'object') ? p.activeItems : {};
      coinState.cheatDate = p.cheatDate || '';
      coinState.cheatUsed = Math.max(0, +(p.cheatUsed||0));
      coinState.cheatBonus = Math.max(0, +(p.cheatBonus||0));
      coinState.preferredTheme = p.preferredTheme || null;
      coinState.achievements = Array.isArray(p.achievements) ? p.achievements.slice() : [];
      coinState.wins = Math.max(0, +(p.wins||0));
      coinState.purchases = Math.max(0, +(p.purchases||0));
      coinState.checkInStreak = Math.max(0, +(p.checkInStreak||0));
      coinState.friendCount = Math.max(0, +(p.friendCount||0));
    } else {
      const snap = await fb.db.ref('admin/wallets/'+ident.id).once('value');
      const w = snap.val() || {};
      coinState.coins = Math.max(0, +(w.coins||0));
      coinState.lastCheckIn = w.lastCheckIn || '';
      coinState.inventory = (w.inventory && typeof w.inventory === 'object') ? w.inventory : {};
      coinState.active = {};
      coinState.cheatDate = w.cheatDate || '';
      coinState.cheatUsed = Math.max(0, +(w.cheatUsed||0));
      coinState.cheatBonus = Math.max(0, +(w.cheatBonus||0));
      coinState.preferredTheme = w.preferredTheme || null;
      coinState.achievements = Array.isArray(w.achievements) ? w.achievements.slice() : [];
      coinState.wins = Math.max(0, +(w.wins||0));
      coinState.purchases = Math.max(0, +(w.purchases||0));
      coinState.checkInStreak = Math.max(0, +(w.checkInStreak||0));
      coinState.friendCount = Math.max(0, +(w.friendCount||0));
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
  try{ refreshCheatUsesUI(); }catch(e){}
  try{ evaluateAchievements(true, { skipReload:true }).then(()=> renderAchievementsUI()).catch(()=> renderAchievementsUI()); }catch(e){
    try{ renderAchievementsUI(); }catch(e2){}
  }

  try{
    let t = coinState.preferredTheme || null;
    if(!t){ try{ t = localStorage.getItem(THEME_STORAGE_KEY); }catch(e){} }
    if(t && isThemeUnlocked(t)){
      applyTheme(t, { force:true, preview:false });
    }
  }catch(e){}
  try{ refreshThemeLocks(); }catch(e){}
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
        activeItems: coinState.active || {},
        cheatDate: coinState.cheatDate || null,
        cheatUsed: Math.max(0, +(coinState.cheatUsed||0)),
        cheatBonus: Math.max(0, +(coinState.cheatBonus||0)),
        achievements: Array.isArray(coinState.achievements) ? coinState.achievements : [],
        wins: Math.max(0, +(coinState.wins||0)),
        purchases: Math.max(0, +(coinState.purchases||0)),
        checkInStreak: Math.max(0, +(coinState.checkInStreak||0)),
        friendCount: Math.max(0, +(coinState.friendCount||0)),
        preferredTheme: coinState.preferredTheme || null
      });
    } else {
      await fb.db.ref('admin/wallets/'+ident.id).update({
        coins: coinState.coins,
        lastCheckIn: coinState.lastCheckIn || null,
        inventory: coinState.inventory || {},
        cheatDate: coinState.cheatDate || null,
        cheatUsed: Math.max(0, +(coinState.cheatUsed||0)),
        cheatBonus: Math.max(0, +(coinState.cheatBonus||0)),
        achievements: Array.isArray(coinState.achievements) ? coinState.achievements : [],
        wins: Math.max(0, +(coinState.wins||0)),
        purchases: Math.max(0, +(coinState.purchases||0)),
        checkInStreak: Math.max(0, +(coinState.checkInStreak||0)),
        preferredTheme: coinState.preferredTheme || null,
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
    showCoinPopup({
      warn: true,
      icon: '🔒',
      title: 'Cần đăng nhập',
      html: '<div class="coin-popup-hint">Bạn phải <b>đăng nhập kỳ thủ</b> hoặc liên hệ Admin để điểm danh nhận coin mỗi ngày.</div>',
      okLabel: 'Đóng'
    });
    return;
  }
  const btn = document.getElementById('checkInBtn');
  if(btn) btn.disabled = true;
  try{
    await loadCoinStateFromPlayer();
    const today = todayStr();
    if(coinState.lastCheckIn === today){
      setCheckInStatus('Hôm nay «'+ident.name+'» đã điểm danh rồi.', true);
      showCoinPopup({
        icon: '📅',
        title: 'Đã điểm danh hôm nay',
        html: '<div class="coin-popup-hint">Hôm nay «'+ident.name+'» đã điểm danh rồi. Quay lại vào ngày mai nhé!</div>',
        okLabel: 'Đóng'
      });
      refreshThemeLocks();
      return;
    }
    const before = Math.max(0, +(coinState.coins||0));
    const reward = CHECKIN_REWARD;
    coinState.lastCheckIn = today;
    coinState.coins = before + reward;
    const prevStreak = Math.max(0, +(coinState.checkInStreak||0));
    coinState.checkInStreak = prevStreak + 1;
    await saveCoinStateToPlayer();
    try{
      await fb.db.ref('admin/checkIns/'+today+'/'+ident.id).set({
        code: ident.code || '',
        name: ident.name || '',
        kind: ident.kind,
        ts: Date.now(),
        reward
      });
      try{ await logCoinDaily('checkIn', reward); }catch(e){}
      if(ident.kind === 'player'){
        await fb.db.ref('players/'+ident.id).update({ lastCheckInTs: Date.now() });
      }
    }catch(e){ console.warn('checkIn log', e); }
    refreshThemeLocks();
    setCheckInStatus('Điểm danh thành công ('+ident.name+')! +'+reward+' coin · Số dư: '+coinState.coins, false);
    showCoinPopup({
      icon: '✅',
      title: 'Điểm danh thành công!',
      html: '<ul class="coin-popup-list">'+
        '<li>Coin trước: <b>'+before+'</b></li>'+
        '<li>Thưởng điểm danh: <b>+'+reward+'</b></li>'+
        '<li>Tổng sau điểm danh: <b>'+coinState.coins+'</b></li>'+
        '<li>Chuỗi điểm danh: <b>'+coinState.checkInStreak+'</b> ngày</li>'+
        '</ul>',
      okLabel: 'Đóng'
    });
    try{ closeDrawer(); }catch(e){}
    try{ await evaluateAchievements(false); }catch(e){}
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
    showCoinPopup({
      warn:true, icon:'🔒', title:'Cần đăng nhập',
      html:'<div class="coin-popup-hint">Đăng nhập kỳ thủ để mở khóa giao diện «'+(THEME_META[themeId]?.name||themeId)+'» ('+price+' coin).</div>',
      okLabel:'Đóng'
    });
    return;
  }
  await loadCoinStateFromPlayer();
  if(isThemeUnlocked(themeId)){
    applyTheme(themeId);
    return;
  }
  if(coinState.coins < price){
    setCheckInStatus('Không đủ coin (cần '+price+', đang có '+coinState.coins+'). Hãy điểm danh mỗi ngày.', true);
    showCoinPopup({
      warn:true, icon:'💸', title:'Không đủ coin',
      html:'<ul class="coin-popup-list"><li>Giao diện: <b>'+(THEME_META[themeId]?.name||themeId)+'</b></li><li>Giá: <b>'+price+'</b></li><li>Bạn có: <b>'+coinState.coins+'</b></li><li>Thiếu: <b class="coin-miss">'+(price-coinState.coins)+'</b></li></ul>',
      okLabel:'Đóng'
    });
    return;
  }
  const ok = await showCoinPopup({
    confirm:true, icon:'🎨', title:'Mở khóa giao diện',
    html:'<ul class="coin-popup-list"><li>«'+(THEME_META[themeId]?.name||themeId)+'»</li><li>Giá: <b>'+price+'</b> coin</li><li>Sau mua còn: <b>'+(coinState.coins-price)+'</b></li></ul>',
    okLabel:'Mua', cancelLabel:'Hủy'
  });
  if(!ok) return;
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

let _coinPopupResolver = null;


/** Popup xác nhận thay window.confirm */
function appConfirm(message, title){
  return showCoinPopup({
    confirm: true,
    warn: true,
    icon: '❓',
    title: title || 'Xác nhận',
    html: '<div class="coin-popup-hint">'+(message||'')+'</div>',
    okLabel: 'Đồng ý',
    cancelLabel: 'Hủy'
  });
}
/** Popup thông báo thay window.alert */
function appAlert(message, title, icon){
  return showCoinPopup({
    icon: icon || 'ℹ️',
    title: title || 'Thông báo',
    html: '<div class="coin-popup-hint">'+(message||'')+'</div>',
    okLabel: 'Đóng'
  });
}

const POPUP_FA_ICONS = {
  '💰': 'fa-solid fa-coins',
  '✅': 'fa-solid fa-circle-check',
  '❌': 'fa-solid fa-circle-xmark',
  '⚠️': 'fa-solid fa-triangle-exclamation',
  '🔒': 'fa-solid fa-lock',
  '💸': 'fa-solid fa-money-bill-wave',
  '🎁': 'fa-solid fa-gift',
  '👑': 'fa-solid fa-crown',
  'ℹ️': 'fa-solid fa-circle-info',
  '❓': 'fa-solid fa-circle-question',
  '🎲': 'fa-solid fa-dice',
  '🪙': 'fa-solid fa-coins',
  '👋': 'fa-solid fa-hand-wave',
  '🏰': 'fa-solid fa-chess-rook',
  '🔐': 'fa-solid fa-shield-halved',
  '🎖️': 'fa-solid fa-medal',
  '⏰': 'fa-solid fa-clock',
  '🚫': 'fa-solid fa-ban',
  '🛡️': 'fa-solid fa-shield',
  '🎨': 'fa-solid fa-palette',
  '⚡': 'fa-solid fa-bolt'
};
function popupFaIcon(icon){
  if(!icon) return 'fa-solid fa-coins';
  if(String(icon).indexOf('fa-') >= 0) return String(icon).replace(/^fa /,'fa-solid ');
  return POPUP_FA_ICONS[icon] || 'fa-solid fa-circle-info';
}
function showCoinPopup(opts){
  const o = opts || {};
  const overlay = document.getElementById('coinPopupOverlay');
  if(!overlay){
    if(o.confirm) return Promise.resolve(window.confirm(o.body || o.title || 'OK?'));
    alert(o.body || o.title || '');
    return Promise.resolve(false);
  }
  if(_coinPopupResolver){
    try{ _coinPopupResolver(false); }catch(e){}
    _coinPopupResolver = null;
  }
  const icon = document.getElementById('coinPopupIcon');
  const title = document.getElementById('coinPopupTitle');
  const body = document.getElementById('coinPopupBody');
  const okBtn = document.getElementById('coinPopupOk');
  const cancelBtn = document.getElementById('coinPopupCancel');
  if(icon){
    const fa = popupFaIcon(o.icon || (o.warn ? '⚠️' : '💰'));
    icon.innerHTML = '<i class="'+fa+'"></i>';
  }
  if(title) title.textContent = o.title || 'Thông báo';
  if(body){
    if(o.html) body.innerHTML = o.html;
    else body.textContent = o.body || '';
  }
  overlay.classList.add('show');
  overlay.classList.toggle('warn', !!o.warn);
  const isConfirm = !!o.confirm;
  if(cancelBtn){
    cancelBtn.style.display = isConfirm ? '' : 'none';
    cancelBtn.textContent = o.cancelLabel || 'Hủy mua';
  }
  if(okBtn){
    okBtn.textContent = isConfirm ? (o.okLabel || 'Mua') : (o.okLabel || 'Đóng');
    okBtn.classList.toggle('coin-popup-buy', isConfirm && !o.warn);
  }
  if(isConfirm){
    return new Promise(resolve=>{ _coinPopupResolver = resolve; });
  }
  return Promise.resolve(true);
}
function closeCoinPopup(result){
  document.getElementById('coinPopupOverlay')?.classList.remove('show');
  const okBtn = document.getElementById('coinPopupOk');
  if(okBtn){
    okBtn.textContent = 'Đóng';
    okBtn.classList.remove('coin-popup-buy');
  }
  const cancelBtn = document.getElementById('coinPopupCancel');
  if(cancelBtn) cancelBtn.style.display = 'none';
  if(_coinPopupResolver){
    const r = _coinPopupResolver;
    _coinPopupResolver = null;
    try{ r(!!result); }catch(e){}
  }
}

function setInvStatus(msg, warn){
  const el = document.getElementById('invStatus');
  if(el){ el.textContent = msg||''; el.className = 'online-status'+(warn?' warn': msg?' live':''); }
}

function openShopPanel(){
  document.getElementById('shopOverlay')?.classList.add('show');
  document.getElementById('invOverlay')?.classList.remove('show');
  closeDrawer();
  loadVipPackages().then(()=> loadCoinStateFromPlayer()).then(()=> renderShopList()).catch(()=> renderShopList());
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
    if(it.type === 'vip') return true;
    /* Đã có trong kho (mua / giftcode / đấu giá / tặng) → ẩn khỏi cửa hàng */
    if(+inv[it.id] > 0) return false;
    return true;
  });
  items.sort((a,b)=> ((a.sortOrder!=null?+a.sortOrder:9999)-(b.sortOrder!=null?+b.sortOrder:9999)) || String(a.name||'').localeCompare(String(b.name||''),'vi'));
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
  const tab = invTab || 'all';
  const inv = coinState.inventory || {};
  const freeThemes = ['wood','jade','rosewood','marble'];
  const rows = [];

  Object.keys(inv).forEach(id=>{
    const qty = +(inv[id]||0);
    if(qty <= 0 || !SHOP_ITEMS[id]) return;
    const it = SHOP_ITEMS[id];
    if(tab !== 'all' && it.cat !== tab) return;
    rows.push({ kind:'gift', id, it, qty });
  });

  if(tab === 'all' || tab === 'theme'){
    const unlocked = Array.isArray(coinState.unlocked) ? coinState.unlocked : [];
    const seen = new Set();
    unlocked.forEach(tid=>{
      if(!tid || freeThemes.includes(tid) || seen.has(tid)) return;
      if(String(tid).startsWith('theme_')) tid = String(tid).slice(6);
      if(freeThemes.includes(tid) || seen.has(tid)) return;
      seen.add(tid);
      const meta = (typeof THEME_META !== 'undefined' && THEME_META[tid]) || {};
      const club = (typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[tid]) || null;
      if(!meta.name && !club && !(THEMES && THEMES[tid])) return;
      const name = meta.name || (club && club.name) || tid;
      const price = +(meta.price || (club ? 70 : 0));
      const shopIt = SHOP_ITEMS['theme_'+tid] || null;
      rows.push({
        kind:'theme',
        id: tid,
        it: shopIt || {
          id: 'theme_'+tid, type:'theme', themeId:tid, cat:'theme',
          name, price, emoji: (shopIt && shopIt.emoji) || '🎨',
          flag: (typeof THEME_FLAGS !== 'undefined' && THEME_FLAGS[tid]) || null,
          clubSlug: club && (club.slug || meta.slug) || null
        },
        qty: 1
      });
    });
  }

  if(!rows.length){
    box.innerHTML = '<div class="admin-empty">Kho trống ở mục này - mua trong Cửa hàng hoặc nhận mã quà.</div>';
    return;
  }

  rows.sort((a,b)=>{
    if(a.kind !== b.kind) return a.kind === 'theme' ? -1 : 1;
    return (a.it.name||'').localeCompare(b.it.name||'', 'vi');
  });

  const grid = document.createElement('div');
  grid.className = 'shop-grid inv-grid';
  rows.forEach(row=>{
    const it = row.it;
    const card = document.createElement('div');
    card.className = 'gift-card owned inv-card'+(row.kind==='theme'?' inv-theme-card':'');
    const emoji = (typeof shopItemIconHtml === 'function') ? shopItemIconHtml(it) : (it.emoji||'🎁');
    if(row.kind === 'theme'){
      const sellPrice = Math.floor((it.price||50) * 0.6);
      card.innerHTML =
        '<div class="gift-emoji gift-emoji-icon">'+emoji+'</div>'+
        '<div class="gift-name">'+it.name+'</div>'+
        '<div class="gift-desc">Giao diện · Đã mở</div>'+
        '<div class="gift-price">Đã sở hữu</div>'+
        '<div class="gift-actions inv-actions inv-actions-col">'+
          '<button type="button" class="action-btn gift-code-btn" title="Tạo mã">Mã</button>'+
          '<button type="button" class="action-btn gift-sell-btn">Bán</button>'+
          '<button type="button" class="action-btn gift-auction-btn">Đấu giá</button>'+
          '<button type="button" class="action-btn inv-use-theme">Dùng giao diện</button>'+
        '</div>';
      card.querySelector('.inv-use-theme').addEventListener('click', ()=>{
        applyTheme(row.id, { force:true });
        setInvStatus('Đã áp dụng giao diện «'+it.name+'».', false);
        try{ refreshThemeLocks(); }catch(e){}
      });
      card.querySelector('.gift-code-btn')?.addEventListener('click', ()=> createGiftCode(it.id || ('theme_'+row.id)));
      card.querySelector('.gift-sell-btn')?.addEventListener('click', ()=> showCoinPopup({ warn:true, icon:'ℹ️', title:'Giao diện', html:'<div class="coin-popup-hint">Giao diện đã mở khóa không bán được. Có thể tạo mã hoặc đấu giá nếu hệ thống hỗ trợ.</div>', okLabel:'Đóng' }));
      card.querySelector('.gift-auction-btn')?.addEventListener('click', ()=> listItemForAuction(it.id || ('theme_'+row.id)));
    } else {
      const sellPrice = Math.floor((it.price||0) * 0.6);
      card.innerHTML =
        '<div class="gift-emoji gift-emoji-icon">'+emoji+'</div>'+
        '<div class="gift-name">'+it.name+'</div>'+
        '<div class="gift-desc">×'+row.qty+'</div>'+
        '<div class="gift-price">Bán ~'+sellPrice+'c</div>'+
        '<div class="gift-actions inv-actions inv-actions-col">'+
          '<button type="button" class="action-btn gift-code-btn" title="Tạo mã XK">Mã</button>'+
          '<button type="button" class="action-btn gift-sell-btn">Bán</button>'+
          '<button type="button" class="action-btn gift-auction-btn">Đấu giá</button>'+
        '</div>';
      card.querySelector('.gift-code-btn').addEventListener('click', ()=> createGiftCode(row.id));
      card.querySelector('.gift-sell-btn').addEventListener('click', ()=> sellInventoryItem(row.id));
      card.querySelector('.gift-auction-btn').addEventListener('click', ()=> listItemForAuction(row.id));
    }
    grid.appendChild(card);
  });
  box.appendChild(grid);
}


function buildShopCard(){ return document.createElement('div'); }

async function buyShopItem(itemId){
  const it = SHOP_ITEMS[itemId];
  if(!it) return;
  if(!getCoinIdentity()){
    setShopStatus('Đăng nhập Kỳ thủ hoặc Admin để mua.', true);
    showCoinPopup({
      warn:true,
      icon:'🔒',
      title:'Cần đăng nhập',
      html:'<div class="coin-popup-hint">Bạn cần <b>đăng nhập kỳ thủ</b> để mua vật phẩm / mở khóa giao diện trong cửa hàng.</div>',
      okLabel:'Đóng'
    });
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
      setShopStatus('Không đủ coin - có '+have+', cần '+need+', thiếu '+missing+'.', true);
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
    const okTheme = await showCoinPopup({
      confirm:true, icon: it.emoji||'🎨', title:'Xác nhận mở khóa',
      okLabel:'Mua', cancelLabel:'Hủy mua',
      html: '<div class="coin-popup-item" style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px;">'+(it.emoji||'🎨')+' <b>'+it.name+'</b></div>'+
        '<ul class="coin-popup-list"><li>Giá: <b>'+need+'</b> coin</li><li>Số dư hiện tại: <b>'+have+'</b> coin</li><li>Sau khi mua còn: <b>'+(have-need)+'</b> coin</li></ul>'
    });
    if(!okTheme) return;
    coinState.coins = have - need;
    if(!Array.isArray(coinState.unlocked)) coinState.unlocked = ['wood','jade','rosewood','marble'];
    const tid = it.themeId;
    if(tid && !coinState.unlocked.includes(tid)) coinState.unlocked.push(tid);
    coinState.preferredTheme = tid;
    coinState.purchases = Math.max(0, +(coinState.purchases||0)) + 1;
    await saveCoinStateToPlayer();
    applyTheme(tid, { force:true });
    refreshThemeLocks();
    renderShopList();
    setShopStatus('Đã mở '+(it.emoji||'')+' «'+it.name+'». Còn '+coinState.coins+' coin.', false);
    showCoinPopup({ icon:'✅', title:'Mua thành công', html:'<div class="coin-popup-item">'+(it.emoji||'')+' <b>'+it.name+'</b></div><ul class="coin-popup-list"><li>Đã trừ: <b>'+need+'</b> coin</li><li>Còn lại: <b>'+coinState.coins+'</b> coin</li></ul>' });
    try{ await evaluateAchievements(false); }catch(e){}
    return;
  }

  if(it.type === 'vip'){
    if(!playerSession || !playerSession.id){
      showCoinPopup({ warn:true, icon:'🔒', title:'Cần đăng nhập kỳ thủ', html:'<div class="coin-popup-hint">Chỉ tài khoản kỳ thủ mới mua được gói VIP.</div>', okLabel:'Đóng' });
      return;
    }
    if(have < need){
      showCoinPopup({ warn:true, icon:'💸', title:'Không đủ coin', html:'<ul class="coin-popup-list"><li>Gói: <b>'+it.name+'</b></li><li>Giá: <b>'+need+'</b></li><li>Bạn có: <b>'+have+'</b></li></ul>', okLabel:'Đóng' });
      return;
    }
    const permanent = !!(it.permanent || it.days===0);
    const days = permanent ? 0 : Math.max(1, +(it.days||1));
    const bonus = Math.max(0, +(it.bonusCoins||0));
    const dayLabel = permanent ? 'Vĩnh viễn' : (days+' ngày');
    const okVip = await showCoinPopup({
      confirm:true, icon:'👑', title:'Mua gói thành viên',
      okLabel:'Mua', cancelLabel:'Hủy',
      html:'<ul class="coin-popup-list"><li>'+it.name+'</li><li>Thời hạn: <b>'+dayLabel+'</b></li><li>Giá: <b>'+need+'</b> coin</li>'+(bonus?'<li>Thưởng kèm: <b>+'+bonus+'</b> coin</li>':'')+'</ul>'
    });
    if(!okVip) return;
    coinState.coins = have - need + bonus;
    coinState.purchases = Math.max(0, +(coinState.purchases||0)) + 1;
    await saveCoinStateToPlayer();
    try{
      await tcEnsureFb();
      const pSnap = await fb.db.ref('players/'+playerSession.id).once('value');
      const p = pSnap.val() || {};
      const now = Date.now();
      let newExp;
      if(permanent){
        newExp = 0; /* 0 = không hết hạn */
      } else {
        const curExp = Math.max(now, +(p.vipExpires||0));
        newExp = curExp + days * 24 * 60 * 60 * 1000;
      }
      const patch = {
        role: 'vip',
        vipExpires: newExp,
        vipPermanent: permanent,
        memberTier: it.tier || it.badge || 'vip',
        coins: coinState.coins
      };
      await fb.db.ref('players/'+playerSession.id).update(patch);
      playerSession.role = 'vip';
      playerSession.vipExpires = newExp;
      playerSession.memberTier = it.tier || 'vip';
      savePlayerSession(playerSession);
    }catch(e){ console.warn('vip role update', e); }
    renderShopList();
    refreshThemeLocks();
    setShopStatus('Đã kích hoạt '+it.name+' ('+dayLabel+').', false);
    const expLabel = permanent ? 'Vĩnh viễn' : new Date((playerSession.vipExpires||Date.now())).toLocaleString('vi-VN');
    showCoinPopup({ icon:'👑', title:'Đã kích hoạt!', html:'<ul class="coin-popup-list"><li>'+it.name+'</li><li>Hết hạn: <b>'+expLabel+'</b></li><li>Số dư: <b>'+coinState.coins+'</b></li></ul>', okLabel:'Đóng' });
    try{ await evaluateAchievements(false); }catch(e){}
    return;
  }

  if(have < need){
    setShopStatus('Không đủ coin - có '+have+', cần '+need+', thiếu '+missing+'.', true);
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
  const okBuy = await showCoinPopup({
    confirm:true, icon: it.emoji||'🛒', title:'Xác nhận mua',
    okLabel:'Mua', cancelLabel:'Hủy mua',
    html: '<div class="coin-popup-item" style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px;">'+(it.emoji||'🎁')+' <b>'+it.name+'</b></div>'+
      '<ul class="coin-popup-list"><li>Giá: <b>'+need+'</b> coin</li><li>Số dư hiện tại: <b>'+have+'</b> coin</li><li>Sau khi mua còn: <b>'+(have-need)+'</b> coin</li></ul>'
  });
  if(!okBuy) return;
  coinState.coins = have - need;
  if(!coinState.inventory) coinState.inventory = {};
  coinState.inventory[it.id] = (coinState.inventory[it.id]||0) + 1;
  await saveCoinStateToPlayer();
  refreshThemeLocks();
  renderShopList();
  try{ renderInventoryList(); }catch(e){}
  coinState.purchases = Math.max(0, +(coinState.purchases||0)) + 1;
  setShopStatus('Đã mua '+(it.emoji||'🎁')+' «'+it.name+'». Còn '+coinState.coins+' coin.', false);
  showCoinPopup({ icon:'✅', title:'Mua thành công', html:'<div class="coin-popup-item">'+(it.emoji||'🎁')+' <b>'+it.name+'</b></div><ul class="coin-popup-list"><li>Đã trừ: <b>'+need+'</b> coin</li><li>Còn lại: <b>'+coinState.coins+'</b> coin</li></ul>' });
  try{ await evaluateAchievements(false); }catch(e){}
  try{
    const ident = getCoinIdentity();
    await fb.db.ref('admin/shopLog').push({
      ts: Date.now(), playerId: ident && ident.id, code: (ident && ident.code)||'',
      itemId: it.id, name: it.name, price: need
    });
    try{ await logCoinDaily('shop', need); }catch(e2){}
  }catch(e){}
}

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
    const code = 'XK-'+nonce;
    await fb.db.ref('giftCodes/'+code).set({
      itemId,
      name: it.name,
      emoji: it.emoji || null,
      image: it.image || null,
      fromId: ident.id,
      fromCode: ident.code || '',
      fromName: ident.name || '',
      createdAt: Date.now(),
      used: false,
      keepItem: true
    });
    try{ await navigator.clipboard.writeText(code); }catch(e){}
    setInvStatus('Đã tạo mã '+code+' (không trừ kho).', false);
    await showCoinPopup({
      icon: it.emoji || '🏷️',
      title: 'Mã quà của bạn',
      okLabel: 'Đóng',
      html: '<div class="coin-popup-item">'+(it.emoji||'🎁')+' <b>'+it.name+'</b></div>'+
        '<ul class="coin-popup-list">'+
        '<li>Mã: <b id="giftCodeCopyText" style="letter-spacing:0.06em">'+code+'</b></li>'+
        '<li>Đồ trong kho: <b>không bị trừ</b></li>'+
        '</ul>'+
        '<div class="coin-popup-hint">Đã copy clipboard (nếu trình duyệt cho phép). Gửi mã cho bạn bè → Kho đồ → Nhận.</div>'+
        '<button type="button" class="action-btn" id="giftCodeCopyBtn" style="margin-top:10px;width:100%">Copy mã</button>'
    });
    setTimeout(()=>{
      const b = document.getElementById('giftCodeCopyBtn');
      if(b) b.onclick = async ()=>{
        try{ await navigator.clipboard.writeText(code); setInvStatus('Đã copy '+code, false); }catch(e){}
      };
    }, 50);
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
  await loadCoinStateFromPlayer();
  const have = Math.max(0, +(coinState.coins||0));
  const ok = await showCoinPopup({
    confirm:true,
    icon: it.emoji||'💰',
    title: 'Xác nhận bán',
    okLabel: 'Bán',
    cancelLabel: 'Hủy',
    html: '<div class="coin-popup-item">'+(it.emoji||'🎁')+' <b>'+it.name+'</b></div>'+
      '<ul class="coin-popup-list">'+
      '<li>Giá bán lại: <b>'+sellPrice+'</b> coin (−40%)</li>'+
      '<li>Số dư hiện tại: <b>'+have+'</b></li>'+
      '<li>Sau khi bán còn: <b>'+(have+sellPrice)+'</b> coin</li>'+
      '</ul>'
  });
  if(!ok) return;
  if(!((coinState.inventory||{})[itemId] > 0)){ setInvStatus('Không còn món này.', true); return; }
  coinState.inventory[itemId] -= 1;
  if(coinState.inventory[itemId] <= 0) delete coinState.inventory[itemId];
  coinState.coins = Math.max(0, +(coinState.coins||0)) + sellPrice;
  await saveCoinStateToPlayer();
  refreshThemeLocks();
  renderInventoryList();
  try{ renderShopList(); }catch(e){}
  setInvStatus('Đã bán '+it.emoji+' «'+it.name+'» · +'+sellPrice+' coin · Số dư: '+coinState.coins, false);
  showCoinPopup({
    icon:'✅', title:'Đã bán',
    html: '<div class="coin-popup-item">'+(it.emoji||'')+' <b>'+it.name+'</b></div>'+
      '<ul class="coin-popup-list"><li>+'+sellPrice+' coin</li><li>Số dư: <b>'+coinState.coins+'</b></li></ul>'
  });
}

async function listItemForAuction(itemId){
  const it = SHOP_ITEMS[itemId];
  const ident = getCoinIdentity();
  if(!it || !ident){ setInvStatus('Cần đăng nhập.', true); return; }
  const minStart = Math.max(1, Math.floor((it.price||10) * 0.5));
  await loadCoinStateFromPlayer();
  if(!((coinState.inventory||{})[itemId] > 0)){ setInvStatus('Không còn món này.', true); return; }

  const form = await new Promise(resolve=>{
    showCoinPopup({
      icon: it.emoji || '🔨',
      title: 'Đăng đấu giá',
      okLabel: 'Đăng bán',
      html:
        '<div class="coin-popup-item">'+(it.emoji||'🎁')+' <b>'+it.name+'</b></div>'+
        '<ul class="coin-popup-list" style="text-align:left">'+
        '<li>Giá shop: <b>'+(it.price||0)+'</b> coin</li>'+
        '<li>Tối thiểu khởi điểm: <b>'+minStart+'</b> coin</li>'+
        '</ul>'+
        '<div style="margin-top:10px;text-align:left;font-size:12.5px">'+
        '<label style="display:block;margin:0 0 4px;color:var(--brass-light)">Giá khởi điểm</label>'+
        '<input type="number" id="aucStartPrice" class="ui-input" min="'+minStart+'" value="'+minStart+'">'+
        '<label style="display:block;margin:10px 0 4px;color:var(--brass-light)">Thời gian</label>'+
        '<select id="aucHours" class="ui-select">'+
          '<option value="1">1 giờ</option>'+
          '<option value="6" selected>6 giờ</option>'+
          '<option value="12">12 giờ</option>'+
          '<option value="24">24 giờ</option>'+
        '</select>'+
        '<div class="coin-popup-hint" style="margin-top:8px">Đồ sẽ tạm trừ khỏi kho đến khi phiên kết thúc.</div>'+
        '</div>'
    });
    const cancelBtn = document.getElementById('coinPopupCancel');
    const okBtn = document.getElementById('coinPopupOk');
    if(cancelBtn){
      cancelBtn.style.display = '';
      cancelBtn.textContent = 'Hủy';
    }
    if(okBtn){
      okBtn.textContent = 'Đăng bán';
      okBtn.classList.add('coin-popup-buy');
    }
    const finish = (val)=>{
      try{ closeCoinPopup(false); }catch(e){}
      resolve(val);
    };
    const onOk = (e)=>{
      if(e){ e.preventDefault(); e.stopPropagation(); }
      const startEl = document.getElementById('aucStartPrice');
      const hoursEl = document.getElementById('aucHours');
      const startPrice = Math.floor(+(startEl && startEl.value));
      let hours = Math.floor(+(hoursEl && hoursEl.value));
      if(![1,6,12,24].includes(hours)) hours = 6;
      if(!startPrice || startPrice < minStart){
        setInvStatus('Giá khởi điểm tối thiểu '+minStart+' coin.', true);
        return;
      }
      okBtn && okBtn.removeEventListener('click', onOk, true);
      cancelBtn && cancelBtn.removeEventListener('click', onCancel, true);
      finish({ startPrice, hours });
    };
    const onCancel = (e)=>{
      if(e){ e.preventDefault(); e.stopPropagation(); }
      okBtn && okBtn.removeEventListener('click', onOk, true);
      cancelBtn && cancelBtn.removeEventListener('click', onCancel, true);
      finish(null);
    };

    if(okBtn) okBtn.addEventListener('click', onOk, true);
    if(cancelBtn) cancelBtn.addEventListener('click', onCancel, true);
  });
  if(!form) return;
  const { startPrice, hours } = form;

  try{
    await tcEnsureFb();
    await loadCoinStateFromPlayer();
    if(!((coinState.inventory||{})[itemId] > 0)){ setInvStatus('Không còn món này.', true); return; }
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
    setInvStatus('Đã đưa '+(it.emoji||'')+' lên đấu giá · bắt đầu '+startPrice+' coin · '+hours+'h.', false);
    showCoinPopup({
      icon: '✅',
      title: 'Đã đăng đấu giá',
      html: '<div class="coin-popup-item">'+(it.emoji||'🎁')+' <b>'+it.name+'</b></div>'+
        '<ul class="coin-popup-list">'+
        '<li>Giá khởi điểm: <b>'+startPrice+'</b> coin</li>'+
        '<li>Thời gian: <b>'+hours+'</b> giờ</li>'+
        '<li>Mã phiên: <b>'+id+'</b></li>'+
        '</ul>'
    });
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
      try{ await logCoinDaily('auction', pay); }catch(e){}
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
    await loadCoinStateFromPlayer();
    const have = Math.max(0, +(coinState.coins||0));

    const form = await new Promise(resolve=>{
      showCoinPopup({
        icon: a.emoji || '🔨',
        title: 'Trả giá đấu giá',
        okLabel: 'Trả giá',
        html:
          '<div class="coin-popup-item">'+(a.emoji||'🎁')+' <b>'+(a.name||'Vật phẩm')+'</b></div>'+
          '<ul class="coin-popup-list" style="text-align:left">'+
          '<li>Giá hiện tại: <b>'+(a.currentBid||a.startPrice||0)+'</b> coin</li>'+
          '<li>Trả tối thiểu: <b>'+minBid+'</b> coin</li>'+
          '<li>Bạn đang có: <b>'+have+'</b> coin</li>'+
          '</ul>'+
          '<div style="margin-top:10px;text-align:left;font-size:12.5px">'+
          '<label style="display:block;margin:0 0 4px;color:var(--brass-light)">Số coin trả giá</label>'+
          '<input type="number" id="bidAmountInput" class="ui-input" min="'+minBid+'" value="'+minBid+'">'+
          '<div class="coin-popup-hint" style="margin-top:8px">Coin sẽ bị khóa khi trả giá thành công. Nếu bị người khác trả cao hơn, coin được hoàn.</div>'+
          '</div>'
      });
      const cancelBtn = document.getElementById('coinPopupCancel');
      const okBtn = document.getElementById('coinPopupOk');
      if(cancelBtn){ cancelBtn.style.display = ''; cancelBtn.textContent = 'Hủy'; }
      if(okBtn){ okBtn.textContent = 'Trả giá'; okBtn.classList.add('coin-popup-buy'); }
      const finish = (val)=>{
        try{ closeCoinPopup(false); }catch(e){}
        resolve(val);
      };
      const onOk = (e)=>{
        if(e){ e.preventDefault(); e.stopPropagation(); }
        const el = document.getElementById('bidAmountInput');
        const bid = Math.floor(+(el && el.value));
        if(!bid || bid < minBid){
          setShopStatus('Giá trả tối thiểu '+minBid+' coin.', true);
          return;
        }
        okBtn && okBtn.removeEventListener('click', onOk, true);
        cancelBtn && cancelBtn.removeEventListener('click', onCancel, true);
        finish(bid);
      };
      const onCancel = (e)=>{
        if(e){ e.preventDefault(); e.stopPropagation(); }
        okBtn && okBtn.removeEventListener('click', onOk, true);
        cancelBtn && cancelBtn.removeEventListener('click', onCancel, true);
        finish(null);
      };
      if(okBtn) okBtn.addEventListener('click', onOk, true);
      if(cancelBtn) cancelBtn.addEventListener('click', onCancel, true);
    });
    if(form == null) return;
    const bid = form;

    if(coinState.coins < bid){
      const miss = bid - coinState.coins;
      setShopStatus('Không đủ coin — có '+coinState.coins+', cần '+bid+', thiếu '+miss+'.', true);
      showCoinPopup({
        warn:true, icon:'💸', title:'Không đủ coin để trả giá',
        html:'<ul class="coin-popup-list"><li>Cần: <b>'+bid+'</b> coin</li><li>Bạn có: <b>'+coinState.coins+'</b> coin</li><li>Còn thiếu: <b class="coin-miss">'+miss+'</b> coin</li></ul>'
      });
      return;
    }

    const snap2 = await ref.once('value');
    a = snap2.val();
    if(!a || a.status !== 'open'){ setShopStatus('Phiên đã kết thúc.', true); renderShopList(); return; }
    const minNow = Math.floor((a.currentBid||a.startPrice||0) + 1);
    if(bid < minNow){ setShopStatus('Có người trả giá cao hơn. Tối thiểu hiện tại: '+minNow, true); return; }

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
    try{ await logCoinDaily('auctionBid', bid); }catch(e){}
    setShopStatus('Đã trả '+bid+' coin cho '+(a.emoji||'')+' «'+a.name+'».', false);
    renderShopList();
    showCoinPopup({
      icon:'✅', title:'Đã trả giá',
      html: '<div class="coin-popup-item">'+(a.emoji||'🎁')+' <b>'+(a.name||'')+'</b></div>'+
        '<ul class="coin-popup-list">'+
        '<li>Bạn trả: <b>'+bid+'</b> coin</li>'+
        '<li>Số dư còn: <b>'+coinState.coins+'</b> coin</li>'+
        '</ul>'
    });
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

async function sendGiftToPlayer(){  }

async function toggleShopItem(){  }

async function toggleShopItem(){  }

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
        img.src = footyLogoUrl(club.slug);
        img.alt = club.name;
        img.loading = 'lazy';
        img.onerror = function(){ this.style.display = 'none'; };
        btn.appendChild(img);
      }
    }
  });
}
function loadSavedTheme(){
  try{ decorateThemeSwatches(); }catch(e){}

  let saved = 'wood';
  try{ saved = localStorage.getItem(THEME_STORAGE_KEY) || 'wood'; }catch(err){}
  applyTheme(saved, { force:true });
  refreshThemeLocks();
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
  viGlyphs: false,
  commentVoice: false,
  voicePreset: 'bac_nu',
  voiceRate: 1.05,
  voicePitch: 1.15,
  replay: { active:false, moves:[], index:0, savedBoard:null, savedTurn:null },
  aiStake: 0,
  aiStakeLocked: 0
};

let fb = { app:null, db:null, roomRef:null, room:null };

function getBoardSvg(){
  return document.getElementById('boardSvg');
}
/** @deprecated dùng getBoardSvg() — giữ alias để code cũ không vỡ */
let svg = null;
try{ svg = document.getElementById('boardSvg'); }catch(e){ svg = null; }

function boardX(c){ return MARGIN + c*CELL; }
function boardY(r){ return MARGIN + r*CELL; }

function buildStaticBoard(){
  const svgEl = getBoardSvg() || svg;
  if(!svgEl){
    console.error('[board] #boardSvg không tồn tại trong DOM');
    return;
  }
  svg = svgEl;
  const ns = 'http://www.w3.org/2000/svg';
  while(svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

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
  svgEl.appendChild(defs);

  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('x',0); bg.setAttribute('y',0);
  bg.setAttribute('width',svgW); bg.setAttribute('height',svgH);
  bg.setAttribute('rx',10);
  bg.setAttribute('class','board-bg');
  bg.setAttribute('id','boardBgRect');
  svgEl.appendChild(bg);

  const flagLayer = document.createElementNS(ns,'g');
  flagLayer.setAttribute('id','boardFlagLayer');
  svgEl.appendChild(flagLayer);

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

  svgEl.appendChild(g);

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
  svgEl.appendChild(hitLayer);

  const markerLayer = document.createElementNS(ns,'g');
  markerLayer.setAttribute('id','markerLayer');
  svgEl.appendChild(markerLayer);

  const pieceLayer = document.createElementNS(ns,'g');
  pieceLayer.setAttribute('id','pieceLayer');
  svgEl.appendChild(pieceLayer);
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
  const gText = (GLYPHS[p.color] && GLYPHS[p.color][p.type]) || '';
  glyph.setAttribute('font-size', (state.viGlyphs || gText.length > 1) ? 11 : 23);
  glyph.setAttribute('class', 'piece-glyph ' + p.color);
  glyph.textContent = gText;
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
  if(!layer){
    console.warn('[board] pieceLayer chưa có — gọi buildStaticBoard()');
    try{ buildStaticBoard(); }catch(e){}
    return;
  }
  if(!state.board) return;
  const stillOnBoard = new Set();
  const quiet = !!state._quietRender;

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

  if(state.online.active && !(opts && (opts.noOnline || opts.fromReplay))){
    showOnlineActive();
    fbPushState();
  }

  if(!state.gameOver && !state.online.active && !(opts && opts.fromReplay) && state.mode!=='pvp' && state.turn!==state.humanColor){
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
    try{
      const fc = Object.keys(friends).filter(id => friends[id]).length;
      if(coinState && coinState.friendCount !== fc){
        coinState.friendCount = fc;
        saveCoinStateToPlayer().then(()=> evaluateAchievements(true)).catch(()=>{});
      }
    }catch(e){}
    if(list){
      const ids = Object.keys(friends).filter(id => friends[id]);
      if(!ids.length) list.innerHTML = '<div class="admin-empty">Chưa có bạn.</div>';
      else {
        list.innerHTML = '';
        ids.forEach(fid=>{
          const f = all[fid] || {};
          const code = f.code || fid;
          const div = document.createElement('div');
          div.className = 'friend-row';
          const idEl = document.createElement('span');
          idEl.className = 'friend-row-id'; idEl.textContent = code; idEl.title = code;
          const actions = document.createElement('div');
          actions.className = 'friend-row-actions';
          const challenge = document.createElement('button');
          challenge.className = 'action-btn friend-row-btn'; challenge.textContent = 'Thách';
          challenge.addEventListener('click', ()=> quickChallengeFriend(code, fid));
          const btn = document.createElement('button');
          btn.className = 'action-btn friend-row-btn'; btn.textContent = 'Hủy';
          btn.addEventListener('click', ()=> removeFriend(fid));
          actions.appendChild(challenge); actions.appendChild(btn);
          div.appendChild(idEl); div.appendChild(actions); list.appendChild(div);
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
          const code = r.fromCode || fromId;
          const div = document.createElement('div');
          div.className = 'friend-row';
          const idEl = document.createElement('span');
          idEl.className = 'friend-row-id'; idEl.textContent = code; idEl.title = code;
          const actions = document.createElement('div');
          actions.className = 'friend-row-actions';
          const ok = document.createElement('button');
          ok.className = 'action-btn friend-row-btn'; ok.textContent = 'Nhận';
          ok.addEventListener('click', ()=> acceptFriend(fromId, r));
          const no = document.createElement('button');
          no.className = 'action-btn friend-row-btn'; no.textContent = 'Xóa';
          no.addEventListener('click', async ()=>{ await fb.db.ref('friendRequests/'+myId+'/'+fromId).remove(); loadFriendsUI(); });
          actions.appendChild(ok); actions.appendChild(no);
          div.appendChild(idEl); div.appendChild(actions); reqBox.appendChild(div);
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
          div.className = 'friend-row';
          const idEl = document.createElement('span');
          idEl.className = 'friend-row-id';
          idEl.textContent = (c.fromCode||'?')+' · '+c.stake+'c';
          idEl.title = (c.fromCode||'')+' cược '+c.stake+' coin';
          const actions = document.createElement('div');
          actions.className = 'friend-row-actions';
          const ok = document.createElement('button');
          ok.className = 'action-btn friend-row-btn'; ok.textContent = 'Nhận';
          ok.addEventListener('click', ()=> acceptBetChallenge(c));
          const no = document.createElement('button');
          no.className = 'action-btn friend-row-btn'; no.textContent = 'Từ chối';
          no.addEventListener('click', async ()=>{ await fb.db.ref('betChallenges/'+c.id).update({ status:'declined' }); loadFriendsUI(); });
          actions.appendChild(ok); actions.appendChild(no);
          div.appendChild(idEl); div.appendChild(actions); betBox.appendChild(div);
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
    try{
      await loadCoinStateFromPlayer();
      const friendsSnap = await fb.db.ref('players/'+myId+'/friends').once('value');
      const friends = friendsSnap.val() || {};
      coinState.friendCount = Object.keys(friends).length;
      await saveCoinStateToPlayer();
      await evaluateAchievements(false);
    }catch(e){}
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
    try{ await logCoinDaily('bet', stake); }catch(e){}
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
    try{ await logCoinDaily('bet', stake); }catch(e){}
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



function enhanceNumberSteppers(root){
  const scope = root || document;
  scope.querySelectorAll('input[type="number"]').forEach(inp=>{
    if(inp.dataset.stepper === '1') return;
    if(inp.dataset.noStepper === '1') return;
    if(inp.closest('.num-stepper')) return;
    /* Không gắn stepper trong modal Wall / form hồ sơ / modal chung (dễ vỡ layout) */
    if(inp.closest('#wallModalOverlay, .wall-modal-box, .wall-form, .modal-overlay, .modal-box')) return;
    if(inp.id === 'wallAge' || inp.id === 'regAge') return;
    inp.dataset.stepper = '1';
    const wrap = document.createElement('div');
    wrap.className = 'num-stepper';
    const parent = inp.parentNode;
    parent.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const btns = document.createElement('div');
    btns.className = 'num-stepper-btns';
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'num-stepper-btn';
    up.setAttribute('aria-label', 'Tăng');
    up.innerHTML = '▲';
    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'num-stepper-btn';
    down.setAttribute('aria-label', 'Giảm');
    down.innerHTML = '▼';
    const step = ()=>{
      const st = parseFloat(inp.step) || 1;
      const min = inp.min !== '' ? parseFloat(inp.min) : -Infinity;
      const max = inp.max !== '' ? parseFloat(inp.max) : Infinity;
      return { st, min, max };
    };
    const apply = (dir)=>{
      const { st, min, max } = step();
      let v = parseFloat(inp.value);
      if(isNaN(v)) v = min !== -Infinity ? min : 0;
      v = Math.min(max, Math.max(min, v + dir * st));
      // integer if step is int
      if(st % 1 === 0) v = Math.round(v);
      else v = Math.round(v * 1000) / 1000;
      inp.value = String(v);
      inp.dispatchEvent(new Event('input', { bubbles:true }));
      inp.dispatchEvent(new Event('change', { bubbles:true }));
    };
    up.addEventListener('click', e=>{ e.preventDefault(); apply(1); });
    down.addEventListener('click', e=>{ e.preventDefault(); apply(-1); });
    btns.appendChild(up);
    btns.appendChild(down);
    wrap.appendChild(btns);
  });
}

function clearAiBetStakeInput(){
  const el = document.getElementById('aiBetStake');
  if(el) el.value = '0';
  state.aiStake = 0;
  try{ updateAiBetHint(); }catch(e){}
}

function getAiBetStakeFromUi(){
  const el = document.getElementById('aiBetStake');
  if(!el) return 0;
  return Math.max(0, Math.floor(+el.value || 0));
}

function aiWinRewardForLevel(level){
  const lv = Math.min(10, Math.max(1, +(level||5)));
  return AI_WIN_REWARD[lv] || 7;
}

function aiProfitForStake(stake, level){
  const lv = Math.min(10, Math.max(1, +(level||5)));
  const pct = AI_PROFIT_PCT[lv] != null ? AI_PROFIT_PCT[lv] : 0.2;
  return Math.max(0, Math.floor(stake * pct));
}

function suggestedAiStake(level, coins){
  const c = Math.max(0, Math.floor(+coins || 0));
  if(c < 5) return 0;
  const lv = Math.min(10, Math.max(1, +(level||5)));
  const frac = lv <= 3 ? 0.08 : lv <= 6 ? 0.12 : 0.15;
  let s = Math.floor(c * frac);
  const cap = Math.floor(c * AI_STAKE_BANKROLL_FRAC);
  s = Math.min(s, cap, 500);
  if(s < 1 && c >= 1) s = 1;
  return s;
}

function updateAiBetHint(){
  const tip = document.getElementById('aiBetHint');
  const lv = state.aiLevel || 5;
  const base = aiWinRewardForLevel(lv);
  const stake = getAiBetStakeFromUi();
  const coins = (typeof coinState !== 'undefined' && coinState) ? +(coinState.coins||0) : 0;
  const suggest = suggestedAiStake(lv, coins);
  if(tip){
    if(stake > 0){
      const profit = aiProfitForStake(stake, lv);
      tip.textContent = '+'+(base + stake + profit)+'c';
      tip.title = 'Thắng: hoàn '+stake+' + lãi '+profit+' + thưởng '+base+' = '+(base+stake+profit)+
        ' | Gợi ý cược: '+suggest+' (≤25% số dư)';
    } else {
      tip.textContent = '+'+base+'c';
      tip.title = 'Thắng máy cấp '+lv+': +'+base+' coin · Gợi ý cược: '+suggest;
    }
  }

  if(stake > 0 && coins > 0 && stake > coins * AI_STAKE_BANKROLL_FRAC){
    setAiBetStatus('Cược đang >25% số dư — rủi ro cao. Gợi ý ≤ '+Math.floor(coins*AI_STAKE_BANKROLL_FRAC)+'.', true);
  } else if(stake === 0 && suggest > 0 && state.mode === 'pve'){
    setAiBetStatus('Thưởng thắng +'+base+'c · Gợi ý cược cấp '+lv+': '+suggest+' coin.', false);
  }
}

function setAiBetStatus(msg, warn){
  const el = document.getElementById('aiBetStatus');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'online-status' + (warn ? ' warn' : msg ? ' live' : '');
}

async function lockAiStakeIfNeeded(){
  /* Kept for compatibility — actual lock is done via aiLockBetBtn flow */
  if(state.mode !== 'pve' || state.online.active) return true;
  if(state.aiStakeLocked > 0) return true;
  const stake = getAiBetStakeFromUi();
  state.aiStake = stake;
  if(stake <= 0){
    setAiBetStatus('Ván này: thắng máy +'+aiWinRewardForLevel(state.aiLevel)+' coin (không cược).', false);
    return true;
  }
  if(!getCoinIdentity()){
    setAiBetStatus('Đăng nhập kỳ thủ để cược vs máy (hoặc để 0 chỉ nhận thưởng thắng).', true);
    state.aiStake = 0;
    return true;
  }
  return true;
}

async function confirmAndLockAiBet(){
  if(state.mode !== 'pve' || state.online.active){
    setAiBetStatus('Chỉ dùng khi chơi Người vs Máy.', true);
    return false;
  }
  if(state.aiStakeLocked > 0){
    setAiBetStatus('Đã khóa '+state.aiStakeLocked+' coin. Bấm «Ván mới» để bắt đầu.', false);
    return true;
  }
  const stake = getAiBetStakeFromUi();
  state.aiStake = stake;
  if(stake <= 0){
    const ok = await showCoinPopup({
      confirm: true,
      icon: '🤖',
      title: 'Chơi không cược?',
      html: '<ul class="coin-popup-list"><li>Cấp máy: <b>'+state.aiLevel+'</b></li><li>Thưởng thắng: <b>+'+aiWinRewardForLevel(state.aiLevel)+'</b> coin</li><li>Không khóa coin</li></ul>',
      okLabel: 'Đồng ý chơi',
      cancelLabel: 'Hủy'
    });
    if(!ok) return false;
    setAiBetStatus('Ván này: thắng máy +'+aiWinRewardForLevel(state.aiLevel)+' coin (không cược).', false);
    resetGame();
    return true;
  }
  if(!getCoinIdentity()){
    showCoinPopup({ warn:true, icon:'🔒', title:'Cần đăng nhập', html:'<div class="coin-popup-hint">Đăng nhập kỳ thủ để cược vs máy, hoặc đặt cược = 0 để chỉ nhận thưởng thắng.</div>' });
    setAiBetStatus('Đăng nhập kỳ thủ để cược vs máy.', true);
    return false;
  }
  try{
    await loadCoinStateFromPlayer();
    const coins = +(coinState.coins||0);
    if(stake > coins){
      showCoinPopup({ warn:true, icon:'💸', title:'Không đủ coin', html:'<ul class="coin-popup-list"><li>Cược: <b>'+stake+'</b></li><li>Bạn có: <b>'+coins+'</b></li><li>Thiếu: <b class="coin-miss">'+(stake-coins)+'</b></li></ul>' });
      setAiBetStatus('Không đủ coin (có '+coins+', cần '+stake+').', true);
      return false;
    }
    const profit = aiProfitForStake(stake, state.aiLevel);
    const base = aiWinRewardForLevel(state.aiLevel);
    const ok = await showCoinPopup({
      confirm: true,
      icon: '🔒',
      title: 'Xác nhận khóa coin',
      html: '<ul class="coin-popup-list"><li>Cược: <b>'+stake+'</b> coin</li><li>Số dư hiện tại: <b>'+coins+'</b></li><li>Sau khi khóa: <b>'+(coins-stake)+'</b></li><li>Cấp máy: <b>'+state.aiLevel+'</b></li><li>Nếu thắng: hoàn + lãi <b>+'+(stake+profit)+'</b> + thưởng <b>+'+base+'</b></li><li>Nếu thua: mất <b>'+stake+'</b> coin</li></ul>',
      okLabel: 'Đồng ý chơi',
      cancelLabel: 'Hủy'
    });
    if(!ok){
      setAiBetStatus('Đã hủy — không khóa coin.', false);
      return false;
    }
    coinState.coins = coins - stake;
    state.aiStake = stake;
    state.aiStakeLocked = stake;
    await saveCoinStateToPlayer();
    refreshThemeLocks();
    setAiBetStatus('Đã khóa '+stake+' coin · lãi thắng ~'+profit+' + thưởng '+base+'.', false);
    try{ closeDrawer(); }catch(e){}
    resetGame();
    return true;
  }catch(e){
    state.aiStakeLocked = 0;
    state.aiStake = 0;
    setAiBetStatus('Không khóa cược được: '+(e.message||e), true);
    return false;
  }
}

async function settlePveCoins(resultWinner){
  if(state.mode !== 'pve' || state.online.active) return;
  if(!getCoinIdentity()){
    if(resultWinner === state.humanColor){
      setAiBetStatus('Thắng máy! Đăng nhập để nhận coin thưởng.', true);
    }
    return;
  }
  try{
    await loadCoinStateFromPlayer();
    const level = Math.min(10, Math.max(1, state.aiLevel||5));
    const locked = Math.max(0, +(state.aiStakeLocked||0));
    const base = aiWinRewardForLevel(level);
    let delta = 0;
    let title = '';
    let html = '';
    if(resultWinner === state.humanColor){
      const profit = locked > 0 ? aiProfitForStake(locked, level) : 0;
      delta = base + (locked > 0 ? locked + profit : 0);
      coinState.coins = Math.max(0, +(coinState.coins||0)) + delta;
      title = 'Thắng máy!';
      html = '<ul class="coin-popup-list"><li>Thưởng cấp '+level+': <b>+'+base+'</b></li>'+
        (locked ? '<li>Hoàn cược: <b>+'+locked+'</b></li><li>Lãi cược: <b>+'+profit+'</b></li>' : '')+
        '<li>Tổng nhận: <b>+'+delta+'</b> · Số dư: <b>'+coinState.coins+'</b></li></ul>';
      setAiBetStatus('Thắng máy +'+delta+' coin · số dư '+coinState.coins+'.', false);
    } else if(!resultWinner){
      if(locked > 0){
        delta = locked;
        coinState.coins = Math.max(0, +(coinState.coins||0)) + delta;
        title = 'Hòa - hoàn cược';
        html = '<ul class="coin-popup-list"><li>Hoàn: <b>+'+locked+'</b> coin</li><li>Số dư: <b>'+coinState.coins+'</b></li></ul>';
        setAiBetStatus('Hòa - hoàn '+locked+' coin.', false);
      } else {
        setAiBetStatus('Hòa - không thưởng.', false);
        state.aiStakeLocked = 0;
        return;
      }
    } else {
      title = 'Thua máy';
      html = locked
        ? '<ul class="coin-popup-list"><li>Mất cược: <b>'+locked+'</b> coin</li><li>Số dư: <b>'+coinState.coins+'</b></li></ul>'
        : '<ul class="coin-popup-list"><li>Không mất cược (để 0).</li><li>Thử lại cấp thấp hơn hoặc cược nhẹ.</li></ul>';
      setAiBetStatus(locked ? ('Thua máy - mất '+locked+' coin.') : 'Thua máy.', true);
      if(locked){
        showCoinPopup({ warn:true, icon:'🤖', title, html });
        try{ await logCoinDaily('pveIn', locked); }catch(e){}
      }
      state.aiStakeLocked = 0;
      try{ clearAiBetStakeInput(); }catch(e){}
      await saveCoinStateToPlayer();
      refreshThemeLocks();
      return;
    }
    await saveCoinStateToPlayer();
    refreshThemeLocks();
    try{
      if(resultWinner === state.humanColor){
        const paid = base + (locked > 0 ? aiProfitForStake(locked, level) : 0);
        await logCoinDaily('pveOut', paid);
        if(locked > 0) await logCoinDaily('pveStake', locked);
      } else if(!resultWinner && locked > 0){
        await logCoinDaily('pveStake', locked);
      }
    }catch(e){}
    state.aiStakeLocked = 0;
    try{ clearAiBetStakeInput(); }catch(e){}
    showCoinPopup({ icon:'🤖', title, html });
  }catch(e){
    console.warn('settlePveCoins', e);
  }
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
        `Chiếu bí - ${winner==='red'?'Đỏ':'Đen'} đã hạ tướng đối phương.`
      );
      sfxGameResult(winner, false);
      commentOnGameEnd(winner, false);
      fireConfetti();
    } else {
      showGameOver('Hòa Cờ', 'Bên đi không còn nước hợp lệ - ván cờ kết thúc hòa.');
      sfxGameResult(null, true);
      commentOnGameEnd(null, true);
    }
    deleteFinishedSave();
    clearOnlineChatIfActive();
    syncTournamentResult(resultWinner);
    try{ settleOnlineBet(resultWinner); }catch(e){}
    try{ settlePveCoins(resultWinner); }catch(e){}
    try{
      if(resultWinner && state.online && state.online.active && state.online.color === resultWinner){
        recordWinForAchievement();
      } else if(resultWinner && !state.online.active && state.mode==='pve' && resultWinner === state.humanColor){
        recordWinForAchievement();
      } else if(resultWinner && !state.online.active && state.mode==='pvp'){
        recordWinForAchievement();
      }
    }catch(e){}
    try{ saveReplayAndShare(resultWinner); }catch(e){}
  }
}

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

function aiSideColor(){
  return state.humanColor==='red' ? 'black' : 'red';
}


function isCheatUnlimited(){
  try{
    const adm = typeof getAdminSessionMeta === 'function' ? getAdminSessionMeta() : null;
    if(adm && adm.ok && adm.via === 'superadmin') return true;
  }catch(e){}
  try{
    if(playerSession && String(playerSession.role||'').toLowerCase() === 'superadmin') return true;
  }catch(e){}
  return false;
}

function ensureCheatDay(){
  const d = (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0,10);
  if(coinState.cheatDate !== d){
    coinState.cheatDate = d;
    coinState.cheatUsed = 0;
  }
  return d;
}

function cheatRemainingUses(){
  if(isCheatUnlimited()) return Infinity;
  ensureCheatDay();
  const bonus = Math.max(0, +(coinState.cheatBonus||0));
  const used = Math.max(0, +(coinState.cheatUsed||0));
  return Math.max(0, CHEAT_DAILY_LIMIT - used) + bonus;
}

function refreshCheatUsesUI(){
  const badge = document.getElementById('cheatUsesBadge');
  const st = document.getElementById('cheatUsesStatus');
  const buy = document.getElementById('cheatBuyUsesBtn');
  if(isCheatUnlimited()){
    if(badge) badge.textContent = '∞';
    if(st){ st.textContent = 'Superadmin - ∞.'; st.className = 'online-status live'; }
    if(buy) buy.style.display = 'none';
    return;
  }
  if(buy) buy.style.display = '';
  const left = cheatRemainingUses();
  ensureCheatDay();
  const dailyLeft = Math.max(0, CHEAT_DAILY_LIMIT - Math.max(0, +(coinState.cheatUsed||0)));
  const bonus = Math.max(0, +(coinState.cheatBonus||0));
  if(badge) badge.textContent = String(left);
  if(st){
    st.textContent = 'Còn '+left+' lượt (ngày: '+dailyLeft+'/'+CHEAT_DAILY_LIMIT+(bonus?(' +bonus '+bonus):'')+'). Mua +'+CHEAT_BUY_USES+' = '+CHEAT_BUY_COST+' coin.';
    st.className = 'online-status' + (left <= 0 ? ' warn' : ' live');
  }
}

async function consumeCheatUse(actionLabel){
  if(state.mode === 'pvp' || state.online.active) return false;
  if(isCheatUnlimited()) return true;
  if(!getCoinIdentity()){
    setCheckInStatus('Đăng nhập kỳ thủ để dùng gian lận (20 lượt/ngày).', true);
    try{ refreshCheatUsesUI(); }catch(e){}
    return false;
  }
  try{ await loadCoinStateFromPlayer(); }catch(e){}
  ensureCheatDay();
  const left = cheatRemainingUses();
  if(left <= 0){
    setCheckInStatus('Hết lượt gian lận hôm nay. Mua thêm bằng coin hoặc đợi mai reset.', true);
    try{ showCoinPopup({ warn:true, icon:'🔒', title:'Hết lượt gian lận',
      html:'<ul class="coin-popup-list"><li>Giới hạn: <b>'+CHEAT_DAILY_LIMIT+'</b> lượt/ngày</li><li>Mua +'+CHEAT_BUY_USES+' lượt: <b>'+CHEAT_BUY_COST+'</b> coin</li></ul>' }); }catch(e){}
    refreshCheatUsesUI();
    return false;
  }

  if(Math.max(0, +(coinState.cheatUsed||0)) < CHEAT_DAILY_LIMIT){
    coinState.cheatUsed = Math.max(0, +(coinState.cheatUsed||0)) + 1;
  } else {
    coinState.cheatBonus = Math.max(0, +(coinState.cheatBonus||0) - 1);
  }
  try{ await saveCoinStateToPlayer(); }catch(e){}
  refreshCheatUsesUI();
  return true;
}

async function buyCheatUses(){
  if(isCheatUnlimited()) return;
  if(!getCoinIdentity()){
    setCheckInStatus('Đăng nhập để mua lượt gian lận.', true);
    return;
  }
  try{
    await loadCoinStateFromPlayer();
    ensureCheatDay();
    if(coinState.coins < CHEAT_BUY_COST){
      setCheckInStatus('Không đủ coin (cần '+CHEAT_BUY_COST+', có '+coinState.coins+').', true);
      showCoinPopup({ warn:true, icon:'💸', title:'Không đủ coin',
        html:'<ul class="coin-popup-list"><li>Cần: <b>'+CHEAT_BUY_COST+'</b></li><li>Bạn có: <b>'+coinState.coins+'</b></li></ul>' });
      return;
    }
    if(!confirm('Mua +'+CHEAT_BUY_USES+' lượt gian lận với '+CHEAT_BUY_COST+' coin?')) return;
    coinState.coins -= CHEAT_BUY_COST;
    coinState.cheatBonus = Math.max(0, +(coinState.cheatBonus||0)) + CHEAT_BUY_USES;
    await saveCoinStateToPlayer();
    refreshThemeLocks();
    refreshCheatUsesUI();
    setCheckInStatus('Đã mua +'+CHEAT_BUY_USES+' lượt · còn '+cheatRemainingUses()+' · số dư '+coinState.coins+' coin.', false);
    showCoinPopup({ icon:'⚡', title:'Đã mua lượt gian lận',
      html:'<ul class="coin-popup-list"><li>+'+CHEAT_BUY_USES+' lượt bonus</li><li>Còn lại: <b>'+cheatRemainingUses()+'</b></li><li>Số dư: <b>'+coinState.coins+'</b></li></ul>' });
  }catch(e){
    setCheckInStatus('Mua thất bại: '+(e.message||e), true);
  }
}

async function cheatSkipAiTurn(){
  if(state.mode==='pvp' || state.online.active || state.gameOver) return;
  if(!(await consumeCheatUse('skip'))) return;
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

async function cheatKillPiece(r,c){
  const target = state.board[r][c];
  if(!target) return;
  if(!(await consumeCheatUse('kill'))) return;
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

async function cheatBeheadGeneral(){
  if(state.mode==='pvp' || state.online.active || state.gameOver) return;
  if(!(await consumeCheatUse('behead'))) return;
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
  try{ recordWinForAchievement(); }catch(e){}
  try{ settlePveCoins(state.humanColor); }catch(e){}
  try{ saveReplayAndShare(state.humanColor); }catch(e){}
}

async function cheatReviveChariot(){
  if(state.mode==='pvp' || state.online.active || state.gameOver) return;
  if(!(await consumeCheatUse('revive'))) return;
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
    await fbEnsureAuth();
    await fb.db.ref('saves/'+code).set({ content, savedAt: Date.now() });
    document.getElementById('saveCodeInput').value = code;
    state.currentSave = code;
    flashStatus(`🔥 Đã lưu! Mã ván đấu: ${code} - ghi lại để tải lại sau.`, false, 'saveStatus');
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
    flashStatus(`🗑️ Ván đã kết thúc. "${code}".`, false, 'saveStatus');
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
  const specBar = document.getElementById('spectatorViewBar');
  if(specBar) specBar.style.display = state.online.spectator ? '' : 'none';
  updateChatBanBarVisibility();

  if(state.online.spectator){
    document.getElementById('roomCodeDisplay').textContent = 'Chỉ xem';
    const base = 'Đang xem trực tiếp - bạn không thể đi quân.';
    document.getElementById('onlineRoleLabel').textContent =
      state.online.roomCode ? `${base} · Mã phòng: ${state.online.roomCode}` : base;
    updateSpectatorViewMeta();
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

/** Email ảo gắn với mã kỳ thủ XK — dùng Firebase Email/Password, không cần Anonymous */
function playerAuthEmail(code){
  const c = String(code||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  return c + '@cotuong.player';
}

function fbInit(){
  if(fb.app){
    /* Đã init: luôn ưu tiên currentUser hiện tại (tránh kẹt promise null lúc load) */
    if(fb.auth && fb.auth.currentUser){
      fb.uid = fb.auth.currentUser.uid;
      return Promise.resolve(fb.auth.currentUser);
    }
    return fb._authReady || Promise.resolve(null);
  }
  fb.app = firebase.initializeApp(CONFIG.firebase);
  fb.auth = firebase.auth();
  fb.db = firebase.database();
  try{ fb.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}
  fb._authReady = new Promise((resolve)=>{
    const unsub = fb.auth.onAuthStateChanged((user)=>{
      unsub();
      fb.uid = user ? user.uid : null;
      resolve(user || null);
    });
  });
  /* Cập nhật uid mỗi lần login/logout sau lần đầu */
  fb.auth.onAuthStateChanged((user)=>{
    fb.uid = user ? user.uid : null;
  });
  return fb._authReady;
}

async function fbEnsureAuth(){
  if(!fbAvailable()) throw new Error('Firebase Auth/SDK chưa sẵn sàng');
  await fbInit();
  /* Luôn đọc currentUser realtime — không tin cache null sau khi user đã login */
  let user = (fb.auth && fb.auth.currentUser) || null;
  if(!user && fb._authReady){
    try{ await fb._authReady; }catch(e){}
    user = (fb.auth && fb.auth.currentUser) || null;
  }
  if(user){ fb.uid = user.uid; return user; }

  if(typeof playerSession !== 'undefined' && playerSession && playerSession.code){
    throw new Error('Phiên Firebase đã hết. Hãy đăng nhập lại bằng mã ID «'+playerSession.code+'» + mật khẩu.');
  }
  throw new Error('Vui lòng mở menu → Đăng nhập kỳ thủ (mã ID + mật khẩu) để dùng tính năng online.');
}

async function fbEnsureAuthOptional(){
  if(!fbAvailable()) return null;
  try{
    await fbInit();
    const user = (fb.auth && fb.auth.currentUser) || null;
    if(user) fb.uid = user.uid;
    return user;
  }catch(e){ return null; }
}

/** Đảm bảo đã Auth; nếu chưa thì hiện popup gợi ý đăng nhập (không ném lỗi thô). */
async function requirePlayerAuth(featureLabel){
  try{
    return await fbEnsureAuth();
  }catch(err){
    const msg = (err && err.message) || 'Cần đăng nhập kỳ thủ.';
    try{
      showCoinPopup({
        warn:true,
        icon:'🔒',
        title:'Cần đăng nhập',
        html:'<div class="coin-popup-hint">'+(featureLabel ? (featureLabel+' — ') : '')+msg+'</div>',
        okLabel:'Đóng'
      });
    }catch(e){}
    try{ setFbStatus(msg, true); }catch(e){}
    return null;
  }
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
    : ['black','red'];

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
    setFbStatus('Chưa cấu hình Firebase.', true);
    return;
  }
  const authed = await requirePlayerAuth('Tạo phòng online');
  if(!authed) return;
  fbSweepExpiredRooms(); try{ fbSweepExpiredReplays(); }catch(e){}

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
    setFbStatus('Không tạo được phòng.', true);
    return;
  }
  fbListen();
  fbListenUndoRequest();
  fbListenChat();
  fbSetupPresence('red');
  saveRoomSession(code, 'red');
  setFbStatus(`🟢 Đã tạo phòng ${code} - bạn cầm quân Đỏ. Gửi mã cho đối thủ (họ sẽ cầm Đen). Phòng tự xoá 3 phút sau khi cả 2 cùng thoát.`, false);
  showOnlineActive();
  pushSystemChat('Phòng '+code+' đã mở · Chat realtime sẵn sàng (chơi 2 người).');
}

async function fbJoinRoom(){
  if(!fbAvailable()){
    setFbStatus('Chưa cấu hình Firebase.', true);
    return;
  }
  const code = document.getElementById('fbJoinCodeInput').value.trim().toUpperCase();
  if(!code){ setFbStatus('Nhập mã phòng trước đã.', true); return; }
  const authed = await requirePlayerAuth('Phòng online');
  if(!authed) return;

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

  const pref = window._preferredJoinColor || null;
  window._preferredJoinColor = null;

  let preferred = pref;
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
  state.online.version = 0;
  fbListen();
  fbListenUndoRequest();
  fbListenChat();
  fbSetupPresence(myColor);
  saveRoomSession(code, myColor);
  fbApplyState(data);
  markMatchPlayingByRoom(code);
  const colorName = myColor === 'red' ? 'Đỏ' : 'Đen';
  setFbStatus(`🟢 Đã vào phòng ${code} - bạn cầm quân ${colorName}. Chat realtime đã bật.`, false);
  showOnlineActive();
  pushSystemChat((playerSession && playerSession.name ? playerSession.name : colorName) + ' đã vào phòng.');
}

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

let spectatorViewMode = 'both';
let spectatorSeatInfo = { red: null, black: null };
let spectatorBroadcastCfg = { themeBoth: 'wood', themeRed: '', themeBlack: '' };

async function loadSpectatorBroadcastCfg(){
  try{
    if(!fbAvailable()) return;
    await fbEnsureAuth();
    const snap = await fb.db.ref('admin/broadcast').once('value');
    const d = snap.val() || {};
    spectatorBroadcastCfg = {
      themeBoth: d.themeBoth || 'wood',
      themeRed: d.themeRed || '',
      themeBlack: d.themeBlack || ''
    };
  }catch(e){}
}

async function resolveSeatPlayerInfo(data){
  const seats = (data && data.seats) || {};
  const info = { red: null, black: null };
  for(const color of ['red','black']){
    const seat = seats[color];
    if(!seat) continue;
    const pid = seat.playerId || seat.id || null;
    const code = seat.code || '';
    const name = seat.name || code || (color==='red'?'Đỏ':'Đen');
    let theme = seat.theme || seat.preferredTheme || null;
    if(pid && fb.db){
      try{
        const pSnap = await fb.db.ref('players/'+pid).once('value');
        const p = pSnap.val();
        if(p){
          theme = p.preferredTheme || theme;
          info[color] = { id: pid, code: p.code||code, name: p.name||name, theme: theme || 'wood' };
          continue;
        }
      }catch(e){}
    }
    info[color] = { id: pid, code, name, theme: theme || 'wood' };
  }
  spectatorSeatInfo = info;
  return info;
}

function applySpectatorView(view){
  spectatorViewMode = view || 'both';
  document.querySelectorAll('.spectator-view-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.view === spectatorViewMode);
  });
  let themeId = spectatorBroadcastCfg.themeBoth || 'wood';
  if(spectatorViewMode === 'red'){
    themeId = spectatorBroadcastCfg.themeRed || (spectatorSeatInfo.red && spectatorSeatInfo.red.theme) || themeId;
  } else if(spectatorViewMode === 'black'){
    themeId = spectatorBroadcastCfg.themeBlack || (spectatorSeatInfo.black && spectatorSeatInfo.black.theme) || themeId;
  }
  if(THEMES[themeId]){
    try{ applyTheme(themeId, { force:true }); }catch(e){}
  }
  updateSpectatorViewMeta();
}

function updateSpectatorViewMeta(){
  const el = document.getElementById('spectatorViewMeta');
  if(!el) return;
  if(spectatorViewMode === 'red' && spectatorSeatInfo.red){
    el.textContent = 'Đang xem góc Đỏ · '+(spectatorSeatInfo.red.name||'')+' · theme '+(spectatorSeatInfo.red.theme||'mặc định');
  } else if(spectatorViewMode === 'black' && spectatorSeatInfo.black){
    el.textContent = 'Đang xem góc Đen · '+(spectatorSeatInfo.black.name||'')+' · theme '+(spectatorSeatInfo.black.theme||'mặc định');
  } else {
    el.textContent = 'Màn chung · theme '+(spectatorBroadcastCfg.themeBoth||'wood');
  }
}

async function openSpectatorChoiceModal(data){
  await loadSpectatorBroadcastCfg();
  await resolveSeatPlayerInfo(data);
  const red = spectatorSeatInfo.red;
  const black = spectatorSeatInfo.black;
  const rn = document.getElementById('specChoiceRedName');
  const rm = document.getElementById('specChoiceRedMeta');
  const bn = document.getElementById('specChoiceBlackName');
  const bm = document.getElementById('specChoiceBlackMeta');
  if(rn) rn.textContent = red ? (red.name || red.code || 'Kỳ thủ Đỏ') : 'Kỳ thủ Đỏ';
  if(rm) rm.textContent = red ? ('ID '+(red.code||'—')+' · theme '+(red.theme||'wood')) : 'Chưa vào bàn';
  if(bn) bn.textContent = black ? (black.name || black.code || 'Kỳ thủ Đen') : 'Kỳ thủ Đen';
  if(bm) bm.textContent = black ? ('ID '+(black.code||'—')+' · theme '+(black.theme||'wood')) : 'Chưa vào bàn';
  document.getElementById('spectatorChoiceOverlay')?.classList.add('show');
}

function closeSpectatorChoiceModal(){
  document.getElementById('spectatorChoiceOverlay')?.classList.remove('show');
}

async function fbSpectateRoom(){
  if(!fbAvailable()){
    setFbStatus('Chưa cấu hình Firebase.', true);
    return;
  }
  const code = document.getElementById('fbJoinCodeInput').value.trim().toUpperCase();
  if(!code){ setFbStatus('Nhập mã phòng trước đã.', true); return; }
  const authed = await requirePlayerAuth('Phòng online');
  if(!authed) return;

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
  state.online.version = -1;
  fbListen();
  fbListenChat();
  fbApplyState(data);
  setFbStatus(`👁 Đang xem phòng ${code} · lượt ${data.turn==='black'?'Đen':'Đỏ'} · v${data.version||0}. Có thể chat.`, false);
  showOnlineActive();
  try{ await openSpectatorChoiceModal(data); }catch(e){ applySpectatorView('both'); }
}

const ROOM_EMPTY_GRACE_MS = 3 * 60 * 1000;
const ROOM_WAITING_MAX_MS = 6 * 60 * 60 * 1000;

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
  }catch(err){  }
}

async function fbSweepExpiredReplays(){
  try{
    const snap = await fb.db.ref('replays').once('value');
    const all = snap.val();
    if(!all) return;
    const now = Date.now();
    for(const id in all){
      const r = all[id];
      if(!r) continue;
      const exp = typeof r.expiresAt === 'number' ? r.expiresAt
        : (typeof r.createdAt === 'number' ? r.createdAt + REPLAY_TTL_MS : 0);
      if(exp && now > exp){
        try{ fb.db.ref('replays/'+id).remove(); }catch(e){}
      }
    }
  }catch(err){  }
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
    renderPieces();
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
  setFbStatus('⚔️ Đã bắt đầu ván mới - đối thủ sẽ thấy ngay.', false);
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
  setFbStatus('🤝 Đã đồng ý đi lại.', false);
}

function declineOnlineUndo(){
  if(fb.roomRef) fb.roomRef.child('undoRequest').update({status:'declined'});
  document.getElementById('undoModalOverlay').classList.remove('show');
}

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

let chatSeenKeys = new Set();
let chatUnread = 0;
let floatChatCollapsed = false;

function clearChatUI(){
  chatSeenKeys = new Set();
  chatUnread = 0;
  chatMentionUnread = 0;
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

let chatMentionUnread = 0;
function updateChatUnreadBadge(){
  const badge = document.getElementById('floatChatUnread');
  if(!badge) return;
  if(chatUnread > 0 && floatChatCollapsed){
    badge.style.display = '';
    let t = '('+(chatUnread > 99 ? '99+' : String(chatUnread))+')';
    if(chatMentionUnread > 0) t += ' (@)';
    badge.textContent = t;
  } else {
    badge.style.display = 'none';
  }
}

function fbListenChat(){
  if(!fb.roomRef) return;
  fb.roomRef.child('chat').off('child_added');
  clearChatUI();
  roomChatMembers = {};
  showFloatChat(true);
  floatChatCollapsed = false;
  const body = document.getElementById('floatChatBody');
  if(body) body.style.display = '';
  loadRoomChatBans();
  updateChatBanBarVisibility();
  try{
    fb.roomRef.child('chatBans').on('value', snap=>{ roomChatBans = snap.val() || {}; });
  }catch(e){}
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
  }
  if(msg.achievements && msg.achievements.length){
    const wrap = document.createElement('span');
    wrap.className = 'chat-ach-wrap';
    wrap.innerHTML = achievementBadgesHtml(msg.achievements);
    head.appendChild(wrap);
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
  const rawText = msg.text || '';
  body.innerHTML = rawText.replace(/@([A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF]+)/g, '<span class="chat-mention-hl">@$1</span>');
  div.appendChild(body);
  return div;
}

function appendChatMessage(msg, opts={}){
  if(!msg || !msg.text) return;
  try{ trackChatMember(msg); }catch(e){}
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
    try{
      const myCode = (playerSession && playerSession.code) || '';
      const myName = (playerSession && playerSession.name) || '';
      const text = String(msg.text||'');
      if((myCode && text.toLowerCase().includes('@'+myCode.toLowerCase())) ||
         (myName && text.toLowerCase().includes('@'+myName.toLowerCase()))){
        chatMentionUnread++;
      }
    }catch(e){}
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

let roomChatBans = {};
let roomChatMembers = {};

async function loadRoomChatBans(){
  roomChatBans = {};
  if(!fb.roomRef) return;
  try{
    const snap = await fb.roomRef.child('chatBans').once('value');
    roomChatBans = snap.val() || {};
  }catch(e){}
}

function isChatBannedLocally(){
  const meta = resolveChatSenderMeta();
  const code = (meta.code || '').toUpperCase();
  const name = (meta.name || '').toUpperCase();
  if(code && roomChatBans[code]) return true;
  if(name && roomChatBans[name]) return true;
  try{
    if(window._globalChatBans){
      if(code && window._globalChatBans[code]) return true;
      if(name && window._globalChatBans[name]) return true;
    }
  }catch(e){}
  return false;
}

function canModerateChat(){
  try{
    if(typeof isAdminUnlocked === 'function' && isAdminUnlocked()) return true;
  }catch(e){}
  const role = (playerSession && playerSession.role || '').toLowerCase();
  if(role === 'mod' || role === 'admin' || role === 'superadmin' || role === 'caster') return true;
  if(state.online.active && !state.online.spectator && state.online.color) return true;
  return false;
}

function updateChatBanBarVisibility(){
  const bar = document.getElementById('chatBanBar');
  if(!bar) return;
  bar.style.display = (state.online.active && canModerateChat()) ? 'flex' : 'none';
}

async function banChatTarget(){
  const target = (document.getElementById('chatBanTarget')?.value || '').trim().toUpperCase();
  if(!target || !fb.roomRef) return;
  if(!canModerateChat()){
    showCoinPopup({ warn:true, icon:'🔒', title:'Không đủ quyền', html:'<div class="coin-popup-hint">Chỉ mod/admin hoặc người trong bàn mới cấm chat.</div>', okLabel:'Đóng' });
    return;
  }
  try{
    await fb.roomRef.child('chatBans/'+target).set({ by: (playerSession&&playerSession.code)||'admin', ts: Date.now() });
    roomChatBans[target] = true;
    document.getElementById('chatBanTarget').value = '';
    showToastPopup('🚫', 'Đã cấm chat', target);
    if(fb.roomRef){
      fb.roomRef.child('chat').push({
        system:true, name:'Hệ thống', text:'[HỆ THỐNG] Đã cấm chat «'+target+'».', ts: Date.now()
      }).catch(()=>{});
    }
  }catch(err){
    showCoinPopup({ warn:true, icon:'⚠️', title:'Lỗi', html:'<div class="coin-popup-hint">'+(err.message||err)+'</div>', okLabel:'Đóng' });
  }
}

async function unbanChatTarget(){
  const target = (document.getElementById('chatBanTarget')?.value || '').trim().toUpperCase();
  if(!target || !fb.roomRef) return;
  if(!canModerateChat()) return;
  try{
    await fb.roomRef.child('chatBans/'+target).remove();
    delete roomChatBans[target];
    document.getElementById('chatBanTarget').value = '';
    showToastPopup('🔓', 'Đã gỡ cấm', target);
  }catch(err){}
}

function trackChatMember(msg){
  if(!msg || msg.system) return;
  const key = (msg.code || msg.name || '').toUpperCase();
  if(!key) return;
  roomChatMembers[key] = { code: msg.code || '', name: msg.name || key, color: msg.color };
}

function getMentionCandidates(prefix){
  const p = (prefix || '').toUpperCase();
  const list = Object.values(roomChatMembers);
  if(state.online && state.online.roomCode){
    /* seats may have player codes */
  }
  return list.filter(m=>{
    const c = (m.code||'').toUpperCase();
    const n = (m.name||'').toUpperCase();
    return !p || c.includes(p) || n.includes(p);
  }).slice(0, 8);
}

function showMentionSuggest(inputEl){
  const box = document.getElementById('chatMentionSuggest');
  if(!box || !inputEl) return;
  const val = inputEl.value || '';
  const m = val.match(/@([A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF]*)$/);
  if(!m){ box.style.display = 'none'; return; }
  const candidates = getMentionCandidates(m[1]);
  if(!candidates.length){ box.style.display = 'none'; return; }
  box.innerHTML = '';
  candidates.forEach((c,i)=>{
    const div = document.createElement('div');
    div.className = 'chat-mention-item'+(i===0?' active':'');
    div.textContent = '@'+(c.code || c.name);
    div.addEventListener('click', ()=>{
      inputEl.value = val.replace(/@([A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF]*)$/, '@'+(c.code || c.name)+' ');
      box.style.display = 'none';
      inputEl.focus();
    });
    box.appendChild(div);
  });
  box.style.display = '';
}

function sendChat(fromFloat){
  const input = document.getElementById(fromFloat ? 'floatChatInput' : 'chatInput');
  const alt = document.getElementById(fromFloat ? 'chatInput' : 'floatChatInput');
  const text = (input && input.value || '').trim().slice(0, 200);
  if(!text || !fb.roomRef || !state.online.active) return;
  if(isChatBannedLocally()){
    showCoinPopup({ warn:true, icon:'🚫', title:'Bạn bị cấm chat', html:'<div class="coin-popup-hint">Tài khoản của bạn đang bị cấm chat trong phòng này.</div>', okLabel:'Đóng' });
    return;
  }
  const myColor = state.online.spectator ? 'spectator' : (state.online.color || 'spectator');
  const meta = resolveChatSenderMeta();
  const payload = {
    color: myColor,
    name: meta.name,
    code: meta.code || null,
    role: meta.role || 'player',
    achievements: getUnlockedAchievementIds().slice(0, 4),
    text,
    ts: Date.now(),
    system: false
  };
  trackChatMember(payload);
  fb.roomRef.child('chat').push(payload).catch(err=>{
    setFbStatus('Gửi chat thất bại: '+(err.message||err), true);
  });
  if(input) input.value = '';
  if(alt) alt.value = '';
  const sug = document.getElementById('chatMentionSuggest');
  if(sug) sug.style.display = 'none';
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

  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  if(drawer){ drawer.classList.add('open'); drawer.style.zIndex = '300'; }
  if(overlay){ overlay.classList.add('show'); overlay.style.zIndex = '299'; }
  document.getElementById('menuFab')?.classList.add('open');
  /* Chat nổi đè menu (z-index 70) → tạm khóa click khi drawer mở */
  const fc = document.getElementById('floatChat');
  if(fc){ fc.style.pointerEvents = 'none'; fc.dataset.drawerBlocked = '1'; }
  document.body.classList.add('drawer-open');
}
function closeDrawer(){
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  if(drawer){ drawer.classList.remove('open'); drawer.style.zIndex = ''; }
  if(overlay){ overlay.classList.remove('show'); overlay.style.zIndex = ''; }
  document.getElementById('menuFab')?.classList.remove('open');
  const fc = document.getElementById('floatChat');
  if(fc && fc.dataset.drawerBlocked){ fc.style.pointerEvents = ''; delete fc.dataset.drawerBlocked; }
  document.body.classList.remove('drawer-open');
}
function toggleDrawer(){
  document.getElementById('drawer').classList.contains('open') ? closeDrawer() : openDrawer();
}

function updateCheatPanelVisibility(){
  const panel = document.getElementById('cheatPanel');
  if(!panel) return;
  const show = state.mode!=='pvp' && !state.online.active;
  panel.style.display = show ? '' : 'none';
  if(show){ try{ refreshCheatUsesUI(); }catch(e){} }
}

function updateAiLevelBoxVisibility(){
  const box = document.getElementById('aiLevelBox');
  if(!box) return;
  box.style.display = (state.mode==='pve' && !state.online.active) ? '' : 'none';
}

function updateAiLevelBadge(){
  const slider = document.getElementById('aiLevelSlider');
  const badge = document.getElementById('aiLevelBadge');
  if(slider) slider.value = state.aiLevel;
  if(badge) badge.textContent = `${state.aiLevel} · ${(LEVEL_NAMES&&LEVEL_NAMES[state.aiLevel-1])||state.aiLevel}`;
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
    msg.textContent = `⚠ ${state.turn==='red'?'Đỏ':'Đen'} đang bị chiếu tướng!`;
    msg.classList.add('check');
  } else {
    msg.textContent = '';
    msg.classList.remove('check');
  }
  updateTurnIndicator();
}

function clearCaptured(){
  try{
    const r = document.getElementById('capturedRed');
    const b = document.getElementById('capturedBlack');
    if(r) r.innerHTML = '';
    if(b) b.innerHTML = '';
  }catch(e){}
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
  if(typeof replayTimer !== 'undefined' && replayTimer){ clearInterval(replayTimer); replayTimer=null; }
  if(!state.replay) state.replay = { active:false, moves:[], index:0 };
  state.replay.active = false;
  const bar = document.getElementById('replayBar');
  if(bar){
    bar.classList.remove('is-open');
    bar.hidden = true;
    bar.setAttribute('hidden','');
    bar.style.setProperty('display','none','important');
  }
  try{ window.__hideReplayBar && window.__hideReplayBar(); }catch(e){}
  const oldBar = document.getElementById('replayControlBar');
  if(oldBar) oldBar.style.display = 'none';
  const btn = document.getElementById('replayPlayBtn');
  if(btn){
    btn.innerHTML = '<i class="fa-regular fa-play"></i>';
    btn.classList.remove('playing');
  }
  try{ closeCoinPopup(); }catch(e){}
}

function showReplayBar(){
  const bar = document.getElementById('replayBar');
  if(!bar) return;
  bar.hidden = false;
  bar.removeAttribute('hidden');
  bar.style.removeProperty('display');
  bar.style.removeProperty('visibility');
  bar.classList.add('is-open');
  console.log('[replay] bar shown');
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
  showReplayBar();
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
  const total = (state.replay.moves && state.replay.moves.length) || 0;
  const idx = state.replay.index || 0;
  const label = document.getElementById('replayMoveLabel');
  if(label) label.textContent = `Nước ${idx} / ${total}`;
  const setDis = (id, v)=>{ const el = document.getElementById(id); if(el) el.disabled = !!v; };
  setDis('replayPrevBtn', idx===0);
  setDis('replayStartBtn', idx===0);
  setDis('replayNextBtn', idx===total);
  setDis('replayEndBtn', idx===total);
}

function toggleReplayPlay(){
  const btn = document.getElementById('replayPlayBtn');
  if(replayTimer){
    clearInterval(replayTimer); replayTimer = null;
    if(btn){ btn.innerHTML = '<i class="fa-regular fa-play"></i>'; btn.classList.remove('playing'); }
    return;
  }
  if(btn){ btn.innerHTML = '<i class="fa-regular fa-pause"></i>'; btn.classList.add('playing'); }
  replayTimer = setInterval(()=>{
    if(state.replay.index >= state.replay.moves.length){
      clearInterval(replayTimer); replayTimer = null;
      if(btn){ btn.innerHTML = '<i class="fa-regular fa-play"></i>'; btn.classList.remove('playing'); }
      return;
    }
    goToReplayIndex(state.replay.index+1);
  }, 750);
}
function exitReplay(){
  console.log('[replay] exitReplay()');
  try{ closeCoinPopup(); }catch(e){}
  try{ stopReplayIfActive(); }catch(e){}
  try{
    const bar = document.getElementById('replayBar');
    if(bar){ bar.classList.remove('is-open'); bar.style.display = 'none'; }
    window.__hideReplayBar && window.__hideReplayBar();
  }catch(e){}
  try{
    if(state.replay) state.replay.active = false;
    state.board = initialBoard();
    state.turn = 'red';
    state.selected = null;
    state.legalTargets = [];
    state.history = [];
    state.gameOver = false;
    state.lastMove = null;
    state.aiThinking = false;
    if(state.aiTimeoutId){ clearTimeout(state.aiTimeoutId); state.aiTimeoutId = null; }
    state.aiStake = 0;
    const cr = document.getElementById('capturedRed');
    const cb = document.getElementById('capturedBlack');
    const hb = document.getElementById('historyBox');
    if(cr) cr.innerHTML = '';
    if(cb) cb.innerHTML = '';
    if(hb) hb.innerHTML = '';
    document.getElementById('modalOverlay')?.classList.remove('show');
    try{ clearComments(); }catch(e){}
    try{ resetPieceLayer(); }catch(e){}
    try{ renderPieces(); }catch(e){}
    try{ renderMarkers(); }catch(e){}
    try{ updateStatus(); }catch(e){}
    try{ updateUndoBtn(); }catch(e){}
    try{ setAiBetStatus('Đã thoát xem lại - chưa cược. Bấm «Ván mới» khi muốn chơi/cược.', false); }catch(e){}
    try{ updateAiBetHint(); }catch(e){}
  }catch(e){
    console.warn('exitReplay', e);
    try{
      const bar = document.getElementById('replayBar');
      if(bar){ bar.classList.remove('is-open'); bar.style.display = 'none'; }
    }catch(e2){}
  }
}
try{
  window.exitReplay = exitReplay;
  window.goToReplayIndex = goToReplayIndex;
  window.toggleReplayPlay = toggleReplayPlay;
  window.showReplayBar = showReplayBar;
  window.stopReplayIfActive = stopReplayIfActive;
}catch(e){}

async function resetGame(opts={}){
  stopReplayIfActive();

  if(state.aiStakeLocked > 0 && getCoinIdentity()){
    try{
      await loadCoinStateFromPlayer();
      coinState.coins = Math.max(0, +(coinState.coins||0)) + state.aiStakeLocked;
      await saveCoinStateToPlayer();
      refreshThemeLocks();
    }catch(e){}
    state.aiStakeLocked = 0;
  }
  state.board = initialBoard();
  state.turn = 'red';
  state.selected = null;
  state.legalTargets = [];
  state.history = [];
  state.gameOver = false;
  state.lastMove = null;
  state.aiThinking = false;
  state.currentSave = null;
  const cr = document.getElementById('capturedRed');
  const cb = document.getElementById('capturedBlack');
  const hb = document.getElementById('historyBox');
  if(cr) cr.innerHTML='';
  if(cb) cb.innerHTML='';
  if(hb) hb.innerHTML='';
  try{ clearComments(); }catch(e){}
  document.getElementById('modalOverlay')?.classList.remove('show');
  try{ resetPieceLayer(); }catch(e){}
  try{ renderPieces(); }catch(e){}
  try{ renderMarkers(); }catch(e){}
  try{ updateStatus(); }catch(e){}
  try{ updateUndoBtn(); }catch(e){}

  if(!opts.skipAiStake){
    try{ await lockAiStakeIfNeeded(); }catch(e){}
  } else {
    state.aiStake = 0;

    try{ setAiBetStatus('Chưa cược máy. Bấm «Ván mới» khi muốn chơi/cược.', false); }catch(e){}
  }
  try{ updateAiBetHint(); }catch(e){}
}

document.getElementById('menuFab')?.addEventListener('click', toggleDrawer);
document.getElementById('drawerClose')?.addEventListener('click', closeDrawer);
document.getElementById('drawerOverlay')?.addEventListener('click', closeDrawer);

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

document.getElementById('aiLevelSlider')?.addEventListener('input', (e)=>{
  state.aiLevel = +e.target.value;
  updateAiLevelBadge();
  try{ updateAiBetHint(); }catch(err){}
});
document.getElementById('aiBetStake')?.addEventListener('input', ()=>{ try{ updateAiBetHint(); }catch(e){} });
document.getElementById('aiLockBetBtn')?.addEventListener('click', ()=>{ try{ closeDrawer(); }catch(e){} confirmAndLockAiBet(); });

document.getElementById('undoBtn')?.addEventListener('click', undo);
document.getElementById('resetBtn')?.addEventListener('click', resetGame);
document.getElementById('modalBtn')?.addEventListener('click', async ()=>{
  document.getElementById('modalOverlay')?.classList.remove('show');
  if(state.mode === 'pve' && !state.online.active){
    try{ await loadCoinStateFromPlayer(); }catch(e){}
    const coins = (coinState && coinState.coins) || 0;
    const lastStake = Math.max(0, +(state.aiStake || 0));
    const html = '<ul class="coin-popup-list">'+
      '<li>Số coin hiện có: <b>'+coins+'</b></li>'+
      '<li>Cấp máy: <b>'+(state.aiLevel||5)+'</b></li>'+
      '</ul>'+
      '<div style="margin-top:10px;text-align:left;"><label style="font-size:12px;color:var(--muted);">Số coin muốn cược tiếp</label>'+
      '<input type="number" id="replayBetInput" min="0" value="'+lastStake+'" style="width:100%;margin-top:4px;padding:8px 10px;border-radius:8px;border:1px solid rgba(200,151,63,0.35);background:rgba(0,0,0,0.35);color:var(--cream);"></div>';
    const ok = await showCoinPopup({
      confirm:true,
      icon:'🎲',
      title:'Cược tiếp với máy?',
      html,
      okLabel:'Đồng ý chơi',
      cancelLabel:'Hủy'
    });
    if(!ok){
      clearAiBetStakeInput();
      state.aiStake = 0;
      state.aiStakeLocked = 0;
      resetGame({ skipAiStake: true });
      return;
    }
    const inp = document.getElementById('replayBetInput');
    const stake = Math.max(0, Math.floor(+(inp && inp.value || 0)));
    const stakeEl = document.getElementById('aiBetStake');
    if(stakeEl) stakeEl.value = String(stake);
    state.aiStake = stake;
    if(stake > 0){
      await confirmAndLockAiBet();
    } else {
      resetGame({ skipAiStake: true });
    }
    return;
  }
  resetGame({ skipAiStake: true });
});
document.getElementById('modalCancelBtn')?.addEventListener('click', ()=>{
  document.getElementById('modalOverlay')?.classList.remove('show');
  clearAiBetStakeInput();
  state.aiStake = 0;
  state.aiStakeLocked = 0;
  resetGame({ skipAiStake: true });
});

document.getElementById('saveBtn')?.addEventListener('click', saveGame);
document.getElementById('loadBtn')?.addEventListener('click', loadGame);
document.getElementById('saveCodeInput')?.addEventListener('keydown', (e)=>{
  if(e.key==='Enter') loadGame();
});

document.getElementById('leaveRoomBtn')?.addEventListener('click', leaveRoom);

document.getElementById('fbCreateRoomBtn')?.addEventListener('click', fbCreateRoom);
document.getElementById('fbJoinRoomBtn')?.addEventListener('click', fbJoinRoom);
document.getElementById('fbSpectateBtn')?.addEventListener('click', fbSpectateRoom);
document.getElementById('shareRoomBtn')?.addEventListener('click', openShareRoomModal);
document.getElementById('shareRoomCloseBtn')?.addEventListener('click', closeShareRoomModal);
document.getElementById('copyShareLinkBtn')?.addEventListener('click', copyShareLink);
document.getElementById('fbJoinCodeInput')?.addEventListener('keydown', (e)=>{
  if(e.key==='Enter') fbJoinRoom();
});

document.getElementById('requestUndoBtn')?.addEventListener('click', requestUndo);
document.getElementById('undoModalAcceptBtn')?.addEventListener('click', acceptOnlineUndo);
document.getElementById('undoModalDeclineBtn')?.addEventListener('click', declineOnlineUndo);

document.getElementById('roomInviteJoinBtn')?.addEventListener('click', ()=>{
  document.getElementById('roomInviteModalOverlay')?.classList.remove('show');
  fbJoinRoom();
});
document.getElementById('roomInviteSpectateBtn')?.addEventListener('click', ()=>{
  document.getElementById('roomInviteModalOverlay')?.classList.remove('show');
  fbSpectateRoom();
});

/* chatSendBtn / chatInput cũ đã gỡ — chỉ dùng float chat */
document.getElementById('chatSendBtn')?.addEventListener('click', ()=> sendChat(false));
document.getElementById('chatInput')?.addEventListener('keydown', (e)=>{
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
  if(!floatChatCollapsed){ chatUnread = 0; chatMentionUnread = 0; updateChatUnreadBadge(); }
  else updateChatUnreadBadge();
});
document.getElementById('floatChatHeader')?.addEventListener('click', (e)=>{
  if(e.target.closest('.float-chat-min')) return;
  if(floatChatCollapsed){
    floatChatCollapsed = false;
    const body = document.getElementById('floatChatBody');
    if(body) body.style.display = '';
    chatUnread = 0;
    chatMentionUnread = 0;
    updateChatUnreadBadge();
  }
});

document.getElementById('soundToggle')?.addEventListener('change', (e)=>{
  state.soundOn = e.target.checked;
});
document.getElementById('viGlyphToggle')?.addEventListener('change', (e)=>{
  state.viGlyphs = !!e.target.checked;
  try{ localStorage.setItem('cotuong_vi_glyphs', state.viGlyphs ? '1' : '0'); }catch(err){}
  if(CONFIG){
    GLYPHS = state.viGlyphs && CONFIG.glyphsVi ? CONFIG.glyphsVi : CONFIG.glyphs;
  }
  try{ renderPieces(); }catch(err){}
  try{ renderCaptured(); }catch(err){}
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
document.querySelectorAll('#invTabs .shop-tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    invTab = btn.dataset.invTab || 'all';
    document.querySelectorAll('#invTabs .shop-tab').forEach(b=>b.classList.toggle('active', b===btn));
    renderInventoryList();
  });
});

document.getElementById('modalReplayBtn')?.addEventListener('click', enterReplay);
function wireReplayShareClose(){
  const btn = document.getElementById('replayShareCloseBtn');
  if(btn && !btn.dataset.wired){
    btn.dataset.wired = '1';
    btn.addEventListener('click', function(e){ e.preventDefault(); closeReplayShareBar(); });
  }
}
wireReplayShareClose();
document.addEventListener('DOMContentLoaded', wireReplayShareClose);
document.addEventListener('click', function(e){
  const t = e.target;
  if(!t) return;
  if(t.id === 'replayShareCloseBtn' || (t.closest && t.closest('#replayShareCloseBtn'))){
    e.preventDefault();
    closeReplayShareBar();
  }
}, true);
document.getElementById('modalRematchBtn')?.addEventListener('click', rematchOnline);
document.getElementById('replayStartBtn')?.addEventListener('click', ()=>goToReplayIndex(0));
document.getElementById('replayPrevBtn')?.addEventListener('click', ()=>goToReplayIndex(state.replay.index-1));
document.getElementById('replayNextBtn')?.addEventListener('click', ()=>goToReplayIndex(state.replay.index+1));
document.getElementById('replayEndBtn')?.addEventListener('click', ()=>goToReplayIndex(state.replay.moves.length));
document.getElementById('replayPlayBtn')?.addEventListener('click', toggleReplayPlay);
const _replayCloseBtn = document.getElementById('replayCloseBtn');
if(_replayCloseBtn){
  _replayCloseBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); exitReplay(); });
}

document.getElementById('cheatBuyUsesBtn')?.addEventListener('click', ()=>{ try{ closeDrawer(); }catch(e){} buyCheatUses(); });
document.getElementById('skipAiBtn')?.addEventListener('click', ()=>{ try{ closeDrawer(); }catch(e){} cheatSkipAiTurn(); });
document.getElementById('beheadBtn')?.addEventListener('click', ()=>{ try{ closeDrawer(); }catch(e){} cheatBeheadGeneral(); });
document.getElementById('reviveChariotBtn')?.addEventListener('click', ()=>{ try{ closeDrawer(); }catch(e){} cheatReviveChariot(); });
document.getElementById('killModeToggle')?.addEventListener('change', (e)=>{
  state.cheat.killMode = e.target.checked;
  document.getElementById('cheatPanel')?.classList.toggle('killmode-on', state.cheat.killMode);
  try{ closeDrawer(); }catch(err){}
});

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
    showToastPopup('🛡️', 'Đăng nhập Admin thành công', 'Phiên '+cfg.sessionMinutes+' phút');
    try{ closeDrawer(); }catch(e){}
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
        showToastPopup('🛡️', 'Đăng nhập Admin thành công', matched.code||matched.name||'');
        try{ closeDrawer(); }catch(e){}
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
  showToastPopup('👋', 'Đã đăng xuất Admin', 'Phiên admin đã kết thúc.');
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
    setAdminPwdStatus('Phiên hết hạn - đăng nhập lại.', 'err');
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
  if(!fbAvailable()) throw new Error('Firebase chưa cấu hình.');
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

function tcSave(){  }

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
    setAdminStatus('Không thể hạ Admin chính duy nhất - cần giữ ít nhất 1 superadmin.', 'err');
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
    patch.password = null;
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
    player: 'TUYỂN THỦ',
    vip: 'VIP',
    mod: 'MOD',
    caster: 'CASTER',
    admin: 'ADMIN PHỤ',
    superadmin: 'ADMIN CHÍNH',
    bronze: 'THÀNH VIÊN ĐỒNG',
    silver: 'THÀNH VIÊN BẠC',
    gold: 'THÀNH VIÊN VÀNG',
    diamond: 'THÀNH VIÊN KIM CƯƠNG',
    elite: 'THÀNH VIÊN TINH ANH',
    owner1: 'CHỦ CLAN CẤP 1',
    owner2: 'CHỦ CLAN CẤP 2',
    manager: 'QUẢN LÝ',
    member: 'THÀNH VIÊN'
  })[r] || String(r||'player').toUpperCase();
}
/** Badge HTML chuẩn — luôn chữ hoa */
function roleBadgeHtml(role, extraClass){
  const r = role || 'player';
  const cls = 'role-badge '+(extraClass||r);
  return '<span class="'+cls+'">'+roleLabel(r)+'</span>';
}
/** Badge thành viên (tier) hoặc role hệ thống */
function memberBadgeHtml(session){
  if(!session) return '';
  const tier = session.memberTier || session.badge || '';
  const role = session.role || 'player';
  // Ưu tiên gói thành viên nếu còn hạn / permanent
  if(tier && (session.vipPermanent || !session.vipExpires || +session.vipExpires > Date.now() || role==='vip')){
    return roleBadgeHtml(tier, tier);
  }
  if(role && role !== 'player') return roleBadgeHtml(role);
  return roleBadgeHtml('player');
}


const PROTECTED_ROLES = ['admin', 'superadmin'];
function isProtectedRole(role){
  return PROTECTED_ROLES.includes(role || '');
}

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
          (typeof roleBadgeHtml==='function' ? roleBadgeHtml(role) : ('<span class="role-badge '+role+'">'+roleLabel(role)+'</span>'))+
        '</div>'+
        '<div class="admin-item-meta">'+p.name+(p.nick?' («'+p.nick+'»)':'')+
          ' · Elo '+(p.elo||0)+(p.club?' · '+p.club:'')+
          (tn?' · '+tn.code:'')+
          '<br>MK: <code>'+(p.password || (p.passwordHash ? '•••••• (đã mã hoá)' : '—'))+'</code>'+
          (p.weeklyCode ? ' · Mã 7 ngày: <code>'+p.weeklyCode+'</code>' : '')+
          (p.hometown ? ' · '+p.hometown : '')+
          (p.dob ? ' · NS '+p.dob : '')+
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

async function ensureTournamentRoom(code, match){
  await adminEnsureFb();
  const ref = fb.db.ref('rooms/'+code);
  const snap = await ref.once('value');
  if(snap.val()) return false;
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
      payload.chat = null;
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

function loadBroadcastForm(){
  const b = tcData.broadcast || {};
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
  set('bcFeatured', b.featured);
  set('bcTitle', b.title);
  set('bcStreamUrl', b.streamUrl);
  set('bcSpectatorMode', b.spectatorMode||'open');
  set('bcTicker', b.ticker);
  set('bcThemeBoth', b.themeBoth||'wood');
  set('bcThemeRed', b.themeRed||'');
  set('bcThemeBlack', b.themeBlack||'');
  updateBcShareLink();
}

async function saveBroadcast(){
  const row = {
    featured: (document.getElementById('bcFeatured').value||'').trim(),
    title: (document.getElementById('bcTitle').value||'').trim(),
    streamUrl: (document.getElementById('bcStreamUrl').value||'').trim(),
    spectatorMode: document.getElementById('bcSpectatorMode').value,
    ticker: (document.getElementById('bcTicker').value||'').trim(),
    themeBoth: (document.getElementById('bcThemeBoth')?.value||'wood').trim() || 'wood',
    themeRed: (document.getElementById('bcThemeRed')?.value||'').trim(),
    themeBlack: (document.getElementById('bcThemeBlack')?.value||'').trim()
  };
  try{
    await tcSet('admin/broadcast', row);
    tcData.broadcast = row;
    spectatorBroadcastCfg = { themeBoth: row.themeBoth, themeRed: row.themeRed, themeBlack: row.themeBlack };
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
  if(!confirm('Xác nhận lần cuối - không hoàn tác được? (Kỳ thủ vẫn còn)')) return;
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

document.getElementById('adminLoginBtn')?.addEventListener('click', tryAdminLogin);
document.getElementById('adminPasswordInput')?.addEventListener('keydown', (e)=>{
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
document.getElementById('adminCloseBtn')?.addEventListener('click', closeAdminPanel);
document.getElementById('adminRefreshBtn')?.addEventListener('click', async ()=>{
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
document.getElementById('adminSweepBtn')?.addEventListener('click', adminSweepExpired);
document.getElementById('adminDeleteAllRoomsBtn')?.addEventListener('click', adminDeleteAllRooms);
document.getElementById('adminDeleteAllSavesBtn')?.addEventListener('click', adminDeleteAllSaves);
document.getElementById('adminSavePwdBtn')?.addEventListener('click', saveNewAdminPassword);
document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);
document.getElementById('adminNewPwd2')?.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') saveNewAdminPassword();
});

document.querySelectorAll('.admin-nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> switchAdminSection(btn.dataset.section));
});

document.getElementById('tourCreateBtn')?.addEventListener('click', createTournament);
document.getElementById('playerCreateBtn')?.addEventListener('click', createPlayer);
document.getElementById('playerGenAccountsBtn')?.addEventListener('click', generateBulkPlayers);
document.getElementById('bracketGenerateBtn')?.addEventListener('click', generateBracket);
document.getElementById('bracketClearBtn')?.addEventListener('click', clearBracket);
document.getElementById('bracketTournament')?.addEventListener('change', renderBracketList);
document.getElementById('matchAssignBtn')?.addEventListener('click', assignMatchRoom);
document.getElementById('matchCreateRoomBtn')?.addEventListener('click', createAndAssignRoom);

document.getElementById('refPauseBtn')?.addEventListener('click', ()=> refCommand('pause'));
document.getElementById('refResumeBtn')?.addEventListener('click', ()=> refCommand('resume'));
document.getElementById('refForceDrawBtn')?.addEventListener('click', ()=> refCommand('force_draw'));
document.getElementById('refRedWinBtn')?.addEventListener('click', ()=> refCommand('red_win'));
document.getElementById('refBlackWinBtn')?.addEventListener('click', ()=> refCommand('black_win'));
document.getElementById('refResetBoardBtn')?.addEventListener('click', ()=> refCommand('reset'));
document.getElementById('refMessageBtn')?.addEventListener('click', ()=> refCommand('message'));

document.getElementById('groupGenerateBtn')?.addEventListener('click', generateGroups);
document.getElementById('groupClearBtn')?.addEventListener('click', clearGroups);
document.getElementById('groupTournament')?.addEventListener('change', renderGroups);
document.getElementById('formatSaveBtn')?.addEventListener('click', saveFormatConfig);

document.getElementById('liveRefreshBtn')?.addEventListener('click', renderLiveMonitor);
document.getElementById('adminWatchBtn')?.addEventListener('click', ()=> adminWatchRoom());
document.getElementById('adminWatchCode')?.addEventListener('keydown', e=>{ if(e.key==='Enter') adminWatchRoom(); });
document.getElementById('liveAutoRefreshBtn')?.addEventListener('click', toggleLiveAutoRefresh);

document.getElementById('bcSaveBtn')?.addEventListener('click', saveBroadcast);
document.getElementById('bcPushTickerBtn')?.addEventListener('click', pushTicker);
document.getElementById('bcCopyLinkBtn')?.addEventListener('click', copyBcLink);
document.getElementById('bcFeatured')?.addEventListener('input', updateBcShareLink);
document.getElementById('adminWipeTournamentBtn')?.addEventListener('click', wipeTournamentData);

document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    const ov = document.getElementById('adminOverlay');
    if(ov && ov.classList.contains('show')) closeAdminPanel();
  }
});

const PLAYER_SESSION_KEY = 'co-tuong-player-session';
const PLAYER_SESSION_MS = 30 * 24 * 60 * 60 * 1000; /* 30 ngày */
const WEEKLY_CODE_MS = 7 * 24 * 60 * 60 * 1000; /* 7 ngày */
let playerSession = null;
let accessGatePassed = false;
let accessPresenceRef = null;

function loadPlayerSession(){
  try{
    const raw = localStorage.getItem(PLAYER_SESSION_KEY) || sessionStorage.getItem(PLAYER_SESSION_KEY);
    playerSession = raw ? JSON.parse(raw) : null;
    if(playerSession && playerSession.loginAt){
      const age = Date.now() - (+playerSession.loginAt || 0);
      if(age > PLAYER_SESSION_MS){
        /* hết 30 ngày — bắt buộc nhập lại mật khẩu */
        playerSession = null;
        try{ localStorage.removeItem(PLAYER_SESSION_KEY); sessionStorage.removeItem(PLAYER_SESSION_KEY); }catch(e){}
      }
    }
  }catch(e){ playerSession = null; }
  renderPlayerSessionUI();
  if(playerSession && playerSession.code){
    setTimeout(()=>{ try{ checkWeeklyCodePrompt(); }catch(e){} }, 1200);
    setTimeout(()=>{ try{ claimPlayerPresence(); }catch(e){} }, 800);
  }
}
function savePlayerSession(s){
  playerSession = s;
  try{ loadCoinStateFromPlayer(); }catch(e){}
  try{
    if(s){
      if(!s.loginAt) s.loginAt = Date.now();
      localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(s));
      sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(s));
    } else {
      localStorage.removeItem(PLAYER_SESSION_KEY);
      sessionStorage.removeItem(PLAYER_SESSION_KEY);
    }
  }catch(e){}
  renderPlayerSessionUI();
  if(s && s.code) try{ claimPlayerPresence(); }catch(e){}
  else try{ releasePlayerPresence(); claimGuestPresence(); }catch(e){}
}
function renderPlayerSessionUI(){
  const idle = document.getElementById('playerLoginIdle');
  const active = document.getElementById('playerLoginActive');
  if(!idle || !active) return;
  if(playerSession && playerSession.code){
    idle.style.display = 'none';
    active.style.display = '';
    const nameEl = document.getElementById('playerSessionName');
    const metaEl = document.getElementById('playerSessionMeta');
    const name = playerSession.name || playerSession.code || '';
    const badge = typeof memberBadgeHtml === 'function' ? memberBadgeHtml(playerSession) : '';
    if(nameEl) nameEl.innerHTML = '<span class="player-session-name-text">'+name+'</span> '+badge;
    if(metaEl){
      metaEl.innerHTML = 'ID <b>'+playerSession.code+'</b>'+
        (playerSession.tnCode ? ' · Giải '+playerSession.tnCode : '')+
        (playerSession.clanName ? ' · Clan '+playerSession.clanName : '');
    }
  } else {
    idle.style.display = '';
    active.style.display = 'none';
  }
}

async function tryPlayerLogin(){
  const rawId = (document.getElementById('playerLoginId')?.value||'').trim();
  const pwd = (document.getElementById('playerLoginPwd')?.value||'');
  const tnCode = (document.getElementById('playerLoginTnCode')?.value||'').trim().toUpperCase();
  const st = document.getElementById('playerLoginStatus');
  const setSt = (m, warn)=>{ if(st){ st.textContent=m; st.className='online-status'+(warn?' warn': m?' live':''); } };
  if(!rawId || !pwd){ setSt('Nhập mã ID (hoặc email) và mật khẩu.', true); return; }
  if(pwd.length < 6){ setSt('Mật khẩu tối thiểu 6 ký tự (Firebase).', true); return; }
  try{
    if(!fbAvailable()) throw new Error('Firebase chưa sẵn sàng');
    await fbInit();

    const looksLikeEmail = rawId.includes('@');
    const pidGuess = looksLikeEmail ? '' : rawId.toUpperCase().replace(/[^A-Z0-9]/g,'');

    /* Thử lần lượt các email Auth có thể dùng.
       Firebase mới gom user-not-found + wrong-password → auth/invalid-credential
       nên phải thử hết danh sách, không dừng sớm. */
    const emailsToTry = [];
    if(looksLikeEmail){
      emailsToTry.push(rawId.toLowerCase());
      /* fallback: nếu user gõ email nhưng account tạo bằng ID ảo */
    } else {
      emailsToTry.push(playerAuthEmail(pidGuess));
      /* một số bản cũ có thể lưu khác format */
      if(pidGuess){
        emailsToTry.push(pidGuess.toLowerCase() + '@cotuong.player');
        emailsToTry.push(pidGuess.toLowerCase() + '@players.cotuong.app');
      }
    }

    let cred = null;
    let lastAuthErr = null;
    const tried = new Set();
    for(const email of emailsToTry){
      if(!email || tried.has(email)) continue;
      tried.add(email);
      try{
        cred = await fb.auth.signInWithEmailAndPassword(email, pwd);
        break;
      }catch(authErr){
        lastAuthErr = authErr;
        /* tiếp tục thử email khác */
      }
    }

    if(!cred){
      const c = lastAuthErr && lastAuthErr.code;
      if(c === 'auth/too-many-requests'){
        setSt('Thử quá nhiều lần. Đợi vài phút rồi thử lại.', true);
        return;
      }
      if(c === 'auth/invalid-email'){
        setSt('ID/Email không hợp lệ.', true);
        return;
      }
      /* invalid-credential / wrong-password / user-not-found */
      setSt(looksLikeEmail
        ? 'Sai email/mật khẩu, hoặc email này chỉ là liên hệ — hãy thử đăng nhập bằng mã ID (vd. XK0001).'
        : 'Sai mật khẩu hoặc mã ID. Nếu vừa đăng ký bằng email, hãy đăng nhập bằng đúng email đó.', true);
      return;
    }
    fb.uid = cred.user.uid;
    const authEmail = (cred.user.email || emailsToTry[0] || '').toLowerCase();

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

    /* Tìm profile: theo authUid → email → mã ID */
    let player = Object.values(players).find(p => p.authUid && p.authUid === cred.user.uid) || null;
    if(!player && authEmail){
      player = Object.values(players).find(p =>
        (p.authEmail||'').toLowerCase() === authEmail ||
        (p.email||'').toLowerCase() === authEmail
      ) || null;
    }
    if(!player && pidGuess){
      player = Object.values(players).find(p => (p.code||'').toUpperCase() === pidGuess)
        || players[pidGuess] || null;
    }

    const pwdHash = await sha256Hex(pwd);
    const codeForNew = pidGuess || ('XK' + String(Date.now()).slice(-6));
    if(!player){
      player = {
        id: codeForNew, code: codeForNew, name: codeForNew,
        password: pwd, passwordHash: pwdHash,
        role: 'player', coins: 0,
        unlocked: ['wood','jade','rosewood','marble'],
        authUid: cred.user.uid,
        authEmail: authEmail,
        email: looksLikeEmail ? authEmail : '',
        createdAt: Date.now()
      };
      await fb.db.ref('players/'+codeForNew).set(player);
    } else {
      const patch = {
        authUid: cred.user.uid,
        authEmail: authEmail,
        password: pwd,
        passwordHash: pwdHash
      };
      if(looksLikeEmail) patch.email = authEmail;
      try{ await fb.db.ref('players/'+(player.id||player.code)).update(patch); }catch(e){}
      player = Object.assign({}, player, patch);
    }

    if(tn && player.tournamentId && player.tournamentId !== tn.id){
      setSt('Kỳ thủ không thuộc giải này.', true);
      return;
    }
    if(!tn && player.tournamentId && tournaments[player.tournamentId]){
      tn = tournaments[player.tournamentId];
    }

    const pidFinal = player.id || player.code || pidGuess || codeForNew;
    let role = player.role || 'player';
    if(role === 'vip' && !player.vipPermanent && player.vipExpires && +player.vipExpires > 0 && Date.now() > +player.vipExpires){
      role = 'player';
      try{ await fb.db.ref('players/'+pidFinal).update({ role: 'player' }); }catch(e){}
    }
    savePlayerSession({
      id: pidFinal, code: player.code || pidFinal, name: player.name || pidFinal,
      role: role,
      tnId: tn ? tn.id : (player.tournamentId || ''),
      tnCode: tn ? tn.code : '',
      tournamentId: player.tournamentId || (tn ? tn.id : ''),
      age: player.age || '',
      hometown: player.hometown || '',
      club: player.club || '',
      dob: player.dob || '',
      avatar: player.avatar || '',
      clanId: player.clanId || '',
      clanName: player.clanName || '',
      email: player.email || (looksLikeEmail ? authEmail : ''),
      loginAt: Date.now(),
      lastWeeklyCodeAt: player.lastWeeklyCodeAt || 0,
      weeklyCode: player.weeklyCode || '',
      authUid: cred.user.uid
    });
    if(document.getElementById('playerLoginPwd')) document.getElementById('playerLoginPwd').value = '';
    setSt('Đăng nhập thành công'+(tn ? ' · Giải '+tn.code : '')+'.', false);
    tcData.players = players;
    tcData.tournaments = tournaments;
    try{
      const mSnap = await fb.db.ref('matches').once('value');
      tcData.matches = mSnap.val() || {};
    }catch(e){}
    showToastPopup('✅', 'Đăng nhập thành công', (player.name||player.code)+(tn ? ' · Giải '+tn.code : ''));
    try{ closeDrawer(); }catch(e){}
    try{ bindBetChallengeListener(); }catch(e){}
    setTimeout(()=> checkWeeklyCodePrompt(), 1500);
  }catch(err){
    setSt('Lỗi: '+(err.message||err), true);
  }
}

function playerLogout(){
  try{ if(fb.auth && fb.auth.currentUser) fb.auth.signOut(); }catch(e){}
  fb.uid = null;
  try{ releasePlayerPresence(); }catch(e){}
  savePlayerSession(null);
  const st = document.getElementById('playerLoginStatus');
  if(st){ st.textContent='Đã đăng xuất.'; st.className='online-status live'; }
  showToastPopup('👋', 'Đã đăng xuất', 'Hẹn gặp lại kỳ thủ!');
  try{ closeDrawer(); }catch(e){}
}

function switchAuthTab(tab){
  const loginForm = document.getElementById('playerLoginForm');
  const regForm = document.getElementById('playerRegisterForm');
  document.querySelectorAll('.auth-tab-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.authTab === tab);
  });
  if(loginForm) loginForm.style.display = tab === 'register' ? 'none' : '';
  if(regForm) regForm.style.display = tab === 'register' ? '' : 'none';
}

async function tryPlayerRegister(){
  const st = document.getElementById('playerLoginStatus');
  const setSt = (m, warn)=>{ if(st){ st.textContent=m; st.className='online-status'+(warn?' warn': m?' live':''); } };
  const name = (document.getElementById('regName')?.value||'').trim();
  const regEmailRaw = (document.getElementById('regEmail')?.value||'').trim().toLowerCase();
  const club = (document.getElementById('regClub')?.value||'').trim();
  const dob = document.getElementById('regDob')?.value || '';
  const hometown = (document.getElementById('regHometown')?.value||'').trim();
  /* Giữ nguyên mật khẩu như người dùng gõ — không upper/lower */
  const pwd = document.getElementById('regPwd')?.value || '';
  const pwd2 = document.getElementById('regPwd2')?.value || '';
  if(!name){ setSt('Nhập họ tên.', true); return; }
  if(regEmailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmailRaw)){
    setSt('Email không hợp lệ.', true); return;
  }
  if(!pwd || pwd.length < 6){ setSt('Firebase yêu cầu mật khẩu tối thiểu 6 ký tự.', true); return; }
  if(pwd !== pwd2){ setSt('Mật khẩu nhập lại không khớp.', true); return; }
  try{
    if(!fbAvailable()) throw new Error('Firebase chưa sẵn sàng');
    await fbInit();

    let regOpen = true;
    try{
      const u = fb.auth.currentUser;
      if(u){
        const cfgSnap = await fb.db.ref('admin/accessConfig').once('value');
        const cfg = cfgSnap.val() || {};
        regOpen = !(cfg.regOpen === false || cfg.regOpen === 0 || cfg.regOpen === '0');
      }
    }catch(e){}
    if(!regOpen){
      setSt('Đăng ký đang đóng. Liên hệ admin.', true);
      showCoinPopup({ warn:true, icon:'🔒', title:'Đăng ký đã đóng', html:'<div class="coin-popup-hint">Admin đã tắt đăng ký tài khoản mới.</div>', okLabel:'Đóng' });
      return;
    }

    /* 1) Tạo user tạm để có quyền ghi counter */
    const tempEmail = 'tmp' + Date.now() + Math.random().toString(36).slice(2,8) + '@cotuong.player';
    let tempCred;
    try{
      tempCred = await fb.auth.createUserWithEmailAndPassword(tempEmail, pwd);
    }catch(authErr){
      if(authErr && authErr.code === 'auth/weak-password'){
        setSt('Mật khẩu quá yếu (tối thiểu 6 ký tự).', true); return;
      }
      throw authErr;
    }
    fb.uid = tempCred.user.uid;

    /* 2) Cấp mã XK */
    const counterRef = fb.db.ref('admin/playerIdCounter');
    const result = await counterRef.transaction(cur=>{
      const n = (typeof cur === 'number' && cur >= 0) ? cur + 1 : 1;
      return n;
    });
    if(!result.committed){
      try{ await tempCred.user.delete(); }catch(e){}
      setSt('Không cấp được mã kỳ thủ. Thử lại.', true); return;
    }
    const num = result.snapshot.val();
    const code = 'XK' + String(num).padStart(4, '0');
    const id = code;
    const role = (num === 1) ? 'superadmin' : 'player';

    /* 3) Auth Firebase LUÔN dùng email ảo theo mã ID → đăng nhập bằng XK0001 luôn ổn định.
       Email liên hệ (nếu có) chỉ lưu profile; nếu user đăng nhập bằng email liên hệ
       sẽ thử thêm email đó (một số tài khoản cũ tạo bằng email thật). */
    const syntheticEmail = playerAuthEmail(code);
    let finalEmail = syntheticEmail;

    /* 4) Xóa user tạm → tạo user thật với syntheticEmail + đúng mật khẩu (không dùng updateEmail) */
    try{ await tempCred.user.delete(); }catch(e){}
    fb.uid = null;
    try{ await fb.auth.signOut(); }catch(e){}

    let cred;
    try{
      cred = await fb.auth.createUserWithEmailAndPassword(finalEmail, pwd);
    }catch(authErr){
      if(authErr && authErr.code === 'auth/email-already-in-use'){
        setSt('Mã ID này đã có tài khoản Auth. Hãy đăng nhập bằng '+code+' hoặc liên hệ admin.', true);
        return;
      }
      if(authErr && authErr.code === 'auth/invalid-email'){
        setSt('Lỗi email hệ thống. Thử lại.', true); return;
      }
      throw authErr;
    }
    fb.uid = cred.user.uid;

    /* 5) Kiểm tra ngay: đăng nhập lại được với đúng mật khẩu */
    try{ await fb.auth.signOut(); }catch(e){}
    try{
      cred = await fb.auth.signInWithEmailAndPassword(finalEmail, pwd);
      fb.uid = cred.user.uid;
    }catch(verifyErr){
      setSt('Tạo tài khoản xong nhưng xác minh mật khẩu thất bại. Thử đăng ký lại.', true);
      return;
    }

    const pwdHash = await sha256Hex(pwd);
    const player = {
      id, code, name,
      club: club || '',
      dob: dob || '',
      hometown: hometown || '',
      email: regEmailRaw || '',
      password: pwd,
      passwordHash: pwdHash,
      role,
      coins: 30,
      unlocked: ['wood','jade','rosewood','marble'],
      authUid: cred.user.uid,
      authEmail: finalEmail,
      syntheticEmail: syntheticEmail,
      createdAt: Date.now(),
      weeklyCode: '',
      lastWeeklyCodeAt: 0
    };
    await fb.db.ref('players/'+id).set(player);

    /* Index để tìm auth email (khi đã login / admin) */
    try{
      await fb.db.ref('loginIndex/id/'+code).set({ authEmail: finalEmail, code, ts: Date.now() });
      if(regEmailRaw){
        const ek = regEmailRaw.replace(/[.#$\[\]/]/g, ',');
        await fb.db.ref('loginIndex/email/'+ek).set({ authEmail: finalEmail, code, ts: Date.now() });
      }
    }catch(e){}

    try{ await fb.auth.signOut(); }catch(e){}
    fb.uid = null;

    setSt('Đăng ký thành công · ID '+code+(role==='superadmin'?' · Superadmin':''), false);
    showCoinPopup({
      icon:'🎉', title:'Đăng ký thành công!',
      html:'<ul class="coin-popup-list">'+
        '<li>Mã kỳ thủ: <b>'+code+'</b></li>'+
        '<li>Tên: <b>'+name+'</b></li>'+
        
        (role==='superadmin'?'<li>Vai trò: <b>Superadmin</b> (tài khoản đầu tiên)</li>':'')+
        '<li><b>Cách đăng nhập:</b> nhập mã <b>'+code+'</b> + mật khẩu vừa tạo</li>'+
        ''+
        '</ul>',
      okLabel:'Đóng'
    });
    ['regName','regEmail','regClub','regDob','regHometown','regPwd','regPwd2'].forEach(rid=>{
      const el = document.getElementById(rid); if(el) el.value = '';
    });
    if(document.getElementById('playerLoginId')) document.getElementById('playerLoginId').value = code;
    if(document.getElementById('playerLoginPwd')) document.getElementById('playerLoginPwd').value = '';
    switchAuthTab('login');
    try{ closeDrawer(); }catch(e){}
  }catch(err){
    setSt('Đăng ký thất bại: '+(err.message||err), true);
  }
}

async function checkWeeklyCodePrompt(){
  if(!playerSession || !playerSession.id) return;
  const last = +(playerSession.lastWeeklyCodeAt || 0);
  if(last && (Date.now() - last) < WEEKLY_CODE_MS) return;
  openWeeklyCodeModal();
}

function openWeeklyCodeModal(){
  const ov = document.getElementById('weeklyCodeOverlay');
  if(!ov) return;
  ov.querySelectorAll('.pin-box').forEach(b=>{ b.value=''; b.placeholder='-'; });
  ov.classList.add('show');
  const first = ov.querySelector('.pin-box');
  if(first) setTimeout(()=> first.focus(), 100);
}

function closeWeeklyCodeModal(){
  document.getElementById('weeklyCodeOverlay')?.classList.remove('show');
}

function wireWeeklyPinBoxes(){
  const boxes = [...document.querySelectorAll('#weeklyPinBoxes .pin-box')];
  if(!boxes.length) return;
  boxes.forEach((box, i)=>{
    box.addEventListener('input', (e)=>{
      let v = (e.target.value||'').replace(/\D/g,'').slice(-1);
      e.target.value = v;
      e.target.placeholder = v ? '' : '-';
      if(v && i < boxes.length-1) boxes[i+1].focus();
    });
    box.addEventListener('keydown', (e)=>{
      if(e.key==='Backspace' && !e.target.value && i>0){
        boxes[i-1].focus();
        boxes[i-1].value='';
        boxes[i-1].placeholder='-';
      }
      if(e.key==='Enter') document.getElementById('weeklyCodeSaveBtn')?.click();
    });
    box.addEventListener('paste', (e)=>{
      e.preventDefault();
      const txt = (e.clipboardData.getData('text')||'').replace(/\D/g,'').slice(0,6);
      txt.split('').forEach((ch,j)=>{ if(boxes[j]){ boxes[j].value=ch; boxes[j].placeholder=''; } });
      if(boxes[Math.min(txt.length,5)]) boxes[Math.min(txt.length,5)].focus();
    });
  });
}

async function saveWeeklyCodeFromModal(){
  const boxes = [...document.querySelectorAll('#weeklyPinBoxes .pin-box')];
  const cleaned = boxes.map(b=> (b.value||'').replace(/\D/g,'')).join('');
  if(cleaned.length !== 6){
    showCoinPopup({ warn:true, icon:'⚠️', title:'Mã không hợp lệ', html:'<div class="coin-popup-hint">Nhập đủ 6 chữ số.</div>', okLabel:'Đóng' });
    return;
  }
  if(!playerSession || !playerSession.id){ closeWeeklyCodeModal(); return; }
  try{
    await tcEnsureFb();
    await fb.db.ref('players/'+playerSession.id).update({
      weeklyCode: cleaned,
      lastWeeklyCodeAt: Date.now()
    });
    playerSession.weeklyCode = cleaned;
    playerSession.lastWeeklyCodeAt = Date.now();
    savePlayerSession(playerSession);
    closeWeeklyCodeModal();
    showToastPopup('🔐', 'Đã lưu mã 7 ngày', 'Mã: '+cleaned);
  }catch(err){
    showCoinPopup({ warn:true, icon:'⚠️', title:'Lỗi lưu mã', html:'<div class="coin-popup-hint">'+(err.message||err)+'</div>', okLabel:'Đóng' });
  }
}

/* ========== ACCESS GATE (giới hạn khách) ========== */
async function loadAccessConfig(){
  try{
    const user = await fbEnsureAuthOptional();
    if(!user) return { maxGuests: 50, regOpen: true };
    const snap = await fb.db.ref('admin/accessConfig').once('value');
    const c = snap.val() || {};
    return {
      maxGuests: Math.min(100, Math.max(1, +(c.maxGuests||50))),
      regOpen: c.regOpen !== false && c.regOpen !== 0 && c.regOpen !== '0'
    };
  }catch(e){
    return { maxGuests: 50, regOpen: true };
  }
}

async function claimGuestPresence(){
  /* Không dùng Anonymous: khách chưa login không ghi presence.
     Online features yêu cầu đăng nhập kỳ thủ. Chơi máy offline vẫn OK. */
  if(playerSession && playerSession.code){
    accessGatePassed = true;
    return claimPlayerPresence();
  }
  try{
    const user = await fbEnsureAuthOptional();
    if(!user){
      accessGatePassed = true; /* cho chơi local; online sẽ báo cần login */
      return true;
    }
    const cfg = await loadAccessConfig();
    const guestsSnap = await fb.db.ref('presence/guests').once('value');
    const guests = guestsSnap.val() || {};
    const count = Object.keys(guests).filter(k => k !== user.uid).length;
    if(guests[user.uid]){
      accessGatePassed = true;
      accessPresenceRef = fb.db.ref('presence/guests/'+user.uid);
      accessPresenceRef.onDisconnect().remove();
      await accessPresenceRef.set({ ts: Date.now(), uid: user.uid });
      return true;
    }
    if(count >= cfg.maxGuests){
      accessGatePassed = false;
      showAccessBlockedPopup(cfg.maxGuests, count);
      return false;
    }
    accessPresenceRef = fb.db.ref('presence/guests/'+user.uid);
    accessPresenceRef.onDisconnect().remove();
    await accessPresenceRef.set({ ts: Date.now(), uid: user.uid });
    accessGatePassed = true;
    return true;
  }catch(err){
    console.warn('claimGuestPresence', err);
    accessGatePassed = true;
    return true;
  }
}

async function claimPlayerPresence(){
  if(!playerSession || !playerSession.id) return;
  try{
    const user = await fbEnsureAuthOptional();
    if(!user) return;
    /* bỏ slot khách */
    if(fb.uid){
      try{ await fb.db.ref('presence/guests/'+fb.uid).remove(); }catch(e){}
    }
    const pref = fb.db.ref('presence/players/'+playerSession.id);
    pref.onDisconnect().remove();
    await pref.set({
      ts: Date.now(),
      code: playerSession.code || '',
      name: playerSession.name || '',
      role: playerSession.role || 'player'
    });
    accessGatePassed = true;
  }catch(e){}
}

async function releasePlayerPresence(){
  if(!playerSession || !playerSession.id){
    try{
      if(playerSession && playerSession.id) await fb.db.ref('presence/players/'+playerSession.id).remove();
    }catch(e){}
  }
  try{
    if(playerSession && playerSession.id) await fb.db.ref('presence/players/'+playerSession.id).remove();
  }catch(e){}
}

function showAccessBlockedPopup(max, current){
  showCoinPopup({
    warn:true,
    icon:'🚫',
    title:'Web đang đầy',
    html:'<ul class="coin-popup-list">'+
      '<li>Giới hạn khách: <b>'+max+'</b></li>'+
      '<li>Đang online: <b>'+current+'</b></li>'+
      '<li>Hãy thử lại sau, hoặc <b>đăng nhập kỳ thủ</b> để vào không bị giới hạn.</li>'+
      '</ul>',
    okLabel:'Thử lại'
  }).then(()=>{
    claimGuestPresence();
  });
}

async function adminSaveAccessConfig(){
  const max = Math.min(100, Math.max(1, Math.floor(+(document.getElementById('accessMaxGuests')?.value||50))));
  const regOpen = document.getElementById('accessRegOpen')?.value !== '0';
  const st = document.getElementById('accessStatus');
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/accessConfig').set({ maxGuests: max, regOpen, updatedAt: Date.now() });
    if(st){ st.textContent = 'Đã lưu · max '+max+' · đăng ký '+(regOpen?'MỞ':'ĐÓNG'); st.className='admin-status ok'; }
    adminRefreshAccessStats();
  }catch(err){
    if(st){ st.textContent = 'Lỗi: '+(err.message||err); st.className='admin-status err'; }
  }
}

async function adminRefreshAccessStats(){
  try{
    await adminEnsureFb();
    const [cfgSnap, gSnap, pSnap] = await Promise.all([
      fb.db.ref('admin/accessConfig').once('value'),
      fb.db.ref('presence/guests').once('value'),
      fb.db.ref('presence/players').once('value')
    ]);
    const cfg = cfgSnap.val() || {};
    const max = Math.min(100, Math.max(1, +(cfg.maxGuests||50)));
    const guests = Object.keys(gSnap.val()||{}).length;
    const players = Object.keys(pSnap.val()||{}).length;
    const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
    set('accessStatGuests', guests);
    set('accessStatPlayers', players);
    set('accessStatMax', max);
    set('accessStatReg', (cfg.regOpen===false||cfg.regOpen===0||cfg.regOpen==='0') ? 'ĐÓNG' : 'MỞ');
    const maxEl = document.getElementById('accessMaxGuests');
    if(maxEl) maxEl.value = max;
    const regEl = document.getElementById('accessRegOpen');
    if(regEl) regEl.value = (cfg.regOpen===false||cfg.regOpen===0||cfg.regOpen==='0') ? '0' : '1';
  }catch(e){}
}

function showToastPopup(icon, title, body){
  showCoinPopup({ icon: icon||'ℹ️', title: title||'Thông báo', html: '<div class="coin-popup-hint">'+(body||'')+'</div>', okLabel:'Đóng' });
  setTimeout(()=>{ try{ closeCoinPopup(false); }catch(e){} }, 3000);
}

async function playerJoinMyMatch(){
  if(!playerSession){
    showCoinPopup({ warn:true, icon:'🔒', title:'Cần đăng nhập', html:'<div class="coin-popup-hint">Đăng nhập kỳ thủ để vào bàn.</div>', okLabel:'Đóng' });
    return;
  }
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
    let msg = 'Không có bàn nào cả.';
    if(pendingNoRoom.length){
      msg = 'Có '+pendingNoRoom.length+' trận nhưng chưa được gán mã phòng. Nhờ BTC gán trong Nhánh & Bàn.';
    } else if(allMine.length){
      msg = 'Các trận của bạn đã kết thúc hoặc chưa có phòng.';
    } else {
      msg = 'Không thấy trận nào gắn với tài khoản «'+(playerSession.code||'')+'».';
    }
    setSt(msg, true);
    showCoinPopup({ warn:true, icon:'fa-solid fa-table', title:'Không có bàn', html:'<div class="coin-popup-hint">'+msg+'</div>', okLabel:'Đóng' });
    return;
  }
  try{ closeDrawer(); }catch(e){}

  const m = withRoom[0];
  const preferColor = isMe(m.red) ? 'red' : 'black';
  const roomCode = (m.roomCode||'').toUpperCase();
  try{
    const rSnap = await fb.db.ref('rooms/'+roomCode).once('value');
    if(!rSnap.val()){
      await ensureTournamentRoom(roomCode, m);
      setSt('Phòng '+roomCode+' đã được tạo lại - đang vào…', false);
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

function parseScoreScheme(){
  const raw = (document.getElementById('scoreScheme')?.value || '3 / 1 / 0');
  const parts = raw.split(/[/|,]/).map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n));
  return { win: parts[0]??3, draw: parts[1]??1, loss: parts[2]??0 };
}

function buildRRPairs(playerList, homeAway){
  const arr = playerList.slice();
  if(arr.length % 2 === 1) arr.push(null);
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
            setAdminStatus('Đã chọn phòng '+m.roomCode+' - bấm Xem trực tiếp', 'ok');
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
    setSt('Không đủ quyền gán role admin - cần session Admin website.', 'err'); return;
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

/* ========== WALL / PROFILE ========== */
const WALL_AVATAR_BASE = 'https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/photo/';

async function openPlayerWall(){
  try{ closeDrawer(); }catch(e){}
  if(!playerSession || !playerSession.id){
    showCoinPopup({ warn:true, icon:'🔒', title:'Cần đăng nhập', html:'<div class="coin-popup-hint">Đăng nhập kỳ thủ để xem Wall.</div>', okLabel:'Đóng' });
    return;
  }
  try{
    await tcEnsureFb();
    const snap = await fb.db.ref('players/'+playerSession.id).once('value');
    const p = snap.val() || {};
    document.getElementById('wallCode').value = p.code || playerSession.code || '';
    document.getElementById('wallName').value = p.name || playerSession.name || '';
    const ageEl = document.getElementById('wallAge');
    if(ageEl){
      /* Gỡ num-stepper nếu đã bị enhance trước đó */
      const wrap = ageEl.closest('.num-stepper');
      if(wrap && wrap.parentNode){
        wrap.parentNode.insertBefore(ageEl, wrap);
        wrap.remove();
      }
      ageEl.type = 'text';
      ageEl.removeAttribute('data-stepper');
      ageEl.dataset.noStepper = '1';
      ageEl.value = p.age || '';
    }
    document.getElementById('wallHometown').value = p.hometown || '';
    document.getElementById('wallClub').value = p.club || '';
    document.getElementById('wallDob').value = p.dob || '';
    document.getElementById('wallAvatarFile').value = p.avatar || '';
    document.getElementById('wallClan').value = p.clanName || (p.clanId ? p.clanId : 'Chưa có clan');
    const img = document.getElementById('wallAvatarImg');
    const ph = document.getElementById('wallAvatarPlaceholder');
    if(p.avatar){
      const src = (/^https?:\/\//i.test(p.avatar) || p.avatar.startsWith('data:')) ? p.avatar : (WALL_AVATAR_BASE + p.avatar);
      img.src = src;
      img.style.display = '';
      if(ph) ph.style.display = 'none';
      img.onerror = ()=>{ img.style.display='none'; if(ph) ph.style.display=''; };
    } else {
      img.style.display = 'none';
      if(ph) ph.style.display = '';
    }
    const st = document.getElementById('wallStatus');
    if(st){ st.textContent=''; st.className='online-status'; }
    document.getElementById('wallModalOverlay')?.classList.add('show');
  }catch(err){
    showCoinPopup({ warn:true, icon:'⚠️', title:'Lỗi', html:'<div class="coin-popup-hint">'+(err.message||err)+'</div>', okLabel:'Đóng' });
  }
}

function closePlayerWall(){
  document.getElementById('wallModalOverlay')?.classList.remove('show');
}

async function savePlayerWall(){
  if(!playerSession || !playerSession.id) return;
  const ageRaw = (document.getElementById('wallAge')?.value || '').replace(/\D/g,''); const age = ageRaw ? Math.min(120, Math.max(1, parseInt(ageRaw,10)||0)) : '';
  const hometown = (document.getElementById('wallHometown')?.value || '').trim();
  const club = (document.getElementById('wallClub')?.value || '').trim();
  const dob = document.getElementById('wallDob')?.value || '';
  const avatar = (document.getElementById('wallAvatarFile')?.value || '').trim();
  const st = document.getElementById('wallStatus');
  const setSt = (m, warn)=>{ if(st){ st.textContent=m; st.className='online-status'+(warn?' warn':' live'); } };
  try{
    await tcEnsureFb();
    const patch = { age: age ? +age : null, hometown, club, dob, avatar };
    await fb.db.ref('players/'+playerSession.id).update(patch);
    playerSession.age = age; playerSession.hometown = hometown; playerSession.club = club;
    playerSession.dob = dob; playerSession.avatar = avatar;
    savePlayerSession(playerSession);
    if(avatar){
      const img = document.getElementById('wallAvatarImg');
      const ph = document.getElementById('wallAvatarPlaceholder');
      img.src = WALL_AVATAR_BASE + avatar;
      img.style.display = '';
      if(ph) ph.style.display = 'none';
    }
    setSt('Đã lưu thông tin Wall.', false);
    showToastPopup('✅', 'Đã lưu Wall', 'Thông tin kỳ thủ đã cập nhật.');
  }catch(err){
    setSt('Lỗi lưu: '+(err.message||err), true);
  }
}

/* ========== GIFTCODE ========== */
function randomGiftCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for(let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return 'XK-' + s;
}

async function adminCreateGiftCode(){
  const codeRaw = (document.getElementById('gcCode')?.value||'').trim().toUpperCase();
  let code = codeRaw || randomGiftCode();
  if(codeRaw && !code.startsWith('XK-') && !code.startsWith('XK')){
    code = 'XK-' + code.replace(/^XK-?/, '');
  }
  if(code.startsWith('XK') && !code.startsWith('XK-')) code = 'XK-' + code.slice(2);
  const maxUses = Math.max(1, Math.floor(+(document.getElementById('gcMaxUses')?.value||1)));
  const expire = document.getElementById('gcExpire')?.value || '';
  const coins = Math.max(0, Math.floor(+(document.getElementById('gcCoins')?.value||0)));
  const cheatUses = Math.max(0, Math.floor(+(document.getElementById('gcCheatUses')?.value||0)));
  const themeId = (document.getElementById('gcThemeId')?.value||'').trim();
  const itemId = (document.getElementById('gcItemId')?.value||'').trim();
  const itemQty = Math.max(1, Math.floor(+(document.getElementById('gcItemQty')?.value||1)));
  const multi = document.getElementById('gcItemMulti');
  const multiIds = multi ? [...multi.selectedOptions].map(o=>o.value).filter(Boolean) : [];
  const st = document.getElementById('gcStatus');
  const setSt = (m, kind)=>{ if(st){ st.textContent=m; st.className='admin-status'+(kind==='ok'?' ok':kind==='err'?' err':''); } };
  if(!coins && !cheatUses && !themeId && !itemId && !multiIds.length){
    setSt('Chọn ít nhất 1 phần thưởng (coin / theme / item / lượt hack).', 'err'); return;
  }
  try{
    await adminEnsureFb();
    const rewards = [];
    if(coins) rewards.push({ type:'coins', amount: coins });
    if(cheatUses) rewards.push({ type:'cheatUses', amount: cheatUses });
    if(themeId) rewards.push({ type:'theme', themeId });
    if(itemId) rewards.push({ type:'item', itemId, qty: itemQty });
    multiIds.forEach(mid=>{
      if(mid && mid !== itemId) rewards.push({ type:'item', itemId: mid, qty: itemQty });
    });
    const payload = {
      code,
      maxUses,
      used: 0,
      expire: expire || null,
      expireTs: expire ? new Date(expire+'T23:59:59').getTime() : null,
      rewards,
      createdAt: Date.now(),
      active: true
    };
    await fb.db.ref('giftcodes/'+code).set(payload);
    setSt('Đã tạo giftcode «'+code+'».', 'ok');
    adminLoadGiftCodes();
  }catch(err){
    setSt('Lỗi tạo: '+(err.message||err), 'err');
  }
}

async function adminLoadGiftCodes(){
  const box = document.getElementById('gcList');
  if(!box) return;
  box.innerHTML = '<div class="admin-empty">Đang tải…</div>';
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('giftcodes').once('value');
    const all = snap.val() || {};
    const rows = Object.values(all).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(!rows.length){ box.innerHTML = '<div class="admin-empty">Chưa có giftcode.</div>'; return; }
    box.innerHTML = '';
    rows.forEach(g=>{
      const div = document.createElement('div');
      div.className = 'admin-item';
      const rew = (g.rewards||[]).map(r=>{
        if(r.type==='coins') return r.amount+' coin';
        if(r.type==='cheatUses') return '+'+r.amount+' lượt hack';
        if(r.type==='theme') return 'theme '+r.themeId;
        if(r.type==='item') return (r.qty||1)+'x '+r.itemId;
        return r.type;
      }).join(', ');
      const exp = g.expire ? (' · Hết hạn '+g.expire) : '';
      div.innerHTML =
        '<div class="admin-item-main"><div class="admin-item-code">'+g.code+
          '<span class="admin-item-badge live">'+(g.used||0)+'/'+(g.maxUses||1)+'</span></div>'+
          '<div class="admin-item-meta">'+rew+exp+(g.active===false?' · ĐÃ TẮT':'')+'</div></div>'+
        '<div class="admin-item-actions"><button type="button" class="action-btn cheat-danger gc-del" data-code="'+g.code+'"><i class="fa-regular fa-trash"></i></button></div>';
      box.appendChild(div);
    });
    box.querySelectorAll('.gc-del').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const code = btn.dataset.code;
        const okDel = await appConfirm('Xóa giftcode «'+code+'»? Thao tác không hoàn tác.', 'Xóa giftcode');
        if(!okDel) return;
        try{
          await adminEnsureFb();
          await fb.db.ref('giftcodes/'+code).remove();
          try{ await fb.db.ref('giftcodeClaims/'+code).remove(); }catch(e){}
          setAdminStatus('Đã xóa giftcode «'+code+'».', 'ok');
          adminLoadGiftCodes();
        }catch(e){
          setAdminStatus('Không xóa được: '+(e.message||e)+' — kiểm tra Firebase rules (giftcodes).', 'err');
          appAlert('Không xóa được giftcode.\n'+(e.message||e)+'\nHãy cho phép .write trên giftcodes trong Firebase Rules.', 'Lỗi xóa');
        }
      });
    });
  }catch(err){
    box.innerHTML = '<div class="admin-empty">Lỗi: '+(err.message||err)+'</div>';
  }
}

async function redeemAdminGiftCode(){
  const code = (document.getElementById('giftCodeInput')?.value||'').trim().toUpperCase();
  const st = document.getElementById('giftCodeStatus');
  const setSt = (m, warn)=>{ if(st){ st.textContent=m; st.className='online-status'+(warn?' warn': m?' live':''); } };
  if(!code){ setSt('Nhập mã giftcode.', true); return; }
  if(!getCoinIdentity()){
    setSt('Đăng nhập kỳ thủ để nhận quà.', true);
    showCoinPopup({ warn:true, icon:'🔒', title:'Cần đăng nhập', html:'<div class="coin-popup-hint">Đăng nhập kỳ thủ trước khi nhập giftcode.</div>', okLabel:'Đóng' });
    return;
  }
  try{
    await tcEnsureFb();
    await loadCoinStateFromPlayer();
    const snap = await fb.db.ref('giftcodes/'+code).once('value');
    const g = snap.val();
    if(!g || g.active === false){
      setSt('Mã không đúng hoặc đã tắt.', true);
      showCoinPopup({ warn:true, icon:'❌', title:'Mã không hợp lệ', html:'<div class="coin-popup-hint">Không tìm thấy giftcode «'+code+'».</div>', okLabel:'Đóng' });
      return;
    }
    if(g.expireTs && Date.now() > g.expireTs){
      setSt('Mã đã hết hạn.', true);
      showCoinPopup({ warn:true, icon:'⏰', title:'Hết hạn', html:'<div class="coin-popup-hint">Giftcode «'+code+'» đã hết hạn'+(g.expire?' ('+g.expire+')':'')+'.</div>', okLabel:'Đóng' });
      return;
    }
    if((g.used||0) >= (g.maxUses||1)){
      setSt('Mã đã hết lượt dùng.', true);
      showCoinPopup({ warn:true, icon:'🚫', title:'Hết lượt', html:'<div class="coin-popup-hint">Giftcode «'+code+'» đã dùng hết '+(g.maxUses||1)+' lượt.</div>', okLabel:'Đóng' });
      return;
    }
    const claimedKey = 'giftClaimed_'+code;
    const ident = getCoinIdentity();
    const claimSnap = await fb.db.ref('giftcodeClaims/'+code+'/'+ident.id).once('value');
    if(claimSnap.val()){
      setSt('Bạn đã nhận mã này rồi.', true);
      showCoinPopup({ warn:true, icon:'ℹ️', title:'Đã nhận rồi', html:'<div class="coin-popup-hint">Tài khoản này đã redeem «'+code+'» trước đó.</div>', okLabel:'Đóng' });
      return;
    }
    const rewards = g.rewards || [];
    const lines = [];
    for(const r of rewards){
      if(r.type === 'coins'){
        coinState.coins = Math.max(0, +(coinState.coins||0)) + (r.amount||0);
        lines.push('💰 +'+(r.amount||0)+' coin');
      } else if(r.type === 'cheatUses'){
        coinState.cheatUses = Math.max(0, +(coinState.cheatUses||0)) + (r.amount||0);
        lines.push('⚡ +'+(r.amount||0)+' lượt gian lận');
      } else if(r.type === 'theme' && r.themeId){
        if(!Array.isArray(coinState.unlocked)) coinState.unlocked = ['wood','jade','rosewood','marble'];
        if(!coinState.unlocked.includes(r.themeId)) coinState.unlocked.push(r.themeId);
        lines.push('🎨 Theme «'+(THEME_META[r.themeId]?.name||r.themeId)+'»');
      } else if(r.type === 'item' && r.itemId){
        if(!coinState.inventory) coinState.inventory = {};
        coinState.inventory[r.itemId] = (coinState.inventory[r.itemId]||0) + (r.qty||1);
        const itName = (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS[r.itemId]) ? SHOP_ITEMS[r.itemId].name : r.itemId;
        lines.push('🎁 '+(r.qty||1)+'x '+itName);
      }
    }
    await saveCoinStateToPlayer();
    await fb.db.ref('giftcodes/'+code+'/used').transaction(cur => (cur||0)+1);
    await fb.db.ref('giftcodeClaims/'+code+'/'+ident.id).set({ ts: Date.now(), code: ident.code||'' });
    refreshThemeLocks();
    setSt('Đã nhận quà từ «'+code+'»!', false);
    document.getElementById('giftCodeInput').value = '';
    showCoinPopup({
      icon:'🎁',
      title:'Mở quà thành công!',
      html: '<ul class="coin-popup-list">'+lines.map(l=>'<li>'+l+'</li>').join('')+
        '<li>Số dư: <b>'+coinState.coins+'</b> coin</li></ul>',
      okLabel:'Đóng'
    });
    try{ closeDrawer(); }catch(e){}
  }catch(err){
    setSt('Lỗi: '+(err.message||err), true);
  }
}


async function sendClanChallenge(toId, stake){
  if(!playerSession || !playerSession.id){
    showCoinPopup({ warn:true, icon:'🔒', title:'Cần đăng nhập', html:'<div class="coin-popup-hint">Đăng nhập để thách đấu.</div>', okLabel:'Đóng' });
    return;
  }
  stake = Math.max(0, Math.floor(+(stake||0)));
  try{
    await tcEnsureFb();
    await loadCoinStateFromPlayer();
    if(stake > 0){
      if(coinState.coins < stake){
        showCoinPopup({ warn:true, icon:'💸', title:'Không đủ coin', html:'<ul class="coin-popup-list"><li>Cược: <b>'+stake+'</b></li><li>Bạn có: <b>'+coinState.coins+'</b></li></ul>', okLabel:'Đóng' });
        return;
      }
      coinState.coins -= stake;
      await saveCoinStateToPlayer();
    }
    const roomCode = (typeof createOnlineRoomCodeIfNeeded === 'function')
      ? await createOnlineRoomCodeIfNeeded()
      : ('R'+Date.now().toString(36).toUpperCase().slice(-5));
    const id = 'B'+Date.now().toString(36).toUpperCase();
    await fb.db.ref('betChallenges/'+id).set({
      id,
      fromId: playerSession.id,
      fromCode: playerSession.code||'',
      fromName: playerSession.name||'',
      toId: toId,
      toCode: toId,
      stake: stake,
      roomCode: roomCode,
      status: 'pending',
      kind: stake > 0 ? 'bet' : 'quick',
      createdAt: Date.now()
    });
    if(stake > 0){
      await fb.db.ref('rooms/'+roomCode+'/bet').set({
        challengeId: id, stake, players: { [playerSession.id]: true }, locked: stake, status: 'waiting'
      });
    }
    try{ closeClanModal(); }catch(e){}
    try{ closeDrawer(); }catch(e){}
    try{
      if(typeof startRemoteGame === 'function') startRemoteGame('red');
      else if(typeof resetBoard === 'function') resetBoard();
      else if(typeof newGame === 'function') newGame();
    }catch(e){}
    if(typeof fbJoinRoomPreferred === 'function'){
      try{
        const inp = document.getElementById('fbJoinCodeInput');
        if(inp) inp.value = roomCode;
      }catch(e){}
    }
    showCoinPopup({
      icon: stake ? 'fa-solid fa-coins' : 'fa-solid fa-bolt',
      title: stake ? 'Đã khóa cược & gửi thách' : 'Đã gửi thách đấu nhanh',
      html: '<ul class="coin-popup-list"><li>Đối thủ: <b>'+toId+'</b></li>'+
        (stake ? '<li>Đã khóa: <b>'+stake+'</b> coin</li>' : '<li>Không cược coin</li>')+
        '<li>Phòng: <b>'+roomCode+'</b></li></ul>',
      okLabel: 'Đóng'
    });
  }catch(err){
    showCoinPopup({ warn:true, icon:'⚠️', title:'Lỗi thách đấu', html:'<div class="coin-popup-hint">'+(err.message||err)+'</div>', okLabel:'Đóng' });
  }
}

async function openClanBetChallenge(toId){
  await loadCoinStateFromPlayer();
  const have = Math.max(0, +(coinState.coins||0));
  const defaultStake = Math.min(10, have) || 1;
  const html =
    '<ul class="coin-popup-list" id="clanBetSummary">'+
    '<li>Coin đang có: <b id="clanBetHave">'+have+'</b></li>'+
    '<li>Coin muốn cược: <input type="number" id="clanStakeInput" min="1" max="'+Math.max(1,have)+'" value="'+defaultStake+'" style="width:90px;display:inline-block;margin-left:6px;"></li>'+
    '<li>Sau khi thắng: <b id="clanBetWin">'+(have+defaultStake)+'</b></li>'+
    '<li>Sau khi thua: <b id="clanBetLose">'+(have-defaultStake)+'</b></li>'+
    '</ul>';
  const ok = await showCoinPopup({
    confirm: true,
    icon: 'fa-solid fa-coins',
    title: 'Cược coin với '+toId,
    html: html,
    okLabel: 'Thách đấu',
    cancelLabel: 'Hủy'
  });
  if(!ok){
    try{ if(typeof resetBoard==='function') resetBoard(); }catch(e){}
    return;
  }
  const stake = Math.max(1, Math.floor(+(document.getElementById('clanStakeInput')?.value||0)));
  if(stake > have){
    showCoinPopup({ warn:true, icon:'💸', title:'Không đủ coin', html:'<div class="coin-popup-hint">Bạn chỉ có '+have+' coin.</div>', okLabel:'Đóng' });
    return;
  }
  await sendClanChallenge(toId, stake);
}

/* Lắng nghe thách đấu tới mình */
let _betChallengeListenBound = false;
function bindBetChallengeListener(){
  if(_betChallengeListenBound || !playerSession || !playerSession.id) return;
  if(typeof fb === 'undefined' || !fb.db) return;
  _betChallengeListenBound = true;
  try{
    fb.db.ref('betChallenges').orderByChild('toId').equalTo(playerSession.id).on('child_added', (snap)=>{
      const c = snap.val();
      if(!c || c.status !== 'pending') return;
      if(c._notified) return;
      const stake = Math.floor(c.stake||0);
      const from = c.fromName || c.fromCode || c.fromId || 'Đối thủ';
      showCoinPopup({
        confirm: true,
        icon: stake ? 'fa-solid fa-coins' : 'fa-solid fa-bolt',
        title: 'Lời thách đấu',
        html: '<ul class="coin-popup-list"><li>Từ: <b>'+from+'</b></li>'+
          (stake ? '<li>Cược: <b>'+stake+'</b> coin</li>' : '<li>Đấu nhanh (không cược)</li>')+
          '<li>Phòng: <b>'+(c.roomCode||'—')+'</b></li></ul>',
        okLabel: 'Chấp nhận',
        cancelLabel: 'Từ chối'
      }).then(async (ok)=>{
        if(!ok){
          try{ await fb.db.ref('betChallenges/'+c.id).update({ status:'declined' }); }catch(e){}
          return;
        }
        try{
          if(typeof acceptBetChallenge === 'function') await acceptBetChallenge(c);
          else {
            await fb.db.ref('betChallenges/'+c.id).update({ status:'accepted', acceptedAt: Date.now() });
            if(c.roomCode){
              const inp = document.getElementById('fbJoinCodeInput');
              if(inp) inp.value = c.roomCode;
              document.getElementById('fbJoinRoomBtn')?.click();
            }
          }
        }catch(e){ appAlert(e.message||e, 'Lỗi'); }
      });
    });
  }catch(e){ console.warn('betChallenge listen', e); }
}


/* ========== CLAN ========== */
async function createClan(){
  const name = (document.getElementById('clanCreateName')?.value||'').trim();
  const st = document.getElementById('clanStatus');
  const setSt = (m, warn)=>{ if(st){ st.textContent=m; st.className='online-status'+(warn?' warn': m?' live':''); } };
  if(!playerSession || !playerSession.id){ setSt('Đăng nhập kỳ thủ trước.', true); return; }
  if(!name || name.length < 2){ setSt('Tên clan tối thiểu 2 ký tự.', true); return; }
  try{
    await tcEnsureFb();
    const pSnap = await fb.db.ref('players/'+playerSession.id).once('value');
    const me = pSnap.val() || {};
    if(me.clanId){ setSt('Bạn đang ở clan «'+(me.clanName||me.clanId)+'». Rời clan trước.', true); return; }
    const id = 'C'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,5).toUpperCase();
    const clan = { id, name, ownerId: playerSession.id, ownerCode: playerSession.code||'', members: { [playerSession.id]: true }, memberRoles: { [playerSession.id]: 'owner1' }, createdAt: Date.now() };
    await fb.db.ref('clans/'+id).set(clan);
    await fb.db.ref('players/'+playerSession.id).update({ clanId: id, clanName: name });
    playerSession.clanId = id; playerSession.clanName = name;
    savePlayerSession(playerSession);
    document.getElementById('clanCreateName').value = '';
    setSt('Đã tạo clan «'+name+'» · mã '+id, false);
    showToastPopup('🏰', 'Tạo clan thành công', name+' · mã '+id);
    try{ closeDrawer(); }catch(e){}
  }catch(err){ setSt('Lỗi: '+(err.message||err), true); }
}

async function joinClan(){
  const code = (document.getElementById('clanJoinCode')?.value||'').trim().toUpperCase();
  const st = document.getElementById('clanStatus');
  const setSt = (m, warn)=>{ if(st){ st.textContent=m; st.className='online-status'+(warn?' warn': m?' live':''); } };
  if(!playerSession || !playerSession.id){ setSt('Đăng nhập kỳ thủ trước.', true); return; }
  if(!code){ setSt('Nhập mã clan.', true); return; }
  try{
    await tcEnsureFb();
    const pSnap = await fb.db.ref('players/'+playerSession.id).once('value');
    const me = pSnap.val() || {};
    if(me.clanId){ setSt('Bạn đang ở clan «'+(me.clanName||me.clanId)+'».', true); return; }
    const cSnap = await fb.db.ref('clans/'+code).once('value');
    const clan = cSnap.val();
    if(!clan){ setSt('Không tìm thấy clan «'+code+'».', true); return; }
    await fb.db.ref('clans/'+code+'/members/'+playerSession.id).set(true);
    await fb.db.ref('players/'+playerSession.id).update({ clanId: code, clanName: clan.name||code });
    playerSession.clanId = code; playerSession.clanName = clan.name||code;
    savePlayerSession(playerSession);
    document.getElementById('clanJoinCode').value = '';
    setSt('Đã vào clan «'+(clan.name||code)+'».', false);
    showToastPopup('🏰', 'Đã vào clan', clan.name||code);
    try{ closeDrawer(); }catch(e){}
  }catch(err){ setSt('Lỗi: '+(err.message||err), true); }
}

document.getElementById('playerLoginBtn')?.addEventListener('click', tryPlayerLogin);
document.getElementById('playerRegisterBtn')?.addEventListener('click', tryPlayerRegister);
document.getElementById('authTabLogin')?.addEventListener('click', ()=> switchAuthTab('login'));
/* Chỉ ô đăng nhập: nếu không phải email thì tự viết hoa mã ID */
document.getElementById('playerLoginId')?.addEventListener('input', (e)=>{
  const v = e.target.value || '';
  if(v.includes('@')){
    e.target.classList.remove('input-id-upper');
  } else {
    e.target.classList.add('input-id-upper');
    const caret = e.target.selectionStart;
    const up = v.toUpperCase();
    if(up !== v){
      e.target.value = up;
      try{ e.target.setSelectionRange(caret, caret); }catch(err){}
    }
  }
});
document.getElementById('playerLoginId')?.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') tryPlayerLogin();
});
document.getElementById('playerLoginPwd')?.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') tryPlayerLogin();
});
document.getElementById('authTabRegister')?.addEventListener('click', ()=> switchAuthTab('register'));
document.getElementById('accessSaveBtn')?.addEventListener('click', adminSaveAccessConfig);
document.getElementById('accessRefreshBtn')?.addEventListener('click', adminRefreshAccessStats);
document.getElementById('regPwd2')?.addEventListener('keydown', e=>{ if(e.key==='Enter') tryPlayerRegister(); });
document.getElementById('playerLoginPwd')?.addEventListener('keydown', e=>{ if(e.key==='Enter') tryPlayerLogin(); });
document.getElementById('playerLogoutBtn')?.addEventListener('click', playerLogout);
document.getElementById('playerJoinMatchBtn')?.addEventListener('click', playerJoinMyMatch);
document.getElementById('playerWallBtn')?.addEventListener('click', openPlayerWall);
document.getElementById('wallSaveBtn')?.addEventListener('click', savePlayerWall);
document.getElementById('wallCloseBtn')?.addEventListener('click', closePlayerWall);
document.getElementById('wallModalOverlay')?.addEventListener('click', (e)=>{ if(e.target.id==='wallModalOverlay') closePlayerWall(); });
document.getElementById('giftCodeRedeemBtn')?.addEventListener('click', redeemAdminGiftCode);
document.getElementById('giftCodeInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter') redeemAdminGiftCode(); });


function fillGiftCodeItemSelect(){
  const sel = document.getElementById('gcItemMulti');
  if(!sel) return;
  const prev = new Set([...sel.selectedOptions].map(o=>o.value));
  sel.innerHTML = '';
  try{
    const items = Object.values(SHOP_ITEMS||{}).filter(it=> it && it.id && it.type !== 'vip');
    items.sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'vi'));
    items.forEach(it=>{
      const opt = document.createElement('option');
      opt.value = it.id;
      opt.textContent = (it.name||it.id)+' ('+it.id+')';
      if(prev.has(it.id)) opt.selected = true;
      sel.appendChild(opt);
    });
  }catch(e){}
}

function fillBroadcastThemeSelect(){
  const sel = document.getElementById('bcThemeSelect');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Không chọn —</option>';
  try{
    const ids = typeof THEMES !== 'undefined' ? Object.keys(THEMES) : [];
    ids.forEach(id=>{
      const meta = (typeof THEME_META !== 'undefined' && THEME_META[id]) ? THEME_META[id] : null;
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = (meta && meta.name) ? meta.name : id;
      sel.appendChild(opt);
    });
    if(cur) sel.value = cur;
  }catch(e){}
}

function ensureClanModal(){
  let ov = document.getElementById('clanMineOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'clanMineOverlay';
    ov.className = 'clan-modal-overlay';
    ov.innerHTML = '<div class="clan-modal-box" role="dialog"><button type="button" class="clan-modal-x" id="clanMineCloseBtn">&times;</button><h2><i class="fa-solid fa-people-group"></i> Clan của tôi</h2><div id="clanMineBody"></div></div>';
    document.body.appendChild(ov);
  } else if(ov.parentElement !== document.body){
    document.body.appendChild(ov);
  }
  ov.classList.add('clan-modal-overlay');
  if(!ov.querySelector('#clanMineBody')){
    const box = ov.querySelector('.clan-modal-box') || ov;
    let body = document.createElement('div');
    body.id = 'clanMineBody';
    box.appendChild(body);
  }
  return ov;
}

function closeClanModal(){
  const ov = document.getElementById('clanMineOverlay');
  if(ov){
    ov.classList.remove('is-open', 'show');
    ov.hidden = true;
    ov.style.display = 'none';
  }
}

async function openMyClanModal(){
  try{
    console.log('[clan] openMyClanModal start');
    const ov = ensureClanModal();
    const body = document.getElementById('clanMineBody');
    ov.hidden = false;
    ov.style.display = 'flex';
    ov.classList.add('is-open', 'show');
    /* luôn gắn body */
    if(ov.parentElement !== document.body) document.body.appendChild(ov);

    document.getElementById('clanMineCloseBtn')?.addEventListener('click', closeClanModal, { once:false });
    ov.onclick = (e)=>{ if(e.target === ov) closeClanModal(); };

    if(!playerSession || !playerSession.id){
      body.innerHTML = '<div class="admin-empty">Chưa đăng nhập kỳ thủ.<br>Hãy đăng nhập rồi mở lại.</div>';
      return;
    }

    body.innerHTML = '<div class="admin-empty">Đang tải clan…</div>';

    let clanId = playerSession.clanId || '';
    let clanName = playerSession.clanName || '';

    try{
      if(typeof fbEnsureAuthOptional === 'function'){
        const u = await fbEnsureAuthOptional();
        if(u && typeof fb !== 'undefined' && fb.db){
          const pSnap = await fb.db.ref('players/'+playerSession.id).once('value');
          const me = pSnap.val() || {};
          clanId = me.clanId || clanId;
          clanName = me.clanName || clanName;
          if(clanId){ playerSession.clanId = clanId; playerSession.clanName = clanName; }
        }
      }
    }catch(err){ console.warn('[clan] player', err); }

    if(!clanId){
      body.innerHTML = '<div class="admin-empty">Bạn chưa có clan.</div><p style="font-size:12.5px;color:var(--muted);margin:8px 0 0;">Tạo clan hoặc nhập mã để tham gia ở menu.</p>';
      return;
    }

    let clan = { id: clanId, name: clanName || clanId, ownerId: '', ownerCode: '', members: {} };
    try{
      if(typeof fb !== 'undefined' && fb.db){
        const cSnap = await fb.db.ref('clans/'+clanId).once('value');
        if(cSnap.val()) clan = Object.assign(clan, cSnap.val());
      }
    }catch(err){ console.warn('[clan] data', err); }

    const isOwner = (clan.ownerId === playerSession.id) ||
      (clan.ownerCode && String(clan.ownerCode).toUpperCase() === String(playerSession.code||'').toUpperCase());
    let members = Object.keys(clan.members || {});
    if(!members.length) members = [playerSession.id];

    let html = '<ul class="coin-popup-list">'+
      '<li>Tên: <b>'+(clan.name||clanName||'—')+'</b></li>'+
      '<li>Mã: <b>'+clanId+'</b></li>'+
      '<li>Chủ: <b>'+(clan.ownerCode||clan.ownerId||'—')+(isOwner?' (bạn)':'')+'</b></li>'+
      '<li>Thành viên: <b>'+members.length+'</b></li></ul>';
    const roleMap = { owner1:'CHỦ CLAN CẤP 1', owner2:'CHỦ CLAN CẤP 2', manager:'QUẢN LÝ', member:'THÀNH VIÊN' };
    const memberRoles = clan.memberRoles || {};
    if(clan.ownerId && !memberRoles[clan.ownerId]) memberRoles[clan.ownerId] = 'owner1';
    html += '<div class="admin-list" style="max-height:220px;margin-top:8px;">';
    members.forEach(mid=>{
      const role = memberRoles[mid] || (mid===clan.ownerId ? 'owner1' : 'member');
      const mark = ' · <span class="role-badge '+(role==='owner1'||role==='owner2'?'gold':role==='manager'?'silver':'')+'">'+(roleMap[role]||role)+'</span>';
      let actions = '';
      if(mid !== playerSession.id){
        actions = '<div class="clan-member-actions">'+
          '<button type="button" class="action-btn clan-chal-btn" data-mid="'+mid+'" data-coin="0">Đấu nhanh</button>'+
          '<button type="button" class="action-btn clan-chal-btn" data-mid="'+mid+'" data-coin="1">Cược coin</button>'+
          (isOwner
            ? '<button type="button" class="action-btn clan-role-btn" data-mid="'+mid+'">Đặt chức</button>'
            : '<button type="button" class="action-btn" disabled style="opacity:0.4;">—</button>')+
          '</div>';
      }
      html += '<div class="admin-item"><div class="admin-item-main" style="width:100%;"><div class="admin-item-code">'+mid+mark+'</div>'+actions+'</div></div>';
    });
    html += '</div>';
    if(isOwner){
      html += '<div style="margin-top:12px;"><button type="button" class="action-btn cheat-danger" id="clanDisbandBtn"><i class="fa-solid fa-trash"></i> Giải tán</button></div>';
    } else {
      html += '<div style="margin-top:12px;"><button type="button" class="action-btn" id="clanLeaveBtn"><i class="fa-solid fa-right-from-bracket"></i> Rời clan</button></div>';
    }
    body.innerHTML = html;

    document.getElementById('clanLeaveBtn')?.addEventListener('click', async ()=>{
      try{
        if(fb && fb.db){
          await fb.db.ref('clans/'+clanId+'/members/'+playerSession.id).remove();
          await fb.db.ref('players/'+playerSession.id).update({ clanId: null, clanName: null });
        }
        playerSession.clanId=''; playerSession.clanName='';
        if(typeof savePlayerSession==='function') savePlayerSession(playerSession);
        body.innerHTML = '<div class="admin-empty">Đã rời clan.</div>';
      }catch(e){ body.innerHTML = '<div class="admin-empty">Lỗi: '+(e.message||e)+'</div>'; }
    });
    document.getElementById('clanDisbandBtn')?.addEventListener('click', async ()=>{
      if(!confirm('Giải tán clan?')) return;
      try{
        if(fb && fb.db){
          for(const mid of members){
            try{ await fb.db.ref('players/'+mid).update({ clanId:null, clanName:null }); }catch(e){}
          }
          await fb.db.ref('clans/'+clanId).remove();
        }
        playerSession.clanId=''; playerSession.clanName='';
        if(typeof savePlayerSession==='function') savePlayerSession(playerSession);
        body.innerHTML = '<div class="admin-empty">Clan đã giải tán.</div>';
      }catch(e){ body.innerHTML = '<div class="admin-empty">Lỗi: '+(e.message||e)+'</div>'; }
    });

    body.querySelectorAll('.clan-role-btn').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const mid = btn.dataset.mid;
        const pick = await showCoinPopup({
          confirm:true, icon:'fa-solid fa-user-tag', title:'Đặt chức — '+mid,
          html:'<div class="coin-popup-hint">Chọn chức vụ cho thành viên</div>'+
            '<select id="clanRolePick" style="width:100%;margin-top:8px;">'+
            '<option value="owner2">Chủ Clan Cấp 2</option>'+
            '<option value="manager">Quản Lý</option>'+
            '<option value="member">Thành Viên</option>'+
            '<option value="owner1">Chủ Clan Cấp 1 (chuyển quyền)</option></select>',
          okLabel:'Lưu', cancelLabel:'Hủy'
        });
        if(!pick) return;
        const role = document.getElementById('clanRolePick')?.value || 'member';
        try{
          if(role === 'owner1'){
            const ok = await appConfirm('Chuyển Chủ Cấp 1 cho «'+mid+'»? Bạn sẽ thành Chủ Cấp 2.', 'Chuyển chủ');
            if(!ok) return;
            await fb.db.ref('clans/'+clanId).update({
              ownerId: mid, ownerCode: mid,
              ['memberRoles/'+mid]: 'owner1',
              ['memberRoles/'+playerSession.id]: 'owner2'
            });
          } else {
            await fb.db.ref('clans/'+clanId+'/memberRoles/'+mid).set(role);
          }
          appAlert('Đã cập nhật chức vụ.', 'Clan', 'fa-solid fa-check');
          openMyClanModal();
        }catch(e){ appAlert(e.message||e, 'Lỗi'); }
      });
    });
    body.querySelectorAll('.clan-chal-btn').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const mid = btn.dataset.mid;
        const withCoin = btn.dataset.coin === '1';
        if(withCoin){
          await openClanBetChallenge(mid);
        } else {
          await sendClanChallenge(mid, 0);
        }
      });
    });

    console.log('[clan] modal opened');
  }catch(err){
    console.error('[openMyClanModal]', err);
    alert('Lỗi clan: '+(err && err.message ? err.message : err));
  }
}
window.openMyClanModal = openMyClanModal;
window.closeClanModal = closeClanModal;



async function adminLoadClans(){
  const box = document.getElementById('adminClanList');
  if(!box) return;
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('clans').once('value');
    const all = snap.val() || {};
    const rows = Object.values(all);
    if(!rows.length){ box.innerHTML = '<div class="admin-empty">Chưa có clan.</div>'; return; }
    box.innerHTML = '';
    rows.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
    rows.forEach(c=>{
      const div = document.createElement('div');
      div.className = 'admin-item';
      const nMem = Object.keys(c.members||{}).length;
      const memIds = Object.keys(c.members||{});
      const memRoles = c.memberRoles || {};
      let memOpts = memIds.map(mid=>{
        const role = memRoles[mid] || (mid===c.ownerId ? 'owner1' : 'member');
        const roleLabel = ({owner1:'CHỦ CẤP 1',owner2:'CHỦ CẤP 2',manager:'QUẢN LÝ',member:'THÀNH VIÊN'})[role] || String(role||'').toUpperCase();
        return '<option value="'+mid+'">'+mid+' — '+roleLabel+'</option>';
      }).join('');
      div.innerHTML = '<div class="admin-item-main" style="flex:1;min-width:0;"><div class="admin-item-code">'+(c.name||c.id)+
        '<span class="admin-item-badge live">'+nMem+' TV</span></div>'+
        '<div class="admin-item-meta">Mã: '+c.id+' · Chủ: '+(c.ownerCode||c.ownerId||'—')+'</div>'+
        '<div style="margin-top:6px;"><label style="font-size:11px;color:var(--muted);">Thành viên</label>'+
        '<select class="admin-clan-members" data-id="'+c.id+'" size="1" style="width:100%;margin-top:2px;">'+
        '<option value="">— '+nMem+' thành viên —</option>'+memOpts+'</select></div></div>'+
        '<div class="admin-item-actions"><button type="button" class="action-btn cheat-danger admin-clan-del" data-id="'+c.id+'"><i class="fa-regular fa-trash"></i></button></div>';
      box.appendChild(div);
    });
    box.querySelectorAll('.admin-clan-del').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        if(!confirm('Xóa clan '+btn.dataset.id+'?')) return;
        try{
          const cs = await fb.db.ref('clans/'+btn.dataset.id).once('value');
          const c = cs.val()||{};
          for(const mid of Object.keys(c.members||{})){
            try{ await fb.db.ref('players/'+mid).update({ clanId:null, clanName:null }); }catch(e){}
          }
          await fb.db.ref('clans/'+btn.dataset.id).remove();
          adminLoadClans();
        }catch(e){}
      });
    });
  }catch(err){
    box.innerHTML = '<div class="admin-empty">Lỗi: '+(err.message||err)+'</div>';
  }
}

function handleWallAvatarUpload(){
  const fileInput = document.getElementById('wallAvatarUpload');
  const f = fileInput && fileInput.files && fileInput.files[0];
  if(!f){ showToastPopup('⚠️','Chưa chọn ảnh','Chọn file ảnh trước'); return; }
  if(f.size > 1.5*1024*1024){ showToastPopup('⚠️','Ảnh quá lớn','Dưới 1.5MB (khuyến nghị)'); return; }
  const reader = new FileReader();
  reader.onload = ()=>{
    const dataUrl = reader.result;
    document.getElementById('wallAvatarFile').value = dataUrl;
    const img = document.getElementById('wallAvatarImg');
    const ph = document.getElementById('wallAvatarPlaceholder');
    if(img){ img.src = dataUrl; img.style.display=''; }
    if(ph) ph.style.display='none';
    showToastPopup('✅','Đã gắn ảnh','Nhấn Lưu để cập nhật hồ sơ');
  };
  reader.readAsDataURL(f);
}

document.getElementById('clanCreateBtn')?.addEventListener('click', createClan);
document.getElementById('clanMineBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); openMyClanModal(); });
document.getElementById('clanMineCloseBtn')?.addEventListener('click', ()=>{
  const ov = document.getElementById('clanMineOverlay');
  if(ov){ ov.classList.remove('show'); ov.style.zIndex = ''; }
});
document.getElementById('clanMineOverlay')?.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'clanMineOverlay'){
    e.target.classList.remove('show');
    e.target.style.zIndex = '';
  }
});
/* Ủy quyền sự kiện — chắc chắn bắt được nút trong drawer */
document.addEventListener('click', (e)=>{
  const btn = e.target && e.target.closest && e.target.closest('#clanMineBtn');
  if(btn){ e.preventDefault(); openMyClanModal(); }
});
document.getElementById('weeklyCodeSaveBtn')?.addEventListener('click', saveWeeklyCodeFromModal);
document.getElementById('weeklyCodeCancelBtn')?.addEventListener('click', closeWeeklyCodeModal);
document.getElementById('wallAvatarUploadBtn')?.addEventListener('click', handleWallAvatarUpload);
document.getElementById('adminClanRefreshBtn')?.addEventListener('click', adminLoadClans);
try{ wireWeeklyPinBoxes(); }catch(e){}

document.getElementById('clanJoinBtn')?.addEventListener('click', joinClan);
document.getElementById('gcCreateBtn')?.addEventListener('click', adminCreateGiftCode);
document.getElementById('gcRefreshBtn')?.addEventListener('click', adminLoadGiftCodes);
document.getElementById('chatBanBtn')?.addEventListener('click', banChatTarget);
document.getElementById('chatUnbanBtn')?.addEventListener('click', unbanChatTarget);
document.getElementById('floatChatInput')?.addEventListener('input', (e)=> showMentionSuggest(e.target));
document.querySelectorAll('.spectator-view-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> applySpectatorView(btn.dataset.view));
});
document.getElementById('specChoiceBoth')?.addEventListener('click', ()=>{ applySpectatorView('both'); closeSpectatorChoiceModal(); });
document.getElementById('specChoiceRed')?.addEventListener('click', ()=>{ applySpectatorView('red'); closeSpectatorChoiceModal(); });
document.getElementById('specChoiceBlack')?.addEventListener('click', ()=>{ applySpectatorView('black'); closeSpectatorChoiceModal(); });
document.getElementById('specChoiceCancel')?.addEventListener('click', closeSpectatorChoiceModal);
document.getElementById('spectatorChoiceOverlay')?.addEventListener('click', (e)=>{ if(e.target.id==='spectatorChoiceOverlay') closeSpectatorChoiceModal(); });



/** Random ngày + giá + thưởng theo loại thành viên */
function randomInt(min, max){
  min = Math.ceil(min); max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const VIP_TIER_RANDOM = {
  bronze:  { days:[1,7,14,30],          price:[20,80],    bonus:[0,15] },
  silver:  { days:[7,14,30,60],         price:[60,180],   bonus:[5,40] },
  gold:    { days:[14,30,60,90],        price:[150,400],  bonus:[20,100] },
  diamond: { days:[30,60,90,180],       price:[300,800],  bonus:[50,200] },
  elite:   { days:[30,90,180,365],      price:[500,1500], bonus:[100,400] },
  vip:     { days:[30,90,180,365,0],    price:[800,3000], bonus:[150,800] } /* 0 = vĩnh viễn */
};
function randomizeVipPackageFields(opts){
  opts = opts || {};
  const tier = opts.tier || document.getElementById('vipPkgTier')?.value || 'vip';
  const cfg = VIP_TIER_RANDOM[tier] || VIP_TIER_RANDOM.vip;
  const daysArr = cfg.days;
  const days = daysArr[randomInt(0, daysArr.length-1)];
  const price = randomInt(cfg.price[0], cfg.price[1]);
  const bonus = randomInt(cfg.bonus[0], cfg.bonus[1]);
  const meta = (typeof MEMBER_TIERS !== 'undefined' && MEMBER_TIERS[tier]) ? MEMBER_TIERS[tier] : null;
  const dayLabel = days === 0 ? 'Vĩnh viễn' : (days + ' ngày');
  const nameEl = document.getElementById('vipPkgName');
  const dEl = document.getElementById('vipPkgDays');
  const pEl = document.getElementById('vipPkgPrice');
  const bEl = document.getElementById('vipPkgBonus');
  if(dEl) dEl.value = String(days);
  if(pEl) pEl.value = String(price);
  if(bEl) bEl.value = String(bonus);
  if(nameEl && (!nameEl.value || opts.forceName) && meta){
    nameEl.value = meta.name + ' · ' + dayLabel;
  } else if(nameEl && opts.forceName && meta){
    nameEl.value = meta.name + ' · ' + dayLabel;
  }
  return { tier, days, price, bonus };
}

const MEMBER_TIERS = {
  bronze:  { name:'THÀNH VIÊN ĐỒNG',      badge:'bronze',  icon:'fa-medal', defaultDays:30,  defaultPrice:50,  defaultBonus:5 },
  silver:  { name:'THÀNH VIÊN BẠC',       badge:'silver',  icon:'fa-medal', defaultDays:30,  defaultPrice:100, defaultBonus:15 },
  gold:    { name:'THÀNH VIÊN VÀNG',      badge:'gold',    icon:'fa-trophy', defaultDays:30,  defaultPrice:200, defaultBonus:40 },
  diamond: { name:'THÀNH VIÊN KIM CƯƠNG', badge:'diamond', icon:'fa-gem', defaultDays:30,  defaultPrice:400, defaultBonus:80 },
  elite:   { name:'THÀNH VIÊN TINH ANH',  badge:'elite',   icon:'fa-crown', defaultDays:30,  defaultPrice:700, defaultBonus:150 },
  vip:     { name:'THÀNH VIÊN VIP',       badge:'vip',     icon:'fa-star', defaultDays:30,  defaultPrice:1000, defaultBonus:250 }
};

let _vipEditId = null;

function clearVipPackageForm(){
  _vipEditId = null;
  const tierEl = document.getElementById('vipPkgTier');
  if(tierEl && !tierEl.value) tierEl.value = 'vip';
  const nameEl = document.getElementById('vipPkgName');
  if(nameEl) nameEl.value = '';
  randomizeVipPackageFields({ forceName: true });
  const addBtn = document.getElementById('vipPkgAddBtn');
  if(addBtn) addBtn.innerHTML = '<i class="fa-regular fa-plus"></i> Thêm gói';
}

function fillVipPackageForm(p){
  if(!p) return;
  _vipEditId = p.id;
  const tierEl = document.getElementById('vipPkgTier');
  if(tierEl && p.tier) tierEl.value = p.tier;
  const n = document.getElementById('vipPkgName'); if(n) n.value = p.name||'';
  const d = document.getElementById('vipPkgDays'); if(d) d.value = (p.permanent || p.days===0) ? '0' : String(p.days||30);
  const pr = document.getElementById('vipPkgPrice'); if(pr) pr.value = String(p.price||100);
  const b = document.getElementById('vipPkgBonus'); if(b) b.value = String(p.bonusCoins||0);
  const addBtn = document.getElementById('vipPkgAddBtn');
  if(addBtn) addBtn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Lưu sửa';
}

async function adminAddVipPackage(){
  const tier = document.getElementById('vipPkgTier')?.value || 'vip';
  const tierMeta = (typeof MEMBER_TIERS !== 'undefined' && MEMBER_TIERS[tier]) ? MEMBER_TIERS[tier] : { name:'VIP', badge:'vip' };
  let name = (document.getElementById('vipPkgName')?.value||'').trim();
  if(!name) name = tierMeta.name;
  const daysRaw = Math.floor(+(document.getElementById('vipPkgDays')?.value||0));
  const days = daysRaw <= 0 ? 0 : daysRaw;
  const price = Math.max(1, Math.floor(+(document.getElementById('vipPkgPrice')?.value||50)));
  const bonus = Math.max(0, Math.floor(+(document.getElementById('vipPkgBonus')?.value||0)));
  const isEdit = !!_vipEditId;
  const id = isEdit ? _vipEditId : ('mem_'+tier+'_'+(days||'perm')+'_'+Date.now().toString(36));
  const dayLabel = days ? (days+' ngày') : 'vĩnh viễn';

  const ok = await showCoinPopup({
    confirm: true,
    icon: isEdit ? 'fa-solid fa-pen' : 'fa-solid fa-plus',
    title: isEdit ? 'Sửa gói thành viên' : 'Thêm gói thành viên',
    html: '<ul class="coin-popup-list">'+
      '<li>Tên: <b>'+name+'</b></li>'+
      '<li>Loại: <b>'+(tierMeta.name||tier)+'</b></li>'+
      '<li>Thời hạn: <b>'+dayLabel+'</b></li>'+
      '<li>Giá: <b>'+price+'</b> coin</li>'+
      '<li>Thưởng: <b>+'+bonus+'</b> coin</li></ul>',
    okLabel: isEdit ? 'Lưu' : 'Thêm',
    cancelLabel: 'Hủy'
  });
  if(!ok) return;

  try{
    await adminEnsureFb();
    const maxOrder = sortedVipPackageList().reduce((m,p)=> Math.max(m, +(p.sortOrder||0)), -1);
    const sortOrder = isEdit && VIP_PACKAGES[id] && VIP_PACKAGES[id].sortOrder != null
      ? +VIP_PACKAGES[id].sortOrder
      : maxOrder + 1;
    const row = { id, name, days, price, bonusCoins: bonus, tier, badge: tierMeta.badge||tier, permanent: days===0, sortOrder };
    await fb.db.ref('admin/vipPackages/'+id).set(row);
    VIP_PACKAGES[id] = row;
    mergeVipPackagesIntoShop();
    rebuildShopItems();
    setAdminStatus((isEdit?'Đã sửa':'Đã thêm')+' gói «'+name+'» ('+dayLabel+').', 'ok');
    showCoinPopup({
      icon: 'fa-solid fa-circle-check',
      title: isEdit ? 'Đã lưu gói' : 'Đã thêm gói',
      html: '<div class="coin-popup-hint">«<b>'+name+'</b>» — '+dayLabel+' · '+price+' coin</div>',
      okLabel: 'Đóng'
    });
    clearVipPackageForm();
    adminRenderVipPackages();
  }catch(err){
    setAdminStatus('Lỗi: '+(err.message||err), 'err');
    showCoinPopup({ warn:true, icon:'⚠️', title:'Lỗi', html:'<div class="coin-popup-hint">'+(err.message||err)+'</div>', okLabel:'Đóng' });
  }
}

async function adminDeleteVipPackage(id, name){
  const ok = await showCoinPopup({
    confirm: true,
    warn: true,
    icon: 'fa-solid fa-trash',
    title: 'Xóa gói thành viên',
    html: '<div class="coin-popup-hint">Xóa gói «<b>'+(name||id)+'</b>»?<br>Gói sẽ biến mất khỏi cửa hàng.</div>',
    okLabel: 'Xóa',
    cancelLabel: 'Hủy'
  });
  if(!ok) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/vipPackages/'+id).remove();
    delete VIP_PACKAGES[id];
    rebuildShopItems();
    if(_vipEditId === id) clearVipPackageForm();
    setAdminStatus('Đã xóa gói «'+(name||id)+'».', 'ok');
    showCoinPopup({
      icon: 'fa-solid fa-circle-check',
      title: 'Đã xóa gói',
      html: '<div class="coin-popup-hint">«'+(name||id)+'»</div>',
      okLabel: 'Đóng'
    });
    adminRenderVipPackages();
  }catch(err){
    setAdminStatus('Không xóa được: '+(err.message||err), 'err');
    showCoinPopup({ warn:true, icon:'⚠️', title:'Lỗi xóa', html:'<div class="coin-popup-hint">'+(err.message||err)+'</div>', okLabel:'Đóng' });
  }
}

async function adminRenderVipPackages(){
  const boxes = document.querySelectorAll('#vipPkgList');
  if(!boxes.length) return;
  try{
    await loadVipPackages();
    const rows = sortedVipPackageList();
    boxes.forEach(box=>{
      if(!rows.length){ box.innerHTML = '<div class="admin-empty">Chưa có gói. Thêm gói mới bên trên.</div>'; return; }
      box.innerHTML = '';
      box.classList.add('vip-pkg-sortable');
      rows.forEach((p, idx)=>{
        const div = document.createElement('div');
        div.className = 'admin-item vip-pkg-item';
        div.draggable = true;
        div.dataset.id = p.id;
        div.dataset.idx = String(idx);
        const dayLabel = (p.permanent || p.days===0) ? 'Vĩnh viễn' : ((p.days||0)+' ngày');
        const badgeCls = 'role-badge '+(p.badge||p.tier||'vip');
        const tierName = (typeof roleLabel==='function' ? roleLabel(p.tier||p.badge||'vip') : (p.tier||'vip'));
        div.innerHTML =
          '<div class="vip-drag-handle" title="Kéo thả sắp xếp"><i class="fa-solid fa-grip-vertical"></i></div>'+
          '<div class="admin-item-main"><div class="admin-item-code">'+(p.name||p.id)+
          ' <span class="'+badgeCls+'">'+tierName+'</span>'+
          '<span class="admin-item-badge live">'+dayLabel+' · '+p.price+'c</span></div>'+
          '<div class="admin-item-meta">#'+(idx+1)+' · Thưởng +'+(p.bonusCoins||0)+' coin · ID: '+p.id+'</div></div>'+
          '<div class="admin-item-actions vip-order-actions">'+
          '<button type="button" class="action-btn vip-up" data-id="'+p.id+'" title="Lên" '+(idx===0?'disabled':'')+'><i class="fa-solid fa-arrow-up"></i></button>'+
          '<button type="button" class="action-btn vip-down" data-id="'+p.id+'" title="Xuống" '+(idx===rows.length-1?'disabled':'')+'><i class="fa-solid fa-arrow-down"></i></button>'+
          '<button type="button" class="action-btn vip-edit" data-id="'+p.id+'" title="Sửa"><i class="fa-regular fa-pen"></i></button>'+
          '<button type="button" class="action-btn cheat-danger vip-del" data-id="'+p.id+'" title="Xóa"><i class="fa-regular fa-trash"></i></button>'+
          '</div>';
        box.appendChild(div);
      });
      box.querySelectorAll('.vip-del').forEach(btn=>{
        btn.addEventListener('click', (e)=>{ e.stopPropagation();
          const p = VIP_PACKAGES[btn.dataset.id];
          adminDeleteVipPackage(btn.dataset.id, p && p.name);
        });
      });
      box.querySelectorAll('.vip-edit').forEach(btn=>{
        btn.addEventListener('click', (e)=>{ e.stopPropagation();
          const p = VIP_PACKAGES[btn.dataset.id];
          if(!p) return;
          fillVipPackageForm(p);
          setAdminStatus('Đang sửa «'+(p.name||p.id)+'» — chỉnh form rồi bấm Lưu sửa.', 'ok');
          try{ document.getElementById('vipPkgName')?.scrollIntoView({ behavior:'smooth', block:'center' }); }catch(e){}
        });
      });
      box.querySelectorAll('.vip-up').forEach(btn=>{
        btn.addEventListener('click', (e)=>{ e.stopPropagation(); moveVipPackage(btn.dataset.id, -1); });
      });
      box.querySelectorAll('.vip-down').forEach(btn=>{
        btn.addEventListener('click', (e)=>{ e.stopPropagation(); moveVipPackage(btn.dataset.id, 1); });
      });
      /* Drag & drop */
      let dragId = null;
      box.querySelectorAll('.vip-pkg-item').forEach(item=>{
        item.addEventListener('dragstart', (e)=>{
          dragId = item.dataset.id;
          item.classList.add('vip-dragging');
          try{ e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; }catch(err){}
        });
        item.addEventListener('dragend', ()=>{
          item.classList.remove('vip-dragging');
          box.querySelectorAll('.vip-pkg-item').forEach(x=> x.classList.remove('vip-drag-over'));
          dragId = null;
        });
        item.addEventListener('dragover', (e)=>{
          e.preventDefault();
          item.classList.add('vip-drag-over');
        });
        item.addEventListener('dragleave', ()=> item.classList.remove('vip-drag-over'));
        item.addEventListener('drop', async (e)=>{
          e.preventDefault();
          item.classList.remove('vip-drag-over');
          const fromId = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
          const toId = item.dataset.id;
          if(!fromId || !toId || fromId === toId) return;
          const ids = sortedVipPackageList().map(p => p.id);
          const fi = ids.indexOf(fromId), ti = ids.indexOf(toId);
          if(fi < 0 || ti < 0) return;
          ids.splice(fi, 1);
          ids.splice(ti, 0, fromId);
          await saveVipPackageOrder(ids);
          adminRenderVipPackages();
          setAdminStatus('Đã sắp xếp lại thứ tự gói.', 'ok');
        });
      });
    });
  }catch(err){
    boxes.forEach(box=>{ box.innerHTML = '<div class="admin-empty">Lỗi tải.</div>'; });
  }
}

async function adminGlobalBan(){
  const target = (document.getElementById('globalBanTarget')?.value||'').trim().toUpperCase();
  if(!target){ setAdminStatus('Nhập nick/ID.', 'err'); return; }
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/chatBans/'+target).set({ by:'admin', ts: Date.now() });
    if(!window._globalChatBans) window._globalChatBans = {};
    window._globalChatBans[target] = true;
    document.getElementById('globalBanTarget').value = '';
    setAdminStatus('Đã cấm chat toàn cục «'+target+'».', 'ok');
    adminLoadGlobalBans();
  }catch(err){ setAdminStatus('Lỗi: '+(err.message||err), 'err'); }
}

async function adminGlobalUnban(){
  const target = (document.getElementById('globalBanTarget')?.value||'').trim().toUpperCase();
  if(!target) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/chatBans/'+target).remove();
    if(window._globalChatBans) delete window._globalChatBans[target];
    setAdminStatus('Đã gỡ cấm «'+target+'».', 'ok');
    adminLoadGlobalBans();
  }catch(err){}
}

async function adminLoadGlobalBans(){
  const box = document.getElementById('globalBanList');
  if(!box) return;
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('admin/chatBans').once('value');
    const all = snap.val() || {};
    window._globalChatBans = all;
    const keys = Object.keys(all);
    if(!keys.length){ box.innerHTML = '<div class="admin-empty">Chưa có.</div>'; return; }
    box.innerHTML = '';
    keys.forEach(k=>{
      const div = document.createElement('div');
      div.className = 'admin-item';
      const t = all[k] && all[k].ts ? new Date(all[k].ts).toLocaleString('vi-VN') : '';
      div.innerHTML = '<div class="admin-item-main"><div class="admin-item-code">'+k+'</div><div class="admin-item-meta">'+t+'</div></div>';
      box.appendChild(div);
    });
  }catch(err){
    box.innerHTML = '<div class="admin-empty">Lỗi tải.</div>';
  }
}

document.getElementById('vipPkgAddBtn')?.addEventListener('click', adminAddVipPackage);

document.getElementById('vipPkgTier')?.addEventListener('change', ()=>{
  if(_vipEditId) return; /* đang sửa thì không auto random */
  randomizeVipPackageFields({ forceName: true });
});
document.getElementById('vipPkgRandomBtn')?.addEventListener('click', ()=>{
  randomizeVipPackageFields({ forceName: true });
  setAdminStatus('Đã random ngày + giá + thưởng coin.', 'ok');
});

document.getElementById('vipPkgRefreshBtn')?.addEventListener('click', adminRenderVipPackages);
document.getElementById('globalBanBtn')?.addEventListener('click', adminGlobalBan);
document.getElementById('globalUnbanBtn')?.addEventListener('click', adminGlobalUnban);
document.getElementById('playerUpdateBtn')?.addEventListener('click', updatePlayer);
document.getElementById('playerCancelEditBtn')?.addEventListener('click', clearPlayerForm);

document.getElementById('rrScheduleBtn')?.addEventListener('click', generateRRSchedule);
document.getElementById('deBracketBtn')?.addEventListener('click', generateDoubleElim);

document.getElementById('techChatSendBtn')?.addEventListener('click', ()=> sendTechChat(false));
document.getElementById('techChatBroadcastBtn')?.addEventListener('click', ()=> sendTechChat(true));

document.getElementById('casterAssignBtn')?.addEventListener('click', assignCaster);
document.getElementById('pollCreateBtn')?.addEventListener('click', createPoll);
document.getElementById('pollCloseBtn')?.addEventListener('click', closeOpenPolls);

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
          (typeof roleBadgeHtml==='function' ? roleBadgeHtml(role) : ('<span class="role-badge '+role+'">'+roleLabel(role)+'</span>'))+
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
document.getElementById('coinPopupOk')?.addEventListener('click', ()=>{
  const cancelBtn = document.getElementById('coinPopupCancel');
  const isConfirm = cancelBtn && cancelBtn.style.display !== 'none';
  closeCoinPopup(isConfirm ? true : false);
});
document.getElementById('coinPopupCancel')?.addEventListener('click', ()=> closeCoinPopup(false));
document.getElementById('coinPopupOverlay')?.addEventListener('click', (e)=>{ if(e.target.id==='coinPopupOverlay') closeCoinPopup(false); });
document.getElementById('shopGrantBtn')?.addEventListener('click', adminGrantShopItem);
document.getElementById('coinRefreshBtn')?.addEventListener('click', renderAdminCoins);
document.getElementById('adminChatClearRoomBtn')?.addEventListener('click', clearAdminChatRoom);
document.getElementById('roleFilter')?.addEventListener('change', renderRoleManager);
document.getElementById('roleSearch')?.addEventListener('input', renderRoleManager);

let adminChatSelectedRoom = null;
let adminChatCache = {};

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
  if(!text){ setAdminStatus('Nội dung trống - không lưu.', 'err'); return; }
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

async function renderAdminCoins(){
  const listBox = document.getElementById('coinCheckInList');
  const topBox = document.getElementById('coinTopList');
  const dailyBox = document.getElementById('coinDailyDetail');
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('players').once('value');
    const playersMap = snap.val() || {};
    const players = Object.values(playersMap);
    if(tcData) tcData.players = playersMap;

    let adminCoins = 0, adminWith = 0;
    try{
      const wSnap = await fb.db.ref('admin/wallets').once('value');
      const wallets = wSnap.val() || {};
      Object.values(wallets).forEach(w=>{
        const c = +(w.coins||0);
        adminCoins += c;
        if(c>0) adminWith++;
      });
    }catch(e){}
    const today = todayStr();
    let totalCoins = adminCoins, withCoins = adminWith;
    const checked = [];
    players.forEach(p=>{
      const c = +(p.coins||0);
      totalCoins += c;
      if(c>0) withCoins++;
      if(p.lastCheckIn === today) checked.push(p);
    });

    let day = {};
    try{
      const dSnap = await fb.db.ref('admin/coinDaily/'+today).once('value');
      day = dSnap.val() || {};
    }catch(e){}
    let checkInRewardSum = +(day.checkIn && day.checkIn.total) || 0;
    if(!checkInRewardSum && checked.length){
      checkInRewardSum = checked.length * CHECKIN_REWARD;
    }
    const pveOut = +(day.pveOut && day.pveOut.total) || 0;
    const pveIn = +(day.pveIn && day.pveIn.total) || 0;
    const pveNet = pveOut;
    const betToday = +(day.bet && day.bet.total) || 0;
    const auctionToday = (+(day.auction && day.auction.total)||0) + (+(day.auctionBid && day.auctionBid.total)||0);
    const shopToday = +(day.shop && day.shop.total) || 0;

    const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
    set('coinStatToday', checked.length);
    set('coinStatTodayReward', checkInRewardSum);
    set('coinStatTotal', totalCoins);
    set('coinStatPlayers', withCoins);
    set('coinStatPveToday', pveIn ? (pveOut+' / '+pveIn) : pveOut);
    set('coinStatBetToday', betToday);
    set('coinStatAuctionToday', auctionToday);
    set('coinStatShopToday', shopToday);

    if(dailyBox){
      dailyBox.innerHTML =
        '<div class="admin-item"><div class="admin-item-main"><div class="admin-item-code">Hôm nay · '+today+'</div>'+
        '<div class="admin-item-meta">'+
        'Điểm danh: <b>'+checked.length+'</b> người · <b>'+checkInRewardSum+'</b> coin<br>'+
        'Vs máy (thưởng chi): <b>'+pveOut+'</b> coin · (cược thu): <b>'+pveIn+'</b> coin<br>'+
        'Cược PvP: <b>'+betToday+'</b> coin · Đấu giá: <b>'+auctionToday+'</b> coin · Shop: <b>'+shopToday+'</b> coin<br>'+
        'Tổng coin đang nắm giữ: <b>'+totalCoins+'</b> · Thành viên có coin: <b>'+withCoins+'</b>'+
        '</div></div></div>';
    }

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
  if(sec==='giftcodes'){ adminLoadGiftCodes(); fillGiftCodeItemSelect(); }
  if(sec==='broadcast'){ fillBroadcastThemeSelect(); }
  if(sec==='clans'){ adminLoadClans(); }
  if(sec==='roles'){ adminRenderVipPackages(); adminLoadGlobalBans(); }
  if(sec==='system'){ adminRefreshAccessStats(); }
};

const _openAdminPanelOrig = openAdminPanel;
openAdminPanel = async function(){
  _openAdminPanelOrig();
  setAdminStatus('Đang tải dữ liệu giải từ Firebase…');
  await tcLoad();
  updateDashboardStats();
  switchAdminSection('dashboard');
  setAdminStatus(tcLoaded ? 'Đã đồng bộ dữ liệu giải từ Firebase.' : 'Chưa tải được dữ liệu giải - kiểm tra Rules.', tcLoaded ? 'ok' : 'err');
};

try{ loadPlayerSession(); }catch(e){ console.warn('loadPlayerSession', e); }
try{ updateAdminMenuUI(); }catch(e){}
try{ updateCheatPanelVisibility(); }catch(e){}
try{ updateAiLevelBoxVisibility(); }catch(e){}
try{ updateAiLevelBadge(); }catch(e){}

async function loadConfigAndInit(){
  try{
    const res = await fetch('config.json');
    if(!res.ok) throw new Error('config.json HTTP ' + res.status);
    CONFIG = await res.json();
  }catch(err){
    console.error('Không tải được config.json:', err);
    /* Không xoá toàn bộ body — giữ UI, dùng config mặc định cứng */
    CONFIG = CONFIG || {
      board: { cols:9, rows:10, cell:62, margin:34, svgWidth:558, svgHeight:620 },
      initialSetup: {
        backRow: ['chariot','horse','elephant','advisor','general','advisor','elephant','horse','chariot'],
        cannons: [[2,1],[2,7],[7,1],[7,7]],
        soldierCols: [0,2,4,6,8],
        soldierRows: { black:3, red:6 }
      },
      pieceValues: { general:100000, advisor:200, elephant:200, horse:450, chariot:900, cannon:480, soldier:100 },
      soldierCrossedBonus: 90,
      glyphs: {
        red:   { general:'帥', advisor:'仕', elephant:'相', horse:'傌', chariot:'俥', cannon:'炮', soldier:'兵' },
        black: { general:'將', advisor:'士', elephant:'象', horse:'馬', chariot:'車', cannon:'砲', soldier:'卒' }
      },
      glyphsVi: {
        red:   { general:'Tướng', advisor:'Sĩ', elephant:'Tượng', horse:'Mã', chariot:'Xe', cannon:'Pháo', soldier:'Tốt' },
        black: { general:'Tướng', advisor:'Sĩ', elephant:'Tượng', horse:'Mã', chariot:'Xe', cannon:'Pháo', soldier:'Tốt' }
      },
      firebase: null
    };
  }

  try{
    COLS = (CONFIG.board && CONFIG.board.cols) || 9;
    ROWS = (CONFIG.board && CONFIG.board.rows) || 10;
    CELL = (CONFIG.board && CONFIG.board.cell) || 62;
    MARGIN = (CONFIG.board && CONFIG.board.margin) || 34;
    svgW = (CONFIG.board && CONFIG.board.svgWidth) || 558;
    svgH = (CONFIG.board && CONFIG.board.svgHeight) || 620;
    VALUES = CONFIG.pieceValues || VALUES;
    SOLDIER_CROSSED_BONUS = CONFIG.soldierCrossedBonus != null ? CONFIG.soldierCrossedBonus : 90;
    GLYPHS = CONFIG.glyphs || GLYPHS || {};
    try{
      const savedVi = localStorage.getItem('cotuong_vi_glyphs');
      if(savedVi === '1' && CONFIG.glyphsVi){
        state.viGlyphs = true;
        GLYPHS = CONFIG.glyphsVi;
        const tg = document.getElementById('viGlyphToggle');
        if(tg) tg.checked = true;
      }
    }catch(e){}
  }catch(e){ console.warn('config apply', e); }

  try{ loadVipPackages(); }catch(e){}
  try{
    if(fbAvailable()){
      fbEnsureAuthOptional().then(u=>{
        if(!u || !fb.db) return;
        return fb.db.ref('admin/chatBans').once('value');
      }).then(snap=>{
        if(snap) window._globalChatBans = (snap && snap.val()) || {};
      }).catch(()=>{});
    }
  }catch(e){}

  const svgEl = getBoardSvg();
  if(svgEl){
    svg = svgEl;
    svgEl.setAttribute('width', svgW);
    svgEl.setAttribute('height', svgH);
    svgEl.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
  } else {
    console.error('[board] Không tìm thấy #boardSvg — kiểm tra index.html');
  }

  try{ state.board = initialBoard(); }catch(e){
    console.error('initialBoard', e);
    state.board = emptyBoard();
  }

  try{ buildStaticBoard(); }catch(e){ console.error('buildStaticBoard', e); }
  try{ loadSavedTheme(); }catch(e){ console.warn('loadSavedTheme', e); }
  state.commentVoice = false;
  try{ renderPieces(); }catch(e){ console.error('renderPieces', e); }
  try{ renderMarkers(); }catch(e){ console.error('renderMarkers', e); }
  try{ updateStatus(); }catch(e){}
  try{ updateUndoBtn(); }catch(e){}

  const _qs = new URLSearchParams(location.search);
  if(_qs.get('replay')){
    loadReplayFromId(_qs.get('replay'));
  } else if(_qs.get('room')){
    checkRoomLinkParam();
  } else {
    fbAutoRejoin();
  }
  try{ renderAchievementsUI(); }catch(e){}
  try{
    Object.keys(HOLIDAY_THEMES).forEach(k=>{
      if(isHolidayActive(HOLIDAY_THEMES[k])){
        const h = HOLIDAY_THEMES[k];
        setTimeout(()=>{
          try{ setCheckInStatus((h.badge||'')+' Đang trong mùa «'+h.name+'» - theme sự kiện mở miễn phí!', false); }catch(e){}
        }, 800);
      }
    });
  }catch(e){}

  if(fbConfigured()){
    setInterval(()=>{
      (async ()=>{
        try{ const u = await fbEnsureAuthOptional(); if(u){ fbSweepExpiredRooms(); fbSweepExpiredReplays(); } }catch(err){}
      })();
    }, 60000);
    fbEnsureAuthOptional().then(u=>{
      console.log('[Firebase] Auth uid:', u && u.uid);
      if(playerSession && playerSession.code){
        if(u) claimPlayerPresence();
        else console.warn('[Firebase] Session kỳ thủ còn nhưng Auth hết — cần đăng nhập lại.');
      } else {
        claimGuestPresence();
      }
    }).catch(err=>{
      console.warn('[Firebase] Auth:', err.message||err);
    });
  }
}

try{ enhanceNumberSteppers(); }catch(e){}
try{
  const mo = new MutationObserver(()=>{ try{ enhanceNumberSteppers(); }catch(e){} });
  mo.observe(document.body, { childList:true, subtree:true });
}catch(e){}
document.addEventListener('input', (e)=>{
  if(e.target && e.target.id === 'clanStakeInput'){
    const have = +(document.getElementById('clanBetHave')?.textContent||coinState.coins||0);
    const stake = Math.max(0, Math.floor(+(e.target.value||0)));
    const w = document.getElementById('clanBetWin');
    const l = document.getElementById('clanBetLose');
    if(w) w.textContent = String(have + stake);
    if(l) l.textContent = String(Math.max(0, have - stake));
  }
});
loadConfigAndInit();

(function bindClanMineReliable(){
  function handler(e){
    if(e){ e.preventDefault(); e.stopPropagation(); }
    console.log('[clan] btn event', e && e.type);
    if(typeof window.openMyClanModal === 'function') window.openMyClanModal();
    else alert('Script chưa sẵn sàng — Ctrl+Shift+R');
  }
  function bind(){
    const btn = document.getElementById('clanMineBtn');
    if(!btn || btn.dataset.clanBound === '1') return;
    btn.dataset.clanBound = '1';
    btn.addEventListener('click', handler, true);
    btn.addEventListener('pointerup', handler, true);
  }
  bind();
  document.addEventListener('DOMContentLoaded', bind);
  setTimeout(bind, 300);
  setTimeout(bind, 1500);
})();

/* backup bind Clan của tôi */
(function bindClanMineBtn(){
  function bind(){
    const btn = document.getElementById('clanMineBtn');
    if(!btn || btn._clanBound) return;
    btn._clanBound = true;
    btn.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      if(typeof window.openMyClanModal === 'function') window.openMyClanModal();
      else alert('openMyClanModal chưa sẵn sàng');
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  setTimeout(bind, 500);
  setTimeout(bind, 2000);
})();
