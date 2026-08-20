export type ShopNoteStyle = {
  key: string;
  label: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  mutedTextColor: string;
};

export type ShopNoteStylePack = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  tag: string;
  priceLabel?: string;
  noteStyles: ShopNoteStyle[];
  isIncluded?: boolean;
  colors: string[];
};

/** Always-free note papers available in Studio. */
export const BUILT_IN_NOTE_STYLES: ShopNoteStyle[] = [
  {
    key: 'butter',
    label: 'Butter',
    backgroundColor: '#FFF8DC',
    borderColor: '#D8C9A3',
    textColor: '#4D433D',
    mutedTextColor: '#8F877F',
  },
  {
    key: 'rose',
    label: 'Rose',
    backgroundColor: '#FFE9EE',
    borderColor: '#E3B8C2',
    textColor: '#4A343A',
    mutedTextColor: '#9B747D',
  },
  {
    key: 'sage',
    label: 'Sage',
    backgroundColor: '#ECF5E8',
    borderColor: '#B9CEB0',
    textColor: '#344437',
    mutedTextColor: '#70806D',
  },
  {
    key: 'sky',
    label: 'Sky',
    backgroundColor: '#EAF3FF',
    borderColor: '#B8CBE5',
    textColor: '#303C4F',
    mutedTextColor: '#6F7E93',
  },
  {
    key: 'linen',
    label: 'Linen',
    backgroundColor: '#FFFDF9',
    borderColor: '#DCCFC5',
    textColor: '#3A302B',
    mutedTextColor: '#8F877F',
  },
];

export const DEFAULT_NOTE_STYLE_KEY = 'butter';

const PASTEL_NOTE_PAPERS_STYLES: ShopNoteStyle[] = [
  {
    key: 'peach',
    label: 'Peach',
    backgroundColor: '#FFE4D4',
    borderColor: '#E8B89A',
    textColor: '#4A342C',
    mutedTextColor: '#9A7A6C',
  },
  {
    key: 'coral',
    label: 'Coral',
    backgroundColor: '#FFD9D6',
    borderColor: '#E5A8A3',
    textColor: '#4A3030',
    mutedTextColor: '#9A7070',
  },
  {
    key: 'honey',
    label: 'Honey',
    backgroundColor: '#FFF0C8',
    borderColor: '#E0C57A',
    textColor: '#4A3F28',
    mutedTextColor: '#95845A',
  },
  {
    key: 'mint',
    label: 'Mint',
    backgroundColor: '#DFF5EE',
    borderColor: '#A5D4C4',
    textColor: '#2F433C',
    mutedTextColor: '#6E8A80',
  },
  {
    key: 'seafoam',
    label: 'Seafoam',
    backgroundColor: '#D9F2F0',
    borderColor: '#9DCEC9',
    textColor: '#2C4241',
    mutedTextColor: '#6A8583',
  },
  {
    key: 'cocoa',
    label: 'Cocoa',
    backgroundColor: '#F3E6DA',
    borderColor: '#D0B49A',
    textColor: '#3F3228',
    mutedTextColor: '#8A7564',
  },
  {
    key: 'blush',
    label: 'Blush',
    backgroundColor: '#FCE4EC',
    borderColor: '#E5B0C0',
    textColor: '#4A3038',
    mutedTextColor: '#9A7080',
  },
  {
    key: 'dusk',
    label: 'Dusk',
    backgroundColor: '#E8EDF7',
    borderColor: '#B4BED6',
    textColor: '#303848',
    mutedTextColor: '#6E788E',
  },
];

export const SHOP_NOTE_STYLE_PACKS: ShopNoteStylePack[] = [
  {
    id: 'pastel-note-papers',
    title: 'Pastel Note Papers',
    subtitle: 'Eight sticky-note colors for Canvas notes: peach, coral, honey, mint, and more',
    category: 'Note styles',
    tag: 'New',
    priceLabel: '$1',
    noteStyles: PASTEL_NOTE_PAPERS_STYLES,
    colors: ['#FFE4D4', '#FFD9D6', '#DFF5EE'],
  },
];

export const INCLUDED_NOTE_STYLE_PACKS = SHOP_NOTE_STYLE_PACKS.filter((pack) => pack.isIncluded);

const ALL_CATALOG_NOTE_STYLES: ShopNoteStyle[] = [
  ...BUILT_IN_NOTE_STYLES,
  ...SHOP_NOTE_STYLE_PACKS.flatMap((pack) => pack.noteStyles),
];

export function getShopNoteStyleByKey(styleKey?: string | null) {
  if (!styleKey) {
    return BUILT_IN_NOTE_STYLES[0];
  }

  return (
    ALL_CATALOG_NOTE_STYLES.find((style) => style.key === styleKey) ??
    BUILT_IN_NOTE_STYLES.find((style) => style.key === DEFAULT_NOTE_STYLE_KEY) ??
    BUILT_IN_NOTE_STYLES[0]
  );
}

export function getOwnedNoteStyles(ownedPackIds: Set<string>) {
  const unlockedPackStyles = SHOP_NOTE_STYLE_PACKS.filter(
    (pack) => pack.isIncluded || ownedPackIds.has(pack.id)
  ).flatMap((pack) => pack.noteStyles);

  return [...BUILT_IN_NOTE_STYLES, ...unlockedPackStyles];
}
