import type { ImageSourcePropType } from 'react-native';

export type ShopSticker = {
  key: string;
  name: string;
  image: ImageSourcePropType;
  width: number;
  height: number;
};

export type ShopStickerPack = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  tag: string;
  price: string;
  productId: string;
  stickers: ShopSticker[];
  isTestUnlocked?: boolean;
};

export const FLORAL_FAITH_STICKERS: ShopSticker[] = [
  {
    key: 'floral-faith-faith',
    name: 'Faith',
    image: require('../assets/shop/stickers/floral-faith/faith.png'),
    width: 732,
    height: 390,
  },
  {
    key: 'floral-faith-hope',
    name: 'Hope',
    image: require('../assets/shop/stickers/floral-faith/hope.png'),
    width: 621,
    height: 360,
  },
  {
    key: 'floral-faith-love',
    name: 'Love',
    image: require('../assets/shop/stickers/floral-faith/love.png'),
    width: 473,
    height: 374,
  },
  {
    key: 'floral-faith-grace',
    name: 'Grace',
    image: require('../assets/shop/stickers/floral-faith/grace.png'),
    width: 536,
    height: 386,
  },
  {
    key: 'floral-faith-blessed',
    name: 'Blessed',
    image: require('../assets/shop/stickers/floral-faith/blessed.png'),
    width: 704,
    height: 310,
  },
  {
    key: 'floral-faith-joy',
    name: 'Joy',
    image: require('../assets/shop/stickers/floral-faith/joy.png'),
    width: 512,
    height: 380,
  },
  {
    key: 'floral-faith-peace',
    name: 'Peace',
    image: require('../assets/shop/stickers/floral-faith/peace.png'),
    width: 553,
    height: 315,
  },
  {
    key: 'floral-faith-mercy',
    name: 'Mercy',
    image: require('../assets/shop/stickers/floral-faith/mercy.png'),
    width: 655,
    height: 370,
  },
  {
    key: 'floral-faith-prayer',
    name: 'Prayer',
    image: require('../assets/shop/stickers/floral-faith/prayer.png'),
    width: 651,
    height: 370,
  },
  {
    key: 'floral-faith-worship',
    name: 'Worship',
    image: require('../assets/shop/stickers/floral-faith/worship.png'),
    width: 760,
    height: 361,
  },
  {
    key: 'floral-faith-praise',
    name: 'Praise',
    image: require('../assets/shop/stickers/floral-faith/praise.png'),
    width: 606,
    height: 315,
  },
  {
    key: 'floral-faith-glory',
    name: 'Glory',
    image: require('../assets/shop/stickers/floral-faith/glory.png'),
    width: 550,
    height: 383,
  },
  {
    key: 'floral-faith-holy',
    name: 'Holy',
    image: require('../assets/shop/stickers/floral-faith/holy.png'),
    width: 626,
    height: 368,
  },
  {
    key: 'floral-faith-amen',
    name: 'Amen',
    image: require('../assets/shop/stickers/floral-faith/amen.png'),
    width: 516,
    height: 312,
  },
  {
    key: 'floral-faith-hallelujah',
    name: 'Hallelujah',
    image: require('../assets/shop/stickers/floral-faith/hallelujah.png'),
    width: 926,
    height: 368,
  },
  {
    key: 'floral-faith-unshaken',
    name: 'Unshaken',
    image: require('../assets/shop/stickers/floral-faith/unshaken.png'),
    width: 791,
    height: 332,
  },
  {
    key: 'floral-faith-fearless',
    name: 'Fearless',
    image: require('../assets/shop/stickers/floral-faith/fearless.png'),
    width: 725,
    height: 322,
  },
  {
    key: 'floral-faith-bloom',
    name: 'Bloom',
    image: require('../assets/shop/stickers/floral-faith/bloom.png'),
    width: 643,
    height: 310,
  },
  {
    key: 'floral-faith-shine',
    name: 'Shine',
    image: require('../assets/shop/stickers/floral-faith/shine.png'),
    width: 595,
    height: 342,
  },
  {
    key: 'floral-faith-gather',
    name: 'Gather',
    image: require('../assets/shop/stickers/floral-faith/gather.png'),
    width: 587,
    height: 383,
  },
  {
    key: 'floral-faith-graceful',
    name: 'Graceful',
    image: require('../assets/shop/stickers/floral-faith/graceful.png'),
    width: 697,
    height: 383,
  },
];

export const SCRIPTURE_VERSE_LABEL_STICKERS: ShopSticker[] = [
  {
    key: 'scripture-label-do-everything-in-love',
    name: 'Do Everything in Love',
    image: require('../assets/shop/stickers/scripture-verse-labels/do-everything-in-love.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-life-light',
    name: 'Life and Light',
    image: require('../assets/shop/stickers/scripture-verse-labels/life-light.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-rejoice-always',
    name: 'Rejoice Always',
    image: require('../assets/shop/stickers/scripture-verse-labels/rejoice-always.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-do-to-others',
    name: 'Do to Others',
    image: require('../assets/shop/stickers/scripture-verse-labels/do-to-others.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-christ-strengthens-me',
    name: 'Christ Strengthens Me',
    image: require('../assets/shop/stickers/scripture-verse-labels/christ-strengthens-me.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-strong-take-heart',
    name: 'Strong and Take Heart',
    image: require('../assets/shop/stickers/scripture-verse-labels/strong-take-heart.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-give-thanks-circumstances',
    name: 'Give Thanks in All Circumstances',
    image: require('../assets/shop/stickers/scripture-verse-labels/give-thanks-circumstances.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-minds-above',
    name: 'Set Your Minds Above',
    image: require('../assets/shop/stickers/scripture-verse-labels/minds-above.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-lord-good-love-endures',
    name: 'His Love Endures Forever',
    image: require('../assets/shop/stickers/scripture-verse-labels/lord-good-love-endures.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-first-loved-us',
    name: 'He First Loved Us',
    image: require('../assets/shop/stickers/scripture-verse-labels/first-loved-us.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-joyful-hope',
    name: 'Joyful in Hope',
    image: require('../assets/shop/stickers/scripture-verse-labels/joyful-hope.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-impossible-for-god',
    name: 'Impossible for God',
    image: require('../assets/shop/stickers/scripture-verse-labels/impossible-for-god.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-walk-by-faith',
    name: 'Walk by Faith',
    image: require('../assets/shop/stickers/scripture-verse-labels/walk-by-faith.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-guard-your-heart',
    name: 'Guard Your Heart',
    image: require('../assets/shop/stickers/scripture-verse-labels/guard-your-heart.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-everything-possible',
    name: 'Everything Is Possible',
    image: require('../assets/shop/stickers/scripture-verse-labels/everything-possible.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-lord-shepherd',
    name: 'The Lord Is My Shepherd',
    image: require('../assets/shop/stickers/scripture-verse-labels/lord-shepherd.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-god-within-her',
    name: 'God Is Within Her',
    image: require('../assets/shop/stickers/scripture-verse-labels/god-within-her.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-give-thanks-always',
    name: 'Give Thanks Always',
    image: require('../assets/shop/stickers/scripture-verse-labels/give-thanks-always.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-pray-without-ceasing',
    name: 'Pray Without Ceasing',
    image: require('../assets/shop/stickers/scripture-verse-labels/pray-without-ceasing.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-look-to-lord',
    name: 'Look to the Lord',
    image: require('../assets/shop/stickers/scripture-verse-labels/look-to-lord.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-hope-in-lord',
    name: 'Hope in the Lord',
    image: require('../assets/shop/stickers/scripture-verse-labels/hope-in-lord.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-trust-in-you',
    name: 'Trust in You',
    image: require('../assets/shop/stickers/scripture-verse-labels/trust-in-you.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-strength-defense',
    name: 'Strength and Defense',
    image: require('../assets/shop/stickers/scripture-verse-labels/strength-defense.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-love-you-lord',
    name: 'I Love You Lord',
    image: require('../assets/shop/stickers/scripture-verse-labels/love-you-lord.png'),
    width: 1050,
    height: 447,
  },
  {
    key: 'scripture-label-delight-yourself',
    name: 'Delight Yourself',
    image: require('../assets/shop/stickers/scripture-verse-labels/delight-yourself.png'),
    width: 902,
    height: 900,
  },
  {
    key: 'scripture-label-spirit-not-fear',
    name: 'Spirit Not of Fear',
    image: require('../assets/shop/stickers/scripture-verse-labels/spirit-not-fear.png'),
    width: 902,
    height: 900,
  },
  {
    key: 'scripture-label-strength-shield',
    name: 'Strength and Shield',
    image: require('../assets/shop/stickers/scripture-verse-labels/strength-shield.png'),
    width: 902,
    height: 900,
  },
  {
    key: 'scripture-label-brokenhearted',
    name: 'Near to the Brokenhearted',
    image: require('../assets/shop/stickers/scripture-verse-labels/brokenhearted.png'),
    width: 902,
    height: 900,
  },
  {
    key: 'scripture-label-trust-in-lord',
    name: 'Trust in the Lord',
    image: require('../assets/shop/stickers/scripture-verse-labels/trust-in-lord.png'),
    width: 902,
    height: 900,
  },
  {
    key: 'scripture-label-waters-with-you',
    name: 'Waters With You',
    image: require('../assets/shop/stickers/scripture-verse-labels/waters-with-you.png'),
    width: 902,
    height: 900,
  },
];

export const SHOP_STICKER_PACKS: ShopStickerPack[] = [
  {
    id: 'floral-faith-stickers',
    title: 'Floral Faith Stickers',
    subtitle: '21 floral word stickers for decorating verse cards and journal pages',
    category: 'Stickers',
    tag: 'Test Pack',
    price: 'Free test',
    productId: 'floral_faith_stickers',
    stickers: FLORAL_FAITH_STICKERS,
    isTestUnlocked: true,
  },
  {
    id: 'scripture-verse-label-stickers',
    title: 'Scripture Verse Label Stickers',
    subtitle: '30 scripture label stickers for verse cards, Bible notes, and journals',
    category: 'Stickers',
    tag: 'New',
    price: '$0.99',
    productId: 'scripture_verse_label_stickers',
    stickers: SCRIPTURE_VERSE_LABEL_STICKERS,
    isTestUnlocked: true,
  },
];

export const TEST_UNLOCKED_STICKER_PACKS = SHOP_STICKER_PACKS.filter(
  (pack) => pack.isTestUnlocked
);

export const SHOP_STICKERS = [
  ...FLORAL_FAITH_STICKERS,
  ...SCRIPTURE_VERSE_LABEL_STICKERS,
].reduce<Record<string, ShopSticker>>(
  (stickers, sticker) => {
    stickers[sticker.key] = sticker;
    return stickers;
  },
  {
    'faith-floral': FLORAL_FAITH_STICKERS[0],
  }
);

export function getShopSticker(key?: string) {
  if (!key) {
    return null;
  }

  return SHOP_STICKERS[key] ?? null;
}

export function getShopStickerDisplaySize(sticker: ShopSticker, maxSize = 132) {
  const scale = maxSize / Math.max(sticker.width, sticker.height);

  return {
    width: Math.round(sticker.width * scale),
    height: Math.round(sticker.height * scale),
  };
}
