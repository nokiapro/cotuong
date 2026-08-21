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
    let user = (fb.auth && fb.auth.currentUser) || null;
    if(!user && fb._authReady){
      try{ await fb._authReady; }catch(e){}
      user = (fb.auth && fb.auth.currentUser) || null;
    }
    // Khách: đăng nhập ẩn danh nếu chưa có session
    if(!user){
      try{
        const cred = await fb.auth.signInAnonymously();
        user = cred && cred.user ? cred.user : (fb.auth.currentUser || null);
      }catch(err){
        console.warn('signInAnonymously failed', err && err.code, err && err.message);
        // fallback: chờ auth state
        try{
          await new Promise((resolve)=>{
            const t = setTimeout(resolve, 2500);
            const unsub = fb.auth.onAuthStateChanged(u=>{
              if(u){ clearTimeout(t); unsub(); resolve(); }
            });
          });
          user = fb.auth.currentUser || null;
        }catch(e2){}
      }
    }
    if(user) fb.uid = user.uid;
    return user;
  }catch(e){
    console.warn('fbEnsureAuthOptional', e);
    return null;
  }
}

/** Auth cho khách (luôn cố anonymous) */
async function fbEnsureGuestAuth(){
  return fbEnsureAuthOptional();
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

  const _fm = (window._timeConfig && window._timeConfig.friends != null) ? +window._timeConfig.friends : (+window._defaultThinkMinutes || 5);
  const mins = Math.max(0, Math.min(20, _fm));
  const infinite = mins === 0;
  const payload = {
    boardJSON: JSON.stringify(boardToPlain(state.board)),
    turn: state.turn,
    lastMoveJSON: 'null',
    version: 1,
    gameOver: false,
    paused: false,
    createdAt: Date.now(),
    timeControl: mins,
    clockInfinite: infinite,
    clockRed: infinite ? null : mins * 60,
    clockBlack: infinite ? null : mins * 60,
    clockTurnStartedAt: Date.now(),
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
  try{
    const mins = +payload.timeControl;
    _localClock.mins = mins;
    _localClock.infinite = (mins === 0) || payload.clockInfinite === true;
    _localClock.paused=false; _localClock.flagged=false;
    try{ resetClockForNewTurn(state.turn || 'red'); }catch(e){}
    ensureClockUI(); renderClocks(); startClockTick();
  }catch(e){}
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
  try{
    const mins = data.timeControl != null ? +data.timeControl : 15;
    _localClock.mins = mins;
    _localClock.infinite = (mins === 0) || data.clockInfinite === true;
    _localClock.paused = !!data.paused;
    _localClock.flagged = false;
    try{ resetClockForNewTurn(state.turn || data.turn || 'red'); }catch(e){}
    ensureClockUI(); renderClocks(); startClockTick();
  }catch(e){}
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
  if(!data) return;
  // Xử lý trọng tài / pause / clock kể cả khi version không đổi
  try{ applyRefereeAndClock(data); }catch(e){ console.warn('ref/clock', e); }
  if(data.version==null || data.version === state.online.version) return;
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
  try{ if(data.turn){ /* clock sync via applyRefereeAndClock */ } }catch(e){}
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
  // Mỗi nước → reset đồng hồ lượt mới
  try{ resetClockForNewTurn(state.turn); }catch(e){}
  const full = (typeof fullMoveSeconds==='function') ? fullMoveSeconds() : ((_localClock.mins||5)*60);
  const payload = {
    boardJSON: JSON.stringify(boardToPlain(state.board)),
    turn: state.turn,
    lastMoveJSON: JSON.stringify(state.lastMove),
    version: state.online.version,
    gameOver: state.gameOver,
    clockTurnStartedAt: Date.now(),
    clockInfinite: !!_localClock.infinite,
    timeControl: _localClock.mins,
    clockRed: _localClock.infinite ? null : full,
    clockBlack: _localClock.infinite ? null : full
  };
  fb.roomRef.update(payload).catch(()=>setFbStatus('Gửi nước đi thất bại, kiểm tra mạng.', true));
  try{ startClockTick(); renderClocks(); }catch(e){}
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

window._verifiedCodes = window._verifiedCodes || {};
async function ensureVerifiedCache(){
  try{
    if(window._verifiedCacheLoaded) return;
    if(typeof fbAvailable!=='function' || !fbAvailable() || !fb.db) return;
    window._verifiedCacheLoaded = true;
    const snap = await fb.db.ref('players').once('value');
    const val = snap.val()||{};
    Object.keys(val).forEach(id=>{
      const p = val[id]||{};
      if(p.verified || p.isVerified){
        if(p.code) window._verifiedCodes[String(p.code).toUpperCase()] = true;
        window._verifiedCodes[id] = true;
      }
    });
  }catch(e){}
}
function isMsgVerified(msg){
  if(msg && (msg.verified || msg.isVerified)) return true;
  try{
    const code = msg && msg.code ? String(msg.code).toUpperCase() : '';
    if(code && window._verifiedCodes[code]) return true;
    if(msg && msg.uid && window._verifiedCodes[msg.uid]) return true;
  }catch(e){}
  return false;
}
function buildChatMsgEl(msg){
  const div = document.createElement('div');
  let roleClass = 'chat-spectator';
  if(msg.system) roleClass = 'chat-system';
  else if(msg.color === 'red') roleClass = 'chat-red';
  else if(msg.color === 'black') roleClass = 'chat-black';
  div.className = 'chat-msg chat-msg-inline ' + roleClass + (msg.flair==='gold' ? ' chat-flair-gold' : '');

  // Tooltip ngày giờ khi hover / long-press
  if(msg.ts){
    try{
      const d = new Date(msg.ts);
      div.title = d.toLocaleString('vi-VN');
      div.setAttribute('data-ts', String(msg.ts));
    }catch(e){}
  }

  const avUrl = chatAvatarUrl(msg);
  const av = document.createElement('span');
  av.className = 'chat-avatar';
  if(avUrl){
    av.innerHTML = '<img src="'+avUrl.replace(/"/g,'')+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.textContent=\'👤\'">';
  } else av.textContent = '👤';
  div.appendChild(av);

  const line = document.createElement('div');
  line.className = 'chat-msg-line';

  const senderSpan = document.createElement('span');
  senderSpan.className = 'chat-sender chat-sender-click';
  senderSpan.textContent = chatSenderLabel(msg);
  senderSpan.dataset.code = msg.code || '';
  senderSpan.dataset.name = msg.name || chatSenderLabel(msg);
  senderSpan.dataset.avatar = msg.avatar || '';
  senderSpan.title = 'Nhấn để nhắc / xem / cấm';
  senderSpan.addEventListener('click', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    openChatSenderMenu(msg, senderSpan);
  });
  line.appendChild(senderSpan);

  // Dấu tích xanh xác minh
  if(isMsgVerified(msg)){
    const tick = document.createElement('span');
    tick.className = 'chat-verified';
    tick.title = 'Đã xác minh';
    tick.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" style="width:12px;height:12px;min-width:12px;display:block" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1d9bf0"/><path d="M7 12.5l3 3 7-7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    line.appendChild(tick);
  }

  const colon = document.createElement('span');
  colon.className = 'chat-colon';
  colon.textContent = ': ';
  line.appendChild(colon);

  const body = document.createElement('span');
  body.className = 'chat-msg-body-inline';
  const rawText = msg.text || '';
  body.innerHTML = rawText.replace(/@([A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF]+)/g, '<span class="chat-mention-hl">@$1</span>');
  line.appendChild(body);

  div.appendChild(line);
  return div;
}

function openChatSenderMenu(msg, anchor){
  try{
    document.querySelectorAll('.chat-sender-menu').forEach(m=>m.remove());
  }catch(e){}
  const name = msg.name || msg.code || 'Người chơi';
  const code = (msg.code || '').toUpperCase();
  const menu = document.createElement('div');
  menu.className = 'chat-sender-menu';
  menu.innerHTML =
    '<button type="button" data-act="mention"><i class="fa-regular fa-at"></i> Nhắc @'+name+'</button>'+
    '<button type="button" data-act="info"><i class="fa-regular fa-id-card"></i> Xem thông tin</button>'+
    (code ? '<button type="button" data-act="ban"><i class="fa-regular fa-ban"></i> Cấm chat</button>' : '');
  document.body.appendChild(menu);
  const r = (anchor || document.body).getBoundingClientRect();
  menu.style.left = Math.min(window.innerWidth - 200, Math.max(8, r.left)) + 'px';
  menu.style.top = Math.min(window.innerHeight - 140, r.bottom + 4) + 'px';
  const close = ()=>{ try{ menu.remove(); }catch(e){} document.removeEventListener('click', close); };
  setTimeout(()=> document.addEventListener('click', close), 10);
  menu.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-act]');
    if(!btn) return;
    const act = btn.getAttribute('data-act');
    e.stopPropagation();
    if(act === 'mention'){
      const inputs = [document.getElementById('floatChatInput'), document.getElementById('lobbyChatInput'), document.getElementById('chatInput')];
      const tag = '@'+(code || name)+' ';
      inputs.forEach(inp=>{
        if(!inp || inp.offsetParent === null && inp.id !== 'floatChatInput' && inp.id !== 'lobbyChatInput') return;
        if(inp && (inp.closest('#floatChat') || inp.closest('#lobbyChatBox') || inp.id==='chatInput')){
          // fill visible chat inputs
        }
      });
      // Prefer visible float / lobby
      let target = null;
      const fc = document.getElementById('floatChat');
      const lb = document.getElementById('lobbyChatBox');
      if(fc && fc.style.display !== 'none') target = document.getElementById('floatChatInput');
      if(lb && lb.style.display !== 'none') target = document.getElementById('lobbyChatInput');
      if(!target) target = document.getElementById('floatChatInput') || document.getElementById('lobbyChatInput');
      if(target){
        target.value = (target.value || '') + (target.value && !target.value.endsWith(' ') ? ' ' : '') + tag;
        target.focus();
      }
      close();
    } else if(act === 'info'){
      const av = chatAvatarUrl(msg);
      const htmlInfo = '<div style="text-align:center;margin-bottom:8px;">'
        +(av?'<img src="'+av+'" style="width:64px;height:64px;border-radius:50%;object-fit:cover;">':'👤')
        +'</div><ul class="coin-popup-list"><li>Tên: <b>'+name+'</b></li>'
        +(code?'<li>ID: <b>'+code+'</b></li>':'')
        +(msg.role?'<li>Vai trò: <b>'+msg.role+'</b></li>':'')
        +'</ul>';
      try{ showCoinPopup({ icon:'👤', title:'Thông tin', html: htmlInfo, okLabel:'Đóng' }); }catch(e){ alert(name+(code?' · '+code:'')); }
      close();
    } else if(act === 'ban'){
      if(!code){ close(); return; }
      // Room ban or lobby ban depending on context
      try{
        if(state && state.online && state.online.active && fb.roomRef){
          await fb.roomRef.child('chatBans/'+code).set({ by: (playerSession&&playerSession.code)||'user', ts: Date.now() });
          try{ showCoinPopup({ icon:'🚫', title:'Đã cấm chat phòng', html:'<div class="coin-popup-hint">'+code+'</div>', okLabel:'Đóng' }); }catch(e){}
        } else {
          await fb.db.ref('admin/lobbyChatBans/'+code).set({ by: (playerSession&&playerSession.code)||'user', ts: Date.now() });
          try{ showCoinPopup({ icon:'🚫', title:'Đã cấm chat sảnh', html:'<div class="coin-popup-hint">'+code+'</div>', okLabel:'Đóng' }); }catch(e){}
        }
      }catch(err){ alert(err.message||err); }
      close();
    }
  });
}


function appendChatMessage(msg, opts={}){
  if(!msg || !msg.text) return;
  try{ trackChatMember(msg); }catch(e){}
  const el1 = document.getElementById('chatMessages');
  const el2 = document.getElementById('floatChatMessages');
  const node1 = buildChatMsgEl(msg);
  if(el1){
    el1.appendChild(node1);
    requestAnimationFrame(()=>{
      el1.scrollTop = el1.scrollHeight;
      try{ const last=el1.lastElementChild; if(last) last.scrollIntoView({block:'end', behavior:'auto'}); }catch(e){}
    });
  }
  if(el2){
    el2.appendChild(buildChatMsgEl(msg));
    requestAnimationFrame(()=>{
      el2.scrollTop = el2.scrollHeight;
      try{ const last=el2.lastElementChild; if(last) last.scrollIntoView({block:'end', behavior:'auto'}); }catch(e){}
    });
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
    meta.verified = !!(playerSession.verified || playerSession.isVerified);
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
  try{
    const adm = typeof getAdminSessionMeta === 'function' ? getAdminSessionMeta() : null;
    if(adm && adm.ok) return true;
  }catch(e){}
  const role = (playerSession && playerSession.role || '').toLowerCase();
  // Chỉ superadmin / admin / moderator — không caster, không kỳ thủ thường
  if(role === 'mod' || role === 'moderator' || role === 'admin' || role === 'superadmin') return true;
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
    showCoinPopup({ warn:true, icon:'🔒', title:'Không đủ quyền', html:'<div class="coin-popup-hint">Chỉ Superadmin / Admin / Moderator mới cấm chat.</div>', okLabel:'Đóng' });
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
    avatar: meta.avatar || null,
    verified: !!(meta.verified),
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

function applyDrawerShellStyles(drawer, open){
  if(!drawer) return;
  drawer.style.position = 'fixed';
  drawer.style.top = '0';
  drawer.style.left = '0';
  drawer.style.right = 'auto';
  drawer.style.bottom = '0';
  drawer.style.width = 'min(320px, 88vw)';
  drawer.style.maxWidth = '88vw';
  drawer.style.height = '100vh';
  drawer.style.height = '100dvh';
  drawer.style.margin = '0';
  drawer.style.textAlign = 'left';
  drawer.style.overflowX = 'hidden';
  drawer.style.overflowY = 'auto';
  drawer.style.boxSizing = 'border-box';
  drawer.style.zIndex = open ? '12000' : '12000';
  drawer.style.transform = open ? 'translate3d(0,0,0)' : 'translate3d(-105%,0,0)';
  drawer.style.transition = 'transform .25s cubic-bezier(0.32,0.9,0.44,1)';
}
function openDrawer(){
  try{ loadSpectatorPolls(); }catch(e){}
  try{ updateAdminMenuUI(); }catch(e){}
  try{ loadCoinStateFromPlayer(); }catch(e){}
  try{ loadFriendsUI(); }catch(e){}

  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  if(drawer){
    drawer.classList.add('open');
    applyDrawerShellStyles(drawer, true);
  }
  if(overlay){
    overlay.classList.add('show');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '11990';
  }
  document.getElementById('menuFab')?.classList.add('open');
  const fc = document.getElementById('floatChat');
  if(fc){ fc.style.pointerEvents = 'none'; fc.dataset.drawerBlocked = '1'; }
  document.body.classList.add('drawer-open');
}
function closeDrawer(){
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  if(drawer){
    drawer.classList.remove('open');
    applyDrawerShellStyles(drawer, false);
  }
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
  // Menu đã bỏ khối lượt — không crash nếu thiếu DOM
  if(dot) dot.className = 'turn-dot ' + state.turn;
  const colorName = state.turn==='red' ? 'Đỏ' : 'Đen';
  if(state.aiThinking){
    if(label) label.textContent = `Máy (${colorName}) đang suy nghĩ…`;
    if(indicator) indicator.classList.add('thinking');
  } else {
    if(label) label.textContent = `Lượt của ${colorName}`;
    if(indicator) indicator.classList.remove('thinking');
  }
}

function updateStatus(){
  const msg = document.getElementById('statusMsg');
  try{ updateTurnIndicator(); }catch(e){}
  if(!msg) return;
  if(state.gameOver){ msg.textContent=''; msg.classList.remove('check'); return; }
  const inCheck = (typeof isInCheck==='function') ? isInCheck(state.board, state.turn) : false;
  if(inCheck){
    msg.textContent = `⚠ ${state.turn==='red'?'Đỏ':'Đen'} đang bị chiếu tướng!`;
    msg.classList.add('check');
  } else {
    msg.textContent = '';
    msg.classList.remove('check');
  }
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
function isPlayerInActiveGame(){
  try{
    return !!(state && state.online && state.online.active && state.online.color &&
      (state.online.color === 'red' || state.online.color === 'black') &&
      !state.online.spectator);
  }catch(e){ return false; }
}
function listenSitePoll(){
  try{
    if(typeof fbAvailable!=='function' || !fbAvailable() || !fb.db) return;
    if(window._pollListenBound) return;
    window._pollListenBound = true;
    fb.db.ref('admin/pollLive').on('value', snap=>{
      const p = snap.val();
      window._pollLive = p || null;
      renderMenuPollBox();
      if(p && p.question && p.status !== 'closed'){
        if(Date.now() - (+p.ts||0) > 6*3600000) return;
        // Popup chỉ cho người chưa vote và không đang chơi
        if(!isPlayerInActiveGame() && !sessionStorage.getItem('poll_voted_'+(p.id||''))){
          showSitePollPopup(p);
        }
      }
    });
    // Lắng nghe danh sách polls gần đây cho menu
    fb.db.ref('admin/polls').limitToLast(8).on('value', snap=>{
      window._pollRecent = snap.val() || {};
      renderMenuPollBox();
    });
  }catch(e){}
}
function renderMenuPollBox(){
  const box = document.getElementById('spectatorPollBox');
  if(!box) return;
  const live = window._pollLive;
  const recent = window._pollRecent || {};
  let list = [];
  if(live && live.id) list.push({ id: live.id, ...live });
  Object.keys(recent).forEach(k=>{
    if(!list.some(x=>x.id===k)) list.push({ id:k, ...recent[k] });
  });
  list.sort((a,b)=>(b.ts||0)-(a.ts||0));
  list = list.slice(0, 5);
  if(!list.length){
    box.innerHTML = '<div class="admin-empty" style="padding:8px;">Chưa có poll.</div>';
    return;
  }
  const canVote = !isPlayerInActiveGame();
  box.innerHTML = list.map(p=>{
    const total = (p.votes||[]).reduce((s,n)=>s+(+n||0),0);
    const voted = !!sessionStorage.getItem('poll_voted_'+p.id);
    const open = p.status === 'open' || (live && live.id === p.id && p.status !== 'closed');
    const opts = (p.options||[]).map((o,i)=>{
      const c = +((p.votes&&p.votes[i])||0);
      const pct = total? Math.round(c*100/total) : 0;
      if(open && canVote && !voted){
        return '<button type="button" class="action-btn poll-opt-active" data-menu-poll-vote="'+p.id+'" data-idx="'+i+'" style="width:100%;margin:3px 0;justify-content:space-between;box-shadow:0 0 0 1px rgba(232,200,120,0.45);">'
          +'<span>'+o+'</span><span class="sub">'+c+' ('+pct+'%)</span></button>';
      }
      // đã vote hoặc đóng: mờ
      return '<div class="poll-opt-done" style="display:flex;justify-content:space-between;padding:6px 8px;margin:3px 0;border-radius:8px;opacity:'+(voted||!open?'0.55':'0.85')+';background:rgba(0,0,0,0.2);border:1px solid rgba(200,151,63,0.12);">'
        +'<span>'+o+'</span><b>'+c+' · '+pct+'%</b></div>';
    }).join('');
    return '<div class="admin-item poll-card '+(voted?'poll-voted':'poll-open')+'" style="flex-direction:column;align-items:stretch;margin-bottom:8px;'+(voted?'opacity:0.75;':'')+'">'
      +'<b style="color:var(--brass-light)">'+(open?'🟢 ':'⚫ ')+(p.question||'')+'</b>'
      +'<div class="sub" style="margin:4px 0;">'+total+' phiếu'
      +(voted?' · bạn đã bình chọn':(open && canVote?' · chọn phương án bên dưới':''))
      +(!canVote?' · đang chơi — không bình chọn':'')
      +'</div>'
      +opts+'</div>';
  }).join('');
  box.querySelectorAll('[data-menu-poll-vote]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(isPlayerInActiveGame()){ alert('Hai kỳ thủ đang chơi không được bình chọn.'); return; }
      const id = btn.getAttribute('data-menu-poll-vote');
      const idx = +btn.getAttribute('data-idx');
      try{
        await fb.db.ref('admin/polls/'+id+'/votes/'+idx).transaction(c => (+c||0)+1);
        sessionStorage.setItem('poll_voted_'+id, '1');
        try{
          if(window._pollLive && window._pollLive.id === id){
            const v = window._pollLive.votes || [];
            v[idx] = (+v[idx]||0)+1;
            window._pollLive.votes = v;
          }
        }catch(e){}
        renderMenuPollBox();
      }catch(e){ alert(e.message||e); }
    });
  });
}

function showSitePollPopup(p){
  try{
    if(!p || !p.id) return;
    if(isPlayerInActiveGame()) return;
    if(sessionStorage.getItem('poll_voted_'+p.id)) return;
    if(window._pollPopupShown === p.id) return;
    window._pollPopupShown = p.id;
    const opts = (p.options||[]).map((o,i)=>
      '<button type="button" class="action-btn" data-poll-vote="'+i+'" style="width:100%;margin:4px 0;">'+o+'</button>'
    ).join('');
    showCoinPopup({
      icon:'📊', title: p.question,
      html: '<div class="coin-popup-hint">Chọn một phương án (kỳ thủ đang chơi không bình chọn):</div><div id="pollVoteBox">'+opts+'</div>',
      okLabel:'Để sau (xem trong menu)'
    });
    setTimeout(()=>{
      document.querySelectorAll('[data-poll-vote]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          if(isPlayerInActiveGame()) return;
          const idx = +btn.getAttribute('data-poll-vote');
          try{
            await fb.db.ref('admin/polls/'+p.id+'/votes/'+idx).transaction(c => (+c||0)+1);
            sessionStorage.setItem('poll_voted_'+p.id, '1');
            btn.parentNode.innerHTML = '<div class="coin-popup-hint">Đã gửi bình chọn. Xem lại trong menu BÌNH CHỌN.</div>';
            renderMenuPollBox();
          }catch(e){}
        });
      });
    }, 200);
  }catch(e){}
}
try{ setTimeout(listenSitePoll, 1600); }catch(e){}



/* ===== Trọng tài + đồng hồ nghĩ nước ===== */
let _clockTimer = null;
let _localClock = {
  red: 0, black: 0, paused: false, mins: 15,
  // Wall-clock: tránh reset khi đổi tab
  side: 'red',
  baseRemaining: 0,
  baseAt: 0,
  flagged: false
};
let _clockConfig = { lobby: false, online: true, tournament: true };
let _clockConfigLoaded = false;

function formatClock(sec){
  sec = Math.max(0, Math.floor(+sec||0));
  const m = Math.floor(sec/60), s = sec%60;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

async function loadClockConfig(){
  try{
    if(typeof fbAvailable==='function' && fbAvailable() && fb.db){
      const snap = await fb.db.ref('admin/clockConfig').once('value');
      const c = snap.val()||{};
      _clockConfig = {
        lobby: !!(c.lobby === true || c.lobby === 1 || c.lobby === '1'),
        online: c.online === false || c.online === 0 || c.online === '0' ? false : true,
        tournament: c.tournament === false || c.tournament === 0 || c.tournament === '0' ? false : true
      };
      _clockConfigLoaded = true;
    }
  }catch(e){}
  return _clockConfig;
}

function isTournamentRoomContext(){
  try{
    if(state.online && state.online.matchId) return true;
    if(state.online && state.online.tournamentId) return true;
    if(fb.room && (fb.room.matchId || fb.room.tournamentId || fb.room.mode === 'tournament')) return true;
  }catch(e){}
  return false;
}

function shouldShowBoardClock(){
  try{
    if(!state.online || !state.online.active){
      return !!_clockConfig.lobby;
    }
    if(isTournamentRoomContext()) return !!_clockConfig.tournament;
    return !!_clockConfig.online;
  }catch(e){ return true; }
}

function fullMoveSeconds(){
  if(_localClock.infinite) return Infinity;
  const m = +_localClock.mins;
  // mins là phút suy nghĩ mỗi nước (0 = vô hạn)
  if(!m || m < 0) return Infinity;
  return Math.max(1, Math.floor(m * 60));
}

function armClockSide(side, remainingSec){
  _localClock.side = side;
  const full = fullMoveSeconds();
  const rem = (remainingSec != null && isFinite(remainingSec)) ? remainingSec : full;
  _localClock.baseRemaining = _localClock.infinite ? Infinity : Math.max(0, Math.floor(+rem||0));
  _localClock.baseAt = Date.now();
  if(!_localClock.infinite){
    _localClock[side] = _localClock.baseRemaining;
  }
}

/** Mỗi lượt: reset đủ thời gian nghĩ; chỉ bên đang đi đếm ngược */
function resetClockForNewTurn(side){
  side = side || (state.turn === 'black' ? 'black' : 'red');
  const full = fullMoveSeconds();
  if(_localClock.infinite){
    _localClock.red = Infinity;
    _localClock.black = Infinity;
    _localClock.side = side;
    _localClock.baseRemaining = Infinity;
    _localClock.baseAt = Date.now();
    return;
  }
  // Cả hai về full; bên đang đi bắt đầu đếm
  _localClock.red = full;
  _localClock.black = full;
  armClockSide(side, full);
}

function readClockRemaining(side){
  side = side || (state.turn === 'black' ? 'black' : 'red');
  if(_localClock.infinite) return Infinity;
  const full = fullMoveSeconds();
  const turn = state.turn === 'black' ? 'black' : 'red';
  // Bên không đi: hiện đủ thời gian (đã reset sau nước trước)
  if(side !== turn){
    return full;
  }
  if(_localClock.paused || state.gameOver || _localClock.flagged){
    return Math.max(0, Math.floor(+_localClock[side]||0));
  }
  // Bên đang đi: đếm ngược wall-clock từ lúc bắt đầu lượt
  const elapsed = (Date.now() - (_localClock.baseAt||Date.now())) / 1000;
  const left = Math.max(0, (_localClock.baseRemaining||full) - elapsed);
  _localClock[side] = left;
  return left;
}

function syncClocksFromTurnChange(prevTurn, nextTurn){
  // Sau mỗi nước: reset thời gian cho lượt mới
  const next = nextTurn || state.turn;
  resetClockForNewTurn(next);
  try{ startClockTick(); }catch(e){}
  try{ renderClocks(); }catch(e){}
}

function ensureClockUI(){
  try{
    document.querySelectorAll('.river-side-clock, .game-clocks-bar').forEach(el=>{
      try{ el.remove(); }catch(e){}
    });
  }catch(e){}
  const oldBox = document.getElementById('gameClockBox');
  if(oldBox) oldBox.style.display = 'none';
  const oldWrap = document.getElementById('footerClocks');
  if(oldWrap) oldWrap.style.display = 'none';

  let topSlot = document.getElementById('clockTopSlot');
  let botSlot = document.getElementById('clockBottomSlot');
  if(!topSlot){
    topSlot = document.createElement('div');
    topSlot.id = 'clockTopSlot';
    topSlot.className = 'clock-slot top';
    const header = document.querySelector('.header');
    if(header) header.appendChild(topSlot);
    else document.body.insertBefore(topSlot, document.body.firstChild);
  }
  if(!botSlot){
    botSlot = document.createElement('div');
    botSlot.id = 'clockBottomSlot';
    botSlot.className = 'clock-slot bottom';
    const layout = document.querySelector('.layout');
    if(layout && layout.parentNode) layout.parentNode.insertBefore(botSlot, layout.nextSibling);
    else document.body.appendChild(botSlot);
  }

  if(!document.getElementById('clockRedEl')){
    const red = document.createElement('div');
    red.className = 'game-clock-pill red';
    red.id = 'clockRedEl';
    red.innerHTML = '<span class="game-clock-side-label">ĐỎ</span><span class="game-clock-time" id="clockRedText">05:00</span>';
    botSlot.appendChild(red);
  }
  if(!document.getElementById('clockBlackEl')){
    const black = document.createElement('div');
    black.className = 'game-clock-pill black';
    black.id = 'clockBlackEl';
    black.innerHTML = '<span class="game-clock-side-label">ĐEN</span><span class="game-clock-time" id="clockBlackText">05:00</span>';
    topSlot.appendChild(black);
  }
  return document.getElementById('clockRedEl');
}

function formatClockDisplay(sec){
  if(_localClock && _localClock.infinite) return '∞';
  if(sec == null || sec < 0 || !isFinite(sec)) return '∞';
  return formatClock(sec);
}

function placeClocksByOrientation(){
  const topSlot = document.getElementById('clockTopSlot');
  const botSlot = document.getElementById('clockBottomSlot');
  const redEl = document.getElementById('clockRedEl');
  const blackEl = document.getElementById('clockBlackEl');
  if(!topSlot || !botSlot || !redEl || !blackEl) return;
  const flipped = !!(typeof state !== 'undefined' && state.boardFlipped);
  // Không lật: đen trên, đỏ dưới · Lật: đỏ trên, đen dưới
  if(flipped){
    if(redEl.parentNode !== topSlot) topSlot.appendChild(redEl);
    if(blackEl.parentNode !== botSlot) botSlot.appendChild(blackEl);
  } else {
    if(blackEl.parentNode !== topSlot) topSlot.appendChild(blackEl);
    if(redEl.parentNode !== botSlot) botSlot.appendChild(redEl);
  }
}

function renderClocks(){
  ensureClockUI();
  const show = shouldShowBoardClock();
  const topSlot = document.getElementById('clockTopSlot');
  const botSlot = document.getElementById('clockBottomSlot');
  if(topSlot) topSlot.style.display = show ? 'flex' : 'none';
  if(botSlot) botSlot.style.display = show ? 'flex' : 'none';
  try{
    document.body.classList.toggle('clocks-on', !!show);
    document.body.classList.toggle('clocks-off', !show);
    const sub = document.getElementById('headerSub');
    const note = document.getElementById('footerNote');
    if(sub){
      if(show){ sub.style.display = 'none'; }
      else { sub.style.display = ''; sub.style.removeProperty('display'); }
    }
    if(note){
      if(show){ note.style.display = 'none'; }
      else { note.style.display = ''; note.style.removeProperty('display'); }
    }
  }catch(e){}
  if(!show) return;

  placeClocksByOrientation();

  const redSec = readClockRemaining('red');
  const blackSec = readClockRemaining('black');
  const re = document.getElementById('clockRedText');
  const be = document.getElementById('clockBlackText');
  if(re) re.textContent = formatClockDisplay(redSec);
  if(be) be.textContent = formatClockDisplay(blackSec);

  const redEl = document.getElementById('clockRedEl');
  const blackEl = document.getElementById('clockBlackEl');
  const redActive = state.turn === 'red' && !_localClock.paused && !state.gameOver;
  const blackActive = state.turn === 'black' && !_localClock.paused && !state.gameOver;
  if(redEl){
    redEl.classList.toggle('active', redActive);
    redEl.classList.toggle('idle', !redActive);
  }
  if(blackEl){
    blackEl.classList.toggle('active', blackActive);
    blackEl.classList.toggle('idle', !blackActive);
  }
}

function stopClockTick(){
  if(_clockTimer){ clearInterval(_clockTimer); _clockTimer = null; }
}

function startClockTick(){
  stopClockTick();
  if(!state.online || !state.online.active) return;
  if(state.gameOver || _localClock.flagged) return;
  if(_localClock.infinite){
    renderClocks();
    return; // không đếm ngược
  }
  // Arm side hiện tại nếu chưa
  if(!_localClock.baseAt){
    const side = state.turn === 'black' ? 'black' : 'red';
    armClockSide(side, fullMoveSeconds());
  }
  _clockTimer = setInterval(()=>{
    if(_localClock.paused || state.gameOver || _localClock.flagged || _localClock.infinite){
      renderClocks();
      return;
    }
    const side = state.turn === 'black' ? 'black' : 'red';
    const left = readClockRemaining(side);
    renderClocks();
    try{ updateBoardTimerRing(); }catch(e){}
    if(left <= 0){
      stopClockTick();
      onClockFlag(side);
    }
  }, 250);
  try{ updateBoardTimerRing(); }catch(e){}
  renderClocks();
}

async function onClockFlag(side){
  if(state.gameOver || _localClock.flagged) return;
  _localClock.flagged = true;
  state.gameOver = true;
  const winner = side === 'red' ? 'black' : 'red';
  const loserName = side === 'red' ? 'Đỏ' : 'Đen';
  const winnerName = winner === 'red' ? 'Đỏ' : 'Đen';
  try{ setFbStatus('Hết giờ — '+winnerName+' thắng.', true); }catch(e){}
  try{
    if(fb.roomRef){
      await fb.roomRef.update({
        gameOver: true,
        result: winner,
        paused: true,
        clockRed: Math.floor(_localClock.red||0),
        clockBlack: Math.floor(_localClock.black||0),
        version: (state.online.version||0)+1,
        referee: { action: 'flag', note: side+' hết giờ', ts: Date.now() }
      });
    }
  }catch(e){}
  try{
    if(typeof showEndModal==='function') showEndModal(winnerName+' thắng (đối thủ hết giờ)');
  }catch(e){}
  try{
    const myColor = state.online && state.online.color;
    let title, body, icon;
    if(state.online && state.online.spectator){
      icon = '⏱️'; title = 'Hết giờ';
      body = loserName+' hết thời gian suy nghĩ. <b>'+winnerName+'</b> thắng.';
    } else if(myColor === winner){
      icon = '🏆'; title = 'Bạn thắng!';
      body = 'Đối thủ ('+loserName+') đã <b>hết giờ</b>. Chúc mừng!';
    } else if(myColor === side){
      icon = '⏱️'; title = 'Bạn thua — hết giờ';
      body = 'Bạn đã hết thời gian suy nghĩ. <b>'+winnerName+'</b> thắng.';
    } else {
      icon = '⏱️'; title = 'Hết giờ';
      body = loserName+' hết giờ · <b>'+winnerName+'</b> thắng.';
    }
    if(typeof showCoinPopup==='function'){
      showCoinPopup({ icon, title, html:'<div class="coin-popup-hint">'+body+'</div>', okLabel:'Đóng' });
    }
  }catch(e){}
  try{ if(typeof sfxGameResult==='function') sfxGameResult(winner, false); }catch(e){}
  try{ if(typeof fireConfetti==='function' && state.online && state.online.color===winner) fireConfetti(); }catch(e){}
}

// Khi đổi tab: cộng dồn thời gian đã trôi, không reset
function onClockVisibility(){
  try{
    if(!state.online || !state.online.active || state.gameOver) return;
    if(document.hidden){
      // snapshot remaining trước khi tab ẩn
      const side = state.turn === 'black' ? 'black' : 'red';
      _localClock[side] = readClockRemaining(side);
      _localClock.baseRemaining = _localClock[side];
      _localClock.baseAt = Date.now();
      return;
    }
    // Tab hiện lại: tiếp tục từ remaining đã lưu (wall-clock)
    const side = state.turn === 'black' ? 'black' : 'red';
    armClockSide(side, _localClock[side]);
    renderClocks();
    if(!_localClock.paused && !state.gameOver) startClockTick();
  }catch(e){}
}
try{
  document.addEventListener('visibilitychange', onClockVisibility);
}catch(e){}

function updateBoardTimerRing(){
  try{
    const host = document.getElementById('boardWrap') || document.querySelector('.board-wrap');
    if(host){
      host.classList.remove('timer-running','timer-turn-red','timer-turn-black');
      host.querySelectorAll('.board-timer-ring').forEach(el=>{ try{ el.remove(); }catch(e){} });
    }
  }catch(e){}
}

function applyRefereeAndClock(data){
  if(!data) return;
  // Thời gian nghĩ mỗi nước
  if(data.timeControl != null) _localClock.mins = +data.timeControl;
  _localClock.infinite = (_localClock.mins === 0) || data.clockInfinite === true;
  if(typeof data.paused === 'boolean') _localClock.paused = data.paused;
  if(data.gameOver || data.result){ _localClock.flagged = true; }

  const turnSide = (data.turn || state.turn) === 'black' ? 'black' : 'red';
  if(_localClock.infinite){
    _localClock.red = Infinity;
    _localClock.black = Infinity;
  } else {
    const full = fullMoveSeconds();
    let left = full;
    if(data.clockTurnStartedAt && !data.paused && !data.gameOver){
      const elapsed = Math.max(0, (Date.now() - (+data.clockTurnStartedAt)) / 1000);
      left = Math.max(0, full - elapsed);
    }
    _localClock.red = full;
    _localClock.black = full;
    armClockSide(turnSide, left);
  }
  try{ if(!_localClock.paused && !state.gameOver) startClockTick(); renderClocks(); }catch(e){}

  const ref = data.referee;
  if(ref && ref.ts && ref.ts !== state.online._lastRefTs){
    state.online._lastRefTs = ref.ts;
    const act = ref.action;
    const myColor = state.online && state.online.color;
    if(act === 'pause'){
      _localClock.paused = true;
      try{ showRefLockPopup('pause', ref.note); }catch(e){}
      try{ setFbStatus('⏸ Trọng tài tạm dừng'+(ref.note?': '+ref.note:''), true); }catch(e){}
    }
    if(act === 'resume'){
      _localClock.paused = false;
      try{ hideRefLockPopup(); }catch(e){}
      try{ setFbStatus('▶ Trọng tài cho tiếp tục', false); }catch(e){}
      try{ resetClockForNewTurn(state.turn); startClockTick(); }catch(e){}
    }
    if(act === 'force_draw'){
      try{ if(typeof showEndModal==='function') showEndModal('Hòa (trọng tài)'); }catch(e){}
    }
    if(act === 'flag'){
      try{ onClockFlag(ref.note && String(ref.note).indexOf('black')>=0 ? 'black' : 'red'); }catch(e){}
    }
  }
}


function showRefLockPopup(mode, note){
  let ov = document.getElementById('refLockOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'refLockOverlay';
    ov.className = 'ref-lock-overlay';
    ov.innerHTML = '<div class="ref-lock-card"><div class="ref-lock-icon" id="refLockIcon">⏸</div>'
      + '<h2 class="ref-lock-title" id="refLockTitle"></h2><p class="ref-lock-msg" id="refLockMsg"></p></div>';
    document.body.appendChild(ov);
  }
  ov.dataset.mode = mode || 'pause';
  const icon = document.getElementById('refLockIcon');
  const title = document.getElementById('refLockTitle');
  const msg = document.getElementById('refLockMsg');
  if(icon) icon.textContent = '⏸';
  if(title) title.textContent = 'Trọng tài tạm dừng trận đấu';
  if(msg) msg.textContent = (note && String(note).trim())
    ? String(note)
    : 'Trọng tài đang tạm dừng trận đấu. Không thể tắt thông báo này — vui lòng chờ lệnh Tiếp tục.';
  ov.style.display = 'flex';
  document.body.classList.add('ref-locked');
  // chặn click / ESC
  ov.onclick = (e)=>{ e.stopPropagation(); e.preventDefault(); };
}
function hideRefLockPopup(){
  const ov = document.getElementById('refLockOverlay');
  if(ov){ ov.style.display = 'none'; ov.dataset.mode = ''; }
  document.body.classList.remove('ref-locked');
}
function launchFireworks(){
  const layer = document.getElementById('refFxLayer') || (function(){
    const el = document.createElement('div');
    el.id = 'refFxLayer';
    el.className = 'ref-fx-layer';
    document.body.appendChild(el);
    return el;
  })();
  layer.innerHTML = '';
  layer.style.display = 'block';
  const colors = ['#e8c878','#ff6b6b','#4ecdc4','#ffe66d','#ff9ff3','#54a0ff','#5f27cd'];
  for(let i=0;i<48;i++){
    const p = document.createElement('span');
    p.className = 'ref-fx-particle';
    const angle = Math.random()*Math.PI*2;
    const dist = 80 + Math.random()*160;
    p.style.setProperty('--dx', Math.cos(angle)*dist+'px');
    p.style.setProperty('--dy', Math.sin(angle)*dist+'px');
    p.style.left = (50 + (Math.random()-0.5)*10)+'%';
    p.style.top = (40 + (Math.random()-0.5)*10)+'%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random()*0.25)+'s';
    layer.appendChild(p);
  }
  setTimeout(()=>{ layer.style.display = 'none'; layer.innerHTML = ''; }, 2800);
}
function showRefResultPopup(kind, note){
  // kind: win | lose | draw | red_win | black_win
  let title = '', html = '', icon = '🏁';
  if(kind === 'win'){
    icon = '🏆';
    title = 'Bạn đã thắng!';
    html = '<div class="coin-popup-hint">Chúc mừng — trọng tài xử bạn thắng.'+(note?'<br>'+note:'')+'</div>';
    launchFireworks();
  } else if(kind === 'lose'){
    icon = '💔';
    title = 'Bạn đã thua';
    html = '<div class="coin-popup-hint">Xin chia buồn — trọng tài xử bạn thua.'+(note?'<br>'+note:'')+'</div>';
  } else if(kind === 'draw'){
    icon = '🤝';
    title = 'Hòa nhau';
    html = '<div class="coin-popup-hint">Cả hai bên hòa do trọng tài.'+(note?'<br>'+note:'')+'</div>';
  } else if(kind === 'red_win'){
    icon = '🚩'; title = 'Đỏ thắng';
    html = '<div class="coin-popup-hint">Trọng tài xử Đỏ thắng.'+(note?'<br>'+note:'')+'</div>';
  } else if(kind === 'black_win'){
    icon = '🚩'; title = 'Đen thắng';
    html = '<div class="coin-popup-hint">Trọng tài xử Đen thắng.'+(note?'<br>'+note:'')+'</div>';
  }
  try{
    showCoinPopup({ icon, title, html, okLabel: 'Đóng' });
  }catch(e){
    try{ alert(title); }catch(err){}
  }
}


async function loadClientTimeConfig(){
  try{
    const raw = localStorage.getItem('cotuong_time_config');
    if(raw) window._timeConfig = Object.assign({friends:5,tournament:15}, JSON.parse(raw));
  }catch(e){ window._timeConfig = {friends:5,tournament:15}; }
  try{
    if(typeof fbAvailable==='function' && fbAvailable() && fb.db){
      await fbInit();
      const snap = await fb.db.ref('admin/timeConfig').once('value');
      const v = snap.val();
      if(v){
        window._timeConfig = {
          friends: Math.max(0, Math.min(20, +(v.friends != null ? v.friends : 5))),
          tournament: Math.max(0, Math.min(20, +(v.tournament != null ? v.tournament : 15)))
        };
        try{ localStorage.setItem('cotuong_time_config', JSON.stringify(window._timeConfig)); }catch(e){}
      }
    }
  }catch(e){}
}
try{ setTimeout(loadClientTimeConfig, 900); }catch(e){}


/* ===== Vòng sáng trắng quanh bàn đếm giờ ===== */
function ensureBoardTimerRing(){
  return document.getElementById('boardWrap') || document.querySelector('.board-wrap');
}
function updateBoardTimerRing(){
  try{
    const host = ensureBoardTimerRing();
    if(!host) return;
    // Xóa ring overlay cũ nếu còn (tránh che bàn)
    host.querySelectorAll('.board-timer-ring').forEach(el=>{ try{ el.remove(); }catch(e){} });
    const inGame = !!(state && state.online && state.online.active && !state.gameOver);
    host.classList.remove('timer-running','timer-turn-red','timer-turn-black');
    if(!inGame || (_localClock && _localClock.paused)) return;
    const mins = Math.max(1, Math.min(20, +(_localClock && _localClock.mins) || +(window._timeConfig && window._timeConfig.friends) || 5));
    host.style.setProperty('--timer-dur', (mins * 60) + 's');
    host.classList.add('timer-running');
    host.classList.add(state.turn === 'red' ? 'timer-turn-red' : 'timer-turn-black');
  }catch(e){}
}

// hook into clock tick
const _renderClocksOrig = typeof renderClocks === 'function' ? renderClocks : null;
if(_renderClocksOrig){
  // already defined renderClocks - patch by wrapping at end of startClockTick interval
}



/* ===== Chatbox sảnh — UI/tính năng giống float-chat phòng ===== */
let lobbyChatCollapsed = true;
let lobbyChatUnread = 0;
function setLobbyChatCollapsed(v){
  lobbyChatCollapsed = !!v;
  const box = document.getElementById('lobbyChatBox');
  const body = document.getElementById('lobbyChatBody');
  const btn = document.getElementById('lobbyChatToggle');
  if(box) box.classList.toggle('is-collapsed', lobbyChatCollapsed);
  if(body){
    body.style.display = '';
    body.classList.toggle('is-collapsed', lobbyChatCollapsed);
  }
  if(btn){
    btn.innerHTML = lobbyChatCollapsed ? '+' : '−';
    btn.setAttribute('title', lobbyChatCollapsed ? 'Mở chat' : 'Thu chat');
  }
  if(!lobbyChatCollapsed){
    lobbyChatUnread = 0;
    const badge = document.getElementById('lobbyChatUnread');
    if(badge){ badge.style.display = 'none'; badge.textContent = '0'; }
    // cuộn cuối khi mở
    requestAnimationFrame(()=>{
      const msgs = document.getElementById('lobbyChatMessages');
      if(msgs){ msgs.scrollTop = msgs.scrollHeight; }
    });
  }
  updateLobbyChatHeaderCount();
}
function updateLobbyChatHeaderCount(){
  try{
    const box = document.getElementById('lobbyChatMessages');
    const n = box ? box.querySelectorAll('.chat-msg').length : 0;
    const span = document.querySelector('#lobbyChatHeader > span');
    if(span) span.innerHTML = '<i class="fa-regular fa-comments"></i> Chat <b>Sảnh</b>'+(n?' · '+n+' tin':'');
  }catch(e){}
}

function lobbyRoleLabel(role, code){
  const r = String(role||'').toLowerCase();
  if(r==='superadmin' || r==='admin') return 'ADMIN';
  if(r==='referee' || r==='trongtai') return 'TRỌNG TÀI';
  if(code && String(code).toUpperCase().startsWith('XK')) return 'KỲ THỦ';
  if(r==='player' || r==='member') return 'KỲ THỦ';
  return r ? r.toUpperCase() : 'KỲ THỦ';
}

function isPlayerLoggedIn(){
  try{
    return !!(typeof playerSession !== 'undefined' && playerSession && playerSession.code);
  }catch(e){ return false; }
}
function updateLobbyChatVisibility(){
  const box = document.getElementById('lobbyChatBox');
  if(!box) return;
  const inRoom = !!(state && state.online && state.online.active);
  const logged = isPlayerLoggedIn();
  box.style.display = (!inRoom && logged) ? '' : 'none';
}
function lobbyChatName(){
  try{
    if(typeof playerSession !== 'undefined' && playerSession && playerSession.name)
      return playerSession.name;
  }catch(e){}
  return 'Khách';
}
function lobbyChatId(){
  try{
    if(typeof playerSession !== 'undefined' && playerSession && playerSession.id)
      return playerSession.id;
  }catch(e){}
  try{ return (fb.auth && fb.auth.currentUser && fb.auth.currentUser.uid) || 'guest'; }catch(e){}
  return 'guest';
}
function renderLobbyChatMessages(val){
  const box = document.getElementById('lobbyChatMessages');
  if(!box) return;
  const list = Object.keys(val||{}).map(k=>({id:k,...val[k]})).sort((a,b)=>(a.ts||0)-(b.ts||0)).slice(-100);
  box.innerHTML = '';
  if(!list.length){
    box.innerHTML = '<div class="sub" style="padding:8px;opacity:.7;">Chưa có tin nhắn. Hãy chào mọi người!</div>';
    return;
  }
  list.forEach(m=>{
    const role = m.role || 'player';
    const msg = {
      text: m.text || '',
      name: m.name || 'Khách',
      code: m.code || '',
      uid: m.uid || m.id || '',
      role: role,
      roleLabel: (typeof lobbyRoleLabel==='function') ? lobbyRoleLabel(role, m.code) : role,
      avatar: m.avatar || '',
      ts: m.ts || 0,
      flair: m.flair || '',
      verified: !!(m.verified || m.isVerified)
    };
    try{
      if(typeof buildChatMsgEl === 'function'){
        box.appendChild(buildChatMsgEl(msg));
      } else {
        const d = document.createElement('div');
        d.className = 'chat-msg';
        d.innerHTML = '<div class="chat-msg-head"><b>'+msg.name+'</b></div><div class="chat-msg-body">'+(msg.text||'').replace(/</g,'&lt;')+'</div>';
        box.appendChild(d);
      }
    }catch(e){}
  });
  // Tự cuộn tin mới nhất
  requestAnimationFrame(()=>{
    try{
      box.scrollTop = box.scrollHeight;
      const last = box.lastElementChild;
      if(last && last.scrollIntoView) last.scrollIntoView({ block:'end', behavior:'auto' });
    }catch(e){ box.scrollTop = box.scrollHeight; }
  });
}
async function listenLobbyChat(){
  try{
    if(typeof fbAvailable!=='function' || !fbAvailable()) return;
    if(window._lobbyChatBound) return;
    window._lobbyChatBound = true;
    try{
      if(typeof fbEnsureGuestAuth==='function') await fbEnsureGuestAuth();
      else if(typeof fbEnsureAuthOptional==='function') await fbEnsureAuthOptional();
    }catch(e){}
    let lastCount = 0;
    fb.db.ref('public/lobbyChat').limitToLast(100).on('value', snap=>{
      const val = snap.val()||{};
      const n = Object.keys(val).length;
      if(lobbyChatCollapsed && n > lastCount && lastCount > 0){
        lobbyChatUnread += (n - lastCount);
        // mention check on new msgs
        try{
          const myCode = (playerSession && playerSession.code) || '';
          const myName = (playerSession && playerSession.name) || '';
          const arr = Object.keys(val||{}).map(k=>val[k]).sort((a,b)=>(a.ts||0)-(b.ts||0));
          const fresh = arr.slice(-(n - lastCount));
          fresh.forEach(m=>{
            const text = String(m.text||'');
            if((myCode && text.toLowerCase().includes('@'+myCode.toLowerCase())) ||
               (myName && text.toLowerCase().includes('@'+myName.toLowerCase()))){
              lobbyChatUnread = Math.max(lobbyChatUnread, 1);
              const badge = document.getElementById('lobbyChatUnread');
              if(badge){ badge.style.display=''; badge.textContent = '📣 '+(lobbyChatUnread>99?'99+':lobbyChatUnread); }
            }
          });
        }catch(e){}
        const badge = document.getElementById('lobbyChatUnread');
        if(badge){
          badge.style.display = '';
          if(!badge.textContent.startsWith('📣'))
            badge.textContent = lobbyChatUnread > 99 ? '99+' : String(lobbyChatUnread);
        }
      }
      lastCount = n;
      renderLobbyChatMessages(val);
      // header count
      try{
        const hdr = document.querySelector('#lobbyChatHeader span');
        if(hdr && !lobbyChatCollapsed){
          /* keep title */
        }
      }catch(e){}
    });
  }catch(e){ console.warn('lobbyChat', e); }
}
async function sendLobbyChat(){
  const input = document.getElementById('lobbyChatInput');
  const text = (input && input.value || '').trim();
  if(!text) return;
  if(!isPlayerLoggedIn()){
    try{ showCoinPopup({ warn:true, icon:'🔒', title:'Cần đăng nhập', html:'<div class="coin-popup-hint">Chỉ kỳ thủ đã đăng nhập mới chat được ở sảnh.</div>', okLabel:'Đóng' }); }catch(e){ alert('Cần đăng nhập kỳ thủ.'); }
    return;
  }
  if(isLobbyChatBannedLocally()){
    try{ showCoinPopup({ warn:true, icon:'🚫', title:'Bị cấm chat sảnh', html:'<div class="coin-popup-hint">Tài khoản của bạn đã bị cấm chat ở sảnh.</div>', okLabel:'Đóng' }); }catch(e){ alert('Bạn đã bị cấm chat sảnh.'); }
    return;
  }
  try{
    if(typeof fbAvailable!=='function' || !fbAvailable()) return;
    try{
      if(typeof fbEnsureAuthOptional==='function') await fbEnsureAuthOptional();
    }catch(e){}
    let role = (playerSession && playerSession.role) || 'player';
    try{
      const adm = typeof getAdminSessionMeta === 'function' ? getAdminSessionMeta() : null;
      if(adm && adm.ok) role = adm.via === 'superadmin' ? 'superadmin' : 'admin';
    }catch(e){}
    let verified = !!(playerSession && (playerSession.verified || playerSession.isVerified));
    try{
      if(!verified && playerSession && playerSession.id && fb.db){
        const ps = await fb.db.ref('players/'+playerSession.id+'/verified').once('value');
        verified = !!ps.val();
      }
    }catch(e){}
    const meta = {
      text: text.slice(0, 200),
      name: lobbyChatName(),
      uid: lobbyChatId(),
      code: (playerSession && playerSession.code) || '',
      avatar: (playerSession && playerSession.avatar) || '',
      role: role,
      verified: verified,
      ts: Date.now()
    };
    await fb.db.ref('public/lobbyChat').push(meta);
    if(input) input.value = '';
  }catch(e){ alert('Không gửi được: '+(e.message||e)); }
}
document.getElementById('lobbyChatToggle')?.addEventListener('click', (e)=>{
  e.preventDefault();
  setLobbyChatCollapsed(!lobbyChatCollapsed);
});
document.getElementById('lobbyChatSendBtn')?.addEventListener('click', sendLobbyChat);
document.getElementById('lobbyChatInput')?.addEventListener('keydown', e=>{
  if(e.key==='Enter'){ e.preventDefault(); sendLobbyChat(); }
});
try{ setTimeout(listenLobbyChat, 1200); }catch(e){}
try{ setInterval(updateLobbyChatVisibility, 1500); }catch(e){}
try{ setTimeout(updateLobbyChatVisibility, 500); }catch(e){}
try{ setTimeout(()=> setLobbyChatCollapsed(true), 600); }catch(e){}


try{
  document.addEventListener('DOMContentLoaded', ()=>{
    const d = document.getElementById('drawer');
    if(d && typeof applyDrawerShellStyles==='function') applyDrawerShellStyles(d, d.classList.contains('open'));
  });
}catch(e){}

/* ===== Cấm chat sảnh ===== */
let lobbyChatBans = {};
async function loadLobbyChatBans(){
  lobbyChatBans = {};
  try{
    if(typeof fbAvailable!=='function' || !fbAvailable() || !fb.db) return;
    const snap = await fb.db.ref('admin/lobbyChatBans').once('value');
    lobbyChatBans = snap.val() || {};
  }catch(e){}
  updateLobbyChatBanBarVisibility();
}
function isLobbyChatBannedLocally(){
  try{
    const code = (playerSession && playerSession.code) ? String(playerSession.code).toUpperCase() : '';
    if(code && lobbyChatBans[code]) return true;
  }catch(e){}
  return false;
}
function updateLobbyChatBanBarVisibility(){
  const bar = document.getElementById('lobbyChatBanBar');
  if(!bar) return;
  bar.style.display = canModerateChat() ? 'flex' : 'none';
}
async function banLobbyChatTarget(target){
  target = String(target||'').trim().toUpperCase();
  if(!target) return;
  try{
    await fb.db.ref('admin/lobbyChatBans/'+target).set({ by: (playerSession&&playerSession.code)||'admin', ts: Date.now() });
    await loadLobbyChatBans();
  }catch(e){ alert(e.message||e); }
}
async function unbanLobbyChatTarget(target){
  target = String(target||'').trim().toUpperCase();
  if(!target) return;
  try{
    await fb.db.ref('admin/lobbyChatBans/'+target).remove();
    await loadLobbyChatBans();
  }catch(e){ alert(e.message||e); }
}
document.getElementById('lobbyChatBanBtn')?.addEventListener('click', ()=>{
  banLobbyChatTarget(document.getElementById('lobbyChatBanTarget')?.value);
  const el = document.getElementById('lobbyChatBanTarget'); if(el) el.value='';
});
document.getElementById('lobbyChatUnbanBtn')?.addEventListener('click', ()=>{
  unbanLobbyChatTarget(document.getElementById('lobbyChatBanTarget')?.value);
  const el = document.getElementById('lobbyChatBanTarget'); if(el) el.value='';
});
try{ setTimeout(loadLobbyChatBans, 1400); }catch(e){}
try{
  setTimeout(()=>{
    if(typeof fbAvailable==='function' && fbAvailable() && fb.db){
      fb.db.ref('admin/lobbyChatBans').on('value', snap=>{
        lobbyChatBans = snap.val() || {};
        updateLobbyChatBanBarVisibility();
      });
    }
  }, 1600);
}catch(e){}

try{ setTimeout(ensureVerifiedCache, 1500); }catch(e){}

try{ setTimeout(function(){ loadClockConfig().then(function(){ try{ renderClocks(); }catch(e){} }); }, 1200); }catch(e){}

try{ if(!document.body.classList.contains('clocks-on')) document.body.classList.add('clocks-off'); }catch(e){}




/* ===== EVENT COUNTDOWN UI (menu) v2 ===== */
window._eventCountdown = window._eventCountdown || {
  enabled: false,
  target: '',
  title: 'SỰ KIỆN',
  countdownLabel: 'Đếm ngược đến sự kiện',
  welcomeLabel: 'Chào mừng đến sự kiện'
};
let _ecTimer = null;
let _ecFbBound = false;

function ecIsEnabled(c){
  c = c || window._eventCountdown || {};
  return c.enabled === true || c.enabled === 1 || c.enabled === '1' || c.enabled === 'true';
}

async function loadClientEventCountdown(){
  try{
    const raw = localStorage.getItem('cotuong_event_countdown');
    if(raw){
      const p = JSON.parse(raw);
      if(p && typeof p === 'object') window._eventCountdown = Object.assign({}, window._eventCountdown, p);
    }
  }catch(e){}
  try{
    if(typeof fbAvailable==='function' && fbAvailable()){
      if(typeof fbInit==='function') await fbInit();
      if(fb.db){
        const snap = await fb.db.ref('admin/eventCountdown').once('value');
        const v = snap.val();
        if(v && typeof v === 'object'){
          window._eventCountdown = Object.assign({}, window._eventCountdown, v);
          try{ localStorage.setItem('cotuong_event_countdown', JSON.stringify(window._eventCountdown)); }catch(e){}
        }
        if(!_ecFbBound){
          _ecFbBound = true;
          fb.db.ref('admin/eventCountdown').on('value', snap2=>{
            const v2 = snap2.val();
            if(v2 && typeof v2 === 'object'){
              window._eventCountdown = Object.assign({}, window._eventCountdown, v2);
              try{ localStorage.setItem('cotuong_event_countdown', JSON.stringify(window._eventCountdown)); }catch(e){}
              applyEventCountdownUI();
            }
          });
        }
      }
    }
  }catch(e){ console.warn('loadClientEventCountdown', e); }
  applyEventCountdownUI();
}

function applyEventCountdownUI(){
  const wrap = document.getElementById('eventCountdownWrap');
  if(!wrap) return;
  const c = window._eventCountdown || {};
  const on = ecIsEnabled(c) && !!c.target;
  if(!on){
    wrap.style.display = 'none';
    if(_ecTimer){ clearInterval(_ecTimer); _ecTimer = null; }
    return;
  }
  wrap.style.display = 'block';
  const title = document.getElementById('ecTitle');
  if(title) title.textContent = String(c.title || 'SỰ KIỆN').toUpperCase();
  tickEventCountdown();
  if(_ecTimer) clearInterval(_ecTimer);
  _ecTimer = setInterval(tickEventCountdown, 1000);
}

function tickEventCountdown(){
  const c = window._eventCountdown || {};
  const target = c.target ? new Date(c.target).getTime() : NaN;
  const footer = document.getElementById('ecFooter');
  const daysEl = document.getElementById('ecDays');
  const hoursEl = document.getElementById('ecHours');
  const minsEl = document.getElementById('ecMins');
  const secsEl = document.getElementById('ecSecs');
  if(!daysEl) return;
  const now = Date.now();
  if(isNaN(target)){
    daysEl.textContent = '—';
    if(hoursEl) hoursEl.textContent = '—';
    if(minsEl) minsEl.textContent = '—';
    if(secsEl) secsEl.textContent = '—';
    if(footer) footer.textContent = c.countdownLabel || '';
    return;
  }
  let diff = target - now;
  if(diff <= 0){
    daysEl.textContent = '0';
    if(hoursEl) hoursEl.textContent = '00';
    if(minsEl) minsEl.textContent = '00';
    if(secsEl) secsEl.textContent = '00';
    if(footer) footer.textContent = c.welcomeLabel || 'Chào mừng đến sự kiện';
    return;
  }
  const sec = Math.floor(diff / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  const pad = n => String(n).padStart(2,'0');
  daysEl.textContent = String(days);
  if(hoursEl) hoursEl.textContent = pad(hours);
  if(minsEl) minsEl.textContent = pad(mins);
  if(secsEl) secsEl.textContent = pad(secs);
  if(footer) footer.textContent = c.countdownLabel || 'Đếm ngược đến sự kiện';
}

// boot + mở menu thì refresh
try{
  setTimeout(loadClientEventCountdown, 600);
  setTimeout(loadClientEventCountdown, 2500);
  document.addEventListener('click', function(ev){
    const t = ev.target;
    if(!t) return;
    if(t.id === 'menuFab' || (t.closest && t.closest('#menuFab'))){
      setTimeout(function(){ try{ applyEventCountdownUI(); loadClientEventCountdown(); }catch(e){} }, 50);
    }
  }, true);
}catch(e){}
