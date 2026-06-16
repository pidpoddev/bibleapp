import AsyncStorage from '@react-native-async-storage/async-storage';

export type StickerData = {
  id: number;
  emoji: string;
  imageKey?: string;
  x: number;
  y: number;
  scale: number;
  zIndex: number;
};

export type NoteData = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

export type HighlightColor = 'yellow' | 'pink' | 'blue';

export type VerseCardData = {
  id: string;
  verse: number;
  text: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  cardColorKey?: string;
};

export type VerseEditorState = {
  verseCards: VerseCardData[];
  stickers: StickerData[];
  notes: NoteData[];
  backgroundKey: string | null;
  selectedFont: string;
  fontSize: number;
  highlightedWords: Record<string, HighlightColor>;
};

export type VerseStateMap = Record<string, VerseEditorState>;

export const DEFAULT_VERSE_EDITOR_STATE: VerseEditorState = {
  verseCards: [],
  stickers: [],
  notes: [],
  backgroundKey: null,
  selectedFont: 'Playwrite',
  fontSize: 14,
  highlightedWords: {},
};

function normalizeVerseReference(reference: string) {
  return reference.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

export function getVerseStorageKey(reference: string) {
  return `verse_${normalizeVerseReference(reference)}`;
}

function isStickerData(value: unknown): value is StickerData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'number' &&
    typeof candidate.emoji === 'string' &&
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.scale === 'number' &&
    typeof candidate.zIndex === 'number'
  );
}

function isNoteData(value: unknown): value is NoteData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    typeof candidate.zIndex === 'number'
  );
}

function isVerseEditorState(value: unknown): value is VerseEditorState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    Array.isArray(candidate.verseCards) &&
    candidate.verseCards.every(isVerseCardData) &&
    Array.isArray(candidate.stickers) &&
    candidate.stickers.every(isStickerData) &&
    Array.isArray(candidate.notes) &&
    candidate.notes.every(isNoteData) &&
    (candidate.backgroundKey === null ||
      typeof candidate.backgroundKey === 'string' ||
      typeof candidate.backgroundKey === 'undefined') &&
    typeof candidate.selectedFont === 'string' &&
    typeof candidate.fontSize === 'number' &&
    typeof candidate.highlightedWords === 'object' &&
    candidate.highlightedWords !== null &&
    Object.values(candidate.highlightedWords as Record<string, unknown>).every(
      (color) => color === 'yellow' || color === 'pink' || color === 'blue'
    )
  );
}

function isVerseCardData(value: unknown): value is VerseCardData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.verse === 'number' &&
    typeof candidate.text === 'string' &&
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.scale === 'number' &&
    typeof candidate.rotation === 'number'
  );
}

function normalizeVerseEditorState(
  value: unknown,
  defaults: VerseEditorState = DEFAULT_VERSE_EDITOR_STATE
): VerseEditorState | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Partial<VerseEditorState>;
  const highlightedWordsValue = candidate.highlightedWords;
  const legacyNoteText =
    'noteText' in candidate && typeof candidate.noteText === 'string'
      ? candidate.noteText.trim()
      : '';
  const normalizedVerseCards = Array.isArray(candidate.verseCards)
    ? candidate.verseCards.reduce<VerseCardData[]>((accumulator, verseCard) => {
        if (typeof verseCard !== 'object' || verseCard === null) {
          return accumulator;
        }

        const normalizedVerseCard = verseCard as Partial<VerseCardData>;

        if (
          typeof normalizedVerseCard.id === 'string' &&
          typeof normalizedVerseCard.verse === 'number' &&
          typeof normalizedVerseCard.text === 'string' &&
          typeof normalizedVerseCard.x === 'number' &&
          typeof normalizedVerseCard.y === 'number' &&
          typeof normalizedVerseCard.scale === 'number' &&
          typeof normalizedVerseCard.rotation === 'number'
        ) {
          accumulator.push({
            id: normalizedVerseCard.id,
            verse: normalizedVerseCard.verse,
            text: normalizedVerseCard.text,
            x: normalizedVerseCard.x,
            y: normalizedVerseCard.y,
            scale: normalizedVerseCard.scale,
            rotation: normalizedVerseCard.rotation,
            cardColorKey:
              typeof normalizedVerseCard.cardColorKey === 'string'
                ? normalizedVerseCard.cardColorKey
                : undefined,
          });
        }

        return accumulator;
      }, [])
    : defaults.verseCards;
  const normalizedStickers = Array.isArray(candidate.stickers)
    ? candidate.stickers.reduce<StickerData[]>((accumulator, sticker, index) => {
        if (typeof sticker !== 'object' || sticker === null) {
          return accumulator;
        }

        const normalizedSticker = sticker as Partial<StickerData>;

        if (
          typeof normalizedSticker.id === 'number' &&
          typeof normalizedSticker.emoji === 'string' &&
          typeof normalizedSticker.x === 'number' &&
          typeof normalizedSticker.y === 'number' &&
          typeof normalizedSticker.scale === 'number'
        ) {
          accumulator.push({
            id: normalizedSticker.id,
            emoji: normalizedSticker.emoji,
            imageKey:
              typeof normalizedSticker.imageKey === 'string'
                ? normalizedSticker.imageKey
                : undefined,
            x: normalizedSticker.x,
            y: normalizedSticker.y,
            scale: normalizedSticker.scale,
            zIndex:
              typeof normalizedSticker.zIndex === 'number'
                ? normalizedSticker.zIndex
                : index,
          });
        }

        return accumulator;
      }, [])
    : defaults.stickers;
  const normalizedNotes = Array.isArray(candidate.notes)
    ? candidate.notes.reduce<NoteData[]>((accumulator, note, index) => {
        if (typeof note !== 'object' || note === null) {
          return accumulator;
        }

        const normalizedNote = note as Partial<NoteData>;

        if (
          typeof normalizedNote.id === 'string' &&
          typeof normalizedNote.text === 'string' &&
          typeof normalizedNote.x === 'number' &&
          typeof normalizedNote.y === 'number'
        ) {
          accumulator.push({
            id: normalizedNote.id,
            text: normalizedNote.text,
            x: normalizedNote.x,
            y: normalizedNote.y,
            width:
              typeof normalizedNote.width === 'number'
                ? normalizedNote.width
                : 170,
            height:
              typeof normalizedNote.height === 'number'
                ? normalizedNote.height
                : 120,
            zIndex:
              typeof normalizedNote.zIndex === 'number'
                ? normalizedNote.zIndex
                : index,
          });
        }

        return accumulator;
      }, [])
    : legacyNoteText
      ? [
          {
            id: 'legacy-note',
            text: legacyNoteText,
            x: 32,
            y: 220,
            width: 170,
            height: 120,
            zIndex: 0,
          },
        ]
      : defaults.notes;

  const normalizedHighlightedWords = Array.isArray(highlightedWordsValue)
    ? highlightedWordsValue.reduce<Record<string, HighlightColor>>((accumulator, index) => {
        if (typeof index === 'number') {
          accumulator[String(index)] = 'yellow';
        }

        return accumulator;
      }, {})
    : typeof highlightedWordsValue === 'object' && highlightedWordsValue !== null
      ? Object.entries(highlightedWordsValue as Record<string, unknown>).reduce<
          Record<string, HighlightColor>
        >((accumulator, [key, color]) => {
          if (color === 'yellow' || color === 'pink' || color === 'blue') {
            accumulator[key] = color;
          }

          return accumulator;
        }, {})
      : defaults.highlightedWords;

  return {
    verseCards: normalizedVerseCards,
    stickers: normalizedStickers,
    notes: normalizedNotes,
    backgroundKey:
      typeof candidate.backgroundKey === 'string'
        ? candidate.backgroundKey
        : candidate.backgroundKey === null
          ? null
          : defaults.backgroundKey,
    selectedFont:
      typeof candidate.selectedFont === 'string'
        ? candidate.selectedFont
        : defaults.selectedFont,
    fontSize:
      typeof candidate.fontSize === 'number'
        ? candidate.fontSize
        : defaults.fontSize,
    highlightedWords: normalizedHighlightedWords,
  };
}

export async function loadVerseStateMap(
  reference: string,
  fallbackKey?: string
): Promise<VerseStateMap> {
  const savedValue = await AsyncStorage.getItem(getVerseStorageKey(reference));

  if (!savedValue) {
    return {};
  }

  const parsedValue = JSON.parse(savedValue) as unknown;

  if (isVerseEditorState(parsedValue)) {
    return fallbackKey ? { [fallbackKey]: parsedValue } : {};
  }

  const normalizedLegacyState = normalizeVerseEditorState(parsedValue);

  if (normalizedLegacyState) {
    return fallbackKey ? { [fallbackKey]: normalizedLegacyState } : {};
  }

  if (typeof parsedValue !== 'object' || parsedValue === null) {
    return {};
  }

  return Object.entries(parsedValue as Record<string, unknown>).reduce<VerseStateMap>(
    (accumulator, [key, value]) => {
      const normalizedValue = normalizeVerseEditorState(value);

      if (normalizedValue) {
        accumulator[key] = normalizedValue;
      }

      return accumulator;
    },
    {}
  );
}

export async function saveVerseStateMap(
  reference: string,
  state: VerseStateMap
): Promise<void> {
  await AsyncStorage.setItem(
    getVerseStorageKey(reference),
    JSON.stringify(state)
  );
}

export async function loadVerseEditorState(
  reference: string,
  defaults: VerseEditorState = DEFAULT_VERSE_EDITOR_STATE
): Promise<VerseEditorState> {
  const savedValue = await AsyncStorage.getItem(getVerseStorageKey(reference));

  if (!savedValue) {
    return defaults;
  }

  const parsedValue = JSON.parse(savedValue) as Partial<VerseEditorState>;
  return normalizeVerseEditorState(parsedValue, defaults) ?? defaults;
}

export async function saveVerseEditorState(
  reference: string,
  state: VerseEditorState
): Promise<void> {
  await AsyncStorage.setItem(
    getVerseStorageKey(reference),
    JSON.stringify(state)
  );
}
