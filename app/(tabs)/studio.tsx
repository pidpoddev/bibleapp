import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useRoute } from '@react-navigation/native';
import {
  DEFAULT_VERSE_EDITOR_STATE,
  loadVerseStateMap,
  saveVerseStateMap,
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
  getShopSticker,
  getShopStickerDisplaySize,
  TEST_UNLOCKED_STICKER_PACKS,
} from '@/utils/shop-stickers';

type Sticker = StickerData;
type Note = NoteData;
type VerseCard = VerseCardData;

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
};

type VerseCardUpdate = {
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  text?: string;
};

type DraggableStickerProps = {
  sticker: Sticker;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: StickerUpdate) => void;
};

type DraggableNoteProps = {
  note: Note;
  isSelected: boolean;
  shouldAutoFocus: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: NoteUpdate) => void;
  onAutoFocusHandled: () => void;
  onFocus: (id: string, y: number, height: number) => void;
  onBlur: (id: string) => void;
};

type DraggableVerseCardProps = {
  card: VerseCard;
  isActive: boolean;
  verseTypography: {
    fontSize: number;
    lineHeight: number;
    fontFamily: 'Playwrite' | 'serif' | 'System';
    fontWeight?: '700';
  };
  highlightedWords: Record<string, HighlightColor>;
  onSelect: (verse: number) => void;
  onUpdate: (id: string, updates: VerseCardUpdate) => void;
  onToggleWordHighlight: (wordIndex: number) => void;
};

type SavedVerseDesign = {
  key: string;
  book: string;
  chapter: number;
  verse: number;
  selectedVerses: number[];
  verseCards: VerseCard[];
  stickers: Sticker[];
  notes: Note[];
  backgroundKey: string | null;
  highlights: Record<string, HighlightColor>;
  selectedFont: string;
  fontSize: number;
  savedAt: string;
};

const MIN_SCALE = 0.7;
const MAX_SCALE = 2.4;
const MIN_NOTE_WIDTH = 100;
const MAX_NOTE_WIDTH = 300;
const MIN_NOTE_HEIGHT = 80;
const MAX_NOTE_HEIGHT = 300;
const JOURNAL_LINE_COUNT = 24;
const JOURNAL_LINE_SPACING = 52;
const JOURNAL_LINE_TOP_OFFSET = 28;
const DEFAULT_CAPTURE_STAGE_MIN_HEIGHT = 460;
const VERSE_CARD_ESTIMATED_LINE_WIDTH = 17;
const DEFAULT_BOOK = 'John';
const DEFAULT_CHAPTER = 3;
const DEFAULT_VERSE = 16;
const VERSE_DESIGN_AUTOSAVE_DELAY_MS = 700;
const MAX_UNDO_HISTORY = 25;
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
function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function cloneVerseEditorState(state: VerseEditorState): VerseEditorState {
  return {
    verseCards: state.verseCards.map((verseCard) => ({ ...verseCard })),
    stickers: state.stickers.map((sticker) => ({ ...sticker })),
    notes: state.notes.map((note) => ({ ...note })),
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
    backgroundKey: design.backgroundKey ?? null,
    selectedFont: design.selectedFont,
    fontSize: design.fontSize,
    highlightedWords: { ...design.highlights },
  };
}

function getVerseOptions(book: string, chapter: number) {
  return getVerses(book, chapter).sort((left, right) => left - right);
}

function getDefaultVerseForChapter(book: string, chapter: number) {
  return getVerseOptions(book, chapter)[0] ?? 1;
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
  return {
    id: `verse-card-${verse}`,
    verse,
    text,
    x: 18 + index * 18,
    y: 24 + index * 20,
    scale: 1,
    rotation: Math.random() * 4 - 2,
  };
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
      };
    }

    return buildDefaultVerseCard(verseNumber, text, index);
  });
}

function estimateVerseCardHeight(text: string, lineHeight: number) {
  const words = text.split(' ').filter(Boolean);

  if (words.length === 0) {
    return 180;
  }

  let lineCount = 1;
  let currentLineLength = 0;

  words.forEach((word) => {
    const nextLength = currentLineLength === 0 ? word.length : currentLineLength + word.length + 1;

    if (nextLength > VERSE_CARD_ESTIMATED_LINE_WIDTH) {
      lineCount += 1;
      currentLineLength = word.length;
      return;
    }

    currentLineLength = nextLength;
  });

  return 92 + lineCount * (lineHeight + 2);
}

function DraggableSticker({
  sticker,
  isSelected,
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
            onSelect(sticker.id);
          }}
          style={styles.stickerPressTarget}>
          {isSelected ? (
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
                maxPointers={1}
                minDist={2}
                onGestureEvent={onResizeGestureEvent}
                onHandlerStateChange={onResizeStateChange}>
                <Animated.View style={styles.resizeHandleWrapper}>
                  <Pressable
                    hitSlop={12}
                    onPress={(event) => {
                      event.stopPropagation();
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
  shouldAutoFocus,
  onSelect,
  onDelete,
  onUpdate,
  onAutoFocusHandled,
  onFocus,
  onBlur,
}: DraggableNoteProps) {
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

  useEffect(() => {
    selectionScale.value = withTiming(isSelected ? 1.02 : 1, { duration: 140 });
  }, [isSelected, selectionScale]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const commitPosition = (x: number, y: number) => {
    onUpdate(note.id, { x, y });
  };

  const commitSize = (nextWidth: number, nextHeight: number) => {
    onUpdate(note.id, { width: nextWidth, height: nextHeight });
  };

  const onDragStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    'worklet';
    const { state, oldState } = event.nativeEvent;

    if (state === State.BEGAN) {
      startX.value = translateX.value;
      startY.value = translateY.value;
      runOnJS(dismissKeyboard)();
      runOnJS(onSelect)(note.id);
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
      startWidth.value = width.value;
      startHeight.value = height.value;
      runOnJS(dismissKeyboard)();
      runOnJS(onSelect)(note.id);
    }

    if (oldState === State.ACTIVE || state === State.END) {
      runOnJS(commitSize)(width.value, height.value);
    }
  };

  const onResizeGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    'worklet';
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
      maxPointers={1}
      minDist={6}
      waitFor={resizeHandleRef}
      onGestureEvent={onDragGestureEvent}
      onHandlerStateChange={onDragStateChange}>
      <Animated.View
        style={[
          styles.noteCard,
          animatedStyle,
          isSelected ? styles.selectedNoteCard : styles.unselectedNoteCard,
        ]}>
        {isSelected ? (
          <>
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
              maxPointers={1}
              minDist={2}
              onGestureEvent={onResizeGestureEvent}
              onHandlerStateChange={onResizeStateChange}>
              <Animated.View style={styles.noteResizeHandleWrapper}>
                <Pressable
                  hitSlop={12}
                  onPress={(event) => {
                    event.stopPropagation();
                    onSelect(note.id);
                  }}
                  style={styles.resizeHandle}>
                  <Feather name="arrow-down-right" size={15} color="#1F1F1F" />
                </Pressable>
              </Animated.View>
            </PanGestureHandler>
          </>
        ) : null}

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onSelect(note.id);
          }}
          style={styles.noteCardInner}>
          <TextInput
            autoFocus={shouldAutoFocus}
            multiline
            placeholder="Write your thoughts..."
            placeholderTextColor="#8F877F"
            style={styles.noteCardInput}
            value={note.text}
            onFocus={() => {
              onSelect(note.id);
              onFocus(note.id, note.y, note.height);
              if (shouldAutoFocus) {
                onAutoFocusHandled();
              }
            }}
            onBlur={() => {
              onBlur(note.id);
            }}
            onChangeText={(text) => onUpdate(note.id, { text })}
            textAlignVertical="top"
          />
        </Pressable>
      </Animated.View>
    </PanGestureHandler>
  );
}

function DraggableVerseCard({
  card,
  isActive,
  verseTypography,
  highlightedWords,
  onSelect,
  onUpdate,
  onToggleWordHighlight,
}: DraggableVerseCardProps) {
  const translateX = useSharedValue(card.x);
  const translateY = useSharedValue(card.y);
  const scale = useSharedValue(card.scale);
  const rotation = useSharedValue(card.rotation);
  const selectionScale = useSharedValue(isActive ? 1.02 : 1);
  const startX = useSharedValue(card.x);
  const startY = useSharedValue(card.y);
  const startScale = useSharedValue(card.scale);
  const startRotation = useSharedValue(card.rotation);
  const words = card.text.split(' ').filter(Boolean);

  useEffect(() => {
    translateX.value = card.x;
    translateY.value = card.y;
    scale.value = card.scale;
    rotation.value = card.rotation;
  }, [card.rotation, card.scale, card.x, card.y, rotation, scale, translateX, translateY]);

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
    onSelect(card.verse);
  };

  const panGesture = Gesture.Pan()
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

  const verseCardGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    rotationGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value * selectionScale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={verseCardGesture}>
      <Animated.View
        style={[styles.verseCard, animatedStyle, isActive && styles.selectedVerseCard]}>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
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

                  if (isActive) {
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
      </Animated.View>
    </GestureDetector>
  );
}

type FloatingItem =
  | { type: 'note'; zIndex: number; item: Note }
  | { type: 'sticker'; zIndex: number; item: Sticker };

type ToolbarMenu =
  | 'fonts'
  | 'size'
  | 'highlight'
  | 'stickers'
  | 'backgrounds'
  | null;

export default function StudioScreen() {
  const { colorTheme, language, t } = useAppSettings();
  const scrollViewRef = useRef<ScrollView>(null);
  const captureViewRef = useRef<View>(null);
  const lastAppliedDesignKeyRef = useRef<string | null>(null);
  const lastAppliedSelectionParamsRef = useRef<string | null>(null);
  const saveToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasBootstrappedSavedDesignsRef = useRef(false);
  const lastAutoSavedVerseDesignSignatureRef = useRef<string | null>(null);
  const router = useRouter();
  const route = useRoute<any>();
  const routeDesignParam =
    route.params?.design &&
    typeof route.params.design === 'object' &&
    route.params.design !== null
      ? (route.params.design as SavedVerseDesign)
      : null;
  const routeRestoreToken =
    typeof route.params?.restoreToken === 'string' ? route.params.restoreToken : null;
  const routeSelectedBookParam =
    typeof route.params?.selectedBook === 'string' ? route.params.selectedBook : null;
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
  const [selectedBook, setSelectedBook] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [selectedVerse, setSelectedVerse] = useState(0);
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
  const [autoFocusNoteId, setAutoFocusNoteId] = useState<string | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
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
  const [undoHistory, setUndoHistory] = useState<VerseEditorState[]>([]);
  const bookOptions = getBooks();
  const hasBookSelection = selectedBook.length > 0;
  const hasChapterSelection = hasBookSelection && selectedChapter > 0;
  const hasVerseSelection =
    hasChapterSelection && selectedVerse > 0 && selectedVerses.length > 0;
  const chapterOptions = hasBookSelection ? getChapters(selectedBook) : [];
  const verseOptions = hasChapterSelection ? getVerseOptions(selectedBook, selectedChapter) : [];
  const verseDropdownLabel =
    !hasVerseSelection
      ? 'Verse'
      : selectedVerses.length <= 1
      ? `Verse ${selectedVerse}`
      : `Verse ${selectedVerse} +${selectedVerses.length - 1}`;
  const normalizedSelectedVerses = useMemo(
    () =>
      hasVerseSelection
        ? normalizeSelectedVerses(selectedVerses, selectedVerse)
        : [],
    [hasVerseSelection, selectedVerse, selectedVerses]
  );
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
        estimateVerseCardHeight(card.text, verseLineHeight) * card.scale +
        56
    ),
    ...notes.map((note) => note.y + note.height + 56),
    ...stickers.map((sticker) => sticker.y + 96 * sticker.scale + 56)
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
  const toolbarMenuLabel = {
    fonts: { emoji: '✍️', label: 'Fonts' },
    size: { emoji: '🔤', label: 'Size' },
    highlight: { emoji: '🎨', label: 'Highlight' },
    stickers: { emoji: '🌸', label: 'Stickers' },
    backgrounds: { emoji: '✨', label: 'Backgrounds' },
  } as const;
  const floatingItems: FloatingItem[] = [
    ...notes.map((note) => ({ type: 'note' as const, zIndex: note.zIndex, item: note })),
    ...stickers.map((sticker) => ({
      type: 'sticker' as const,
      zIndex: sticker.zIndex,
      item: sticker,
    })),
  ].sort((left, right) => left.zIndex - right.zIndex);

  const [fontsLoaded] = useFonts({
    Playwrite: require('../../assets/fonts/PlaywriteDEGrund.ttf'),
  });
  const isCurrentVerseSaved = savedDesigns.some((design) => design.key === designKey);
  const saveToastOpacity = useSharedValue(0);
  const saveToastTranslateY = useSharedValue(12);
  const currentEditorState: VerseEditorState = useMemo(
    () => ({
      verseCards,
      stickers,
      notes,
      backgroundKey,
      selectedFont,
      fontSize,
      highlightedWords,
    }),
    [backgroundKey, fontSize, highlightedWords, notes, selectedFont, stickers, verseCards]
  );
  const selectedStudioBackground = getShopBackground(backgroundKey);

  const getHighestZIndex = () =>
    Math.max(
      0,
      ...stickers.map((sticker) => sticker.zIndex),
      ...notes.map((note) => note.zIndex)
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

  const applyEditorState = (state: VerseEditorState) => {
    const nextEditorState = cloneVerseEditorState(state);

    setVerseCards(nextEditorState.verseCards);
    setStickers(nextEditorState.stickers);
    setNotes(nextEditorState.notes);
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

  const undoLastEdit = () => {
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
    const sourceEditorState =
      verseState[nextDesignKey] ??
      fallbackEditorState ??
      DEFAULT_VERSE_EDITOR_STATE;
    const nextEditorState = cloneVerseEditorState(sourceEditorState);

    setSelectedVerse(nextActiveVerse);
    setSelectedVerses(nextSelectedVerses);
    setVerseCards(
      syncVerseCardsWithSelection(
        nextEditorState.verseCards,
        nextSelectedVerses,
        nextBook,
        nextChapter,
        language.key
      )
    );
    setStickers(nextEditorState.stickers);
    setNotes(nextEditorState.notes);
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

  const switchDisplayedVerses = (
    nextSelectedVersesInput: number[],
    nextActiveVerse: number,
    options?: {
      closeDropdown?: boolean;
    }
  ) => {
    const nextSelectedVerses = normalizeSelectedVerses(
      nextSelectedVersesInput,
      nextActiveVerse
    );
    const nextDesignKey = getDesignKey(
      selectedBook,
      selectedChapter,
      nextSelectedVerses
    );
    const fallbackEditorState: VerseEditorState = {
      ...cloneVerseEditorState(currentEditorState),
      verseCards: syncVerseCardsWithSelection(
        currentEditorState.verseCards,
        nextSelectedVerses,
        selectedBook,
        selectedChapter,
        language.key
      ),
    };

    if (hasVerseSelection) {
      setVerseState((current) => ({
        ...current,
        [designKey]: currentEditorState,
      }));
    }

    if (nextDesignKey === designKey) {
      setSelectedVerse(nextActiveVerse);
      setSelectedVerses(nextSelectedVerses);
      setVerseCards(fallbackEditorState.verseCards);
      setSelectedStickerId(null);
      setSelectedNoteId(null);
      setAutoFocusNoteId(null);
      setFocusedNoteId(null);
      setFocusedNoteTarget(null);
    } else {
      loadEditorStateForDesign(
        nextDesignKey,
        nextSelectedVerses,
        nextActiveVerse,
        selectedBook,
        selectedChapter,
        fallbackEditorState
      );
    }

    if (options?.closeDropdown ?? false) {
      setIsVerseDropdownOpen(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadStoredVerseState = async () => {
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
        setSelectedVerses([]);
        setVerseCards(DEFAULT_VERSE_EDITOR_STATE.verseCards);
        setStickers(DEFAULT_VERSE_EDITOR_STATE.stickers);
        setNotes(DEFAULT_VERSE_EDITOR_STATE.notes);
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
          (routeSelectedBookParam === selectedBook &&
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
          setSelectedVerses([]);
          setVerseCards(DEFAULT_VERSE_EDITOR_STATE.verseCards);
          setStickers(DEFAULT_VERSE_EDITOR_STATE.stickers);
          setNotes(DEFAULT_VERSE_EDITOR_STATE.notes);
          setBackgroundKey(DEFAULT_VERSE_EDITOR_STATE.backgroundKey);
          setSelectedFont(DEFAULT_VERSE_EDITOR_STATE.selectedFont);
          setFontSize(DEFAULT_VERSE_EDITOR_STATE.fontSize);
          setHighlightedWords(DEFAULT_VERSE_EDITOR_STATE.highlightedWords);
          setUndoHistory([]);
          return;
        }

        const routeSelectedVerses =
          routeDesignParam?.book === selectedBook
            ? normalizeSelectedVerses(
                routeDesignParam.selectedVerses ?? [routeDesignParam.verse],
                routeDesignParam.verse
              )
            : null;
        const fallbackChapter =
          selectedBook === DEFAULT_BOOK && bookChapters.includes(DEFAULT_CHAPTER)
            ? DEFAULT_CHAPTER
            : bookChapters[0] ?? 1;
        const initialChapter =
          routeDesignParam?.book === selectedBook
            ? routeDesignParam.chapter
            : routeSelectedBookParam === selectedBook &&
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
          routeDesignParam?.book === selectedBook
            ? routeDesignParam.verse
            : routeSelectedBookParam === selectedBook &&
                routeSelectedVerseParam !== null &&
                chapterVerses.includes(routeSelectedVerseParam)
              ? routeSelectedVerseParam
              : fallbackVerse;
        const initialSelectedVerses =
          routeSelectedVerses &&
          routeDesignParam?.chapter === initialChapter &&
          routeSelectedVerses.includes(initialVerse)
            ? routeSelectedVerses
            : [initialVerse];
        const initialDesignKey = getDesignKey(
          selectedBook,
          initialChapter,
          initialSelectedVerses
        );
        const initialVerseState = routeDesignParam?.book === selectedBook
          ? getVerseEditorStateFromDesign(routeDesignParam)
          : cloneVerseEditorState(
              savedVerseState[initialDesignKey] ?? DEFAULT_VERSE_EDITOR_STATE
            );

        setSelectedChapter(initialChapter);
        setSelectedVerse(initialVerse);
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
        setNotes(initialVerseState.notes);
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
    language.key,
    routeDesignParam,
    routeRestoreToken,
    routeSelectedBookParam,
    routeSelectedChapterParam,
    routeSelectedVerseParam,
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
      selectedFont,
      fontSize,
      highlightedWords,
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
        const savedValue = await AsyncStorage.getItem(SAVED_DESIGNS_STORAGE_KEY);

        if (!savedValue || !isMounted) {
          return;
        }

        const parsedValue = JSON.parse(savedValue) as unknown;

        if (!Array.isArray(parsedValue)) {
          return;
        }

        const normalizedDesigns = parsedValue.reduce<SavedVerseDesign[]>(
          (accumulator, item) => {
            if (typeof item !== 'object' || item === null) {
              return accumulator;
            }

            const candidate = item as Partial<SavedVerseDesign>;

            if (
              typeof candidate.key !== 'string' ||
              typeof candidate.book !== 'string' ||
              typeof candidate.chapter !== 'number' ||
              typeof candidate.verse !== 'number' ||
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
              book: candidate.book,
              chapter: candidate.chapter,
              verse: candidate.verse,
              selectedVerses: normalizeSelectedVerses(
                Array.isArray(candidate.selectedVerses)
                  ? candidate.selectedVerses.filter(
                      (verseNumber): verseNumber is number =>
                        typeof verseNumber === 'number'
                    )
                  : [candidate.verse],
                candidate.verse
              ),
              verseCards: Array.isArray(candidate.verseCards)
                ? (candidate.verseCards as VerseCard[])
                : [],
              stickers: candidate.stickers as Sticker[],
              notes: candidate.notes as Note[],
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
          const savedValue = await AsyncStorage.getItem(SAVED_DESIGNS_STORAGE_KEY);

          if (!savedValue) {
            setSavedDesigns([]);
            return;
          }

          const parsedValue = JSON.parse(savedValue) as SavedVerseDesign[];
          setSavedDesigns(Array.isArray(parsedValue) ? parsedValue : []);
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
    if (!hasLoadedSavedDesigns || !hasLoadedState || !isCurrentVerseSaved) {
      return;
    }

    setSavedDesigns((current) => {
      const existingIndex = current.findIndex((design) => design.key === designKey);

      if (existingIndex === -1) {
        return current;
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
    fontSize,
    hasLoadedState,
    hasLoadedSavedDesigns,
    highlightedWords,
    isCurrentVerseSaved,
    notes,
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
    if (!routeDesignParam) {
      return;
    }

    const d = routeDesignParam;
    const restoreToken =
      routeRestoreToken ?? d.key;

    if (!d) {
      return;
    }

    if (lastAppliedDesignKeyRef.current === restoreToken) {
      return;
    }

    lastAppliedDesignKeyRef.current = restoreToken;

    setSelectedBook(d.book);
    setSelectedChapter(d.chapter);
    setSelectedVerse(d.verse);
    const nextSelectedVerses = normalizeSelectedVerses(d.selectedVerses ?? [d.verse], d.verse);
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
    setStickers(d.stickers || []);
    setNotes(d.notes || []);
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
  }, [language.key, routeDesignParam, routeRestoreToken]);

  useEffect(() => {
    if (routeDesignParam) {
      return;
    }

    const nextBook = routeSelectedBookParam;
    const nextChapterParam = routeSelectedChapterParam;
    const nextVerseParam = routeSelectedVerseParam;
    const selectionParamsKey = `${nextBook ?? ''}:${nextChapterParam ?? ''}:${nextVerseParam ?? ''}`;

    if (!nextBook) {
      return;
    }

    if (lastAppliedSelectionParamsRef.current === selectionParamsKey) {
      return;
    }

    const bookChapters = getChapters(nextBook);
    const nextChapter =
      nextChapterParam !== null && bookChapters.includes(nextChapterParam)
        ? nextChapterParam
        : bookChapters[0] ?? 1;
    const chapterVerses = getVerseOptions(nextBook, nextChapter);
    const nextVerse =
      nextVerseParam !== null && chapterVerses.includes(nextVerseParam)
        ? nextVerseParam
        : getDefaultVerseForChapter(nextBook, nextChapter);
    const nextSelectedVerses = [nextVerse];
    const nextDesignKey = getDesignKey(nextBook, nextChapter, nextSelectedVerses);
    const nextVerseState = verseState[nextDesignKey] ?? DEFAULT_VERSE_EDITOR_STATE;
    const nextEditorState = cloneVerseEditorState(nextVerseState);

    lastAppliedDesignKeyRef.current = null;
    lastAppliedSelectionParamsRef.current = selectionParamsKey;

    setSelectedBook(nextBook);
    setSelectedChapter(nextChapter);
    setSelectedVerse(nextVerse);
    setSelectedVerses(nextSelectedVerses);
    setVerseCards(
      syncVerseCardsWithSelection(
        nextEditorState.verseCards,
        nextSelectedVerses,
        nextBook,
        nextChapter,
        language.key
      )
    );
    setStickers(nextEditorState.stickers);
    setNotes(nextEditorState.notes);
    setBackgroundKey(nextEditorState.backgroundKey ?? null);
    setHighlightedWords(nextEditorState.highlightedWords);
    setSelectedFont(nextEditorState.selectedFont);
    setFontSize(nextEditorState.fontSize);
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
  }, [
    language.key,
    routeDesignParam,
    routeSelectedBookParam,
    routeSelectedChapterParam,
    routeSelectedVerseParam,
    verseState,
  ]);

  const decreaseFontSize = () => {
    if (fontSize <= 14) {
      return;
    }

    recordUndoSnapshot();
    setFontSize((current) => Math.max(14, current - 2));
  };

  const increaseFontSize = () => {
    if (fontSize >= 26) {
      return;
    }

    recordUndoSnapshot();
    setFontSize((current) => Math.min(26, current + 2));
  };

  const addSticker = (emoji: string) => {
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
  };

  const addShopSticker = (imageKey: string) => {
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
  };

  const updateStudioBackground = (nextBackgroundKey: string | null) => {
    if (backgroundKey === nextBackgroundKey) {
      setOpenToolbarMenu(null);
      return;
    }

    recordUndoSnapshot();
    setBackgroundKey(nextBackgroundKey);
    setOpenToolbarMenu(null);
    setSelectedStickerId(null);
    setSelectedNoteId(null);
  };

  const addNote = () => {
    recordUndoSnapshot();

    const newNote: Note = {
      id: `${Date.now()}-${notes.length}`,
      text: '',
      x: 28 + notes.length * 18,
      y: 210 + notes.length * 18,
      width: 170,
      height: 120,
      zIndex: getHighestZIndex() + 1,
    };

    setNotes((prev) => [...prev, newNote]);
    setSelectedNoteId(newNote.id);
    setSelectedStickerId(null);
    setAutoFocusNoteId(newNote.id);

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  };

  const updateSticker = (id: number, updates: StickerUpdate) => {
    recordUndoSnapshot();

    setStickers((prev) =>
      prev.map((sticker) =>
        sticker.id === id ? { ...sticker, ...updates } : sticker
      )
    );
  };

  const updateNote = (id: string, updates: NoteUpdate) => {
    if (!('text' in updates) || Object.keys(updates).some((key) => key !== 'text')) {
      recordUndoSnapshot();
    }

    setNotes((prev) =>
      prev.map((note) =>
        note.id === id ? { ...note, ...updates } : note
      )
    );
  };

  const updateVerseCard = (id: string, updates: VerseCardUpdate) => {
    recordUndoSnapshot();

    setVerseCards((prev) =>
      prev.map((card) => (card.id === id ? { ...card, ...updates } : card))
    );
  };

  const selectVerseCard = (verseNumber: number) => {
    setSelectedVerse(verseNumber);
    setVerseCards((current) => {
      const selectedCard = current.find((card) => card.verse === verseNumber);

      if (!selectedCard) {
        return current;
      }

      return [
        ...current.filter((card) => card.verse !== verseNumber),
        selectedCard,
      ];
    });
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setFocusedNoteTarget(null);
  };

  const bringStickerToFront = (id: number) => {
    const nextZIndex = getHighestZIndex() + 1;

    setStickers((prev) =>
      prev.map((sticker) =>
        sticker.id === id ? { ...sticker, zIndex: nextZIndex } : sticker
      )
    );
  };

  const bringNoteToFront = (id: string) => {
    const nextZIndex = getHighestZIndex() + 1;

    setNotes((prev) =>
      prev.map((note) =>
        note.id === id ? { ...note, zIndex: nextZIndex } : note
      )
    );
  };

  const selectSticker = (id: number) => {
    bringStickerToFront(id);
    setSelectedStickerId(id);
    setSelectedNoteId(null);
    setFocusedNoteTarget(null);
  };

  const clearStickerSelection = () => {
    setSelectedStickerId(null);
  };

  const selectNote = (id: string) => {
    bringNoteToFront(id);
    setSelectedNoteId(id);
    setSelectedStickerId(null);
  };

  const deleteSticker = (id: number) => {
    recordUndoSnapshot();
    setStickers((prev) => prev.filter((sticker) => sticker.id !== id));
    setSelectedStickerId((current) => (current === id ? null : current));
  };

  const deleteNote = (id: string) => {
    recordUndoSnapshot();
    setNotes((prev) => prev.filter((note) => note.id !== id));
    setSelectedNoteId((current) => (current === id ? null : current));
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
        [designKey]: currentEditorState,
      }));
    }

    if (nextDesignKey === designKey) {
      setSelectedVerse(verseNumber);
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
      setAutoFocusNoteId(null);
      setFocusedNoteId(null);
      setFocusedNoteTarget(null);
    } else {
      loadEditorStateForDesign(nextDesignKey, nextSelectedVerses, verseNumber);
    }

    if (options?.closeDropdown ?? true) {
      setIsVerseDropdownOpen(false);
    }
  };

  const handleVerseSelect = (verseNumber: number) => {
    if (!hasChapterSelection) {
      return;
    }

    const nextSelectedVerses = selectedVerses.includes(verseNumber)
      ? selectedVerses
      : [...selectedVerses, verseNumber].sort((left, right) => left - right);

    activateVerse(verseNumber, {
      nextSelectedVerses,
      closeDropdown: true,
    });
  };

  const toggleDisplayedVerse = (verseNumber: number) => {
    if (!hasChapterSelection) {
      return;
    }

    const isCurrentlySelected = selectedVerses.includes(verseNumber);

    if (!isCurrentlySelected) {
      const nextSelectedVerses = [...selectedVerses, verseNumber].sort(
        (left, right) => left - right
      );
      switchDisplayedVerses(nextSelectedVerses, verseNumber, {
        closeDropdown: false,
      });
      return;
    }

    if (selectedVerses.length === 1) {
      return;
    }

    const nextSelectedVerses = selectedVerses.filter(
      (currentVerseNumber) => currentVerseNumber !== verseNumber
    );

    if (verseNumber === selectedVerse) {
      switchDisplayedVerses(nextSelectedVerses, nextSelectedVerses[0], {
        closeDropdown: false,
      });
      return;
    }

    switchDisplayedVerses(nextSelectedVerses, selectedVerse, {
      closeDropdown: false,
    });
  };

  const resetCurrentDesign = () => {
    const nextEditorState = cloneVerseEditorState(DEFAULT_VERSE_EDITOR_STATE);

    if (hasVerseSelection) {
      setVerseState((current) => ({
        ...current,
        [designKey]: nextEditorState,
      }));
    }
    setVerseCards(nextEditorState.verseCards);
    setStickers(nextEditorState.stickers);
    setNotes(nextEditorState.notes);
    setBackgroundKey(nextEditorState.backgroundKey ?? null);
    setSelectedBook('');
    setSelectedChapter(0);
    setSelectedVerse(0);
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
    setUndoHistory([]);
    if (hasVerseSelection) {
      void removeVerseDesignSnapshot(selectedBook, designKey);
    }
    showSaveToast(t('studioStartOverToast'));
  };

  const handleBackToVerseDesigns = async () => {
    Keyboard.dismiss();
    setSelectedStickerId(null);
    setSelectedNoteId(null);
    setAutoFocusNoteId(null);
    setFocusedNoteId(null);
    setFocusedNoteTarget(null);
    setOpenToolbarMenu(null);
    setIsBookDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsVerseDropdownOpen(false);

    if (hasVerseSelection && isVerseDesignDecorated(currentEditorState)) {
      const nextVerseState: VerseStateMap = {
        ...verseState,
        [designKey]: currentEditorState,
      };

      setVerseState(nextVerseState);

      try {
        await saveVerseStateMap(selectedBook, nextVerseState);
        await saveVerseDesignSnapshot(selectedBook, designKey, currentEditorState);
      } catch (error) {
        console.warn('Failed to auto-save verse design before leaving Studio', error);
      }
    }

    router.push('/verse-designs' as never);
  };

  const handleBookSelect = (book: string) => {
    if (hasVerseSelection) {
      setVerseState((current) => ({
        ...current,
        [designKey]: currentEditorState,
      }));
    }

    const nextChapter = getChapters(book)[0] ?? 0;
    const nextEditorState = cloneVerseEditorState(DEFAULT_VERSE_EDITOR_STATE);

    setSelectedBook(book);
    setSelectedChapter(nextChapter);
    setSelectedVerse(0);
    setSelectedVerses([]);
    setVerseCards(nextEditorState.verseCards);
    setStickers(nextEditorState.stickers);
    setNotes(nextEditorState.notes);
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
    if (!hasBookSelection) {
      return;
    }

    if (hasVerseSelection) {
      setVerseState((current) => ({
        ...current,
        [designKey]: currentEditorState,
      }));
    }

    const nextEditorState = cloneVerseEditorState(DEFAULT_VERSE_EDITOR_STATE);

    setSelectedChapter(chapterNumber);
    setSelectedVerse(0);
    setSelectedVerses([]);
    setVerseCards(nextEditorState.verseCards);
    setStickers(nextEditorState.stickers);
    setNotes(nextEditorState.notes);
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

  const toggleToolbarMenu = (menu: Exclude<ToolbarMenu, null>) => {
    setOpenToolbarMenu((current) => (current === menu ? null : menu));
    setIsBookDropdownOpen(false);
    setIsChapterDropdownOpen(false);
    setIsVerseDropdownOpen(false);
  };

  const selectFont = (font: string) => {
    if (selectedFont !== font) {
      recordUndoSnapshot();
    }

    setSelectedFont(font);
    setOpenToolbarMenu(null);
  };

  const toggleFavorite = async () => {
    if (!hasVerseSelection) {
      return;
    }

    try {
      const existingData = await AsyncStorage.getItem(SAVED_DESIGNS_STORAGE_KEY);
      const favorites = existingData ? (JSON.parse(existingData) as SavedVerseDesign[]) : [];
      const index = favorites.findIndex((favorite) => favorite.key === designKey);

      if (index !== -1) {
        const nextFavorites = favorites.filter((favorite) => favorite.key !== designKey);
        setSavedDesigns(nextFavorites);
        await AsyncStorage.setItem(
          SAVED_DESIGNS_STORAGE_KEY,
          JSON.stringify(nextFavorites)
        );
        return;
      }

      const newItem: SavedVerseDesign = {
        key: designKey,
        book: selectedBook,
        chapter: selectedChapter,
        verse: selectedVerse,
        selectedVerses: normalizedSelectedVerses,
        verseCards: verseCards.map((verseCard) => ({ ...verseCard })),
        stickers: stickers.map((sticker) => ({ ...sticker })),
        notes: notes.map((note) => ({ ...note })),
        backgroundKey,
        highlights: { ...highlightedWords },
        selectedFont,
        fontSize,
        savedAt: new Date().toISOString(),
      };

      favorites.push(newItem);

      setSavedDesigns(favorites);
      await AsyncStorage.setItem(SAVED_DESIGNS_STORAGE_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.log('Save error', error);
    }
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

  if (!fontsLoaded) return null;

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
      const permission = await MediaLibrary.requestPermissionsAsync();

      if (!permission.granted) {
        return;
      }

      await MediaLibrary.saveToLibraryAsync(imageUri);
      showSaveToast('Saved to camera roll 💖');
    } catch (error) {
      console.warn('Failed to save verse image', error);
    }
  };

  const shareViaSMS = async () => {
    await handleShareImage();
  };

  return (
    <KeyboardAvoidingView
      style={styles.screenPressable}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.screenPressable}
        scrollEnabled={!isBookDropdownOpen && !isChapterDropdownOpen && !isVerseDropdownOpen}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 32 : 32 },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
        <View style={styles.headerSection}>
          <View style={styles.titleRow}>
            <View style={styles.titleGroup}>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  void handleBackToVerseDesigns();
                }}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel={t('studioBackToDesigns')}>
                <Ionicons name="chevron-back" size={22} color="#5B514D" />
              </Pressable>
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.title}>
                {hasVerseSelection
                  ? `${selectedBook} ${selectedChapter}:${selectedVerse}`
                  : 'Choose a verse'}
              </Text>
            </View>

            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                void toggleFavorite();
              }}
                style={[
                  styles.saveDesignButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  isCurrentVerseSaved
                    ? [
                        styles.saveDesignButtonActive,
                        {
                          backgroundColor: colorTheme.selectionBackground,
                          borderColor: colorTheme.border,
                        },
                      ]
                    : null,
                ]}
              accessibilityRole="button"
              accessibilityLabel={isCurrentVerseSaved ? 'Unsave verse design' : 'Save verse design'}>
              <Ionicons
                name={isCurrentVerseSaved ? 'heart' : 'heart-outline'}
                size={22}
                color={isCurrentVerseSaved ? '#C05A67' : '#5B514D'}
              />
            </Pressable>
          </View>

          <View style={styles.controlsHeaderRow}>
            <View style={styles.bookDropdownContainer}>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setIsBookDropdownOpen((current) => !current);
                  setIsChapterDropdownOpen(false);
                  setIsVerseDropdownOpen(false);
                }}
                style={[
                  styles.bookDropdownButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                ]}>
                <Text numberOfLines={1} style={styles.bookDropdownButtonText}>
                  {selectedBook || 'Book'}
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
                ]}>
                <Text style={styles.chapterDropdownButtonText}>
                  {hasChapterSelection ? selectedChapter : 'Chapter'}
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
                          {`Chapter ${chapterNumber}`}
                        </Text>
                      </Pressable>
                    ))}
                  </GestureHandlerScrollView>
                </View>
              ) : null}
            </View>

            <View style={styles.verseDropdownContainer}>
              <Pressable
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
                ]}>
                <Text style={styles.verseDropdownButtonText}>
                  {verseDropdownLabel}
                </Text>
                <Text style={styles.verseDropdownChevron}>▼</Text>
              </Pressable>

              {isVerseDropdownOpen ? (
                <View
                  style={[
                    styles.verseDropdownMenu,
                    {
                      backgroundColor: colorTheme.screenBackground,
                      borderColor: colorTheme.border,
                    },
                  ]}>
                  <GestureHandlerScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled">
                    {verseOptions.map((verseNumber) => (
                      <Pressable
                        key={verseNumber}
                        onPress={(event) => {
                          event.stopPropagation();

                          if (selectedVerses.includes(verseNumber)) {
                            handleVerseSelect(verseNumber);
                            return;
                          }

                          toggleDisplayedVerse(verseNumber);
                        }}
                        style={[
                          styles.verseDropdownOption,
                          selectedVerse === verseNumber
                            ? [
                                styles.verseDropdownOptionSelected,
                                { backgroundColor: colorTheme.selectionBackground },
                              ]
                            : null,
                        ]}>
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation();
                            toggleDisplayedVerse(verseNumber);
                          }}
                          style={styles.verseDropdownCheckboxButton}
                          hitSlop={10}>
                          <Ionicons
                            name={
                              selectedVerses.includes(verseNumber)
                                ? 'checkbox'
                                : 'square-outline'
                            }
                            size={18}
                            color={
                              selectedVerses.includes(verseNumber)
                                ? '#C05A67'
                                : '#9A8F88'
                            }
                            style={styles.verseDropdownOptionCheckbox}
                          />
                        </Pressable>

                        <View style={styles.verseDropdownOptionLabelButton}>
                          <Text
                            style={[
                              styles.verseDropdownOptionText,
                              selectedVerse === verseNumber &&
                                styles.verseDropdownOptionTextSelected,
                            ]}>
                            {`Verse ${verseNumber}`}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </GestureHandlerScrollView>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.toolbarSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dropdownToolbarRow}
            keyboardShouldPersistTaps="handled">
            {(['fonts', 'size', 'highlight', 'stickers', 'backgrounds'] as const).map((menu) => (
              <Pressable
                key={menu}
                onPress={(event) => {
                  event.stopPropagation();
                  toggleToolbarMenu(menu);
                }}
                style={[
                  styles.dropdownToolbarButton,
                  { backgroundColor: colorTheme.toolbarBackground },
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
                  <Text style={styles.dropdownToolbarEmoji}>
                    {toolbarMenuLabel[menu].emoji}
                  </Text>
                  <Text style={styles.dropdownToolbarButtonText}>
                    {toolbarMenuLabel[menu].label}
                  </Text>
                  <Text style={styles.dropdownToolbarChevron}>▼</Text>
                </View>
              </Pressable>
            ))}

              <TouchableOpacity
                onPress={undoLastEdit}
                disabled={undoHistory.length === 0}
                style={[
                  styles.undoButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  undoHistory.length === 0 ? styles.undoButtonDisabled : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Undo last edit">
                <Ionicons name="arrow-undo-outline" size={19} color="#5B514D" />
                <Text style={styles.undoButtonText}>Undo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={addNote}
                style={[
                  styles.noteButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                ]}>
                <View style={styles.dropdownToolbarButtonContent}>
                  <Text style={styles.dropdownToolbarEmoji}>📝</Text>
                  <Text style={styles.noteButtonText}>Note</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={resetCurrentDesign}
                style={[
                  styles.resetButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('studioStartOver')}>
                <Ionicons name="refresh-outline" size={19} color="#5B514D" />
                <Text style={styles.resetButtonText}>{t('studioStartOver')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  void handleSaveImage();
                }}
                style={[
                  styles.shareButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  isSharingImage && styles.shareImageButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={isSharingImage ? 'Saving image' : 'Save image'}>
                <Ionicons name="download-outline" size={21} color="#333" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  void shareViaSMS();
                }}
                style={[
                  styles.shareButton,
                  { backgroundColor: colorTheme.toolbarBackground },
                  isSharingImage && styles.shareImageButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={isSharingImage ? 'Sharing image' : 'Share image'}>
                <Ionicons name="share-outline" size={22} color="#333" />
              </TouchableOpacity>
          </ScrollView>

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
                  <Pressable
                    onPress={() => {
                      selectFont('Playwrite');
                    }}
                    style={[
                      styles.dropdownOptionButton,
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
              ) : null}

              {openToolbarMenu === 'size' ? (
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
              ) : null}

              {openToolbarMenu === 'highlight' ? (
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
              ) : null}

              {openToolbarMenu === 'stickers' ? (
                <ScrollView
                  style={styles.stickerDropdownScroll}
                  contentContainerStyle={styles.stickerDropdownContent}
                  showsVerticalScrollIndicator={false}>
                  <Text style={styles.stickerPackLabel}>Quick stickers</Text>
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
                              source={shopSticker.image}
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
                  <Text style={styles.stickerPackLabel}>Basic</Text>
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
                      <Text style={styles.backgroundButtonText}>Lined</Text>
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
                              source={backgroundOption.image}
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
                onPress={clearStickerSelection}
                style={[
                  styles.captureStage,
                  { minHeight: contentStageMinHeight },
                ]}>
                <View pointerEvents="box-none" style={styles.verseCardsLayer}>
                  {verseCards.map((card) => (
                    <DraggableVerseCard
                      key={card.id}
                      card={card}
                      isActive={card.verse === selectedVerse}
                      verseTypography={verseTypography}
                      highlightedWords={highlightedWords}
                      onSelect={selectVerseCard}
                      onUpdate={updateVerseCard}
                      onToggleWordHighlight={toggleWordHighlight}
                    />
                  ))}
                </View>

                <View pointerEvents="box-none" style={styles.floatingLayer}>
                  {floatingItems.map((floatingItem) =>
                    floatingItem.type === 'note' ? (
                      <DraggableNote
                        key={`note-${floatingItem.item.id}`}
                        note={floatingItem.item}
                        isSelected={floatingItem.item.id === selectedNoteId}
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
                        onDelete={deleteSticker}
                        onSelect={selectSticker}
                        onUpdate={updateSticker}
                      />
                    )
                  )}
                </View>
              </Pressable>
              </View>
              </View>
            </View>
          </View>
        </View>
        </View>
      </ScrollView>

      {focusedNoteId ? (
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setFocusedNoteId(null);
          }}
          style={styles.keyboardDoneButton}>
          <Text style={styles.keyboardDoneButtonText}>Done</Text>
        </Pressable>
      ) : null}

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
    backgroundColor: '#FFFDF9',
    padding: 20,
  },
  headerSection: {
    marginTop: Platform.OS === 'web' ? 24 : 56,
    marginBottom: 10,
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
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  controlsHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    paddingLeft: 0,
    paddingRight: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  shareImageButtonDisabled: {
    opacity: 0.65,
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
    width: '100%',
  },
  bookDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3EDE8',
  },
  bookDropdownButtonText: {
    color: '#1F1F1F',
    fontSize: 15,
    flex: 1,
  },
  bookDropdownChevron: {
    color: '#1F1F1F',
    fontSize: 12,
  },
  bookDropdownMenu: {
    position: 'absolute',
    top: 50,
    left: 0,
    width: '100%',
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
    flex: 1,
    minWidth: 0,
  },
  chapterDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3EDE8',
  },
  chapterDropdownButtonText: {
    color: '#1F1F1F',
    fontSize: 15,
    flexShrink: 1,
  },
  chapterDropdownChevron: {
    color: '#1F1F1F',
    fontSize: 12,
  },
  chapterDropdownMenu: {
    position: 'absolute',
    top: 50,
    left: 0,
    width: '100%',
    minWidth: 0,
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
    flex: 1,
    minWidth: 0,
  },
  verseDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3EDE8',
  },
  verseDropdownButtonText: {
    color: '#1F1F1F',
    fontSize: 15,
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
    marginTop: 10,
    marginBottom: 8,
    zIndex: 15,
  },
  toolbarDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 8,
  },
  dropdownToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  dropdownToolbarButton: {
    minWidth: 88,
    minHeight: 44,
    paddingHorizontal: 15,
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
  dropdownToolbarButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownToolbarEmoji: {
    fontSize: 16,
    lineHeight: 20,
    marginRight: 6,
  },
  dropdownToolbarButtonText: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  dropdownToolbarChevron: {
    color: '#1F1F1F',
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 6,
  },
  dropdownPanel: {
    marginTop: 10,
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
  verseCardsLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  verseCard: {
    position: 'absolute',
    width: 292,
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 22,
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
    minHeight: 44,
    paddingHorizontal: 15,
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
  noteButtonText: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  undoButton: {
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
  undoButtonDisabled: {
    opacity: 0.45,
  },
  undoButtonText: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    marginLeft: 6,
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
    backgroundColor: '#FFF8DC',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  selectedNoteCard: {
    borderWidth: 1,
    borderColor: '#D8C9A3',
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
  noteCardInput: {
    flex: 1,
    color: '#4D433D',
    fontSize: 15,
    letterSpacing: -0.6,
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 0,
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
