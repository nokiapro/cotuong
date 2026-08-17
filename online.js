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

function playerAuthEmail(code){
  const c = String(code||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  return c + '@cotuong.player';
}

function fbInit(){
  if(fb.app){
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

  fb.auth.onAuthStateChanged((user)=>{
    fb.uid = user ? user.uid : null;
  });
  return fb._authReady;
}

async function fbEnsureAuth(){
  if(!fbAvailable()) throw new Error('Firebase Auth/SDK chưa sẵn sàng');
  await fbInit();
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
        const myPid = (typeof playerSession !== 'undefined' && playerSession && playerSession.id) ? playerSession.id : null;
        if(current && current.uid && current.uid !== uid){
          // Cho phép chiếm ghế reserved / đúng playerId (ép vào phòng)
          const isReserved = current.uid === 'reserved' || current.uid === 'admin' || current.uid === 'system';
          const forMe = myPid && current.playerId && current.playerId === myPid;
          if(!isReserved && !forMe){
            if(current.ts && (t - current.ts) < ROOM_EMPTY_GRACE_MS) return;
          }
          // reserved cho người khác → chặn
          if(isReserved && current.playerId && myPid && current.playerId !== myPid) return;
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
  try{ closeDrawer(); }catch(e){}
  try{ syncBoardOrientationFromRole(); }catch(e){}
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
  try{ closeDrawer(); }catch(e){}
  try{ syncBoardOrientationFromRole(); }catch(e){}
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

let spectatorViewMode = 'red';
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
          info[color] = { id: pid, code: p.code||code, name: p.name||name, theme: theme || 'wood', avatar: p.avatar||'' };
          continue;
        }
      }catch(e){}
    }
    info[color] = { id: pid, code, name, theme: theme || 'wood', avatar: (seat && seat.avatar)||'' };
  }
  spectatorSeatInfo = info;
  return info;
}

function applySpectatorView(view){
  if(view !== 'red' && view !== 'black') view = 'red';
  spectatorViewMode = view;
  document.querySelectorAll('.spectator-view-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.view === spectatorViewMode);
  });
  let themeId = 'wood';
  if(spectatorViewMode === 'red'){
    themeId = spectatorBroadcastCfg.themeRed || (spectatorSeatInfo.red && spectatorSeatInfo.red.theme) || spectatorBroadcastCfg.themeBoth || 'wood';
  } else {
    themeId = spectatorBroadcastCfg.themeBlack || (spectatorSeatInfo.black && spectatorSeatInfo.black.theme) || spectatorBroadcastCfg.themeBoth || 'wood';
  }
  if(typeof THEMES !== 'undefined' && THEMES[themeId]){
    try{ applyTheme(themeId, { force:true }); }catch(e){}
  }
  try{
    if(typeof setBoardOrientation === 'function') setBoardOrientation(spectatorViewMode === 'black');
    else if(typeof syncBoardOrientationFromRole === 'function') syncBoardOrientationFromRole();
  }catch(e){}
  updateSpectatorViewMeta();
}
function updateSpectatorViewMeta(){
  const el = document.getElementById('spectatorViewMeta');
  if(!el) return;
  if(spectatorViewMode === 'black'){
    const p = spectatorSeatInfo.black;
    el.textContent = 'Góc Đen (Đen dưới) · '+((p && (p.name||p.code)) || '—');
  } else {
    const p = spectatorSeatInfo.red;
    el.textContent = 'Góc Đỏ (Đỏ dưới) · '+((p && (p.name||p.code)) || '—');
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
  if(rn) rn.textContent = red ? (red.name || red.code || 'Đỏ') : 'Đỏ';
  if(bn) bn.textContent = black ? (black.name || black.code || 'Đen') : 'Đen';
  if(rm) rm.style.display = 'none';
  if(bm) bm.style.display = 'none';
  (function setSpecAv(imgId, seat){
    const img = document.getElementById(imgId);
    if(!img) return;
    let av = (seat && (seat.avatar || seat.photo)) || '';
    if(av){
      const src = (/^https?:\/\//i.test(av) || String(av).startsWith('data:')) ? av : ('https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/photo/'+av);
      img.src = src; img.style.display = '';
    } else { img.removeAttribute('src'); img.style.display = 'none'; }
  })('specChoiceRedAvatar', red);
  (function setSpecAv(imgId, seat){
    const img = document.getElementById(imgId);
    if(!img) return;
    let av = (seat && (seat.avatar || seat.photo)) || '';
    if(av){
      const src = (/^https?:\/\//i.test(av) || String(av).startsWith('data:')) ? av : ('https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/photo/'+av);
      img.src = src; img.style.display = '';
    } else { img.removeAttribute('src'); img.style.display = 'none'; }
  })('specChoiceBlackAvatar', black);
  document.getElementById('spectatorChoiceOverlay')?.classList.add('show');
}

function closeSpectatorChoiceModal(){
  document.getElementById('spectatorChoiceOverlay')?.classList.remove('show');
}

async function fbSpectateRoom(){
  try{ closeDrawer(); }catch(e){}
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
  try{ await openSpectatorChoiceModal(data); }catch(e){ applySpectatorView('red'); }
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
      const t = document.getElementById('undoModalText');
      if(t) t.textContent = `Đối thủ (${req.by==='red'?'Đỏ':'Đen'}) xin đi lại nước vừa rồi.`;
      if(overlay) overlay.classList.add('show');
    } else if(req.status==='accepted' && req.by === state.online.color){
      if(overlay) overlay.classList.remove('show');
      setFbStatus('Đối thủ đã chấp nhận đi lại.', false);
      try{ if(typeof showCoinPopup==='function') showCoinPopup({ icon:'🤝', title:'Đi lại được chấp nhận', html:'<div class="coin-popup-hint">Đối thủ đã đồng ý cho bạn đi lại.</div>' }); }catch(e){}
      try{ fb.roomRef.child('undoRequest').remove(); }catch(e){}
    } else if(req.status==='declined' && req.by === state.online.color){
      if(overlay) overlay.classList.remove('show');
      setFbStatus('Đối thủ đã từ chối yêu cầu đi lại.', true);
      try{ if(typeof showCoinPopup==='function') showCoinPopup({ warn:true, icon:'🚫', title:'Đi lại bị từ chối', html:'<div class="coin-popup-hint">Đối thủ không đồng ý đi lại.</div>' }); }catch(e){}
      try{ fb.roomRef.child('undoRequest').remove(); }catch(e){}
    } else {
      if(overlay) overlay.classList.remove('show');
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
    try{ fb.roomRef.child('undoRequest').update({ status:'accepted', ts: Date.now() }); }catch(e){}
    fbPushState();
    setTimeout(()=>{ try{ fb.roomRef && fb.roomRef.child('undoRequest').remove(); }catch(e){} }, 800);
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

function setFloatChatCollapsed(collapsed){
  floatChatCollapsed = !!collapsed;
  const el = document.getElementById('floatChat');
  const body = document.getElementById('floatChatBody');
  const minBtn = document.getElementById('floatChatMinBtn');
  if(el) el.classList.toggle('is-collapsed', floatChatCollapsed);
  if(body){ body.style.display = ''; body.classList.toggle('is-collapsed', floatChatCollapsed); }
  if(minBtn){
    minBtn.innerHTML = floatChatCollapsed
      ? '<i class="fa-solid fa-plus"></i>'
      : '<i class="fa-solid fa-minus"></i>';
    minBtn.setAttribute('title', floatChatCollapsed ? 'Mở chat' : 'Thu chat');
  }
  if(!floatChatCollapsed){ chatUnread = 0; chatMentionUnread = 0; }
  try{ updateChatUnreadBadge(); }catch(e){}
}
function showFloatChat(show){
  const el = document.getElementById('floatChat');
  if(!el) return;
  el.style.display = show ? '' : 'none';
  if(show){
    const room = document.getElementById('floatChatRoom');
    if(room) room.textContent = state.online.roomCode || '—';
    setFloatChatCollapsed(true); // vào phòng: thu nhỏ
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

const CHAT_AVATAR_BASE = 'https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/photo/';
function chatAvatarUrl(msg){
  let av = (msg && (msg.avatar || msg.photo || msg.photoURL)) || '';
  if(!av && typeof playerSession !== 'undefined' && playerSession && msg && msg.code && playerSession.code === msg.code)
    av = playerSession.avatar || '';
  if(!av) return '';
  if(/^https?:\/\//i.test(av) || av.startsWith('data:')) return av;
  return CHAT_AVATAR_BASE + av;
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

  const avUrl = chatAvatarUrl(msg);
  const av = document.createElement('span');
  av.className = 'chat-avatar';
  if(avUrl){
    av.innerHTML = '<img src="'+avUrl.replace(/"/g,'')+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.textContent=\'👤\'">';
  } else av.textContent = '👤';
  head.appendChild(av);

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
  if(msg.color === 'red' || msg.color === 'black'){
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
    meta.avatar = playerSession.avatar || '';
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
  try{ closeDrawer(); }catch(e){}
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
  try{ if(typeof setBoardOrientation==='function') setBoardOrientation(false); }catch(e){}
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

  // Chỉ hoàn coin khi opts.refundStake === true (hủy / thoát)
  // Sau khi «Khóa coin & chơi» KHÔNG hoàn — giữ aiStakeLocked đến hết ván
  if(opts.refundStake && state.aiStakeLocked > 0 && getCoinIdentity()){
    try{
      await loadCoinStateFromPlayer();
      coinState.coins = Math.max(0, +(coinState.coins||0)) + state.aiStakeLocked;
      await saveCoinStateToPlayer();
      refreshThemeLocks();
      try{ setAiBetStatus('Đã hoàn '+state.aiStakeLocked+' coin khóa.', false); }catch(e){}
    }catch(e){}
    state.aiStakeLocked = 0;
    state.aiStake = 0;
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
  state.pveSettled = false;
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
document.getElementById('fbSpectateBtn')?.addEventListener('click', ()=>{ try{ closeDrawer(); }catch(e){} fbSpectateRoom(); });
document.getElementById('shareRoomBtn')?.addEventListener('click', ()=>{ try{ closeDrawer(); }catch(e){} openShareRoomModal(); });
document.getElementById('shareRoomCloseBtn')?.addEventListener('click', closeShareRoomModal);
document.getElementById('copyShareLinkBtn')?.addEventListener('click', copyShareLink);
document.getElementById('fbJoinCodeInput')?.addEventListener('keydown', (e)=>{
  if(e.key==='Enter') fbJoinRoom();
});

document.getElementById('requestUndoBtn')?.addEventListener('click', ()=>{ try{ closeDrawer(); }catch(e){} requestUndo(); });
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

document.getElementById('chatSendBtn')?.addEventListener('click', ()=> sendChat(false));
document.getElementById('chatInput')?.addEventListener('keydown', (e)=>{
  if(e.key==='Enter') sendChat(false);
});
document.getElementById('floatChatSendBtn')?.addEventListener('click', ()=> sendChat(true));
document.getElementById('floatChatInput')?.addEventListener('keydown', (e)=>{
  if(e.key==='Enter') sendChat(true);
});
document.getElementById('floatChatMinBtn')?.addEventListener('click', (e)=>{
  e.stopPropagation();
  setFloatChatCollapsed(!floatChatCollapsed);
});
document.getElementById('floatChatHeader')?.addEventListener('click', (e)=>{
  if(e.target.closest('.float-chat-min')) return;
  if(floatChatCollapsed) setFloatChatCollapsed(false);
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

/** Ép cứng vào phòng (admin đấu nhanh) — listen 2 path */
let _forceJoinBusy = false;
let _forceJoinBound = false;
function bindForceJoinRef(ref){
  if(!ref) return;
  ref.on('value', async function(snap){
    const cmd = snap.val();
    if(!cmd || !cmd.roomCode || !cmd.ts) return;
    if(Date.now() - (+cmd.ts||0) > 120000) return;
    if(_forceJoinBusy) return;
    _forceJoinBusy = true;
    try{
      try{ await ref.remove(); }catch(e){}
      const code = String(cmd.roomCode).toUpperCase();
      if(state.online && state.online.active && state.online.roomCode === code){
        try{ if(typeof syncBoardOrientationFromRole==='function') syncBoardOrientationFromRole(); }catch(e){}
        return;
      }
      try{ closeDrawer(); }catch(e){}
      try{ if(state.online && state.online.active) leaveRoom(); }catch(e){}
      await new Promise(r=>setTimeout(r, 250));
      const inp = document.getElementById('fbJoinCodeInput');
      if(inp) inp.value = code;
      window._preferredJoinColor = (cmd.color === 'black') ? 'black' : 'red';
      // Bypass UI: join trực tiếp
      if(typeof fbJoinRoom === 'function'){
        await fbJoinRoom();
      }
      try{ closeDrawer(); }catch(e){}
      try{ if(typeof syncBoardOrientationFromRole==='function') syncBoardOrientationFromRole(); }catch(e){}
      try{ setFbStatus('⚡ Admin đã ép bạn vào phòng '+code+' ('+(cmd.color==='black'?'Đen':'Đỏ')+').', false); }catch(e){}
    }catch(e){
      console.warn('forceJoin handler', e);
      try{ setFbStatus('Ép vào phòng thất bại: '+(e.message||e), true); }catch(err){}
    }finally{
      _forceJoinBusy = false;
    }
  });
}
function listenForceJoin(){
  try{
    if(typeof playerSession === 'undefined' || !playerSession || !playerSession.id) return;
    if(typeof fbAvailable !== 'function' || !fbAvailable()) return;
    if(!fb.db) return;
    if(_forceJoinBound) return;
    _forceJoinBound = true;
    const id = playerSession.id;
    bindForceJoinRef(fb.db.ref('presence/players/'+id+'/forceJoin'));
    bindForceJoinRef(fb.db.ref('forceJoin/'+id));
    // heartbeat presence để admin thấy online
    try{
      const pref = fb.db.ref('presence/players/'+id);
      pref.update({ online: true, ts: Date.now(), code: playerSession.code||'', name: playerSession.name||'' });
      setInterval(()=>{
        try{ pref.update({ online: true, ts: Date.now() }); }catch(e){}
      }, 25000);
    }catch(e){}
  }catch(e){ console.warn('listenForceJoin', e); }
}
try{
  setTimeout(listenForceJoin, 800);
  setTimeout(listenForceJoin, 2500);
  setTimeout(function(){ _forceJoinBound = false; listenForceJoin(); }, 6000);
}catch(e){}



/* ===== Banner thông báo toàn site (đúng 3 lần, khung nhỏ) ===== */
let _announceQueue = [];
let _announceRunning = false;
let _announceSeen = {};

function playSiteAnnounce(text, runs, gapMs, id){
  const key = id || (String(text)+'|'+(runs||3));
  if(_announceSeen[key]) return;
  _announceSeen[key] = true;
  // giới hạn bộ nhớ
  const keys = Object.keys(_announceSeen);
  if(keys.length > 40) keys.slice(0, keys.length-40).forEach(k=> delete _announceSeen[k]);

  runs = Math.min(5, Math.max(1, +(runs||3)));
  gapMs = Math.max(3000, +(gapMs||10000));
  _announceQueue.push({ text: String(text||'').trim(), runs, gapMs });
  if(!_announceRunning) drainAnnounceQueue();
}

function showAnnounceOnce(text){
  return new Promise(resolve=>{
    const bar = document.getElementById('siteAnnounceBar');
    const span = document.getElementById('siteAnnounceText');
    if(!bar || !span || !text){ resolve(); return; }
    span.textContent = text;
    bar.style.display = 'flex';
    bar.classList.remove('run');
    void bar.offsetWidth;
    bar.classList.add('run');

    let done = false;
    const finish = ()=>{
      if(done) return;
      done = true;
      bar.classList.remove('run');
      bar.style.display = 'none';
      span.textContent = '';
      resolve();
    };
    const onEnd = (e)=>{
      if(e && e.target && e.target !== span && !e.target.classList.contains('site-announce-text')) return;
      span.removeEventListener('animationend', onEnd);
      finish();
    };
    span.addEventListener('animationend', onEnd);
    // fallback cứng ~8s — không chạy mãi
    setTimeout(finish, 8500);
  });
}

async function drainAnnounceQueue(){
  if(_announceRunning) return;
  _announceRunning = true;
  try{
    while(_announceQueue.length){
      const job = _announceQueue.shift();
      const times = Math.min(5, Math.max(1, job.runs|0 || 3));
      for(let i=0; i<times; i++){
        await showAnnounceOnce(job.text);
        if(i < times - 1){
          await new Promise(r=> setTimeout(r, job.gapMs || 10000));
        }
      }
    }
  }finally{
    _announceRunning = false;
  }
}

function listenSiteAnnounce(){
  try{
    if(typeof fbAvailable !== 'function' || !fbAvailable() || !fb.db) return;
    if(window._announceListenBound) return;
    window._announceListenBound = true;
    let lastTs = 0;
    fb.db.ref('admin/announceLive').on('value', snap=>{
      const v = snap.val();
      if(!v || !v.text || !v.ts) return;
      const ts = +v.ts;
      if(ts <= lastTs) return;
      lastTs = ts;
      if(Date.now() - ts > 120000) return; // bỏ quá 2 phút
      playSiteAnnounce(v.text, v.runs || 3, v.gapMs || 10000, 'live_'+ts);
    });
  }catch(e){ console.warn('listenSiteAnnounce', e); }
}
try{
  setTimeout(listenSiteAnnounce, 1200);
  setTimeout(listenSiteAnnounce, 3500);
}catch(e){}


/* ===== Poll toàn site ===== */
function listenSitePoll(){
  try{
    if(typeof fbAvailable!=='function' || !fbAvailable() || !fb.db) return;
    if(window._pollListenBound) return;
    window._pollListenBound = true;
    fb.db.ref('admin/pollLive').on('value', async snap=>{
      const p = snap.val();
      if(!p || !p.question || p.status==='closed') return;
      if(Date.now() - (+p.ts||0) > 3600000) return;
      showSitePollPopup(p);
    });
  }catch(e){}
}
function showSitePollPopup(p){
  try{
    if(sessionStorage.getItem('poll_voted_'+p.id)) return;
    const opts = (p.options||[]).map((o,i)=>
      '<button type="button" class="action-btn" data-poll-vote="'+i+'" style="width:100%;margin:4px 0;">'+o+'</button>'
    ).join('');
    showCoinPopup({
      icon:'📊', title: p.question,
      html: '<div class="coin-popup-hint">Chọn một phương án:</div><div id="pollVoteBox">'+opts+'</div>',
      okLabel:'Bỏ qua'
    });
    setTimeout(()=>{
      document.querySelectorAll('[data-poll-vote]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const idx = +btn.getAttribute('data-poll-vote');
          try{
            await fb.db.ref('admin/polls/'+p.id+'/votes/'+idx).transaction(c => (+c||0)+1);
            sessionStorage.setItem('poll_voted_'+p.id, '1');
            btn.parentNode.innerHTML = '<div class="coin-popup-hint">Đã gửi bình chọn.</div>';
          }catch(e){}
        });
      });
    }, 200);
  }catch(e){}
}
try{ setTimeout(listenSitePoll, 1600); }catch(e){}
