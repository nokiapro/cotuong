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
    
    const ov = ensureClanModal();
    const body = document.getElementById('clanMineBody');
    ov.hidden = false;
    ov.style.display = 'flex';
    ov.classList.add('is-open', 'show');
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
      if(!(await appConfirm('Giải tán clan? Thao tác không hoàn tác.', 'Giải tán'))) return;
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

    
  }catch(err){
    console.error('[openMyClanModal]', err);
    appAlert('Lỗi clan: '+(err && err.message ? err.message : err), 'Lỗi');
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
        if(!(await appConfirm('Xóa clan «'+btn.dataset.id+'»?', 'Xóa clan'))) return;
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