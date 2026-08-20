/**
 * Bộ quân cờ SVG
 * Thêm style mới: thêm vào PIECE_SETS + upload quanco/<folder>/ trên GitHub
 * Chọn "default" hoặc null = quân chữ mặc định (không SVG)
 */
const PIECE_SVG_BASE = 'https://raw.githubusercontent.com/nokiapro/cotuong/refs/heads/main/quanco/';
const PIECE_FILE_KEYS = {
  general:'tuong', advisor:'si', elephant:'tinh', horse:'ma',
  chariot:'xe', cannon:'phao', soldier:'tot'
};

const PIECE_SETS = {
  'default': {
    id: 'default',
    name: 'Mặc định (cổ điển)',
    price: 0,
    free: true,
    isDefault: true,
    desc: 'Quân chữ tròn cổ điển - không dùng SVG'
  },
  'co-go-truyen-thong': {
    id: 'co-go-truyen-thong',
    name: 'Gỗ truyền thống',
    price: 80,
    folder: 'co-go-truyen-thong',
    size: 0.88,
    free: false,
    desc: 'Bộ quân gỗ truyền thống'
  },
  'co-vua': {
    id: 'co-vua',
    name: 'Cờ Vua',
    price: 80,
    folder: 'co-vua',
    size: 0.88,
    free: false,
    desc: 'Bộ quân cờ phong cách cờ vua'
  },
  'go-bong': {
    id: 'go-bong',
    name: 'Gỗ Bóng',
    price: 80,
    folder: 'go-bong',
    size: 0.88,
    free: false,
    desc: 'Bộ quân cờ gỗ bóng'
  },
  'kim-loai-bac': {
    id: 'kim-loai-bac',
    name: 'Kim Loại Bạc',
    price: 80,
    folder: 'kim-loai-bac',
    size: 0.88,
    free: false,
    desc: 'Bộ quân cờ kim loại bạc'
  },
  'kim-loai-den': {
    id: 'kim-loai-den',
    name: 'Kim Loại Đen',
    price: 80,
    folder: 'kim-loai-den',
    size: 0.88,
    free: false,
    desc: 'Bộ quân cờ kim loại đen'
  },
  'bat-giac': {
    id: 'bat-giac',
    name: 'Bát Giác',
    price: 80,
    folder: 'bat-giac',
    size: 0.88,
    free: false,
    desc: 'Bộ quân cờ bát giác'
  },
  'bat-giac-trang': {
    id: 'bat-giac-trang',
    name: 'Bát Giác Trắng',
    price: 80,
    folder: 'bat-giac-trang',
    size: 0.88,
    free: false,
    desc: 'Bộ quân cờ bát giác trắng'
  }
};

function pieceSvgUrl(setId, color, type){
  if(!setId || setId === 'default') return null;
  const set = PIECE_SETS && PIECE_SETS[setId];
  if(set && set.isDefault) return null;
  const folder = (set && set.folder) || setId;
  if(set && set.files && set.files[color] && set.files[color][type])
    return PIECE_SVG_BASE + folder + '/' + set.files[color][type];
  const key = PIECE_FILE_KEYS[type];
  if(!key) return null;
  return PIECE_SVG_BASE + folder + '/' + (color==='red'?'do':'den') + '_' + key + '.svg';
}

function getActivePieceSetId(){
  try{ if(typeof coinState!=='undefined' && coinState && coinState.activePieceSet) return coinState.activePieceSet; }catch(e){}
  try{
    const v = localStorage.getItem('cotuong_piece_set');
    if(!v || v === 'default') return null;
    return v;
  }catch(e){ return null; }
}

function setActivePieceSetId(id){
  if(id === 'default') id = null;
  try{ if(typeof coinState!=='undefined' && coinState) coinState.activePieceSet = id||null; }catch(e){}
  try{
    if(id) localStorage.setItem('cotuong_piece_set', id);
    else localStorage.removeItem('cotuong_piece_set');
  }catch(e){}
}

function isPieceSetUnlocked(id){
  if(!id || id === 'default') return true;
  const set = PIECE_SETS && PIECE_SETS[id];
  if(!set) return false;
  if(set.free || set.isDefault) return true;
  try{
    const list = (typeof coinState!=='undefined' && coinState && Array.isArray(coinState.unlockedPieceSets)) ? coinState.unlockedPieceSets : [];
    if(list.indexOf(id)>=0) return true;
  }catch(e){}
  try{
    const raw = localStorage.getItem('cotuong_unlocked_piece_sets');
    if(raw){ const arr = JSON.parse(raw); if(Array.isArray(arr) && arr.indexOf(id)>=0) return true; }
  }catch(e){}
  return false;
}

function persistUnlockedPieceSets(){
  try{
    const list = (typeof coinState!=='undefined' && coinState && Array.isArray(coinState.unlockedPieceSets)) ? coinState.unlockedPieceSets : [];
    localStorage.setItem('cotuong_unlocked_piece_sets', JSON.stringify(list));
  }catch(e){}
}

function applyPieceSet(id, opts){
  opts = opts || {};
  if(id === 'default') id = null;
  if(id){
    if(!PIECE_SETS[id]) return false;
    if(PIECE_SETS[id].isDefault){ id = null; }
    else if(!opts.force && !isPieceSetUnlocked(id)) return false;
  }
  try{
    const cur = getActivePieceSetId();
    if(!opts.forceRedraw && ((cur||null) === (id||null))){
      // đã đúng bộ quân — không render lại
      return true;
    }
  }catch(e){}
  setActivePieceSetId(id||null);
  try{
    if(typeof pieceElements!=='undefined' && pieceElements){
      try{ pieceElements.forEach(function(g){ if(g&&g.parentNode) g.parentNode.removeChild(g); }); }catch(e){}
      try{ pieceElements.clear(); }catch(e){}
    }
  }catch(e){}
  try{ if(typeof resetPieceLayer==='function') resetPieceLayer(); }catch(e){}
  try{ if(typeof renderPieces==='function') renderPieces(); }catch(e){}
  try{
    if(!opts.preview && typeof coinState!=='undefined' && coinState){
      coinState.activePieceSet = id||null;
      if(typeof saveCoinStateToPlayer==='function') saveCoinStateToPlayer();
    }
  }catch(e){}
  return true;
}

try{
  window.PIECE_SETS=PIECE_SETS; window.pieceSvgUrl=pieceSvgUrl;
  window.applyPieceSet=applyPieceSet; window.isPieceSetUnlocked=isPieceSetUnlocked;
  window.getActivePieceSetId=getActivePieceSetId; window.setActivePieceSetId=setActivePieceSetId;
  window.persistUnlockedPieceSets=persistUnlockedPieceSets;
}catch(e){}
