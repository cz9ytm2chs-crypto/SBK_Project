// Demo catalog for SILT. Photos: Unsplash (free to use under the Unsplash License).

export const img = (id: string, w = 1200, h = 1500) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
/** Same photo, zoomed in on a detail — used as the hover / second gallery image. */
export const detail = (id: string, fx = 0.5, fy = 0.45) =>
  `https://images.unsplash.com/photo-${id}?w=1200&h=1500&fit=crop&crop=focalpoint&fp-x=${fx}&fp-y=${fy}&fp-z=1.8&auto=format&q=80`;

export const COLORS = [
  { slug: 'milk', name: 'Молочный', hex: '#F1ECE2' },
  { slug: 'white', name: 'Белый', hex: '#FFFFFF' },
  { slug: 'black', name: 'Чёрный', hex: '#151515' },
  { slug: 'graphite', name: 'Графит', hex: '#3B3B3B' },
  { slug: 'grey', name: 'Серый меланж', hex: '#9B9B98' },
  { slug: 'sand', name: 'Песочный', hex: '#C8B597' },
  { slug: 'camel', name: 'Кэмел', hex: '#A97C50' },
  { slug: 'olive', name: 'Оливковый', hex: '#5C5F3E' },
  { slug: 'navy', name: 'Тёмно-синий', hex: '#1F2A44' },
  { slug: 'indigo', name: 'Индиго', hex: '#33456B' },
  { slug: 'terracotta', name: 'Терракота', hex: '#B4562F' },
  { slug: 'orange', name: 'Оранжевый', hex: '#E0782B' },
  { slug: 'pink', name: 'Пудровый', hex: '#E5C3C0' },
  { slug: 'red', name: 'Красный', hex: '#B3261E' },
  { slug: 'brown', name: 'Коричневый', hex: '#5E4130' },
  { slug: 'lime', name: 'Лайм', hex: '#A8C94A' },
];

export const SIZES = [
  ...['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((label) => ({ label, group: 'APPAREL' as const })),
  ...['39', '40', '41', '42', '43', '44', '45'].map((label) => ({ label, group: 'SHOES' as const })),
  { label: 'ONE SIZE', group: 'ONE_SIZE' as const },
];

export const BRANDS = [
  { slug: 'silt-studio', name: 'SILT Studio', description: 'Основная линия бренда: точный крой и спокойные цвета.' },
  { slug: 'silt-essentials', name: 'SILT Essentials', description: 'Базовый гардероб из плотного хлопка.' },
  { slug: 'nordwerk', name: 'Nordwerk', description: 'Утилитарная верхняя одежда для города.' },
  { slug: 'kaze-supply', name: 'Kaze Supply', description: 'Обувь и аксессуары с японским вниманием к деталям.' },
  { slug: 'atelier-rowe', name: 'Atelier Rowe', description: 'Кожаные изделия ручной работы.' },
];

export const CATEGORIES = [
  { slug: 'tshirts', name: 'Футболки', description: 'Плотный хлопок, чистые силуэты и графика, которая не надоедает.', image: img('1521572163474-6864f9cf17ab', 1000, 1250) },
  { slug: 'hoodies', name: 'Худи и свитшоты', description: 'Футер с начёсом, объёмные капюшоны и мягкие оттенки.', image: img('1556821840-3a63f95609a7', 1000, 1250) },
  { slug: 'pants', name: 'Брюки и джинсы', description: 'Деним из японского хлопка, чиносы и свободные брюки.', image: img('1473966968600-fa801b869a1a', 1000, 1250) },
  { slug: 'jackets', name: 'Куртки и верхняя одежда', description: 'Кожа, деним и технические ткани для межсезонья.', image: img('1551028719-00167b16eac5', 1000, 1250) },
  { slug: 'shoes', name: 'Обувь', description: 'Кеды, кроссовки и ботинки на каждый день.', image: img('1549298916-b41d501d3772', 1000, 1250) },
  { slug: 'accessories', name: 'Аксессуары', description: 'Сумки, головные уборы, очки и кожгалантерея.', image: img('1553062407-98eeb64c6a62', 1000, 1250) },
];

export const SUBCATEGORIES = [
  { parent: 'accessories', slug: 'bags', name: 'Сумки и рюкзаки' },
  { parent: 'accessories', slug: 'headwear', name: 'Головные уборы' },
  { parent: 'accessories', slug: 'small-goods', name: 'Очки и кожгалантерея' },
];

export const COLLECTIONS = [
  { slug: 'fall-winter-26', name: 'Осень — Зима 2026', season: 'FW26', featured: true, image: img('1552374196-1ab2a1c593e8', 1600, 1100), description: 'Тёплые фактуры, кэмел и графит. Многослойность без лишнего объёма.' },
  { slug: 'essentials', name: 'Essentials', season: null, featured: true, image: img('1523381210434-271e8be1f52b', 1600, 1100), description: 'Вещи, с которых начинается гардероб: базовые футболки, свитшоты и прямые брюки.' },
  { slug: 'utility', name: 'Utility', season: 'FW26', featured: false, image: img('1544022613-e87ca75a784a', 1600, 1100), description: 'Карманы, прочные ткани и функциональный крой для города.' },
  { slug: 'sneaker-edit', name: 'Sneaker Edit', season: null, featured: true, image: img('1595950653106-6c9ebd614d3a', 1600, 1100), description: 'Подборка кроссовок и кед этого сезона.' },
];

const APPAREL = ['XS', 'S', 'M', 'L', 'XL'];
const APPAREL_WIDE = ['S', 'M', 'L', 'XL', 'XXL'];
const SHOES = ['39', '40', '41', '42', '43', '44', '45'];

export interface SeedProduct {
  slug: string;
  name: string;
  category: string;
  brand: string;
  price: number; // rubles
  compareAt?: number;
  colors: string[];
  sizes: string[];
  photos: string[]; // unsplash ids; first is the main image
  description: string;
  material: string;
  care: string;
  fit: string;
  flags?: ('new' | 'bestseller' | 'featured')[];
  collections?: string[];
  /** Overrides the generated stock; 0 = sold out. */
  stock?: number;
  sales: number;
}

const CARE_COTTON = 'Машинная стирка при 30 °C с изнанки. Не отбеливать. Сушить в расправленном виде. Гладить при средней температуре.';
const CARE_KNIT = 'Деликатная стирка при 30 °C. Не использовать кондиционер с силиконами. Сушить горизонтально.';
const CARE_DENIM = 'Стирать редко, при 30 °C, вывернув наизнанку. Не сушить в барабане — деним может сесть.';
const CARE_LEATHER = 'Только профессиональная чистка. Хранить на широких плечиках. Обрабатывать кремом для кожи раз в сезон.';
const CARE_SHOES = 'Чистить влажной салфеткой. Сушить при комнатной температуре вдали от батарей.';

export const PRODUCTS: SeedProduct[] = [
  // ── Футболки ──
  { slug: 'heavyweight-tee-white', name: 'Футболка Heavyweight', category: 'tshirts', brand: 'silt-essentials', price: 3490, colors: ['white', 'black', 'milk'], sizes: APPAREL, photos: ['1521572163474-6864f9cf17ab', '1622445275463-afa2ab738c34'], description: 'Плотная футболка из хлопка 240 г/м² с усиленным воротом, который не растягивается после стирок. Прямой силуэт, слегка спущенное плечо.', material: '100% органический хлопок, 240 г/м²', care: CARE_COTTON, fit: 'Прямой крой. Модель ростом 186 см носит размер L.', flags: ['bestseller'], collections: ['essentials'], sales: 412 },
  { slug: 'logo-tee-black', name: 'Футболка Logo Patch', category: 'tshirts', brand: 'silt-studio', price: 3990, colors: ['black'], sizes: APPAREL, photos: ['1618354691373-d851c5c3a990'], description: 'Чёрная футболка с вышитым круглым логотипом на груди. Мягкий кулирный хлопок, швы в плечах укреплены лентой.', material: '100% хлопок', care: CARE_COTTON, fit: 'Свободный крой, рекомендуем ваш обычный размер.', flags: ['new'], collections: ['essentials'], sales: 154 },
  { slug: 'type-tee-black', name: 'Футболка Typeface', category: 'tshirts', brand: 'silt-studio', price: 3790, compareAt: 4490, colors: ['black', 'white'], sizes: APPAREL, photos: ['1583743814966-8936f5b7be1a'], description: 'Минималистичная футболка с типографским принтом, нанесённым методом шелкографии. Принт не трескается и не выцветает.', material: '100% хлопок', care: CARE_COTTON, fit: 'Прямой крой.', collections: ['essentials'], sales: 98 },
  { slug: 'graphic-tee-original', name: 'Футболка Original Graphic', category: 'tshirts', brand: 'kaze-supply', price: 4290, colors: ['sand'], sizes: APPAREL, photos: ['1576566588028-4147f3842f27'], description: 'Футболка песочного цвета с графикой в стиле японских упаковок 70-х. Ограниченный тираж.', material: '100% хлопок', care: CARE_COTTON, fit: 'Прямой крой, длина чуть ниже бедра.', flags: ['new', 'featured'], sales: 61 },
  { slug: 'skeleton-tee-black', name: 'Футболка Peace Cropped', category: 'tshirts', brand: 'kaze-supply', price: 3290, compareAt: 3990, colors: ['black'], sizes: ['XS', 'S', 'M', 'L'], photos: ['1503342217505-b0a15ec3261c'], description: 'Укороченная футболка с ироничным принтом. Отлично сочетается с джинсами высокой посадки.', material: '95% хлопок, 5% эластан', care: CARE_COTTON, fit: 'Укороченный свободный крой.', sales: 77 },
  { slug: 'tee-pack-classic', name: 'Набор футболок Classic (3 шт.)', category: 'tshirts', brand: 'silt-essentials', price: 7990, compareAt: 9990, colors: ['graphite'], sizes: APPAREL_WIDE, photos: ['1562157873-818bc0726f68'], description: 'Три базовые футболки — белая, чёрная и тёмно-синяя — в одной упаковке. Выгоднее, чем по отдельности.', material: '100% хлопок, 200 г/м²', care: CARE_COTTON, fit: 'Прямой крой.', flags: ['bestseller'], collections: ['essentials'], sales: 288 },

  // ── Худи ──
  { slug: 'hoodie-loopback-grey', name: 'Худи Loopback', category: 'hoodies', brand: 'silt-essentials', price: 7990, colors: ['grey', 'black'], sizes: APPAREL_WIDE, photos: ['1556821840-3a63f95609a7'], description: 'Худи из футера с петлёй 420 г/м². Двойной капюшон держит форму, карман-кенгуру с потайным отделением.', material: '100% хлопок, футер 420 г/м²', care: CARE_KNIT, fit: 'Свободный крой со спущенным плечом.', flags: ['bestseller'], collections: ['essentials', 'fall-winter-26'], sales: 356 },
  { slug: 'sweatshirt-crew-white', name: 'Свитшот Crew', category: 'hoodies', brand: 'silt-essentials', price: 6490, colors: ['white', 'milk'], sizes: APPAREL, photos: ['1620799140408-edc6dcb6d633'], description: 'Классический свитшот с круглым вырезом и рибаной на манжетах. Начёс с изнанки.', material: '80% хлопок, 20% полиэстер', care: CARE_KNIT, fit: 'Прямой крой.', collections: ['essentials'], sales: 140 },
  { slug: 'sweatshirt-orange', name: 'Свитшот Sunset', category: 'hoodies', brand: 'silt-studio', price: 6990, compareAt: 8490, colors: ['orange'], sizes: APPAREL, photos: ['1578587018452-892bacefd3f2'], description: 'Яркий свитшот насыщенного оранжевого цвета — акцент для спокойного гардероба.', material: '100% хлопок', care: CARE_KNIT, fit: 'Слегка свободный крой.', flags: ['new'], collections: ['fall-winter-26'], sales: 92 },
  { slug: 'sweatshirt-pink-oversize', name: 'Свитшот Oversize Powder', category: 'hoodies', brand: 'silt-studio', price: 6790, colors: ['pink'], sizes: APPAREL, photos: ['1516826957135-700dedea698c'], description: 'Объёмный свитшот пудрового оттенка. Тяжёлый футер без начёса, мягкий на ощупь.', material: '100% хлопок, 380 г/м²', care: CARE_KNIT, fit: 'Oversize, при желании возьмите на размер меньше.', sales: 58 },
  { slug: 'hoodie-red-zip', name: 'Худи Signal', category: 'hoodies', brand: 'nordwerk', price: 8490, colors: ['red'], sizes: APPAREL_WIDE, photos: ['1548126032-079a0fb0099d'], description: 'Красное худи с плотным капюшоном. Хорошо работает в многослойных образах под курткой.', material: '100% хлопок', care: CARE_KNIT, fit: 'Прямой крой.', flags: ['featured'], collections: ['utility'], sales: 70 },
  { slug: 'tracksuit-set-yellow', name: 'Костюм Studio Set', category: 'hoodies', brand: 'silt-studio', price: 12990, compareAt: 15990, colors: ['orange'], sizes: ['XS', 'S', 'M', 'L'], photos: ['1515886657613-9f3515b0c78f'], description: 'Комплект из укороченного худи и джоггеров из мягкого футера.', material: '100% хлопок', care: CARE_KNIT, fit: 'Укороченное худи, свободные джоггеры.', stock: 0, sales: 40 },

  // ── Брюки ──
  { slug: 'jeans-straight-raw', name: 'Джинсы Straight Raw', category: 'pants', brand: 'silt-studio', price: 9990, colors: ['indigo', 'black'], sizes: APPAREL, photos: ['1542272604-787c3835535d', '1604176354204-9268737828e4'], description: 'Прямые джинсы из японского селвидж-денима 14 oz. Со временем приобретают индивидуальные потёртости.', material: '100% хлопок, селвидж-деним 14 oz', care: CARE_DENIM, fit: 'Прямой крой, средняя посадка.', flags: ['bestseller'], collections: ['essentials'], sales: 301 },
  { slug: 'jeans-dark-wash', name: 'Джинсы Dark Wash', category: 'pants', brand: 'silt-essentials', price: 7990, compareAt: 9490, colors: ['navy'], sizes: APPAREL, photos: ['1624378439575-d8705ad7ae80'], description: 'Тёмные джинсы классического кроя с лёгкой стиркой.', material: '98% хлопок, 2% эластан', care: CARE_DENIM, fit: 'Прямой крой.', sales: 120 },
  { slug: 'jeans-distressed', name: 'Джинсы Distressed Slim', category: 'pants', brand: 'kaze-supply', price: 8990, colors: ['indigo'], sizes: APPAREL, photos: ['1541099649105-f69ad21f3246'], description: 'Зауженные джинсы с вышивкой и потёртостями ручной работы.', material: '99% хлопок, 1% эластан', care: CARE_DENIM, fit: 'Зауженный к низу.', flags: ['new'], sales: 44 },
  { slug: 'chino-sand', name: 'Брюки Chino', category: 'pants', brand: 'silt-essentials', price: 6990, colors: ['sand', 'olive', 'black'], sizes: APPAREL_WIDE, photos: ['1473966968600-fa801b869a1a'], description: 'Чиносы из плотного твила с небольшим заужением. Универсальная пара на каждый день.', material: '97% хлопок, 3% эластан', care: CARE_COTTON, fit: 'Зауженный к низу, средняя посадка.', flags: ['bestseller'], collections: ['essentials', 'utility'], sales: 260 },
  { slug: 'pants-pleated-pink', name: 'Брюки Pleated', category: 'pants', brand: 'silt-studio', price: 7490, compareAt: 8990, colors: ['pink'], sizes: ['XS', 'S', 'M', 'L'], photos: ['1594633312681-425c7b97ccd1'], description: 'Лёгкие брюки с защипами и манжетами на щиколотке.', material: '70% вискоза, 30% лён', care: CARE_KNIT, fit: 'Высокая посадка, свободный крой.', sales: 51 },
  { slug: 'pants-stripe-wide', name: 'Брюки Wide Stripe', category: 'pants', brand: 'silt-studio', price: 8290, colors: ['black'], sizes: ['XS', 'S', 'M', 'L'], photos: ['1509631179647-0177331693ae'], description: 'Широкие брюки в вертикальную полоску визуально вытягивают силуэт.', material: '65% полиэстер, 35% вискоза', care: CARE_KNIT, fit: 'Широкие от бедра, высокая посадка.', flags: ['new'], sales: 33 },

  // ── Куртки ──
  { slug: 'leather-biker-black', name: 'Косуха Biker', category: 'jackets', brand: 'atelier-rowe', price: 34990, colors: ['black'], sizes: APPAREL, photos: ['1551028719-00167b16eac5', '1520975954732-35dd22299614'], description: 'Классическая косуха из мягкой телячьей кожи растительного дубления. Асимметричная молния, металлическая фурнитура.', material: 'Верх: 100% натуральная кожа. Подкладка: 100% вискоза', care: CARE_LEATHER, fit: 'Приталенный крой, длина до талии.', flags: ['featured', 'bestseller'], collections: ['fall-winter-26'], sales: 87 },
  { slug: 'bomber-terracotta', name: 'Бомбер Flight', category: 'jackets', brand: 'nordwerk', price: 14990, compareAt: 18990, colors: ['terracotta'], sizes: APPAREL, photos: ['1591047139829-d91aecb6caea'], description: 'Лёгкий бомбер из матового нейлона с трикотажными манжетами.', material: '100% нейлон, подкладка 100% полиэстер', care: CARE_COTTON, fit: 'Прямой крой.', collections: ['utility'], sales: 64 },
  { slug: 'field-jacket-olive', name: 'Куртка Field', category: 'jackets', brand: 'nordwerk', price: 19990, colors: ['olive'], sizes: APPAREL_WIDE, photos: ['1544022613-e87ca75a784a'], description: 'Полевая куртка M-65 в современной интерпретации: четыре накладных кармана, скрытый капюшон в воротнике.', material: '60% хлопок, 40% нейлон', care: CARE_COTTON, fit: 'Свободный крой, длина до середины бедра.', flags: ['new', 'featured'], collections: ['utility', 'fall-winter-26'], sales: 72 },
  { slug: 'denim-jacket-corduroy', name: 'Джинсовая куртка Ranch', category: 'jackets', brand: 'silt-studio', price: 12990, colors: ['indigo'], sizes: APPAREL, photos: ['1611312449408-fcece27cdbb7'], description: 'Джинсовая куртка с вельветовым воротником и медными пуговицами.', material: '100% хлопок, деним 12 oz', care: CARE_DENIM, fit: 'Прямой крой.', collections: ['essentials'], sales: 110 },
  { slug: 'overshirt-black', name: 'Куртка-рубашка Overshirt', category: 'jackets', brand: 'silt-studio', price: 10990, colors: ['black', 'graphite'], sizes: APPAREL_WIDE, photos: ['1507680434567-5739c80be1ac'], description: 'Плотная рубашка-куртка из саржи — средний слой поверх футболки или свитшота.', material: '100% хлопок, саржа', care: CARE_COTTON, fit: 'Свободный крой.', flags: ['new'], collections: ['fall-winter-26'], sales: 49 },
  { slug: 'coat-camel', name: 'Пальто Camel', category: 'jackets', brand: 'silt-studio', price: 29990, compareAt: 36990, colors: ['camel'], sizes: APPAREL, photos: ['1552374196-1ab2a1c593e8'], description: 'Однобортное пальто из шерсти с кашемиром. Цельнокроеная спинка, потайная застёжка.', material: '80% шерсть, 20% кашемир', care: 'Только сухая чистка.', fit: 'Прямой крой, длина ниже колена.', flags: ['featured'], collections: ['fall-winter-26'], sales: 38 },

  // ── Обувь ──
  { slug: 'sneaker-court-white', name: 'Кеды Court', category: 'shoes', brand: 'kaze-supply', price: 11990, colors: ['white'], sizes: SHOES, photos: ['1608231387042-66d1773070a5'], description: 'Минималистичные кеды из гладкой кожи с перфорацией. Подошва прошита по кругу.', material: 'Верх: натуральная кожа. Подошва: резина', care: CARE_SHOES, fit: 'Соответствуют размеру.', flags: ['bestseller'], collections: ['sneaker-edit', 'essentials'], sales: 270 },
  { slug: 'sneaker-runner-red', name: 'Кроссовки Runner Knit', category: 'shoes', brand: 'kaze-supply', price: 13990, compareAt: 16990, colors: ['red'], sizes: SHOES, photos: ['1542291026-7eec264c27ff'], description: 'Лёгкие беговые кроссовки с вязаным верхом и пенной подошвой.', material: 'Верх: текстиль. Подошва: EVA', care: CARE_SHOES, fit: 'Узкая колодка — при широкой стопе возьмите на размер больше.', collections: ['sneaker-edit'], sales: 132 },
  { slug: 'sneaker-tan-low', name: 'Кроссовки Workwear Low', category: 'shoes', brand: 'kaze-supply', price: 15990, colors: ['camel'], sizes: SHOES, photos: ['1549298916-b41d501d3772'], description: 'Низкие кроссовки из нубука цвета кэмел с контрастной строчкой.', material: 'Верх: нубук. Подошва: резина', care: CARE_SHOES, fit: 'Соответствуют размеру.', flags: ['new', 'featured'], collections: ['sneaker-edit', 'fall-winter-26'], sales: 84 },
  { slug: 'sneaker-pastel', name: 'Кроссовки Pastel Shadow', category: 'shoes', brand: 'kaze-supply', price: 14490, colors: ['pink'], sizes: ['39', '40', '41', '42'], photos: ['1595950653106-6c9ebd614d3a'], description: 'Кроссовки на многослойной подошве в пастельной гамме.', material: 'Верх: кожа и текстиль. Подошва: резина', care: CARE_SHOES, fit: 'Соответствуют размеру.', flags: ['new'], collections: ['sneaker-edit'], sales: 66 },
  { slug: 'sneaker-trainer-lime', name: 'Кроссовки Trainer', category: 'shoes', brand: 'kaze-supply', price: 12490, colors: ['lime'], sizes: SHOES, photos: ['1606107557195-0e29a4b5b4aa'], description: 'Тренировочные кроссовки с устойчивой платформой для зала и города.', material: 'Верх: сетка. Подошва: резина', care: CARE_SHOES, fit: 'Соответствуют размеру.', collections: ['sneaker-edit'], sales: 41 },
  { slug: 'sneaker-air-white', name: 'Кроссовки Air Classic', category: 'shoes', brand: 'kaze-supply', price: 16990, compareAt: 19990, colors: ['white'], sizes: SHOES, photos: ['1600185365483-26d7a4cc7519'], description: 'Классический силуэт с видимой воздушной капсулой в пятке.', material: 'Верх: кожа и замша. Подошва: резина', care: CARE_SHOES, fit: 'Соответствуют размеру.', flags: ['bestseller'], collections: ['sneaker-edit'], sales: 190 },
  { slug: 'boots-derby-brown', name: 'Ботинки Derby', category: 'shoes', brand: 'atelier-rowe', price: 21990, colors: ['brown'], sizes: SHOES, photos: ['1608256246200-53e635b5b65f'], description: 'Ботинки из вощёной кожи с прошивкой Goodyear — их можно перешить и носить годами.', material: 'Верх: натуральная кожа. Подошва: резина Vibram', care: CARE_LEATHER, fit: 'Соответствуют размеру.', flags: ['featured'], collections: ['fall-winter-26'], sales: 58 },

  // ── Аксессуары ──
  { slug: 'backpack-daypack-navy', name: 'Рюкзак Daypack', category: 'bags', brand: 'nordwerk', price: 8990, colors: ['navy'], sizes: ['ONE SIZE'], photos: ['1553062407-98eeb64c6a62'], description: 'Городской рюкзак на 18 литров с отделением для ноутбука 15".', material: 'Кордура 500D с водоотталкивающей пропиткой', care: 'Протирать влажной тканью.', fit: '45 × 30 × 14 см', flags: ['bestseller'], collections: ['utility'], sales: 175 },
  { slug: 'bag-top-handle-red', name: 'Сумка Top Handle', category: 'bags', brand: 'atelier-rowe', price: 18990, colors: ['red'], sizes: ['ONE SIZE'], photos: ['1584917865442-de89df76afd3'], description: 'Структурированная сумка из гладкой кожи с металлическим замком.', material: '100% натуральная кожа', care: CARE_LEATHER, fit: '24 × 19 × 10 см', flags: ['featured'], sales: 39 },
  { slug: 'bag-wicker', name: 'Сумка Wicker', category: 'bags', brand: 'atelier-rowe', price: 11990, compareAt: 14990, colors: ['orange'], sizes: ['ONE SIZE'], photos: ['1590874103328-eac38a683ce7'], description: 'Плетёная сумка с кожаной отделкой.', material: 'Ротанг, натуральная кожа', care: 'Беречь от влаги.', fit: '26 × 22 × 12 см', sales: 27 },
  { slug: 'cap-trucker-white', name: 'Кепка Trucker', category: 'headwear', brand: 'silt-essentials', price: 2490, colors: ['white'], sizes: ['ONE SIZE'], photos: ['1588850561407-ed78c282e89b'], description: 'Кепка с сетчатой спинкой и регулируемой застёжкой.', material: 'Хлопок, полиэстер', care: 'Ручная стирка.', fit: 'Регулируемый объём 54–60 см', collections: ['essentials'], sales: 140 },
  { slug: 'cap-washed-grey', name: 'Кепка Washed', category: 'headwear', brand: 'silt-essentials', price: 2790, colors: ['graphite'], sizes: ['ONE SIZE'], photos: ['1521369909029-2afed882baee'], description: 'Мягкая кепка из стираного хлопка с вышивкой в тон.', material: '100% хлопок', care: 'Ручная стирка.', fit: 'Регулируемый объём 55–60 см', flags: ['new'], sales: 88 },
  { slug: 'beanie-rib', name: 'Шапка Rib', category: 'headwear', brand: 'silt-essentials', price: 2290, colors: ['brown', 'pink', 'black'], sizes: ['ONE SIZE'], photos: ['1576871337632-b9aef4c17ab9'], description: 'Шапка-бини в рубчик с отворотом.', material: '50% шерсть мериноса, 50% акрил', care: CARE_KNIT, fit: 'Универсальный размер', flags: ['bestseller'], collections: ['fall-winter-26'], sales: 230 },
  { slug: 'sunglasses-wayfarer', name: 'Очки Wayfarer', category: 'small-goods', brand: 'kaze-supply', price: 9990, colors: ['black'], sizes: ['ONE SIZE'], photos: ['1572635196237-14b3f281503f'], description: 'Солнцезащитные очки в ацетатной оправе с поляризованными линзами.', material: 'Ацетат, поляризованные линзы UV400', care: 'Протирать микрофиброй.', fit: 'Ширина оправы 145 мм', sales: 95 },
  { slug: 'wallet-bifold', name: 'Кошелёк Bifold', category: 'small-goods', brand: 'atelier-rowe', price: 5990, colors: ['brown'], sizes: ['ONE SIZE'], photos: ['1627123424574-724758594e93'], description: 'Двойной кошелёк из кожи растительного дубления. 6 отделений для карт.', material: '100% натуральная кожа', care: CARE_LEATHER, fit: '11 × 9 см', sales: 120 },
];

export const EDITORIAL = {
  hero1: img('1552374196-1ab2a1c593e8', 2000, 1200),
  hero2: img('1548126032-079a0fb0099d', 2000, 1200),
  promo: img('1529139574466-a303027c1d8b', 1600, 1000),
  editorial1: img('1490481651871-ab68de25d43d', 1400, 1000),
  editorial2: img('1441986300917-64674bd600d8', 1400, 1000),
  social: [
    '1483985988355-763728e1935b',
    '1469334031218-e382a71b716b',
    '1496747611176-843222e1e57c',
    '1485968579580-b6d095142e6e',
    '1434389677669-e08b4cac3105',
    '1617137968427-85924c800a22',
  ].map((id) => img(id, 600, 600)),
};
