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

// generate pseudo-legal moves for a single piece (ignores own king safety)
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
    // slight central bonus for horses/cannons
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
  // order captures first
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

function aiBestMove(board, color, depth){
  const moves = allLegalMoves(board, color);
  if(moves.length===0) return null;
  moves.sort((a,b)=> (b.capture?1:0) - (a.capture?1:0));
  let best = null;
  let bestVal = color==='red' ? -Infinity : Infinity;
  let alpha=-Infinity, beta=Infinity;
  // shuffle a bit for variety among equal moves
  for(const m of moves){
    const nb = cloneBoard(board);
    nb[m.to.r][m.to.c] = nb[m.from.r][m.from.c];
    nb[m.from.r][m.from.c] = null;
    const val = minimax(nb, depth-1, alpha, beta, color==='red'?'black':'red');
    if(color==='red'){
      if(val>bestVal || (val===bestVal && Math.random()<0.3)){ bestVal=val; best=m; }
      if(bestVal>alpha) alpha=bestVal;
    } else {
      if(val<bestVal || (val===bestVal && Math.random()<0.3)){ bestVal=val; best=m; }
      if(bestVal<beta) beta=bestVal;
    }
  }
  return best;
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
  mode: 'pvp',        // pvp | pve-easy | pve-hard
  humanColor: 'red',
  gameOver: false,
  lastMove: null,
  aiThinking: false,
  aiTimeoutId: null,
  online: { active:false, room:null, color:null, pollTimer:null, version:0, transport:null, roomCode:null },
  cheat: { killMode:false }
};

// WebRTC peer-connection state (kept outside `state` since it holds live
// browser objects, not serialisable game data).
// Firebase Realtime Database connection state (only usable once
// config.json's "firebase" block is filled in — see README).
let fb = { app:null, db:null, roomRef:null, room:null };

const svg = document.getElementById('boardSvg');

function boardX(c){ return MARGIN + c*CELL; }
function boardY(r){ return MARGIN + r*CELL; }

function buildStaticBoard(){
  const ns = 'http://www.w3.org/2000/svg';
  while(svg.firstChild) svg.removeChild(svg.firstChild);

  // defs: wood grain
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
    <filter id="pieceShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  `;
  svg.appendChild(defs);

  // background
  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('x',0); bg.setAttribute('y',0);
  bg.setAttribute('width',svgW); bg.setAttribute('height',svgH);
  bg.setAttribute('rx',10);
  bg.setAttribute('class','board-bg');
  svg.appendChild(bg);

  const g = document.createElementNS(ns,'g');
  g.setAttribute('id','gridGroup');

  // horizontal lines
  for(let r=0;r<10;r++){
    const line = document.createElementNS(ns,'line');
    line.setAttribute('x1', boardX(0)); line.setAttribute('y1', boardY(r));
    line.setAttribute('x2', boardX(8)); line.setAttribute('y2', boardY(r));
    line.setAttribute('class', (r===0||r===9) ? 'border-line' : 'gridline');
    g.appendChild(line);
  }
  // vertical lines (split at river for inner columns)
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

  // palace diagonals
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

  // river text
  const riverText = document.createElementNS(ns,'text');
  riverText.setAttribute('x', svgW/2);
  riverText.setAttribute('y', boardY(4.5)+9);
  riverText.setAttribute('text-anchor','middle');
  riverText.setAttribute('class','river-text');
  riverText.textContent = '楚 河          漢 界';
  g.appendChild(riverText);

  // decorative points near soldier/cannon starting positions
  const pointCols = [1,7];
  const pointRowsCannon = [2,7];
  const pointRowsSoldier = [3,6];
  function drawPoint(r,c){
    const x = boardX(c), y = boardY(r);
    const offs = [[-8,-8,-4,-8,-8,-4],[8,-8,4,-8,8,-4],[-8,8,-4,8,-8,4],[8,8,4,8,8,4]];
    // simple corner ticks
    const ticks = [
      {dx1:-9,dy1:-9,dx2:-4,dy2:-9},{dx1:-9,dy1:-9,dx2:-9,dy2:-4},
      {dx1:9,dy1:-9,dx2:4,dy2:-9},{dx1:9,dy1:-9,dx2:9,dy2:-4},
      {dx1:-9,dy1:9,dx2:-4,dy2:9},{dx1:-9,dy1:9,dx2:-9,dy2:4},
      {dx1:9,dy1:9,dx2:4,dy2:9},{dx1:9,dy1:9,dx2:9,dy2:4}
    ];
    if(c===0 || c===8){
      // edge columns only get inner ticks - skip outer ones
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

  // interactive hit layer
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

// Persistent map of piece-object -> its SVG group, so a piece keeps the
// same DOM element across renders and can transition smoothly between
// squares instead of being torn down and rebuilt every move.
const pieceElements = new Map();

function createPieceElement(p){
  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns,'g');
  group.setAttribute('class','piece-group');

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
  base.setAttribute('filter','url(#pieceShadow)');
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
      // brand new piece on the board (initial setup / reset) -> pop in
      group = createPieceElement(p);
      pieceElements.set(p, group);
      layer.appendChild(group);
      group.style.transition = 'none';
      group.setAttribute('transform', `translate(${x},${y})`);
      group.classList.add('piece-enter');
      void group.getBoundingClientRect(); // force reflow before animating
      requestAnimationFrame(()=>{
        group.style.transition = '';
        group.classList.remove('piece-enter');
      });
    } else {
      // existing piece -> just update target position, CSS transition
      // on .piece-group{transition:transform ...} does the sliding.
      group.setAttribute('transform', `translate(${x},${y})`);
    }

    group.dataset.r = r; group.dataset.c = c;
    group.classList.toggle('piece-selected', !!isSel);
    group.classList.toggle('disabled', !isHumanTurn());
  }

  // any tracked piece no longer present on the board was just captured
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

  // last move markers
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
  if(state.gameOver) return;

  // "Cực Tử" cheat: clicking any enemy piece removes it instantly, bypassing turns.
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
  state.aiTimeoutId = setTimeout(()=>{
    state.aiTimeoutId = null;
    const depth = state.mode==='pve-hard' ? 3 : 2;
    const move = aiBestMove(state.board, state.turn, depth);
    state.aiThinking = false;
    if(move){
      doMove(move.from, move.to);
    }
  }, 260);
}

function checkGameEnd(){
  const moves = allLegalMoves(state.board, state.turn);
  const inCheck = isInCheck(state.board, state.turn);
  if(moves.length===0){
    state.gameOver = true;
    if(inCheck){
      const winner = state.turn==='red' ? 'black' : 'red';
      showGameOver(
        winner==='red' ? 'Đỏ Thắng!' : 'Đen Thắng!',
        `Chiếu bí — ${winner==='red'?'Đỏ':'Đen'} đã hạ tướng đối phương.`
      );
    } else {
      showGameOver('Hòa Cờ', 'Bên đi không còn nước hợp lệ — ván cờ kết thúc hòa.');
    }
  }
}

function showGameOver(title, text){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalText').textContent = text;
  document.getElementById('modalOverlay').classList.add('show');
}

/* ---------------- Cheat Mode (vs AI only) ---------------- */

function aiSideColor(){
  return state.humanColor==='red' ? 'black' : 'red';
}

// "Đổi Lượt Ngay" — cancels whatever the AI is about to do and hands the
// turn straight back to the human player.
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

// "Cực Tử" — remove any enemy piece the player clicks on, no turn required.
function cheatKillPiece(r,c){
  const target = state.board[r][c];
  if(!target) return;
  const wasGeneral = target.type==='general';

  state.board[r][c] = null;
  state.lastMove = {from:{r,c}, to:{r,c}};
  addCapturedChip(target);
  renderPieces();
  renderMarkers();

  if(wasGeneral){
    finishWithCheatWin();
    return;
  }
  updateStatus();
}

// "Trảm Tướng" — instantly delete the AI's general and declare victory.
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
}

// "Hồi Sinh Xe Đỏ" — spawn an extra red chariot on the first free square.
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

/* ---------------- File-based Save / Share (fully offline, no server) ---------------- */

function downloadJSON(filename, dataObj){
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function serializeGame(){
  return {
    kind: 'co-tuong-save',
    board: state.board.map(row=>row.map(p=>p ? {type:p.type,color:p.color} : null)),
    turn: state.turn,
    mode: state.mode,
    humanColor: state.humanColor,
    remote: state.online.active ? {active:true, color:state.online.color} : null,
    savedAt: new Date().toISOString()
  };
}

function restoreGameData(data){
  resetPieceLayer();
  state.board = data.board.map(row=>row.map(p=>p ? {type:p.type,color:p.color} : null));
  state.turn = data.turn;
  state.mode = data.mode || 'pvp';
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
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
}

function saveGame(){
  downloadJSON(`co-tuong-luu-${Date.now()}.json`, serializeGame());
  flashStatus('💾 Đã tải file lưu ván xuống máy.', false);
}

function loadGame(){
  document.getElementById('loadFileInput').click();
}

function handleLoadFile(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(!data || data.kind!=='co-tuong-save' || !Array.isArray(data.board)) throw new Error('bad-format');
      state.online.active = false;
      state.online.color = null;
      document.getElementById('onlineIdle').style.display = '';
      document.getElementById('onlineActive').style.display = 'none';
      restoreGameData(data);
      updateCheatPanelVisibility();
      flashStatus('📂 Đã tải ván cờ từ file.', false);
    }catch(err){
      flashStatus('File này không đúng định dạng ván cờ.', true);
    }
  };
  reader.readAsText(file);
}

function flashStatus(text, isWarn){
  const el = document.getElementById('onlineStatus');
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
  state.online.active = true;
  state.online.color = color;
  state.online.transport = 'firebase';
  state.mode = 'pvp';
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode==='pvp'));
  updateCheatPanelVisibility();
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
  document.getElementById('roomCodeDisplay').textContent = state.online.color==='red' ? 'Đỏ' : 'Đen';

  const base = state.turn===state.online.color
    ? 'Đến lượt bạn — cứ đi, đối thủ sẽ thấy ngay.'
    : 'Đang chờ đối thủ đi (thời gian thực).';
  document.getElementById('onlineRoleLabel').textContent =
    state.online.roomCode ? `${base} · Mã phòng: ${state.online.roomCode}` : base;
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
    setFbStatus('Chưa cấu hình Firebase trong config.json — xem hướng dẫn ở README.', true);
    return;
  }
  try{ fbInit(); }catch(err){ setFbStatus('Lỗi khởi tạo Firebase: '+err.message, true); return; }

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
    gameOver: false
  };
  try{
    await fb.roomRef.set(payload);
  }catch(err){
    setFbStatus('Không tạo được phòng — kiểm tra config/luật bảo mật Firebase.', true);
    return;
  }
  fbListen();
  setFbStatus(`🟢 Đã tạo phòng ${code} — gửi mã này cho đối thủ.`, false);
  showOnlineActive();
}

async function fbJoinRoom(){
  if(!fbAvailable()){
    setFbStatus('Chưa cấu hình Firebase trong config.json — xem hướng dẫn ở README.', true);
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
    setFbStatus('Không đọc được phòng — kiểm tra mã hoặc luật bảo mật Firebase.', true);
    return;
  }
  const data = snap.val();
  if(!data){ setFbStatus('Không tìm thấy phòng này.', true); return; }

  fb.room = code;
  fb.roomRef = ref;
  startRemoteGame('black');
  state.online.roomCode = code;
  state.online.version = 0; // force-apply whatever the host currently has
  fbListen();
  fbApplyState(data);
  setFbStatus(`🟢 Đã vào phòng ${code}!`, false);
  showOnlineActive();
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

// Firebase pushes the *whole* board each time rather than a single move,
// so we just replace local state wholesale instead of routing through
// doMove() — simpler and self-correcting if a message is ever missed.
function fbApplyState(data){
  if(!data || data.version==null || data.version === state.online.version) return;
  let board;
  try{ board = JSON.parse(data.boardJSON); }catch(err){ return; }
  resetPieceLayer();
  state.board = board;
  state.turn = data.turn;
  try{ state.lastMove = JSON.parse(data.lastMoveJSON); }catch(err){ state.lastMove = null; }
  state.online.version = data.version;
  state.selected = null;
  state.legalTargets = [];
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
  if(data.gameOver) state.gameOver = true;
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

function leaveRoom(){
  fbStopListening();
  state.online.active = false;
  state.online.color = null;
  state.online.transport = null;
  state.online.roomCode = null;
  document.getElementById('onlineIdle').style.display = '';
  document.getElementById('onlineActive').style.display = 'none';
  document.getElementById('fbJoinCodeInput').value = '';
  setFbStatus('', false);
  resetGame();
}

function updateCheatPanelVisibility(){
  const panel = document.getElementById('cheatPanel');
  const show = state.mode!=='pvp' && !state.online.active;
  panel.style.display = show ? '' : 'none';
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

const colLetters = ['a','b','c','d','e','f','g','h','i'];
function addHistoryEntry(entry){
  const box = document.getElementById('historyBox');
  const div = document.createElement('div');
  const n = state.history.length;
  const colorLbl = entry.piece.color==='red' ? 'Đ' : 'Đ̶'; // fallback simple
  const glyph = GLYPHS[entry.piece.color][entry.piece.type];
  const from = `${colLetters[entry.from.c]}${entry.from.r}`;
  const to = `${colLetters[entry.to.c]}${entry.to.r}`;
  div.textContent = `${n}. [${entry.piece.color==='red'?'Đỏ':'Đen'}] ${glyph} ${from}→${to}${entry.captured? ' ×'+GLYPHS[entry.captured.color][entry.captured.type]:''}`;
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

function resetGame(){
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
}

/* ---------------- Wire up controls ---------------- */

document.querySelectorAll('.mode-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(state.online.active) leaveRoom();
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    state.humanColor = 'red';
    updateCheatPanelVisibility();
    resetGame();
  });
});

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('resetBtn').addEventListener('click', resetGame);
document.getElementById('modalBtn').addEventListener('click', resetGame);

document.getElementById('saveBtn').addEventListener('click', saveGame);
document.getElementById('loadBtn').addEventListener('click', loadGame);
document.getElementById('loadFileInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(file) handleLoadFile(file);
  e.target.value = '';
});

document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);

document.getElementById('fbCreateRoomBtn').addEventListener('click', fbCreateRoom);
document.getElementById('fbJoinRoomBtn').addEventListener('click', fbJoinRoom);
document.getElementById('fbJoinCodeInput').addEventListener('keydown', (e)=>{
  if(e.key==='Enter') fbJoinRoom();
});

document.getElementById('skipAiBtn').addEventListener('click', cheatSkipAiTurn);
document.getElementById('beheadBtn').addEventListener('click', cheatBeheadGeneral);
document.getElementById('reviveChariotBtn').addEventListener('click', cheatReviveChariot);
document.getElementById('killModeToggle').addEventListener('change', (e)=>{
  state.cheat.killMode = e.target.checked;
  document.getElementById('cheatPanel').classList.toggle('killmode-on', state.cheat.killMode);
});

updateCheatPanelVisibility();

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
  renderPieces();
  renderMarkers();
  updateStatus();
  updateUndoBtn();
}

loadConfigAndInit();
