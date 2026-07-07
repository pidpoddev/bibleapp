import AsyncStorage from '@react-native-async-storage/async-storage';

import bible from '@/assets/bible.json';
import {
  SAVED_DESIGNS_STORAGE_KEY,
  VERSE_DESIGN_INDEX_STORAGE_KEY,
  VERSE_DESIGN_TIMESTAMPS_STORAGE_KEY,
} from '@/utils/storage-keys';
import {
  getVerseStorageKey,
  loadVerseStateMap,
  saveVerseStateMap,
  type HighlightColor,
  type DrawingStrokeData,
  type NoteData,
  type StickerData,
  type VerseCardData,
  type VerseEditorState,
} from '@/utils/verse-storage';

export { SAVED_DESIGNS_STORAGE_KEY };

type BibleBook = {
  book: string;
};

export type VerseDesignListItem = {
  key: string;
  storageKey: string;
  book: string;
  chapter: number;
  verse: number;
  selectedVerses: number[];
  verseCards: VerseCardData[];
  stickers: StickerData[];
  notes: NoteData[];
  drawingStrokes: DrawingStrokeData[];
  backgroundKey: string | null;
  highlights: Record<string, HighlightColor>;
  selectedFont: string;
  fontSize: number;
  savedAt: string;
};

const books = bible as BibleBook[];

function parseDesignKey(key: string) {
  const lastDashIndex = key.lastIndexOf('-');

  if (lastDashIndex === -1) {
    return null;
  }

  const chapterDashIndex = key.lastIndexOf('-', lastDashIndex - 1);

  if (chapterDashIndex === -1) {
    return null;
  }

  const book = key.slice(0, chapterDashIndex);
  const chapter = Number(key.slice(chapterDashIndex + 1, lastDashIndex));
  const selectedVerses = key
    .slice(lastDashIndex + 1)
    .split('_')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!book || !Number.isFinite(chapter) || selectedVerses.length === 0) {
    return null;
  }

  return {
    book,
    chapter,
    selectedVerses,
    verse: selectedVerses[0],
  };
}

export function isVerseDesignDecorated(state: VerseEditorState) {
  return (
    state.verseCards.length > 0 ||
    state.stickers.length > 0 ||
    state.notes.length > 0 ||
    state.drawingStrokes.length > 0 ||
    state.backgroundKey !== null ||
    Object.keys(state.highlightedWords).length > 0
  );
}

function getReferenceLabelFromItem(item: {
  book: string;
  chapter: number;
  selectedVerses?: number[];
  verse: number;
}) {
  const verses =
    item.selectedVerses && item.selectedVerses.length > 0
      ? item.selectedVerses.join(', ')
      : String(item.verse);

  return `${item.book} ${item.chapter}:${verses}`;
}

function getTimestampKey(book: string, designKey: string) {
  return `${book}:${designKey}`;
}

function getTimestampValue(savedAt: string) {
  const timestamp = Date.parse(savedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildVerseDesignListItem(
  book: string,
  key: string,
  state: VerseEditorState,
  savedAt: string
) {
  const parsedKey = parseDesignKey(key);

  if (!parsedKey || !isVerseDesignDecorated(state)) {
    return null;
  }

  return {
    key,
    storageKey: getVerseStorageKey(book),
    book: parsedKey.book,
    chapter: parsedKey.chapter,
    verse: parsedKey.verse,
    selectedVerses: parsedKey.selectedVerses,
    verseCards: state.verseCards.map((verseCard) => ({ ...verseCard })),
    stickers: state.stickers.map((sticker) => ({ ...sticker })),
    notes: state.notes.map((note) => ({ ...note })),
    drawingStrokes: state.drawingStrokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
    backgroundKey: state.backgroundKey,
    highlights: { ...state.highlightedWords },
    selectedFont: state.selectedFont,
    fontSize: state.fontSize,
    savedAt,
  };
}

function normalizeVerseDesignListItem(value: unknown): VerseDesignListItem | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Partial<VerseDesignListItem>;

  if (
    typeof candidate.key !== 'string' ||
    typeof candidate.storageKey !== 'string' ||
    typeof candidate.book !== 'string' ||
    typeof candidate.chapter !== 'number' ||
    typeof candidate.verse !== 'number' ||
    !Array.isArray(candidate.selectedVerses) ||
    !Array.isArray(candidate.verseCards) ||
    !Array.isArray(candidate.stickers) ||
    !Array.isArray(candidate.notes) ||
    (typeof candidate.drawingStrokes !== 'undefined' &&
      !Array.isArray(candidate.drawingStrokes)) ||
    typeof candidate.selectedFont !== 'string' ||
    typeof candidate.fontSize !== 'number'
  ) {
    return null;
  }

  return {
    key: candidate.key,
    storageKey: candidate.storageKey,
    book: candidate.book,
    chapter: candidate.chapter,
    verse: candidate.verse,
    selectedVerses: candidate.selectedVerses.filter(
      (verseNumber): verseNumber is number => typeof verseNumber === 'number'
    ),
    verseCards: candidate.verseCards as VerseCardData[],
    stickers: candidate.stickers as StickerData[],
    notes: candidate.notes as NoteData[],
    drawingStrokes: Array.isArray(candidate.drawingStrokes)
      ? (candidate.drawingStrokes as DrawingStrokeData[])
      : [],
    backgroundKey:
      typeof candidate.backgroundKey === 'string' ? candidate.backgroundKey : null,
    highlights:
      typeof candidate.highlights === 'object' && candidate.highlights !== null
        ? (candidate.highlights as Record<string, HighlightColor>)
        : {},
    selectedFont: candidate.selectedFont,
    fontSize: candidate.fontSize,
    savedAt: typeof candidate.savedAt === 'string' ? candidate.savedAt : '',
  };
}

async function loadVerseDesignTimestamps() {
  let savedValue: string | null = null;

  try {
    savedValue = await AsyncStorage.getItem(VERSE_DESIGN_TIMESTAMPS_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to load verse design timestamps', error);
  }

  if (!savedValue) {
    return {};
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(savedValue) as unknown;
  } catch (error) {
    console.warn('Failed to parse verse design timestamps', error);
    return {};
  }

  if (typeof parsedValue !== 'object' || parsedValue === null) {
    return {};
  }

  return Object.entries(parsedValue).reduce<Record<string, string>>(
    (timestamps, [key, value]) => {
      if (typeof value === 'string') {
        timestamps[key] = value;
      }

      return timestamps;
    },
    {}
  );
}

async function saveVerseDesignTimestamps(timestamps: Record<string, string>) {
  await AsyncStorage.setItem(
    VERSE_DESIGN_TIMESTAMPS_STORAGE_KEY,
    JSON.stringify(timestamps)
  );
}

async function loadVerseDesignIndex() {
  const savedValue = await AsyncStorage.getItem(VERSE_DESIGN_INDEX_STORAGE_KEY);

  if (!savedValue) {
    return {};
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(savedValue) as unknown;
  } catch (error) {
    console.warn('Failed to parse verse design index', error);
    return {};
  }

  if (typeof parsedValue !== 'object' || parsedValue === null) {
    return {};
  }

  return Object.entries(parsedValue).reduce<Record<string, VerseDesignListItem>>(
    (index, [key, value]) => {
      const item = normalizeVerseDesignListItem(value);

      if (item) {
        index[key] = item;
      }

      return index;
    },
    {}
  );
}

async function saveVerseDesignIndex(index: Record<string, VerseDesignListItem>) {
  await AsyncStorage.setItem(VERSE_DESIGN_INDEX_STORAGE_KEY, JSON.stringify(index));
}

export async function touchVerseDesignTimestamp(
  book: string,
  designKey: string,
  savedAt: string = new Date().toISOString()
) {
  const timestamps = await loadVerseDesignTimestamps();
  timestamps[getTimestampKey(book, designKey)] = savedAt;
  await saveVerseDesignTimestamps(timestamps);
}

export async function saveVerseDesignSnapshot(
  book: string,
  designKey: string,
  state: VerseEditorState,
  savedAt: string = new Date().toISOString()
) {
  const item = buildVerseDesignListItem(book, designKey, state, savedAt);

  if (!item) {
    return;
  }

  const index = await loadVerseDesignIndex();
  index[getTimestampKey(book, designKey)] = item;

  await Promise.all([
    saveVerseDesignIndex(index),
    touchVerseDesignTimestamp(book, designKey, savedAt),
  ]);
}

async function removeVerseDesignTimestamp(book: string, designKey: string) {
  const timestamps = await loadVerseDesignTimestamps();
  delete timestamps[getTimestampKey(book, designKey)];
  await saveVerseDesignTimestamps(timestamps);
}

export async function removeVerseDesignSnapshot(book: string, designKey: string) {
  const index = await loadVerseDesignIndex();
  delete index[getTimestampKey(book, designKey)];
  await Promise.all([
    saveVerseDesignIndex(index),
    removeVerseDesignTimestamp(book, designKey),
  ]);
}

export function getVerseDesignReferenceLabel(item: VerseDesignListItem) {
  return getReferenceLabelFromItem(item);
}

export async function loadVerseDesigns() {
  const [timestamps, indexedDesigns] = await Promise.all([
    loadVerseDesignTimestamps(),
    loadVerseDesignIndex(),
  ]);
  const designs = await Promise.all(
    books.map(async ({ book }) => {
      const storageKey = getVerseStorageKey(book);
      let stateMap: Record<string, VerseEditorState> = {};

      try {
        stateMap = await loadVerseStateMap(book);
      } catch (error) {
        console.warn(`Failed to load verse designs for ${book}`, error);
        return [];
      }

      return Object.entries(stateMap).reduce<VerseDesignListItem[]>(
        (items, [key, state]) => {
          const item = buildVerseDesignListItem(
            book,
            key,
            state,
            timestamps[getTimestampKey(book, key)] ?? ''
          );

          if (!item) {
            return items;
          }

          items.push({
            ...item,
            storageKey,
          });

          return items;
        },
        []
      );
    })
  );

  const designsById = new Map<string, VerseDesignListItem>(
    Object.entries(indexedDesigns)
  );

  designs.flat().forEach((item) => {
    const id = getTimestampKey(item.book, item.key);
    const indexedItem = designsById.get(id);

    designsById.set(id, {
      ...item,
      savedAt: item.savedAt || indexedItem?.savedAt || '',
    });
  });

  return Array.from(designsById.values()).sort((left, right) => {
    const savedAtComparison =
      getTimestampValue(right.savedAt) - getTimestampValue(left.savedAt);

    if (savedAtComparison !== 0) {
      return savedAtComparison;
    }

    return getReferenceLabelFromItem(left).localeCompare(getReferenceLabelFromItem(right));
  });
}

export async function deleteVerseDesign(item: VerseDesignListItem) {
  const stateMap = await loadVerseStateMap(item.book);
  const nextStateMap = { ...stateMap };
  delete nextStateMap[item.key];
  await saveVerseStateMap(item.book, nextStateMap);
  await removeVerseDesignSnapshot(item.book, item.key);

  const savedValue = await AsyncStorage.getItem(SAVED_DESIGNS_STORAGE_KEY);

  if (!savedValue) {
    return;
  }

  const parsedValue = JSON.parse(savedValue) as unknown;

  if (!Array.isArray(parsedValue)) {
    return;
  }

  await AsyncStorage.setItem(
    SAVED_DESIGNS_STORAGE_KEY,
    JSON.stringify(
      parsedValue.filter((design) => {
        if (typeof design !== 'object' || design === null) {
          return true;
        }

        return (design as { key?: unknown }).key !== item.key;
      })
    )
  );
}
