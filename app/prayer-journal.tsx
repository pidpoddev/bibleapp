import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { useAppSettings } from '@/utils/app-settings';

type PrayerSection = {
  id: string;
  label: string;
  text: string;
};

type PrayerBackground = 'lined' | 'plain';

type PrayerSticker = {
  id: string;
  uri: string;
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

const JOURNAL_INDEX_KEY = 'journal_index';
const generateId = () => Date.now().toString();
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

const normalizeEntryDate = (value?: string) => {
  if (!value) {
    return getFormattedDateStamp();
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  const normalizedDate = parsedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const normalizedTime = parsedDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${normalizedDate} • ${normalizedTime}`;
};

type DraggablePrayerStickerProps = {
  isSelected: boolean;
  sticker: PrayerSticker;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<PrayerSticker, 'x' | 'y' | 'scale'>>) => void;
};

const STICKER_CHOICES = ['🌸', '💖', '✨', '🕊️', '🌿', '⭐️'] as const;
const MIN_STICKER_SCALE = 0.35;
const MAX_STICKER_SCALE = 2.2;
const MIN_INPUT_HEIGHT = 72;

const defaultSections: PrayerSection[] = [
  { id: '1', label: '🙏 What I’m praying for:', text: '' },
  { id: '2', label: '💖 What I’m thankful for:', text: '' },
  { id: '3', label: '✨ What’s on my heart:', text: '' },
  { id: '4', label: '🕊 Give me peace about:', text: '' },
];

type PrayerSectionFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onFocusField: () => void;
  cardBackground: string;
  accentColor: string;
};

const PrayerSectionField = memo(function PrayerSectionField({
  label,
  value,
  onChangeText,
  onFocusField,
  cardBackground,
  accentColor,
}: PrayerSectionFieldProps) {
  const [draftText, setDraftText] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isFocused) {
      return;
    }

    setDraftText(value);
  }, [isFocused, value]);

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
          placeholder="Write here..."
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
          onBlur={() => setIsFocused(false)}
          onPressIn={onFocusField}
          onChangeText={(text) => {
            setDraftText(text);
            onChangeText(text);
          }}
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

          <Text style={styles.stickerEmoji}>{sticker.uri}</Text>
        </Pressable>
      </Animated.View>
    </PanGestureHandler>
  );
}

export default function PrayerJournalScreen() {
  const { colorTheme } = useAppSettings();
  const { entryId, newEntryToken } = useLocalSearchParams<{
    entryId?: string;
    newEntryToken?: string;
  }>();
  const today = useMemo(() => getFormattedDateStamp(), []);
  const [currentId, setCurrentId] = useState(() => entryId ?? generateId());
  const [entryDate, setEntryDate] = useState(today);
  const [sections, setSections] = useState<PrayerSection[]>(defaultSections);
  const [stickers, setStickers] = useState<PrayerSticker[]>([]);
  const [background, setBackground] = useState<PrayerBackground>('lined');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [openTray, setOpenTray] = useState<'stickers' | 'background' | null>(null);
  const [sectionsHeight, setSectionsHeight] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const canvasRef = useRef<View>(null);

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
      const id = currentId || generateId();

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
    [currentId, entryDate, isFavorite, updateIndex]
  );

  useEffect(() => {
    const loadEntry = async () => {
      try {
        if (!entryId) {
          const nextId = generateId();
          const nextDate = getFormattedDateStamp();

          setCurrentId(nextId);
          setEntryDate(nextDate);
          setSections(defaultSections);
          setStickers([]);
          setBackground('lined');
          setIsFavorite(false);
          setSelectedStickerId(null);
          setOpenTray(null);

          const entry: PrayerEntry = {
            id: nextId,
            type: 'prayer',
            date: nextDate,
            sections: defaultSections,
            stickers: [],
            background: 'lined',
            preview: '',
            isFavorite: false,
            updatedAt: Date.now(),
          };

          await AsyncStorage.setItem(`journal_prayer_${entry.id}`, JSON.stringify(entry));
          await updateIndex(entry);
          return;
        }

        const storedEntry = await AsyncStorage.getItem(`journal_prayer_${entryId}`);

        if (!storedEntry) {
          return;
        }

        const parsedEntry = JSON.parse(storedEntry) as PrayerEntry;

        if (typeof parsedEntry.id === 'string') {
          setCurrentId(parsedEntry.id);
        }

        if (typeof parsedEntry.date === 'string') {
          setEntryDate(normalizeEntryDate(parsedEntry.date));
        }

        if (Array.isArray(parsedEntry.sections)) {
          setSections(
            parsedEntry.sections.map((section) => ({
              ...section,
              text:
                typeof section.text === 'string'
                  ? normalizeLoadedSectionText(section.text)
                  : '',
            }))
          );
        }

        if (Array.isArray(parsedEntry.stickers)) {
          setStickers(parsedEntry.stickers);
        }

        setIsFavorite(Boolean(parsedEntry.isFavorite));

        if (parsedEntry.background === 'plain' || parsedEntry.background === 'lined') {
          setBackground(parsedEntry.background);
        }
      } catch (error) {
        console.log('Error loading journal:', error);
      }
    };

    loadEntry();
  }, [entryId, newEntryToken, today, updateIndex]);

  const updateSection = (index: number, text: string) => {
    setSections((currentSections) => {
      const updatedSections = currentSections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, text } : section
      );

      saveEntry(updatedSections, stickers, background);
      return updatedSections;
    });
  };

  const clearStickerSelection = () => {
    setSelectedStickerId(null);
  };

  const bringToFront = (id: string) => {
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

  const updateSticker = (
    id: string,
    updates: Partial<Pick<PrayerSticker, 'x' | 'y' | 'scale'>>
  ) => {
    setStickers((currentStickers) => {
      const updatedStickers = currentStickers.map((sticker) =>
        sticker.id === id ? { ...sticker, ...updates } : sticker
      );

      saveEntry(sections, updatedStickers, background);
      return updatedStickers;
    });
  };

  const deleteSticker = (id: string) => {
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
    setBackground(nextBackground);
    setOpenTray(null);
    saveEntry(sections, stickers, nextBackground);
  };

  const toggleFavorite = async () => {
    const nextValue = !isFavorite;
    setIsFavorite(nextValue);

    const entry: PrayerEntry = {
      id: currentId,
      type: 'prayer',
      date: entryDate,
      sections,
      stickers,
      background,
      preview: buildPreview(sections),
      isFavorite: nextValue,
      updatedAt: Date.now(),
    };

    try {
      await AsyncStorage.setItem(`journal_prayer_${entry.id}`, JSON.stringify(entry));
      await updateIndex(entry);
    } catch (error) {
      console.log('Error toggling favorite:', error);
    }
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
            setOpenTray(null);
          }}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>🙏 Prayer Journal</Text>
          <Text style={styles.date}>{entryDate}</Text>

          <View ref={canvasRef} collapsable={false} style={styles.captureFrame}>
            {background === 'lined' ? (
              <ImageBackground
                imageStyle={styles.canvasBackgroundImage}
                resizeMode="stretch"
                source={require('../assets/images/lined-paper.png')}
                style={[
                  styles.canvas,
                  styles.linedCanvas,
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
                  {sections.map((section, index) => (
                    <PrayerSectionField
                      key={section.id}
                      label={section.label}
                      value={section.text}
                      onFocusField={clearStickerSelection}
                      onChangeText={(text) => updateSection(index, text)}
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
                  {sections.map((section, index) => (
                    <PrayerSectionField
                      key={section.id}
                      label={section.label}
                      value={section.text}
                      onFocusField={clearStickerSelection}
                      onChangeText={(text) => updateSection(index, text)}
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

        {openTray === 'stickers' ? (
          <View
            style={[
              styles.tray,
              {
                backgroundColor: colorTheme.screenBackground,
                borderColor: colorTheme.border,
              },
            ]}>
            <Text style={styles.trayTitle}>Pick a sticker</Text>
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
            <Text style={styles.trayTitle}>Choose a background</Text>
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
                <Text style={styles.backgroundChipText}>Lined</Text>
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
                <Text style={styles.backgroundChipText}>Plain</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={[styles.toolbar, { backgroundColor: colorTheme.toolbarBackground }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={toggleFavorite}
            style={[
              styles.toolbarButton,
              isFavorite
                ? [
                    styles.toolbarButtonActive,
                    { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border },
                  ]
                : null,
            ]}>
            <Text style={styles.toolbarIcon}>{isFavorite ? '❤️' : '🤍'}</Text>
            <Text style={styles.toolbarLabel}>
              {isFavorite ? 'Saved' : 'Favorite'}
            </Text>
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
              openTray === 'stickers'
                ? [
                    styles.toolbarButtonActive,
                    { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border },
                  ]
                : null,
            ]}>
            <Text style={styles.toolbarIcon}>🌸</Text>
            <Text style={styles.toolbarLabel}>Stickers</Text>
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
              openTray === 'background'
                ? [
                    styles.toolbarButtonActive,
                    { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border },
                  ]
                : null,
            ]}>
            <Text style={styles.toolbarIcon}>🧻</Text>
            <Text style={styles.toolbarLabel}>Background</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={shareJournalImage}
            style={styles.toolbarButton}>
            <Text style={styles.toolbarIcon}>↗️</Text>
            <Text style={styles.toolbarLabel}>Share</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: 52,
    paddingBottom: 170,
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
    marginBottom: 24,
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
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 116,
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  trayTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  stickerTrayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
  backgroundOptionRow: {
    flexDirection: 'row',
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
  toolbar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: '#F6F1EB',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toolbarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 68,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  toolbarButtonActive: {
    backgroundColor: '#ECE2D8',
  },
  toolbarIcon: {
    fontSize: 22,
  },
  toolbarLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#7A6F66',
    fontWeight: '600',
  },
});
