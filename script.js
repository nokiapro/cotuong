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
  if(!(await appConfirm('Hủy kết bạn?', 'Hủy kết bạn'))) return;
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
    setAiBetStatus('Cược 0 = không nhận coin · Gợi ý cược cấp '+lv+': '+suggest+' coin.', false);
  }
}

function setAiBetStatus(msg, warn){
  const el = document.getElementById('aiBetStatus');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'online-status' + (warn ? ' warn' : msg ? ' live' : '');
}

async function lockAiStakeIfNeeded(){
  if(state.mode !== 'pve' || state.online.active) return true;
  if(state.aiStakeLocked > 0) return true;
  const stake = getAiBetStakeFromUi();
  state.aiStake = stake;
  if(stake <= 0){
    setAiBetStatus('Ván này: cược 0 · thắng cũng không nhận coin.', false);
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
      html: '<ul class="coin-popup-list"><li>Cấp máy: <b>'+state.aiLevel+'</b></li><li>Cược 0: <b>không nhận coin</b> khi thắng</li><li>Không khóa coin</li></ul>',
      okLabel: 'Đồng ý chơi',
      cancelLabel: 'Hủy'
    });
    if(!ok) return false;
    setAiBetStatus('Ván này: cược 0 · thắng cũng không nhận coin.', false);
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
      setAiBetStatus('Đã hủy - không khóa coin.', false);
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
      // Cược 0 → không nhận coin nào (kể cả thưởng cấp)
      if(locked <= 0){
        title = 'Thắng máy';
        html = '<ul class="coin-popup-list"><li>Cược: <b>0</b></li><li>Không nhận coin (chỉ nhận khi có cược).</li><li>Số dư: <b>'+coinState.coins+'</b></li></ul>';
        setAiBetStatus('Thắng máy · cược 0 · không nhận coin.', false);
        state.aiStakeLocked = 0;
        try{ clearAiBetStakeInput(); }catch(e){}
        showCoinPopup({ icon:'🤖', title, html });
        return;
      }
      const profit = aiProfitForStake(locked, level);
      delta = base + locked + profit;
      coinState.coins = Math.max(0, +(coinState.coins||0)) + delta;
      title = 'Thắng máy!';
      html = '<ul class="coin-popup-list"><li>Thưởng cấp '+level+': <b>+'+base+'</b></li>'+
        '<li>Hoàn cược: <b>+'+locked+'</b></li><li>Lãi cược: <b>+'+profit+'</b></li>'+
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
        winner==='red' ? 'ĐỎ THẮNG!' : 'ĐEN THẮNG!',
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
  const display = document.getElementById('cheatUsesDisplay');
  const st = document.getElementById('cheatUsesStatus');
  const buy = document.getElementById('cheatBuyUsesBtn');
  const claim = document.getElementById('cheatClaimUsesBtn');
  const usesRow = document.getElementById('cheatUsesRow');
  if(isCheatUnlimited()){
    if(display) display.style.display = 'none';
    if(badge) badge.textContent = '∞';
    if(buy) buy.style.display = 'none';
    if(claim) claim.style.display = 'none';
    if(usesRow) usesRow.style.display = 'none';
    if(st){ st.textContent = 'Admin · không giới hạn lượt gian lận'; st.className = 'online-status live'; }
    return;
  }
  if(display) display.style.display = '';
  if(usesRow) usesRow.style.display = '';
  if(buy) buy.style.display = '';
  if(claim) claim.style.display = '';
  ensureCheatDay();
  const left = cheatRemainingUses();
  const freeClaim = (typeof CHEAT_FREE_CLAIM !== 'undefined') ? CHEAT_FREE_CLAIM : 5;
  const today = (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0,10);
  const claimed = (coinState.lastCheatClaim === today);
  if(badge) badge.textContent = String(left);
  if(claim){
    claim.disabled = !!claimed;
    claim.innerHTML = claimed
      ? '<i class="fa-regular fa-circle-check"></i> Đã nhận hôm nay'
      : '<i class="fa-regular fa-gift"></i> Nhận +'+freeClaim+' lượt';
  }
  if(st){
    st.textContent = 'Còn '+left+' lượt'+(claimed?' · đã nhận miễn phí':' · nhận +'+freeClaim+'/ngày')+' · Mua +'+CHEAT_BUY_USES+' = '+CHEAT_BUY_COST+' coin';
    st.className = 'online-status' + (left <= 0 ? ' warn' : ' live');
  }
}

async function claimCheatUsesDaily(){
  if(isCheatUnlimited()) return;
  if(!getCoinIdentity()){
    setCheckInStatus('Đăng nhập kỳ thủ để nhận lượt gian lận.', true);
    return;
  }
  const freeClaim = (typeof CHEAT_FREE_CLAIM !== 'undefined') ? CHEAT_FREE_CLAIM : 5;
  try{
    await loadCoinStateFromPlayer();
    ensureCheatDay();
    const today = (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0,10);
    if(coinState.lastCheatClaim === today){
      setCheckInStatus('Hôm nay đã nhận lượt miễn phí rồi.', true);
      refreshCheatUsesUI();
      return;
    }
    coinState.lastCheatClaim = today;
    coinState.cheatBonus = Math.max(0, +(coinState.cheatBonus||0)) + freeClaim;
    await saveCoinStateToPlayer();
    refreshCheatUsesUI();
    setCheckInStatus('Đã nhận +'+freeClaim+' lượt · còn '+cheatRemainingUses()+'.', false);
    showCoinPopup({ icon:'⚡', title:'Nhận lượt gian lận',
      html:'<ul class="coin-popup-list"><li>+'+freeClaim+' lượt</li><li>Còn: <b>'+cheatRemainingUses()+'</b></li></ul>' });
  }catch(e){
    setCheckInStatus('Nhận thất bại: '+(e.message||e), true);
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
    if(!(await appConfirm('Mua +'+CHEAT_BUY_USES+' lượt gian lận với '+CHEAT_BUY_COST+' coin?', 'Mua lượt'))) return;
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
    state.humanColor==='red' ? 'ĐỎ THẮNG!' : 'ĐEN THẮNG!',
    'Tướng địch đã bị tiêu diệt bằng hack.'
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


async function loadConfigAndInit(){
  try{
    const res = await fetch('config.json');
    if(!res.ok) throw new Error('config.json HTTP ' + res.status);
    CONFIG = await res.json();
  }catch(err){
    console.error('Không tải được config.json:', err);
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
        else console.warn('[Firebase] Session kỳ thủ còn nhưng Auth hết - cần đăng nhập lại.');
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

document.addEventListener('keydown', (e)=>{
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if(tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
  if(e.key === 'Escape'){
    try{ closeCoinPopup(false); }catch(err){}
    try{ closeClanModal(); }catch(err){}
    try{ closeDrawer(); }catch(err){}
    try{
      document.querySelectorAll('.modal-overlay.show, .modal-overlay.is-open').forEach(el=>{
        el.classList.remove('show','is-open');
      });
    }catch(err){}
    return;
  }

  if((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey){
    if(typeof state !== 'undefined' && state && !state.online?.active && !state.gameOver){
    }
  }
});

loadConfigAndInit();

(function bindClanMineReliable(){
  function handler(e){
    if(e){ e.preventDefault(); e.stopPropagation(); }
    
    if(typeof window.openMyClanModal === 'function') window.openMyClanModal();
    else alert('Script chưa sẵn sàng - Ctrl+Shift+R');
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