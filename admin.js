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
    if(tabRow) tabRow.style.display = '';
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
  if(!code) return; if(!(await appConfirm('Xóa phòng «'+code+'»?', 'Xóa phòng'))) return;
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
  if(!code) return; if(!(await appConfirm('Xóa ván lưu «'+code+'»?', 'Xóa ván'))) return;
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
  if(!(await appConfirm('XÓA TẤT CẢ phòng online? Không hoàn tác được.', 'Nguy hiểm'))) return;
  if(!(await appConfirm('Xác nhận lần cuối: xóa toàn bộ rooms/?', 'Xác nhận'))) return;
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
  if(!(await appConfirm('XÓA TẤT CẢ ván đã lưu? Không hoàn tác được.', 'Nguy hiểm'))) return;
  if(!(await appConfirm('Xác nhận lần cuối: xóa toàn bộ saves/?', 'Xác nhận'))) return;
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

function closeAdminMobileNav(){
  const ov = document.getElementById('adminOverlay');
  const body = document.querySelector('#adminOverlay .admin-body');
  if(ov) ov.classList.remove('admin-nav-open');
  if(body) body.classList.remove('admin-nav-open');
  document.body.classList.remove('admin-nav-open');
}
function openAdminMobileNav(){
  const ov = document.getElementById('adminOverlay');
  const body = document.querySelector('#adminOverlay .admin-body');
  if(ov) ov.classList.add('admin-nav-open');
  if(body) body.classList.add('admin-nav-open');
  document.body.classList.add('admin-nav-open');
}
function toggleAdminNav(){
  const ov = document.getElementById('adminOverlay');
  if(!ov) return;
  if(ov.classList.contains('admin-nav-open')) closeAdminMobileNav();
  else openAdminMobileNav();
}

function switchAdminSection(sec){
  document.querySelectorAll('.admin-nav-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.section === sec);
  });
  document.querySelectorAll('.admin-section').forEach(p=>{
    p.classList.toggle('active', p.id === 'adminSec-'+sec);
  });
  try{ closeAdminMobileNav(); }catch(e){}
  if(sec === 'dashboard') adminLoadData();
  if(sec === 'tournament') renderTournamentList();
  if(sec === 'players'){ fillTournamentSelects(); renderPlayerList(); }
  if(sec === 'bracket'){ fillTournamentSelects(); renderBracketList(); }
  if(sec === 'diagram'){ fillTournamentSelects(); fillDiagramSelects(); loadSlotsFromTournament(); renderAdminBracketTree(); }
  if(sec === 'quickmatch'){ renderQuickMatchSlots(); }
  if(sec === 'referee') renderRefLog();
  if(sec === 'format'){ fillTournamentSelects(); renderGroups(); }
  if(sec === 'live') renderLiveMonitor();
  if(sec === 'broadcast'){ loadLiveLinksAdmin(); renderPollResults(); }
  if(sec === 'chats'){ try{ adminLoadLobbyChat(); adminLoadLobbyBans(); }catch(e){} }
  if(sec === 'system'){ try{ renderVerifyPlayerList(); }catch(e){} }
  if(sec === 'quickmatch'){ loadTimeConfig(); }
  if(sec === 'announce'){ renderAnnounceLog(); }
  if(sec === 'system') adminLoadData();
}

function fillTournamentSelects(){
  const opts = Object.values(tcData.tournaments).map(t=>
    `<option value="${t.id}">${t.name} (${t.code})</option>`
  ).join('');
  ['playerTournament','bracketTournament','groupTournament','diagramTournament'].forEach(id=>{
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
  const val = (id, fallback='')=>{ const el = document.getElementById(id); return el ? (el.value||fallback) : fallback; };
  const name = (val('tourName')||'').trim();
  if(!name){ setAdminStatus('Nhập tên giải đấu.', 'err'); return; }
  let code = (val('tourCode')||'').trim().toUpperCase() || randomCode(6,'T');
  if(Object.values(tcData.tournaments||{}).some(t=>t.code===code)){
    setAdminStatus('Mã giải đã tồn tại.', 'err'); return;
  }
  const id = 'tn_'+Date.now().toString(36);
  const row = {
    id, code, name,
    start: val('tourStart') || '',
    end: val('tourEnd') || '',
    format: val('tourFormat', 'single') || 'single',
    maxPlayers: Math.min(128, Math.max(2, +val('tourMaxPlayers', '32') || 32)),
    timeControl: Math.min(180, Math.max(1, +val('tourTimeControl', '15') || 15)),
    status: val('tourStatus', 'open') || 'open',
    desc: (val('tourDesc')||'').trim(),
    createdAt: Date.now()
  };
  try{
    await tcSet('tournaments/'+id, row);
    tcData.tournaments[id] = row;
    const _set=(id,v)=>{ const e=document.getElementById(id); if(e) e.value=v; };
    _set('tourName',''); _set('tourCode',''); _set('tourDesc','');
    setAdminStatus('Đã tạo giải «'+name+'» ('+code+') trên Firebase.', 'ok');
    renderTournamentList();
    fillTournamentSelects();
    updateDashboardStats();
  }catch(err){
    setAdminStatus('Tạo giải thất bại: '+(err.message||err), 'err');
  }
}

async function deleteTournament(id){
  if(!(await appConfirm('Xóa giải đấu này và các trận liên quan trên Firebase?', 'Xóa giải'))) return;
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
    if(!(await appConfirm('Xóa Admin chính «'+(p.code||id)+'»?', 'Xóa'))) return;
  } else if(!(await appConfirm('Xóa kỳ thủ này trên Firebase?', 'Xóa kỳ thủ'))) return;
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
    mod: 'MODERATOR',
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

function roleBadgeHtml(role, extraClass){
  const r = role || 'player';
  const cls = 'role-badge '+(extraClass||r);
  return '<span class="'+cls+'">'+roleLabel(r)+'</span>';
}

function memberBadgeHtml(session){
  if(!session) return '';
  const tier = session.memberTier || session.badge || '';
  const role = session.role || 'player';
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

function seRoundCount(size){
  let r = 0, s = size;
  while(s > 1){ s >>= 1; r++; }
  return r;
}
function playerNameById(pid){
  if(!pid) return 'TBD';
  const p = tcData.players && tcData.players[pid];
  return p ? (p.name || p.code || pid) : pid;
}

/** Single-elim đầy đủ 2–32: mọi vòng + nextMatch + optional tranh hạng 3 */
async function generateBracket(){
  const tnId = document.getElementById('bracketTournament').value;
  if(!tnId || !tcData.tournaments[tnId]){ setAdminStatus('Chọn giải đấu.', 'err'); return; }
  const players = Object.values(tcData.players).filter(p=>p.tournamentId===tnId);
  if(players.length < 2){ setAdminStatus('Cần ít nhất 2 kỳ thủ trong giải.', 'err'); return; }
  if(players.length > 32){ setAdminStatus('Tối đa 32 kỳ thủ cho sơ đồ này.', 'err'); return; }
  try{
    const oldIds = Object.keys(tcData.matches).filter(mid => {
      const m = tcData.matches[mid];
      return m.tournamentId===tnId && (!m.kind || m.kind==='se' || m.kind==='se_3rd');
    });
    await Promise.all(oldIds.map(mid => tcRemove('matches/'+mid)));
    oldIds.forEach(mid => delete tcData.matches[mid]);

    const seeded = players.slice().sort((a,b)=> (b.elo||0)-(a.elo||0));
    const n = seeded.length;
    let size = 1; while(size < n) size *= 2;
    if(size > 32) size = 32;
    const slots = [];
    for(let i=0;i<size;i++) slots.push(seeded[i] || null);
    const tables = +document.getElementById('bracketTables')?.value || 8;
    const rounds = seRoundCount(size);
    const writes = [];
    const byRound = {};

    for(let r=1;r<=rounds;r++){
      const count = size >> r;
      byRound[r] = [];
      for(let i=0;i<count;i++){
        const mid = 'se_'+tnId+'_r'+r+'_'+i;
        const row = {
          id: mid, tournamentId: tnId, kind: 'se', bracket: 'main',
          round: r, index: i,
          red: null, black: null, redName: 'TBD', blackName: 'TBD',
          redScore: null, blackScore: null,
          roomCode: '', status: 'pending', winner: null,
          table: (i % tables) + 1,
          nextMatchId: null, nextSlot: null
        };
        if(r < rounds){
          row.nextMatchId = 'se_'+tnId+'_r'+(r+1)+'_'+Math.floor(i/2);
          row.nextSlot = (i % 2 === 0) ? 'red' : 'black';
        }
        byRound[r].push(row);
        tcData.matches[mid] = row;
      }
    }

    // Seed vòng 1
    for(let i=0;i<size/2;i++){
      const a = slots[i], b = slots[size-1-i];
      const row = byRound[1][i];
      row.red = a ? a.id : null;
      row.black = b ? b.id : null;
      row.redName = a ? a.name : 'BYE';
      row.blackName = b ? b.name : 'BYE';
      if(!a || !b){
        row.status = 'finished';
        row.winner = !a ? (b ? b.id : null) : (a ? a.id : null);
        if(row.winner === row.red){ row.redScore = 1; row.blackScore = 0; }
        else if(row.winner === row.black){ row.redScore = 0; row.blackScore = 1; }
      }
    }

    Object.values(byRound).flat().forEach(row => writes.push(tcSet('matches/'+row.id, row)));
    await Promise.all(writes);
    await tcUpdate('tournaments/'+tnId, { format: 'single_elim', bracketSize: size });

    let advanced = 0;
    for(const row of byRound[1]){
      if(row.status==='finished' && row.winner){
        if(await advanceTournamentMatch(row.id, row.winner, { silent:true })) advanced++;
      }
    }

    setAdminStatus('Sơ đồ SE: '+n+' kỳ thủ · bracket '+size+' · '+rounds+' vòng'+(advanced?' · auto-BYE '+advanced:''), 'ok');
    try{ renderBracketList(); }catch(e){}
    try{ renderAdminBracketTree(); }catch(e){}
    updateDashboardStats();
  }catch(err){
    setAdminStatus('Sinh nhánh thất bại: '+(err.message||err), 'err');
  }
}

async function advanceTournamentMatch(matchId, winnerId, opts){
  opts = opts || {};
  const m = tcData.matches[matchId];
  if(!m || !winnerId) return false;
  if(m.red && m.black && winnerId !== m.red && winnerId !== m.black) return false;
  m.status = 'finished';
  m.winner = winnerId;
  if(m.redScore == null && m.blackScore == null){
    if(winnerId === m.red){ m.redScore = 1; m.blackScore = 0; }
    else { m.redScore = 0; m.blackScore = 1; }
  }
  const loserId = (m.red === winnerId) ? m.black : m.red;
  await tcUpdate('matches/'+m.id, {
    status: 'finished', winner: winnerId,
    redScore: m.redScore, blackScore: m.blackScore
  });

  if(m.nextMatchId && m.nextSlot){
    const next = tcData.matches[m.nextMatchId];
    if(next){
      const patch = {};
      if(m.nextSlot === 'red'){
        next.red = winnerId; next.redName = playerNameById(winnerId);
        patch.red = next.red; patch.redName = next.redName;
      } else {
        next.black = winnerId; next.blackName = playerNameById(winnerId);
        patch.black = next.black; patch.blackName = next.blackName;
      }
      await tcUpdate('matches/'+next.id, patch);
      if(next.status !== 'finished'){
        const onlyRed = next.red && (!next.black || next.blackName === 'BYE');
        const onlyBlack = next.black && (!next.red || next.redName === 'BYE');
        if(onlyRed || onlyBlack){
          const autoW = onlyRed ? next.red : next.black;
          next.status = 'finished'; next.winner = autoW;
          await tcUpdate('matches/'+next.id, { status:'finished', winner: autoW });
          await advanceTournamentMatch(next.id, autoW, { silent:true });
        }
      }
    }
  }
  // Người thua → tranh hạng 3
  if(loserId && m.loserNextMatchId && m.loserNextSlot){
    const lm = tcData.matches[m.loserNextMatchId];
    if(lm){
      const patch = {};
      if(m.loserNextSlot === 'red'){
        lm.red = loserId; lm.redName = playerNameById(loserId);
        patch.red = lm.red; patch.redName = lm.redName;
      } else {
        lm.black = loserId; lm.blackName = playerNameById(loserId);
        patch.black = lm.black; patch.blackName = lm.blackName;
      }
      await tcUpdate('matches/'+lm.id, patch);
    }
  }
  if(!opts.silent){
    try{ renderBracketList(); }catch(e){}
    try{ renderAdminBracketTree(); }catch(e){}
    try{ updateDashboardStats(); }catch(e){}
  } else {
    try{ renderAdminBracketTree(); }catch(e){}
  }
  return true;
}

async function settleMatchWinner(matchId, winnerSide){
  const m = tcData.matches[matchId];
  if(!m){ setAdminStatus('Không tìm thấy trận.', 'err'); return false; }
  let winnerId = null;
  if(winnerSide === 'red') winnerId = m.red;
  else if(winnerSide === 'black') winnerId = m.black;
  else if(winnerSide === 'draw'){
    m.status = 'finished'; m.winner = null;
    await tcUpdate('matches/'+m.id, { status:'finished', winner: null });
    setAdminStatus('Trận hòa — không advance.', 'ok');
    return true;
  } else winnerId = winnerSide;
  if(!winnerId){ setAdminStatus('Không xác định người thắng.', 'err'); return false; }
  await advanceTournamentMatch(matchId, winnerId);
  setAdminStatus('Đã chuyển nhánh: '+playerNameById(winnerId), 'ok');
  return true;
}

async function clearBracket(){
  const tnId = document.getElementById('bracketTournament').value;
  if(!tnId) return;
  if(!(await appConfirm('Xóa toàn bộ nhánh của giải này trên Firebase?', 'Xóa nhánh'))) return;
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
          ' · <span class="side-red">'+(m.redName && m.redName!=='TBD' ? m.redName : (typeof playerNameById==='function'?playerNameById(m.red):m.red)||'TBD')+'</span> vs <span class="side-black">'+(m.blackName && m.blackName!=='TBD' ? m.blackName : (typeof playerNameById==='function'?playerNameById(m.black):m.black)||'TBD')+'</span>'+
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

  const labels = {
    pause:'Tạm dừng ván', resume:'Tiếp tục', force_draw:'Hòa bắt buộc',
    red_win:'Đỏ thắng (xử)', black_win:'Đen thắng (xử)', reset:'Reset bàn', message:'Gửi thông báo'
  };
  if(!labels[action]){ setAdminStatus('Lệnh không hợp lệ.', 'err'); return; }

  let roomCode = target;
  const match = (tcData.matches && (tcData.matches[target] || Object.values(tcData.matches).find(m=>
    m.id===target || (m.roomCode||'').toUpperCase()===target
  ))) || null;
  if(match && match.roomCode) roomCode = String(match.roomCode).toUpperCase();

  try{
    await adminEnsureFb();
    const ref = fb.db.ref('rooms/'+roomCode);
    const snap = await ref.once('value');
    const data = snap.val();
    if(!data){ setAdminStatus('Không tìm thấy phòng '+roomCode, 'err'); return; }

    const nextVer = (+data.version || 0) + 1;
    const payload = {
      referee: { action, note, ts: Date.now(), by: 'admin' },
      version: nextVer
    };

    if(action === 'pause'){
      payload.paused = true;
      // đóng băng clock
      if(data.clockRed != null) payload.clockRed = data.clockRed;
      if(data.clockBlack != null) payload.clockBlack = data.clockBlack;
    }
    if(action === 'resume'){
      payload.paused = false;
      payload.clockTurnStartedAt = Date.now();
    }
    if(action === 'force_draw'){
      payload.gameOver = true;
      payload.result = 'draw';
      payload.paused = true;
    }
    if(action === 'red_win'){
      payload.gameOver = true;
      payload.result = 'red';
      payload.paused = true;
    }
    if(action === 'black_win'){
      payload.gameOver = true;
      payload.result = 'black';
      payload.paused = true;
    }
    if(action === 'reset'){
      let boardJSON;
      try{
        boardJSON = JSON.stringify(typeof boardToPlain==='function' && typeof initialBoard==='function'
          ? boardToPlain(initialBoard()) : []);
      }catch(e){ boardJSON = data.boardJSON; }
      payload.boardJSON = boardJSON;
      payload.turn = 'red';
      payload.lastMoveJSON = 'null';
      payload.gameOver = false;
      payload.result = null;
      payload.paused = false;
      const mins = +data.timeControl || 15;
      payload.clockRed = mins * 60;
      payload.clockBlack = mins * 60;
      payload.clockTurnStartedAt = Date.now();
    }

    if(action === 'message'){
      await ref.child('chat').push({
        color: 'system',
        name: 'Trọng tài',
        text: '[TRỌNG TÀI] ' + (note || 'Thông báo từ trọng tài'),
        ts: Date.now()
      });
      // vẫn bump version để client biết
      await ref.update({
        version: nextVer,
        referee: { action:'message', note, ts: Date.now(), by:'admin' }
      });
    } else {
      await ref.update(payload);
    }

    if(match){
      if(action==='red_win'){ try{ await settleMatchWinner(match.id, 'red'); }catch(e){ console.warn(e); } }
      else if(action==='black_win'){ try{ await settleMatchWinner(match.id, 'black'); }catch(e){ console.warn(e); } }
      else if(action==='force_draw'){ try{ await settleMatchWinner(match.id, 'draw'); }catch(e){ console.warn(e); } }
      else if(action==='resume' || action==='pause'){
        match.status = action==='pause' ? 'paused' : 'playing';
        try{ await tcUpdate('matches/'+match.id, { status: match.status }); }catch(e){}
      }
      else if(action==='reset'){
        try{ await tcUpdate('matches/'+match.id, { status: 'playing', winner: null }); }catch(e){}
      }
    }

    try{ await refLog(action, roomCode, note); }catch(e){}
    setAdminStatus('✓ '+labels[action]+' → phòng '+roomCode+(note?' ('+note+')':''), 'ok');
  }catch(err){
    setAdminStatus('Lệnh thất bại: '+(err.message||err), 'err');
  }
}

function renderRefLog(){
  const box = document.getElementById('refLogList');
  if(!box) return;
  if(!tcData.refLog || !tcData.refLog.length){
    box.innerHTML = '<div class="admin-empty">Chưa có lệnh nào.</div>';
    return;
  }
  const labels = {
    pause:'Tạm dừng', resume:'Tiếp tục', force_draw:'Hòa bắt buộc',
    red_win:'Đỏ thắng', black_win:'Đen thắng', reset:'Reset bàn', message:'Thông báo', flag:'Hết giờ'
  };
  box.innerHTML = tcData.refLog.slice(0,50).map(e=>{
    const key = e._key || '';
    const act = labels[e.action] || e.action;
    return '<div class="admin-item">'
      + '<div class="admin-item-main"><div class="admin-item-code">'+act+'</div>'
      + '<div class="admin-item-meta">'+formatTime(e.ts)+' · '+(e.target||'')+(e.note?' · '+e.note:'')+'</div></div>'
      + (key ? '<div class="admin-item-actions"><button type="button" class="action-btn" data-ref-del="'+key+'"><i class="fa-regular fa-trash"></i> Xóa</button></div>' : '')
      + '</div>';
  }).join('');
  box.querySelectorAll('[data-ref-del]').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteRefLogEntry(btn.getAttribute('data-ref-del')));
  });
}
async function deleteRefLogEntry(key){
  if(!key) return;
  if(!(await appConfirm('Xóa dòng nhật ký này?', 'Xóa nhật ký'))) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/refLog/'+key).remove();
    tcData.refLog = (tcData.refLog||[]).filter(e => e._key !== key);
    renderRefLog();
    setAdminStatus('Đã xóa nhật ký.', 'ok');
  }catch(e){ setAdminStatus('Xóa thất bại: '+(e.message||e), 'err'); }
}
async function clearAllRefLog(){
  if(!(await appConfirm('Xóa toàn bộ nhật ký trọng tài?', 'Xóa hết'))) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/refLog').remove();
    tcData.refLog = [];
    renderRefLog();
    setAdminStatus('Đã xóa hết nhật ký.', 'ok');
  }catch(e){ setAdminStatus('Xóa hết thất bại: '+(e.message||e), 'err'); }
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
  if(!(await appConfirm('Xóa toàn bộ GIẢI ĐẤU + trận + bảng + log? Kỳ thủ được giữ lại.', 'Nguy hiểm'))) return;
  if(!(await appConfirm('Xác nhận lần cuối — không hoàn tác?', 'Xác nhận'))) return;
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
document.getElementById('adminNavToggle')?.addEventListener('click', (e)=>{ e.stopPropagation(); toggleAdminNav(); });
document.getElementById('adminNavBackdrop')?.addEventListener('click', closeAdminMobileNav);

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
const PLAYER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const WEEKLY_CODE_MS = 7 * 24 * 60 * 60 * 1000;
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
        playerSession = null;
        try{ localStorage.removeItem(PLAYER_SESSION_KEY); sessionStorage.removeItem(PLAYER_SESSION_KEY); }catch(e){}
      }
    }
  }catch(e){ playerSession = null; }
  renderPlayerSessionUI();
  try{ if(typeof updateLobbyChatVisibility==='function') updateLobbyChatVisibility(); }catch(e){}
  try{ refreshPlayerVerifiedFlag(); }catch(e){}
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
  try{ if(typeof updateLobbyChatVisibility==='function') updateLobbyChatVisibility(); }catch(e){}
  try{ refreshPlayerVerifiedFlag(); }catch(e){}
  if(s && s.code) try{ claimPlayerPresence(); }catch(e){}
  else try{ releasePlayerPresence(); claimGuestPresence(); }catch(e){}
}
async function refreshPlayerVerifiedFlag(){
  try{
    if(!playerSession || !playerSession.id || !fb.db) return;
    const snap = await fb.db.ref('players/'+playerSession.id+'/verified').once('value');
    playerSession.verified = !!snap.val();
    try{ savePlayerSession(playerSession); }catch(e){}
  }catch(e){}
}
let _lastShownCoins = null;
function updatePlayerSessionCoins(){
  let coins = 0;
  try{
    if(typeof coinState !== 'undefined' && coinState)
      coins = Math.max(0, Math.floor(+coinState.coins||0));
  }catch(e){}
  if(_lastShownCoins === coins) return;
  _lastShownCoins = coins;
  const coinEl = document.getElementById('psMetaCoin');
  if(coinEl && coinEl.textContent !== String(coins))
    coinEl.textContent = String(coins);
  const bal = document.getElementById('coinBalance');
  if(bal && bal.textContent !== String(coins))
    bal.textContent = String(coins);
}
let _rpsRaf = 0;
function renderPlayerSessionUI(){
  // Debounce 1 frame — tránh gọi liên tục gây giật mobile
  if(_rpsRaf) return;
  _rpsRaf = requestAnimationFrame(function(){
    _rpsRaf = 0;
    try{ _renderPlayerSessionUINow(); }catch(e){}
  });
}
function _renderPlayerSessionUINow(){
  const idle = document.getElementById('playerLoginIdle');
  const active = document.getElementById('playerLoginActive');
  const tabRow = document.getElementById('authTabRow');
  if(!idle || !active) return;
  if(playerSession && playerSession.code){
    if(idle.style.display !== 'none') idle.style.display = 'none';
    if(active.style.display === 'none' || active.getAttribute('style')==='' || !active.style.display)
      active.style.display = '';
    if(tabRow && tabRow.style.display !== 'none') tabRow.style.display = 'none';

    const nameEl = document.getElementById('playerSessionName');
    const metaEl = document.getElementById('playerSessionMeta');
    const name = String(playerSession.name || playerSession.code || '');
    const badge = typeof memberBadgeHtml === 'function' ? memberBadgeHtml(playerSession) : '';
    const nameSig = name+'|'+badge;
    if(nameEl && nameEl.dataset.sig !== nameSig){
      nameEl.dataset.sig = nameSig;
      nameEl.innerHTML = '<span class="player-session-name-text"></span> ';
      const nt = nameEl.querySelector('.player-session-name-text');
      if(nt) nt.textContent = name;
      if(badge) nameEl.insertAdjacentHTML('beforeend', badge);
    }

    if(metaEl){
      const code = String(playerSession.code||'');
      const tn = playerSession.tnCode ? String(playerSession.tnCode) : '';
      const clan = playerSession.clanName ? String(playerSession.clanName) : '';
      const structSig = code+'|'+tn+'|'+clan;
      if(metaEl.dataset.structSig !== structSig){
        metaEl.dataset.structSig = structSig;
        if(!metaEl.classList.contains('player-meta-stack')) metaEl.className = 'player-meta-stack';
        metaEl.innerHTML =
          '<div class="player-meta-chip" data-meta="id"><span class="player-meta-label"><i class="fa-regular fa-id-card"></i> ID</span><span class="player-meta-val" id="psMetaId"></span></div>'+
          '<div class="player-meta-chip" data-meta="coin"><span class="player-meta-label"><i class="fa-solid fa-coins"></i> Coin</span><span class="player-meta-val" id="psMetaCoin"></span></div>'+
          '<div class="player-meta-chip" data-meta="tn" id="psMetaTnChip" style="display:none;"><span class="player-meta-label"><i class="fa-regular fa-trophy"></i> Giải</span><span class="player-meta-val" id="psMetaTn"></span></div>'+
          '<div class="player-meta-chip" data-meta="clan" id="psMetaClanChip" style="display:none;"><span class="player-meta-label"><i class="fa-regular fa-people-group"></i> Clan</span><span class="player-meta-val" id="psMetaClan"></span></div>';
        const idEl = document.getElementById('psMetaId');
        if(idEl) idEl.textContent = code || '—';
        const tnEl = document.getElementById('psMetaTn');
        const tnChip = document.getElementById('psMetaTnChip');
        if(tn){ if(tnChip) tnChip.style.display = ''; if(tnEl) tnEl.textContent = tn; }
        else if(tnChip) tnChip.style.display = 'none';
        const clanEl = document.getElementById('psMetaClan');
        const clanChip = document.getElementById('psMetaClanChip');
        if(clan){ if(clanChip) clanChip.style.display = ''; if(clanEl) clanEl.textContent = clan; }
        else if(clanChip) clanChip.style.display = 'none';
        // sau rebuild: cho phép coin update lại
        try{ _lastShownCoins = null; }catch(e){}
      }
      try{ updatePlayerSessionCoins(); }catch(e){}
    }

  } else {
    if(idle.style.display === 'none') idle.style.display = '';
    if(active.style.display !== 'none') active.style.display = 'none';
    if(tabRow) tabRow.style.display = '';
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
    const emailsToTry = [];
    if(looksLikeEmail){
      emailsToTry.push(rawId.toLowerCase());
    } else {
      emailsToTry.push(playerAuthEmail(pidGuess));
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

      setSt(looksLikeEmail
        ? 'Sai email/mật khẩu, hoặc email này chỉ là liên hệ - hãy thử đăng nhập bằng mã ID (vd. XK0001).'
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

    const syntheticEmail = playerAuthEmail(code);
    let finalEmail = syntheticEmail;

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
  if(playerSession && playerSession.code){
    accessGatePassed = true;
    return claimPlayerPresence();
  }
  try{
    // Bắt buộc có Firebase auth (anon) để đếm khách
    let user = null;
    try{
      if(typeof fbEnsureGuestAuth === 'function') user = await fbEnsureGuestAuth();
      else user = await fbEnsureAuthOptional();
    }catch(e){ console.warn(e); }
    if(!user || !user.uid){
      // Thử lại signInAnonymously trực tiếp
      try{
        await new Promise(r=>setTimeout(r, 500));
        if(typeof fbInit === 'function') await fbInit();
        if(fb.auth && !fb.auth.currentUser){
          const cred = await fb.auth.signInAnonymously();
          user = (cred && cred.user) || fb.auth.currentUser;
        } else {
          user = fb.auth && fb.auth.currentUser;
        }
      }catch(e){ console.warn('guest auth retry', e); }
    }
    if(!user || !user.uid){
      accessGatePassed = false;
      try{
        await showAccessBlockedPopup(0, 0, 'Không tạo được phiên khách (Anonymous). Kiểm tra Firebase Auth + cấu hình apiKey, hoặc đăng nhập kỳ thủ.');
      }catch(e){}
      return false;
    }
    const cfg = await loadAccessConfig();
    const maxG = Math.min(100, Math.max(1, +(cfg.maxGuests||50)));
    const guestsSnap = await fb.db.ref('presence/guests').once('value');
    const guests = guestsSnap.val() || {};
    const now = Date.now();
    const LIVE_MS = 120000; // 2 phút không heartbeat = offline
    // Dọn ghost + chỉ đếm guest còn heartbeat gần đây (BẮT BUỘC có ts)
    let liveCount = 0;
    const staleRemoves = [];
    Object.keys(guests).forEach(k=>{
      const g = guests[k];
      const ts = (g && g.ts) ? +g.ts : 0;
      if(!ts || (now - ts) > LIVE_MS){
        staleRemoves.push(k);
        return;
      }
      if(k !== user.uid) liveCount++;
    });
    // xóa ghost (không await tuần tự quá lâu)
    staleRemoves.slice(0, 30).forEach(k=>{
      try{ fb.db.ref('presence/guests/'+k).remove(); }catch(e){}
    });
    if(guests[user.uid]){
      accessGatePassed = true;
      try{ hideAccessBlockedPopup(); }catch(e){}
      accessPresenceRef = fb.db.ref('presence/guests/'+user.uid);
      accessPresenceRef.onDisconnect().remove();
      await accessPresenceRef.set({ ts: now, uid: user.uid, online:true });
      // heartbeat
      try{
        clearInterval(window._guestPresenceTimer);
        window._guestPresenceTimer = setInterval(()=>{
          try{ accessPresenceRef && accessPresenceRef.update({ ts: Date.now(), online:true }); }catch(e){}
        }, 20000);
      }catch(e){}
      return true;
    }
    if(liveCount >= maxG){
      accessGatePassed = false;
      await showAccessBlockedPopup(maxG, liveCount);
      return false;
    }
    accessPresenceRef = fb.db.ref('presence/guests/'+user.uid);
    accessPresenceRef.onDisconnect().remove();
    await accessPresenceRef.set({ ts: now, uid: user.uid, online:true });
    accessGatePassed = true;
    try{ hideAccessBlockedPopup(); }catch(e){}
    try{
      clearInterval(window._guestPresenceTimer);
      window._guestPresenceTimer = setInterval(()=>{
        try{ accessPresenceRef && accessPresenceRef.update({ ts: Date.now(), online:true }); }catch(e){}
      }, 20000);
    }catch(e){}
    return true;
  }catch(err){
    console.warn('claimGuestPresence', err);
    // Fail-open: lỗi tạm thời không chặn vào web
    accessGatePassed = true;
    try{ hideAccessBlockedPopup(); }catch(e){}
    return true;
  }
}

async function claimPlayerPresence(){
  if(!playerSession || !playerSession.id) return;
  try{
    const user = await fbEnsureAuthOptional();
    if(!user) return;
    try{ hideAccessBlockedPopup(); }catch(e){}
    if(fb.uid){
      try{ await fb.db.ref('presence/guests/'+fb.uid).remove(); }catch(e){}
    }
    const pref = fb.db.ref('presence/players/'+playerSession.id);
    pref.onDisconnect().remove();
    await pref.set({
      ts: Date.now(),
      online: true,
      code: playerSession.code || '',
      name: playerSession.name || '',
      role: playerSession.role || 'player'
    });
    accessGatePassed = true;
    try{ if(typeof listenForceJoin === 'function'){ _forceJoinBound = false; listenForceJoin(); } }catch(e){}
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

function escapeHtmlAccess(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function livePlatformIcon(p){
  p = (p||'').toLowerCase();
  if(p==='facebook') return '<i class="fa-brands fa-facebook" style="color:#1877f2"></i>';
  if(p==='tiktok') return '<i class="fa-brands fa-tiktok"></i>';
  if(p==='youtube') return '<i class="fa-brands fa-youtube" style="color:#ff0000"></i>';
  return '<i class="fa-regular fa-link"></i>';
}
function normalizeLiveLinks(v){
  if(!v) return [];
  let arr = [];
  if(Array.isArray(v)) arr = v.slice();
  else if(typeof v==='object') arr = Object.keys(v).sort().map(k=>v[k]);
  return arr.filter(x=>x && typeof x==='object' && (x.url||x.link)).map(x=>({
    platform: String(x.platform||'youtube').toLowerCase(),
    url: String(x.url||x.link||'').trim(),
    label: String(x.label||x.platform||'Live').trim() || 'Live'
  })).filter(x=>x.url);
}
/** Đọc Firebase trước, localStorage chỉ là fallback */
async function fetchLiveLinksFromFirebase(){
  if(typeof fbAvailable!=='function' || !fbAvailable() || !fb.db) return [];
  // lấy path có NHIỀU link nhất (tránh cache path cũ chỉ 1 link)
  let best = [];
  for(const path of ['public/liveLinks', 'config/liveLinks', 'admin/liveLinks']){
    try{
      const snap = await fb.db.ref(path).once('value');
      const list = normalizeLiveLinks(snap.val());
      if(list.length > best.length) best = list;
    }catch(e){}
  }
  return best;
}
async function loadLiveLinksForBlock(forceRefresh){
  if(!forceRefresh && window._liveLinksCache && window._liveLinksCache.length > 1){
    return window._liveLinksCache.slice();
  }
  // 1) Firebase (ưu tiên)
  try{
    const remote = await fetchLiveLinksFromFirebase();
    if(remote.length){
      window._liveLinksCache = remote;
      try{ localStorage.setItem('cotuong_live_links', JSON.stringify(remote)); }catch(e){}
      if(typeof tcData!=='undefined') tcData.liveLinks = remote.slice();
      return remote.slice();
    }
  }catch(e){}
  // 2) localStorage fallback
  try{
    const raw = localStorage.getItem('cotuong_live_links');
    if(raw){
      const parsed = normalizeLiveLinks(JSON.parse(raw));
      if(parsed.length){
        window._liveLinksCache = parsed;
        return parsed.slice();
      }
    }
  }catch(e){}
  // 3) RAM cache cũ
  if(window._liveLinksCache && window._liveLinksCache.length){
    return window._liveLinksCache.slice();
  }
  if(typeof tcData!=='undefined' && tcData.liveLinks){
    return normalizeLiveLinks(tcData.liveLinks);
  }
  return [];
}
async function prefetchLiveLinks(){
  try{
    const list = await loadLiveLinksForBlock(true);
    if(list && list.length) window._liveLinksCache = list;
  }catch(e){}
}
try{ setTimeout(prefetchLiveLinks, 600); setTimeout(prefetchLiveLinks, 2500); }catch(e){}

/* ACCESS_BLOCK_GUARD */
async function showAccessBlockedPopup(max, current, reasonMsg){
  accessGatePassed = false;
  let ov = document.getElementById('accessBlockOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'accessBlockOverlay';
    ov.className = 'access-block-overlay';
    ov.innerHTML = '<div class="access-block-card"><div class="access-block-icon">🚫</div><h2 class="access-block-title">Web đang đầy</h2><div class="access-block-body" id="accessBlockBody"></div></div>';
    document.body.appendChild(ov);
  }
  let body = document.getElementById('accessBlockBody') || ov.querySelector('.access-block-body');
  if(!body) return;
  // Đóng mọi coin popup cũ nếu còn mở
  try{
    document.querySelectorAll('.coin-popup-overlay, .modal-overlay.show').forEach(el=>{
      if(el.id === 'accessBlockOverlay') return;
      // chỉ đóng popup coin
      if(el.classList.contains('coin-popup-overlay')) el.remove();
    });
  }catch(e){}

  // Luôn fetch lại từ Firebase khi mở popup (tránh cache 1 link cũ)
  let links = [];
  try{ links = await loadLiveLinksForBlock(true); }catch(e){ links = []; }
  if(!links || !links.length){
    try{
      const raw = localStorage.getItem('cotuong_live_links');
      if(raw) links = normalizeLiveLinks(JSON.parse(raw));
    }catch(e){}
  }
  let html = '';
  if(reasonMsg){
    html += '<p class="access-block-msg">'+escapeHtmlAccess(reasonMsg)+'</p>';
  } else {
    html += '<p class="access-block-msg">Đã đến giới hạn khách (<b>'+escapeHtmlAccess(current)+'</b>/<b>'+escapeHtmlAccess(max)+'</b>).</p>';
  }
  if(links && links.length){
    html += '<p class="access-block-msg">Xem trực tiếp trên các kênh:</p><div class="access-live-list">';
    links.forEach((L, idx)=>{
      const url = L.url || L.link || '';
      const label = L.label || L.platform || ('Link '+(idx+1));
      const plat = (L.platform||'').toLowerCase();
      html += '<div class="access-live-row">'
        + '<span class="access-live-icon">'+livePlatformIcon(plat)+'</span>'
        + '<a class="access-live-url" href="'+escapeHtmlAccess(url)+'" target="_blank" rel="noopener">'+escapeHtmlAccess(label)+'</a>'
        + '<button type="button" class="access-copy-btn" data-copy="'+escapeHtmlAccess(url)+'"><i class="fa-regular fa-copy"></i></button>'
        + '</div>';
    });
    html += '</div>';
  } else if(!reasonMsg){
    html += '<p class="access-block-msg strong">Đã đến giới hạn vào web, xin vui lòng quay lại sau.</p>';
  } else {
    html += '<p class="access-block-msg strong">Xin vui lòng quay lại sau hoặc đăng nhập kỳ thủ (nếu được cấp).</p>';
  }
  body.innerHTML = html;
  const title = ov.querySelector('.access-block-title');
  if(title) title.textContent = reasonMsg ? 'Không vào được' : 'Web đang đầy';
  body.querySelectorAll('[data-copy]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const u = btn.getAttribute('data-copy')||'';
      try{ await navigator.clipboard.writeText(u); btn.innerHTML = '<i class="fa-regular fa-check"></i>'; }
      catch(e){ try{ prompt('Copy link:', u); }catch(err){} }
    });
  });
  ov.style.display = 'flex';
  document.body.classList.add('access-locked');
  ov.onclick = (e)=>{ e.stopPropagation(); };
  // Chặn phím ESC / back
  if(!window._accessBlockKeyGuard){
    window._accessBlockKeyGuard = true;
    document.addEventListener('keydown', function(e){
      if(!document.body.classList.contains('access-locked')) return;
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
}
function hideAccessBlockedPopup(){
  const ov = document.getElementById('accessBlockOverlay');
  if(ov) ov.style.display = 'none';
  document.body.classList.remove('access-locked');
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
    const gVal = gSnap.val()||{};
    const now = Date.now();
    const guests = Object.keys(gVal).filter(k=>{
      const ts = gVal[k] && gVal[k].ts ? +gVal[k].ts : 0;
      return ts && (now - ts) < 120000;
    }).length;
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
  try{ closeDrawer(); }catch(e){}
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
        // Cộng vào cheatBonus — cùng pool với mua lượt (hiển thị trong «còn lại»)
        coinState.cheatBonus = Math.max(0, +(coinState.cheatBonus||0)) + Math.max(0, +(r.amount||0));
        lines.push('⚡ +'+(r.amount||0)+' lượt gian lận (còn '+((Math.max(0, 20 - Math.max(0,+(coinState.cheatUsed||0))) + Math.max(0,+(coinState.cheatBonus||0))))+')');
        try{ if(typeof refreshCheatUsesUI==='function') refreshCheatUsesUI(); }catch(e){}
        try{ if(typeof saveCoinStateToPlayer==='function') saveCoinStateToPlayer(); }catch(e){}
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
  vip:     { days:[30,90,180,365,0],    price:[800,3000], bonus:[150,800] }
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
  if(_vipEditId) return;
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
  if(!(await appConfirm('Xóa tin nhắn này trong phòng «'+code+'»?', 'Xóa tin'))) return;
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
  if(!(await appConfirm('XÓA TOÀN BỘ chat phòng «'+code+'»?', 'Xóa chat'))) return;
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

/* ===== Sơ đồ + Đấu nhanh + Public bracket ===== */


/* ===== Bracket slot editor (2–32) ===== */
let diagramSlots = []; // [{id,code,name,avatar}|null]
let diagramPickIndex = -1;

function diagramSize(){
  return Math.max(2, Math.min(32, +document.getElementById('diagramBracketSize')?.value || 8));
}
function diagramSetStatus(t, err){
  const el = document.getElementById('diagramSlotStatus');
  if(el){ el.textContent = t||''; el.style.color = err ? '#e88' : ''; }
}
function ensureDiagramSlots(){
  const size = diagramSize();
  if(!Array.isArray(diagramSlots)) diagramSlots = [];
  while(diagramSlots.length < size) diagramSlots.push(null);
  if(diagramSlots.length > size) diagramSlots = diagramSlots.slice(0, size);
}
function renderDiagramSlots(){
  ensureDiagramSlots();
  const box = document.getElementById('diagramSlotGrid');
  if(!box) return;
  const size = diagramSlots.length;
  box.innerHTML = diagramSlots.map((p, i)=>{
    if(p){
      const av = p.avatar
        ? ((/^https?:\/\//i.test(p.avatar)||String(p.avatar).startsWith('data:')) ? p.avatar : ('https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/photo/'+p.avatar))
        : '';
      return '<div class="dslot filled" data-slot="'+i+'">'
        + '<span class="dslot-seed">#'+(i+1)+'</span>'
        + (av ? '<img class="dslot-av" src="'+av+'" alt="">' : '<span class="dslot-av ph">👤</span>')
        + '<span class="dslot-name">'+(p.name||p.code||p.id)+'</span>'
        + '<button type="button" class="dslot-x" data-clear="'+i+'" title="Xóa">×</button>'
        + '</div>';
    }
    return '<button type="button" class="dslot empty" data-slot="'+i+'">'
      + '<span class="dslot-seed">#'+(i+1)+'</span>'
      + '<span class="dslot-plus">+</span>'
      + '<span class="dslot-hint">Thêm kỳ thủ</span>'
      + '</button>';
  }).join('');
  box.querySelectorAll('.dslot.empty').forEach(btn=>{
    btn.addEventListener('click', ()=> openDiagramPick(+btn.getAttribute('data-slot')));
  });
  box.querySelectorAll('.dslot.filled').forEach(el=>{
    el.addEventListener('click', (e)=>{
      if(e.target.closest('[data-clear]')) return;
      openDiagramPick(+el.getAttribute('data-slot'));
    });
  });
  box.querySelectorAll('[data-clear]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      diagramSlots[+btn.getAttribute('data-clear')] = null;
      renderDiagramSlots();
    });
  });
}

function openDiagramPick(index){
  diagramPickIndex = index;
  const ov = document.getElementById('diagramPickOverlay');
  const meta = document.getElementById('diagramPickMeta');
  const search = document.getElementById('diagramPickSearch');
  if(meta) meta.textContent = 'Ô seed #'+(index+1);
  if(search) search.value = '';
  renderDiagramPickList();
  if(ov) ov.classList.add('show');
}
function closeDiagramPick(){
  const ov = document.getElementById('diagramPickOverlay');
  if(ov){
    ov.classList.remove('show');
    ov.style.display = 'none';
    ov.dataset.mode = '';
  }
  diagramPickIndex = -1;
  qmPickIndex = -1;
}
function renderDiagramPickList(){
  const box = document.getElementById('diagramPickList');
  if(!box) return;
  const tnId = document.getElementById('diagramTournament')?.value;
  const q = (document.getElementById('diagramPickSearch')?.value || '').trim().toLowerCase();
  let list = Object.values(tcData.players || {});
  if(tnId) list = list.filter(p => p.tournamentId === tnId);
  if(q) list = list.filter(p =>
    (p.name||'').toLowerCase().includes(q) ||
    (p.code||'').toLowerCase().includes(q) ||
    (p.id||'').toLowerCase().includes(q)
  );
  const used = new Set(diagramSlots.filter(Boolean).map(p=>p.id));
  if(!list.length){
    box.innerHTML = '<div class="admin-empty">Không có kỳ thủ'+(tnId?' trong giải này':'')+'. Hãy thêm ở tab Kỳ thủ.</div>';
    return;
  }
  box.innerHTML = list.map(p=>{
    const busy = used.has(p.id) ? ' disabled' : '';
    return '<button type="button" class="admin-item dslot-pick'+busy+'" data-pid="'+p.id+'" '+(busy?'disabled':'')+'>'
      + '<div class="admin-item-main"><b>'+(p.name||p.code)+'</b>'
      + '<div class="admin-item-meta">ID '+(p.code||p.id)+(p.elo!=null?' · ELO '+p.elo:'')+(used.has(p.id)?' · đã chọn':'')+'</div></div></button>';
  }).join('');
  box.querySelectorAll('.dslot-pick:not([disabled])').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const p = (tcData.players || {})[btn.getAttribute('data-pid')];
      if(!p || diagramPickIndex < 0) return;
      diagramSlots[diagramPickIndex] = { id:p.id, code:p.code, name:p.name, avatar:p.avatar||'' };
      renderDiagramSlots();
      closeDiagramPick();
    });
  });
}

/** Tạo bracket từ các ô đã chọn (thứ tự seed) */
async function buildBracketFromSlots(){
  const tnId = document.getElementById('diagramTournament')?.value;
  if(!tnId || !tcData.tournaments[tnId]){ diagramSetStatus('Chọn giải đấu trước.', true); return; }
  ensureDiagramSlots();
  const filled = diagramSlots.filter(Boolean);
  if(filled.length < 2){ diagramSetStatus('Cần ít nhất 2 kỳ thủ trong các ô.', true); return; }
  const size = diagramSlots.length;
  try{
    const oldIds = Object.keys(tcData.matches||{}).filter(mid => {
      const m = tcData.matches[mid];
      return m && m.tournamentId===tnId && (!m.kind || m.kind==='se' || m.kind==='se_3rd');
    });
    await Promise.all(oldIds.map(mid => tcRemove('matches/'+mid)));
    oldIds.forEach(mid => delete tcData.matches[mid]);

    const slots = diagramSlots.map(p => p || null);
    const tables = +document.getElementById('bracketTables')?.value || 8;
    const rounds = seRoundCount(size);
    const writes = [];
    const byRound = {};

    for(let r=1;r<=rounds;r++){
      const count = size >> r;
      byRound[r] = [];
      for(let i=0;i<count;i++){
        const mid = 'se_'+tnId+'_r'+r+'_'+i;
        const row = {
          id: mid, tournamentId: tnId, kind: 'se', bracket: 'main',
          round: r, index: i,
          red: null, black: null, redName: 'TBD', blackName: 'TBD',
          redScore: null, blackScore: null,
          roomCode: '', status: 'pending', winner: null,
          table: (i % tables) + 1,
          nextMatchId: null, nextSlot: null
        };
        if(r < rounds){
          row.nextMatchId = 'se_'+tnId+'_r'+(r+1)+'_'+Math.floor(i/2);
          row.nextSlot = (i % 2 === 0) ? 'red' : 'black';
        }
        byRound[r].push(row);
        tcData.matches[mid] = row;
      }
    }

    // Gán kỳ thủ vào vòng 1 theo seed (cặp 0 vs 1, 2 vs 3, ...)
    const r1 = byRound[1] || [];
    for(let i=0;i<r1.length;i++){
      const a = slots[i*2] || null;
      const b = slots[i*2+1] || null;
      const row = r1[i];
      row.red = a ? a.id : null;
      row.black = b ? b.id : null;
      row.redName = a ? (a.name || a.code || a.id) : 'BYE';
      row.blackName = b ? (b.name || b.code || b.id) : 'BYE';
      if(!a && !b){
        row.status = 'finished';
      } else if(!a && b){
        row.status = 'finished'; row.winner = b.id;
      } else if(a && !b){
        row.status = 'finished'; row.winner = a.id;
      } else {
        row.status = 'pending';
      }
    }

    // Ghi toàn bộ trận lên Firebase
    Object.keys(byRound).forEach(r=>{
      (byRound[r]||[]).forEach(row=>{
        writes.push(tcSet('matches/'+row.id, row));
      });
    });
    await Promise.all(writes);
    await tcUpdate('tournaments/'+tnId, {
      format:'single_elim',
      bracketSize:size,
      slotSeed: diagramSlots.map(p=>p&&p.id),
      updatedAt: Date.now()
    });

    let advanced = 0;
    for(const row of (byRound[1]||[])){
      if(row.status==='finished' && row.winner){
        try{
          if(await advanceTournamentMatch(row.id, row.winner, { silent:true })) advanced++;
        }catch(e){}
      }
    }

    diagramSetStatus('Đã tạo bracket '+size+' · '+filled.length+' kỳ thủ · '+rounds+' vòng'+(advanced?' · BYE '+advanced:'')+'.');
    renderAdminBracketTree();
    try{ renderBracketList(); }catch(e){}
    updateDashboardStats();
  }catch(err){
    console.error(err);
    diagramSetStatus('Lỗi: '+(err.message||err), true);
  }
}

function loadSlotsFromTournament(){
  const tnId = document.getElementById('diagramTournament')?.value;
  const size = diagramSize();
  diagramSlots = Array(size).fill(null);
  if(!tnId){ renderDiagramSlots(); return; }
  const tn = tcData.tournaments && tcData.tournaments[tnId];
  // Prefer saved seed
  if(tn && Array.isArray(tn.slotSeed) && tn.slotSeed.length){
    tn.slotSeed.slice(0, size).forEach((pid, i)=>{
      const p = pid && tcData.players && tcData.players[pid];
      if(p) diagramSlots[i] = { id:p.id, code:p.code, name:p.name, avatar:p.avatar||'' };
    });
  } else {
    // Auto-fill by ELO
    const players = Object.values(tcData.players||{})
      .filter(p=>p.tournamentId===tnId)
      .sort((a,b)=>(b.elo||0)-(a.elo||0))
      .slice(0, size);
    players.forEach((p,i)=>{
      diagramSlots[i] = { id:p.id, code:p.code, name:p.name, avatar:p.avatar||'' };
    });
  }
  renderDiagramSlots();
  renderAdminBracketTree();
}

function fillDiagramSelects(){
  const list = Object.values(tcData.tournaments || {});
  const opts = list.map(t => `<option value="${t.id}">${t.name} (${t.code})</option>`).join('');
  const el = document.getElementById('diagramTournament');
  if(el){
    const cur = el.value;
    el.innerHTML = '<option value="">— Chọn giải —</option>' + opts;
    if(cur) el.value = cur;
  }
}

function buildBracketTreeHtml(tnId, matchesObj){
  matchesObj = matchesObj || (tcData && tcData.matches) || {};
  if(!tnId) return '<div class="admin-empty">Chọn giải đấu.</div>';
  const all = Object.values(matchesObj).filter(m => m && m.tournamentId === tnId);
  const se = all.filter(m => !m.kind || m.kind === 'se');
  const third = all.find(m => m.kind === 'se_3rd');
  if(!se.length && !third) return '<div class="admin-empty">Chưa có nhánh — vào Admin → Sơ đồ để xếp kỳ thủ và sinh nhánh.</div>';

  const byRound = {};
  se.forEach(m=>{
    const r = m.round || 1;
    (byRound[r] = byRound[r] || []).push(m);
  });
  Object.keys(byRound).forEach(r=>{
    byRound[r].sort((a,b)=>(a.index||0)-(b.index||0));
  });
  const rounds = Object.keys(byRound).map(Number).sort((a,b)=>a-b);
  if(!rounds.length && third){
    // only third? unlikely
  }
  const maxRound = rounds.length ? Math.max.apply(null, rounds) : 1;
  const roundLabel = (r, total)=>{
    const left = total - r + 1;
    if(left === 1) return 'Chung kết';
    if(left === 2) return 'Bán kết';
    if(left === 3) return 'Tứ kết';
    return 'Vòng '+r;
  };

  function lineHtml(m, side){
    const id = side === 'red' ? m.red : m.black;
    let name = side === 'red' ? (m.redName || '') : (m.blackName || '');
    if(!name || name === 'TBD' || name === 'undefined' || name === 'null'){
      if(id && tcData && tcData.players && tcData.players[id]){
        const p = tcData.players[id];
        name = p.name || p.code || id;
      } else if(id && typeof playerNameById === 'function'){
        name = playerNameById(id);
      } else if(id){
        name = String(id);
      } else {
        name = 'TBD';
      }
    }
    const score = side === 'red' ? m.redScore : m.blackScore;
    const isW = m.winner && id && m.winner === id;
    const isL = m.winner && id && m.winner !== id;
    const cls = 'bv-line' + (isW ? ' win' : '') + (isL ? ' lose' : '');
    const sc = (score != null && score !== '') ? String(score) : (m.status==='finished' && isW ? '1' : (m.status==='finished' && isL ? '0' : ''));
    return '<div class="'+cls+'"><span class="bv-name">'+escHtml(name)+'</span><span class="bv-score">'+escHtml(sc)+'</span></div>';
  }
  function escHtml(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function matchCard(m, extraClass){
    const st = m.status === 'finished' ? 'done' : (m.status === 'playing' ? 'live' : 'wait');
    return '<div class="bv-match '+st+' '+(extraClass||'')+'" data-mid="'+escHtml(m.id)+'">'
      + '<div class="bv-match-id">#'+escHtml((m.id||'').slice(-6))+'</div>'
      + lineHtml(m, 'red')
      + lineHtml(m, 'black')
      + '</div>';
  }

  let html = '<div class="bracket-visual-wrap"><div class="bracket-visual">';
  rounds.forEach(r=>{
    const list = byRound[r] || [];
    const isFinal = r === maxRound;
    html += '<div class="bv-round'+(isFinal?' bv-round-final':'')+'">';
    html += '<div class="bv-round-title">'+roundLabel(r, maxRound)+'</div>';
    html += '<div class="bv-round-col">';
    list.forEach(m=>{ html += matchCard(m); });
    html += '</div></div>';
  });

  // Cúp vô địch
  const finalM = (byRound[maxRound] || [])[0];
  let champName = '—';
  if(finalM && finalM.winner){
    champName = finalM.winner === finalM.red ? finalM.redName : finalM.blackName;
  }
  html += '<div class="bv-round bv-round-cup">';
  html += '<div class="bv-round-title">Vô địch</div>';
  html += '<div class="bv-cup-card"><div class="bv-cup-icon">🏆</div><div class="bv-cup-name">'+escHtml(champName||'—')+'</div></div>';
  html += '</div>';

  html += '</div>'; // bracket-visual
  html += '</div>';
  return html;
}
function renderAdminBracketTree(){
  const tnId = document.getElementById('diagramTournament')?.value;
  const box = document.getElementById('adminBracketTree');
  if(box) box.innerHTML = buildBracketTreeHtml(tnId);
}

async function openPublicBracketModal(){
  try{ closeDrawer(); }catch(e){}
  const overlay = document.getElementById('publicBracketOverlay');
  const sel = document.getElementById('publicBracketTournament');
  const box = document.getElementById('publicBracketTree');
  if(box) box.innerHTML = '<div class="admin-empty">Đang tải giải…</div>';
  if(overlay){ overlay.classList.add('show'); overlay.style.zIndex='100080'; }
  try{
    if(typeof fbAvailable === 'function' && fbAvailable()){
      try{
        if(typeof fbEnsureGuestAuth==='function') await fbEnsureGuestAuth();
        else if(typeof fbEnsureAuthOptional==='function') await fbEnsureAuthOptional();
      }catch(e){}
      const [tnSnap, mSnap, pSnap] = await Promise.all([
        fb.db.ref('tournaments').once('value'),
        fb.db.ref('matches').once('value'),
        fb.db.ref('players').once('value')
      ]);
      const tns = tnSnap.val() || {};
      const matches = mSnap.val() || {};
      const players = pSnap.val() || {};
      if(typeof tcData !== 'undefined'){
        tcData.tournaments = Object.assign({}, tcData.tournaments||{}, tns);
        tcData.matches = Object.assign({}, tcData.matches||{}, matches);
        tcData.players = Object.assign({}, tcData.players||{}, players);
      }
      // Bổ sung tên còn thiếu từ players
      Object.values(matches).forEach(m=>{
        if(!m) return;
        if(m.red && (!m.redName || m.redName==='TBD') && players[m.red])
          m.redName = players[m.red].name || players[m.red].code || m.red;
        if(m.black && (!m.blackName || m.blackName==='TBD') && players[m.black])
          m.blackName = players[m.black].name || players[m.black].code || m.black;
      });
      if(sel){
        const cur = sel.value;
        const list = Object.values(tns).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        sel.innerHTML = '<option value="">— Chọn giải —</option>' + list.map(t=>
          '<option value="'+t.id+'">'+(t.name||t.code)+' ('+(t.code||t.id)+')</option>'
        ).join('');
        if(cur && tns[cur]) sel.value = cur;
        else if(list.length) sel.value = list[0].id;
        sel.onchange = ()=>{ if(box) box.innerHTML = buildBracketTreeHtml(sel.value, matches); };
      }
      const tnId = sel && sel.value;
      if(box){
        let html = buildBracketTreeHtml(tnId, matches);
        // Nếu chưa có SE, thử mọi match của giải (diagram slots)
        if(html.indexOf('Chưa có nhánh')>=0 && tnId){
          const any = Object.values(matches).filter(m=>m && m.tournamentId===tnId);
          if(any.length){
            // ép kind se tạm để vẽ
            const patched = {};
            any.forEach(m=>{ patched[m.id] = Object.assign({}, m, { kind: m.kind||'se' }); });
            html = buildBracketTreeHtml(tnId, patched);
          }
        }
        box.innerHTML = html;
      }
    } else if(box) box.innerHTML = '<div class="admin-empty">Chưa kết nối Firebase.</div>';
  }catch(e){
    if(box) box.innerHTML = '<div class="admin-empty">Lỗi tải: '+(e.message||e)+'</div>';
  }
}
function closePublicBracketModal(){
  document.getElementById('publicBracketOverlay')?.classList.remove('show');
}

let qmSlots = [];
function playerAvatarSrc(p){
  const av = (p && p.avatar) || '';
  if(!av) return '';
  if(/^https?:\/\//i.test(av) || av.startsWith('data:')) return av;
  return 'https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/photo/'+av;
}
function qmSize(){
  let n = +document.getElementById('qmBracketSize')?.value || 2;
  // Làm tròn lên chẵn tối thiểu 2, tối đa 48
  n = Math.max(2, Math.min(48, n));
  if(n % 2 === 1) n += 1;
  return n;
}
function renderQuickMatchSlots(){
  const box = document.getElementById('qmSlotGrid') || document.getElementById('qmSlotList');
  if(!box) return;
  const size = qmSize();
  if(!Array.isArray(qmSlots)) qmSlots = [];
  while(qmSlots.length < size) qmSlots.push(null);
  if(qmSlots.length > size) qmSlots = qmSlots.slice(0, size);
  box.innerHTML = qmSlots.map((p,i)=>{
    if(p){
      const av = playerAvatarSrc(p);
      return '<div class="dslot filled qm-dslot" data-qm-slot="'+i+'">'
        + '<span class="dslot-seed">#'+(i+1)+'</span>'
        + (av ? '<img class="dslot-av" src="'+av+'" alt="">' : '<span class="dslot-av ph">👤</span>')
        + '<span class="dslot-name">'+(p.name||p.code||p.id)+'</span>'
        + '<button type="button" class="dslot-x" data-qm-clear="'+i+'" title="Bỏ chọn">×</button>'
        + '</div>';
    }
    return '<button type="button" class="dslot empty qm-dslot" data-qm-slot="'+i+'">'
      + '<span class="dslot-seed">#'+(i+1)+'</span>'
      + '<span class="dslot-plus">+</span>'
      + '<span class="dslot-hint">Thêm kỳ thủ</span></button>';
  }).join('');
  box.querySelectorAll('.qm-dslot').forEach(el=>{
    el.addEventListener('click', (e)=>{
      const clr = e.target.closest('[data-qm-clear]');
      if(clr){
        e.preventDefault(); e.stopPropagation();
        const idx = +clr.getAttribute('data-qm-clear');
        qmSlots[idx] = null;
        renderQuickMatchSlots();
        return;
      }
      const idx = +el.getAttribute('data-qm-slot');
      if(!isNaN(idx)) openQmPick(idx);
    });
  });
}
let qmPickIndex = -1;
async function openQmPick(index){
  qmPickIndex = index;
  diagramPickIndex = -1;
  const ov = document.getElementById('diagramPickOverlay');
  const meta = document.getElementById('diagramPickMeta');
  const search = document.getElementById('diagramPickSearch');
  if(meta) meta.textContent = 'Đấu nhanh · Ô seed #'+(index+1);
  if(search) search.value = '';
  // Đảm bảo có danh sách kỳ thủ
  try{
    if(!tcData.players || !Object.keys(tcData.players).length){
      await adminEnsureFb();
      const snap = await fb.db.ref('players').once('value');
      tcData.players = snap.val() || {};
    }
  }catch(e){ console.warn(e); }
  if(ov){
    // Đưa overlay ra body để không bị admin panel che / overflow
    try{ if(ov.parentElement !== document.body) document.body.appendChild(ov); }catch(e){}
    ov.dataset.mode = 'qm';
    ov.classList.add('show');
    ov.style.cssText = 'display:flex !important;z-index:2147483000 !important;position:fixed !important;inset:0 !important;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);';
  }
  renderQmPickList();
}
function renderQmPickList(){
  const box = document.getElementById('diagramPickList');
  if(!box) return;
  const q = (document.getElementById('diagramPickSearch')?.value || '').trim().toLowerCase();
  let list = Object.values(tcData.players || {});
  if(q) list = list.filter(p =>
    (p.name||'').toLowerCase().includes(q) ||
    (p.code||'').toLowerCase().includes(q) ||
    (p.id||'').toLowerCase().includes(q)
  );
  const used = new Set((qmSlots||[]).filter(Boolean).map(p=>p.id));
  if(!list.length){ box.innerHTML = '<div class="admin-empty">Không có kỳ thủ.</div>'; return; }
  box.innerHTML = list.map(p=>{
    const busy = used.has(p.id);
    return '<button type="button" class="admin-item dslot-pick" data-qpid="'+p.id+'" '+(busy?'disabled':'')+'>'
      + '<div class="admin-item-main"><b>'+(p.name||p.code)+'</b>'
      + '<div class="admin-item-meta">ID '+(p.code||p.id)+(busy?' · đã chọn':'')+'</div></div></button>';
  }).join('');
  box.querySelectorAll('[data-qpid]').forEach(btn=>{
    if(btn.disabled) return;
    btn.addEventListener('click', ()=>{
      const p = (tcData.players||{})[btn.getAttribute('data-qpid')];
      if(!p || qmPickIndex<0) return;
      qmSlots[qmPickIndex] = { id:p.id, code:p.code, name:p.name, avatar:p.avatar||'' };
      renderQuickMatchSlots();
      const ov = document.getElementById('diagramPickOverlay');
      if(ov){ ov.classList.remove('show'); ov.dataset.mode=''; }
      qmPickIndex = -1;
    });
  });
}
function qmFindPlayer(q){
  q=(q||'').trim().toLowerCase(); if(!q) return null;
  const all = Object.values(tcData.players||{});
  return all.find(p=>(p.code||'').toLowerCase()===q||(p.id||'').toLowerCase()===q)
    || all.find(p=>(p.name||'').toLowerCase().includes(q));
}
function qmSetStatus(t,err){ const el=document.getElementById('qmStatus'); if(el){ el.textContent=t||''; el.style.color=err?'#e88':''; } }
async function qmAddPlayer(){
  const p = qmFindPlayer(document.getElementById('qmPlayerSearch')?.value||'');
  if(!p){ qmSetStatus('Không tìm thấy kỳ thủ.', true); return; }
  while(qmSlots.length<2) qmSlots.push(null);
  if(qmSlots.some(x=>x && x.id===p.id)){ qmSetStatus('Đã trong cặp.', true); return; }
  const idx = qmSlots.findIndex(x=>!x);
  if(idx<0){ qmSetStatus('Đủ 2 ô.', true); return; }
  qmSlots[idx] = { id:p.id, code:p.code, name:p.name, avatar:p.avatar||'' };
  renderQuickMatchSlots();
  qmSetStatus(idx===0?'Đã thêm Đỏ.':'Đủ cặp.');
}
async function qmCreateRoom(){
  const size = qmSize();
  while(qmSlots.length < size) qmSlots.push(null);
  const filled = qmSlots.filter(Boolean);
  if(filled.length < 2){ qmSetStatus('Cần ít nhất 2 kỳ thủ.', true); return; }
  try{
    await adminEnsureFb();
    // Sinh bracket SE nhanh (matches kind qm)
    const old = Object.keys(tcData.matches||{}).filter(id => tcData.matches[id].kind==='qm');
    await Promise.all(old.map(id => tcRemove('matches/'+id)));
    old.forEach(id => delete tcData.matches[id]);

    let br = 1; while(br < size) br *= 2;
    const slots = [];
    for(let i=0;i<br;i++) slots.push(qmSlots[i]||null);
    const writes = [];
    const codes = [];
    for(let i=0;i<br/2;i++){
      const a = slots[i], b = slots[br-1-i];
      const mid = 'qm_r1_'+i+'_'+Date.now().toString(36).slice(-4);
      const code = (typeof randomRoomCode==='function')?randomRoomCode():('Q'+Math.random().toString(36).slice(2,7).toUpperCase());
      codes.push(code);
      const board = (typeof boardToPlain==='function'&&typeof initialBoard==='function')?boardToPlain(initialBoard()):null;
      const row = {
        id: mid, kind: 'qm', round: 1, index: i,
        red: a?a.id:null, black: b?b.id:null,
        redName: a?(a.name||a.code):'BYE', blackName: b?(b.name||b.code):'BYE',
        roomCode: code, status: (!a||!b)?'finished':'pending',
        winner: !a?(b?b.id:null):(!b?(a?a.id:null):null),
        table: i+1
      };
      tcData.matches[mid] = row;
      writes.push(tcSet('matches/'+mid, row));
      if(a && b){
        const qRaw = (window._timeConfig && window._timeConfig.tournament != null) ? +window._timeConfig.tournament : 15;
      const qMins = Math.max(0, Math.min(20, qRaw));
      const qInfinite = qMins === 0;
        writes.push(fb.db.ref('rooms/'+code).set({
          boardJSON: board?JSON.stringify(board):'null', turn:'red', lastMoveJSON:'null', version:1,
          gameOver:false, paused:false, createdAt:Date.now(), quickMatch:true,
          timeControl:qMins, clockInfinite:qInfinite, clockRed:qInfinite?null:(qMins*60), clockBlack:qInfinite?null:(qMins*60), clockTurnStartedAt:Date.now(),
          seats:{
            red:{ uid:'reserved', playerId:a.id, code:a.code, name:a.name, ts:Date.now() },
            black:{ uid:'reserved', playerId:b.id, code:b.code, name:b.name, ts:Date.now() }
          }
        }));
      }
    }
    await Promise.all(writes);
    const roomInput=document.getElementById('qmRoomCode');
    if(roomInput) roomInput.value = codes.filter(Boolean).join(', ');
    qmSetStatus('Đã tạo '+codes.length+' phòng vòng 1 (bracket '+br+').');
  }catch(e){ qmSetStatus('Lỗi: '+(e.message||e), true); }
}
async function qmForceJoin(){
  try{
    await adminEnsureFb();
    const pending = Object.values(tcData.matches||{}).filter(m => m.kind==='qm' && m.status==='pending' && m.red && m.black && m.roomCode);
    if(!pending.length){
      // fallback 2 slots
      while(qmSlots.length<2) qmSlots.push(null);
      if(qmSlots[0]&&qmSlots[1]){
        const code=(document.getElementById('qmRoomCode')?.value||'').split(',')[0].trim().toUpperCase();
        if(!code){ qmSetStatus('Hãy tạo phòng trước.', true); return; }
        const ts=Date.now();
        await Promise.all([
          fb.db.ref('presence/players/'+qmSlots[0].id+'/forceJoin').set({ roomCode:code, color:'red', ts, hard:true }),
          fb.db.ref('presence/players/'+qmSlots[1].id+'/forceJoin').set({ roomCode:code, color:'black', ts, hard:true }),
          fb.db.ref('forceJoin/'+qmSlots[0].id).set({ roomCode:code, color:'red', ts, hard:true }),
          fb.db.ref('forceJoin/'+qmSlots[1].id).set({ roomCode:code, color:'black', ts, hard:true })
        ]);
        qmSetStatus('Đã ép cặp vào phòng '+code+'.');
        return;
      }
      qmSetStatus('Chưa có trận pending — tạo phòng trước.', true);
      return;
    }
    const ts = Date.now();
    const ops = [];
    pending.forEach(m=>{
      ops.push(fb.db.ref('presence/players/'+m.red+'/forceJoin').set({ roomCode:m.roomCode, color:'red', ts, hard:true }));
      ops.push(fb.db.ref('presence/players/'+m.black+'/forceJoin').set({ roomCode:m.roomCode, color:'black', ts, hard:true }));
      ops.push(fb.db.ref('forceJoin/'+m.red).set({ roomCode:m.roomCode, color:'red', ts, hard:true }));
      ops.push(fb.db.ref('forceJoin/'+m.black).set({ roomCode:m.roomCode, color:'black', ts, hard:true }));
    });
    await Promise.all(ops);
    qmSetStatus('Đã ép '+pending.length+' cặp vào phòng.');
  }catch(e){ qmSetStatus('Force lỗi: '+(e.message||e), true); }
}
function qmClear(){ qmSlots=Array(qmSize()).fill(null); renderQuickMatchSlots(); const r=document.getElementById('qmRoomCode'); if(r) r.value=''; qmSetStatus('Đã xóa ô.'); }

document.getElementById('diagramRefreshBtn')?.addEventListener('click', renderAdminBracketTree);
document.getElementById('diagramTournament')?.addEventListener('change', renderAdminBracketTree);
document.getElementById('publicBracketBtn')?.addEventListener('click', openPublicBracketModal);
document.getElementById('publicBracketClose')?.addEventListener('click', closePublicBracketModal);
document.getElementById('publicBracketTournament')?.addEventListener('change', async ()=>{
  const sel=document.getElementById('publicBracketTournament');
  const box=document.getElementById('publicBracketTree');
  if(!box) return;
  try{
    const mSnap=await fb.db.ref('matches').once('value');
    box.innerHTML=buildBracketTreeHtml(sel&&sel.value, mSnap.val()||{});
  }catch(e){ box.innerHTML=buildBracketTreeHtml(sel&&sel.value); }
});
document.getElementById('publicBracketOverlay')?.addEventListener('click', e=>{ if(e.target.id==='publicBracketOverlay') closePublicBracketModal(); });
document.getElementById('qmAddPlayerBtn')?.addEventListener('click', qmAddPlayer);
document.getElementById('qmCreateRoomBtn')?.addEventListener('click', qmCreateRoom);
document.getElementById('qmForceJoinBtn')?.addEventListener('click', qmForceJoin);
document.getElementById('qmClearBtn')?.addEventListener('click', qmClear);
document.getElementById('qmPlayerSearch')?.addEventListener('keydown', e=>{ if(e.key==='Enter') qmAddPlayer(); });


/* ADMIN_NAV_DELEGATE */
(function bindAdminMobileNav(){
  function wire(){
    const ov = document.getElementById('adminOverlay');
    if(!ov || ov._navWired) return;
    ov._navWired = true;
    ov.addEventListener('click', function(e){
      const t = e.target;
      if(t.closest && t.closest('#adminNavToggle')){
        e.preventDefault();
        e.stopPropagation();
        toggleAdminNav();
        return;
      }
      if(t.id === 'adminNavBackdrop' || (t.closest && t.closest('#adminNavBackdrop'))){
        closeAdminMobileNav();
        return;
      }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
  setTimeout(wire, 500);
  setTimeout(wire, 2000);
})();

document.getElementById('diagramBuildBtn')?.addEventListener('click', buildBracketFromSlots);
document.getElementById('diagramClearSlotsBtn')?.addEventListener('click', ()=>{
  diagramSlots = Array(diagramSize()).fill(null);
  renderDiagramSlots();
  diagramSetStatus('Đã xóa hết ô.');
});
document.getElementById('diagramBracketSize')?.addEventListener('change', ()=>{
  ensureDiagramSlots();
  renderDiagramSlots();
});
document.getElementById('diagramTournament')?.addEventListener('change', loadSlotsFromTournament);
document.getElementById('diagramPickCancel')?.addEventListener('click', closeDiagramPick);
document.getElementById('diagramPickClear')?.addEventListener('click', ()=>{
  const ov = document.getElementById('diagramPickOverlay');
  if(ov && ov.dataset.mode==='qm' && qmPickIndex>=0){
    qmSlots[qmPickIndex]=null; renderQuickMatchSlots();
    ov.classList.remove('show'); qmPickIndex=-1; ov.dataset.mode='';
    return;
  }
  if(diagramPickIndex>=0){ diagramSlots[diagramPickIndex]=null; renderDiagramSlots(); }
  closeDiagramPick();
});
document.getElementById('diagramPickSearch')?.addEventListener('input', ()=>{
  const ov = document.getElementById('diagramPickOverlay');
  if(ov && ov.dataset.mode==='qm') renderQmPickList();
  else renderDiagramPickList();
});
document.getElementById('diagramPickOverlay')?.addEventListener('click', e=>{
  if(e.target.id==='diagramPickOverlay') closeDiagramPick();
});


/* ===== Thông báo toàn site ===== */
async function sendSiteAnnounce(){
  const text = (document.getElementById('announceText')?.value || '').trim();
  const st = document.getElementById('announceStatus');
  if(!text){ if(st) st.textContent = 'Nhập nội dung.'; return; }
  try{
    await adminEnsureFb();
    const row = {
      text,
      ts: Date.now(),
      by: (typeof playerSession !== 'undefined' && playerSession && playerSession.name) || 'admin',
      runs: 3,
      gapMs: 10000
    };
    const ref = await fb.db.ref('admin/announcements').push(row);
    // Gửi live 1 lần (client tự chạy đúng 3 lượt)
    await fb.db.ref('admin/announceLive').set({ ...row, id: ref.key });
    if(st) st.textContent = 'Đã gửi (hiển thị 3 lần, cách 10s).';
    const inp = document.getElementById('announceText');
    if(inp) inp.value = '';
    renderAnnounceLog();
  }catch(e){
    if(st) st.textContent = 'Lỗi: '+(e.message||e);
  }
}
async function deleteSiteAnnounce(id){
  if(!id) return;
  if(!(await appConfirm('Xóa thông báo này khỏi lịch sử?', 'Xóa thông báo'))) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/announcements/'+id).remove();
    const live = (await fb.db.ref('admin/announceLive').once('value')).val();
    if(live && (live.id === id || !live.id)){
      // không xóa live nếu đang phát người khác; chỉ clear nếu cùng id
      if(live.id === id) await fb.db.ref('admin/announceLive').remove();
    }
    setAdminStatus('Đã xóa thông báo.', 'ok');
    renderAnnounceLog();
  }catch(e){
    setAdminStatus('Xóa thất bại: '+(e.message||e), 'err');
  }
}
async function clearAllAnnouncements(){
  if(!(await appConfirm('Xóa toàn bộ lịch sử thông báo?', 'Xóa tất cả'))) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/announcements').remove();
    await fb.db.ref('admin/announceLive').remove();
    setAdminStatus('Đã xóa toàn bộ thông báo.', 'ok');
    renderAnnounceLog();
  }catch(e){
    setAdminStatus('Xóa tất cả thất bại: '+(e.message||e), 'err');
  }
}
async function renderAnnounceLog(){
  const box = document.getElementById('announceLogList');
  if(!box) return;
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('admin/announcements').limitToLast(40).once('value');
    const val = snap.val() || {};
    const list = Object.keys(val).map(k=>({ id:k, ...val[k] })).sort((a,b)=>(b.ts||0)-(a.ts||0));
    if(!list.length){ box.innerHTML = '<div class="admin-empty">Chưa có thông báo.</div>'; return; }
    box.innerHTML = list.map(a=>
      '<div class="admin-item">'
      + '<div class="admin-item-main"><b>'+String(a.text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</b>'
      + '<div class="admin-item-meta">'+(a.by||'')+' · '+new Date(a.ts||0).toLocaleString('vi-VN')+'</div></div>'
      + '<div class="admin-item-actions"><button type="button" class="action-btn" data-del-announce="'+a.id+'"><i class="fa-regular fa-trash"></i> Xóa</button></div>'
      + '</div>'
    ).join('');
    box.querySelectorAll('[data-del-announce]').forEach(btn=>{
      btn.addEventListener('click', ()=> deleteSiteAnnounce(btn.getAttribute('data-del-announce')));
    });
  }catch(e){
    box.innerHTML = '<div class="admin-empty">Lỗi tải lịch sử.</div>';
  }
}
document.getElementById('announceSendBtn')?.addEventListener('click', sendSiteAnnounce);
document.getElementById('announceRefreshBtn')?.addEventListener('click', renderAnnounceLog);
document.getElementById('announceClearAllBtn')?.addEventListener('click', clearAllAnnouncements);


/* ===== Link Live (Truyền thông) ===== */
let liveLinksDraft = [];
function liveLinkStatus(t,err){
  const el = document.getElementById('liveLinkStatus');
  if(el){ el.textContent = t||''; el.style.color = err?'#e88':''; }
}
function renderLiveLinkList(){
  const box = document.getElementById('liveLinkList');
  if(!box) return;
  if(!liveLinksDraft.length){
    box.innerHTML = '<div class="admin-empty">Chưa có link live.</div>';
    return;
  }
  const icon = (p)=>{
    p=(p||'').toLowerCase();
    if(p==='facebook') return '<i class="fa-brands fa-facebook" style="color:#1877f2"></i>';
    if(p==='tiktok') return '<i class="fa-brands fa-tiktok"></i>';
    if(p==='youtube') return '<i class="fa-brands fa-youtube" style="color:#ff0000"></i>';
    return '<i class="fa-regular fa-link"></i>';
  };
  box.innerHTML = liveLinksDraft.map((L,i)=>
    '<div class="admin-item">'
    + '<div class="admin-item-main"><b>'+icon(L.platform)+' '+(L.label||L.platform||'Link')+'</b>'
    + '<div class="admin-item-meta" style="word-break:break-all;">'+(L.url||'')+'</div></div>'
    + '<div class="admin-item-actions"><button type="button" class="action-btn" data-live-del="'+i+'"><i class="fa-regular fa-trash"></i></button></div>'
    + '</div>'
  ).join('');
  box.querySelectorAll('[data-live-del]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      liveLinksDraft.splice(+btn.getAttribute('data-live-del'),1);
      renderLiveLinkList();
    });
  });
}
async function loadLiveLinksAdmin(){
  try{
    await adminEnsureFb();
    let list = [];
    for(const path of ['public/liveLinks', 'admin/liveLinks', 'config/liveLinks']){
      try{
        const snap = await fb.db.ref(path).once('value');
        list = normalizeLiveLinks(snap.val());
        if(list.length) break;
      }catch(e){}
    }
    liveLinksDraft = list.slice();
    window._liveLinksCache = list.slice();
    try{ localStorage.setItem('cotuong_live_links', JSON.stringify(list)); }catch(e){}
    if(typeof tcData!=='undefined') tcData.liveLinks = list.slice();
  }catch(e){ liveLinksDraft = []; }
  renderLiveLinkList();
}
async function saveLiveLinksAdmin(){
  try{
    await adminEnsureFb();
    const payload = (liveLinksDraft||[]).map(L=>({
      platform: String(L.platform||'youtube').toLowerCase(),
      url: String(L.url || L.link || '').trim(),
      label: String(L.label || L.platform || 'Live').trim() || 'Live'
    })).filter(L=>L.url);
    // Lưu dạng object {0:{},1:{},2:{}} — RTDB ổn định hơn array
    const asObj = {};
    payload.forEach((L,i)=>{ asObj[String(i)] = L; });
    await Promise.all([
      fb.db.ref('public/liveLinks').set(asObj),
      fb.db.ref('config/liveLinks').set(asObj),
      fb.db.ref('admin/liveLinks').set(asObj)
    ]);
    liveLinksDraft = payload.slice();
    window._liveLinksCache = payload.slice();
    try{ localStorage.setItem('cotuong_live_links', JSON.stringify(payload)); }catch(e){}
    if(typeof tcData!=='undefined') tcData.liveLinks = payload.slice();
    liveLinkStatus('Đã lưu '+payload.length+' link.');
  }catch(e){ liveLinkStatus('Lỗi lưu: '+(e.message||e), true); }
}
function addLiveLinkAdmin(){
  const platform = document.getElementById('liveLinkPlatform')?.value || 'youtube';
  const url = (document.getElementById('liveLinkUrl')?.value||'').trim();
  const label = (document.getElementById('liveLinkLabel')?.value||'').trim();
  if(!url){ liveLinkStatus('Nhập link.', true); return; }
  liveLinksDraft.push({ platform, url, label: label || platform });
  document.getElementById('liveLinkUrl').value = '';
  document.getElementById('liveLinkLabel').value = '';
  renderLiveLinkList();
  liveLinkStatus('Đã thêm (nhớ bấm Lưu danh sách).');
}
document.getElementById('liveLinkAddBtn')?.addEventListener('click', addLiveLinkAdmin);
document.getElementById('liveLinkSaveBtn')?.addEventListener('click', saveLiveLinksAdmin);


/* ===== Poll toàn site ===== */
async function createSitePoll(){
  const q = (document.getElementById('pollQuestion')?.value||'').trim();
  const opts = [1,2,3,4].map(i => (document.getElementById('pollOpt'+i)?.value||'').trim()).filter(Boolean);
  const st = document.getElementById('pollAdminStatus');
  if(!q || opts.length < 2){ if(st) st.textContent = 'Cần câu hỏi và ≥2 lựa chọn.'; return; }
  try{
    await adminEnsureFb();
    // đóng poll cũ
    const openSnap = await fb.db.ref('admin/polls').orderByChild('status').equalTo('open').once('value');
    const openVal = openSnap.val()||{};
    await Promise.all(Object.keys(openVal).map(id => fb.db.ref('admin/polls/'+id).update({ status:'closed', closedAt: Date.now() })));
    const poll = {
      question: q,
      options: opts,
      votes: opts.map(()=>0),
      status: 'open',
      ts: Date.now(),
      by: (typeof playerSession!=='undefined' && playerSession && playerSession.name) || 'admin'
    };
    const ref = await fb.db.ref('admin/polls').push(poll);
    await fb.db.ref('admin/pollLive').set({ id: ref.key, ...poll });
    if(st) st.textContent = 'Đã phát poll.';
    renderPollResults();
  }catch(e){ if(st) st.textContent = 'Lỗi: '+(e.message||e); }
}
async function closeSitePolls(){
  const st = document.getElementById('pollAdminStatus');
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('admin/polls').once('value');
    const val = snap.val()||{};
    const ops = [];
    Object.keys(val).forEach(id=>{
      if(val[id].status==='open') ops.push(fb.db.ref('admin/polls/'+id).update({ status:'closed', closedAt:Date.now() }));
    });
    ops.push(fb.db.ref('admin/pollLive').remove());
    await Promise.all(ops);
    if(st) st.textContent = 'Đã đóng poll.';
    renderPollResults();
  }catch(e){ if(st) st.textContent = 'Lỗi: '+(e.message||e); }
}
async function renderPollResults(){
  const box = document.getElementById('pollResultList');
  if(!box) return;
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('admin/polls').limitToLast(20).once('value');
    const val = snap.val()||{};
    const list = Object.keys(val).map(k=>({id:k,...val[k]})).sort((a,b)=>(b.ts||0)-(a.ts||0));
    if(!list.length){ box.innerHTML = '<div class="admin-empty">Chưa có poll.</div>'; return; }
    box.innerHTML = list.map(p=>{
      const total = (p.votes||[]).reduce((s,n)=>s+(+n||0),0);
      const lines = (p.options||[]).map((o,i)=>{
        const c = +((p.votes&&p.votes[i])||0);
        const pct = total? Math.round(c*100/total) : 0;
        return '<div class="sub">'+o+': <b>'+c+'</b> ('+pct+'%)</div>';
      }).join('');
      return '<div class="admin-item"><div class="admin-item-main"><b>'+(p.status==='open'?'🟢 ':'⚫ ')+(p.question||'')+'</b>'
        +'<div class="admin-item-meta">'+new Date(p.ts||0).toLocaleString('vi-VN')+' · '+total+' phiếu</div>'
        +lines+'</div>'
        +'<div class="admin-item-actions"><button type="button" class="action-btn" data-poll-del="'+p.id+'"><i class="fa-regular fa-trash"></i> Xóa</button></div></div>';
    }).join('');
    box.querySelectorAll('[data-poll-del]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-poll-del');
        if(!id) return;
        if(!(await appConfirm('Xóa poll này?', 'Xóa poll'))) return;
        try{
          await fb.db.ref('admin/polls/'+id).remove();
          const live = (await fb.db.ref('admin/pollLive').once('value')).val();
          if(live && live.id === id) await fb.db.ref('admin/pollLive').remove();
          renderPollResults();
        }catch(e){ alert(e.message||e); }
      });
    });
  }catch(e){ box.innerHTML = '<div class="admin-empty">Lỗi tải poll.</div>'; }
}
document.getElementById('pollCreateBtn2')?.addEventListener('click', createSitePoll);
document.getElementById('pollCloseBtn2')?.addEventListener('click', closeSitePolls);
document.getElementById('pollRefreshBtn')?.addEventListener('click', renderPollResults);

/** Đồng bộ phút nghĩ mặc định từ giải đang chọn */
function syncDefaultThinkMinutes(){
  try{
    const v = +(window._timeConfig && window._timeConfig.tournament) || 15;
    window._defaultThinkMinutes = v;
    const fbEl = document.getElementById('fbTimeControl');
    if(fbEl && !fbEl.dataset.touched) fbEl.value = String(v);
  }catch(e){}
}
document.getElementById('tnTimeControl')?.addEventListener('change', syncDefaultThinkMinutes);
document.getElementById('fbTimeControl')?.addEventListener('input', ()=>{ document.getElementById('fbTimeControl').dataset.touched='1'; });

document.getElementById('refLogClearAllBtn')?.addEventListener('click', clearAllRefLog);


/* ===== Cấu hình thời gian nghĩ (bạn bè / giải) ===== */
window._timeConfig = { friends: 5, tournament: 15 };
async function loadTimeConfig(){
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('admin/timeConfig').once('value');
    const v = snap.val() || {};
    window._timeConfig = {
      friends: Math.max(0, Math.min(20, +(v.friends != null ? v.friends : 5))),
      tournament: Math.max(0, Math.min(20, +(v.tournament != null ? v.tournament : 15)))
    };
  }catch(e){
    try{
      const raw = localStorage.getItem('cotuong_time_config');
      if(raw) window._timeConfig = Object.assign({friends:5,tournament:15}, JSON.parse(raw));
    }catch(e2){}
  }
  const f = document.getElementById('timeCfgFriends');
  const t = document.getElementById('timeCfgTournament');
  if(f) f.value = window._timeConfig.friends;
  if(t) t.value = window._timeConfig.tournament;
  try{ localStorage.setItem('cotuong_time_config', JSON.stringify(window._timeConfig)); }catch(e){}
}
async function saveTimeConfig(){
  const friends = Math.max(0, Math.min(20, +document.getElementById('timeCfgFriends')?.value || 5));
  const tournament = Math.max(0, Math.min(20, +document.getElementById('timeCfgTournament')?.value || 15));
  const st = document.getElementById('timeCfgStatus');
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/timeConfig').set({ friends, tournament, updatedAt: Date.now() });
    window._timeConfig = { friends, tournament };
    try{ localStorage.setItem('cotuong_time_config', JSON.stringify(window._timeConfig)); }catch(e){}
    if(st) st.textContent = 'Đã lưu: bạn bè '+friends+'′ · giải '+tournament+'′';
  }catch(e){
    window._timeConfig = { friends, tournament };
    try{ localStorage.setItem('cotuong_time_config', JSON.stringify(window._timeConfig)); }catch(e2){}
    if(st) st.textContent = 'Lưu local: bạn bè '+friends+'′ · giải '+tournament+'′';
  }
}
document.getElementById('timeCfgSaveBtn')?.addEventListener('click', saveTimeConfig);
// load when opening quickmatch / admin
const _showAdminSec = typeof showAdminSection === 'function' ? showAdminSection : null;


/* ===== Live monitor: xóa ===== */
function clearLiveGrid(){
  const box = document.getElementById('liveGrid');
  if(box) box.innerHTML = '<div class="admin-empty">Đã xóa ma trận.</div>';
}
function clearLiveAnomalies(){
  const box = document.getElementById('liveAnomalyList') || document.getElementById('anomalyList');
  if(box) box.innerHTML = '<div class="admin-empty">Không còn cảnh báo.</div>';
  try{ if(window._liveAnomalies) window._liveAnomalies = []; }catch(e){}
}
async function clearLiveMatches(){
  const box = document.getElementById('liveMatchList');
  if(box) box.innerHTML = '<div class="admin-empty">Đã xóa danh sách (chỉ UI). Phòng Firebase giữ nguyên trừ khi xóa phòng riêng.</div>';
}
document.getElementById('liveGridClearBtn')?.addEventListener('click', clearLiveGrid);
document.getElementById('liveAnomalyClearBtn')?.addEventListener('click', clearLiveAnomalies);
document.getElementById('liveMatchClearBtn')?.addEventListener('click', clearLiveMatches);


/* ===== Admin: Chat sảnh ===== */
async function adminLoadLobbyChat(){
  const box = document.getElementById('adminLobbyChatList');
  if(!box) return;
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('public/lobbyChat').limitToLast(100).once('value');
    const val = snap.val() || {};
    const list = Object.keys(val).map(k=>({id:k,...val[k]})).sort((a,b)=>(b.ts||0)-(a.ts||0));
    if(!list.length){ box.innerHTML = '<div class="admin-empty">Chưa có tin nhắn sảnh.</div>'; return; }
    box.innerHTML = list.map(m=>{
      const t = m.ts ? new Date(m.ts).toLocaleString('vi-VN') : '';
      const role = m.role || 'player';
      return '<div class="admin-item"><div class="admin-item-main"><b>'+(m.name||'?')+'</b> <span class="sub">['+role+'] '+(m.code||'')+'</span>'
        +'<div class="admin-item-meta">'+t+'</div>'
        +'<div>'+String(m.text||'').replace(/</g,'&lt;')+'</div></div>'
        +'<div class="admin-item-actions"><button type="button" class="action-btn" data-lobby-del="'+m.id+'"><i class="fa-regular fa-trash"></i></button></div></div>';
    }).join('');
    box.querySelectorAll('[data-lobby-del]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-lobby-del');
        try{
          await fb.db.ref('public/lobbyChat/'+id).remove();
          adminLoadLobbyChat();
        }catch(e){ alert(e.message||e); }
      });
    });
  }catch(e){ box.innerHTML = '<div class="admin-empty">Lỗi: '+(e.message||e)+'</div>'; }
}
async function adminClearLobbyChat(){
  if(!(await appConfirm('Xóa toàn bộ tin nhắn chat sảnh?', 'Xóa chat sảnh'))) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('public/lobbyChat').remove();
    adminLoadLobbyChat();
  }catch(e){ alert(e.message||e); }
}
async function adminLoadLobbyBans(){
  const box = document.getElementById('adminLobbyBanList');
  if(!box) return;
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('admin/lobbyChatBans').once('value');
    const val = snap.val() || {};
    const keys = Object.keys(val);
    if(!keys.length){ box.innerHTML = '<div class="admin-empty">Chưa cấm ai.</div>'; return; }
    box.innerHTML = keys.map(k=>{
      const v = val[k]||{};
      return '<div class="admin-item"><div class="admin-item-main"><b>'+k+'</b><div class="admin-item-meta">by '+(v.by||'?')+'</div></div>'
        +'<div class="admin-item-actions"><button type="button" class="action-btn" data-lobby-unban="'+k+'">Gỡ</button></div></div>';
    }).join('');
    box.querySelectorAll('[data-lobby-unban]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        try{
          await fb.db.ref('admin/lobbyChatBans/'+btn.getAttribute('data-lobby-unban')).remove();
          adminLoadLobbyBans();
        }catch(e){ alert(e.message||e); }
      });
    });
  }catch(e){ box.innerHTML = '<div class="admin-empty">Lỗi tải.</div>'; }
}
document.getElementById('adminLobbyChatRefreshBtn')?.addEventListener('click', ()=>{ adminLoadLobbyChat(); adminLoadLobbyBans(); });
document.getElementById('adminLobbyChatClearBtn')?.addEventListener('click', adminClearLobbyChat);
document.getElementById('adminLobbyBanBtn')?.addEventListener('click', async ()=>{
  const t = (document.getElementById('adminLobbyBanTarget')?.value||'').trim().toUpperCase();
  if(!t) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/lobbyChatBans/'+t).set({ by:'admin', ts: Date.now() });
    adminLoadLobbyBans();
  }catch(e){ alert(e.message||e); }
});
document.getElementById('adminLobbyUnbanBtn')?.addEventListener('click', async ()=>{
  const t = (document.getElementById('adminLobbyBanTarget')?.value||'').trim().toUpperCase();
  if(!t) return;
  try{
    await adminEnsureFb();
    await fb.db.ref('admin/lobbyChatBans/'+t).remove();
    adminLoadLobbyBans();
  }catch(e){ alert(e.message||e); }
});


/* ===== Xác minh kỳ thủ ===== */
async function renderVerifyPlayerList(){
  const box = document.getElementById('verifyPlayerList');
  if(!box) return;
  try{
    await adminEnsureFb();
    if(!tcData.players || !Object.keys(tcData.players).length){
      const snap = await fb.db.ref('players').once('value');
      tcData.players = snap.val() || {};
    }
    const q = (document.getElementById('verifyPlayerSearch')?.value || '').trim().toLowerCase();
    let list = Object.values(tcData.players || {});
    if(q) list = list.filter(p =>
      (p.name||'').toLowerCase().includes(q) ||
      (p.code||'').toLowerCase().includes(q) ||
      (p.id||'').toLowerCase().includes(q)
    );
    list.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||''),'vi'));
    if(!list.length){ box.innerHTML = '<div class="admin-empty">Không có kỳ thủ.</div>'; return; }
    box.innerHTML = list.map(p=>{
      const ver = !!(p.verified || p.isVerified);
      return '<div class="admin-item"><div class="admin-item-main"><b>'+(p.name||p.code||p.id)+'</b>'
        +(ver?' <span class="chat-verified" title="Đã xác minh" style="color:#1d9bf0">✓</span>':'')
        +'<div class="admin-item-meta">ID '+(p.code||p.id)+'</div></div>'
        +'<div class="admin-item-actions">'
        +'<button type="button" class="action-btn" data-verify-id="'+p.id+'" data-verify-on="'+(ver?'0':'1')+'">'
        +(ver?'<i class="fa-regular fa-circle-xmark"></i> Gỡ':'<i class="fa-solid fa-circle-check"></i> Xác minh')
        +'</button></div></div>';
    }).join('');
    box.querySelectorAll('[data-verify-id]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-verify-id');
        const on = btn.getAttribute('data-verify-on') === '1';
        try{
          await fb.db.ref('players/'+id+'/verified').set(!!on);
          if(tcData.players[id]) tcData.players[id].verified = !!on;
          renderVerifyPlayerList();
        }catch(e){ alert(e.message||e); }
      });
    });
  }catch(e){ box.innerHTML = '<div class="admin-empty">Lỗi: '+(e.message||e)+'</div>'; }
}
document.getElementById('verifyPlayerRefreshBtn')?.addEventListener('click', renderVerifyPlayerList);
document.getElementById('verifyPlayerSearch')?.addEventListener('input', ()=>{
  clearTimeout(window._verifySearchT);
  window._verifySearchT = setTimeout(renderVerifyPlayerList, 200);
});


/* ===== Clock visibility config (admin hệ thống) ===== */
async function adminLoadClockConfig(){
  try{
    await adminEnsureFb();
    const snap = await fb.db.ref('admin/clockConfig').once('value');
    const c = snap.val()||{};
    const setSel = (id, on)=>{
      const el = document.getElementById(id);
      if(el) el.value = on ? '1' : '0';
    };
    setSel('clockShowLobby', !!(c.lobby === true || c.lobby === 1 || c.lobby === '1'));
    setSel('clockShowOnline', !(c.online === false || c.online === 0 || c.online === '0'));
    setSel('clockShowTournament', !(c.tournament === false || c.tournament === 0 || c.tournament === '0'));
  }catch(e){}
}
async function adminSaveClockConfig(){
  const st = document.getElementById('clockConfigStatus');
  try{
    await adminEnsureFb();
    const on = (id)=> (document.getElementById(id)?.value === '1');
    const row = {
      lobby: on('clockShowLobby'),
      online: on('clockShowOnline'),
      tournament: on('clockShowTournament'),
      updatedAt: Date.now()
    };
    await fb.db.ref('admin/clockConfig').set(row);
    try{
      if(typeof _clockConfig !== 'undefined'){
        _clockConfig.lobby = row.lobby;
        _clockConfig.online = row.online;
        _clockConfig.tournament = row.tournament;
      }
      if(typeof renderClocks === 'function') renderClocks();
    }catch(e){}
    if(st){ st.textContent = 'Đã lưu cấu hình đồng hồ.'; st.className = 'admin-status ok'; }
  }catch(err){
    if(st){ st.textContent = 'Lỗi: '+(err.message||err); st.className = 'admin-status err'; }
  }
}
document.getElementById('clockConfigSaveBtn')?.addEventListener('click', adminSaveClockConfig);
try{
  // load when opening system section
  const _origShow = typeof showAdminSection === 'function' ? showAdminSection : null;
  document.querySelector('.admin-nav-btn[data-section="system"]')?.addEventListener('click', ()=>{
    setTimeout(adminLoadClockConfig, 50);
  });
  setTimeout(adminLoadClockConfig, 2000);
}catch(e){}


/* HEADER_BTN_REBIND — nút đóng / đăng xuất admin */
(function(){
  function bind(id, fn){
    const el = document.getElementById(id);
    if(!el || typeof fn !== 'function') return;
    el.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      try{ fn(); }catch(err){ console.warn(id, err); }
    });
  }
  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(function(){
    bind('adminCloseBtn', typeof closeAdminPanel === 'function' ? closeAdminPanel : function(){
      document.getElementById('adminOverlay')?.classList.remove('show');
    });
    bind('adminLogoutBtn', typeof adminLogout === 'function' ? adminLogout : function(){
      try{ if(typeof clearAdminSession==='function') clearAdminSession(); }catch(e){}
      document.getElementById('adminOverlay')?.classList.remove('show');
    });
  });
})();




/* ===== EVENT COUNTDOWN CONFIG v2 ===== */
window._eventCountdown = window._eventCountdown || {
  enabled: false,
  target: '',
  title: 'SỰ KIỆN',
  countdownLabel: 'Đếm ngược đến sự kiện',
  welcomeLabel: 'Chào mừng đến sự kiện'
};

async function loadEventCountdownCfg(){
  try{
    const raw = localStorage.getItem('cotuong_event_countdown');
    if(raw) window._eventCountdown = Object.assign({}, window._eventCountdown, JSON.parse(raw));
  }catch(e){}
  try{
    if(typeof fbAvailable==='function' && fbAvailable()){
      if(typeof fbInit==='function') await fbInit();
      if(fb.db){
        const snap = await fb.db.ref('admin/eventCountdown').once('value');
        const v = snap.val();
        if(v) window._eventCountdown = Object.assign({}, window._eventCountdown, v);
      }
    }
  }catch(e){ console.warn('loadEventCountdownCfg', e); }
  fillEventCountdownForm();
  try{ if(typeof applyEventCountdownUI==='function') applyEventCountdownUI(); }catch(e){}
}

function fillEventCountdownForm(){
  const c = window._eventCountdown || {};
  const en = document.getElementById('ecEnabled');
  const ti = document.getElementById('ecTitleInput');
  const tg = document.getElementById('ecTargetInput');
  const cl = document.getElementById('ecCountdownLabel');
  const wl = document.getElementById('ecWelcomeLabel');
  const on = c.enabled === true || c.enabled === 1 || c.enabled === '1' || c.enabled === 'true';
  if(en) en.value = on ? '1' : '0';
  if(ti) ti.value = c.title || '';
  if(cl) cl.value = c.countdownLabel || '';
  if(wl) wl.value = c.welcomeLabel || '';
  if(tg){
    if(c.target){
      try{
        const d = new Date(c.target);
        if(!isNaN(d.getTime())){
          const pad = n => String(n).padStart(2,'0');
          // datetime-local: YYYY-MM-DDTHH:mm or with seconds
          tg.value = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
        }
      }catch(e){}
    }
  }
}

async function saveEventCountdownCfg(){
  const en = document.getElementById('ecEnabled');
  const ti = document.getElementById('ecTitleInput');
  const tg = document.getElementById('ecTargetInput');
  const cl = document.getElementById('ecCountdownLabel');
  const wl = document.getElementById('ecWelcomeLabel');
  const st = document.getElementById('ecSaveStatus');
  let targetISO = '';
  if(tg && tg.value){
    const d = new Date(tg.value);
    if(!isNaN(d.getTime())) targetISO = d.toISOString();
    else if(st){ st.textContent = '⚠ Ngày giờ không hợp lệ'; return; }
  } else {
    if(st){ st.textContent = '⚠ Chọn ngày giờ đích'; return; }
  }
  const cfg = {
    enabled: !!(en && en.value === '1'),
    title: (ti && ti.value.trim()) || 'SỰ KIỆN',
    target: targetISO,
    countdownLabel: (cl && cl.value.trim()) || 'Đếm ngược đến sự kiện',
    welcomeLabel: (wl && wl.value.trim()) || 'Chào mừng đến sự kiện',
    updatedAt: Date.now()
  };
  window._eventCountdown = cfg;
  try{ localStorage.setItem('cotuong_event_countdown', JSON.stringify(cfg)); }catch(e){}
  try{
    if(typeof fbAvailable==='function' && fbAvailable()){
      if(typeof fbInit==='function') await fbInit();
      if(fb.db) await fb.db.ref('admin/eventCountdown').set(cfg);
    }
    if(st) st.textContent = '✓ Đã lưu — mở menu để xem đếm ngược';
  }catch(e){
    if(st) st.textContent = '✓ Lưu local (Firebase: '+(e&&e.message||'lỗi')+')';
  }
  try{ if(typeof applyEventCountdownUI==='function') applyEventCountdownUI(); }catch(e){}
  try{ if(typeof loadClientEventCountdown==='function') loadClientEventCountdown(); }catch(e){}
}

// Bind save (delegation + direct)
document.addEventListener('click', function(ev){
  const t = ev.target && (ev.target.id === 'ecSaveBtn' ? ev.target : (ev.target.closest && ev.target.closest('#ecSaveBtn')));
  if(t){ ev.preventDefault(); saveEventCountdownCfg(); }
});
document.querySelector('.admin-nav-btn[data-section="system"]')?.addEventListener('click', function(){
  setTimeout(loadEventCountdownCfg, 100);
});
try{ setTimeout(loadEventCountdownCfg, 1500); }catch(e){}


/* ===== MENU BLOCKS ORDER ===== */
const DEFAULT_MENU_BLOCKS = [
  { id:'countdown', label:'Đếm ngược sự kiện' },
  { id:'game', label:'Ván cờ' },
  { id:'ui', label:'Giao diện & Âm thanh' },
  { id:'checkin', label:'Điểm danh' },
  { id:'shop', label:'Cửa hàng & Giao diện' },
  { id:'captured', label:'Quân đã ăn' },
  { id:'history', label:'Lịch sử nước đi' },
  { id:'poll', label:'Bình chọn (Poll)' },
  { id:'friends', label:'Chơi cùng bạn bè' },
  { id:'bracket', label:'Sơ đồ nhánh đấu' },
  { id:'cheat', label:'Chế độ gian lận' },
  { id:'auth', label:'Đăng nhập / Đăng ký' },
  { id:'clan', label:'Clan' },
  { id:'achievements', label:'Thành tựu' },
  { id:'friends2', label:'Bạn bè & Cược coin' },
  { id:'admin', label:'Quản trị' }
];
window._menuBlockOrder = null;

async function loadMenuBlockOrder(){
  try{
    const raw = localStorage.getItem('cotuong_menu_blocks');
    if(raw) window._menuBlockOrder = JSON.parse(raw);
  }catch(e){}
  try{
    if(typeof fbAvailable==='function' && fbAvailable()){
      if(typeof fbInit==='function') await fbInit();
      if(fb.db){
        const snap = await fb.db.ref('admin/menuBlocks').once('value');
        const v = snap.val();
        if(v && Array.isArray(v.order)) window._menuBlockOrder = v.order;
        else if(Array.isArray(v)) window._menuBlockOrder = v;
      }
    }
  }catch(e){}
  if(!Array.isArray(window._menuBlockOrder) || !window._menuBlockOrder.length){
    window._menuBlockOrder = DEFAULT_MENU_BLOCKS.map(b=>b.id);
  }
  applyMenuBlockOrder();
  renderMenuBlocksAdmin();
}

function applyMenuBlockOrder(){
  const drawer = document.getElementById('drawer');
  if(!drawer) return;
  const nodes = {};
  drawer.querySelectorAll('[data-menu-block]').forEach(el=>{
    nodes[el.getAttribute('data-menu-block')] = el;
  });
  let order = Array.isArray(window._menuBlockOrder) ? window._menuBlockOrder.slice() : DEFAULT_MENU_BLOCKS.map(b=>b.id);
  // Thêm khối mới chưa có trong order đã lưu
  Object.keys(nodes).forEach(id=>{
    if(order.indexOf(id) < 0) order.push(id);
  });
  window._menuBlockOrder = order;
  order.forEach(id=>{
    const el = nodes[id];
    if(el) drawer.appendChild(el);
  });
  const head = drawer.querySelector('.drawer-head');
  if(head) drawer.insertBefore(head, drawer.firstChild);
}

function renderMenuBlocksAdmin(){
  const list = document.getElementById('menuBlocksList');
  if(!list) return;
  const order = (window._menuBlockOrder || DEFAULT_MENU_BLOCKS.map(b=>b.id)).slice();
  const labelOf = id => (DEFAULT_MENU_BLOCKS.find(b=>b.id===id)||{label:id}).label;
  list.innerHTML = order.map((id, idx)=>`
    <div class="menu-block-row" data-id="${id}">
      <span class="menu-block-idx">${idx+1}</span>
      <span class="menu-block-label">${labelOf(id)}</span>
      <button type="button" class="action-btn menu-block-up" data-id="${id}" title="Lên">↑</button>
      <button type="button" class="action-btn menu-block-down" data-id="${id}" title="Xuống">↓</button>
    </div>`).join('');
}

function moveMenuBlock(id, dir){
  const order = (window._menuBlockOrder || DEFAULT_MENU_BLOCKS.map(b=>b.id)).slice();
  const i = order.indexOf(id);
  if(i < 0) return;
  const j = i + dir;
  if(j < 0 || j >= order.length) return;
  const t = order[i]; order[i] = order[j]; order[j] = t;
  window._menuBlockOrder = order;
  renderMenuBlocksAdmin();
  applyMenuBlockOrder();
}

async function saveMenuBlockOrder(){
  const st = document.getElementById('menuBlocksStatus');
  const order = (window._menuBlockOrder || DEFAULT_MENU_BLOCKS.map(b=>b.id)).slice();
  try{ localStorage.setItem('cotuong_menu_blocks', JSON.stringify(order)); }catch(e){}
  try{
    if(typeof fbAvailable==='function' && fbAvailable()){
      if(typeof fbInit==='function') await fbInit();
      if(fb.db) await fb.db.ref('admin/menuBlocks').set({ order, updatedAt: Date.now() });
    }
    if(st) st.textContent = '✓ Đã lưu thứ tự khối menu';
  }catch(e){
    if(st) st.textContent = '✓ Lưu local';
  }
  applyMenuBlockOrder();
}

function resetMenuBlockOrder(){
  window._menuBlockOrder = DEFAULT_MENU_BLOCKS.map(b=>b.id);
  renderMenuBlocksAdmin();
  applyMenuBlockOrder();
  saveMenuBlockOrder();
}

document.addEventListener('click', function(ev){
  const t = ev.target;
  if(!t) return;
  if(t.id === 'menuBlocksSaveBtn' || (t.closest && t.closest('#menuBlocksSaveBtn'))){
    saveMenuBlockOrder(); return;
  }
  if(t.id === 'menuBlocksResetBtn' || (t.closest && t.closest('#menuBlocksResetBtn'))){
    resetMenuBlockOrder(); return;
  }
  const up = t.closest && t.closest('.menu-block-up');
  const down = t.closest && t.closest('.menu-block-down');
  if(up){ moveMenuBlock(up.getAttribute('data-id'), -1); return; }
  if(down){ moveMenuBlock(down.getAttribute('data-id'), 1); return; }
});
document.querySelector('.admin-nav-btn[data-section="blocks"]')?.addEventListener('click', function(){
  setTimeout(loadMenuBlockOrder, 50);
});
try{ setTimeout(loadMenuBlockOrder, 1600); }catch(e){}
