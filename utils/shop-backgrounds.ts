import type { ImageSourcePropType } from 'react-native';

export type ShopBackground = {
  key: string;
  name: string;
  image: ImageSourcePropType;
  previewImage?: ImageSourcePropType;
  colors: string[];
};

export type ShopBackgroundPack = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  tag: string;
  price: string;
  productId: string;
  backgrounds: ShopBackground[];
  isTestUnlocked?: boolean;
};

export const SOFT_GLITTER_BACKGROUNDS: ShopBackground[] = [
  {
    key: 'soft-glitter-pearl-white-shimmer',
    name: 'Pearl White Shimmer',
    image: require('../assets/shop/backgrounds/soft-glitter/pearl-white-shimmer.png'),
    previewImage: require('../assets/shop/background-previews/soft-glitter/pearl-white-shimmer.png'),
    colors: ['#F7F4EE', '#D7D0C5', '#FFFFFF'],
  },
  {
    key: 'soft-glitter-warm-pearl-sparkle',
    name: 'Warm Pearl Sparkle',
    image: require('../assets/shop/backgrounds/soft-glitter/warm-pearl-sparkle.png'),
    previewImage: require('../assets/shop/background-previews/soft-glitter/warm-pearl-sparkle.png'),
    colors: ['#FFF5E6', '#EBD3B3', '#FFFFFF'],
  },
  {
    key: 'soft-glitter-lavender-sparkle',
    name: 'Lavender Sparkle',
    image: require('../assets/shop/backgrounds/soft-glitter/lavender-sparkle.png'),
    previewImage: require('../assets/shop/background-previews/soft-glitter/lavender-sparkle.png'),
    colors: ['#CDB5EF', '#E6D7FF', '#FFFFFF'],
  },
  {
    key: 'soft-glitter-lavender-mist',
    name: 'Lavender Mist',
    image: require('../assets/shop/backgrounds/soft-glitter/lavender-mist.png'),
    previewImage: require('../assets/shop/background-previews/soft-glitter/lavender-mist.png'),
    colors: ['#D6C5E7', '#B79AD6', '#F8F1FF'],
  },
  {
    key: 'soft-glitter-lavender-dream',
    name: 'Lavender Dream',
    image: require('../assets/shop/backgrounds/soft-glitter/lavender-dream.png'),
    previewImage: require('../assets/shop/background-previews/soft-glitter/lavender-dream.png'),
    colors: ['#B6A6E1', '#8E76BD', '#FFF5C4'],
  },
  {
    key: 'soft-glitter-champagne-glimmer',
    name: 'Champagne Glimmer',
    image: require('../assets/shop/backgrounds/soft-glitter/champagne-glimmer.png'),
    previewImage: require('../assets/shop/background-previews/soft-glitter/champagne-glimmer.png'),
    colors: ['#D9B77D', '#F7E1B7', '#FFFFFF'],
  },
  {
    key: 'soft-glitter-blush-pink-shimmer',
    name: 'Blush Pink Shimmer',
    image: require('../assets/shop/backgrounds/soft-glitter/blush-pink-shimmer.png'),
    previewImage: require('../assets/shop/background-previews/soft-glitter/blush-pink-shimmer.png'),
    colors: ['#F2CFCB', '#E8B6B1', '#FFFFFF'],
  },
  {
    key: 'soft-glitter-blush-pink-glow',
    name: 'Blush Pink Glow',
    image: require('../assets/shop/backgrounds/soft-glitter/blush-pink-glow.png'),
    previewImage: require('../assets/shop/background-previews/soft-glitter/blush-pink-glow.png'),
    colors: ['#F3B7AE', '#F9D9D4', '#D2A060'],
  },
  {
    key: 'soft-glitter-champagne-soft',
    name: 'Soft Champagne',
    image: require('../assets/shop/backgrounds/soft-glitter/champagne-soft.png'),
    previewImage: require('../assets/shop/background-previews/soft-glitter/champagne-soft.png'),
    colors: ['#D7C4A6', '#EFE2CC', '#FFFFFF'],
  },
  {
    key: 'soft-glitter-champagne-sparkle',
    name: 'Champagne Sparkle',
    image: require('../assets/shop/backgrounds/soft-glitter/champagne-sparkle.png'),
    previewImage: require('../assets/shop/background-previews/soft-glitter/champagne-sparkle.png'),
    colors: ['#C8B48F', '#EFE4CA', '#FFFFFF'],
  },
];

export const SHOP_BACKGROUND_PACKS: ShopBackgroundPack[] = [
  {
    id: 'soft-glitter-backgrounds',
    title: 'Soft Glitter Backgrounds',
    subtitle: '10 shimmering paper backgrounds for Studio and journals',
    category: 'Backgrounds',
    tag: 'Test Pack',
    price: 'Free test',
    productId: 'soft_glitter_backgrounds',
    backgrounds: SOFT_GLITTER_BACKGROUNDS,
    isTestUnlocked: true,
  },
];

export const TEST_UNLOCKED_BACKGROUND_PACKS = SHOP_BACKGROUND_PACKS.filter(
  (pack) => pack.isTestUnlocked
);

export const SHOP_BACKGROUNDS = SOFT_GLITTER_BACKGROUNDS.reduce<
  Record<string, ShopBackground>
>((backgrounds, background) => {
  backgrounds[background.key] = background;
  return backgrounds;
}, {});

export function getShopBackground(key?: string | null) {
  if (!key) {
    return null;
  }

  return SHOP_BACKGROUNDS[key] ?? null;
}
