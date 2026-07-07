import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  PanGestureHandler,
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
import { EncryptedCloudSaveAction } from '@/components/encrypted-cloud-save-action';
import { SaveConfirmationToast } from '@/components/save-confirmation-toast';
import { useAppSettings } from '@/utils/app-settings';
import {
  getShopBackground,
  TEST_UNLOCKED_BACKGROUND_PACKS,
} from '@/utils/shop-backgrounds';
import {
  getShopSticker,
  getShopStickerDisplaySize,
  TEST_UNLOCKED_STICKER_PACKS,
} from '@/utils/shop-stickers';
import {
  PRAYER_SECTION_KEYS,
  localizeJournalSections,
} from '@/utils/journal-localization';
import { formatEntryDateTime } from '@/utils/date-time';
import { JOURNAL_INDEX_KEY } from '@/utils/storage-keys';

type PrayerSection = {
  id: string;
  label: string;
  text: string;
};

type PrayerBackground = 'lined' | 'plain' | (string & {});

type PrayerSticker = {
  id: string;
  uri: string;
  imageKey?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
};

type PrayerEntry = {
  id: string;
  type: 'prayer';
  date: string;
  sections: PrayerSection[];
  stickers: PrayerSticker[];
  background: PrayerBackground;
  preview: string;
  isFavorite: boolean;
  updatedAt: number;
};

type PrayerUndoSnapshot = {
  sections: PrayerSection[];
  stickers: PrayerSticker[];
  background: PrayerBackground;
  sectionAccent: string;
};

const SHOP_BACKGROUND_PREFIX = 'shop:';
const generateId = () => Date.now().toString();

function getPrayerBackgroundValue(backgroundKey: string) {
  return `${SHOP_BACKGROUND_PREFIX}${backgroundKey}`;
}

function getPrayerBackgroundKey(background: PrayerBackground) {
  return background.startsWith(SHOP_BACKGROUND_PREFIX)
    ? background.slice(SHOP_BACKGROUND_PREFIX.length)
    : null;
}
const getFormattedDate = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const getFormattedTime = () =>
  new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

const getFormattedDateStamp = () =>
  `${getFormattedDate()} • ${getFormattedTime()}`;

const normalizeEntryDate = (value?: string) =>
  value ? formatEntryDateTime(value) : getFormattedDateStamp();

type DraggablePrayerStickerProps = {
  isSelected: boolean;
  sticker: PrayerSticker;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<PrayerSticker, 'x' | 'y' | 'scale'>>) => void;
};

const STICKER_CHOICES = ['🌸', '💖', '✨', '🕊️', '🌿', '⭐️'] as const;
const JOURNAL_TOOLBAR_ICONS = {
  text: require('../assets/images/toolbar-icons/text-tight.png'),
  canvas: require('../assets/images/toolbar-icons/canvas-tight.png'),
  decor: require('../assets/images/toolbar-icons/decor-tight.png'),
  note: require('../assets/images/toolbar-icons/notes-tight.png'),
  more: require('../assets/images/toolbar-icons/more-tight.png'),
} as const;
const HEADER_ICON = require('../assets/images/toolbar-icons/journal-prayer.png');
const MIN_STICKER_SCALE = 0.35;
const MAX_STICKER_SCALE = 2.2;
const MIN_INPUT_HEIGHT = 72;

const defaultSections: PrayerSection[] = [
  { id: '1', label: 'What I’m praying for:', text: '' },
  { id: '2', label: 'What I’m thankful for:', text: '' },
  { id: '3', label: 'What’s on my heart:', text: '' },
  { id: '4', label: 'Give me peace about:', text: '' },
  { id: '5', label: 'Answered prayers:', text: '' },
];

function getLatestWebSections(sections: PrayerSection[]) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return sections;
  }

  const values = Array.from(document.querySelectorAll('textarea'))
    .map((textarea) => (textarea as HTMLTextAreaElement).value);

  if (values.length < sections.length) {
    return sections;
  }

  return sections.map((section, index) => {
    const value = values[index];
    return { ...section, text: value || section.text };
  });
}

type PrayerSectionFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onFocusField: () => void;
  placeholder: string;
  cardBackground: string;
  accentColor: string;
};

const PrayerSectionField = memo(function PrayerSectionField({
  label,
  value,
  onChangeText,
  onFocusField,
  placeholder,
  cardBackground,
  accentColor,
}: PrayerSectionFieldProps) {
  const [draftText, setDraftText] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isFocused) {
      return;
    }

    if (value.length > 0 || draftText.length === 0) {
      setDraftText(value);
    }
  }, [draftText.length, isFocused, value]);

  const handleTextChange = (text: string) => {
    setDraftText(text);
    onChangeText(text);
  };

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: cardBackground, borderLeftColor: accentColor },
      ]}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.prayerInputWrapper}>
        <Text pointerEvents="none" style={styles.inputMeasure}>
          {draftText.length ? `${draftText}\n` : ' '}
        </Text>
        <TextInput
          multiline
          placeholder={placeholder}
          placeholderTextColor="#A79B92"
          scrollEnabled={false}
          blurOnSubmit={false}
          style={styles.inputOverlay}
          textAlignVertical="top"
          value={draftText}
          onFocus={() => {
            setIsFocused(true);
            onFocusField();
          }}
          onBlur={(event) => {
            const text = (event.target as unknown as { value?: string }).value;
            if (typeof text === 'string') {
              handleTextChange(text);
            }
            if (Platform.OS !== 'web') {
              setIsFocused(false);
            }
          }}
          onPressIn={onFocusField}
          onChange={(event) => {
            const text =
              event.nativeEvent.text ??
              (event.target as unknown as { value?: string }).value;
            if (typeof text === 'string') {
              handleTextChange(text);
            }
          }}
          onChangeText={handleTextChange}
          {...(Platform.OS === 'web'
            ? {
                onInput: (event: { currentTarget?: { value?: string }; target?: { value?: string } }) => {
                  const text = event.currentTarget?.value ?? event.target?.value;
                  if (typeof text === 'string') {
                    handleTextChange(text);
                  }
                },
              }
            : null)}
        />
      </View>
    </View>
  );
});

function buildPreview(sections: PrayerSection[]) {
  return sections
    .map((section) => section.text.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 80);
}

function normalizeLoadedSectionText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/g, '');
}

function normalizeLoadedSections(sections: PrayerSection[]) {
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const normalizedDefaultSections = defaultSections.map((section) => {
    const savedSection = sectionsById.get(section.id);

    return {
      ...section,
      text:
        savedSection && typeof savedSection.text === 'string'
          ? normalizeLoadedSectionText(savedSection.text)
          : '',
    };
  });

  const customSections = sections.filter(
    (section) => !defaultSections.some((defaultSection) => defaultSection.id === section.id)
  );

  return [
    ...normalizedDefaultSections,
    ...customSections.map((section) => ({
      ...section,
      text:
        typeof section.text === 'string'
          ? normalizeLoadedSectionText(section.text)
          : '',
    })),
  ];
}

function DraggablePrayerSticker({
  sticker,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
}: DraggablePrayerStickerProps) {
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

  const handleSelect = () => {
    onSelect(sticker.id);
  };

  const commitPosition = (x: number, y: number) => {
    onUpdate(sticker.id, { x, y });
  };

  const commitScale = (nextScale: number) => {
    onUpdate(sticker.id, { scale: nextScale });
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

    scale.value = Math.min(
      Math.max(startScale.value + scaleDelta, MIN_STICKER_SCALE),
      MAX_STICKER_SCALE
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    zIndex: sticker.zIndex,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value * selectionScale.value },
      { rotate: `${sticker.rotation}deg` },
    ],
  }));

  return (
    <PanGestureHandler
      maxPointers={1}
      minDist={4}
      waitFor={resizeHandleRef}
      onGestureEvent={onDragGestureEvent}
      onHandlerStateChange={onDragStateChange}>
      <Animated.View
        style={[
          styles.sticker,
          animatedStyle,
          isSelected ? styles.selectedSticker : null,
        ]}>
        <Pressable
          onPress={() => onSelect(sticker.id)}
          style={styles.stickerPressTarget}>
          {isSelected ? (
            <>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onDelete(sticker.id)}
                style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>X</Text>
              </TouchableOpacity>

              <PanGestureHandler
                ref={resizeHandleRef}
                maxPointers={1}
                minDist={2}
                onGestureEvent={onResizeGestureEvent}
                onHandlerStateChange={onResizeStateChange}>
                <Animated.View style={styles.resizeHandleWrapper}>
                  <Pressable
                    hitSlop={12}
                    onPress={() => onSelect(sticker.id)}
                    style={styles.resizeHandle}>
                    <Text style={styles.resizeHandleIcon}>↘</Text>
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
                getShopStickerDisplaySize(getShopSticker(sticker.imageKey)!, 142),
              ]}
            />
          ) : (
            <Text style={styles.stickerEmoji}>{sticker.uri}</Text>
          )}
        </Pressable>
      </Animated.View>
    </PanGestureHandler>
  );
}

export default function PrayerJournalScreen() {
  const { colorTheme, t } = useAppSettings();
  const router = useRouter();
  const { entryId, newEntryToken } = useLocalSearchParams<{
    entryId?: string;
    newEntryToken?: string;
  }>();
  const today = useMemo(() => getFormattedDateStamp(), []);
  const draftEntryId = entryId ?? newEntryToken;
  const [currentId, setCurrentId] = useState(() => draftEntryId ?? generateId());
  const [entryDate, setEntryDate] = useState(today);
  const [sections, setSections] = useState<PrayerSection[]>(defaultSections);
  const sectionsRef = useRef<PrayerSection[]>(defaultSections);
  const [stickers, setStickers] = useState<PrayerSticker[]>([]);
  const [background, setBackground] = useState<PrayerBackground>('lined');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [openTray, setOpenTray] = useState<'text' | 'stickers' | 'background' | 'more' | null>(null);
  const [sectionAccent, setSectionAccent] = useState('#E8BFCF');
  const [undoHistory, setUndoHistory] = useState<PrayerUndoSnapshot[]>([]);
  const [sectionsHeight, setSectionsHeight] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [saveConfirmationMessage, setSaveConfirmationMessage] = useState('Saved!');
  const [saveConfirmationKey, setSaveConfirmationKey] = useState(0);
  const canvasRef = useRef<View>(null);

  const showSaveConfirmation = (message = 'Saved!') => {
    setSaveConfirmationMessage(message);
    setSaveConfirmationKey((current) => current + 1);
  };

  const highestStickerDepth = useMemo(
    () => Math.max(0, ...stickers.map((sticker) => sticker.zIndex)),
    [stickers]
  );

  const canvasMinHeight = useMemo(
    () =>
      Math.max(
        540,
        sectionsHeight + 48,
        ...stickers.map((sticker) => sticker.y + 120 * sticker.scale)
      ),
    [sectionsHeight, stickers]
  );
  const selectedPrayerBackground = getShopBackground(getPrayerBackgroundKey(background));

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }

    const captureLatestSections = () => {
      sectionsRef.current = getLatestWebSections(sectionsRef.current);
    };

    document.addEventListener('pointerdown', captureLatestSections, true);
    return () => document.removeEventListener('pointerdown', captureLatestSections, true);
  }, []);

  const updateIndex = useCallback(async (entry: PrayerEntry) => {
    try {
      const existingIndex = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
      const parsedIndex = existingIndex
        ? (JSON.parse(existingIndex) as PrayerEntry[])
        : [];

      const nextIndex = parsedIndex.some((item) => item.id === entry.id)
        ? parsedIndex.map((item) => (item.id === entry.id ? entry : item))
        : [entry, ...parsedIndex];

      nextIndex.sort((left, right) => right.updatedAt - left.updatedAt);

      await AsyncStorage.setItem(JOURNAL_INDEX_KEY, JSON.stringify(nextIndex));
    } catch (error) {
      console.log('Error updating journal index:', error);
    }
  }, []);

  const saveEntry = useCallback(
    async (
      nextSections: PrayerSection[],
      nextStickers: PrayerSticker[],
      nextBackground: PrayerBackground
    ) => {
      const id = entryId ?? newEntryToken ?? currentId ?? generateId();

      if (!currentId) {
        setCurrentId(id);
      }

      const entry: PrayerEntry = {
        id,
        type: 'prayer',
        date: entryDate,
        sections: nextSections,
        stickers: nextStickers,
        background: nextBackground,
        preview: buildPreview(nextSections),
        isFavorite,
        updatedAt: Date.now(),
      };

      try {
        await AsyncStorage.setItem(
          `journal_prayer_${id}`,
          JSON.stringify(entry)
        );

        await updateIndex(entry);
      } catch (error) {
        console.log('Error saving journal:', error);
      }
    },
    [currentId, entryDate, entryId, isFavorite, newEntryToken, updateIndex]
  );

  const recordUndoSnapshot = useCallback(() => {
    setUndoHistory((currentHistory) => [
      ...currentHistory.slice(-19),
      { sections, stickers, background, sectionAccent },
    ]);
  }, [background, sectionAccent, sections, stickers]);

  const undoLastEdit = useCallback(() => {
    setUndoHistory((currentHistory) => {
      const previous = currentHistory[currentHistory.length - 1];

      if (!previous) {
        return currentHistory;
      }

      setSections(previous.sections);
      setStickers(previous.stickers);
      setBackground(previous.background);
      setSectionAccent(previous.sectionAccent);
      setSelectedStickerId(null);
      setOpenTray(null);
      saveEntry(previous.sections, previous.stickers, previous.background);

      return currentHistory.slice(0, -1);
    });
  }, [saveEntry]);

  useEffect(() => {
    const loadEntry = async () => {
      try {
        const storageEntryId = entryId ?? newEntryToken;

        if (storageEntryId) {
          const storedEntry = await AsyncStorage.getItem(`journal_prayer_${storageEntryId}`);

          if (storedEntry) {
            const parsedEntry = JSON.parse(storedEntry) as PrayerEntry;

            if (typeof parsedEntry.id === 'string') {
              setCurrentId(parsedEntry.id);
            }

            if (typeof parsedEntry.date === 'string') {
              setEntryDate(normalizeEntryDate(parsedEntry.date));
            }

            if (Array.isArray(parsedEntry.sections)) {
              const loadedSections = normalizeLoadedSections(parsedEntry.sections);
              sectionsRef.current = loadedSections;
              setSections(loadedSections);
            }

            if (Array.isArray(parsedEntry.stickers)) {
              setStickers(parsedEntry.stickers);
            }

            setIsFavorite(Boolean(parsedEntry.isFavorite));

            if (typeof parsedEntry.background === 'string') {
              setBackground(parsedEntry.background);
            }

            setUndoHistory([]);
            return;
          }
        }

        if (!entryId) {
          const nextId = newEntryToken ?? generateId();
          const nextDate = getFormattedDateStamp();

          setCurrentId(nextId);
          setEntryDate(nextDate);
          sectionsRef.current = defaultSections;
          setSections(defaultSections);
          setStickers([]);
          setBackground('lined');
          setIsFavorite(false);
          setSelectedStickerId(null);
          setOpenTray(null);
          setUndoHistory([]);

          return;
        }
      } catch (error) {
        console.log('Error loading journal:', error);
      }
    };

    loadEntry();
  }, [entryId, newEntryToken, today, updateIndex]);

  const updateSection = (index: number, text: string) => {
    recordUndoSnapshot();
    setSections((currentSections) => {
      const updatedSections = currentSections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, text } : section
      );

      sectionsRef.current = updatedSections;
      saveEntry(updatedSections, stickers, background);
      return updatedSections;
    });
  };

  const addNoteSection = () => {
    recordUndoSnapshot();
    const updatedSections = [
      { id: generateId(), label: t('editorNote'), text: '' },
      ...sections,
    ];
    sectionsRef.current = updatedSections;
    setSections(updatedSections);
    setOpenTray(null);
    saveEntry(updatedSections, stickers, background);
  };

  const resetPrayerJournal = () => {
    recordUndoSnapshot();
    sectionsRef.current = defaultSections;
    setSections(defaultSections);
    setStickers([]);
    setBackground('lined');
    setSelectedStickerId(null);
    setOpenTray(null);
    saveEntry(defaultSections, [], 'lined');
  };

  const clearStickerSelection = () => {
    setSelectedStickerId(null);
  };

  const bringToFront = (id: string) => {
    recordUndoSnapshot();
    setStickers((currentStickers) => {
      const nextDepth = Math.max(
        0,
        ...currentStickers.map((sticker) => sticker.zIndex)
      ) + 1;
      const updatedStickers = currentStickers.map((sticker) =>
        sticker.id === id ? { ...sticker, zIndex: nextDepth } : sticker
      );

      saveEntry(sections, updatedStickers, background);
      return updatedStickers;
    });
    setSelectedStickerId(id);
  };

  const addSticker = (stickerUri: string) => {
    recordUndoSnapshot();
    const newSticker: PrayerSticker = {
      id: Date.now().toString(),
      uri: stickerUri,
      x: 150 + stickers.length * 8,
      y: 280 + stickers.length * 8,
      scale: 1,
      rotation: 0,
      zIndex: highestStickerDepth + 1,
    };

    const updatedStickers = [...stickers, newSticker];
    setStickers(updatedStickers);
    setSelectedStickerId(newSticker.id);
    setOpenTray(null);
    saveEntry(sections, updatedStickers, background);
  };

  const addShopSticker = (imageKey: string) => {
    recordUndoSnapshot();
    const newSticker: PrayerSticker = {
      id: Date.now().toString(),
      uri: '',
      imageKey,
      x: 118 + stickers.length * 8,
      y: 250 + stickers.length * 8,
      scale: 0.75,
      rotation: 0,
      zIndex: highestStickerDepth + 1,
    };

    const updatedStickers = [...stickers, newSticker];
    setStickers(updatedStickers);
    setSelectedStickerId(newSticker.id);
    setOpenTray(null);
    saveEntry(sections, updatedStickers, background);
  };

  const updateSticker = (
    id: string,
    updates: Partial<Pick<PrayerSticker, 'x' | 'y' | 'scale'>>
  ) => {
    recordUndoSnapshot();
    setStickers((currentStickers) => {
      const updatedStickers = currentStickers.map((sticker) =>
        sticker.id === id ? { ...sticker, ...updates } : sticker
      );

      saveEntry(sections, updatedStickers, background);
      return updatedStickers;
    });
  };

  const deleteSticker = (id: string) => {
    recordUndoSnapshot();
    setStickers((currentStickers) => {
      const updatedStickers = currentStickers.filter((sticker) => sticker.id !== id);
      saveEntry(sections, updatedStickers, background);
      return updatedStickers;
    });
    setSelectedStickerId((currentSelectedId) =>
      currentSelectedId === id ? null : currentSelectedId
    );
  };

  const updateBackground = (nextBackground: PrayerBackground) => {
    recordUndoSnapshot();
    setBackground(nextBackground);
    setOpenTray(null);
    saveEntry(sections, stickers, nextBackground);
  };

  const toggleFavorite = async () => {
    const nextValue = !isFavorite;
    const latestSections = getLatestWebSections(sectionsRef.current);
    sectionsRef.current = latestSections;
    setIsFavorite(nextValue);

    const entry: PrayerEntry = {
      id: entryId ?? newEntryToken ?? currentId,
      type: 'prayer',
      date: entryDate,
      sections: latestSections,
      stickers,
      background,
      preview: buildPreview(latestSections),
      isFavorite: nextValue,
      updatedAt: Date.now(),
    };

    try {
      await AsyncStorage.setItem(`journal_prayer_${entry.id}`, JSON.stringify(entry));
      await updateIndex(entry);
      if (!entryId) {
        router.replace({ pathname: '/prayer-journal', params: { entryId: entry.id } });
      }
      if (nextValue) {
        showSaveConfirmation('Saved!');
      }
    } catch (error) {
      console.log('Error toggling favorite:', error);
    }
  };

  const captureSectionsBeforeAction = () => {
    const latestSections = getLatestWebSections(sectionsRef.current);
    sectionsRef.current = latestSections;
    setSections(latestSections);
  };

  const shareJournalImage = async () => {
    if (!canvasRef.current || isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      const imageUri = await captureRef(canvasRef, {
        format: 'png',
        quality: 1,
      });

      await Share.share({
        url: imageUri,
      });
    } catch (error) {
      console.log('Error sharing prayer journal:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const saveJournalImage = async () => {
    if (!canvasRef.current) {
      return;
    }
    const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
    if (!permission.granted) {
      return;
    }
    const imageUri = await captureRef(canvasRef, {
      format: 'png',
      quality: 1,
    });
    await MediaLibrary.createAssetAsync(imageUri);
    showSaveConfirmation('Saved image');
  };

  const handleCloudSaved = (result: { conflictCount: number }) => {
    showSaveConfirmation(result.conflictCount > 0 ? 'Cloud saved, review sync' : 'Saved to cloud');
  };
  const localizedSections = useMemo(
    () => localizeJournalSections(sections, PRAYER_SECTION_KEYS, t),
    [sections, t]
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colorTheme.editorBackground }]}>
      <View style={[styles.container, { backgroundColor: colorTheme.editorBackground }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            setSelectedStickerId(null);
          }}
          showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Image source={HEADER_ICON} style={styles.titleIcon} resizeMode="contain" />
            <Text style={styles.title}>
              {t('prayerJournal')}
            </Text>
          </View>
          <Text style={styles.date}>{entryDate}</Text>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPressIn={captureSectionsBeforeAction}
            onPress={() => void toggleFavorite()}
            {...(Platform.OS === 'web'
              ? { onMouseDown: captureSectionsBeforeAction, onPointerDown: captureSectionsBeforeAction }
              : null)}>
            <Text style={styles.favoriteButtonText}>
              {isFavorite ? `❤️ ${t('editorSavedToFavorites')}` : `🤍 ${t('editorSaveToFavorites')}`}
            </Text>
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbar}
            keyboardShouldPersistTaps="handled">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                setOpenTray((currentTray) =>
                  currentTray === 'text' ? null : 'text'
                )
              }
              style={[
                styles.toolbarButton,
                { backgroundColor: colorTheme.toolbarBackground },
                openTray === 'text'
                  ? [
                      styles.toolbarButtonActive,
                      { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border },
                    ]
                  : null,
              ]}>
              <Image source={JOURNAL_TOOLBAR_ICONS.text} resizeMode="contain" style={styles.toolbarImageIcon} />
              <Text style={styles.toolbarLabel}>{t('editorText')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                setOpenTray((currentTray) =>
                  currentTray === 'stickers' ? null : 'stickers'
                )
              }
              style={[
                styles.toolbarButton,
                { backgroundColor: colorTheme.toolbarBackground },
                openTray === 'stickers'
                  ? [
                      styles.toolbarButtonActive,
                      { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border },
                    ]
                  : null,
              ]}>
              <Image source={JOURNAL_TOOLBAR_ICONS.decor} resizeMode="contain" style={styles.toolbarImageIcon} />
              <Text style={styles.toolbarLabel}>{t('editorDecor')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                setOpenTray((currentTray) =>
                  currentTray === 'background' ? null : 'background'
                )
              }
              style={[
                styles.toolbarButton,
                { backgroundColor: colorTheme.toolbarBackground },
                openTray === 'background'
                  ? [
                      styles.toolbarButtonActive,
                      { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border },
                    ]
                  : null,
              ]}>
              <Image source={JOURNAL_TOOLBAR_ICONS.canvas} resizeMode="contain" style={styles.toolbarImageIcon} />
              <Text style={styles.toolbarLabel}>{t('editorCanvas')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={addNoteSection}
              style={[styles.toolbarButton, { backgroundColor: colorTheme.toolbarBackground }]}>
              <Image source={JOURNAL_TOOLBAR_ICONS.note} resizeMode="contain" style={styles.toolbarImageIcon} />
              <Text style={styles.toolbarLabel}>{t('editorNote')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                setOpenTray((currentTray) => (currentTray === 'more' ? null : 'more'))
              }
              style={[
                styles.toolbarButton,
                { backgroundColor: colorTheme.toolbarBackground },
                openTray === 'more'
                  ? [
                      styles.toolbarButtonActive,
                      { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border },
                    ]
                  : null,
              ]}>
              <Image source={JOURNAL_TOOLBAR_ICONS.more} resizeMode="contain" style={styles.toolbarImageIcon} />
              <Text style={styles.toolbarLabel}>{t('editorMore')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={undoHistory.length === 0}
              onPress={undoLastEdit}
              style={[
                styles.toolbarButton,
                { backgroundColor: colorTheme.toolbarBackground },
                undoHistory.length === 0 ? styles.toolbarButtonDisabled : null,
              ]}>
              <Ionicons name="arrow-undo-outline" size={22} color="#7A6F66" />
              <Text style={styles.toolbarLabel}>{t('actionUndo')}</Text>
            </TouchableOpacity>
          </ScrollView>

          {openTray === 'stickers' ? (
            <View
              style={[
                styles.tray,
                {
                  backgroundColor: colorTheme.screenBackground,
                  borderColor: colorTheme.border,
                },
              ]}>
              <Text style={styles.trayTitle}>{t('editorDecor')}</Text>
              <Text style={styles.traySectionTitle}>{t('editorQuickStickers')}</Text>
              <View style={styles.stickerTrayRow}>
                {STICKER_CHOICES.map((choice) => (
                  <TouchableOpacity
                    key={choice}
                    activeOpacity={0.85}
                    onPress={() => addSticker(choice)}
                    style={[
                      styles.trayStickerButton,
                      { backgroundColor: colorTheme.toolbarBackground },
                    ]}>
                    <Text style={styles.trayStickerEmoji}>{choice}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView
                style={styles.trayStickerScroll}
                contentContainerStyle={styles.trayStickerPackList}
                showsVerticalScrollIndicator={false}>
                {TEST_UNLOCKED_STICKER_PACKS.map((pack) => (
                  <View key={pack.id} style={styles.trayStickerPackSection}>
                    <Text style={styles.trayPackTitle}>{pack.title}</Text>
                    <View style={styles.stickerTrayRow}>
                      {pack.stickers.map((shopSticker) => (
                        <TouchableOpacity
                          key={shopSticker.key}
                          activeOpacity={0.85}
                          onPress={() => addShopSticker(shopSticker.key)}
                          style={[
                            styles.trayStickerButton,
                            styles.trayImageStickerButton,
                            { backgroundColor: colorTheme.toolbarBackground },
                          ]}>
                          <Image
                            source={shopSticker.previewImage ?? shopSticker.image}
                            resizeMode="contain"
                            style={[
                              styles.trayStickerImage,
                              getShopStickerDisplaySize(shopSticker, 52),
                            ]}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {openTray === 'background' ? (
            <View
              style={[
                styles.tray,
                {
                  backgroundColor: colorTheme.screenBackground,
                  borderColor: colorTheme.border,
                },
              ]}>
              <Text style={styles.trayTitle}>{t('editorCanvas')}</Text>
              <Text style={styles.traySectionTitle}>{t('editorBasic')}</Text>
              <View style={styles.backgroundOptionRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => updateBackground('lined')}
                  style={[
                    styles.backgroundChip,
                    { backgroundColor: colorTheme.toolbarBackground },
                    background === 'lined'
                      ? [
                          styles.activeChip,
                          { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border },
                        ]
                      : null,
                  ]}>
                  <Text style={styles.backgroundChipText}>{t('editorLined')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => updateBackground('plain')}
                  style={[
                    styles.backgroundChip,
                    { backgroundColor: colorTheme.toolbarBackground },
                    background === 'plain'
                      ? [
                          styles.activeChip,
                          { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border },
                        ]
                      : null,
                  ]}>
                  <Text style={styles.backgroundChipText}>{t('editorPlain')}</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.backgroundPickerScroll}
                contentContainerStyle={styles.backgroundPickerContent}
                showsVerticalScrollIndicator={false}>
                {TEST_UNLOCKED_BACKGROUND_PACKS.map((pack) => (
                  <View key={pack.id} style={styles.backgroundPackSection}>
                    <Text style={styles.trayPackTitle}>{pack.title}</Text>
                    <View style={styles.backgroundPreviewGrid}>
                      {pack.backgrounds.map((backgroundOption) => {
                        const backgroundValue = getPrayerBackgroundValue(backgroundOption.key);

                        return (
                          <TouchableOpacity
                            key={backgroundOption.key}
                            activeOpacity={0.85}
                            onPress={() => updateBackground(backgroundValue)}
                            style={[
                              styles.backgroundPreviewButton,
                              { backgroundColor: colorTheme.toolbarBackground },
                              background === backgroundValue
                                ? [
                                    styles.activeChip,
                                    {
                                      backgroundColor: colorTheme.selectionBackground,
                                      borderColor: colorTheme.border,
                                    },
                                  ]
                                : null,
                            ]}>
                            <Image
                              source={backgroundOption.previewImage ?? backgroundOption.image}
                              resizeMode="cover"
                              style={styles.backgroundPreviewImage}
                            />
                            <Text numberOfLines={2} style={styles.backgroundPreviewText}>
                              {backgroundOption.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {openTray === 'text' ? (
            <View
              style={[
                styles.tray,
                {
                  backgroundColor: colorTheme.screenBackground,
                  borderColor: colorTheme.border,
                },
              ]}>
              <Text style={styles.trayTitle}>{t('editorText')}</Text>
              <View style={styles.highlightDropdownRow}>
                {['#FFF3A3', '#FFD2E1', '#CFE7FF'].map((color) => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => {
                      recordUndoSnapshot();
                      setSectionAccent(color);
                    }}
                    style={[
                      styles.highlightColorButton,
                      { backgroundColor: color },
                      sectionAccent === color ? styles.highlightColorButtonSelected : null,
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {openTray === 'more' ? (
            <View style={styles.moreActionPanel}>
              <TouchableOpacity activeOpacity={0.85} onPress={saveJournalImage} style={styles.moreActionChip}>
                <Ionicons name="download-outline" size={16} color="#5B514D" />
                <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={styles.moreActionText}>{t('actionSaveImage')}</Text>
              </TouchableOpacity>
              <EncryptedCloudSaveAction
                buttonStyle={styles.moreActionChip}
                textStyle={styles.moreActionText}
                iconColor="#5B514D"
                onSaved={handleCloudSaved}
              />
              <TouchableOpacity activeOpacity={0.85} onPress={shareJournalImage} style={styles.moreActionChip}>
                <Ionicons name="share-outline" size={16} color="#5B514D" />
                <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={styles.moreActionText}>{t('actionShare')}</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85} onPress={resetPrayerJournal} style={styles.moreActionChip}>
                <Ionicons name="arrow-redo-outline" size={16} color="#5B514D" />
                <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={styles.moreActionText}>{t('actionStartOver')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View ref={canvasRef} collapsable={false} style={styles.captureFrame}>
            {background === 'lined' || selectedPrayerBackground ? (
              <ImageBackground
                imageStyle={[
                  styles.canvasBackgroundImage,
                  selectedPrayerBackground ? styles.shopCanvasBackgroundImage : null,
                ]}
                resizeMode={selectedPrayerBackground ? 'cover' : 'stretch'}
                source={
                  selectedPrayerBackground
                    ? selectedPrayerBackground.image
                    : require('../assets/images/lined-paper.png')
                }
                style={[
                  styles.canvas,
                  selectedPrayerBackground ? styles.shopBackgroundCanvas : styles.linedCanvas,
                  {
                    minHeight: canvasMinHeight,
                    backgroundColor: colorTheme.paperBackground,
                  },
                ]}>
                <View
                  onLayout={(event) => {
                    setSectionsHeight(event.nativeEvent.layout.height);
                  }}
                  style={styles.sectionsContent}>
                  {localizedSections.map((section, index) => (
                    <PrayerSectionField
                      key={section.id}
                      label={section.label}
                      value={section.text}
                      onFocusField={clearStickerSelection}
                      onChangeText={(text) => updateSection(index, text)}
                      placeholder={t('editorWriteHere')}
                      cardBackground={colorTheme.cardBackground}
                      accentColor={sectionAccent}
                    />
                  ))}
                </View>

                <View pointerEvents="box-none" style={styles.stickerLayer}>
                  {stickers
                    .slice()
                    .sort((left, right) => left.zIndex - right.zIndex)
                    .map((sticker) => (
                      <DraggablePrayerSticker
                        key={sticker.id}
                        isSelected={selectedStickerId === sticker.id}
                        sticker={sticker}
                        onDelete={deleteSticker}
                        onSelect={bringToFront}
                        onUpdate={updateSticker}
                      />
                    ))}
                </View>
              </ImageBackground>
            ) : (
              <View
                style={[
                  styles.canvas,
                  styles.plainCanvas,
                  {
                    minHeight: canvasMinHeight,
                    backgroundColor: colorTheme.paperBackground,
                  },
                ]}>
                <View
                  onLayout={(event) => {
                    setSectionsHeight(event.nativeEvent.layout.height);
                  }}
                  style={styles.sectionsContent}>
                  {localizedSections.map((section, index) => (
                    <PrayerSectionField
                      key={section.id}
                      label={section.label}
                      value={section.text}
                      onFocusField={clearStickerSelection}
                      onChangeText={(text) => updateSection(index, text)}
                      placeholder={t('editorWriteHere')}
                      cardBackground={colorTheme.cardBackground}
                      accentColor={colorTheme.accent}
                    />
                  ))}
                </View>

                <View pointerEvents="box-none" style={styles.stickerLayer}>
                  {stickers
                    .slice()
                    .sort((left, right) => left.zIndex - right.zIndex)
                    .map((sticker) => (
                      <DraggablePrayerSticker
                        key={sticker.id}
                        isSelected={selectedStickerId === sticker.id}
                        sticker={sticker}
                        onDelete={deleteSticker}
                        onSelect={bringToFront}
                        onUpdate={updateSticker}
                      />
                    ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <SaveConfirmationToast
          visibleKey={saveConfirmationKey}
          message={saveConfirmationMessage}
          tintColor={colorTheme.tint}
          borderColor={colorTheme.border}
          backgroundColor={colorTheme.paperBackground}
          style={styles.saveConfirmationToast}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4F2',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 20 : 28,
    paddingBottom: Platform.OS === 'web' ? 80 : 120,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleIcon: {
    width: 32,
    height: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  date: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
    marginBottom: 12,
  },
  favoriteButton: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    backgroundColor: '#F3EDE8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  favoriteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B514D',
  },
  saveConfirmationToast: {
    top: Platform.OS === 'web' ? 88 : 118,
  },
  captureFrame: {
    width: '100%',
  },
  canvas: {
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  linedCanvas: {
    backgroundColor: '#FFFDF8',
  },
  plainCanvas: {
    backgroundColor: '#FFFFFF',
  },
  canvasBackgroundImage: {
    opacity: 0.45,
  },
  shopCanvasBackgroundImage: {
    opacity: 1,
  },
  shopBackgroundCanvas: {
    backgroundColor: '#FFFFFF',
  },
  sectionsContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F3D1DC',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#444444',
  },
  prayerInputWrapper: {
    minHeight: MIN_INPUT_HEIGHT,
    position: 'relative',
    justifyContent: 'flex-start',
  },
  inputMeasure: {
    fontSize: 16,
    color: 'transparent',
    paddingVertical: 8,
    lineHeight: 22,
  },
  inputOverlay: {
    ...StyleSheet.absoluteFillObject,
    fontSize: 16,
    color: '#333333',
    paddingVertical: 8,
    lineHeight: 22,
  },
  stickerLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  sticker: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  selectedSticker: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  stickerPressTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerEmoji: {
    fontSize: 54,
  },
  stickerImage: {
    width: 142,
    height: 142,
  },
  resizeHandleWrapper: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    zIndex: 40,
  },
  resizeHandle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#D6D0CB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  resizeHandleIcon: {
    fontSize: 13,
    lineHeight: 13,
    color: '#1F1F1F',
    fontWeight: '600',
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 30,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tray: {
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  trayTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  traySectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B5F57',
    marginBottom: 8,
  },
  stickerTrayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  trayPackTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A6F66',
    marginTop: 0,
    marginBottom: 10,
  },
  trayStickerScroll: {
    maxHeight: 220,
  },
  trayStickerPackList: {
    paddingBottom: 4,
  },
  trayStickerPackSection: {
    marginTop: 14,
  },
  trayStickerButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#F6F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayStickerEmoji: {
    fontSize: 30,
  },
  trayImageStickerButton: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8DCD4',
  },
  trayStickerImage: {
    width: 52,
    height: 52,
  },
  backgroundOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  backgroundChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#F6F1EB',
  },
  activeChip: {
    backgroundColor: '#E8DCD4',
  },
  backgroundChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  backgroundPickerScroll: {
    maxHeight: 230,
    marginTop: 12,
  },
  backgroundPickerContent: {
    paddingBottom: 4,
  },
  backgroundPackSection: {
    marginTop: 4,
  },
  backgroundPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  backgroundPreviewButton: {
    width: 92,
    minHeight: 112,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8DCD4',
    padding: 7,
    alignItems: 'center',
  },
  backgroundPreviewImage: {
    width: 76,
    height: 58,
    borderRadius: 6,
    marginBottom: 7,
  },
  backgroundPreviewText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#5B514D',
    textAlign: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  toolbarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 78,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolbarButtonActive: {
    backgroundColor: '#ECE2D8',
  },
  toolbarButtonDisabled: {
    opacity: 0.45,
  },
  toolbarIcon: {
    fontSize: 22,
  },
  toolbarImageIcon: {
    width: 22,
    height: 22,
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
  toolbarLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#7A6F66',
    fontWeight: '600',
  },
  moreActionPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  moreActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 36,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 6,
  },
  moreActionText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#4A403C',
  },
});
