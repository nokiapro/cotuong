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
    appAlert('Lỗi tải replay: '+(e.message||e), 'Replay');
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
      let em = themeEmoji[tid] || '🎨';
      if(seen.has(em)) em = '🎨';
      if(em) seen.add(em);
      const isLogoMeta = !!(meta.logo || (typeof THEME_LOGOS!=='undefined' && THEME_LOGOS[tid]));
      const isClubMeta = !isLogoMeta && !!(meta.club || (typeof THEME_CLUBS!=='undefined' && THEME_CLUBS[tid]));
      out['theme_'+tid] = {
        id:'theme_'+tid,
        cat: isClubMeta ? 'theme-club' : 'theme',
        type:'theme', themeId:tid,
        name:'Giao diện '+meta.name, emoji: em||'',
        club: isClubMeta, logo: isLogoMeta, clubSlug: meta.slug||null, price: meta.price,
        desc: isClubMeta ? ('CLB «'+meta.name+'»') : ('Theme «'+meta.name+'»')
      };
    });
  }
  if(typeof THEME_CLUBS !== 'undefined'){
    Object.keys(THEME_CLUBS).forEach(id=>{
      const cl = THEME_CLUBS[id];
      out['theme_'+id] = {
        id:'theme_'+id, cat:'theme-club', type:'theme', themeId:id,
        name:'Giao diện '+cl.name, emoji:'⚽', club:true,
        clubSlug:cl.slug, price:cl.price||70, desc:'CLB «'+cl.name+'»'
      };
    });
  }
  // Logo bàn (Hội Cờ Tướng…) → tab Giao diện
  if(typeof THEME_LOGOS !== 'undefined'){
    Object.keys(THEME_LOGOS).forEach(id=>{
      const L = THEME_LOGOS[id];
      out['theme_'+id] = {
        id:'theme_'+id, cat:'theme', type:'theme', themeId:id,
        name:'Giao diện '+(L.name||id), emoji:'♟️', club:false,
        clubSlug: L.slug||null, logo:true, price:L.price||80,
        desc:'Theme «'+(L.name||id)+'»'
      };
    });
  }
  Object.keys(out).forEach(k=>{
    const it = out[k];
    if(!it || it.type !== 'theme') return;
    const tid = it.themeId;
    // 1) Logo bàn (Hội Cờ Tướng) → Giao diện
    if(it.logo || (typeof THEME_LOGOS!=='undefined' && THEME_LOGOS[tid]) || (THEME_META[tid]&&THEME_META[tid].logo)){
      it.cat = 'theme'; it.club = false; it.logo = true; return;
    }
    // 2) CLB bóng đá thật trong THEME_CLUBS → Bóng đá
    if((typeof THEME_CLUBS!=='undefined' && THEME_CLUBS[tid]) || (it.club && !it.logo)){
      it.cat = 'theme-club'; it.club = true; return;
    }
    // 4) Còn lại → Giao diện
    it.cat = 'theme'; it.club = false;
  });
  const sets = (typeof PIECE_SETS !== 'undefined' && PIECE_SETS && Object.keys(PIECE_SETS).length)
    ? PIECE_SETS
    : {
        'default': { id:'default', name:'Mặc định (cổ điển)', price:0, free:true, isDefault:true, desc:'Quân chữ tròn cổ điển' },
        'co-go-truyen-thong': { id:'co-go-truyen-thong', name:'Gỗ truyền thống', price:80, folder:'co-go-truyen-thong', desc:'Bộ quân gỗ truyền thống (SVG)' }
      };
  Object.keys(sets).forEach(id=>{
    const s = sets[id];
    const isDef = !!(s.isDefault || id === 'default');
    const preview = isDef ? null : ('https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/quanco/'+(s.folder||id)+'/do_tuong.svg');
    out['pieceset_'+id] = {
      id:'pieceset_'+id, cat:'piece-set', type:'piece-set', pieceSetId:id,
      name: isDef ? (s.name||'Mặc định') : ('Quân «'+(s.name||id)+'»'),
      emoji: isDef ? '⭕' : '♟️',
      price: isDef ? 0 : +(s.price||80),
      desc: s.desc || (isDef ? 'Quân chữ cổ điển' : 'Bộ quân SVG'),
      previewUrl: preview,
      isDefault: isDef,
      sortOrder: isDef ? 0 : 10
    };
  });
  // luôn có style mặc định
  if(!out['pieceset_default']){
    out['pieceset_default'] = {
      id:'pieceset_default', cat:'piece-set', type:'piece-set', pieceSetId:'default',
      name:'Mặc định (cổ điển)', emoji:'⭕', price:0, isDefault:true, sortOrder:0,
      desc:'Quân chữ tròn cổ điển — không dùng SVG', previewUrl:null
    };
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
  const club = (typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[themeId])
    ? THEME_CLUBS[themeId]
    : ((typeof THEME_LOGOS !== 'undefined' && THEME_LOGOS[themeId]) ? THEME_LOGOS[themeId] : null);
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
  if(!THEMES[themeId]
    && !(typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[themeId])
    && !(typeof THEME_LOGOS !== 'undefined' && THEME_LOGOS[themeId])) themeId = 'wood';
  if(!opts.force && !isThemeUnlocked(themeId)){
    setCheckInStatus('Giao diện «'+(THEME_META[themeId]?.name||themeId)+'» đang khóa. Đủ coin để mở.', true);
    return false;
  }
  const isClub = !!(typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[themeId])
    || !!(typeof THEME_LOGOS !== 'undefined' && THEME_LOGOS[themeId]);
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
  const club = (typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS[themeId])
    ? THEME_CLUBS[themeId]
    : ((typeof THEME_LOGOS !== 'undefined' && THEME_LOGOS[themeId]) ? THEME_LOGOS[themeId] : null);
  const wrap = document.getElementById('boardWrap') || document.querySelector('.board-wrap');
  if(wrap){ if(club) wrap.setAttribute('data-flag', themeId); else wrap.removeAttribute('data-flag'); }
  try{ const oldF = document.getElementById('clubLogoOutlineFilter'); if(oldF) oldF.remove(); }catch(e){}
  if(!club){ if(bg) bg.setAttribute('fill', 'url(#woodGrain)'); return; }
  if(bg) bg.setAttribute('fill', club.bg || '#111');
  const opacity = club.opacity != null ? club.opacity : 0.25;
  const sizeLogo = club.sizeLogo != null ? club.sizeLogo : 0.75;
  const slug = club.slug || themeId;
  const logoUrl = (typeof footyLogoUrl === 'function') ? footyLogoUrl(slug)
    : ('https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/logo/'+slug+'.svg');
  const imgW = W * sizeLogo, imgH = H * sizeLogo;
  const imgX = (W - imgW) / 2, imgY = (H - imgH) / 2;
  const img = document.createElementNS(ns, 'image');
  img.setAttribute('id', 'boardFlagImage');
  img.setAttribute('href', logoUrl);
  img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', logoUrl);
  img.setAttribute('x', String(imgX)); img.setAttribute('y', String(imgY));
  img.setAttribute('width', String(imgW)); img.setAttribute('height', String(imgH));
  img.setAttribute('opacity', String(opacity));
  img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  layer.appendChild(img);
}


function ensureThemeSwatches(){
  const row = document.getElementById('themeRow');
  if(!row) return;
  // Chỉ giữ 4 theme miễn phí trên menu
  const FREE = ['wood','jade','rosewood','marble'];
  const existing = new Set();
  row.querySelectorAll('.theme-swatch[data-theme]').forEach(b=>{
    const id = b.dataset.theme;
    if(FREE.includes(id)) existing.add(id);
    else b.remove(); // ẩn/xóa theme đã mua & club khỏi menu
  });
  FREE.forEach(id=>{
    if(existing.has(id)) return;
    const meta = (typeof THEME_META !== 'undefined' && THEME_META[id]) || {};
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-swatch theme-'+id;
    btn.dataset.theme = id;
    btn.dataset.price = '0';
    btn.title = (meta.name || id) + ' (Miễn phí)';
    btn.addEventListener('click', ()=> trySelectTheme(id));
    row.appendChild(btn);
  });
}


function refreshThemeLocks(){
  try{ ensureThemeSwatches(); }catch(e){}
  const FREE = ['wood','jade','rosewood','marble'];
  document.querySelectorAll('.theme-swatch').forEach(btn=>{
    const id = btn.dataset.theme;
    const price = +(btn.dataset.price || THEME_META[id]?.price || 0);
    const unlocked = isThemeUnlocked(id);
    // Menu chỉ hiện 4 theme miễn phí
    if(!FREE.includes(id)){
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';
    btn.classList.toggle('locked', false);
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
  // Giữ coins cũ trong lúc load — tránh nháy 0 → số thật trên UI
  const prevCoins = (coinState && coinState.coins != null) ? Math.max(0, Math.floor(+coinState.coins||0)) : null;
  coinState = {
    coins: prevCoins != null ? prevCoins : 0,
    unlocked: ['wood','jade','rosewood','marble'],
    lastCheckIn: '',
    inventory: {},
    active: {},
    achievements: [],
    wins: 0,
    purchases: 0,
    checkInStreak: 0,
    friendCount: 0,
    preferredTheme: null,
    unlockedPieceSets: [],
    activePieceSet: null
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
      coinState.cheatBonus = Math.max(0, +(p.cheatBonus||0)) + Math.max(0, +(p.cheatUses||0));
      // cheatUses (giftcode cũ) đã gộp vào bonus

      coinState.preferredTheme = p.preferredTheme || null;
      coinState.achievements = Array.isArray(p.achievements) ? p.achievements.slice() : [];
      coinState.wins = Math.max(0, +(p.wins||0));
      coinState.purchases = Math.max(0, +(p.purchases||0));
      coinState.checkInStreak = Math.max(0, +(p.checkInStreak||0));
      coinState.friendCount = Math.max(0, +(p.friendCount||0));
      coinState.unlockedPieceSets = Array.isArray(p.unlockedPieceSets) ? p.unlockedPieceSets.slice() : [];
      coinState.activePieceSet = p.activePieceSet || null;
      if(!coinState.inventory || typeof coinState.inventory !== 'object') coinState.inventory = {};
      (coinState.unlockedPieceSets||[]).forEach(pid=>{
        if(!pid || pid==='default') return;
        const sid = 'pieceset_'+pid;
        if(!coinState.inventory[sid]) coinState.inventory[sid] = 1;
      });
      try{ if(typeof persistUnlockedPieceSets==='function') persistUnlockedPieceSets(); }catch(e){}
    } else {
      const snap = await fb.db.ref('admin/wallets/'+ident.id).once('value');
      const w = snap.val() || {};
      coinState.coins = Math.max(0, +(w.coins||0));
      coinState.lastCheckIn = w.lastCheckIn || '';
      coinState.inventory = (w.inventory && typeof w.inventory === 'object') ? w.inventory : {};
      coinState.active = {};
      coinState.cheatDate = w.cheatDate || '';
      coinState.cheatUsed = Math.max(0, +(w.cheatUsed||0));
      coinState.cheatBonus = Math.max(0, +(w.cheatBonus||0)) + Math.max(0, +(w.cheatUses||0));

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
  try{ if(typeof updatePlayerSessionCoins==='function') updatePlayerSessionCoins(); else if(typeof renderPlayerSessionUI==='function') renderPlayerSessionUI(); }catch(e){}
  try{ refreshCheatUsesUI(); }catch(e){}
  try{ evaluateAchievements(true, { skipReload:true }).then(()=> renderAchievementsUI()).catch(()=> renderAchievementsUI()); }catch(e){
    try{ renderAchievementsUI(); }catch(e2){}
  }

  try{
    let t = coinState.preferredTheme || null;
    if(!t){ try{ t = localStorage.getItem(THEME_STORAGE_KEY); }catch(e){} }
    if(t && isThemeUnlocked(t)){
      const cur = (function(){ try{ return localStorage.getItem(THEME_STORAGE_KEY); }catch(e){ return null; } })();
      // chỉ apply khi khác theme hiện tại — tránh render lại liên tục
      if(t !== cur || !(document.getElementById('boardFlagLayer')||{}).hasChildNodes){
        applyTheme(t, { force:true, preview:true });
      }
    }
  }catch(e){}
  try{
    let ps = coinState.activePieceSet || null;
    if(!ps){ try{ ps = localStorage.getItem('cotuong_piece_set'); }catch(e){} }
    const curPs = (typeof getActivePieceSetId==='function') ? getActivePieceSetId() : null;
    if(ps && ps !== curPs && typeof isPieceSetUnlocked==='function' && isPieceSetUnlocked(ps)){
      if(typeof applyPieceSet==='function') applyPieceSet(ps, { force:true, preview:true });
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
        unlockedPieceSets: Array.isArray(coinState.unlockedPieceSets)?coinState.unlockedPieceSets:[],
        activePieceSet: coinState.activePieceSet || null,
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
  try{ if(typeof rebuildShopItems==='function') rebuildShopItems(); }catch(e){}
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

function shopItemIconHtml(it){
  if(it && (it.type === 'piece-set' || it.cat === 'piece-set')){
    if(it.isDefault || it.pieceSetId === 'default'){
      return '<span class="gift-piece-fallback" title="Mặc định">♟️</span>';
    }
    const folder = it.pieceSetId || String(it.id||'').replace(/^pieceset_/,'') || '';
    const url = it.previewUrl || ('https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/quanco/'+folder+'/do_tuong.svg');
    const safeName = String(it.name||'').replace(/"/g,'');
    return '<img class="gift-piece-preview" src="'+url+'" alt="'+safeName+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.style.display=\'none\';var s=document.createElement(\'span\');s.className=\'gift-piece-fallback\';s.textContent=\'♟️\';this.parentNode&&this.parentNode.appendChild(s);">';
  }
  if(it && (it.club || it.logo || it.clubSlug)){
    const slug = it.clubSlug || (THEME_META[it.themeId] && THEME_META[it.themeId].slug)
      || (typeof THEME_LOGOS!=='undefined' && THEME_LOGOS[it.themeId] && THEME_LOGOS[it.themeId].slug);
    if(slug) return footyLogoImgHtml(slug, 'gift-club-logo', it.name||'');
  }
  const em = (it && it.emoji && String(it.emoji).trim()) ? it.emoji : '🎁';
  return em;
}

function renderShopList(){
  /* HIDE_OWNED_PIECE */

  const box = document.getElementById('shopList');
  if(!box) return;
  try{
    if(typeof SHOP_ITEMS === 'undefined' || !SHOP_ITEMS || !Object.keys(SHOP_ITEMS).length){
      if(typeof buildShopCatalog === 'function') SHOP_ITEMS = buildShopCatalog();
      if(typeof mergeVipPackagesIntoShop === 'function') mergeVipPackagesIntoShop();
    }
  }catch(e){ console.warn('rebuild shop', e); }
  let tab = shopTab || 'all';
  if(tab === 'theme-flag') tab = 'all';
  const bal = document.getElementById('shopCoinBalance');
  if(bal) bal.textContent = String(coinState.coins||0);
  if(tab === 'auction'){
    renderAuctionList(box);
    return;
  }
  const inv = coinState.inventory || {};
  const gPanel = document.getElementById('shopGiftcodePanel');
  if(gPanel){
    if(tab === 'giftcode'){ gPanel.hidden = false; box.innerHTML=''; return; }
    else gPanel.hidden = true;
  }
  const items = Object.values(SHOP_ITEMS).filter(it => {
    if(tab === 'all'){
      if(it.type === 'theme' || it.type === 'piece-set' || it.type === 'vip') return false;
      if(['theme','theme-club','piece-set','vip','auction'].includes(it.cat)) return false;
    } else if(tab === 'theme'){
      if(it.type !== 'theme' || it.cat !== 'theme') return false;
    } else if(tab === 'theme-club'){
      if(it.type !== 'theme' || it.cat !== 'theme-club') return false;
    } else if(tab === 'piece-set'){
      if(it.type !== 'piece-set' && it.cat !== 'piece-set') return false;
    } else if(tab !== it.cat) return false;
    if(it.type === 'theme') return !isThemeUnlocked(it.themeId);
    if(it.type === 'piece-set' || it.cat === 'piece-set'){
      return true;
    }
    if(it.type === 'vip') return true;
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
    const isPiece = it.type === 'piece-set';
    const ownedGift = +((coinState.inventory||{})[it.id]||0);
    const ownedTheme = isTheme && isThemeUnlocked(it.themeId);
    const ownedPiece = isPiece && (it.isDefault || it.pieceSetId==='default' || (typeof isPieceSetUnlocked==='function' && isPieceSetUnlocked(it.pieceSetId)));
    let activePiece = false;
    try{
      if(isPiece){
        const cur = (typeof getActivePieceSetId==='function') ? getActivePieceSetId() : null;
        activePiece = (it.isDefault || it.pieceSetId==='default') ? !cur : (cur === it.pieceSetId);
      }
    }catch(e){}
    const card = document.createElement('div');
    card.className = 'gift-card'+((ownedTheme||ownedPiece)?' owned':'');
    const emoji = (typeof shopItemIconHtml === 'function') ? shopItemIconHtml(it) : (it.emoji || '🎁');
    let descExtra = '';
    if(isTheme) descExtra = ownedTheme ? ' · Đã mở' : ' · Mở khóa giao diện';
    else if(isPiece) descExtra = activePiece ? ' · Đang dùng' : (ownedPiece ? ' · Đã mở' : ' · Bộ quân SVG');
    else if(ownedGift) descExtra = ' · Có: '+ownedGift;
    const btnLabel = (isTheme||isPiece) ? ((ownedTheme||ownedPiece) ? (activePiece?'Đang dùng':'Dùng') : 'Mở khóa') : 'Mua';
    const priceHtml = ((isTheme && ownedTheme)||(isPiece && ownedPiece))
      ? '<div class="gift-price">'+(activePiece?'Đang dùng':'Đã có')+'</div>'
      : '<div class="gift-price"><i class="fa-regular fa-coins"></i> '+(it.price||0)+'</div>';
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
      else if(it.type==='piece-set' && typeof isPieceSetUnlocked==='function' && isPieceSetUnlocked(it.pieceSetId)){
        try{ applyPieceSet(it.pieceSetId, { force:true }); setShopStatus('Đã dùng bộ «'+it.name+'».', false); }catch(e){}
      } else buyShopItem(it.id);
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

  if(it.type === 'piece-set' && it.pieceSetId){
    const pid = it.pieceSetId;
    // Mặc định / đã mở → chỉ cần Dùng
    if(pid === 'default' || it.isDefault || (typeof isPieceSetUnlocked==='function' && isPieceSetUnlocked(pid))){
      try{ applyPieceSet(pid === 'default' || it.isDefault ? null : pid, { force:true }); }catch(e){}
      setShopStatus(pid==='default'||it.isDefault ? 'Đã về quân mặc định.' : ('Đã dùng bộ «'+it.name+'».'), false);
      renderShopList();
      return;
    }
    if(have < need){
      setShopStatus('Không đủ coin.', true);
      showCoinPopup({ warn:true, icon:'💸', title:'Không đủ coin', html:'<ul class="coin-popup-list"><li>Giá: <b>'+need+'</b></li><li>Bạn có: <b>'+have+'</b></li></ul>' });
      return;
    }
    const okP = await showCoinPopup({
      confirm:true, icon:'♟️', title:'Mở khóa bộ quân', okLabel:'Mua', cancelLabel:'Hủy',
      html:'<ul class="coin-popup-list"><li>Bộ: <b>'+it.name+'</b></li><li>Giá: <b>'+need+'</b> coin</li><li>Sau mua còn: <b>'+(have-need)+'</b></li></ul>'
    });
    if(!okP) return;
    coinState.coins = have - need;
    if(!Array.isArray(coinState.unlockedPieceSets)) coinState.unlockedPieceSets = [];
    if(!coinState.unlockedPieceSets.includes(pid)) coinState.unlockedPieceSets.push(pid);
    coinState.activePieceSet = pid;
    if(!coinState.inventory) coinState.inventory = {};
    coinState.inventory[it.id] = Math.max(1, +(coinState.inventory[it.id]||0));
    if(!Array.isArray(coinState.unlockedPieceSets)) coinState.unlockedPieceSets = [];
    if(pid && !coinState.unlockedPieceSets.includes(pid)) coinState.unlockedPieceSets.push(pid);
    try{ if(typeof persistUnlockedPieceSets==='function') persistUnlockedPieceSets(); }catch(e){}
    try{ localStorage.setItem('cotuong_piece_set', pid); }catch(e){}
    coinState.purchases = Math.max(0, +(coinState.purchases||0)) + 1;
    await saveCoinStateToPlayer();
    try{ applyPieceSet(pid, { force:true }); }catch(e){}
    renderShopList();
    setShopStatus('Đã mở bộ quân «'+it.name+'». Còn '+coinState.coins+' coin.', false);
    showCoinPopup({ icon:'✅', title:'Mua thành công', html:'<ul class="coin-popup-list"><li>Bộ: <b>'+it.name+'</b></li><li>Còn: <b>'+coinState.coins+'</b></li></ul>' });
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
        newExp = 0;
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
    const club = (typeof THEME_CLUBS !== 'undefined' && THEME_CLUBS) ? THEME_CLUBS[tid] : null;
    if(!club) return;

    btn.classList.add('theme-swatch-has-flag', 'theme-swatch-club');
    // Xóa img cũ (gây lệch)
    btn.querySelectorAll('.theme-swatch-club-logo, .theme-swatch-flag, .theme-swatch-fallback, img').forEach(el=>{
      try{ el.remove(); }catch(e){}
    });

    const url = (typeof footyLogoUrl === 'function') ? footyLogoUrl(club.slug) : '';
    if(url){
      // background-image: luôn căn giữa, không phụ thuộc box logo SVG
      btn.style.backgroundColor = '#121212';
      btn.style.backgroundImage = 'url("'+url+'")';
      btn.style.backgroundRepeat = 'no-repeat';
      btn.style.backgroundPosition = 'center center';
      btn.style.backgroundSize = '68% 68%';
    } else {
      btn.style.backgroundImage = 'none';
      btn.textContent = (club.name || '?').slice(0, 2).toUpperCase();
      btn.style.fontSize = '10px';
      btn.style.fontWeight = '700';
      btn.style.color = '#e8c878';
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

let GLYPHS = {
  red:   { general: '帥', advisor: '仕', elephant: '相', horse: '傌', chariot: '俥', cannon: '炮', soldier: '兵' },
  black: { general: '將', advisor: '士', elephant: '象', horse: '馬', chariot: '車', cannon: '砲', soldier: '卒' }
};

/* Shop mobile category drawer */
function closeShopMobileNav(){
  document.getElementById('shopOverlay')?.classList.remove('shop-nav-open');
}
function toggleShopNav(){
  document.getElementById('shopOverlay')?.classList.toggle('shop-nav-open');
}
document.getElementById('shopNavToggle')?.addEventListener('click', (e)=>{ e.stopPropagation(); toggleShopNav(); });
document.getElementById('shopNavBackdrop')?.addEventListener('click', closeShopMobileNav);
document.getElementById('shopTabs')?.addEventListener('click', (e)=>{
  if(e.target.closest('.shop-tab')) closeShopMobileNav();
});


function isShopItemOwned(it){
  if(!it) return false;
  if((coinState.inventory||{})[it.id] > 0) return true;
  if(it.cat === 'piece-set' || it.type === 'piece-set'){
    const pid = it.pieceSetId || it.id;
    if(Array.isArray(coinState.unlockedPieceSets) && coinState.unlockedPieceSets.includes(pid)) return true;
    if(coinState.activePieceSet === pid) return true;
  }
  if(it.themeId && Array.isArray(coinState.unlocked) && coinState.unlocked.includes(it.themeId)) return true;
  return false;
}

/*OWNED_FILTER_WRAP removed*/



/* HEADER_BTN_REBIND — đảm bảo nút cửa hàng / kho hoạt động */
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
    bind('shopCloseBtn', typeof closeShopPanel === 'function' ? closeShopPanel : function(){
      document.getElementById('shopOverlay')?.classList.remove('show');
    });
    bind('shopToInvBtn', typeof openInvPanel === 'function' ? openInvPanel : function(){
      document.getElementById('shopOverlay')?.classList.remove('show');
      document.getElementById('invOverlay')?.classList.add('show');
      try{ if(typeof renderInventoryList==='function') renderInventoryList(); }catch(e){}
    });
    bind('invCloseBtn', typeof closeInvPanel === 'function' ? closeInvPanel : function(){
      document.getElementById('invOverlay')?.classList.remove('show');
    });
    bind('invToShopBtn', typeof openShopPanel === 'function' ? openShopPanel : function(){
      document.getElementById('invOverlay')?.classList.remove('show');
      document.getElementById('shopOverlay')?.classList.add('show');
    });
    bind('openShopBtn', typeof openShopPanel === 'function' ? openShopPanel : null);
    bind('openInvBtn', typeof openInvPanel === 'function' ? openInvPanel : null);
  });
})();
