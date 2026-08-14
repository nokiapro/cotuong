const THEMES = {
  wood: {
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#3fae7a', accentGlow: '#7fe0b4'
  },
  jade: {
    wood1: '#1f5e46', wood2: '#154536', wood3: '#0c2a20',
    grain1: '#bdeed8', grain2: '#8fd6b8', grain3: '#5fb894',
    accent: '#e0b84a', accentGlow: '#f5d888'
  },
  rosewood: {
    wood1: '#6e2a20', wood2: '#4f1a14', wood3: '#33100c',
    grain1: '#e8ab93', grain2: '#d68467', grain3: '#b96448',
    accent: '#7fe0b4', accentGlow: '#b7f2d8'
  },
  marble: {
    wood1: '#c9c0ac', wood2: '#a89c84', wood3: '#8a7d64',
    grain1: '#f7f2e8', grain2: '#ece2cf', grain3: '#d9c9ac',
    accent: '#3a6ea8', accentGlow: '#7fb0e0'
  }
};

const THEME_META = {
  wood: { name: 'Gỗ trầm', price: 0 },
  jade: { name: 'Ngọc bích', price: 0 },
  rosewood: { name: 'Hồng mộc', price: 0 },
  marble: { name: 'Cẩm thạch', price: 0 }
};

const THEME_FLAGS = {};

const THEME_CLUBS = {
  'hoicotuong': {
    slug: 'hoi-co-tuong-logos',
    name: 'Hội Cờ Tướng',
    price: 100,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'arsenal': {
    slug: 'arsenal-logos',
    name: 'Arsenal',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'aston-villa': {
    slug: 'aston-villa-logos',
    name: 'Aston Villa',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'chelsea': {
    slug: 'chelsea-logos',
    name: 'Chelsea',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'everton': {
    slug: 'everton-logos',
    name: 'Everton',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'liverpool': {
    slug: 'liverpool-logos',
    name: 'Liverpool',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'manchester-city': {
    slug: 'manchester-city-logos',
    name: 'Manchester City',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'manchester-united': {
    slug: 'manchester-united-logos',
    name: 'Manchester United',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'newcastle-united': {
    slug: 'newcastle-logos',
    name: 'Newcastle United',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'tottenham-hotspur': {
    slug: 'tottenham-logos',
    name: 'Tottenham Hotspur',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'crystal': {
    slug: 'crystal-logos',
    name: 'Crystal Palace',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'brighton': {
    slug: 'brighton-logos',
    name: 'Brighton & Hove Albion',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'brentford': {
    slug: 'brentford-logos',
    name: 'Brentford',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'bournemouth': {
    slug: 'bournemouth-logos',
    name: 'Bournemouth',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'fulham': {
    slug: 'fulham-logos',
    name: 'Fulham',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'hull-city': {
    slug: 'hull-city-logos',
    name: 'Hull City',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'leeds-united': {
    slug: 'leeds-united-logos',
    name: 'Leeds United',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'nottingham-forest': {
    slug: 'nottingham-forest-logos',
    name: 'Nottingham Forest',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'sunderland': {
    slug: 'sunderland-logos',
    name: 'Sunderland',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'west-ham': {
    slug: 'west-ham-logos',
    name: 'West Ham United',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'birmingham': {
    slug: 'birmingham-logos',
    name: 'Birmingham City',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'blackburn': {
    slug: 'blackburn-logos',
    name: 'Blackburn Rovers',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'bolton': {
    slug: 'bolton-logos',
    name: 'Bolton Wanderers',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'charlton': {
    slug: 'charlton-logos',
    name: 'Charlton Athletic',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'burnley': {
    slug: 'burnley-logos',
    name: 'Burnley',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'middlesbrough': {
    slug: 'middlesbrough-logos',
    name: 'Middlesbrough',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'norwich-city': {
    slug: 'norwich-city-logos',
    name: 'Norwich City',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'stoke-city': {
    slug: 'stoke-city-logos',
    name: 'Stoke City',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'southampton': {
    slug: 'southampton-logos',
    name: 'Southampton',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'Sheffield United': {
    slug: 'sheffield-united-logos',
    name: 'Sheffield United',
    price: 75,
    opacity: 0.25,
    sizeLogo: 0.75,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  },
  'argentina': {
    slug: 'argentina',
    name: 'Argentina',
    price: 45,
    opacity: 0.25,
    sizeLogo: 1,
    outline: true,
    outlineWidth: 1.5,
    outlineColor: '#ffffff',
    line: 'black',
    bg: '#38003C',
    wood1: '#8a5a34', wood2: '#6e4324', wood3: '#4a2c17',
    grain1: '#e7c98d', grain2: '#dab976', grain3: '#c9a563',
    accent: '#c6eeda', accentGlow: '#7fe0b4'
  }
};

const HOLIDAY_THEMES = {};

const SHOP_GIFTS = [
  ['🧸', 'Gấu bông', 'plush', 20],
  ['🐻', 'Gấu nâu', 'plush', 22],
  ['🐼', 'Gấu trúc', 'plush', 28],
  ['🐰', 'Thỏ bông', 'plush', 18],
  ['🦊', 'Cáo bông', 'plush', 24],
  ['🐨', 'Koala', 'plush', 26],
  ['🐯', 'Hổ bông', 'plush', 30],
  ['🦁', 'Sư tử bông', 'plush', 30],
  ['🐮', 'Bò bông', 'plush', 16],
  ['🐷', 'Heo bông', 'plush', 16],
  ['🐸', 'Ếch bông', 'plush', 15],
  ['🐵', 'Khỉ bông', 'plush', 18],
  ['🐔', 'Gà bông', 'plush', 14],
  ['🐧', 'Cánh cụt', 'plush', 22],
  ['🦄', 'Kỳ lân bông', 'plush', 40],
  ['🐙', 'Bạch tuộc bông', 'plush', 20],
  ['🦋', 'Bướm bông', 'plush', 15],
  ['🐢', 'Rùa bông', 'plush', 17],
  ['🐳', 'Cá voi bông', 'plush', 25],
  ['🐬', 'Cá heo bông', 'plush', 24],
  ['🌹', 'Hồng đỏ', 'flower', 15],
  ['🥀', 'Hồng héo', 'flower', 12],
  ['🌺', 'Dâm bụt', 'flower', 14],
  ['🌻', 'Hướng dương', 'flower', 18],
  ['🌼', 'Cúc họa mi', 'flower', 12],
  ['🌷', 'Tulip', 'flower', 16],
  ['🌱', 'Mầm xanh', 'flower', 8],
  ['🌲', 'Thông', 'flower', 10],
  ['🌳', 'Cây xanh', 'flower', 10],
  ['🌴', 'Cọ', 'flower', 12],
  ['🌵', 'Xương rồng', 'flower', 11],
  ['🌾', 'Lúa', 'flower', 9],
  ['🌿', 'Lá thơm', 'flower', 9],
  ['☘️', 'Cỏ ba lá', 'flower', 10],
  ['🍀', 'Cỏ may mắn', 'flower', 14],
  ['🍁', 'Lá phong', 'flower', 11],
  ['🍂', 'Lá thu', 'flower', 10],
  ['🍃', 'Lá bay', 'flower', 9],
  ['🍄', 'Nấm', 'flower', 13],
  ['🪸', 'San hô', 'flower', 20],
  ['🪷', 'Hoa sen', 'flower', 25],
  ['🪻', 'Hoa lan', 'flower', 22],
  ['💐', 'Bó hoa', 'flower', 35],
  ['🌸', 'Anh đào', 'flower', 17],
  ['🐱', 'Mèo', 'pet', 40],
  ['🐈', 'Mèo trắng', 'pet', 42],
  ['🐈‍⬛', 'Mèo đen', 'pet', 42],
  ['🐶', 'Cún', 'pet', 45],
  ['🦮', 'Corgi', 'pet', 48],
  ['🐕', 'Chó săn', 'pet', 44],
  ['🐩', 'Poodle', 'pet', 46],
  ['🐇', 'Thỏ con', 'pet', 35],
  ['🐹', 'Hamster', 'pet', 28],
  ['🐥', 'Gà con', 'pet', 20],
  ['🐦', 'Chim', 'pet', 22],
  ['🐤', 'Gà vàng', 'pet', 18],
  ['🐉', 'Rồng con', 'pet', 90],
  ['🐟', 'Cá', 'pet', 18],
  ['🐠', 'Cá nhiệt đới', 'pet', 20],
  ['🐡', 'Cá nóc', 'pet', 22],
  ['🐝', 'Ong', 'pet', 16],
  ['🐞', 'Bọ rùa', 'pet', 14],
  ['🦕', 'Khủng long cổ', 'pet', 70],
  ['🦖', 'T-Rex', 'pet', 75],
  ['🐎', 'Ngựa', 'pet', 50],
  ['🦓', 'Ngựa vằn', 'pet', 52],
  ['🦍', 'Khỉ đột', 'pet', 60],
  ['🦘', 'Kangaroo', 'pet', 48],
  ['🎂', 'Bánh kem', 'food', 25],
  ['🧁', 'Bánh cupcake', 'food', 14],
  ['🍩', 'Donut', 'food', 12],
  ['🍪', 'Bánh quy', 'food', 10],
  ['🍬', 'Kẹo', 'food', 8],
  ['🍭', 'Kẹo mút', 'food', 9],
  ['🍫', 'Chocolate', 'food', 14],
  ['🍦', 'Kem ốc quế', 'food', 15],
  ['🧋', 'Trà sữa', 'food', 16],
  ['☕', 'Cà phê', 'food', 10],
  ['🍵', 'Trà', 'food', 9],
  ['🧃', 'Nước ép', 'food', 11],
  ['🍕', 'Pizza', 'food', 18],
  ['🍣', 'Sushi', 'food', 20],
  ['🥟', 'Bánh bao', 'food', 12],
  ['🍿', 'Bắp rang', 'food', 11],
  ['🍎', 'Táo', 'food', 8],
  ['🍐', 'Lê', 'food', 8],
  ['🍊', 'Cam', 'food', 8],
  ['🍋', 'Chanh', 'food', 7],
  ['🍌', 'Chuối', 'food', 7],
  ['🍉', 'Dưa hấu', 'food', 10],
  ['🍇', 'Nho', 'food', 9],
  ['🍓', 'Dâu', 'food', 10],
  ['🍒', 'Cherry', 'food', 9],
  ['🍑', 'Đào', 'food', 9],
  ['🥭', 'Xoài', 'food', 10],
  ['🍍', 'Dứa', 'food', 11],
  ['🥝', 'Kiwi', 'food', 9],
  ['🍅', 'Cà chua', 'food', 7],
  ['🥑', 'Bơ', 'food', 12],
  ['🌽', 'Ngô', 'food', 8],
  ['❤️', 'Trái tim đỏ', 'special', 10],
  ['🧡', 'Trái tim cam', 'special', 10],
  ['💛', 'Trái tim vàng', 'special', 10],
  ['💚', 'Trái tim xanh', 'special', 10],
  ['💙', 'Trái tim blue', 'special', 10],
  ['💜', 'Trái tim tím', 'special', 10],
  ['🖤', 'Trái tim đen', 'special', 12],
  ['🤍', 'Trái tim trắng', 'special', 12],
  ['💕', 'Hai tim', 'special', 14],
  ['💖', 'Tim lấp lánh', 'special', 15],
  ['💘', 'Tim mũi tên', 'special', 14],
  ['💝', 'Tim hộp quà', 'special', 18],
  ['⭐', 'Ngôi sao', 'special', 12],
  ['🌟', 'Sao sáng', 'special', 14],
  ['✨', 'Lấp lánh', 'special', 11],
  ['💫', 'Sao băng', 'special', 16],
  ['👑', 'Vương miện', 'special', 70],
  ['💎', 'Ngọc', 'special', 65],
  ['💍', 'Nhẫn', 'special', 55],
  ['🏆', 'Cúp vàng', 'special', 80],
  ['🥇', 'HC vàng', 'special', 50],
  ['🥈', 'HC bạc', 'special', 40],
  ['🥉', 'HC đồng', 'special', 30],
  ['🎖️', 'Huy chương', 'special', 35],
  ['🎁', 'Hộp quà', 'special', 40],
  ['🎀', 'Nơ', 'special', 15],
  ['🎈', 'Bóng bay', 'special', 12],
  ['🎉', 'Party', 'special', 20],
  ['🎆', 'Pháo hoa', 'special', 30],
  ['🎇', 'Pháo sáng', 'special', 28],
  ['🌈', 'Cầu vồng', 'special', 28],
  ['🌙', 'Trăng', 'special', 32],
  ['☀️', 'Mặt trời', 'special', 25],
  ['⚡', 'Sét', 'special', 22],
  ['🔥', 'Lửa', 'special', 24],
  ['❄️', 'Tuyết', 'special', 22],
  ['💧', 'Giọt nước', 'special', 8],
  ['🌊', 'Sóng', 'special', 20],
  ['🎵', 'Nốt nhạc', 'special', 18],
  ['🎶', 'Giai điệu', 'special', 18],
  ['🔮', 'Quả cầu', 'special', 45],
  ['🧸', 'Teddy VIP', 'plush', 35]
];

const ACHIEVEMENTS = {
  firstWin: {
    id: 'firstWin',
    name: 'Chiến thắng đầu',
    icon: '⭐',
    desc: 'Thắng ván đầu tiên',
    check: s => (s.wins || 0) >= 1
  },
  win10: {
    id: 'win10',
    name: 'Thắng 10 ván',
    icon: '🏆',
    desc: 'Thắng 10 ván cờ',
    check: s => (s.wins || 0) >= 10
  },
  win20: {
    id: 'win20',
    name: 'Thắng 20 ván',
    icon: '🏆',
    desc: 'Thắng 20 ván cờ',
    check: s => (s.wins || 0) >= 20
  },
  win30: {
    id: 'win30',
    name: 'Thắng 30 ván',
    icon: '🏆',
    desc: 'Thắng 30 ván cờ',
    check: s => (s.wins || 0) >= 30
  },
  win40: {
    id: 'win40',
    name: 'Thắng 40 ván',
    icon: '🏆',
    desc: 'Thắng 40 ván cờ',
    check: s => (s.wins || 0) >= 40
  },
  win50: {
    id: 'win50',
    name: 'Kỳ thủ cứng',
    icon: '♟️',
    desc: 'Thắng 50 ván',
    check: s => (s.wins || 0) >= 50
  },
  win60: {
    id: 'win60',
    name: 'Thắng 60 ván',
    icon: '🏆',
    desc: 'Thắng 60 ván cờ',
    check: s => (s.wins || 0) >= 60
  },
  win70: {
    id: 'win70',
    name: 'Thắng 70 ván',
    icon: '🏆',
    desc: 'Thắng 70 ván cờ',
    check: s => (s.wins || 0) >= 70
  },
  win80: {
    id: 'win80',
    name: 'Thắng 80 ván',
    icon: '🏆',
    desc: 'Thắng 80 ván cờ',
    check: s => (s.wins || 0) >= 80
  },
  win90: {
    id: 'win90',
    name: 'Thắng 90 ván',
    icon: '🏆',
    desc: 'Thắng 90 ván cờ',
    check: s => (s.wins || 0) >= 90
  },
  win100: {
    id: 'win100',
    name: 'Kỳ thủ đỉnh cao',
    icon: '♟️',
    desc: 'Thắng 100 ván cờ',
    check: s => (s.wins || 0) >= 100
  },
  checkin3: {
    id: 'checkin3',
    name: 'Điểm danh 3 ngày',
    icon: '🔥',
    desc: 'Chuỗi điểm danh 3 ngày',
    check: s => (s.checkInStreak || 0) >= 3
  },
  checkin7: {
    id: 'checkin7',
    name: 'Điểm danh 7 ngày',
    icon: '🔥',
    desc: 'Chuỗi điểm danh 7 ngày',
    check: s => (s.checkInStreak || 0) >= 7
  },
  checkin30: {
    id: 'checkin30',
    name: 'Gắn bó 30 ngày',
    icon: '🔥',
    desc: 'Chuỗi điểm danh 30 ngày',
    check: s => (s.checkInStreak || 0) >= 30
  },
  checkin100: {
    id: 'checkin100',
    name: 'Điểm danh 100 ngày',
    icon: '🔥',
    desc: 'Chuỗi điểm danh 100 ngày',
    check: s => (s.checkInStreak || 0) >= 100
  },
  checkin200: {
    id: 'checkin200',
    name: 'Điểm danh 200 ngày',
    icon: '🔥',
    desc: 'Chuỗi điểm danh 200 ngày',
    check: s => (s.checkInStreak || 0) >= 200
  },
  checkin300: {
    id: 'checkin300',
    name: 'Điểm danh 300 ngày',
    icon: '🔥',
    desc: 'Chuỗi điểm danh 300 ngày',
    check: s => (s.checkInStreak || 0) >= 300
  },
  theme5: {
    id: 'theme5',
    name: 'Sưu tầm 5 theme',
    icon: '🎨',
    desc: 'Mở khóa 5 giao diện',
    check: s => (s.unlockedThemes || 0) >= 5
  },
  theme10: {
    id: 'theme10',
    name: 'Sưu tầm 10 theme',
    icon: '🎨',
    desc: 'Mở khóa 10 giao diện',
    check: s => (s.unlockedThemes || 0) >= 10
  },
  theme20: {
    id: 'theme20',
    name: 'Sưu tầm 20 theme',
    icon: '🎨',
    desc: 'Mở khóa 20 giao diện',
    check: s => (s.unlockedThemes || 0) >= 20
  },
  theme30: {
    id: 'theme30',
    name: 'Sưu tầm 30 theme',
    icon: '🎨',
    desc: 'Mở khóa 30 giao diện',
    check: s => (s.unlockedThemes || 0) >= 30
  },
  theme40: {
    id: 'theme40',
    name: 'Sưu tầm 40 theme',
    icon: '🎨',
    desc: 'Mở khóa 40 giao diện',
    check: s => (s.unlockedThemes || 0) >= 40
  },
  theme50: {
    id: 'theme50',
    name: 'Sưu tầm 50 theme',
    icon: '🎨',
    desc: 'Mở khóa 50 giao diện',
    check: s => (s.unlockedThemes || 0) >= 50
  },
  shopper5: {
    id: 'shopper5',
    name: 'Mua sắm 5 vật phẩm',
    icon: '🛒',
    desc: 'Mua 5 vật phẩm',
    check: s => (s.purchases || 0) >= 5
  },
  shopper10: {
    id: 'shopper10',
    name: 'Mua sắm 10 vật phẩm',
    icon: '🛒',
    desc: 'Mua 10 vật phẩm',
    check: s => (s.purchases || 0) >= 10
  },
  shopper20: {
    id: 'shopper20',
    name: 'Mua sắm 20 vật phẩm',
    icon: '🛒',
    desc: 'Mua 20 vật phẩm',
    check: s => (s.purchases || 0) >= 20
  },
  shopper30: {
    id: 'shopper30',
    name: 'Mua sắm 30 vật phẩm',
    icon: '🛒',
    desc: 'Mua 30 vật phẩm',
    check: s => (s.purchases || 0) >= 30
  },
  shopper40: {
    id: 'shopper40',
    name: 'Mua sắm 40 vật phẩm',
    icon: '🛒',
    desc: 'Mua 40 vật phẩm',
    check: s => (s.purchases || 0) >= 40
  },
  shopper50: {
    id: 'shopper50',
    name: 'Mua sắm 50 vật phẩm',
    icon: '🛒',
    desc: 'Mua 50 vật phẩm',
    check: s => (s.purchases || 0) >= 50
  },
  shopper60: {
    id: 'shopper60',
    name: 'Mua sắm 60 vật phẩm',
    icon: '🛒',
    desc: 'Mua 60 vật phẩm',
    check: s => (s.purchases || 0) >= 60
  },
  shopper70: {
    id: 'shopper70',
    name: 'Mua sắm 70 vật phẩm',
    icon: '🛒',
    desc: 'Mua 70 vật phẩm',
    check: s => (s.purchases || 0) >= 70
  },
  shopper80: {
    id: 'shopper80',
    name: 'Mua sắm 80 vật phẩm',
    icon: '🛒',
    desc: 'Mua 80 vật phẩm',
    check: s => (s.purchases || 0) >= 80
  },
  shopper90: {
    id: 'shopper90',
    name: 'Mua sắm 90 vật phẩm',
    icon: '🛒',
    desc: 'Mua 90 vật phẩm',
    check: s => (s.purchases || 0) >= 90
  },
  shopper100: {
    id: 'shopper100',
    name: 'Mua sắm 100 vật phẩm',
    icon: '🛒',
    desc: 'Mua 100 vật phẩm',
    check: s => (s.purchases || 0) >= 100
  },
  social: {
    id: 'social',
    name: 'Giao hữu',
    icon: '🤝',
    desc: 'Có ít nhất 3 bạn',
    check: s => (s.friendCount || 0) >= 3
  },
  social10: {
    id: 'social10',
    name: 'Giao hữu rộng',
    icon: '🤝',
    desc: 'Có ít nhất 10 bạn',
    check: s => (s.friendCount || 0) >= 10
  },
  winStreak3: {
    id: 'winStreak3',
    name: 'Thắng liên tiếp 3',
    icon: '🔥',
    desc: 'Thắng 3 ván liên tiếp',
    check: s => (s.winStreak || 0) >= 3
  },
  winStreak5: {
    id: 'winStreak5',
    name: 'Thắng liên tiếp 5',
    icon: '🔥',
    desc: 'Thắng 5 ván liên tiếp',
    check: s => (s.winStreak || 0) >= 5
  },
  winStreak10: {
    id: 'winStreak10',
    name: 'Bất khả chiến bại',
    icon: '⚡',
    desc: 'Thắng 10 ván liên tiếp',
    check: s => (s.winStreak || 0) >= 10
  },
  aiLevel5: {
    id: 'aiLevel5',
    name: 'Hạ máy cấp 5',
    icon: '🤖',
    desc: 'Thắng máy ở cấp độ 5 trở lên',
    check: s => (s.aiWins || 0) >= 1 && (s.aiLevelBeat || 0) >= 5
  },
  aiLevel8: {
    id: 'aiLevel8',
    name: 'Đại kiện tướng AI',
    icon: '🤖',
    desc: 'Thắng máy ở cấp độ 8 trở lên',
    check: s => (s.aiWins || 0) >= 1 && (s.aiLevelBeat || 0) >= 8
  },
  aiLevel10: {
    id: 'aiLevel10',
    name: 'Chinh phục AI tối thượng',
    icon: '🏆',
    desc: 'Thắng máy ở cấp độ 10',
    check: s => (s.aiWins || 0) >= 1 && (s.aiLevelBeat || 0) >= 10
  },
  aiWin100: {
    id: 'aiWin100',
    name: 'Sát thủ AI',
    icon: '💀',
    desc: 'Thắng máy 100 ván (tổng)',
    check: s => (s.aiWins || 0) >= 100
  },
  checkmateIn5: {
    id: 'checkmateIn5',
    name: 'Chiếu bí 5 nước',
    icon: '♟️',
    desc: 'Chiếu bí đối thủ trong 5 nước đi',
    check: s => (s.checkmateCount || 0) >= 1 && (s.shortestWin || 0) <= 5
  },
  captureGeneral: {
    id: 'captureGeneral',
    name: 'Bắt tướng',
    icon: '👑',
    desc: 'Ăn được quân Tướng của đối thủ',
    check: s => (s.generalCaptures || 0) >= 1
  },
  sacrificeChariot: {
    id: 'sacrificeChariot',
    name: 'Hy sinh Xe',
    icon: '🎯',
    desc: 'Thắng ván sau khi hy sinh Xe',
    check: s => (s.chariotSacrificeWins || 0) >= 1
  },
  onlineWin10: {
    id: 'onlineWin10',
    name: 'Chiến binh online',
    icon: '🌐',
    desc: 'Thắng 10 ván online',
    check: s => (s.onlineWins || 0) >= 10
  },
  friendBetWin: {
    id: 'friendBetWin',
    name: 'Thắng cược bạn bè',
    icon: '💰',
    desc: 'Thắng 1 ván cược với bạn bè',
    check: s => (s.betWins || 0) >= 1
  },
  friendBetWin10: {
    id: 'friendBetWin10',
    name: 'Tay cược thắng lớn',
    icon: '💰',
    desc: 'Thắng 10 ván cược với bạn bè',
    check: s => (s.betWins || 0) >= 10
  },
  collect100Gifts: {
    id: 'collect100Gifts',
    name: 'Nhà sưu tầm',
    icon: '🎁',
    desc: 'Sở hữu 100 vật phẩm trong kho',
    check: s => (s.totalGifts || 0) >= 100
  },
  auctionWin: {
    id: 'auctionWin',
    name: 'Vua đấu giá',
    icon: '🔨',
    desc: 'Thắng 1 phiên đấu giá',
    check: s => (s.auctionWins || 0) >= 1
  },
  giftCodeSent10: {
    id: 'giftCodeSent10',
    name: 'Mạnh tay quà tặng',
    icon: '🎁',
    desc: 'Tạo 10 mã quà tặng',
    check: s => (s.giftCodesSent || 0) >= 10
  },
  holidayWin: {
    id: 'holidayWin',
    name: 'Thắng trong sự kiện',
    icon: '🎉',
    desc: 'Thắng 1 ván trong thời gian sự kiện',
    check: s => (s.holidayWins || 0) >= 1
  },
  grandmaster: {
    id: 'grandmaster',
    name: 'Đại kiện tướng',
    icon: '🏅',
    desc: 'Đạt Elo 2000+',
    check: s => (s.elo || 0) >= 2000
  },
  perfectGame: {
    id: 'perfectGame',
    name: 'Ván cờ hoàn hảo',
    icon: '✨',
    desc: 'Thắng mà không để mất quân nào',
    check: s => (s.perfectGames || 0) >= 1
  },
  aggressive: {
    id: 'aggressive',
    name: 'Lối chơi tấn công',
    icon: '⚔️',
    desc: 'Thắng ván với hơn 5 nước chiếu tướng',
    check: s => (s.checksInGame || 0) >= 5
  },
  defensive: {
    id: 'defensive',
    name: 'Lối chơi phòng thủ',
    icon: '🛡️',
    desc: 'Thắng ván khi đang bị chiếu và lật ngược thế cờ',
    check: s => (s.comebackWins || 0) >= 1
  },
  sacrificeMaster: {
    id: 'sacrificeMaster',
    name: 'Bậc thầy hy sinh',
    icon: '♟️',
    desc: 'Thắng ván sau khi hy sinh ít nhất 3 quân',
    check: s => (s.sacrificeWins || 0) >= 1
  },
  blitzWin: {
    id: 'blitzWin',
    name: 'Cờ chớp',
    icon: '⚡',
    desc: 'Thắng ván trong vòng 30 nước đi',
    check: s => (s.blitzWins || 0) >= 1
  },
  marathon: {
    id: 'marathon',
    name: 'Trận chiến trường kỳ',
    icon: '⌛',
    desc: 'Thắng ván với hơn 100 nước đi',
    check: s => (s.marathonWins || 0) >= 1
  },
  comebackKing: {
    id: 'comebackKing',
    name: 'Vua ngược dòng',
    icon: '🔄',
    desc: 'Thắng ván khi đang thua về quân số (ít hơn 3 quân)',
    check: s => (s.comebackWins || 0) >= 3
  },
  horseCheckmate: {
    id: 'horseCheckmate',
    name: 'Mã chiếu bí',
    icon: '🐴',
    desc: 'Chiếu bí đối thủ bằng quân Mã',
    check: s => (s.horseCheckmates || 0) >= 1
  },
  cannonCheckmate: {
    id: 'cannonCheckmate',
    name: 'Pháo chiếu bí',
    icon: '💥',
    desc: 'Chiếu bí đối thủ bằng quân Pháo',
    check: s => (s.cannonCheckmates || 0) >= 1
  },
  soldierCheckmate: {
    id: 'soldierCheckmate',
    name: 'Tốt chiếu bí',
    icon: '🪖',
    desc: 'Chiếu bí đối thủ bằng quân Tốt',
    check: s => (s.soldierCheckmates || 0) >= 1
  },
  captureChariot: {
    id: 'captureChariot',
    name: 'Thợ săn Xe',
    icon: '🎯',
    desc: 'Ăn được quân Xe của đối thủ',
    check: s => (s.chariotCaptures || 0) >= 1
  },
  captureHorse: {
    id: 'captureHorse',
    name: 'Thợ săn Mã',
    icon: '🐴',
    desc: 'Ăn được quân Mã của đối thủ',
    check: s => (s.horseCaptures || 0) >= 1
  },
  cannonDuel: {
    id: 'cannonDuel',
    name: 'Song Pháo quyết đấu',
    icon: '💥',
    desc: 'Ăn được quân Pháo của đối thủ bằng Pháo',
    check: s => (s.cannonCaptures || 0) >= 1
  },
  themeCollector: {
    id: 'themeCollector',
    name: 'Nhà sưu tầm giao diện',
    icon: '🎨',
    desc: 'Sở hữu 15 giao diện khác nhau',
    check: s => (s.unlockedThemes || 0) >= 15
  },
  clubFan: {
    id: 'clubFan',
    name: 'CĐV cuồng nhiệt',
    icon: '⚽',
    desc: 'Sở hữu 5 giao diện CLB bóng đá',
    check: s => (s.clubThemes || 0) >= 5
  },
  eventGoer: {
    id: 'eventGoer',
    name: 'Người yêu sự kiện',
    icon: '🎉',
    desc: 'Sử dụng 3 giao diện sự kiện khác nhau',
    check: s => (s.eventThemes || 0) >= 3
  },
  popular: {
    id: 'popular',
    name: 'Nổi tiếng',
    icon: '🌟',
    desc: 'Có 20 bạn bè',
    check: s => (s.friendCount || 0) >= 20
  },
  chatty: {
    id: 'chatty',
    name: 'Thích trò chuyện',
    icon: '💬',
    desc: 'Gửi 100 tin nhắn chat',
    check: s => (s.chatMessages || 0) >= 100
  },
  inviter: {
    id: 'inviter',
    name: 'Người mời nhiệt tình',
    icon: '📨',
    desc: 'Gửi 10 lời mời chơi',
    check: s => (s.invites || 0) >= 10
  },
  millionaire: {
    id: 'millionaire',
    name: 'Triệu phú coin',
    icon: '💰',
    desc: 'Sở hữu 1000 coin',
    check: s => (s.coins || 0) >= 1000
  },
  billionaire: {
    id: 'billionaire',
    name: 'Tỉ phú coin',
    icon: '💎',
    desc: 'Sở hữu 10000 coin',
    check: s => (s.coins || 0) >= 10000
  },
  bigSpender: {
    id: 'bigSpender',
    name: 'Tay tiêu xài phung phí',
    icon: '🛍️',
    desc: 'Chi tiêu 500 coin trong cửa hàng',
    check: s => (s.totalSpent || 0) >= 500
  },
  loyal: {
    id: 'loyal',
    name: 'Thành viên trung thành',
    icon: '❤️',
    desc: 'Điểm danh 365 ngày',
    check: s => (s.checkInStreak || 0) >= 365
  },
  luckyWin: {
    id: 'luckyWin',
    name: 'Thắng nhờ may mắn',
    icon: '🍀',
    desc: 'Thắng ván mà không cần đi quân (đối thủ bỏ cuộc)',
    check: s => (s.luckyWins || 0) >= 1,
    hidden: true
  },
  nightOwl: {
    id: 'nightOwl',
    name: 'Cú đêm',
    icon: '🌙',
    desc: 'Chơi 1 ván vào lúc 12h-4h sáng',
    check: s => (s.nightGames || 0) >= 1,
    hidden: true
  },
  honest: {
    id: 'honest',
    name: 'Kỳ thủ trung thực',
    icon: '🤝',
    desc: 'Chơi 100 ván mà không dùng cheat',
    check: s => (s.honestGames || 0) >= 100,
    hidden: true
  },
  gambler: {
    id: 'gambler',
    name: 'Con bạc chuyên nghiệp',
    icon: '🎰',
    desc: 'Mất 100 coin rồi gỡ lại 200 coin',
    check: s => (s.gamblerWins || 0) >= 1,
    hidden: true
  },
  drawMaster: {
    id: 'drawMaster',
    name: 'Bậc thầy hòa cờ',
    icon: '🤝',
    desc: 'Hòa 5 ván liên tiếp',
    check: s => (s.drawStreak || 0) >= 5,
    hidden: true
  },
  winRate70: {
    id: 'winRate70',
    name: 'Tỉ lệ thắng 70%',
    icon: '📈',
    desc: 'Đạt tỉ lệ thắng 70% sau 50 ván',
    check: s => (s.winRate || 0) >= 0.7 && (s.totalGames || 0) >= 50
  },
  winRate80: {
    id: 'winRate80',
    name: 'Tỉ lệ thắng 80%',
    icon: '📈',
    desc: 'Đạt tỉ lệ thắng 80% sau 100 ván',
    check: s => (s.winRate || 0) >= 0.8 && (s.totalGames || 0) >= 100
  },
  grandmasterGames: {
    id: 'grandmasterGames',
    name: 'Kỳ thủ kỳ cựu',
    icon: '♟️',
    desc: 'Chơi 1000 ván cờ',
    check: s => (s.totalGames || 0) >= 1000
  },
  summerChampion: {
    id: 'summerChampion',
    name: 'Nhà vô địch mùa hè',
    icon: '☀️',
    desc: 'Thắng 50 ván trong mùa hè (tháng 6-8)',
    check: s => (s.summerWins || 0) >= 50
  },
  winterWarrior: {
    id: 'winterWarrior',
    name: 'Chiến binh mùa đông',
    icon: '❄️',
    desc: 'Thắng 50 ván trong mùa đông (tháng 12-2)',
    check: s => (s.winterWins || 0) >= 50
  },
};