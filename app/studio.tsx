import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  PanGestureHandler,
  ScrollView as GestureHandlerScrollView,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { useNavigation, useRoute } from '@react-navigation/native';
import { EncryptedCloudSaveAction } from '@/components/encrypted-cloud-save-action';
import { SaveConfirmationToast } from '@/components/save-confirmation-toast';
import { markBibleVerseRead } from '@/utils/bible-reading-progress';
import {
  DEFAULT_VERSE_EDITOR_STATE,
  loadVerseStateMap,
  saveVerseStateMap,
  type DrawingStrokeData,
  type HighlightColor,
  type NoteData,
  type StickerData,
  type VerseCardData,
  type VerseEditorState,
  type VerseStateMap,
} from '@/utils/verse-storage';
import {
  getBooks,
  getChapters,
  getVerseText,
  getVerses,
  type BibleLanguageKey,
} from '@/utils/bible-data';
import { useAppSettings } from '@/utils/app-settings';
import { useResponsiveLayout } from '@/utils/responsive-layout';
import {
  getShopBackground,
  TEST_UNLOCKED_BACKGROUND_PACKS,
} from '@/utils/shop-backgrounds';
import {
  isVerseDesignDecorated,
  removeVerseDesignSnapshot,
  SAVED_DESIGNS_STORAGE_KEY,
  saveVerseDesignSnapshot,
} from '@/utils/verse-design-list';
import {
  LEGACY_SAVED_DESIGNS_STORAGE_KEY,
  JOURNAL_INDEX_KEY,
  SAVED_DESIGNS_BACKUP_STORAGE_KEY,
} from '@/utils/storage-keys';
import {
  getJournalEntryStorageKey,
  type JournalEntryType,
} from '@/utils/journal-storage';
import {
  getShopSticker,
  getShopStickerDisplaySize,
  TEST_UNLOCKED_STICKER_PACKS,
} from '@/utils/shop-stickers';

type Sticker = StickerData;
type Note = NoteData;
type VerseCard = VerseCardData;
type DrawingStroke = DrawingStrokeData;

type StickerUpdate = {
  x?: number;
  y?: number;
  scale?: number;
  zIndex?: number;
};

type NoteUpdate = {
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  styleKey?: string;
};

type VerseCardUpdate = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  autoSize?: boolean;
  scale?: number;
  rotation?: number;
  text?: string;
  cardColorKey?: string;
  zIndex?: number;
};

function getLatestWebNotes(notes: Note[]) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return notes;
  }

  const values = Array.from(document.querySelectorAll('textarea[placeholder="Write your thoughts..."]'))
    .map((textarea) => (textarea as HTMLTextAreaElement).value);

  if (values.length < notes.length) {
    return notes;
  }

  const mappedNotes = notes.map((note, index) => {
    const value = values[index];
    return { ...note, text: value || note.text };
  });

  if (values.length <= notes.length) {
    return mappedNotes;
  }

  const createdAt = Date.now();
  const extraNotes = values.slice(notes.length).flatMap((value, index) => {
    if (!value.trim()) {
      return [];
    }

    return [
      {
        id: `web-note-${createdAt}-${index}`,
        text: value,
        styleKey: DEFAULT_NOTE_STYLE_KEY,
        x: 28 + (notes.length + index) * 18,
        y: 210 + (notes.length + index) * 18,
        width: 150,
        height: 150,
        zIndex: notes.length + index + 1,
      },
    ];
  });

  return [...mappedNotes, ...extraNotes];
}

type DraggableStickerProps = {
  sticker: Sticker;
  isSelected: boolean;
  isLocked: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: StickerUpdate) => void;
};

type DraggableNoteProps = {
  note: Note;
  isSelected: boolean;
  isEditing: boolean;
  isLocked: boolean;
  isStyleEditorOpen: boolean;
  shouldAutoFocus: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: NoteUpdate) => void;
  onToggleStyleEditor: (id: string) => void;
  onAutoFocusHandled: () => void;
  onFocus: (id: string, y: number, height: number) => void;
  onBlur: (id: string) => void;
};

type DraggableVerseCardProps = {
  card: VerseCard;
  isActive: boolean;
  isLocked: boolean;
  verseTypography: {
    fontSize: number;
    lineHeight: number;
    fontFamily: 'Playwrite' | 'serif' | 'System';
    fontWeight?: '700';
  };
  highlightedWords: Record<string, HighlightColor>;
  onSelect: (verse: number) => void;
  onRemove: (verse: number) => void;
  onUpdate: (id: string, updates: VerseCardUpdate) => void;
  onToggleWordHighlight: (wordIndex: number) => void;
};

type SavedVerseDesign = {
  key: string;
  book?: string;
  chapter?: number;
  verse?: number;
  selectedVerses: number[];
  verseCards: VerseCard[];
  stickers: Sticker[];
  notes: Note[];
  drawingStrokes: DrawingStroke[];
  backgroundKey: string | null;
  highlights: Record<string, HighlightColor>;
  selectedFont: string;
  fontSize: number;
  savedAt: string;
};

type StudioJournalIndexEntry = {
  id: string;
  type: JournalEntryType;
  date: string;
  preview: string;
  updatedAt: number;
  isFavorite: boolean;
  editor: 'studio';
  book?: string;
  chapter?: number;
  verse?: number;
};

type StudioSaveTarget = JournalEntryType;

type StudioJournalPayload = {
  id: string;
  type: JournalEntryType;
  date: string;
  preview: string;
  updatedAt: number;
  isFavorite: boolean;
  editor: 'studio';
  saveTarget: StudioSaveTarget;
  design: SavedVerseDesign;
};

const STUDIO_SAVE_TARGET_OPTIONS: {
  key: StudioSaveTarget;
  label: string;
}[] = [
  { key: 'prayer', label: 'Prayer Journal' },
  { key: 'journal-studio', label: 'Studio' },
  { key: 'bible-study', label: 'Bible Study' },
  { key: 'church-day', label: 'Church Day' },
  { key: 'daily-devotional', label: 'Daily Devotional' },
];

const NOTE_STYLE_OPTIONS = [
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
] as const;

const DEFAULT_NOTE_STYLE_KEY = 'butter';

const MIN_SCALE = 0.7;
const MAX_SCALE = 2.4;
const MIN_NOTE_WIDTH = 100;
const MAX_NOTE_WIDTH = 300;
const MIN_NOTE_HEIGHT = 80;
const MAX_NOTE_HEIGHT = 300;
const TEMPLATE_NOTE_X = 12;
const TEMPLATE_NOTE_WIDTH = 286;
const TEMPLATE_NOTE_HEIGHT = 144;
const TEMPLATE_NOTE_VERTICAL_GAP = 16;
const TEMPLATE_NOTE_AFTER_VERSE_GAP = 28;
const TEMPLATE_VERSE_CARD_VERTICAL_GAP = 18;
const DEFAULT_VERSE_CARD_WIDTH = 292;
const DEFAULT_VERSE_CARD_MIN_WIDTH = 190;
const DEFAULT_VERSE_CARD_MAX_WIDTH = 360;
const DEFAULT_VERSE_CARD_MIN_HEIGHT = 112;
const DEFAULT_VERSE_CARD_MAX_HEIGHT = 520;
const DEFAULT_VERSE_CARD_INITIAL_WIDTHS = [190, 220, 252, DEFAULT_VERSE_CARD_WIDTH] as const;
const JOURNAL_LINE_COUNT = 24;
const JOURNAL_LINE_SPACING = 52;
const JOURNAL_LINE_TOP_OFFSET = 28;
const DEFAULT_CAPTURE_STAGE_MIN_HEIGHT = 460;
const VERSE_CARD_ESTIMATED_LINE_WIDTH = 28;
const DEFAULT_BOOK = 'John';
const DEFAULT_CHAPTER = 3;
const DEFAULT_VERSE = 16;
const VERSE_DESIGN_AUTOSAVE_DELAY_MS = 700;
const MAX_UNDO_HISTORY = 25;
const DRAWING_COLOR_OPTIONS = ['#3E3834', '#C36B7A', '#5D7FA6', '#6F8C5F', '#B98A3C'] as const;
const DRAWING_WIDTH_OPTIONS = [3, 6, 10] as const;
const DEFAULT_VERSE_CARD_COLOR_KEY = 'paper-cream';
const VERSE_CARD_COLOR_OPTIONS = [
  { key: 'paper-white', name: 'White', color: '#FFFFFF', borderColor: '#E7DDD5' },
  { key: 'paper-cream', name: 'Cream', color: '#FFFDF8', borderColor: '#E8DCD4' },
  { key: 'paper-blush', name: 'Blush', color: '#FFF1F5', borderColor: '#E7B7C7' },
  { key: 'paper-lavender', name: 'Lavender', color: '#F5F0FF', borderColor: '#C8C0EF' },
  { key: 'paper-sky', name: 'Sky', color: '#F0F7FF', borderColor: '#BDD5ED' },
  { key: 'paper-mint', name: 'Mint', color: '#F1FBF6', borderColor: '#B8DAC7' },
  { key: 'paper-clear', name: 'Clear', color: 'rgba(255, 255, 255, 0.68)', borderColor: '#D7CCC5' },
] as const;
const HIGHLIGHT_COLORS: { key: HighlightColor; color: string }[] = [
  { key: 'yellow', color: '#FFF3A3' },
  { key: 'pink', color: '#FFD2E1' },
  { key: 'blue', color: '#CFE7FF' },
];
const HIGHLIGHT_COLOR_MAP: Record<HighlightColor, string> = {
  yellow: '#FFF3A3',
  pink: '#FFD2E1',
  blue: '#CFE7FF',
};
function getVerseCardColorOption(key?: string) {
  return (
    VERSE_CARD_COLOR_OPTIONS.find((option) => option.key === key) ??
    VERSE_CARD_COLOR_OPTIONS.find((option) => option.key === DEFAULT_VERSE_CARD_COLOR_KEY) ??
    VERSE_CARD_COLOR_OPTIONS[0]
  );
}
function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function generateId() {
  return Date.now().toString();
}

function cloneVerseEditorState(state: VerseEditorState): VerseEditorState {
  return {
    verseCards: state.verseCards.map((verseCard) => ({ ...verseCard })),
    stickers: state.stickers.map((sticker) => ({ ...sticker })),
    notes: state.notes.map((note) => ({ ...note })),
    drawingStrokes: state.drawingStrokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
    backgroundKey: state.backgroundKey ?? null,
    selectedFont: state.selectedFont,
    fontSize: state.fontSize,
    highlightedWords: { ...state.highlightedWords },
  };
}

function getVerseEditorStateFromDesign(design: SavedVerseDesign): VerseEditorState {
  return {
    verseCards: (design.verseCards ?? []).map((verseCard) => ({ ...verseCard })),
    stickers: design.stickers.map((sticker) => ({ ...sticker })),
    notes: design.notes.map((note) => ({ ...note })),
    drawingStrokes: (design.drawingStrokes ?? []).map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
    backgroundKey: design.backgroundKey ?? null,
    selectedFont: design.selectedFont,
    fontSize: design.fontSize,
    highlightedWords: { ...design.highlights },
  };
}

function hasSavedVerseReference(
  design: Pick<SavedVerseDesign, 'book' | 'chapter' | 'verse'>
): design is Pick<Required<SavedVerseDesign>, 'book' | 'chapter' | 'verse'> {
  return (
    typeof design.book === 'string' &&
    design.book.length > 0 &&
    typeof design.chapter === 'number' &&
    Number.isFinite(design.chapter) &&
    typeof design.verse === 'number' &&
    Number.isFinite(design.verse)
  );
}

function getVerseOptions(book: string, chapter: number) {
  return getVerses(book, chapter).sort((left, right) => left - right);
}

function normalizeSelectedVerses(verses: number[], fallbackVerse: number) {
  const normalized = Array.from(
    new Set(verses.filter((verseNumber) => Number.isFinite(verseNumber)))
  ).sort((left, right) => left - right);

  return normalized.length > 0 ? normalized : [fallbackVerse];
}

function getDesignKey(book: string, chapter: number, verses: number[]) {
  return `${book}-${chapter}-${verses.join('_')}`;
}

function buildDefaultVerseCard(verse: number, text: string, index: number): VerseCard {
  const initialSize = getInitialVerseCardSize(
    text,
    Math.round(DEFAULT_VERSE_EDITOR_STATE.fontSize * 1.42)
  );

  return {
    id: `verse-card-${verse}`,
    verse,
    text,
    x: 18 + index * 18,
    y: 24 + index * 20,
    width: initialSize.width,
    height: initialSize.height,
    autoSize: true,
    scale: 1,
    rotation: Math.random() * 4 - 2,
    cardColorKey: DEFAULT_VERSE_CARD_COLOR_KEY,
    zIndex: index + 1,
  };
}

function getVerseCardWidth(card: VerseCard) {
  return card.width ?? DEFAULT_VERSE_CARD_WIDTH;
}

function getVerseCardHeight(card: VerseCard, lineHeight: number) {
  const estimatedHeight = estimateVerseCardHeight(card.text, lineHeight, getVerseCardWidth(card));

  if (card.autoSize !== false) {
    return estimatedHeight;
  }

  return card.height ?? estimatedHeight;
}

function getSelectedVersesFromCardsOrFallback(
  cards: VerseCard[],
  fallbackVerses: number[],
  fallbackVerse: number
) {
  const fromCards = Array.from(
    new Set(
      cards
        .map((card) => card.verse)
        .filter((verseNumber) => Number.isFinite(verseNumber))
    )
  ).sort((left, right) => left - right);

  if (fromCards.length > 0) {
    return fromCards;
  }

  return normalizeSelectedVerses(fallbackVerses, fallbackVerse);
}

function upsertFavoriteDesign(
  favorites: SavedVerseDesign[],
  nextFavorite: SavedVerseDesign,
  candidateKeys: (string | null | undefined)[]
) {
  const keySet = new Set(
    candidateKeys.filter((key): key is string => typeof key === 'string' && key.length > 0)
  );
  keySet.add(nextFavorite.key);

  const index = favorites.findIndex((favorite) => keySet.has(favorite.key));

  if (index === -1) {
    return [...favorites, nextFavorite];
  }

  const next = [...favorites];
  next[index] = nextFavorite;
  return next;
}

async function readAndSanitizeSavedDesigns(): Promise<SavedVerseDesign[]> {
  const rawValue = await AsyncStorage.getItem(SAVED_DESIGNS_STORAGE_KEY);
  const backupValue = await AsyncStorage.getItem(SAVED_DESIGNS_BACKUP_STORAGE_KEY);

  if (!rawValue && backupValue) {
    try {
      const backupParsed = JSON.parse(backupValue) as unknown;
      if (Array.isArray(backupParsed)) {
        await AsyncStorage.setItem(SAVED_DESIGNS_STORAGE_KEY, JSON.stringify(backupParsed));
        return backupParsed as SavedVerseDesign[];
      }
    } catch {}
  }

  if (!rawValue) {
    const legacyValue = await AsyncStorage.getItem(LEGACY_SAVED_DESIGNS_STORAGE_KEY);

    if (!legacyValue) {
      return [];
    }

    try {
      const legacyParsed = JSON.parse(legacyValue) as unknown;

      if (!Array.isArray(legacyParsed)) {
        return [];
      }

      const migrated = legacyParsed as SavedVerseDesign[];
      await AsyncStorage.setItem(SAVED_DESIGNS_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      return [];
    }
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      await AsyncStorage.setItem(SAVED_DESIGNS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }

    return parsed as SavedVerseDesign[];
  } catch {
    await AsyncStorage.setItem(SAVED_DESIGNS_STORAGE_KEY, JSON.stringify([]));
    return [];
  }
}

async function writeSavedDesigns(designs: SavedVerseDesign[]) {
  const json = JSON.stringify(designs);
  await Promise.all([
    AsyncStorage.setItem(SAVED_DESIGNS_STORAGE_KEY, json),
    AsyncStorage.setItem(SAVED_DESIGNS_BACKUP_STORAGE_KEY, json),
  ]);
}

async function upsertStudioJournalIndex(entry: StudioJournalIndexEntry) {
  const existingIndex = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
  const parsedIndex = existingIndex ? (JSON.parse(existingIndex) as StudioJournalIndexEntry[]) : [];
  const nextIndex = parsedIndex.some((item) => item.id === entry.id)
    ? parsedIndex.map((item) => (item.id === entry.id ? entry : item))
    : [entry, ...parsedIndex];
  nextIndex.sort((left, right) => right.updatedAt - left.updatedAt);
  await AsyncStorage.setItem(JOURNAL_INDEX_KEY, JSON.stringify(nextIndex));
}

function isStudioSaveTarget(value: unknown): value is StudioSaveTarget {
  return (
    value === 'prayer' ||
    value === 'journal-studio' ||
    value === 'bible-study' ||
    value === 'church-day' ||
    value === 'daily-devotional'
  );
}

function getNoteStyleOption(styleKey?: string) {
  return (
    NOTE_STYLE_OPTIONS.find((option) => option.key === styleKey) ??
    NOTE_STYLE_OPTIONS.find((option) => option.key === DEFAULT_NOTE_STYLE_KEY) ??
    NOTE_STYLE_OPTIONS[0]
  );
}

function buildStudioTemplateNotes(target: StudioSaveTarget): Note[] {
  const labels =
    target === 'prayer'
      ? [
          'What I’m praying for:',
          'What I’m thankful for:',
          'What’s on my heart:',
          'Give me peace about:',
          'Answered prayers:',
        ]
      : target === 'bible-study'
        ? [
            'What stands out:',
            'What it means:',
            'How I can apply it:',
            'Prayer response:',
            'Notes:',
          ]
        : target === 'church-day'
          ? [
              'Key message(s)',
              'How this spoke to me',
              'Prayer for this week',
            ]
          : target === 'daily-devotional'
            ? [
                'Reflections',
                'Application to my life',
                'Questions',
                'Key verses',
                'Prayer of the day',
              ]
            : [];

  return labels.map((label, index) => ({
    id: `template-${target}-${index + 1}`,
    label,
    placeholder: 'Write here...',
    text: '',
    styleKey: DEFAULT_NOTE_STYLE_KEY,
    x: TEMPLATE_NOTE_X,
    y: 24 + index * (TEMPLATE_NOTE_HEIGHT + TEMPLATE_NOTE_VERTICAL_GAP),
    width: TEMPLATE_NOTE_WIDTH,
    height: TEMPLATE_NOTE_HEIGHT,
    zIndex: index + 1,
  }));
}

function hasMeaningfulStudioContent(state: VerseEditorState) {
  return (
    state.verseCards.length > 0 ||
    state.stickers.length > 0 ||
    state.notes.some((note) => note.text.trim().length > 0) ||
    state.drawingStrokes.length > 0 ||
    state.backgroundKey !== null ||
    Object.keys(state.highlightedWords).length > 0
  );
}

function syncVerseCardsWithSelection(
  currentCards: VerseCard[],
  nextSelectedVerses: number[],
  book: string,
  chapter: number,
  language: BibleLanguageKey
) {
  return nextSelectedVerses.map((verseNumber, index) => {
    const existingCard = currentCards.find((card) => card.verse === verseNumber);
    const text = getVerseText(book, chapter, verseNumber, language);

    if (existingCard) {
      return {
        ...existingCard,
        text,
        zIndex:
          typeof existingCard.zIndex === 'number'
            ? existingCard.zIndex
            : index + 1,
      };
    }

    return buildDefaultVerseCard(verseNumber, text, index);
  });
}

function getEstimatedVerseLineWidth(cardWidth: number) {
  return Math.max(
    9,
    Math.floor(VERSE_CARD_ESTIMATED_LINE_WIDTH * (cardWidth / DEFAULT_VERSE_CARD_WIDTH))
  );
}

function estimateVerseCardHeight(
  text: string,
  lineHeight: number,
  cardWidth = DEFAULT_VERSE_CARD_WIDTH
) {
  const words = text.split(' ').filter(Boolean);
  const estimatedLineWidth = getEstimatedVerseLineWidth(cardWidth);

  if (words.length === 0) {
    return DEFAULT_VERSE_CARD_MIN_HEIGHT;
  }

  let lineCount = 1;
  let currentLineLength = 0;

  words.forEach((word) => {
    const nextLength = currentLineLength === 0 ? word.length : currentLineLength + word.length + 1;

    if (nextLength > estimatedLineWidth) {
      lineCount += 1;
      currentLineLength = word.length;
      return;
    }

    currentLineLength = nextLength;
  });

  return Math.ceil(72 + lineCount * (lineHeight + 4));
}

function getInitialVerseCardSize(text: string, lineHeight: number) {
  const width =
    DEFAULT_VERSE_CARD_INITIAL_WIDTHS.find(
      (candidateWidth) => estimateVerseCardHeight(text, lineHeight, candidateWidth) <= 178
    ) ?? DEFAULT_VERSE_CARD_WIDTH;

  return {
    width,
    height: clamp(
      estimateVerseCardHeight(text, lineHeight, width),
      DEFAULT_VERSE_CARD_MIN_HEIGHT,
      DEFAULT_VERSE_CARD_MAX_HEIGHT
    ),
  };
}

function shouldShiftTemplateNotesBelowVerses(target: StudioSaveTarget) {
  return target === 'bible-study' || target === 'daily-devotional';
}

function stackTemplateVerseCardsAtTop(
  cards: VerseCard[],
  lineHeight: number,
  target: StudioSaveTarget
) {
  if (!shouldShiftTemplateNotesBelowVerses(target) || cards.length <= 1) {
    return cards;
  }

  let nextY = 24;
  return cards.map((card) => {
    const nextCard = {
      ...card,
      x: 18,
      y: nextY,
      rotation: 0,
    };
    nextY += getVerseCardHeight(card, lineHeight) * card.scale + TEMPLATE_VERSE_CARD_VERTICAL_GAP;
    return nextCard;
  });
}

function shiftTemplateNotesBelowVerseCards(
  notes: Note[],
  cards: VerseCard[],
  lineHeight: number,
  target: StudioSaveTarget,
  options?: { allowMoveUp?: boolean }
) {
  if (!shouldShiftTemplateNotesBelowVerses(target) || notes.length === 0) {
    return notes;
  }

  const notesTop = Math.min(...notes.map((note) => note.y));
  const nextNotesTop =
    cards.length === 0
      ? 24
      : Math.ceil(
          Math.max(
            ...cards.map((card) => card.y + getVerseCardHeight(card, lineHeight) * card.scale)
          ) + TEMPLATE_NOTE_AFTER_VERSE_GAP
        );

  if (options?.allowMoveUp ? notesTop === nextNotesTop : notesTop >= nextNotesTop) {
    return notes;
  }

  const yOffset = nextNotesTop - notesTop;
  return notes.map((note) => ({
    ...note,
    y: note.y + yOffset,
  }));
}

function DraggableSticker({
  sticker,
  isSelected,
  isLocked,
  onSelect,
  onDelete,
  onUpdate,
}: DraggableStickerProps) {
  const resizeHandleRef = useRef(null);

  const translateX = useSharedValue(sticker.x);
  const translateY = useSharedValue(sticker.y);
  const scale = useSharedValue(sticker.scale);
  const selectionScale = useSharedValue(isSelected ? 1.02 : 1);

  const startX = useSharedValue(sticker.x);
  const startY = useSharedValue(sticker.y);
  const startScale = useSharedValue(sticker.scale);

  useEffect(() => {
    selectionScale.value = withTiming(isSelected ? 1.02 : 1, { duration: 140 });
  }, [isSelected, selectionScale]);

  const commitPosition = (x: number, y: number) => {
    onUpdate(sticker.id, { x, y });
  };

  const commitScale = (nextScale: number) => {
    onUpdate(sticker.id, { scale: nextScale });
  };

  const handleSelect = () => {
    if (isLocked) {
      return;
    }

    onSelect(sticker.id);
  };

  const onDragStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    'worklet';
    const { state, oldState } = event.nativeEvent;

    if (state === State.BEGAN) {
      startX.value = translateX.value;
      startY.value = translateY.value;
      runOnJS(handleSelect)();
    }

    if (oldState === State.ACTIVE || state === State.END) {
      runOnJS(commitPosition)(translateX.value, translateY.value);
    }
  };

  const onDragGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    'worklet';
    translateX.value = startX.value + event.nativeEvent.translationX;
    translateY.value = startY.value + event.nativeEvent.translationY;
  };

  const onResizeStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    'worklet';
    const { state, oldState } = event.nativeEvent;

    if (state === State.BEGAN) {
      startScale.value = scale.value;
      runOnJS(handleSelect)();
    }

    if (oldState === State.ACTIVE || state === State.END) {
      runOnJS(commitScale)(scale.value);
    }
  };

  const onResizeGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    'worklet';
    const { translationX, translationY } = event.nativeEvent;
    const scaleDelta = (translationX + translationY) / 180;

    scale.value = clamp(startScale.value + scaleDelta, MIN_SCALE, MAX_SCALE);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    zIndex: sticker.zIndex,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value * selectionScale.value },
    ],
  }));

  return (
    <PanGestureHandler
      enabled={!isLocked}
      maxPointers={1}
      minDist={6}
      waitFor={resizeHandleRef}
      onGestureEvent={onDragGestureEvent}
      onHandlerStateChange={onDragStateChange}>
      <Animated.View
        style={[
          styles.sticker,
          animatedStyle,
          isSelected ? styles.selectedSticker : styles.unselectedSticker,
        ]}>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            if (isLocked) {
              return;
            }
            onSelect(sticker.id);
          }}
          style={styles.stickerPressTarget}>
          {isSelected && !isLocked ? (
            <>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  onDelete(sticker.id);
                }}
                style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>X</Text>
              </Pressable>

              <PanGestureHandler
                ref={resizeHandleRef}
                enabled={!isLocked}
                maxPointers={1}
                minDist={2}
                onGestureEvent={onResizeGestureEvent}
                onHandlerStateChange={onResizeStateChange}>
                <Animated.View style={styles.resizeHandleWrapper}>
                  <Pressable
                    hitSlop={12}
                    onPress={(event) => {
                      event.stopPropagation();
                      if (isLocked) {
                        return;
                      }
                      onSelect(sticker.id);
                    }}
                    style={styles.resizeHandle}>
                    <Feather name="arrow-down-right" size={15} color="#1F1F1F" />
                  </Pressable>
                </Animated.View>
              </PanGestureHandler>
            </>
          ) : null}

          {sticker.imageKey && getShopSticker(sticker.imageKey) ? (
            <Image
              source={getShopSticker(sticker.imageKey)!.image}
              resizeMode="contain"
              style={[
                styles.stickerImage,
                getShopStickerDisplaySize(getShopSticker(sticker.imageKey)!),
              ]}
            />
          ) : (
            <Text style={styles.stickerText}>{sticker.emoji}</Text>
          )}
        </Pressable>
      </Animated.View>
    </PanGestureHandler>
  );
}

function DraggableNote({
  note,
  isSelected,
  isEditing,
  isLocked,
  isStyleEditorOpen,
  shouldAutoFocus,
  onSelect,
  onDelete,
  onUpdate,
  onToggleStyleEditor,
  onAutoFocusHandled,
  onFocus,
  onBlur,
}: DraggableNoteProps) {
  const { t } = useAppSettings();
  const NOTE_LINE_BUMP = 28;
  const resizeHandleRef = useRef(null);
  const translateX = useSharedValue(note.x);
  const translateY = useSharedValue(note.y);
  const width = useSharedValue(note.width);
  const height = useSharedValue(note.height);
  const selectionScale = useSharedValue(isSelected ? 1.02 : 1);
  const startX = useSharedValue(note.x);
  const startY = useSharedValue(note.y);
  const startWidth = useSharedValue(note.width);
  const startHeight = useSharedValue(note.height);
  const noteStyle = getNoteStyleOption(note.styleKey);

  useEffect(() => {
    selectionScale.value = withTiming(isSelected ? 1.02 : 1, { duration: 140 });
  }, [isSelected, selectionScale]);

  useEffect(() => {
    translateX.value = note.x;
    translateY.value = note.y;
    width.value = note.width;
    height.value = note.height;
  }, [height, note.height, note.width, note.x, note.y, translateX, translateY, width]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const commitPosition = (x: number, y: number) => {
    onUpdate(note.id, { x, y });
  };

  const commitSize = (nextWidth: number, nextHeight: number) => {
    onUpdate(note.id, { width: nextWidth, height: nextHeight });
  };

  const handleNoteTextChange = (text: string) => {
    const previousLineCount = (note.text.match(/\n/g)?.length ?? 0) + 1;
    const nextLineCount = (text.match(/\n/g)?.length ?? 0) + 1;

    if (nextLineCount > previousLineCount) {
      const nextHeight = clamp(
        note.height + (nextLineCount - previousLineCount) * NOTE_LINE_BUMP,
        MIN_NOTE_HEIGHT,
        MAX_NOTE_HEIGHT
      );

      if (nextHeight > note.height) {
        onUpdate(note.id, { text, height: nextHeight });
        return;
      }
    }

    onUpdate(note.id, { text });
  };

  const onDragStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    'worklet';
    const { state, oldState } = event.nativeEvent;

    if (state === State.BEGAN) {
      startX.value = translateX.value;
      startY.value = translateY.value;
      runOnJS(dismissKeyboard)();
      if (!isLocked) {
        runOnJS(onSelect)(note.id);
      }
    }

    if (!isLocked && (oldState === State.ACTIVE || state === State.END)) {
      runOnJS(commitPosition)(translateX.value, translateY.value);
    }
  };

  const onDragGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    'worklet';
    if (isLocked) {
      return;
    }
    translateX.value = startX.value + event.nativeEvent.translationX;
    translateY.value = startY.value + event.nativeEvent.translationY;
  };

  const onResizeStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    'worklet';
    const { state, oldState } = event.nativeEvent;

    if (state === State.BEGAN) {
      startWidth.value = width.value;
      startHeight.value = height.value;
      runOnJS(dismissKeyboard)();
      if (!isLocked) {
        runOnJS(onSelect)(note.id);
      }
    }

    if (!isLocked && (oldState === State.ACTIVE || state === State.END)) {
      runOnJS(commitSize)(width.value, height.value);
    }
  };

  const onResizeGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    'worklet';
    if (isLocked) {
      return;
    }
    width.value = clamp(
      startWidth.value + event.nativeEvent.translationX,
      MIN_NOTE_WIDTH,
      MAX_NOTE_WIDTH
    );
    height.value = clamp(
      startHeight.value + event.nativeEvent.translationY,
      MIN_NOTE_HEIGHT,
      MAX_NOTE_HEIGHT
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    zIndex: note.zIndex,
    width: width.value,
    height: height.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: selectionScale.value },
    ],
  }));

  return (
    <PanGestureHandler
      enabled={!isLocked}
      maxPointers={1}
      minDist={6}
      waitFor={resizeHandleRef}
      onGestureEvent={onDragGestureEvent}
      onHandlerStateChange={onDragStateChange}>
      <Animated.View
        style={[
          styles.noteCard,
          {
            backgroundColor: noteStyle.backgroundColor,
            borderColor: noteStyle.borderColor,
          },
          animatedStyle,
          isSelected ? styles.selectedNoteCard : styles.unselectedNoteCard,
        ]}>
        {isSelected && !isLocked ? (
          <>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onToggleStyleEditor(note.id);
              }}
              style={styles.noteEditButton}>
              <Feather name="edit-2" size={14} color="#1F1F1F" />
            </Pressable>

            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onDelete(note.id);
              }}
              style={styles.noteDeleteButton}>
              <Text style={styles.deleteButtonText}>X</Text>
            </Pressable>

            <PanGestureHandler
              ref={resizeHandleRef}
              enabled={!isLocked}
              maxPointers={1}
              minDist={2}
              onGestureEvent={onResizeGestureEvent}
              onHandlerStateChange={onResizeStateChange}>
              <Animated.View style={styles.noteResizeHandleWrapper}>
                <Pressable
                  hitSlop={12}
                  onPress={(event) => {
                    event.stopPropagation();
                    if (isLocked) {
                      return;
                    }
                    onSelect(note.id);
                  }}
                  style={styles.resizeHandle}>
                  <Feather name="arrow-down-right" size={15} color="#1F1F1F" />
                </Pressable>
              </Animated.View>
            </PanGestureHandler>

            {isStyleEditorOpen ? (
              <View
                onStartShouldSetResponder={() => true}
                style={[
                  styles.noteStylePanel,
                  {
                    backgroundColor: noteStyle.backgroundColor,
                    borderColor: noteStyle.borderColor,
                  },
                ]}>
                <Text style={[styles.noteStylePanelTitle, { color: noteStyle.textColor }]}>
                  {t('editorNoteStyleTitle')}
                </Text>
                <View style={styles.noteStyleSwatchRow}>
                  {NOTE_STYLE_OPTIONS.map((option) => {
                    const isActive = option.key === noteStyle.key;
                    const styleLabel = t(`editorNoteStyle${option.label}` as const);

                    return (
                      <Pressable
                        key={option.key}
                        accessibilityRole="button"
                        accessibilityLabel={t('editorUseNoteStyleAccessibility', {
                          style: styleLabel,
                        })}
                        accessibilityState={{ selected: isActive }}
                        onPress={(event) => {
                          event.stopPropagation();
                          onUpdate(note.id, { styleKey: option.key });
                        }}
                        style={[
                          styles.noteStyleSwatchButton,
                          {
                            backgroundColor: option.backgroundColor,
                            borderColor: isActive ? '#1F1F1F' : option.borderColor,
                          },
                          isActive ? styles.noteStyleSwatchButtonSelected : null,
                        ]}>
                        {isActive ? (
                          <Feather name="check" size={13} color="#1F1F1F" />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.noteShopHint}>
                  <Ionicons name="bag-outline" size={14} color={noteStyle.textColor} />
                  <Text style={[styles.noteShopHintText, { color: noteStyle.textColor }]}>
                    {t('editorMoreNoteStylesInShop')}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            if (isLocked) {
              return;
            }
            onSelect(note.id);
          }}
          style={styles.noteCardInner}>
          {note.label ? (
            <Text style={[styles.noteCardLabel, { color: noteStyle.textColor }]}>
              {note.label}
            </Text>
          ) : null}
          {isEditing ? (
            <TextInput
              editable={!isLocked}
              autoFocus={shouldAutoFocus}
              multiline
              scrollEnabled={false}
              placeholder={note.placeholder ?? 'Write your thoughts...'}
              placeholderTextColor={noteStyle.mutedTextColor}
              style={[styles.noteCardInput, { color: noteStyle.textColor }]}
              value={note.text}
              onFocus={() => {
                if (isLocked) {
                  return;
                }
                onSelect(note.id);
                onFocus(note.id, note.y, note.height);
                if (shouldAutoFocus) {
                  onAutoFocusHandled();
                }
              }}
              onBlur={() => {
                onBlur(note.id);
              }}
              onChangeText={handleNoteTextChange}
              {...(Platform.OS === 'web'
                ? {
                    onInput: (event: {
                      currentTarget?: { value?: string };
                      target?: { value?: string };
                    }) => {
                      const text = event.currentTarget?.value ?? event.target?.value;
                      if (typeof text === 'string') {
                        handleNoteTextChange(text);
                      }
                    },
                  }
                : null)}
              textAlignVertical="top"
            />
          ) : (
            <Text
              numberOfLines={6}
              style={[
                styles.noteCardPreviewText,
                { color: noteStyle.textColor },
                !note.text.trim() ? styles.noteCardPreviewPlaceholder : null,
                !note.text.trim() ? { color: noteStyle.mutedTextColor } : null,
              ]}>
              {note.text.trim() || note.placeholder || 'Tap to write...'}
            </Text>
          )}
        </Pressable>
      </Animated.View>
    </PanGestureHandler>
  );
}

function DraggableVerseCard({
  card,
  isActive,
  isLocked,
  verseTypography,
  highlightedWords,
  onSelect,
  onRemove,
  onUpdate,
  onToggleWordHighlight,
}: DraggableVerseCardProps) {
  const translateX = useSharedValue(card.x);
  const translateY = useSharedValue(card.y);
  const width = useSharedValue(getVerseCardWidth(card));
  const height = useSharedValue(getVerseCardHeight(card, verseTypography.lineHeight));
  const scale = useSharedValue(card.scale);
  const rotation = useSharedValue(card.rotation);
  const selectionScale = useSharedValue(isActive ? 1.02 : 1);
  const startX = useSharedValue(card.x);
  const startY = useSharedValue(card.y);
  const startWidth = useSharedValue(getVerseCardWidth(card));
  const startHeight = useSharedValue(getVerseCardHeight(card, verseTypography.lineHeight));
  const startScale = useSharedValue(card.scale);
  const startRotation = useSharedValue(card.rotation);
  const words = card.text.split(' ').filter(Boolean);
  const cardColor = getVerseCardColorOption(card.cardColorKey);
  const usesManualHeight = card.autoSize === false;

  useEffect(() => {
    translateX.value = card.x;
    translateY.value = card.y;
    width.value = getVerseCardWidth(card);
    height.value = getVerseCardHeight(card, verseTypography.lineHeight);
    scale.value = card.scale;
    rotation.value = card.rotation;
  }, [
    card,
    height,
    rotation,
    scale,
    translateX,
    translateY,
    verseTypography.lineHeight,
    width,
  ]);

  useEffect(() => {
    selectionScale.value = withTiming(isActive ? 1.02 : 1, { duration: 140 });
  }, [isActive, selectionScale]);

  const commitTransform = (
    x: number,
    y: number,
    nextScale: number,
    nextRotation: number
  ) => {
    onUpdate(card.id, {
      x,
      y,
      scale: nextScale,
      rotation: nextRotation,
    });
  };

  const handleSelect = () => {
    if (isLocked) {
      return;
    }

    onSelect(card.verse);
  };

  const commitSize = (nextWidth: number, nextHeight: number) => {
    onUpdate(card.id, {
      width: nextWidth,
      height: nextHeight,
      autoSize: false,
    });
  };

  const panGesture = Gesture.Pan()
    .enabled(!isLocked)
    .maxPointers(1)
    .minDistance(6)
    .averageTouches(true)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      runOnJS(handleSelect)();
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      runOnJS(commitTransform)(
        translateX.value,
        translateY.value,
        scale.value,
        rotation.value
      );
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(!isLocked)
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      startScale.value = scale.value;
      runOnJS(handleSelect)();
    })
    .onUpdate((event) => {
      scale.value = clamp(startScale.value * event.scale, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      runOnJS(commitTransform)(
        translateX.value,
        translateY.value,
        scale.value,
        rotation.value
      );
    });

  const rotationGesture = Gesture.Rotation()
    .enabled(!isLocked)
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      startRotation.value = rotation.value;
      runOnJS(handleSelect)();
    })
    .onUpdate((event) => {
      rotation.value = startRotation.value + (event.rotation * 180) / Math.PI;
    })
    .onEnd(() => {
      runOnJS(commitTransform)(
        translateX.value,
        translateY.value,
        scale.value,
        rotation.value
      );
    });

  const resizeGesture = Gesture.Pan()
    .enabled(!isLocked)
    .maxPointers(1)
    .minDistance(2)
    .onBegin(() => {
      startWidth.value = width.value;
      startHeight.value = height.value;
      runOnJS(handleSelect)();
    })
    .onUpdate((event) => {
      width.value = clamp(
        startWidth.value + event.translationX,
        DEFAULT_VERSE_CARD_MIN_WIDTH,
        DEFAULT_VERSE_CARD_MAX_WIDTH
      );
      height.value = clamp(
        startHeight.value + event.translationY,
        DEFAULT_VERSE_CARD_MIN_HEIGHT,
        DEFAULT_VERSE_CARD_MAX_HEIGHT
      );
    })
    .onEnd(() => {
      runOnJS(commitSize)(width.value, height.value);
    });

  const verseCardGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    rotationGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    zIndex: card.zIndex,
    elevation: card.zIndex,
    width: width.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value * selectionScale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));
  const manualHeightStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));
  const autoHeightStyle = useAnimatedStyle(() => ({
    minHeight: 0,
  }));

  return (
    <GestureDetector gesture={verseCardGesture}>
      <Animated.View
        style={[
          styles.verseCard,
          {
            backgroundColor: cardColor.color,
            borderColor: cardColor.borderColor,
          },
          animatedStyle,
          usesManualHeight ? manualHeightStyle : autoHeightStyle,
          isActive && styles.selectedVerseCard,
        ]}>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            if (isLocked) {
              return;
            }
            onSelect(card.verse);
          }}
          style={styles.verseCardInner}>
          <View style={styles.versePassage}>
            <View style={[styles.verseEntry, styles.verseEntryLast]}>
              <Text style={[styles.verseNumber, isActive && styles.verseNumberSelected]}>
                {card.verse}
              </Text>

              <View style={styles.verseWordsRow}>
                {words.map((word, index) => {
                  const highlightColor = isActive ? highlightedWords[String(index)] : undefined;

                  if (isActive && !isLocked) {
                    return (
                      <Pressable
                        key={`${card.id}-${index}`}
                        onPress={(event) => {
                          event.stopPropagation();
                          onToggleWordHighlight(index);
                        }}
                        style={[
                          styles.verseWordToken,
                          highlightColor
                            ? {
                                backgroundColor:
                                  HIGHLIGHT_COLOR_MAP[highlightColor],
                              }
                            : null,
                        ]}>
                        <Text
                          style={[
                            styles.verseWord,
                            styles.verseWordText,
                            verseTypography,
                          ]}>
                          {`${word} `}
                        </Text>
                      </Pressable>
                    );
                  }

                  return (
                    <View key={`${card.id}-${index}`} style={styles.verseWordToken}>
                      <Text
                        style={[
                          styles.verseWord,
                          styles.verseWordText,
                          verseTypography,
                        ]}>
                        {`${word} `}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </Pressable>
        {isActive && !isLocked ? (
          <Pressable
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              onRemove(card.verse);
            }}
            style={styles.verseRemoveButton}>
            <Feather name="x" size={16} color="#1F1F1F" />
          </Pressable>
        ) : null}
        {isActive && !isLocked ? (
          <GestureDetector gesture={resizeGesture}>
            <Animated.View style={styles.verseResizeHandleWrapper}>
              <Pressable
                hitSlop={12}
                onPress={(event) => {
                  event.stopPropagation();
                  if (isLocked) {
                    return;
                  }
                  onSelect(card.verse);
                }}
                style={styles.resizeHandle}>
                <Feather name="arrow-down-right" size={15} color="#1F1F1F" />
              </Pressable>
            </Animated.View>
          </GestureDetector>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

type FloatingItem =
  | { type: 'verse-card'; zIndex: number; item: VerseCard }
  | { type: 'note'; zIndex: number; item: Note }
  | { type: 'sticker'; zIndex: number; item: Sticker };

type ToolbarMenu =
  | 'fonts'
  | 'stickers'
  | 'backgrounds'
  | 'draw'
  | 'more'
  | null;

function DrawingLayer({ strokes }: { strokes: DrawingStroke[] }) {
  return (
    <View pointerEvents="none" style={styles.drawingLayer}>
      {strokes.flatMap((stroke) => {
        if (stroke.points.length === 1) {
          const point = stroke.points[0];

          if (!point) {
            return [];
          }

          return (
            <View
              key={`${stroke.id}-dot`}
              style={[
                styles.drawingDot,
                {
                  left: point.x - stroke.width / 2,
                  top: point.y - stroke.width / 2,
                  width: stroke.width,
                  height: stroke.width,
                  borderRadius: stroke.width / 2,
                  backgroundColor: stroke.color,
                },
              ]}
            />
          );
        }

        return stroke.points.slice(1).map((point, index) => {
          const previousPoint = stroke.points[index];

          if (!previousPoint) {
            return null;
          }

          const deltaX = point.x - previousPoint.x;
          const deltaY = point.y - previousPoint.y;
          const length = Math.hypot(deltaX, deltaY);
          const angle = Math.atan2(deltaY, deltaX);

          return (
            <View
              key={`${stroke.id}-${index}`}
              style={[
                styles.drawingSegment,
                {
                  left: (previousPoint.x + point.x) / 2 - length / 2,
                  top: (previousPoint.y + point.y) / 2 - stroke.width / 2,
                  width: length,
                  height: stroke.width,
                  borderRadius: stroke.width / 2,
                  backgroundColor: stroke.color,
                  transform: [{ rotateZ: `${angle}rad` }],
                },
              ]}
            />
          );
        });
      })}
    </View>
  );
}

const TOOLBAR_ICON_SOURCE = {
  text: require('../assets/images/toolbar-icons/text-tight.png'),
  decor: require('../assets/images/toolbar-icons/decor-tight.png'),
  canvas: require('../assets/images/toolbar-icons/canvas-tight.png'),
  note: require('../assets/images/toolbar-icons/notes-tight.png'),
  more: require('../assets/images/toolbar-icons/more-tight.png'),
} as const;

const TOOLBAR_ICON_OFFSET_Y = {
  text: -1,
  decor: -1,
  canvas: -1,
  note: -2,
  more: -2,
} as const;

export default function StudioScreen() {
  const { colorTheme, language, t } = useAppSettings();
  const layout = useResponsiveLayout();
  const navigation = useNavigation();
  const scrollViewRef = useRef<ScrollView>(null);
  const captureViewRef = useRef<View>(null);
  const draftFavoriteKeyRef = useRef<string | null>(null);
  const lastAppliedDesignKeyRef = useRef<string | null>(null);
  const lastAppliedBlankTokenRef = useRef<string | null>(null);
  const lastAppliedSelectionTokenRef = useRef<string | null>(null);
  const saveToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const favoriteAutosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasBootstrappedSavedDesignsRef = useRef(false);
  const lastAutoSavedVerseDesignSignatureRef = useRef<string | null>(null);
  const lastAutoSavedStudioJournalSignatureRef = useRef<string | null>(null);
  const route = useRoute<any>();
  const routeDesignParam =
    route.params?.design &&
    typeof route.params.design === 'object' &&
    route.params.design !== null
      ? (route.params.design as SavedVerseDesign)
      : null;
  const routeRestoreToken =
    typeof route.params?.restoreToken === 'string' ? route.params.restoreToken : null;
  const routeBlankStudioToken =
    typeof route.params?.blankStudioToken === 'string' && route.params.blankStudioToken.length > 0
      ? route.params.blankStudioToken
      : null;
  const routeOpenSelectedVerseParam = route.params?.openSelectedVerse === 'true';
  const routeSelectionToken =
    typeof route.params?.selectionToken === 'string' && route.params.selectionToken.length > 0
      ? route.params.selectionToken
      : null;
  const routeSelectedBookParam =
    typeof route.params?.selectedBook === 'string' && route.params.selectedBook.length > 0
      ? route.params.selectedBook
      : null;
  const routeSelectedChapterParam =
    typeof route.params?.selectedChapter === 'string'
      ? Number(route.params.selectedChapter)
      : typeof route.params?.selectedChapter === 'number'
        ? route.params.selectedChapter
        : null;
  const routeSelectedVerseParam =
    typeof route.params?.selectedVerse === 'string'
      ? Number(route.params.selectedVerse)
      : typeof route.params?.selectedVerse === 'number'
        ? route.params.selectedVerse
        : null;
  const hasRouteSelectedVerseParams =
    routeSelectedBookParam !== null &&
    routeSelectedChapterParam !== null &&
    Number.isFinite(routeSelectedChapterParam) &&
    routeSelectedVerseParam !== null &&
    Number.isFinite(routeSelectedVerseParam);
  const routeSourceParam =
    typeof route.params?.source === 'string' ? route.params.source : null;
  const routeFavoriteKeyParam =
    typeof route.params?.favoriteKey === 'string' ? route.params.favoriteKey : null;
  const routeEntryIdParam =
    typeof route.params?.entryId === 'string' ? route.params.entryId : null;
  const routeEntryTypeParam = isStudioSaveTarget(route.params?.entryType)
    ? route.params.entryType
    : null;
  const routeSaveTargetParam = isStudioSaveTarget(route.params?.saveTarget)
    ? route.params.saveTarget
    : null;
  const routeOpenToolbarParam =
    route.params?.openToolbar === 'backgrounds' ||
    route.params?.openToolbar === 'stickers' ||
    route.params?.openToolbar === 'draw'
      ? route.params.openToolbar
      : null;
  const routeDraftEntryIdParam =
    routeEntryIdParam ??
    (routeBlankStudioToken
      ? `studio-draft-${routeBlankStudioToken}`
      : routeSelectionToken
        ? `studio-selection-${routeSelectionToken}`
        : null);
  const defaultStudioSaveTarget =
    routeSaveTargetParam ?? routeEntryTypeParam ?? 'journal-studio';
  const [currentEntryId, setCurrentEntryId] = useState(() => routeDraftEntryIdParam ?? generateId());
  const [selectedSaveTarget, setSelectedSaveTarget] = useState<StudioSaveTarget>(
    defaultStudioSaveTarget
  );
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(() =>
    routeSelectedBookParam && getBooks().includes(routeSelectedBookParam)
      ? routeSelectedBookParam
      : ''
  );
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [selectedVerse, setSelectedVerse] = useState(0);
  const [selectedVerseCardVerse, setSelectedVerseCardVerse] = useState<number | null>(null);
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const [openToolbarMenu, setOpenToolbarMenu] = useState<ToolbarMenu>(null);
  const [isBookDropdownOpen, setIsBookDropdownOpen] = useState(false);
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);
  const [isVerseDropdownOpen, setIsVerseDropdownOpen] = useState(false);
  const [verseState, setVerseState] = useState<VerseStateMap>({});
  const [verseCards, setVerseCards] = useState<VerseCard[]>(DEFAULT_VERSE_EDITOR_STATE.verseCards);
  const [fontSize, setFontSize] = useState(DEFAULT_VERSE_EDITOR_STATE.fontSize);
  const [stickers, setStickers] = useState<Sticker[]>(DEFAULT_VERSE_EDITOR_STATE.stickers);
  const [notes, setNotes] = useState<Note[]>(DEFAULT_VERSE_EDITOR_STATE.notes);
  const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>(
    DEFAULT_VERSE_EDITOR_STATE.drawingStrokes
  );
  const drawingStrokesRef = useRef<DrawingStroke[]>(DEFAULT_VERSE_EDITOR_STATE.drawingStrokes);
  const activeDrawingStrokeIdRef = useRef<string | null>(null);
  const [selectedDrawingColor, setSelectedDrawingColor] = useState<(typeof DRAWING_COLOR_OPTIONS)[number]>(
    DRAWING_COLOR_OPTIONS[0]
  );
  const [selectedDrawingWidth, setSelectedDrawingWidth] = useState<(typeof DRAWING_WIDTH_OPTIONS)[number]>(
    DRAWING_WIDTH_OPTIONS[1]
  );
  const notesRef = useRef<Note[]>(DEFAULT_VERSE_EDITOR_STATE.notes);
  const replaceNotes = (nextNotes: Note[]) => {
    notesRef.current = nextNotes;
    setNotes(nextNotes);
  };
  const updateNotesState = (updater: (prev: Note[]) => Note[]) => {
    setNotes((prev) => {
      const nextNotes = updater(prev);
      notesRef.current = nextNotes;
      return nextNotes;
    });
  };
  const [backgroundKey, setBackgroundKey] = useState<string | null>(
    DEFAULT_VERSE_EDITOR_STATE.backgroundKey
  );
  const [selectedFont, setSelectedFont] = useState(
    DEFAULT_VERSE_EDITOR_STATE.selectedFont
  );
  const [highlightedWords, setHighlightedWords] = useState<Record<string, HighlightColor>>(
    DEFAULT_VERSE_EDITOR_STATE.highlightedWords
  );
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteStyleEditorId, setNoteStyleEditorId] = useState<string | null>(null);
  const [autoFocusNoteId, setAutoFocusNoteId] = useState<string | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [isStudioLocked, setIsStudioLocked] = useState(false);
  const [selectedHighlightColor, setSelectedHighlightColor] =
    useState<HighlightColor>('yellow');
  const [selectedStickerId, setSelectedStickerId] = useState<number | null>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [savedDesigns, setSavedDesigns] = useState<SavedVerseDesign[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [captureCanvasTop, setCaptureCanvasTop] = useState(0);
  const [focusedNoteTarget, setFocusedNoteTarget] = useState<{
    id: string;
    y: number;
    height: number;
  } | null>(null);
  const [hasLoadedSavedDesigns, setHasLoadedSavedDesigns] = useState(false);
  const [hasLoadedState, setHasLoadedState] = useState(false);
  const [saveToastMessage, setSaveToastMessage] = useState('');
  const [saveConfirmationMessage, setSaveConfirmationMessage] = useState('Saved!');
  const [saveConfirmationKey, setSaveConfirmationKey] = useState(0);
  const [undoHistory, setUndoHistory] = useState<VerseEditorState[]>([]);
  const [isFavoriteActive, setIsFavoriteActive] = useState(false);
  const bookOptions = getBooks();
  const hasBookSelection = selectedBook.length > 0;
  const hasChapterSelection = hasBookSelection && selectedChapter > 0;
  const hasVerseSelection =
    hasChapterSelection && selectedVerse > 0 && selectedVerses.length > 0;
  const chapterOptions = hasBookSelection ? getChapters(selectedBook) : [];
  const verseOptions = hasChapterSelection ? getVerseOptions(selectedBook, selectedChapter) : [];
  const verseDropdownLabel =
    !hasVerseSelection
      ? t('commonVerse')
      : selectedVerses.length <= 1
      ? `V ${selectedVerse}`
      : `V ${selectedVerse} +${selectedVerses.length - 1}`;
  const getTranslatedStudioSaveTargetLabel = useCallback(
    (target: StudioSaveTarget) => {
      switch (target) {
        case 'prayer':
          return t('prayerJournal');
        case 'bible-study':
          return t('bibleStudy');
        case 'church-day':
          return t('churchDay');
        case 'daily-devotional':
          return t('dailyDevotional');
        case 'journal-studio':
        default:
          return t('tabStudio');
      }
    },
    [t]
  );
  const normalizedSelectedVerses = useMemo(
    () =>
      hasVerseSelection
        ? normalizeSelectedVerses(selectedVerses, selectedVerse)
        : [],
    [hasVerseSelection, selectedVerse, selectedVerses]
  );

  useEffect(() => {
    setSelectedSaveTarget(defaultStudioSaveTarget);
  }, [defaultStudioSaveTarget]);

  useEffect(() => {
    if (routeOpenToolbarParam) {
      setOpenToolbarMenu(routeOpenToolbarParam);
    }
  }, [routeOpenToolbarParam, routeSelectionToken]);
  const designKey = useMemo(
    () =>
      hasVerseSelection
        ? getDesignKey(selectedBook, selectedChapter, normalizedSelectedVerses)
        : 'draft',
    [hasVerseSelection, normalizedSelectedVerses, selectedBook, selectedChapter]
  );
  const verseLineHeight = Math.round(fontSize * 1.42);
  const contentStageMinHeight = Math.max(
    DEFAULT_CAPTURE_STAGE_MIN_HEIGHT,
    ...verseCards.map(
      (card) =>
        card.y +
        getVerseCardHeight(card, verseLineHeight) * card.scale +
        56
    ),
    ...notes.map((note) => note.y + note.height + 56),
    ...stickers.map((sticker) => sticker.y + 96 * sticker.scale + 56),
    ...drawingStrokes.flatMap((stroke) =>
      stroke.points.map((point) => point.y + stroke.width + 56)
    )
  );
  const journalLineCount = Math.max(
    JOURNAL_LINE_COUNT,
    Math.ceil((contentStageMinHeight + JOURNAL_LINE_TOP_OFFSET + 120) / JOURNAL_LINE_SPACING)
  );
  const verseTypography: DraggableVerseCardProps['verseTypography'] = {
    fontSize,
    lineHeight: verseLineHeight,
    fontFamily:
      selectedFont === 'Playwrite'
        ? 'Playwrite'
        : selectedFont === 'serif'
          ? 'serif'
          : 'System',
    ...(selectedFont === 'bold' ? { fontWeight: '700' as const } : null),
  };
  const floatingItems: FloatingItem[] = [
    ...verseCards.map((card) => ({
      type: 'verse-card' as const,
      zIndex: card.zIndex ?? 0,
      item: card,
    })),
    ...notes.map((note) => ({ type: 'note' as const, zIndex: note.zIndex, item: note })),
    ...stickers.map((sticker) => ({
      type: 'sticker' as const,
      zIndex: sticker.zIndex,
      item: sticker,
    })),
  ].sort((left, right) => left.zIndex - right.zIndex);

  const [fontsLoaded] = useFonts({
    Playwrite: require('../assets/fonts/PlaywriteDEGrund.ttf'),
  });
  const isCurrentVerseSaved = savedDesigns.some(
    (design) =>
      design.key === routeFavoriteKeyParam ||
      design.key === routeDesignParam?.key ||
      (draftFavoriteKeyRef.current !== null && design.key === draftFavoriteKeyRef.current)
  );
  const saveToastOpacity = useSharedValue(0);
  const saveToastTranslateY = useSharedValue(12);
  const currentEditorState: VerseEditorState = useMemo(
    () => ({
      verseCards,
      stickers,
      notes,
      drawingStrokes,
      backgroundKey,
      selectedFont,
      fontSize,
      highlightedWords,
    }),
    [backgroundKey, drawingStrokes, fontSize, highlightedWords, notes, selectedFont, stickers, verseCards]
  );

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    drawingStrokesRef.current = drawingStrokes;
  }, [drawingStrokes]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }

    const captureLatestNotes = () => {
      notesRef.current = getLatestWebNotes(notesRef.current);
    };

    document.addEventListener('pointerdown', captureLatestNotes, true);
    return () => document.removeEventListener('pointerdown', captureLatestNotes, true);
  }, []);
  const isLoadingRouteSelectedVerse =
    hasRouteSelectedVerseParams &&
    !routeDesignParam &&
    (selectedBook !== routeSelectedBookParam ||
      selectedChapter !== routeSelectedChapterParam ||
      selectedVerse !== routeSelectedVerseParam);
  const displayBackgroundKey = isLoadingRouteSelectedVerse
    ? DEFAULT_VERSE_EDITOR_STATE.backgroundKey
    : backgroundKey;
  const hasDecoratedStudioContent = hasMeaningfulStudioContent(currentEditorState);
  const canSaveCurrentVerse =
    !isLoadingRouteSelectedVerse && (hasVerseSelection || hasDecoratedStudioContent);
  const canAddCurrentDesignToFavorites = !isLoadingRouteSelectedVerse && hasDecoratedStudioContent;
  const selectedStudioBackground = getShopBackground(displayBackgroundKey);
  const activeVerseCardColorKey =
    verseCards.find((card) => card.verse === selectedVerse)?.cardColorKey ??
    DEFAULT_VERSE_CARD_COLOR_KEY;
  const favoriteBaseBook = selectedBook || routeDesignParam?.book || DEFAULT_BOOK;
  const favoriteBaseChapter = selectedChapter || routeDesignParam?.chapter || DEFAULT_CHAPTER;
  const favoriteBaseVerse = selectedVerse || routeDesignParam?.verse || DEFAULT_VERSE;
  const favoriteBaseVerses =
    normalizedSelectedVerses.length > 0
      ? normalizedSelectedVerses
      : normalizeSelectedVerses(
          routeDesignParam?.selectedVerses ?? [favoriteBaseVerse],
          favoriteBaseVerse
        );
  const favoritePersistKey = routeFavoriteKeyParam ?? routeDesignParam?.key ?? designKey;
  const favoriteStableKey = routeFavoriteKeyParam ?? routeDesignParam?.key ?? designKey;
  const favoritePersistVerses = getSelectedVersesFromCardsOrFallback(
    verseCards,
    favoriteBaseVerses,
    favoriteBaseVerse
  );
  const activeNoteEditingId = selectedNoteId ?? focusedNoteId;
  const canUseDrawingTool = layout.isTablet;
  const isDrawingMode = canUseDrawingTool && openToolbarMenu === 'draw' && !isStudioLocked;

  const getHighestZIndex = () =>
    Math.max(
      0,
      ...verseCards.map((card) => card.zIndex ?? 0),
      ...stickers.map((sticker) => sticker.zIndex),
      ...notes.map((note) => note.zIndex),
      ...drawingStrokes.map((stroke) => stroke.zIndex)
    );

  const saveToastAnimatedStyle = useAnimatedStyle(() => ({
    opacity: saveToastOpacity.value,
    transform: [{ translateY: saveToastTranslateY.value }],
  }));

  const showSaveToast = (message: string) => {
    setSaveToastMessage(message);
    saveToastOpacity.value = withTiming(1, { duration: 180 });
    saveToastTranslateY.value = withTiming(0, { duration: 180 });

    if (saveToastTimeoutRef.current) {
      clearTimeout(saveToastTimeoutRef.current);
    }

    saveToastTimeoutRef.current = setTimeout(() => {
      saveToastOpacity.value = withTiming(0, { duration: 220 });
      saveToastTranslateY.value = withTiming(12, { duration: 220 });
    }, 1800);
  };

  const showSaveConfirmation = (message = 'Saved!') => {
    setSaveConfirmationMessage(message);
    setSaveConfirmationKey((current) => current + 1);
  };

  const resetStudioToBlank = useCallback((nextEntryId?: string, nextSaveTarget: StudioSaveTarget = defaultStudioSaveTarget) => {
    const nextEditorState = cloneVerseEditorState(DEFAULT_VERSE_EDITOR_STATE);
    const nextTemplateNotes = buildStudioTemplateNotes(nextSaveTarget);

    lastAppliedDesignKeyRef.current = null;
    draftFavoriteKeyRef.current = null;
    setCurrentEntryId(nextEntryId ?? generateId());
    setSelectedSaveTarget(nextSaveTarget);
    setVerseState({});
    setSelectedBook('');
    setSelectedChapter(0);
    setSelectedVerse(0);
    setSelectedVerseCardVerse(null);
    setSelectedVerses([]);
    setVerseCards(nextEditorState.verseCards);
    setStickers(nextEditorState.stickers);
    notesRef.current = nextTemplateNotes;
    replaceNotes(nextTemplateNotes);
    setDrawingStrokes(nextEditorState.drawingStrokes);
    setBackgroundKey(nextEditorState.backgroundKey ?? null);
    setSelectedFont(nextEditorState.selectedFont);
    setFontSize(nextEditorState.fontSize);
    setHighlightedWords(nextEditorState.highlightedWords);
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setAutoFocusNoteId(null);
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
    setOpenToolbarMenu(null);
    setIsBookDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsVerseDropdownOpen(false);
    setUndoHistory([]);
    setIsFavoriteActive(false);
    setIsStudioLocked(false);
    setHasLoadedState(true);
  }, [defaultStudioSaveTarget]);

  const ensureFavoriteKey = useCallback(() => {
    if (routeFavoriteKeyParam) {
      return routeFavoriteKeyParam;
    }

    if (routeDesignParam?.key) {
      return routeDesignParam.key;
    }

    if (!draftFavoriteKeyRef.current) {
      draftFavoriteKeyRef.current = `studio-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
    }

    return draftFavoriteKeyRef.current;
  }, [routeDesignParam, routeFavoriteKeyParam]);

  const buildStudioPreview = useCallback(
    (nextNotes: Note[]) => {
      const notePreview = nextNotes.map((note) => note.text.trim()).find(Boolean) ?? '';
      const referencePreview = hasVerseSelection
        ? `${selectedBook} ${selectedChapter}:${selectedVerse}`.trim()
        : '';

      return (referencePreview ? `${referencePreview} ${notePreview}` : notePreview || 'Blank Studio design')
        .trim()
        .slice(0, 80);
    },
    [hasVerseSelection, selectedBook, selectedChapter, selectedVerse]
  );

  const buildCurrentSavedDesign = useCallback(
    (favoriteKey: string, savedAt: string, nextNotes: Note[]): SavedVerseDesign => ({
      key: favoriteKey,
      ...(hasVerseSelection
        ? {
            book: selectedBook,
            chapter: selectedChapter,
            verse: selectedVerse,
            selectedVerses: normalizedSelectedVerses,
          }
        : {
            selectedVerses: [],
          }),
      verseCards: verseCards.map((verseCard) => ({ ...verseCard })),
      stickers: stickers.map((sticker) => ({ ...sticker })),
      notes: nextNotes.map((note) => ({ ...note })),
      drawingStrokes: drawingStrokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((point) => ({ ...point })),
      })),
      backgroundKey,
      highlights: { ...highlightedWords },
      selectedFont,
      fontSize,
      savedAt,
    }),
    [
      backgroundKey,
      drawingStrokes,
      fontSize,
      hasVerseSelection,
      highlightedWords,
      normalizedSelectedVerses,
      selectedBook,
      selectedChapter,
      selectedFont,
      selectedVerse,
      stickers,
      verseCards,
    ]
  );

  const buildStudioJournalPayload = useCallback(
    (
      entryId: string,
      nextDesign: SavedVerseDesign,
      preview: string,
      updatedAt: number,
      isFavorite: boolean,
      saveTarget: StudioSaveTarget = selectedSaveTarget
    ): StudioJournalPayload => ({
      id: entryId,
      type: saveTarget,
      date: new Date().toLocaleString(),
      preview,
      updatedAt,
      isFavorite,
      editor: 'studio',
      saveTarget,
      design: nextDesign,
    }),
    [selectedSaveTarget]
  );

  const saveStudioJournalEntry = useCallback(
    async (isFavorite: boolean, saveTarget: StudioSaveTarget = selectedSaveTarget) => {
      const latestNotes = getLatestWebNotes(notesRef.current);
      notesRef.current = latestNotes;
      const latestEditorState = {
        ...currentEditorState,
        notes: latestNotes,
      };

      if (!hasMeaningfulStudioContent(latestEditorState)) {
        return;
      }

      const favoriteKey = ensureFavoriteKey();
      const updatedAt = Date.now();
      const entryId = routeDraftEntryIdParam ?? currentEntryId ?? generateId();
      const nextDesign = buildCurrentSavedDesign(
        favoriteKey,
        new Date().toISOString(),
        latestNotes
      );
      const preview = buildStudioPreview(latestNotes);
      const studioJournalPayload = buildStudioJournalPayload(
        entryId,
        nextDesign,
        preview,
        updatedAt,
        isFavorite,
        saveTarget
      );

      setSelectedSaveTarget(saveTarget);
      await AsyncStorage.setItem(
        getJournalEntryStorageKey({ id: entryId, type: studioJournalPayload.type }),
        JSON.stringify(studioJournalPayload)
      );
      await upsertStudioJournalIndex({
        id: entryId,
        type: studioJournalPayload.type,
        date: studioJournalPayload.date,
        preview,
        updatedAt,
        isFavorite,
        editor: 'studio',
      });
    },
    [
      buildStudioJournalPayload,
      buildCurrentSavedDesign,
      buildStudioPreview,
      currentEditorState,
      currentEntryId,
      ensureFavoriteKey,
      routeDraftEntryIdParam,
      selectedSaveTarget,
    ]
  );

  useEffect(() => {
    if (!routeBlankStudioToken) {
      return;
    }

    if (lastAppliedBlankTokenRef.current === routeBlankStudioToken) {
      return;
    }

    lastAppliedBlankTokenRef.current = routeBlankStudioToken;
    resetStudioToBlank(routeDraftEntryIdParam ?? undefined, defaultStudioSaveTarget);
  }, [defaultStudioSaveTarget, resetStudioToBlank, routeBlankStudioToken, routeDraftEntryIdParam]);

  useEffect(() => {
    if (
      !hasRouteSelectedVerseParams ||
      !routeSelectedBookParam
    ) {
      return;
    }

    const selectionParamsKey = `${routeSelectionToken ?? 'direct'}:${routeSelectedBookParam}:${routeSelectedChapterParam ?? ''}:${routeSelectedVerseParam ?? ''}`;

    if (lastAppliedSelectionTokenRef.current === selectionParamsKey) {
      return;
    }

    if (!getBooks().includes(routeSelectedBookParam)) {
      return;
    }

    const nextChapter = routeSelectedChapterParam ?? 0;
    const nextVerse = routeSelectedVerseParam ?? 0;
    const bookChapters = getChapters(routeSelectedBookParam);

    if (
      !bookChapters.includes(nextChapter) ||
      !getVerseOptions(routeSelectedBookParam, nextChapter).includes(nextVerse)
    ) {
      return;
    }

    const applySelectedVerse = async () => {
      await markBibleVerseRead({
        book: routeSelectedBookParam,
        chapter: nextChapter,
        verse: nextVerse,
      }).catch((error) => {
        console.warn('Failed to track Bible reading progress', error);
      });

      if (routeDraftEntryIdParam) {
        const stored = await AsyncStorage.getItem(
          getJournalEntryStorageKey({
            id: routeDraftEntryIdParam,
            type: routeEntryTypeParam ?? defaultStudioSaveTarget,
          })
        );

        if (stored) {
          const parsed = JSON.parse(stored) as Partial<StudioJournalPayload>;

          if (parsed?.design && hasSavedVerseReference(parsed.design)) {
            const d = parsed.design;
            lastAppliedSelectionTokenRef.current = selectionParamsKey;
            lastAppliedDesignKeyRef.current = `draft-${routeDraftEntryIdParam}-${parsed.updatedAt ?? 0}`;
            draftFavoriteKeyRef.current = d.key;
            setCurrentEntryId(routeDraftEntryIdParam);
            setSelectedSaveTarget(
              isStudioSaveTarget(parsed.saveTarget) ? parsed.saveTarget : routeEntryTypeParam ?? defaultStudioSaveTarget
            );
            setSelectedBook(d.book);
            setSelectedChapter(d.chapter);
            setSelectedVerse(d.verse);
            setSelectedVerseCardVerse(d.verse);
            const restoredVerses = normalizeSelectedVerses(d.selectedVerses ?? [d.verse], d.verse);
            setSelectedVerses(restoredVerses);
            setVerseCards(
              syncVerseCardsWithSelection(
                d.verseCards || [],
                restoredVerses,
                d.book,
                d.chapter,
                language.key
              )
            );
            setStickers(d.stickers || []);
            notesRef.current = d.notes || [];
            replaceNotes(d.notes || []);
            setDrawingStrokes(d.drawingStrokes || []);
            setBackgroundKey(d.backgroundKey ?? null);
            setHighlightedWords(d.highlights || {});
            setSelectedFont(d.selectedFont || DEFAULT_VERSE_EDITOR_STATE.selectedFont);
            setFontSize(d.fontSize || DEFAULT_VERSE_EDITOR_STATE.fontSize);
            setSelectedStickerId(null);
            setSelectedNoteId(null);
            setAutoFocusNoteId(null);
            setFocusedNoteId(null);
            setFocusedNoteTarget(null);
            setOpenToolbarMenu(null);
            setIsBookDropdownOpen(false);
            setIsChapterDropdownOpen(false);
            setIsVerseDropdownOpen(false);
            setUndoHistory([]);
            setIsFavoriteActive(Boolean(parsed.isFavorite));
            return;
          }
        }
      }

      const nextSelectedVerses = [nextVerse];

      lastAppliedSelectionTokenRef.current = selectionParamsKey;
      draftFavoriteKeyRef.current = null;
      const nextSaveTarget = routeEntryTypeParam ?? defaultStudioSaveTarget;
      const nextTemplateNotes = buildStudioTemplateNotes(nextSaveTarget);
      const nextVerseCards = stackTemplateVerseCardsAtTop(
        syncVerseCardsWithSelection(
          DEFAULT_VERSE_EDITOR_STATE.verseCards,
          nextSelectedVerses,
          routeSelectedBookParam,
          nextChapter,
          language.key
        ),
        verseLineHeight,
        nextSaveTarget
      );
      const nextNotes = shiftTemplateNotesBelowVerseCards(
        nextTemplateNotes,
        nextVerseCards,
        verseLineHeight,
        nextSaveTarget
      );

      setCurrentEntryId(routeDraftEntryIdParam ?? generateId());
      setSelectedSaveTarget(nextSaveTarget);
      setIsFavoriteActive(false);
      setSelectedBook(routeSelectedBookParam);
      setSelectedChapter(nextChapter);
      setSelectedVerse(nextVerse);
      setSelectedVerseCardVerse(nextVerse);
      setSelectedVerses(nextSelectedVerses);
      setVerseCards(nextVerseCards);
      setStickers(DEFAULT_VERSE_EDITOR_STATE.stickers);
      notesRef.current = nextNotes;
      replaceNotes(nextNotes);
      setDrawingStrokes(DEFAULT_VERSE_EDITOR_STATE.drawingStrokes);
      setBackgroundKey(DEFAULT_VERSE_EDITOR_STATE.backgroundKey);
      setSelectedFont(DEFAULT_VERSE_EDITOR_STATE.selectedFont);
      setFontSize(DEFAULT_VERSE_EDITOR_STATE.fontSize);
      setHighlightedWords(DEFAULT_VERSE_EDITOR_STATE.highlightedWords);
      setUndoHistory([]);
    };

    void applySelectedVerse().catch((error) => {
      console.warn('Failed to apply selected Studio verse', error);
    });
  }, [
    defaultStudioSaveTarget,
    hasRouteSelectedVerseParams,
    language.key,
    routeDraftEntryIdParam,
    routeEntryTypeParam,
    routeOpenSelectedVerseParam,
    routeSelectedBookParam,
    routeSelectedChapterParam,
    routeSelectedVerseParam,
    routeSelectionToken,
    verseLineHeight,
  ]);

  const persistFavoriteToStorage = useCallback(async () => {
    if (!isFavoriteActive) {
      return;
    }

    if (!canSaveCurrentVerse) {
      return;
    }

    if (!hasMeaningfulStudioContent(currentEditorState)) {
      return;
    }

    const favoriteKey = ensureFavoriteKey();
    const nextFavorite = buildCurrentSavedDesign(favoriteKey, new Date().toISOString(), notes);

    const favorites = await readAndSanitizeSavedDesigns();
    const nextFavorites = upsertFavoriteDesign(favorites, nextFavorite, [
      favoriteKey,
      routeFavoriteKeyParam,
      routeDesignParam?.key,
    ]);

    await writeSavedDesigns(nextFavorites);
    setSavedDesigns(nextFavorites);

    const entryId = routeDraftEntryIdParam ?? currentEntryId ?? generateId();
    if (!currentEntryId) {
      setCurrentEntryId(entryId);
    }
    const preview = buildStudioPreview(notes);
    const studioJournalPayload = buildStudioJournalPayload(
      entryId,
      nextFavorite,
      preview,
      Date.now(),
      true
    );
    await AsyncStorage.setItem(
      getJournalEntryStorageKey({ id: entryId, type: studioJournalPayload.type }),
      JSON.stringify(studioJournalPayload)
    );
    await upsertStudioJournalIndex({
      id: entryId,
      type: studioJournalPayload.type,
      date: studioJournalPayload.date,
      preview,
      updatedAt: studioJournalPayload.updatedAt,
      isFavorite: true,
      editor: 'studio',
      ...(hasVerseSelection
        ? {
            book: selectedBook,
            chapter: selectedChapter,
            verse: selectedVerse,
          }
        : {}),
    });
  }, [
    buildCurrentSavedDesign,
    buildStudioPreview,
    buildStudioJournalPayload,
    ensureFavoriteKey,
    canSaveCurrentVerse,
    hasVerseSelection,
    isFavoriteActive,
    currentEditorState,
    currentEntryId,
    routeDraftEntryIdParam,
    notes,
    routeDesignParam,
    routeFavoriteKeyParam,
    selectedBook,
    selectedChapter,
    selectedVerse,
  ]);

  const applyEditorState = (state: VerseEditorState) => {
    const nextEditorState = cloneVerseEditorState(state);

    setVerseCards(nextEditorState.verseCards);
    setStickers(nextEditorState.stickers);
    replaceNotes(nextEditorState.notes);
    setDrawingStrokes(nextEditorState.drawingStrokes);
    setBackgroundKey(nextEditorState.backgroundKey ?? null);
    setSelectedFont(nextEditorState.selectedFont);
    setFontSize(nextEditorState.fontSize);
    setHighlightedWords(nextEditorState.highlightedWords);
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setAutoFocusNoteId(null);
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
    setOpenToolbarMenu(null);
    setIsBookDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsVerseDropdownOpen(false);
  };

  const recordUndoSnapshot = () => {
    const snapshot = cloneVerseEditorState(currentEditorState);

    setUndoHistory((current) => {
      const previousSnapshot = current[current.length - 1];

      if (
        previousSnapshot &&
        JSON.stringify(previousSnapshot) === JSON.stringify(snapshot)
      ) {
        return current;
      }

      return [...current.slice(-MAX_UNDO_HISTORY + 1), snapshot];
    });
  };

  const startDrawingStroke = (x: number, y: number) => {
    if (!isDrawingMode) {
      return;
    }

    clearCanvasSelection();
    recordUndoSnapshot();

    const newStroke: DrawingStroke = {
      id: `drawing-${Date.now()}`,
      color: selectedDrawingColor,
      width: selectedDrawingWidth,
      points: [{ x, y }],
      zIndex: getHighestZIndex() + 1,
    };
    const nextStrokes = [...drawingStrokesRef.current, newStroke];

    activeDrawingStrokeIdRef.current = newStroke.id;
    drawingStrokesRef.current = nextStrokes;
    setDrawingStrokes(nextStrokes);
  };

  const appendDrawingPoint = (x: number, y: number) => {
    const activeStrokeId = activeDrawingStrokeIdRef.current;

    if (!isDrawingMode || !activeStrokeId) {
      return;
    }

    const currentStrokes = drawingStrokesRef.current;
    const activeStroke = currentStrokes.find((stroke) => stroke.id === activeStrokeId);
    const previousPoint = activeStroke?.points[activeStroke.points.length - 1];

    if (!activeStroke || !previousPoint) {
      return;
    }

    const movedDistance = Math.hypot(x - previousPoint.x, y - previousPoint.y);

    if (movedDistance < 2) {
      return;
    }

    const nextStrokes = currentStrokes.map((stroke) =>
      stroke.id === activeStrokeId
        ? { ...stroke, points: [...stroke.points, { x, y }] }
        : stroke
    );

    drawingStrokesRef.current = nextStrokes;
    setDrawingStrokes(nextStrokes);
  };

  const finishDrawingStroke = () => {
    activeDrawingStrokeIdRef.current = null;
  };

  const onDrawingStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    const { state, x, y } = event.nativeEvent;

    if (state === State.BEGAN) {
      startDrawingStroke(x, y);
    }

    if (
      state === State.END ||
      state === State.CANCELLED ||
      state === State.FAILED
    ) {
      finishDrawingStroke();
    }
  };

  const onDrawingGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    appendDrawingPoint(event.nativeEvent.x, event.nativeEvent.y);
  };

  const undoLastDrawingStroke = () => {
    if (isStudioLocked || drawingStrokesRef.current.length === 0) {
      return;
    }

    recordUndoSnapshot();
    setDrawingStrokes((current) => {
      const nextStrokes = current.slice(0, -1);
      drawingStrokesRef.current = nextStrokes;
      return nextStrokes;
    });
  };

  const clearDrawing = () => {
    if (isStudioLocked || drawingStrokesRef.current.length === 0) {
      return;
    }

    recordUndoSnapshot();
    activeDrawingStrokeIdRef.current = null;
    drawingStrokesRef.current = [];
    setDrawingStrokes([]);
  };

  const getBlankEditorStateForReferenceChange = () =>
    cloneVerseEditorState({
      ...DEFAULT_VERSE_EDITOR_STATE,
      notes:
        selectedSaveTarget !== 'journal-studio' && notesRef.current.length > 0
          ? notesRef.current
          : DEFAULT_VERSE_EDITOR_STATE.notes,
    });

  const undoLastEdit = () => {
    if (isStudioLocked) {
      return;
    }

    setUndoHistory((current) => {
      const previousSnapshot = current[current.length - 1];

      if (!previousSnapshot) {
        return current;
      }

      applyEditorState(previousSnapshot);
      return current.slice(0, -1);
    });
  };

  const loadEditorStateForDesign = (
    nextDesignKey: string,
    nextSelectedVerses: number[],
    nextActiveVerse: number,
    nextBook: string = selectedBook,
    nextChapter: number = selectedChapter,
    fallbackEditorState?: VerseEditorState
  ) => {
    const shouldKeepTemplateNotes =
      selectedSaveTarget !== 'journal-studio' &&
      !verseState[nextDesignKey] &&
      !fallbackEditorState &&
      notesRef.current.length > 0;
    const sourceEditorState =
      fallbackEditorState ??
      verseState[nextDesignKey] ??
      (shouldKeepTemplateNotes
        ? {
            ...DEFAULT_VERSE_EDITOR_STATE,
            notes: notesRef.current,
          }
        : null) ??
      DEFAULT_VERSE_EDITOR_STATE;
    const nextEditorState = cloneVerseEditorState(sourceEditorState);
    const shouldArrangeNotesForTemplate =
      shouldKeepTemplateNotes || Boolean(fallbackEditorState);
    const nextVerseCards = shouldArrangeNotesForTemplate
      ? stackTemplateVerseCardsAtTop(
          syncVerseCardsWithSelection(
            nextEditorState.verseCards,
            nextSelectedVerses,
            nextBook,
            nextChapter,
            language.key
          ),
          verseLineHeight,
          selectedSaveTarget
        )
      : syncVerseCardsWithSelection(
          nextEditorState.verseCards,
          nextSelectedVerses,
          nextBook,
          nextChapter,
          language.key
        );
    const nextNotes = shouldArrangeNotesForTemplate
      ? shiftTemplateNotesBelowVerseCards(
          nextEditorState.notes,
          nextVerseCards,
          verseLineHeight,
          selectedSaveTarget
        )
      : nextEditorState.notes;

    setSelectedVerse(nextActiveVerse);
    setSelectedVerseCardVerse(nextActiveVerse);
    setSelectedVerses(nextSelectedVerses);
    setVerseCards(nextVerseCards);
    setStickers(nextEditorState.stickers);
    replaceNotes(nextNotes);
    setDrawingStrokes(nextEditorState.drawingStrokes);
    setBackgroundKey(nextEditorState.backgroundKey ?? null);
    setSelectedFont(nextEditorState.selectedFont);
    setFontSize(nextEditorState.fontSize);
    setHighlightedWords(nextEditorState.highlightedWords);
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setAutoFocusNoteId(null);
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
    setUndoHistory([]);
  };

  useEffect(() => {
    let isMounted = true;

    const loadStoredVerseState = async () => {
      const blankEditorSaveTarget = routeEntryTypeParam ?? selectedSaveTarget ?? defaultStudioSaveTarget;
      const blankEditorTemplateNotes = buildStudioTemplateNotes(blankEditorSaveTarget);

      if (routeEntryIdParam && !routeDesignParam) {
        setHasLoadedState(true);
        return;
      }

      setHasLoadedState(false);
      setSelectedStickerId(null);
      setSelectedNoteId(null);
      setAutoFocusNoteId(null);
      setFocusedNoteId(null);
      setFocusedNoteTarget(null);
      setOpenToolbarMenu(null);
      setIsBookDropdownOpen(false);
      setIsChapterDropdownOpen(false);
      setIsVerseDropdownOpen(false);

      if (!selectedBook) {
        setVerseState({});
        setSelectedChapter(0);
        setSelectedVerse(0);
        setSelectedVerseCardVerse(null);
        setSelectedVerses([]);
        setVerseCards(DEFAULT_VERSE_EDITOR_STATE.verseCards);
        setStickers(DEFAULT_VERSE_EDITOR_STATE.stickers);
        notesRef.current = blankEditorTemplateNotes;
        replaceNotes(blankEditorTemplateNotes);
        setDrawingStrokes(DEFAULT_VERSE_EDITOR_STATE.drawingStrokes);
        setBackgroundKey(DEFAULT_VERSE_EDITOR_STATE.backgroundKey);
        setSelectedFont(DEFAULT_VERSE_EDITOR_STATE.selectedFont);
        setFontSize(DEFAULT_VERSE_EDITOR_STATE.fontSize);
        setHighlightedWords(DEFAULT_VERSE_EDITOR_STATE.highlightedWords);
        setUndoHistory([]);
        setHasLoadedState(true);
        return;
      }

      try {
        const savedVerseState = await loadVerseStateMap(
          selectedBook,
          `${DEFAULT_BOOK}-${DEFAULT_CHAPTER}-${DEFAULT_VERSE}`
        );

        if (!isMounted) {
          return;
        }

        setVerseState(savedVerseState);
        const shouldOpenSpecificVerse =
          routeDesignParam?.book === selectedBook ||
          (hasRouteSelectedVerseParams &&
            routeSelectedBookParam === selectedBook &&
            routeSelectedChapterParam !== null &&
            routeSelectedVerseParam !== null);
        const bookChapters = getChapters(selectedBook);

        if (!shouldOpenSpecificVerse) {
          const nextChapter =
            selectedChapter > 0 && bookChapters.includes(selectedChapter)
              ? selectedChapter
              : bookChapters[0] ?? 0;
          setSelectedChapter(nextChapter);
          setSelectedVerse(0);
          setSelectedVerseCardVerse(null);
          setSelectedVerses([]);
          setVerseCards(DEFAULT_VERSE_EDITOR_STATE.verseCards);
          setStickers(DEFAULT_VERSE_EDITOR_STATE.stickers);
          notesRef.current = blankEditorTemplateNotes;
          replaceNotes(blankEditorTemplateNotes);
          setDrawingStrokes(DEFAULT_VERSE_EDITOR_STATE.drawingStrokes);
          setBackgroundKey(DEFAULT_VERSE_EDITOR_STATE.backgroundKey);
          setSelectedFont(DEFAULT_VERSE_EDITOR_STATE.selectedFont);
          setFontSize(DEFAULT_VERSE_EDITOR_STATE.fontSize);
          setHighlightedWords(DEFAULT_VERSE_EDITOR_STATE.highlightedWords);
          setUndoHistory([]);
          return;
        }

        const matchingRouteDesign =
          routeDesignParam &&
          hasSavedVerseReference(routeDesignParam) &&
          routeDesignParam.book === selectedBook
            ? routeDesignParam
            : null;
        const routeSelectedVerses = matchingRouteDesign
          ? normalizeSelectedVerses(
              matchingRouteDesign.selectedVerses ?? [matchingRouteDesign.verse],
              matchingRouteDesign.verse
            )
          : null;
        const fallbackChapter =
          selectedBook === DEFAULT_BOOK && bookChapters.includes(DEFAULT_CHAPTER)
            ? DEFAULT_CHAPTER
            : bookChapters[0] ?? 1;
        const initialChapter =
          matchingRouteDesign
            ? matchingRouteDesign.chapter
            : hasRouteSelectedVerseParams &&
                routeSelectedBookParam === selectedBook &&
                routeSelectedChapterParam !== null &&
                bookChapters.includes(routeSelectedChapterParam)
              ? routeSelectedChapterParam
              : fallbackChapter;
        const chapterVerses = getVerseOptions(selectedBook, initialChapter);
        const fallbackVerse =
          selectedBook === DEFAULT_BOOK &&
          initialChapter === DEFAULT_CHAPTER &&
          chapterVerses.includes(DEFAULT_VERSE)
            ? DEFAULT_VERSE
            : chapterVerses[0] ?? 1;
        const initialVerse =
          matchingRouteDesign
            ? matchingRouteDesign.verse
            : hasRouteSelectedVerseParams &&
                routeSelectedBookParam === selectedBook &&
                routeSelectedVerseParam !== null &&
                chapterVerses.includes(routeSelectedVerseParam)
              ? routeSelectedVerseParam
              : fallbackVerse;
        const initialSelectedVerses =
          routeSelectedVerses &&
          matchingRouteDesign?.chapter === initialChapter &&
          routeSelectedVerses.includes(initialVerse)
            ? routeSelectedVerses
            : [initialVerse];
        const initialDesignKey = getDesignKey(
          selectedBook,
          initialChapter,
          initialSelectedVerses
        );
        const initialVerseState = matchingRouteDesign
          ? getVerseEditorStateFromDesign(matchingRouteDesign)
          : cloneVerseEditorState(
              savedVerseState[initialDesignKey] ?? DEFAULT_VERSE_EDITOR_STATE
            );

        setSelectedChapter(initialChapter);
        setSelectedVerse(initialVerse);
        setSelectedVerseCardVerse(initialVerse);
        setSelectedVerses(initialSelectedVerses);
        setVerseCards(
          syncVerseCardsWithSelection(
            initialVerseState.verseCards,
            initialSelectedVerses,
            selectedBook,
            initialChapter,
            language.key
          )
        );
        setStickers(initialVerseState.stickers);
        replaceNotes(initialVerseState.notes);
        setDrawingStrokes(initialVerseState.drawingStrokes);
        setBackgroundKey(initialVerseState.backgroundKey ?? null);
        setSelectedFont(initialVerseState.selectedFont);
        setFontSize(initialVerseState.fontSize);
        setHighlightedWords(initialVerseState.highlightedWords);
        setUndoHistory([]);
      } catch (error) {
        console.warn(`Failed to load saved state for ${selectedBook}`, error);
      } finally {
        if (isMounted) {
          setHasLoadedState(true);
        }
      }
    };

    loadStoredVerseState();

    return () => {
      isMounted = false;
    };
  }, [
    defaultStudioSaveTarget,
    hasRouteSelectedVerseParams,
    language.key,
    routeDesignParam,
    routeEntryIdParam,
    routeEntryTypeParam,
    routeOpenSelectedVerseParam,
    routeRestoreToken,
    routeSelectedBookParam,
    routeSelectedChapterParam,
    routeSelectedVerseParam,
    routeSelectionToken,
    selectedSaveTarget,
    selectedBook,
    selectedChapter,
  ]);

  useEffect(() => {
    if (!hasLoadedState || !hasVerseSelection) {
      return;
    }

    setVerseCards((current) =>
      syncVerseCardsWithSelection(
        current,
        selectedVerses,
        selectedBook,
        selectedChapter,
        language.key
      )
    );
  }, [
    hasLoadedState,
    hasVerseSelection,
    language.key,
    selectedBook,
    selectedChapter,
    selectedVerses,
  ]);

  useEffect(() => {
    if (!hasLoadedState || !hasBookSelection) {
      return;
    }

    const nextEditorState: VerseEditorState = {
      verseCards,
      stickers,
      notes,
      drawingStrokes,
      selectedFont,
      fontSize,
      highlightedWords,
      backgroundKey,
    };

    setVerseState((current) => {
      if (JSON.stringify(current[designKey]) === JSON.stringify(nextEditorState)) {
        return current;
      }

      return {
        ...current,
        [designKey]: nextEditorState,
      };
    });
  }, [
    designKey,
    backgroundKey,
    drawingStrokes,
    fontSize,
    hasLoadedState,
    hasBookSelection,
    highlightedWords,
    notes,
    selectedFont,
    stickers,
    verseCards,
  ]);

  useEffect(() => {
    if (!hasLoadedState || !hasBookSelection) {
      return;
    }

    saveVerseStateMap(selectedBook, verseState).catch((error) => {
      console.warn(`Failed to save state for ${selectedBook}`, error);
    });
  }, [hasBookSelection, hasLoadedState, selectedBook, verseState]);

  useEffect(() => {
    if (
      !hasLoadedState ||
      !hasMeaningfulStudioContent(currentEditorState)
    ) {
      return;
    }

    const journalSignature = JSON.stringify({
      currentEntryId,
      selectedBook,
      designKey,
      verseCards,
      stickers,
      notes,
      selectedFont,
      fontSize,
      highlightedWords,
      isFavoriteActive,
    });

    if (lastAutoSavedStudioJournalSignatureRef.current === journalSignature) {
      return;
    }

    void saveStudioJournalEntry(isFavoriteActive)
      .then(() => {
        lastAutoSavedStudioJournalSignatureRef.current = journalSignature;
      })
      .catch((error) => {
        console.warn('Failed to save studio daily log entry', error);
      });
  }, [
    currentEditorState,
    currentEntryId,
    designKey,
    fontSize,
    hasLoadedState,
    highlightedWords,
    isFavoriteActive,
    notes,
    saveStudioJournalEntry,
    selectedBook,
    selectedFont,
    stickers,
    verseCards,
  ]);

  useEffect(() => {
    if (
      !hasLoadedState ||
      !hasVerseSelection ||
      !isVerseDesignDecorated(currentEditorState)
    ) {
      return;
    }

    const autosaveSignature = JSON.stringify({
      selectedBook,
      designKey,
      verseCards,
      stickers,
      notes,
      selectedFont,
      fontSize,
      highlightedWords,
    });

    if (lastAutoSavedVerseDesignSignatureRef.current === autosaveSignature) {
      return;
    }

    const autosaveTimeout = setTimeout(() => {
      const nextVerseState: VerseStateMap = {
        ...verseState,
        [designKey]: currentEditorState,
      };

      saveVerseStateMap(selectedBook, nextVerseState)
        .then(() =>
          saveVerseDesignSnapshot(selectedBook, designKey, currentEditorState)
        )
        .then(() => {
          lastAutoSavedVerseDesignSignatureRef.current = autosaveSignature;
        })
        .catch((error) => {
          console.warn('Failed to auto-save decorated verse design', error);
        });
    }, VERSE_DESIGN_AUTOSAVE_DELAY_MS);

    return () => {
      clearTimeout(autosaveTimeout);
    };
  }, [
    currentEditorState,
    designKey,
    drawingStrokes,
    fontSize,
    hasLoadedState,
    hasVerseSelection,
    highlightedWords,
    notes,
    selectedBook,
    selectedFont,
    stickers,
    verseCards,
    verseState,
  ]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveToastTimeoutRef.current) {
        clearTimeout(saveToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSavedDesigns = async () => {
      try {
        const parsedValue = await readAndSanitizeSavedDesigns();

        if (!isMounted) {
          return;
        }

        const normalizedDesigns = parsedValue.reduce<SavedVerseDesign[]>(
          (accumulator, item) => {
            if (typeof item !== 'object' || item === null) {
              return accumulator;
            }

            const candidate = item as Partial<SavedVerseDesign>;
            const referencedCandidate = hasSavedVerseReference(candidate) ? candidate : null;

            if (
              typeof candidate.key !== 'string' ||
              typeof candidate.selectedFont !== 'string' ||
              typeof candidate.fontSize !== 'number' ||
              typeof candidate.savedAt !== 'string' ||
              !Array.isArray(candidate.stickers) ||
              !Array.isArray(candidate.notes) ||
              ((typeof candidate.highlights !== 'object' || candidate.highlights === null) &&
                (typeof (candidate as { highlightedWords?: unknown }).highlightedWords !== 'object' ||
                  (candidate as { highlightedWords?: unknown }).highlightedWords === null))
            ) {
              return accumulator;
            }

            accumulator.push({
              key: candidate.key,
              ...(referencedCandidate
                ? {
                    book: referencedCandidate.book,
                    chapter: referencedCandidate.chapter,
                    verse: referencedCandidate.verse,
                    selectedVerses: normalizeSelectedVerses(
                      Array.isArray(candidate.selectedVerses)
                        ? candidate.selectedVerses.filter(
                            (verseNumber): verseNumber is number =>
                              typeof verseNumber === 'number'
                          )
                        : [referencedCandidate.verse],
                      referencedCandidate.verse
                    ),
                  }
                : {
                    selectedVerses: [],
                  }),
              verseCards: Array.isArray(candidate.verseCards)
                ? (candidate.verseCards as VerseCard[])
                : [],
              stickers: candidate.stickers as Sticker[],
              notes: candidate.notes as Note[],
              drawingStrokes: Array.isArray(candidate.drawingStrokes)
                ? (candidate.drawingStrokes as DrawingStroke[])
                : [],
              backgroundKey:
                typeof candidate.backgroundKey === 'string' ? candidate.backgroundKey : null,
              highlights: ((candidate.highlights ??
                (candidate as { highlightedWords?: Record<string, HighlightColor> }).highlightedWords) ??
                {}) as Record<string, HighlightColor>,
              selectedFont: candidate.selectedFont,
              fontSize: candidate.fontSize,
              savedAt: candidate.savedAt,
            });

            return accumulator;
          },
          []
        );

        if (isMounted) {
          setSavedDesigns(normalizedDesigns);
        }
      } catch (error) {
        console.warn('Failed to load saved verse designs', error);
      } finally {
        if (isMounted) {
          setHasLoadedSavedDesigns(true);
        }
      }
    };

    loadSavedDesigns();

    return () => {
      isMounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const refreshSavedDesigns = async () => {
        try {
          const parsedValue = await readAndSanitizeSavedDesigns();
          setSavedDesigns(parsedValue);
        } catch (error) {
          console.warn('Failed to refresh saved verse designs', error);
        }
      };

      void refreshSavedDesigns();
    }, [])
  );

  useEffect(() => {
    if (!hasLoadedSavedDesigns) {
      return;
    }

    if (!hasBootstrappedSavedDesignsRef.current) {
      hasBootstrappedSavedDesignsRef.current = true;
      return;
    }

    AsyncStorage.setItem(
      SAVED_DESIGNS_STORAGE_KEY,
      JSON.stringify(savedDesigns)
    ).catch((error) => {
      console.warn('Failed to save verse designs', error);
    });
  }, [hasLoadedSavedDesigns, savedDesigns]);

  useEffect(() => {
    if (!hasLoadedSavedDesigns || !hasLoadedState || !hasVerseSelection) {
      return;
    }

    const fallbackDesignKey = routeDesignParam?.key ?? null;
    const shouldSyncFavorite =
      isCurrentVerseSaved ||
      (routeSourceParam === 'favorites' && fallbackDesignKey !== null);

    if (!shouldSyncFavorite) {
      return;
    }

    setSavedDesigns((current) => {
      const existingIndex = current.findIndex(
        (design) => design.key === designKey || design.key === fallbackDesignKey
      );

      if (existingIndex === -1) {
        return routeSourceParam === 'favorites'
          ? [
              ...current,
              {
                key: designKey,
                book: selectedBook,
                chapter: selectedChapter,
                verse: selectedVerse,
                selectedVerses: normalizedSelectedVerses,
                verseCards: verseCards.map((verseCard) => ({ ...verseCard })),
                stickers: stickers.map((sticker) => ({ ...sticker })),
                notes: notes.map((note) => ({ ...note })),
                drawingStrokes: drawingStrokes.map((stroke) => ({
                  ...stroke,
                  points: stroke.points.map((point) => ({ ...point })),
                })),
                backgroundKey,
                highlights: { ...highlightedWords },
                selectedFont,
                fontSize,
                savedAt: new Date().toISOString(),
              },
            ]
          : current;
      }

      const nextDesign: SavedVerseDesign = {
        key: designKey,
        book: selectedBook,
        chapter: selectedChapter,
        verse: selectedVerse,
        selectedVerses: normalizedSelectedVerses,
        verseCards: verseCards.map((verseCard) => ({ ...verseCard })),
        stickers: stickers.map((sticker) => ({ ...sticker })),
        notes: notes.map((note) => ({ ...note })),
        drawingStrokes: drawingStrokes.map((stroke) => ({
          ...stroke,
          points: stroke.points.map((point) => ({ ...point })),
        })),
        backgroundKey,
        highlights: { ...highlightedWords },
        selectedFont,
        fontSize,
        savedAt: current[existingIndex].savedAt ?? new Date().toISOString(),
      };

      const existingDesign = current[existingIndex];

      if (JSON.stringify(existingDesign) === JSON.stringify(nextDesign)) {
        return current;
      }

      const nextDesigns = [...current];
      nextDesigns[existingIndex] = nextDesign;
      return nextDesigns;
    });
  }, [
    backgroundKey,
    drawingStrokes,
    fontSize,
    hasLoadedState,
    hasLoadedSavedDesigns,
    hasVerseSelection,
    highlightedWords,
    isCurrentVerseSaved,
    notes,
    routeDesignParam,
    routeSourceParam,
    selectedBook,
    selectedChapter,
    selectedFont,
    selectedVerse,
    selectedVerses,
    stickers,
    verseCards,
    designKey,
    normalizedSelectedVerses,
  ]);

  useEffect(() => {
    if (!hasLoadedSavedDesigns || !favoritePersistKey || !isFavoriteActive) {
      return;
    }

    if (favoriteAutosaveTimeoutRef.current) {
      clearTimeout(favoriteAutosaveTimeoutRef.current);
    }

    favoriteAutosaveTimeoutRef.current = setTimeout(() => {
      void persistFavoriteToStorage().catch((error) => {
        console.warn('Failed to persist favorite during edit', error);
      });
    }, VERSE_DESIGN_AUTOSAVE_DELAY_MS);

    return () => {
      if (favoriteAutosaveTimeoutRef.current) {
        clearTimeout(favoriteAutosaveTimeoutRef.current);
      }
    };
  }, [
    backgroundKey,
    drawingStrokes,
    designKey,
    favoriteBaseBook,
    favoriteBaseChapter,
    favoriteBaseVerse,
    favoriteBaseVerses,
    favoritePersistVerses,
    favoritePersistKey,
    favoriteStableKey,
    fontSize,
    hasLoadedSavedDesigns,
    highlightedWords,
    notes,
    routeDesignParam,
    routeFavoriteKeyParam,
    routeSourceParam,
    isFavoriteActive,
    persistFavoriteToStorage,
    selectedFont,
    stickers,
    verseCards,
  ]);

  useEffect(() => {
    const resolvedRouteDesign =
      routeSourceParam === 'favorites' && routeFavoriteKeyParam
        ? savedDesigns.find((design) => design.key === routeFavoriteKeyParam) ?? routeDesignParam
        : routeDesignParam;

    if (!resolvedRouteDesign) {
      return;
    }

    const d = resolvedRouteDesign;
    const restoreToken =
      routeRestoreToken ?? d.key;

    if (!d) {
      return;
    }

    if (lastAppliedDesignKeyRef.current === restoreToken) {
      return;
    }

    lastAppliedDesignKeyRef.current = restoreToken;
    draftFavoriteKeyRef.current = d.key;

    if (hasSavedVerseReference(d)) {
      setSelectedBook(d.book);
      setSelectedChapter(d.chapter);
      setSelectedVerse(d.verse);
      setSelectedVerseCardVerse(d.verse);
      const nextSelectedVerses = normalizeSelectedVerses(
        d.selectedVerses ?? [d.verse],
        d.verse
      );
      setSelectedVerses(nextSelectedVerses);
      setVerseCards(
        syncVerseCardsWithSelection(
          d.verseCards || [],
          nextSelectedVerses,
          d.book,
          d.chapter,
          language.key
        )
      );
    } else {
      setSelectedBook('');
      setSelectedChapter(0);
      setSelectedVerse(0);
      setSelectedVerseCardVerse(null);
      setSelectedVerses([]);
      setVerseCards((d.verseCards || []).map((verseCard) => ({ ...verseCard })));
    }
    setStickers(d.stickers || []);
    replaceNotes(d.notes || []);
    setDrawingStrokes(d.drawingStrokes || []);
    setBackgroundKey(d.backgroundKey ?? null);
    setHighlightedWords(d.highlights || {});
    setSelectedFont(d.selectedFont);
    setFontSize(d.fontSize);
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setAutoFocusNoteId(null);
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
    setOpenToolbarMenu(null);
    setIsBookDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsVerseDropdownOpen(false);
    setUndoHistory([]);
    setIsFavoriteActive(routeSourceParam === 'favorites');
  }, [
    language.key,
    routeDesignParam,
    routeFavoriteKeyParam,
    routeRestoreToken,
    routeSourceParam,
    savedDesigns,
  ]);

  useEffect(() => {
    const loadStudioEntryById = async () => {
      if (!routeEntryIdParam || routeDesignParam) {
        return;
      }

      try {
        const stored = await AsyncStorage.getItem(
          getJournalEntryStorageKey({
            id: routeEntryIdParam,
            type: routeEntryTypeParam ?? defaultStudioSaveTarget,
          })
        );
        if (!stored) {
          return;
        }

        const parsed = JSON.parse(stored) as Partial<StudioJournalPayload>;
        if (!parsed?.design) {
          return;
        }

        const d = parsed.design;
        const restoreToken = `entry-${routeEntryIdParam}-${parsed.updatedAt ?? 0}`;
        if (lastAppliedDesignKeyRef.current === restoreToken) {
          return;
        }
        lastAppliedDesignKeyRef.current = restoreToken;
        draftFavoriteKeyRef.current = d.key;

        setCurrentEntryId(routeEntryIdParam);
        setSelectedSaveTarget(
          isStudioSaveTarget(parsed.saveTarget) ? parsed.saveTarget : routeEntryTypeParam ?? defaultStudioSaveTarget
        );
        if (hasSavedVerseReference(d)) {
          setSelectedBook(d.book);
          setSelectedChapter(d.chapter);
          setSelectedVerse(d.verse);
          setSelectedVerseCardVerse(d.verse);
          const nextSelectedVerses = normalizeSelectedVerses(
            d.selectedVerses ?? [d.verse],
            d.verse
          );
          setSelectedVerses(nextSelectedVerses);
          setVerseCards(
            syncVerseCardsWithSelection(
              d.verseCards || [],
              nextSelectedVerses,
              d.book,
              d.chapter,
              language.key
            )
          );
        } else {
          setSelectedBook('');
          setSelectedChapter(0);
          setSelectedVerse(0);
          setSelectedVerseCardVerse(null);
          setSelectedVerses([]);
          setVerseCards((d.verseCards || []).map((verseCard) => ({ ...verseCard })));
        }
        setStickers(d.stickers || []);
        replaceNotes(d.notes || []);
        setDrawingStrokes(d.drawingStrokes || []);
        setBackgroundKey(d.backgroundKey ?? null);
        setHighlightedWords(d.highlights || {});
        setSelectedFont(d.selectedFont || DEFAULT_VERSE_EDITOR_STATE.selectedFont);
        setFontSize(d.fontSize || DEFAULT_VERSE_EDITOR_STATE.fontSize);
        setSelectedStickerId(null);
        setSelectedNoteId(null);
        setAutoFocusNoteId(null);
        setFocusedNoteId(null);
        setFocusedNoteTarget(null);
        setOpenToolbarMenu(null);
        setIsBookDropdownOpen(false);
        setIsChapterDropdownOpen(false);
        setIsVerseDropdownOpen(false);
        setUndoHistory([]);
        setIsFavoriteActive(Boolean(parsed.isFavorite));
      } catch (error) {
        console.warn('Failed to load studio journal entry', error);
      }
    };

    void loadStudioEntryById();
  }, [defaultStudioSaveTarget, language.key, routeDesignParam, routeEntryIdParam, routeEntryTypeParam]);

  const decreaseFontSize = () => {
    if (isStudioLocked) {
      return;
    }

    if (fontSize <= 14) {
      return;
    }

    recordUndoSnapshot();
    setFontSize((current) => Math.max(14, current - 2));
  };

  const increaseFontSize = () => {
    if (isStudioLocked) {
      return;
    }

    if (fontSize >= 26) {
      return;
    }

    recordUndoSnapshot();
    setFontSize((current) => Math.min(26, current + 2));
  };

  const addSticker = (emoji: string) => {
    if (isStudioLocked) {
      return;
    }

    recordUndoSnapshot();

    const newSticker: Sticker = {
      id: Date.now() + stickers.length,
      emoji,
      x: 40 + stickers.length * 24,
      y: 150 + stickers.length * 24,
      scale: 1,
      zIndex: getHighestZIndex() + 1,
    };

    setStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
    setSelectedNoteId(null);
    setNoteStyleEditorId(null);
  };

  const addShopSticker = (imageKey: string) => {
    if (isStudioLocked) {
      return;
    }

    recordUndoSnapshot();

    const newSticker: Sticker = {
      id: Date.now() + stickers.length,
      emoji: '',
      imageKey,
      x: 34 + stickers.length * 20,
      y: 150 + stickers.length * 20,
      scale: 0.9,
      zIndex: getHighestZIndex() + 1,
    };

    setStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
    setSelectedNoteId(null);
    setNoteStyleEditorId(null);
  };

  const updateStudioBackground = (nextBackgroundKey: string | null) => {
    if (isStudioLocked) {
      return;
    }

    if (backgroundKey === nextBackgroundKey) {
      setOpenToolbarMenu(null);
      return;
    }

    recordUndoSnapshot();
    setBackgroundKey(nextBackgroundKey);
    setOpenToolbarMenu(null);
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setNoteStyleEditorId(null);
  };

  const addNote = () => {
    if (isStudioLocked) {
      return;
    }

    recordUndoSnapshot();

    const newNote: Note = {
      id: `${Date.now()}-${notes.length}`,
      text: '',
      styleKey: DEFAULT_NOTE_STYLE_KEY,
      x: 28 + notes.length * 18,
      y: 210 + notes.length * 18,
      width: 150,
      height: 150,
      zIndex: getHighestZIndex() + 1,
    };

    updateNotesState((prev) => [...prev, newNote]);
    setSelectedNoteId(newNote.id);
    setNoteStyleEditorId(null);
    setSelectedStickerId(null);
    setAutoFocusNoteId(newNote.id);
    setOpenToolbarMenu(null);
    setIsBookDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsVerseDropdownOpen(false);

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  };

  const updateSticker = (id: number, updates: StickerUpdate) => {
    if (isStudioLocked) {
      return;
    }

    recordUndoSnapshot();

    setStickers((prev) =>
      prev.map((sticker) =>
        sticker.id === id ? { ...sticker, ...updates } : sticker
      )
    );
  };

  const updateNote = (id: string, updates: NoteUpdate) => {
    if (isStudioLocked) {
      return;
    }

    if (!('text' in updates) || Object.keys(updates).some((key) => key !== 'text')) {
      recordUndoSnapshot();
    }

    updateNotesState((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...updates } : note))
    );
  };

  const updateVerseCard = (id: string, updates: VerseCardUpdate) => {
    if (isStudioLocked) {
      return;
    }

    recordUndoSnapshot();

    setVerseCards((prev) =>
      prev.map((card) => (card.id === id ? { ...card, ...updates } : card))
    );
  };

  const selectVerseCardColor = (cardColorKey: string) => {
    if (isStudioLocked) {
      return;
    }

    recordUndoSnapshot();

    setVerseCards((current) => {
      if (current.length === 0) {
        return current;
      }

      const hasActiveCard = current.some((card) => card.verse === selectedVerse);

      return current.map((card) =>
        hasActiveCard && card.verse !== selectedVerse
          ? card
          : { ...card, cardColorKey }
      );
    });
  };

  const selectVerseCard = (verseNumber: number) => {
    if (isStudioLocked) {
      return;
    }

    const nextZIndex = getHighestZIndex() + 1;
    setSelectedVerse(verseNumber);
    setSelectedVerseCardVerse(verseNumber);
    setVerseCards((current) =>
      current.map((card) =>
        card.verse === verseNumber ? { ...card, zIndex: nextZIndex } : card
      )
    );
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setNoteStyleEditorId(null);
    setFocusedNoteTarget(null);
  };

  const bringStickerToFront = (id: number) => {
    if (isStudioLocked) {
      return;
    }

    const nextZIndex = getHighestZIndex() + 1;

    setStickers((prev) =>
      prev.map((sticker) =>
        sticker.id === id ? { ...sticker, zIndex: nextZIndex } : sticker
      )
    );
  };

  const bringNoteToFront = (id: string) => {
    if (isStudioLocked) {
      return;
    }

    const nextZIndex = getHighestZIndex() + 1;

    updateNotesState((prev) =>
      prev.map((note) =>
        note.id === id ? { ...note, zIndex: nextZIndex } : note
      )
    );
  };

  const selectSticker = (id: number) => {
    if (isStudioLocked) {
      return;
    }

    bringStickerToFront(id);
    setSelectedVerseCardVerse(null);
    setSelectedStickerId(id);
    setSelectedNoteId(null);
    setNoteStyleEditorId(null);
    setFocusedNoteTarget(null);
  };

  const clearCanvasSelection = () => {
    Keyboard.dismiss();
    setSelectedVerseCardVerse(null);
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setNoteStyleEditorId(null);
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
  };

  const selectNote = (id: string) => {
    if (isStudioLocked) {
      return;
    }

    bringNoteToFront(id);
    setSelectedVerseCardVerse(null);
    setSelectedNoteId(id);
    setSelectedStickerId(null);
  };

  const toggleNoteStyleEditor = (id: string) => {
    if (isStudioLocked) {
      return;
    }

    bringNoteToFront(id);
    setSelectedVerseCardVerse(null);
    setSelectedNoteId(id);
    setSelectedStickerId(null);
    setFocusedNoteTarget(null);
    setNoteStyleEditorId((current) => (current === id ? null : id));
  };

  const deleteSticker = (id: number) => {
    if (isStudioLocked) {
      return;
    }

    recordUndoSnapshot();
    setStickers((prev) => prev.filter((sticker) => sticker.id !== id));
    setSelectedStickerId((current) => (current === id ? null : current));
  };

  const deleteNote = (id: string) => {
    if (isStudioLocked) {
      return;
    }

    recordUndoSnapshot();
    updateNotesState((prev) => prev.filter((note) => note.id !== id));
    setSelectedNoteId((current) => (current === id ? null : current));
    setNoteStyleEditorId((current) => (current === id ? null : current));
    setAutoFocusNoteId((current) => (current === id ? null : current));
    setFocusedNoteId((current) => (current === id ? null : current));
    setFocusedNoteTarget((current) => (current?.id === id ? null : current));
  };

  const activateVerse = (
    verseNumber: number,
    options?: {
      nextSelectedVerses?: number[];
      closeDropdown?: boolean;
    }
  ) => {
    if (isStudioLocked) {
      return;
    }

    const latestNotes = getLatestWebNotes(notesRef.current);
    notesRef.current = latestNotes;

    if (selectedBook && selectedChapter > 0 && verseNumber > 0) {
      void markBibleVerseRead({
        book: selectedBook,
        chapter: selectedChapter,
        verse: verseNumber,
      }).catch((error) => {
        console.warn('Failed to track Bible reading progress', error);
      });
    }

    const nextSelectedVerses = normalizeSelectedVerses(
      options?.nextSelectedVerses ??
        (selectedVerses.includes(verseNumber)
          ? selectedVerses
          : [...selectedVerses, verseNumber].sort((left, right) => left - right)),
      verseNumber
    );
    const nextDesignKey = getDesignKey(selectedBook, selectedChapter, nextSelectedVerses);

    if (hasVerseSelection) {
      setVerseState((current) => ({
        ...current,
        [designKey]: {
          ...currentEditorState,
          notes: latestNotes,
        },
      }));
    }

    if (nextDesignKey === designKey) {
      setSelectedVerse(verseNumber);
      setSelectedVerseCardVerse(verseNumber);
      setSelectedVerses(nextSelectedVerses);
      setVerseCards((current) =>
        syncVerseCardsWithSelection(
          current,
          nextSelectedVerses,
          selectedBook,
          selectedChapter,
          language.key
        )
      );
      setSelectedStickerId(null);
      setSelectedNoteId(null);
      setNoteStyleEditorId(null);
      setAutoFocusNoteId(null);
      setFocusedNoteId(null);
      setFocusedNoteTarget(null);
    } else {
      loadEditorStateForDesign(
        nextDesignKey,
        nextSelectedVerses,
        verseNumber,
        selectedBook,
        selectedChapter,
        {
          ...currentEditorState,
          notes: latestNotes,
        }
      );
    }

    if (options?.closeDropdown ?? true) {
      setIsVerseDropdownOpen(false);
    }
  };

  const deactivateVerse = (verseNumber: number) => {
    if (isStudioLocked) {
      return;
    }

    if (!hasChapterSelection || !selectedVerses.includes(verseNumber)) {
      return;
    }

    const latestNotes = getLatestWebNotes(notesRef.current);
    notesRef.current = latestNotes;
    const nextSelectedVerses = selectedVerses.filter((verse) => verse !== verseNumber);
    const nextActiveVerse = nextSelectedVerses.includes(selectedVerse)
      ? selectedVerse
      : nextSelectedVerses[0] ?? 0;
    const nextVerseCards = stackTemplateVerseCardsAtTop(
      syncVerseCardsWithSelection(
        verseCards.filter((card) => card.verse !== verseNumber),
        nextSelectedVerses,
        selectedBook,
        selectedChapter,
        language.key
      ),
      verseLineHeight,
      selectedSaveTarget
    );
    const nextNotes = shiftTemplateNotesBelowVerseCards(
      latestNotes,
      nextVerseCards,
      verseLineHeight,
      selectedSaveTarget,
      { allowMoveUp: true }
    );

    if (hasVerseSelection) {
      setVerseState((current) => ({
        ...current,
        [designKey]: {
          ...currentEditorState,
          notes: latestNotes,
        },
      }));
    }

    setSelectedVerse(nextActiveVerse);
    setSelectedVerseCardVerse(nextActiveVerse || null);
    setSelectedVerses(nextSelectedVerses);
    setVerseCards(nextVerseCards);
    replaceNotes(nextNotes);
    if (nextSelectedVerses.length === 0) {
      setHighlightedWords(DEFAULT_VERSE_EDITOR_STATE.highlightedWords);
    }
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setAutoFocusNoteId(null);
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
  };

  const handleVerseOptionPress = (verseNumber: number) => {
    if (isStudioLocked) {
      return;
    }

    if (!hasChapterSelection) {
      return;
    }

    if (selectedVerses.includes(verseNumber)) {
      deactivateVerse(verseNumber);
      return;
    }

    const nextSelectedVerses = [...selectedVerses, verseNumber].sort(
      (left, right) => left - right
    );

    activateVerse(verseNumber, {
      nextSelectedVerses,
      closeDropdown: selectedVerses.length === 0,
    });
  };

  const resetCurrentDesign = () => {
    if (isStudioLocked) {
      return;
    }

    recordUndoSnapshot();

    const nextEditorState = getBlankEditorStateForReferenceChange();

    if (hasVerseSelection) {
      setVerseState((current) => ({
        ...current,
        [designKey]: nextEditorState,
      }));
    }
    setVerseCards(nextEditorState.verseCards);
    setStickers(nextEditorState.stickers);
    replaceNotes(nextEditorState.notes);
    setDrawingStrokes(nextEditorState.drawingStrokes);
    setBackgroundKey(nextEditorState.backgroundKey ?? null);
    setSelectedBook('');
    setSelectedChapter(0);
    setSelectedVerse(0);
    setSelectedVerseCardVerse(null);
    setSelectedVerses([]);
    setSelectedFont(nextEditorState.selectedFont);
    setFontSize(nextEditorState.fontSize);
    setHighlightedWords(nextEditorState.highlightedWords);
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setAutoFocusNoteId(null);
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
    setOpenToolbarMenu(null);
    setIsBookDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsVerseDropdownOpen(false);
    if (hasVerseSelection) {
      void removeVerseDesignSnapshot(selectedBook, designKey);
    }
    showSaveToast(t('studioStartOverToast'));
  };

  const handleBookSelect = (book: string) => {
    if (isStudioLocked) {
      return;
    }

    if (hasVerseSelection) {
      setVerseState((current) => ({
        ...current,
        [designKey]: currentEditorState,
      }));
    }

    const nextChapter = getChapters(book)[0] ?? 0;
    const nextEditorState = getBlankEditorStateForReferenceChange();

    setSelectedBook(book);
    setSelectedChapter(nextChapter);
    setSelectedVerse(0);
    setSelectedVerseCardVerse(null);
    setSelectedVerses([]);
    setVerseCards(nextEditorState.verseCards);
    setStickers(nextEditorState.stickers);
    replaceNotes(nextEditorState.notes);
    setDrawingStrokes(nextEditorState.drawingStrokes);
    setBackgroundKey(nextEditorState.backgroundKey ?? null);
    setSelectedFont(nextEditorState.selectedFont);
    setFontSize(nextEditorState.fontSize);
    setHighlightedWords(nextEditorState.highlightedWords);
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setAutoFocusNoteId(null);
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
    setIsBookDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsVerseDropdownOpen(false);
    setUndoHistory([]);
  };

  const handleChapterSelect = (chapterNumber: number) => {
    if (isStudioLocked) {
      return;
    }

    if (!hasBookSelection) {
      return;
    }

    if (hasVerseSelection) {
      setVerseState((current) => ({
        ...current,
        [designKey]: currentEditorState,
      }));
    }

    const nextEditorState = getBlankEditorStateForReferenceChange();

    setSelectedChapter(chapterNumber);
    setSelectedVerse(0);
    setSelectedVerseCardVerse(null);
    setSelectedVerses([]);
    setVerseCards(nextEditorState.verseCards);
    setStickers(nextEditorState.stickers);
    replaceNotes(nextEditorState.notes);
    setDrawingStrokes(nextEditorState.drawingStrokes);
    setBackgroundKey(nextEditorState.backgroundKey ?? null);
    setSelectedFont(nextEditorState.selectedFont);
    setFontSize(nextEditorState.fontSize);
    setHighlightedWords(nextEditorState.highlightedWords);
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setAutoFocusNoteId(null);
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
    setIsBookDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsVerseDropdownOpen(false);
    setUndoHistory([]);
  };

  const toggleWordHighlight = (wordIndex: number) => {
    if (isStudioLocked) {
      return;
    }

    recordUndoSnapshot();

    setHighlightedWords((current) => {
      const wordKey = String(wordIndex);
      const currentColor = current[wordKey];

      if (currentColor === selectedHighlightColor) {
        const next = { ...current };
        delete next[wordKey];
        return next;
      }

      return {
        ...current,
        [wordKey]: selectedHighlightColor,
      };
    });
  };

  const closeActiveNoteEditor = () => {
    const latestNotes = getLatestWebNotes(notesRef.current);
    notesRef.current = latestNotes;
    replaceNotes(latestNotes);
    Keyboard.dismiss();
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
    setSelectedNoteId(null);
    setNoteStyleEditorId(null);
    setAutoFocusNoteId(null);
  };

  const toggleStudioLock = () => {
    closeActiveNoteEditor();
    setIsStudioLocked((current) => {
      const nextLocked = !current;

      if (nextLocked) {
        setSelectedVerseCardVerse(null);
        setSelectedStickerId(null);
        setSelectedNoteId(null);
        setNoteStyleEditorId(null);
        setOpenToolbarMenu(null);
        setIsBookDropdownOpen(false);
        setIsChapterDropdownOpen(false);
        setIsVerseDropdownOpen(false);
      }

      return nextLocked;
    });
  };

  const toggleToolbarMenu = (menu: Exclude<ToolbarMenu, null>) => {
    if (isStudioLocked && menu !== 'more') {
      return;
    }

    closeActiveNoteEditor();
    setOpenToolbarMenu((current) => (current === menu ? null : menu));
    setIsSaveMenuOpen(false);
    setIsBookDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsVerseDropdownOpen(false);
  };

  const selectFont = (font: string) => {
    if (isStudioLocked) {
      return;
    }

    if (selectedFont !== font) {
      recordUndoSnapshot();
    }

    setSelectedFont(font);
    setOpenToolbarMenu(null);
  };

  const captureNotesBeforeAction = useCallback(() => {
    const latestNotes = getLatestWebNotes(notesRef.current);
    notesRef.current = latestNotes;
    replaceNotes(latestNotes);
  }, []);

  const finishNoteEditing = () => {
    closeActiveNoteEditor();
  };

  useEffect(() => {
    if (!focusedNoteTarget) {
      return;
    }

    const topPadding = 96;
    const visibleBuffer = keyboardHeight > 0 ? 40 : 24;
    const targetY = Math.max(
      0,
      captureCanvasTop + focusedNoteTarget.y + focusedNoteTarget.height - topPadding - visibleBuffer
    );

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
    });
  }, [captureCanvasTop, focusedNoteTarget, keyboardHeight]);

  const captureJournalImage = async () => {
    if (!captureViewRef.current || isSharingImage) {
      return null;
    }

    try {
      setIsSharingImage(true);
      Keyboard.dismiss();
      setSelectedStickerId(null);
      setSelectedNoteId(null);
      setFocusedNoteId(null);
      setAutoFocusNoteId(null);
      setFocusedNoteTarget(null);
      setOpenToolbarMenu(null);
      setIsBookDropdownOpen(false);
      setIsChapterDropdownOpen(false);
      setIsVerseDropdownOpen(false);

      await new Promise((resolve) => setTimeout(resolve, 120));

      return await captureRef(captureViewRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
    } catch (error) {
      console.warn('Failed to capture verse image', error);
      return null;
    } finally {
      setIsSharingImage(false);
    }
  };

  const handleShareImage = async () => {
    const imageUri = await captureJournalImage();

    if (!imageUri) {
      return;
    }

    try {
      await Share.share({
        title: `${selectedBook} ${selectedChapter}:${selectedVerse}`,
        message: `${selectedBook} ${selectedChapter}:${selectedVerse}`,
        url: imageUri,
      });
    } catch (error) {
      console.warn('Failed to share verse image', error);
    }
  };

  const handleSaveImage = async () => {
    const imageUri = await captureJournalImage();

    if (!imageUri) {
      return;
    }

    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);

      if (!permission.granted) {
        return;
      }

      await MediaLibrary.saveToLibraryAsync(imageUri);
      showSaveConfirmation(t('editorSavedImage'));
    } catch (error) {
      console.warn('Failed to save verse image', error);
    }
  };

  const handleSaveToTarget = useCallback(
    async (saveTarget: StudioSaveTarget) => {
      captureNotesBeforeAction();
      setIsSaveMenuOpen(false);
      setOpenToolbarMenu(null);
      await saveStudioJournalEntry(isFavoriteActive, saveTarget);
      showSaveConfirmation(
        t('editorSavedToTarget', {
          target: getTranslatedStudioSaveTargetLabel(saveTarget),
        })
      );
    },
    [
      captureNotesBeforeAction,
      getTranslatedStudioSaveTargetLabel,
      isFavoriteActive,
      saveStudioJournalEntry,
      t,
    ]
  );

  const handleAddToFavorites = useCallback(async () => {
    captureNotesBeforeAction();
    setIsSaveMenuOpen(false);
    setOpenToolbarMenu(null);

    const latestNotes = getLatestWebNotes(notesRef.current);
    notesRef.current = latestNotes;
    const latestEditorState = {
      ...currentEditorState,
      notes: latestNotes,
    };

    if (!hasMeaningfulStudioContent(latestEditorState)) {
      showSaveConfirmation(t('editorAddSomethingFirst'));
      return;
    }

    const favoriteKey = ensureFavoriteKey();
    const updatedAt = Date.now();
    const entryId = routeDraftEntryIdParam ?? currentEntryId ?? generateId();
    const nextFavorite = buildCurrentSavedDesign(
      favoriteKey,
      new Date().toISOString(),
      latestNotes
    );
    const preview = buildStudioPreview(latestNotes);
    const studioJournalPayload = buildStudioJournalPayload(
      entryId,
      nextFavorite,
      preview,
      updatedAt,
      true,
      selectedSaveTarget
    );
    const favorites = await readAndSanitizeSavedDesigns();
    const nextFavorites = upsertFavoriteDesign(favorites, nextFavorite, [
      favoriteKey,
      routeFavoriteKeyParam,
      routeDesignParam?.key,
    ]);

    if (!currentEntryId) {
      setCurrentEntryId(entryId);
    }

    await writeSavedDesigns(nextFavorites);
    setSavedDesigns(nextFavorites);
    setIsFavoriteActive(true);
    await AsyncStorage.setItem(
      getJournalEntryStorageKey({ id: entryId, type: studioJournalPayload.type }),
      JSON.stringify(studioJournalPayload)
    );
    await upsertStudioJournalIndex({
      id: entryId,
      type: studioJournalPayload.type,
      date: studioJournalPayload.date,
      preview,
      updatedAt,
      isFavorite: true,
      editor: 'studio',
      ...(hasVerseSelection
        ? {
            book: selectedBook,
            chapter: selectedChapter,
            verse: selectedVerse,
          }
        : {}),
    });
    showSaveConfirmation(t('editorAddedToFavorites'));
  }, [
    buildCurrentSavedDesign,
    buildStudioJournalPayload,
    buildStudioPreview,
    captureNotesBeforeAction,
    currentEditorState,
    currentEntryId,
    ensureFavoriteKey,
    hasVerseSelection,
    routeDesignParam,
    routeDraftEntryIdParam,
    routeFavoriteKeyParam,
    selectedBook,
    selectedChapter,
    selectedSaveTarget,
    selectedVerse,
    t,
  ]);

  const handleExportImageFromSaveMenu = async () => {
    captureNotesBeforeAction();
    setIsSaveMenuOpen(false);
    setOpenToolbarMenu(null);
    await handleSaveImage();
  };

  const handleCloudSaved = (result: { conflictCount: number }) => {
    showSaveConfirmation(
      result.conflictCount > 0 ? t('editorCloudSavedReviewSync') : t('editorSavedToCloud')
    );
  };

  const shareViaSMS = async () => {
    await handleShareImage();
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: getTranslatedStudioSaveTargetLabel(selectedSaveTarget),
      headerRight: () => (
        <Pressable
          onPressIn={captureNotesBeforeAction}
          onPress={() => {
            setIsSaveMenuOpen((current) => !current);
          }}
          style={[
            styles.headerSaveButton,
            { backgroundColor: colorTheme.toolbarBackground },
            isSaveMenuOpen
              ? {
                  backgroundColor: colorTheme.selectionBackground,
                  borderColor: colorTheme.border,
                }
              : null,
          ]}>
          <Ionicons
            name="save-outline"
            size={16}
            color="#5B514D"
          />
          <Text style={styles.headerSaveButtonText}>{t('actionSave')}</Text>
          <Ionicons name="chevron-down" size={14} color="#5B514D" />
        </Pressable>
      ),
    });
  }, [
    captureNotesBeforeAction,
    colorTheme.border,
    colorTheme.selectionBackground,
    colorTheme.toolbarBackground,
    isSaveMenuOpen,
    navigation,
    selectedSaveTarget,
    getTranslatedStudioSaveTargetLabel,
    t,
  ]);

  if (!fontsLoaded) return null;

  return (
    <KeyboardAvoidingView
      style={styles.screenPressable}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.screenPressable}
        scrollEnabled={
          !isBookDropdownOpen &&
          !isChapterDropdownOpen &&
          !isVerseDropdownOpen &&
          !isDrawingMode
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 220 : 220 },
        ]}
        keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.container,
            layout.isTablet
              ? [
                  styles.tabletContainer,
                  {
                    maxWidth: layout.studioMaxWidth,
                    paddingHorizontal: layout.pagePaddingHorizontal,
                  },
                ]
              : null,
            {
              backgroundColor: colorTheme.screenBackground,
              paddingTop: Platform.OS === 'web' ? 4 : 8,
            },
          ]}>
        <View
          style={[
            styles.headerSection,
            routeSourceParam === 'favorites' || Boolean(routeEntryIdParam)
              ? styles.headerSectionCompact
              : null,
          ]}>
          <View style={styles.controlsHeaderRow}>
            <View style={styles.bookDropdownContainer}>
              <Pressable
                disabled={isStudioLocked}
                onPress={(event) => {
                  event.stopPropagation();
                  setIsBookDropdownOpen((current) => !current);
                  setIsChapterDropdownOpen(false);
                  setIsVerseDropdownOpen(false);
                }}
                style={[
                  styles.bookDropdownButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  isStudioLocked ? styles.toolbarButtonDisabled : null,
                ]}>
                <Text numberOfLines={1} style={styles.bookDropdownButtonText}>
                  {selectedBook || t('commonBook')}
                </Text>
                <Text style={styles.bookDropdownChevron}>▼</Text>
              </Pressable>

              {isBookDropdownOpen ? (
                <View
                  style={[
                    styles.bookDropdownMenu,
                    {
                      backgroundColor: colorTheme.screenBackground,
                      borderColor: colorTheme.border,
                    },
                  ]}>
                  <GestureHandlerScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled">
                    {bookOptions.map((book) => (
                      <Pressable
                        key={book}
                        onPress={(event) => {
                          event.stopPropagation();
                          handleBookSelect(book);
                        }}
                        style={[
                          styles.bookDropdownOption,
                          selectedBook === book
                            ? [
                                styles.bookDropdownOptionSelected,
                                { backgroundColor: colorTheme.selectionBackground },
                              ]
                            : null,
                        ]}>
                        <Text style={styles.bookDropdownOptionText}>{book}</Text>
                      </Pressable>
                    ))}
                  </GestureHandlerScrollView>
                </View>
              ) : null}
            </View>

            <View style={styles.chapterDropdownContainer}>
              <Pressable
                disabled={isStudioLocked}
                onPress={(event) => {
                  event.stopPropagation();
                  if (!hasBookSelection) {
                    setIsBookDropdownOpen(true);
                    return;
                  }
                  setIsBookDropdownOpen(false);
                  setIsChapterDropdownOpen((current) => !current);
                  setIsVerseDropdownOpen(false);
                }}
                style={[
                  styles.chapterDropdownButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  isStudioLocked ? styles.toolbarButtonDisabled : null,
                ]}>
                <Text numberOfLines={1} style={styles.chapterDropdownButtonText}>
                  {hasChapterSelection
                    ? t('editorChapterShort', { number: selectedChapter })
                    : t('commonChapter')}
                </Text>
                <Text style={styles.chapterDropdownChevron}>▼</Text>
              </Pressable>

              {isChapterDropdownOpen ? (
                <View
                  style={[
                    styles.chapterDropdownMenu,
                    {
                      backgroundColor: colorTheme.screenBackground,
                      borderColor: colorTheme.border,
                    },
                  ]}>
                  <GestureHandlerScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled">
                    {chapterOptions.map((chapterNumber) => (
                      <Pressable
                        key={chapterNumber}
                        onPress={(event) => {
                          event.stopPropagation();
                          handleChapterSelect(chapterNumber);
                        }}
                        style={[
                          styles.chapterDropdownOption,
                          selectedChapter === chapterNumber
                            ? [
                                styles.chapterDropdownOptionSelected,
                                { backgroundColor: colorTheme.selectionBackground },
                              ]
                            : null,
                        ]}>
                        <Text style={styles.chapterDropdownOptionText}>
                          {t('editorChapterNumber', { number: chapterNumber })}
                        </Text>
                      </Pressable>
                    ))}
                  </GestureHandlerScrollView>
                </View>
              ) : null}
            </View>

            <View style={styles.verseDropdownContainer}>
              <Pressable
                disabled={isStudioLocked}
                onPress={(event) => {
                  event.stopPropagation();
                  if (!hasChapterSelection) {
                    setIsBookDropdownOpen(!hasBookSelection);
                    setIsChapterDropdownOpen(hasBookSelection);
                    return;
                  }
                  setIsBookDropdownOpen(false);
                  setIsChapterDropdownOpen(false);
                  setIsVerseDropdownOpen((current) => !current);
                }}
                style={[
                  styles.verseDropdownButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  isStudioLocked ? styles.toolbarButtonDisabled : null,
                ]}>
                <Text numberOfLines={1} style={styles.verseDropdownButtonText}>
                  {verseDropdownLabel}
                </Text>
                <Text style={styles.verseDropdownChevron}>▼</Text>
              </Pressable>

            </View>
          </View>

          {isVerseDropdownOpen ? (
            <View
              style={[
                styles.verseSelectionSheet,
                {
                  backgroundColor: colorTheme.screenBackground,
                  borderColor: colorTheme.border,
                },
              ]}>
              <Text style={styles.verseSelectionSheetTitle}>{t('editorPickVerseToStart')}</Text>
              <GestureHandlerScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator
                contentContainerStyle={styles.verseSelectionGrid}
                keyboardShouldPersistTaps="handled">
                {verseOptions.map((verseNumber) => {
                  const isVerseSelected = selectedVerses.includes(verseNumber);
                  const isActiveVerse = selectedVerse === verseNumber;

                  return (
                    <Pressable
                      key={verseNumber}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isVerseSelected }}
                      onPress={(event) => {
                        event.stopPropagation();
                        handleVerseOptionPress(verseNumber);
                      }}
                      style={[
                        styles.verseSelectionOption,
                        isActiveVerse || isVerseSelected
                          ? [
                              styles.verseSelectionOptionSelected,
                              { backgroundColor: colorTheme.selectionBackground },
                            ]
                          : null,
                      ]}>
                      <Ionicons
                        name={isVerseSelected ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={isVerseSelected ? '#C05A67' : '#9A8F88'}
                      />
                      <Text
                        style={[
                          styles.verseSelectionOptionText,
                          isActiveVerse ? styles.verseSelectionOptionTextSelected : null,
                        ]}>
                        {t('editorVerseNumber', { number: verseNumber })}
                      </Text>
                    </Pressable>
                  );
                })}
              </GestureHandlerScrollView>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.toolbarSection,
            {
              backgroundColor: colorTheme.screenBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <View style={styles.dropdownToolbarRow}>
            {(
              [
                { menu: 'fonts', iconKey: 'text', label: t('editorText') },
                { menu: 'stickers', iconKey: 'decor', label: t('editorDecor') },
                { menu: 'backgrounds', iconKey: 'canvas', label: t('editorCanvas') },
              ] as const
            ).map(({ menu, iconKey, label }) => (
              <Pressable
                key={menu}
                disabled={isStudioLocked}
                onPress={(event) => {
                  event.stopPropagation();
                  toggleToolbarMenu(menu);
                }}
                style={[
                  styles.dropdownToolbarButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  isStudioLocked ? styles.toolbarButtonDisabled : null,
                  openToolbarMenu === menu
                    ? [
                        styles.dropdownToolbarButtonActive,
                        {
                          backgroundColor: colorTheme.selectionBackground,
                          borderColor: colorTheme.border,
                        },
                      ]
                    : null,
                ]}>
                <View style={styles.dropdownToolbarButtonContent}>
                  <View style={styles.toolbarIconSlot}>
                    <Image
                      source={TOOLBAR_ICON_SOURCE[iconKey]}
                      resizeMode="contain"
                      style={[
                        styles.toolbarIconImage,
                        { transform: [{ translateY: TOOLBAR_ICON_OFFSET_Y[iconKey] }] },
                      ]}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    style={styles.dropdownToolbarButtonText}>
                    {label}
                  </Text>
                </View>
              </Pressable>
            ))}

              <TouchableOpacity
                onPress={addNote}
                disabled={isStudioLocked}
                style={[
                  styles.noteButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  isStudioLocked ? styles.toolbarButtonDisabled : null,
                ]}>
                <View style={styles.dropdownToolbarButtonContent}>
                  <View style={styles.toolbarIconSlot}>
                    <Image
                      source={TOOLBAR_ICON_SOURCE.note}
                      resizeMode="contain"
                      style={[
                        styles.toolbarIconImage,
                        { transform: [{ translateY: TOOLBAR_ICON_OFFSET_Y.note }] },
                      ]}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    style={styles.noteButtonText}>
                    {t('editorNote')}
                  </Text>
                </View>
              </TouchableOpacity>

              {canUseDrawingTool ? (
                <Pressable
                  disabled={isStudioLocked}
                  onPress={(event) => {
                    event.stopPropagation();
                    toggleToolbarMenu('draw');
                  }}
                  style={[
                    styles.dropdownToolbarButton,
                    { backgroundColor: colorTheme.toolbarBackground },
                    isStudioLocked ? styles.toolbarButtonDisabled : null,
                    openToolbarMenu === 'draw'
                      ? [
                          styles.dropdownToolbarButtonActive,
                          {
                            backgroundColor: colorTheme.selectionBackground,
                            borderColor: colorTheme.border,
                          },
                        ]
                      : null,
                  ]}>
                  <View style={styles.dropdownToolbarButtonContent}>
                    <View style={styles.toolbarIconSlot}>
                      <Ionicons name="brush-outline" size={20} color="#5B514D" />
                    </View>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                      style={styles.dropdownToolbarButtonText}>
                      {t('editorDraw')}
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  toggleToolbarMenu('more');
                }}
                style={[
                  styles.dropdownToolbarButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  openToolbarMenu === 'more'
                    ? [
                        styles.dropdownToolbarButtonActive,
                        {
                          backgroundColor: colorTheme.selectionBackground,
                          borderColor: colorTheme.border,
                        },
                      ]
                    : null,
                ]}>
                <View style={styles.dropdownToolbarButtonContent}>
                  <View style={styles.toolbarIconSlot}>
                    <Image
                      source={TOOLBAR_ICON_SOURCE.more}
                      resizeMode="contain"
                      style={[
                        styles.toolbarIconImage,
                        { transform: [{ translateY: TOOLBAR_ICON_OFFSET_Y.more }] },
                      ]}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    style={styles.dropdownToolbarButtonText}>
                    {t('editorMore')}
                  </Text>
                </View>
              </Pressable>

              <TouchableOpacity
                onPress={undoLastEdit}
                disabled={isStudioLocked || undoHistory.length === 0}
                style={[
                  styles.undoButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  isStudioLocked || undoHistory.length === 0 ? styles.undoButtonDisabled : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('editorUndoLastEdit')}>
                <View style={styles.dropdownToolbarButtonContent}>
                  <View style={styles.toolbarIconSlot}>
                    <Ionicons name="arrow-undo-outline" size={19} color="#5B514D" />
                  </View>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    style={styles.undoButtonText}>
                    {t('actionUndo')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={toggleStudioLock}
                style={[
                  styles.lockButton,
                  {
                    backgroundColor: isStudioLocked
                      ? colorTheme.selectionBackground
                      : colorTheme.toolbarBackground,
                    borderColor: isStudioLocked ? colorTheme.border : 'transparent',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={isStudioLocked ? t('editorUnlockStudio') : t('editorLockStudio')}>
                <View style={styles.dropdownToolbarButtonContent}>
                  <View style={styles.toolbarIconSlot}>
                    <Ionicons
                      name={isStudioLocked ? 'lock-closed-outline' : 'lock-open-outline'}
                      size={19}
                      color="#5B514D"
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    style={styles.lockButtonText}>
                    {isStudioLocked ? t('editorUnlock') : t('editorLock')}
                  </Text>
                </View>
              </TouchableOpacity>

          </View>

          {openToolbarMenu ? (
            <View
              style={[
                styles.dropdownPanel,
                {
                  backgroundColor: colorTheme.screenBackground,
                  borderColor: colorTheme.border,
                },
              ]}>
              {openToolbarMenu === 'fonts' ? (
                <View style={styles.dropdownOptionList}>
                  <View style={styles.textMenuFontRow}>
                    <Pressable
                      onPress={() => {
                        selectFont('Playwrite');
                      }}
                      style={[
                        styles.dropdownOptionButton,
                        styles.textMenuFontButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                        selectedFont === 'Playwrite'
                          ? [
                              styles.dropdownOptionButtonActive,
                              {
                                backgroundColor: colorTheme.selectionBackground,
                                borderColor: colorTheme.border,
                              },
                            ]
                          : null,
                      ]}>
                      <Text style={[styles.dropdownOptionText, styles.lovelyButtonText]}>
                        Lovely
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        selectFont('bold');
                      }}
                      style={[
                        styles.dropdownOptionButton,
                        styles.textMenuFontButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                        selectedFont === 'bold'
                          ? [
                              styles.dropdownOptionButtonActive,
                              {
                                backgroundColor: colorTheme.selectionBackground,
                                borderColor: colorTheme.border,
                              },
                            ]
                          : null,
                      ]}>
                      <Text style={[styles.dropdownOptionText, styles.strongButtonText]}>
                        Strong
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        selectFont('serif');
                      }}
                      style={[
                        styles.dropdownOptionButton,
                        styles.textMenuFontButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                        selectedFont === 'serif'
                          ? [
                              styles.dropdownOptionButtonActive,
                              {
                                backgroundColor: colorTheme.selectionBackground,
                                borderColor: colorTheme.border,
                              },
                            ]
                          : null,
                      ]}>
                      <Text style={[styles.dropdownOptionText, styles.classicButtonText]}>
                        Classic
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.sizeDropdownRow}>
                    <TouchableOpacity
                      onPress={decreaseFontSize}
                      style={[
                        styles.sizeDropdownButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                      ]}>
                      <Text style={styles.smallA}>A-</Text>
                    </TouchableOpacity>

                    <Text style={styles.sizeDropdownValue}>{fontSize}</Text>

                    <TouchableOpacity
                      onPress={increaseFontSize}
                      style={[
                        styles.sizeDropdownButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                      ]}>
                      <Text style={styles.largeA}>A+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardColorSection}>
                    <Text style={styles.cardColorLabel}>{t('editorCardColor')}</Text>
                    <View style={styles.cardColorRow}>
                      {VERSE_CARD_COLOR_OPTIONS.map((option) => (
                        <Pressable
                          key={option.key}
                          onPress={() => {
                            selectVerseCardColor(option.key);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Set verse card color to ${option.name}`}
                          style={[
                            styles.cardColorButton,
                            {
                              backgroundColor: option.color,
                              borderColor: option.borderColor,
                            },
                            activeVerseCardColorKey === option.key
                              ? styles.cardColorButtonSelected
                              : null,
                          ]}>
                          {activeVerseCardColorKey === option.key ? (
                            <Ionicons name="checkmark" size={13} color="#5B514D" />
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.highlightColorSection}>
                    <Text style={styles.highlightColorLabel}>{t('editorHighlightColor')}</Text>
                    <View style={styles.highlightDropdownRow}>
                      {HIGHLIGHT_COLORS.map(({ key, color }) => (
                        <Pressable
                          key={key}
                          onPress={() => {
                            setSelectedHighlightColor(key);
                            setOpenToolbarMenu(null);
                          }}
                          style={[
                            styles.highlightColorButton,
                            { backgroundColor: color },
                            selectedHighlightColor === key &&
                              styles.highlightColorButtonSelected,
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}

              {openToolbarMenu === 'stickers' ? (
                <ScrollView
                  style={styles.stickerDropdownScroll}
                  contentContainerStyle={styles.stickerDropdownContent}
                  showsVerticalScrollIndicator={false}>
                  <Text style={styles.stickerPackLabel}>{t('editorQuickStickers')}</Text>
                  <View style={styles.stickerDropdownRow}>
                    {['🌸', '💖', '✨'].map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        onPress={() => {
                          addSticker(emoji);
                          setOpenToolbarMenu(null);
                        }}
                        style={styles.emojiStickerButton}>
                        <Text style={styles.stickerButtonEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {TEST_UNLOCKED_STICKER_PACKS.map((pack) => (
                    <View key={pack.id} style={styles.shopStickerPackSection}>
                      <Text style={styles.stickerPackLabel}>{pack.title}</Text>
                      <View style={styles.shopStickerGrid}>
                        {pack.stickers.map((shopSticker) => (
                          <TouchableOpacity
                            key={shopSticker.key}
                            onPress={() => {
                              addShopSticker(shopSticker.key);
                              setOpenToolbarMenu(null);
                            }}
                            style={styles.stickerImageButton}>
                            <Image
                              source={shopSticker.previewImage ?? shopSticker.image}
                              resizeMode="contain"
                              style={[
                                styles.stickerButtonImage,
                                getShopStickerDisplaySize(shopSticker, 52),
                              ]}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              {openToolbarMenu === 'backgrounds' ? (
                <ScrollView
                  style={styles.backgroundDropdownScroll}
                  contentContainerStyle={styles.backgroundDropdownContent}
                  showsVerticalScrollIndicator={false}>
                  <Text style={styles.stickerPackLabel}>{t('editorBasic')}</Text>
                  <View style={styles.backgroundGrid}>
                    <TouchableOpacity
                      onPress={() => updateStudioBackground(null)}
                      style={[
                        styles.backgroundImageButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                        backgroundKey === null ? styles.backgroundImageButtonActive : null,
                      ]}>
                      <View style={styles.linedBackgroundPreview}>
                        {Array.from({ length: 4 }).map((_, index) => (
                          <View key={`lined-preview-${index}`} style={styles.linedPreviewLine} />
                        ))}
                      </View>
                      <Text style={styles.backgroundButtonText}>{t('editorLined')}</Text>
                    </TouchableOpacity>
                  </View>

                  {TEST_UNLOCKED_BACKGROUND_PACKS.map((pack) => (
                    <View key={pack.id} style={styles.shopStickerPackSection}>
                      <Text style={styles.stickerPackLabel}>{pack.title}</Text>
                      <View style={styles.backgroundGrid}>
                        {pack.backgrounds.map((backgroundOption) => (
                          <TouchableOpacity
                            key={backgroundOption.key}
                            onPress={() => updateStudioBackground(backgroundOption.key)}
                            style={[
                              styles.backgroundImageButton,
                              { backgroundColor: colorTheme.toolbarBackground },
                              backgroundKey === backgroundOption.key
                                ? styles.backgroundImageButtonActive
                                : null,
                            ]}>
                            <Image
                              source={backgroundOption.previewImage ?? backgroundOption.image}
                              resizeMode="cover"
                              style={styles.backgroundButtonImage}
                            />
                            <Text numberOfLines={2} style={styles.backgroundButtonText}>
                              {backgroundOption.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              {openToolbarMenu === 'draw' ? (
                <View style={styles.dropdownOptionList}>
                  <View style={styles.drawMenuSection}>
                    <Text style={styles.drawMenuLabel}>{t('editorPenColor')}</Text>
                    <View style={styles.drawColorRow}>
                      {DRAWING_COLOR_OPTIONS.map((color) => (
                        <Pressable
                          key={color}
                          onPress={() => setSelectedDrawingColor(color)}
                          style={[
                            styles.drawColorButton,
                            { backgroundColor: color },
                            selectedDrawingColor === color ? styles.drawColorButtonSelected : null,
                          ]}>
                          {selectedDrawingColor === color ? (
                            <Ionicons name="checkmark" size={13} color="#FFFDF9" />
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.drawMenuSection}>
                    <Text style={styles.drawMenuLabel}>{t('editorPenSize')}</Text>
                    <View style={styles.drawWidthRow}>
                      {DRAWING_WIDTH_OPTIONS.map((width) => (
                        <Pressable
                          key={width}
                          onPress={() => setSelectedDrawingWidth(width)}
                          style={[
                            styles.drawWidthButton,
                            { backgroundColor: colorTheme.toolbarBackground },
                            selectedDrawingWidth === width
                              ? [
                                  styles.dropdownOptionButtonActive,
                                  { backgroundColor: colorTheme.selectionBackground },
                                ]
                              : null,
                          ]}>
                          <View
                            style={[
                              styles.drawWidthPreview,
                              {
                                height: width,
                                borderRadius: width / 2,
                                backgroundColor: selectedDrawingColor,
                              },
                            ]}
                          />
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.drawActionsRow}>
                    <TouchableOpacity
                      onPress={undoLastDrawingStroke}
                      disabled={drawingStrokes.length === 0}
                      style={[
                        styles.drawActionButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                        drawingStrokes.length === 0 ? styles.toolbarButtonDisabled : null,
                      ]}>
                      <Ionicons name="arrow-undo-outline" size={17} color="#5B514D" />
                      <Text numberOfLines={1} style={styles.drawActionText}>
                        {t('editorUndoStroke')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={clearDrawing}
                      disabled={drawingStrokes.length === 0}
                      style={[
                        styles.drawActionButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                        drawingStrokes.length === 0 ? styles.toolbarButtonDisabled : null,
                      ]}>
                      <Ionicons name="trash-outline" size={17} color="#5B514D" />
                      <Text numberOfLines={1} style={styles.drawActionText}>
                        {t('editorClearDrawing')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {openToolbarMenu === 'more' ? (
                <View style={styles.dropdownOptionList}>
                  <View style={styles.moreActionsRow}>
                    <TouchableOpacity
                      onPress={resetCurrentDesign}
                      disabled={isStudioLocked}
                      style={[
                        styles.moreActionButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                        isStudioLocked ? styles.shareImageButtonDisabled : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t('studioStartOver')}>
                      <Ionicons name="arrow-redo-outline" size={17} color="#5B514D" />
                      <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={styles.moreActionButtonText}>{t('studioStartOver')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        void handleSaveImage();
                      }}
                      style={[
                        styles.moreActionButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                        isSharingImage ? styles.shareImageButtonDisabled : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={isSharingImage ? t('editorSavingImage') : t('actionSaveImage')}>
                      <Ionicons name="download-outline" size={17} color="#333" />
                      <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={styles.moreActionButtonText}>{t('actionSaveImage')}</Text>
                    </TouchableOpacity>

                    <EncryptedCloudSaveAction
                      buttonStyle={[
                        styles.moreActionButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                      ]}
                      textStyle={styles.moreActionButtonText}
                      iconColor="#333"
                      disabledStyle={styles.shareImageButtonDisabled}
                      onSaved={handleCloudSaved}
                    />

                    <TouchableOpacity
                      onPress={() => {
                        void shareViaSMS();
                      }}
                      style={[
                        styles.moreActionButton,
                        { backgroundColor: colorTheme.toolbarBackground },
                        isSharingImage ? styles.shareImageButtonDisabled : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={isSharingImage ? t('editorSharingImage') : t('actionShare')}>
                      <Ionicons name="share-outline" size={17} color="#333" />
                      <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={styles.moreActionButtonText}>{t('actionShare')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {isSaveMenuOpen ? (
            <View
              style={[
                styles.saveMenu,
                {
                  backgroundColor: colorTheme.paperBackground,
                  borderColor: colorTheme.border,
                },
              ]}>
              <Text style={styles.saveMenuLabel}>{t('editorSaveTo')}</Text>
              {STUDIO_SAVE_TARGET_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    void handleSaveToTarget(option.key);
                  }}
                  style={[
                    styles.saveMenuItem,
                    selectedSaveTarget === option.key
                      ? [
                          styles.saveMenuItemActive,
                          {
                            backgroundColor: colorTheme.selectionBackground,
                          },
                        ]
                      : null,
                  ]}>
                  <Ionicons
                    name={selectedSaveTarget === option.key ? 'checkmark-circle' : 'ellipse-outline'}
                    size={17}
                    color={selectedSaveTarget === option.key ? '#5B514D' : '#8F877F'}
                  />
                  <Text style={styles.saveMenuItemText}>
                    {getTranslatedStudioSaveTargetLabel(option.key)}
                  </Text>
                </Pressable>
              ))}
              <View style={[styles.saveMenuDivider, { backgroundColor: colorTheme.border }]} />
              <Pressable
                disabled={!canAddCurrentDesignToFavorites}
                onPress={() => {
                  void handleAddToFavorites();
                }}
                style={[
                  styles.saveMenuItem,
                  isFavoriteActive
                    ? [
                        styles.saveMenuItemActive,
                        {
                          backgroundColor: colorTheme.selectionBackground,
                        },
                      ]
                    : null,
                  !canAddCurrentDesignToFavorites ? styles.shareImageButtonDisabled : null,
                ]}>
                <Ionicons
                  name={isFavoriteActive ? 'heart' : 'heart-outline'}
                  size={17}
                  color={isFavoriteActive ? '#C05A67' : '#5B514D'}
                />
                <Text style={styles.saveMenuItemText}>{t('editorAddToFavorites')}</Text>
              </Pressable>
              <View style={[styles.saveMenuDivider, { backgroundColor: colorTheme.border }]} />
              <Pressable
                onPress={() => {
                  void handleExportImageFromSaveMenu();
                }}
                style={[styles.saveMenuItem, isSharingImage ? styles.shareImageButtonDisabled : null]}>
                <Ionicons name="images-outline" size={17} color="#5B514D" />
                <Text style={styles.saveMenuItemText}>{t('editorExportToImages')}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.toolbarDivider} />

        <View style={styles.contentContainer}>
          <View ref={captureViewRef} collapsable={false} style={styles.captureFrame}>
            <View style={styles.journalBackgroundShell}>
              {selectedStudioBackground ? (
                <Image
                  source={selectedStudioBackground.image}
                  resizeMode="cover"
                  style={styles.journalBackgroundImage}
                />
              ) : null}
              <View
                style={[
                  styles.journalBackground,
                  { backgroundColor: selectedStudioBackground ? 'transparent' : colorTheme.editorBackground },
                ]}>
              {!selectedStudioBackground ? (
                <View pointerEvents="none" style={styles.journalLinesOverlay}>
                  {Array.from({ length: journalLineCount }).map((_, index) => (
                    <View
                      key={`journal-line-${index}`}
                      style={[
                        styles.journalLine,
                        {
                          top: JOURNAL_LINE_TOP_OFFSET + index * JOURNAL_LINE_SPACING,
                          backgroundColor: colorTheme.border,
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : null}
              <View
                onLayout={(event) => {
                  setCaptureCanvasTop(event.nativeEvent.layout.y);
                }}
                style={styles.captureCanvas}>
              <Pressable
                onPress={clearCanvasSelection}
                style={[
                  styles.captureStage,
                  { minHeight: contentStageMinHeight },
                ]}>
                <DrawingLayer strokes={drawingStrokes} />
                <View pointerEvents="box-none" style={styles.floatingLayer}>
                  {floatingItems.map((floatingItem) =>
                    floatingItem.type === 'verse-card' ? (
                      <DraggableVerseCard
                        key={floatingItem.item.id}
                        card={floatingItem.item}
                        isActive={floatingItem.item.verse === selectedVerseCardVerse}
                        isLocked={isStudioLocked}
                        verseTypography={verseTypography}
                        highlightedWords={highlightedWords}
                        onSelect={selectVerseCard}
                        onRemove={deactivateVerse}
                        onUpdate={updateVerseCard}
                        onToggleWordHighlight={toggleWordHighlight}
                      />
                    ) : floatingItem.type === 'note' ? (
                      <DraggableNote
                        key={`note-${floatingItem.item.id}`}
                        note={floatingItem.item}
                        isSelected={floatingItem.item.id === selectedNoteId}
                        isEditing={floatingItem.item.id === activeNoteEditingId}
                        isLocked={isStudioLocked}
                        isStyleEditorOpen={floatingItem.item.id === noteStyleEditorId}
                        shouldAutoFocus={floatingItem.item.id === autoFocusNoteId}
                        onSelect={selectNote}
                        onFocus={(id, y, height) => {
                          setFocusedNoteId(id);
                          setFocusedNoteTarget({ id, y, height });
                        }}
                        onBlur={(id) => {
                          setFocusedNoteId((current) => (current === id ? null : current));
                          setFocusedNoteTarget((current) =>
                            current?.id === id ? null : current
                          );
                        }}
                        onDelete={deleteNote}
                        onUpdate={updateNote}
                        onToggleStyleEditor={toggleNoteStyleEditor}
                        onAutoFocusHandled={() => {
                          setAutoFocusNoteId((current) =>
                            current === floatingItem.item.id ? null : current
                          );
                        }}
                      />
                    ) : (
                      <DraggableSticker
                        key={`sticker-${floatingItem.item.id}`}
                        sticker={floatingItem.item}
                        isSelected={floatingItem.item.id === selectedStickerId}
                        isLocked={isStudioLocked}
                        onDelete={deleteSticker}
                        onSelect={selectSticker}
                        onUpdate={updateSticker}
                      />
                    )
                  )}
                </View>
                {canUseDrawingTool ? (
                  <PanGestureHandler
                    enabled={isDrawingMode}
                    onGestureEvent={onDrawingGestureEvent}
                    onHandlerStateChange={onDrawingStateChange}>
                    <View
                      pointerEvents={isDrawingMode ? 'auto' : 'none'}
                      style={styles.drawingGestureLayer}
                    />
                  </PanGestureHandler>
                ) : null}
              </Pressable>
              </View>
              </View>
            </View>
          </View>
        </View>
        </View>
      </ScrollView>

      {activeNoteEditingId ? (
        <Pressable
          onPress={finishNoteEditing}
          style={styles.keyboardDoneButton}>
          <Text style={styles.keyboardDoneButtonText}>{t('actionDone')}</Text>
        </Pressable>
      ) : null}

      <SaveConfirmationToast
        visibleKey={saveConfirmationKey}
        message={saveConfirmationMessage}
        tintColor={colorTheme.tint}
        borderColor={colorTheme.border}
        backgroundColor={colorTheme.paperBackground}
        style={styles.saveConfirmationToast}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.saveToast,
          saveToastAnimatedStyle,
          !saveToastMessage && styles.hiddenSaveToast,
        ]}>
        <Text style={styles.saveToastText}>{saveToastMessage}</Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenPressable: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'column',
    position: 'relative',
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 4,
  },
  tabletContainer: {
    width: '100%',
    alignSelf: 'center',
  },
  headerSection: {
    marginTop: Platform.OS === 'web' ? 0 : 2,
    marginBottom: 4,
    position: 'relative',
    zIndex: 80,
    elevation: 80,
  },
  headerSectionCompact: {
    marginTop: 0,
    marginBottom: 6,
  },
  title: {
    fontSize: 19,
    lineHeight: 22,
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  saveMenu: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 232,
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 120,
    zIndex: 120,
  },
  saveMenuLabel: {
    color: '#7A6F66',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingBottom: 5,
  },
  saveMenuItem: {
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveMenuItemActive: {
    borderColor: '#DCCFC5',
  },
  saveMenuItemText: {
    flex: 1,
    color: '#3A302B',
    fontSize: 13,
    fontWeight: '600',
  },
  saveMenuDivider: {
    height: 1,
    marginVertical: 6,
  },
  controlsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 3,
  },
  shareImageButtonDisabled: {
    opacity: 0.65,
  },
  moreActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  moreActionButton: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '30%',
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 7,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  moreActionButtonText: {
    flexShrink: 1,
    color: '#1F1F1F',
    fontSize: 12,
    fontWeight: '600',
  },
  verse: {
    lineHeight: 28,
    paddingBottom: 6,
  },
  versePassage: {
    width: '100%',
  },
  verseEntry: {
    marginBottom: 14,
  },
  verseEntryLast: {
    marginBottom: 0,
  },
  verseNumber: {
    color: 'rgba(91,81,77,0.6)',
    fontSize: 14,
    lineHeight: 16,
    marginBottom: 8,
    marginLeft: 2,
  },
  verseNumberSelected: {
    color: 'rgba(91,81,77,0.78)',
  },
  verseWordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  verseWordToken: {
    borderRadius: 4,
    marginRight: 0,
    marginBottom: 4,
    paddingHorizontal: 0,
  },
  bookDropdownContainer: {
    position: 'relative',
    zIndex: 50,
    width: '34%',
    flexShrink: 0,
    minWidth: 0,
  },
  bookDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
    minHeight: 38,
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F3EDE8',
  },
  bookDropdownButtonText: {
    color: '#1F1F1F',
    fontSize: 12,
    flex: 1,
  },
  bookDropdownChevron: {
    color: '#1F1F1F',
    fontSize: 12,
  },
  bookDropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    width: 190,
    maxHeight: 320,
    borderRadius: 18,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E8DCD4',
    paddingVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  bookDropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bookDropdownOptionSelected: {
    backgroundColor: '#F3EDE8',
  },
  bookDropdownOptionText: {
    color: '#1F1F1F',
    fontSize: 15,
  },
  chapterDropdownContainer: {
    position: 'relative',
    zIndex: 45,
    width: '36%',
    flexShrink: 0,
    minWidth: 0,
  },
  chapterDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
    minHeight: 38,
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F3EDE8',
  },
  chapterDropdownButtonText: {
    color: '#1F1F1F',
    fontSize: 12,
    flexShrink: 1,
  },
  chapterDropdownChevron: {
    color: '#1F1F1F',
    fontSize: 12,
  },
  chapterDropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    width: 124,
    minWidth: 124,
    maxHeight: 320,
    borderRadius: 18,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E8DCD4',
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  chapterDropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chapterDropdownOptionSelected: {
    backgroundColor: '#F3EDE8',
  },
  chapterDropdownOptionText: {
    color: '#1F1F1F',
    fontSize: 15,
  },
  verseDropdownContainer: {
    position: 'relative',
    zIndex: 40,
    width: '28%',
    flexShrink: 0,
    minWidth: 0,
  },
  verseDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
    minHeight: 38,
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F3EDE8',
  },
  verseDropdownButtonText: {
    color: '#1F1F1F',
    fontSize: 12,
    flexShrink: 1,
  },
  verseDropdownChevron: {
    color: '#1F1F1F',
    fontSize: 12,
  },
  verseDropdownMenu: {
    position: 'absolute',
    top: 50,
    right: 0,
    width: 156,
    maxHeight: 320,
    borderRadius: 18,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E8DCD4',
    paddingVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  verseSelectionSheet: {
    width: '100%',
    maxHeight: 270,
    borderRadius: 20,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E8DCD4',
    padding: 10,
    marginTop: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  verseSelectionSheetTitle: {
    color: '#5B514D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  verseSelectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 2,
  },
  verseSelectionOption: {
    minHeight: 42,
    minWidth: 102,
    flexGrow: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#F8F5F2',
  },
  verseSelectionOptionSelected: {
    backgroundColor: '#F3EDE8',
    borderWidth: 1,
    borderColor: '#D4C2B8',
  },
  verseSelectionOptionText: {
    color: '#1F1F1F',
    fontSize: 14,
    fontWeight: '600',
  },
  verseSelectionOptionTextSelected: {
    color: '#5B514D',
  },
  headerSaveButton: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  headerSaveButtonActive: {
    borderColor: '#DCCFC5',
  },
  headerSaveButtonText: {
    color: '#3A302B',
    fontSize: 13,
    fontWeight: '700',
  },
  saveDesignButton: {
    width: 40,
    height: 40,
    marginLeft: 12,
    borderRadius: 20,
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDesignButtonActive: {
    backgroundColor: '#F7E6E8',
    borderWidth: 1,
    borderColor: '#E3B7BE',
  },
  saveDesignButtonDisabled: {
    opacity: 0.45,
  },
  verseDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  verseDropdownOptionSelected: {
    backgroundColor: '#F3EDE8',
  },
  verseDropdownOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verseDropdownOptionCheckbox: {
    marginRight: 0,
  },
  verseDropdownCheckboxButton: {
    paddingRight: 10,
    paddingVertical: 2,
  },
  verseDropdownOptionLabelButton: {
    flex: 1,
    paddingVertical: 6,
  },
  verseDropdownOptionText: {
    color: '#1F1F1F',
    fontSize: 15,
  },
  verseDropdownOptionTextSelected: {
    color: '#5B514D',
    fontWeight: '600',
  },
  toolbarSection: {
    position: 'relative',
    zIndex: 70,
    elevation: 70,
    marginTop: 10,
    marginBottom: 14,
    flexDirection: 'column-reverse',
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 8,
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  toolbarDivider: {
    height: 0,
    marginBottom: 0,
  },
  dropdownToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  dropdownToolbarButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 1,
  },
  dropdownToolbarButtonActive: {
    backgroundColor: '#E8DCD4',
    borderWidth: 1,
    borderColor: '#D4C2B8',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 2,
  },
  toolbarButtonDisabled: {
    opacity: 0.45,
  },
  dropdownToolbarButtonContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    width: '100%',
  },
  dropdownToolbarEmoji: {
    fontSize: 16,
    lineHeight: 20,
    marginRight: 6,
  },
  toolbarIconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarIconImage: {
    width: 19,
    height: 19,
  },
  dropdownToolbarButtonText: {
    width: '100%',
    color: '#1F1F1F',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  dropdownPanel: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E8DCD4',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dropdownOptionList: {
    gap: 8,
  },
  drawMenuSection: {
    gap: 8,
  },
  drawMenuLabel: {
    color: '#5B514D',
    fontSize: 13,
    fontWeight: '800',
  },
  drawColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawColorButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  drawColorButtonSelected: {
    borderColor: '#5B514D',
  },
  drawWidthRow: {
    flexDirection: 'row',
    gap: 8,
  },
  drawWidthButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawWidthPreview: {
    width: '58%',
  },
  drawActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  drawActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  drawActionText: {
    flexShrink: 1,
    color: '#5B514D',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  textMenuFontRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textMenuFontButton: {
    flex: 1,
  },
  dropdownOptionButton: {
    height: 42,
    borderRadius: 16,
    backgroundColor: '#F8F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownOptionButtonActive: {
    backgroundColor: '#E8DCD4',
    borderWidth: 1,
    borderColor: '#D4C2B8',
  },
  dropdownOptionText: {
    color: '#1F1F1F',
    fontSize: 15,
    textAlign: 'center',
  },
  lovelyButtonText: {
    fontFamily: 'Playwrite',
  },
  strongButtonText: {
    fontWeight: '700',
  },
  classicButtonText: {
    fontFamily: 'serif',
  },
  sizeDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sizeDropdownButton: {
    backgroundColor: '#F3EDE8',
    borderRadius: 20,
    width: 76,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeDropdownValue: {
    flex: 1,
    fontSize: 20,
    textAlign: 'center',
  },
  smallA: {
    fontSize: 16,
  },
  largeA: {
    fontSize: 20,
  },
  contentContainer: {
    flex: 1,
    zIndex: 1,
  },
  captureFrame: {
    width: '100%',
  },
  journalBackgroundShell: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FCFAF6',
  },
  journalBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  journalBackground: {
    width: '100%',
    padding: 16,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#FCFAF6',
  },
  journalLinesOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  journalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(207, 187, 175, 0.9)',
  },
  captureCanvas: {
    backgroundColor: 'transparent',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'web' ? 48 : 96,
    marginBottom: 12,
  },
  captureStage: {
    position: 'relative',
  },
  drawingLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 18,
  },
  drawingSegment: {
    position: 'absolute',
  },
  drawingDot: {
    position: 'absolute',
  },
  drawingGestureLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
  },
  verseCardsLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  verseCard: {
    position: 'absolute',
    width: 292,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderRadius: 20,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  selectedVerseCard: {
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  verseResizeHandleWrapper: {
    position: 'absolute',
    right: -12,
    bottom: -12,
    zIndex: 50,
  },
  verseRemoveButton: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#D9D9D9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 60,
  },
  verseCardInner: {
    width: '100%',
  },
  versePaperCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 22,
    marginTop: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    transform: [{ rotate: '-0.5deg' }],
  },
  highlightDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  highlightColorSection: {
    alignItems: 'center',
    gap: 8,
  },
  highlightColorLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5B514D',
    textTransform: 'uppercase',
  },
  cardColorSection: {
    alignItems: 'center',
    gap: 8,
  },
  cardColorLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5B514D',
    textTransform: 'uppercase',
  },
  cardColorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 9,
  },
  cardColorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardColorButtonSelected: {
    borderWidth: 2,
    borderColor: '#1F1F1F',
  },
  highlightColorButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7CCC5',
  },
  highlightColorButtonSelected: {
    borderColor: '#1F1F1F',
    borderWidth: 2,
  },
  noteButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 1,
  },
  noteButtonText: {
    width: '100%',
    color: '#1F1F1F',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  undoButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 1,
  },
  undoButtonDisabled: {
    opacity: 0.45,
  },
  undoButtonText: {
    width: '100%',
    color: '#1F1F1F',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
  lockButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 1,
  },
  lockButtonText: {
    width: '100%',
    color: '#1F1F1F',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
    textAlign: 'center',
  },
  resetButton: {
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginRight: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 1,
  },
  resetButtonText: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    marginLeft: 6,
  },
  shareButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 1,
  },
  stickerDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  stickerDropdownScroll: {
    maxHeight: 280,
  },
  stickerDropdownContent: {
    paddingBottom: 4,
  },
  stickerPackLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7A6F66',
    marginBottom: 8,
  },
  emojiStickerButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#F8F5F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  shopStickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shopStickerPackSection: {
    marginTop: 4,
    marginBottom: 14,
  },
  backgroundDropdownScroll: {
    maxHeight: 280,
  },
  backgroundDropdownContent: {
    paddingBottom: 4,
  },
  backgroundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  backgroundImageButton: {
    width: 92,
    minHeight: 112,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8DCD4',
    padding: 7,
    alignItems: 'center',
  },
  backgroundImageButtonActive: {
    borderColor: '#C88C93',
    backgroundColor: '#F8EDEF',
  },
  backgroundButtonImage: {
    width: 76,
    height: 58,
    borderRadius: 6,
    marginBottom: 7,
  },
  linedBackgroundPreview: {
    width: 76,
    height: 58,
    borderRadius: 6,
    marginBottom: 7,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  linedPreviewLine: {
    height: 1,
    backgroundColor: '#D4C8BE',
    marginBottom: 9,
  },
  backgroundButtonText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#5B514D',
    textAlign: 'center',
  },
  stickerButtonEmoji: {
    fontSize: 24,
  },
  verseWord: {
    color: '#1F1F1F',
    borderRadius: 4,
    paddingBottom: 2,
    paddingTop: 1,
  },
  verseWordText: {
    includeFontPadding: false,
    letterSpacing: -0.15,
  },
  floatingLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  noteCard: {
    position: 'absolute',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  selectedNoteCard: {
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  unselectedNoteCard: {
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  noteCardInner: {
    flex: 1,
  },
  noteCardLabel: {
    color: '#4D433D',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  noteCardInput: {
    flex: 1,
    color: '#4D433D',
    fontSize: 15,
    letterSpacing: -0.6,
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 0,
  },
  noteCardPreviewText: {
    flex: 1,
    color: '#4D433D',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.3,
    paddingTop: 8,
    paddingBottom: 4,
  },
  noteCardPreviewPlaceholder: {
    color: '#8F877F',
  },
  noteDeleteButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    zIndex: 50,
    height: 24,
    width: 24,
    borderRadius: 12,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteEditButton: {
    position: 'absolute',
    top: -10,
    left: -10,
    zIndex: 55,
    height: 24,
    width: 24,
    borderRadius: 12,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#DCCFC5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  noteStylePanel: {
    position: 'absolute',
    top: 18,
    left: -8,
    zIndex: 54,
    width: 190,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  noteStylePanelTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  noteStyleSwatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteStyleSwatchButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteStyleSwatchButtonSelected: {
    borderWidth: 2,
  },
  noteShopHint: {
    marginTop: 10,
    minHeight: 28,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 253, 249, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteShopHintText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  noteResizeHandleWrapper: {
    position: 'absolute',
    right: -12,
    bottom: -12,
    zIndex: 50,
  },
  sticker: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerPressTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSticker: {
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  unselectedSticker: {
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  stickerText: {
    fontSize: 30,
  },
  stickerImage: {
    width: 122,
    height: 122,
  },
  stickerImageButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCD4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stickerButtonImage: {
    width: 48,
    height: 48,
  },
  deleteButton: {
    position: 'absolute',
    top: -12,
    right: -12,
    zIndex: 40,
    height: 24,
    width: 24,
    borderRadius: 12,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  resizeHandleWrapper: {
    position: 'absolute',
    right: -12,
    bottom: -12,
    zIndex: 50,
  },
  resizeHandle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#D9D9D9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  keyboardDoneButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: '#F3EDE8',
    borderWidth: 1,
    borderColor: '#D4C2B8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  keyboardDoneButtonText: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '600',
  },
  saveConfirmationToast: {
    top: Platform.OS === 'web' ? 78 : 112,
  },
  saveToast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 108,
    alignSelf: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 253, 249, 0.97)',
    borderWidth: 1,
    borderColor: '#E8DCD4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  hiddenSaveToast: {
    opacity: 0,
  },
  saveToastText: {
    color: '#5B514D',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
