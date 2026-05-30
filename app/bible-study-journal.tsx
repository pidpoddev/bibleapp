import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { getBooks, getChapters, getVerses, getVerseText } from '@/utils/bible-data';
import { useAppSettings } from '@/utils/app-settings';
import { JOURNAL_INDEX_KEY } from '@/utils/storage-keys';
import { formatEntryDateTime } from '@/utils/date-time';
import { getShopBackground, TEST_UNLOCKED_BACKGROUND_PACKS } from '@/utils/shop-backgrounds';
import { getShopSticker, TEST_UNLOCKED_STICKER_PACKS } from '@/utils/shop-stickers';

type BibleStudySection = { id: string; label: string; text: string };
type DecorSticker = { id: string; emoji?: string; imageKey?: string };
type BibleStudyEntry = {
  id: string;
  type: 'bible-study';
  date: string;
  book: string;
  chapter: string;
  verse: string;
  sections: BibleStudySection[];
  stickers?: DecorSticker[];
  background?: string;
  highlightColor?: string;
  preview: string;
  isFavorite: boolean;
  updatedAt: number;
};

const MIN_INPUT_HEIGHT = 72;
const generateId = () => Date.now().toString();
const STICKER_CHOICES = ['🌸', '💖', '✨', '🕊️', '🌿', '⭐️'] as const;
const HIGHLIGHTER_COLORS = ['#FFF3A3', '#FFD2E1', '#CFE7FF'];
const JOURNAL_TOOLBAR_ICONS = {
  text: require('../assets/images/toolbar-icons/text-tight.png'),
  canvas: require('../assets/images/toolbar-icons/canvas-tight.png'),
  decor: require('../assets/images/toolbar-icons/decor-tight.png'),
  note: require('../assets/images/toolbar-icons/notes-tight.png'),
  more: require('../assets/images/toolbar-icons/more-tight.png'),
} as const;
const HEADER_ICON = require('../assets/images/toolbar-icons/journal-bible-study.png');

const defaultSections: BibleStudySection[] = [
  { id: '1', label: 'What stands out:', text: '' },
  { id: '2', label: 'What it means:', text: '' },
  { id: '3', label: 'How I can apply it:', text: '' },
  { id: '4', label: 'Prayer response:', text: '' },
  { id: '5', label: 'Notes:', text: '' },
];

const BibleStudySectionField = memo(function BibleStudySectionField({
  label,
  value,
  onChangeText,
  cardBackground,
  accentColor,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  cardBackground: string;
  accentColor: string;
}) {
  const [draftText, setDraftText] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  useEffect(() => {
    if (isFocused) return;
    setDraftText(value);
  }, [isFocused, value]);

  return (
    <View style={[styles.section, { backgroundColor: cardBackground, borderLeftColor: accentColor }]}> 
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Text pointerEvents="none" style={styles.inputMeasure}>{draftText.length ? `${draftText}\n` : ' '}</Text>
        <TextInput
          multiline
          scrollEnabled={false}
          blurOnSubmit={false}
          placeholder="Write here..."
          placeholderTextColor="#A79B92"
          style={styles.inputOverlay}
          textAlignVertical="top"
          value={draftText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChangeText={(text) => {
            setDraftText(text);
            onChangeText(text);
          }}
        />
      </View>
    </View>
  );
});

function buildPreview(book: string, chapter: string, verse: string, sections: BibleStudySection[]) {
  const reference = [book.trim(), chapter.trim(), verse.trim() ? `:${verse.trim()}` : ''].join(' ').replace(/\s+:$/, '').trim();
  const reflection = sections.map((section) => section.text.trim()).filter(Boolean).join(' ');
  return `${reference} ${reflection}`.trim().slice(0, 80);
}

export default function BibleStudyJournalScreen() {
  const { colorTheme, language } = useAppSettings();
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  const today = useMemo(() => formatEntryDateTime(new Date()), []);
  const [currentId, setCurrentId] = useState(() => entryId ?? generateId());
  const [entryDate, setEntryDate] = useState(today);
  const [book, setBook] = useState('');
  const [chapter, setChapter] = useState('');
  const [verse, setVerse] = useState('');
  const [openDropdown, setOpenDropdown] = useState<'book' | 'chapter' | 'verse' | null>(null);
  const canvasRef = useRef<View>(null);
  const [sections, setSections] = useState<BibleStudySection[]>(defaultSections);
  const [stickers, setStickers] = useState<DecorSticker[]>([]);
  const [background, setBackground] = useState<string>('lined');
  const [highlightColor, setHighlightColor] = useState<string>('#FFF3A3');
  const [openDecor, setOpenDecor] = useState<'bg' | 'sticker' | 'highlight' | 'more' | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  const bookOptions = useMemo(() => getBooks(), []);
  const chapterOptions = useMemo(() => (book ? getChapters(book).map(String) : []), [book]);
  const verseOptions = useMemo(() => (book && chapter ? getVerses(book, Number(chapter)).map(String) : []), [book, chapter]);
  const verseText = useMemo(() => (book && chapter && verse ? getVerseText(book, Number(chapter), Number(verse), language.key) : ''), [book, chapter, language.key, verse]);
  const selectedBg = getShopBackground(background.startsWith('shop:') ? background.replace('shop:', '') : null);

  const updateIndex = useCallback(async (entry: BibleStudyEntry) => {
    const existingIndex = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
    const parsedIndex = existingIndex ? (JSON.parse(existingIndex) as BibleStudyEntry[]) : [];
    const nextIndex = parsedIndex.some((item) => item.id === entry.id) ? parsedIndex.map((item) => (item.id === entry.id ? entry : item)) : [entry, ...parsedIndex];
    nextIndex.sort((left, right) => right.updatedAt - left.updatedAt);
    await AsyncStorage.setItem(JOURNAL_INDEX_KEY, JSON.stringify(nextIndex));
  }, []);

  const saveEntry = useCallback(async (nextBook: string, nextChapter: string, nextVerse: string, nextSections: BibleStudySection[], nextStickers = stickers, nextBackground = background, nextHighlightColor = highlightColor) => {
    const id = currentId || generateId();
    if (!currentId) setCurrentId(id);
    const entry: BibleStudyEntry = {
      id,
      type: 'bible-study',
      date: entryDate,
      book: nextBook,
      chapter: nextChapter,
      verse: nextVerse,
      sections: nextSections,
      stickers: nextStickers,
      background: nextBackground,
      highlightColor: nextHighlightColor,
      preview: buildPreview(nextBook, nextChapter, nextVerse, nextSections),
      isFavorite,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(`journal_bible_study_${id}`, JSON.stringify(entry));
    await updateIndex(entry);
  }, [background, currentId, entryDate, highlightColor, isFavorite, stickers, updateIndex]);

  useEffect(() => {
    const loadEntry = async () => {
      if (!entryId) {
        await saveEntry('', '', '', defaultSections);
        return;
      }
      const storedEntry = await AsyncStorage.getItem(`journal_bible_study_${entryId}`);
      if (!storedEntry) return;
      const parsedEntry = JSON.parse(storedEntry) as BibleStudyEntry;
      setCurrentId(parsedEntry.id);
      setEntryDate(parsedEntry.date || today);
      setBook(parsedEntry.book || '');
      setChapter(parsedEntry.chapter || '');
      setVerse(parsedEntry.verse || '');
      setSections(Array.isArray(parsedEntry.sections) ? parsedEntry.sections : defaultSections);
      setStickers(Array.isArray(parsedEntry.stickers) ? parsedEntry.stickers : []);
      setBackground(typeof parsedEntry.background === 'string' ? parsedEntry.background : 'lined');
      setHighlightColor(typeof parsedEntry.highlightColor === 'string' ? parsedEntry.highlightColor : '#FFF3A3');
      setIsFavorite(Boolean(parsedEntry.isFavorite));
    };
    void loadEntry();
  }, [entryId, saveEntry, today]);

  const updateSection = useCallback((sectionId: string, text: string) => {
    setSections((currentSections) => {
      const updatedSections = currentSections.map((section) => section.id === sectionId ? { ...section, text } : section);
      void saveEntry(book, chapter, verse, updatedSections);
      return updatedSections;
    });
  }, [book, chapter, saveEntry, verse]);

  const addEmojiSticker = (emoji: string) => {
    const next = [...stickers, { id: `${Date.now()}-${stickers.length}`, emoji }];
    setStickers(next);
    setOpenDecor(null);
    void saveEntry(book, chapter, verse, sections, next);
  };

  const addShopSticker = (imageKey: string) => {
    const next = [...stickers, { id: `${Date.now()}-${stickers.length}`, imageKey }];
    setStickers(next);
    setOpenDecor(null);
    void saveEntry(book, chapter, verse, sections, next);
  };

  const removeSticker = (id: string) => {
    const next = stickers.filter((sticker) => sticker.id !== id);
    setStickers(next);
    void saveEntry(book, chapter, verse, sections, next);
  };

  const toggleFavorite = async () => {
    const nextValue = !isFavorite;
    setIsFavorite(nextValue);
    const id = currentId || generateId();
    const entry: BibleStudyEntry = {
      id,
      type: 'bible-study',
      date: entryDate,
      book,
      chapter,
      verse,
      sections,
      stickers,
      background,
      highlightColor,
      preview: buildPreview(book, chapter, verse, sections),
      isFavorite: nextValue,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(`journal_bible_study_${id}`, JSON.stringify(entry));
    await updateIndex(entry);
  };

  const addNoteSection = () => {
    const next = [...sections, { id: generateId(), label: 'Note', text: '' }];
    setSections(next);
    void saveEntry(book, chapter, verse, next);
  };

  const resetJournal = () => {
    setSections(defaultSections);
    setStickers([]);
    setBackground('lined');
    setHighlightColor('#FFF3A3');
    setOpenDecor(null);
    void saveEntry(book, chapter, verse, defaultSections, [], 'lined', '#FFF3A3');
  };

  const saveJournalImage = async () => {
    if (!canvasRef.current) return;
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) return;
    const uri = await captureRef(canvasRef, { format: 'png', quality: 1 });
    await MediaLibrary.createAssetAsync(uri);
    setOpenDecor(null);
  };

  const shareJournalImage = async () => {
    if (!canvasRef.current) return;
    const uri = await captureRef(canvasRef, { format: 'png', quality: 1 });
    await Share.share({ url: uri });
    setOpenDecor(null);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: colorTheme.editorBackground }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={() => { setOpenDropdown(null); }} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Image source={HEADER_ICON} style={styles.titleIcon} resizeMode="contain" />
          <Text style={styles.title}>Bible Study</Text>
        </View>
        <Text style={styles.date}>{entryDate}</Text>
        <TouchableOpacity style={styles.favoriteButton} onPress={() => void toggleFavorite()}>
          <Text style={styles.favoriteButtonText}>{isFavorite ? '❤️ Saved to Favorites' : '🤍 Save to Favorites'}</Text>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.decorToolbar}
          keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={[styles.decorButton, openDecor === 'highlight' ? styles.decorButtonActive : null]}
            onPress={() => setOpenDecor((current) => current === 'highlight' ? null : 'highlight')}>
            <Image source={JOURNAL_TOOLBAR_ICONS.text} style={styles.decorButtonIcon} resizeMode="contain" />
            <Text style={styles.decorButtonText}>Text</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.decorButton, openDecor === 'bg' ? styles.decorButtonActive : null]}
            onPress={() => setOpenDecor((current) => current === 'bg' ? null : 'bg')}>
            <Image source={JOURNAL_TOOLBAR_ICONS.canvas} style={styles.decorButtonIcon} resizeMode="contain" />
            <Text style={styles.decorButtonText}>Canvas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.decorButton, openDecor === 'sticker' ? styles.decorButtonActive : null]}
            onPress={() => setOpenDecor((current) => current === 'sticker' ? null : 'sticker')}>
            <Image source={JOURNAL_TOOLBAR_ICONS.decor} style={styles.decorButtonIcon} resizeMode="contain" />
            <Text style={styles.decorButtonText}>Decor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.decorButton}
            onPress={addNoteSection}>
            <Image source={JOURNAL_TOOLBAR_ICONS.note} style={styles.decorButtonIcon} resizeMode="contain" />
            <Text style={styles.decorButtonText}>Note</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.decorButton, openDecor === 'more' ? styles.decorButtonActive : null]}
            onPress={() => setOpenDecor((current) => current === 'more' ? null : 'more')}>
            <Image source={JOURNAL_TOOLBAR_ICONS.more} style={styles.decorButtonIcon} resizeMode="contain" />
            <Text style={styles.decorButtonText}>More</Text>
          </TouchableOpacity>
        </ScrollView>

        {openDecor === 'bg' ? (
          <View style={styles.decorPanel}>
            <Text style={styles.panelSectionTitle}>Basic</Text>
            <View style={styles.panelItemRow}>
              <TouchableOpacity style={styles.simpleChip} onPress={() => { setBackground('lined'); setOpenDecor(null); void saveEntry(book, chapter, verse, sections, stickers, 'lined'); }}><Text>Lined</Text></TouchableOpacity>
              <TouchableOpacity style={styles.simpleChip} onPress={() => { setBackground('plain'); setOpenDecor(null); void saveEntry(book, chapter, verse, sections, stickers, 'plain'); }}><Text>Plain</Text></TouchableOpacity>
            </View>
            {TEST_UNLOCKED_BACKGROUND_PACKS.map((pack) => (
              <View key={pack.id} style={styles.panelSection}>
                <Text style={styles.panelSectionTitle}>{pack.title}</Text>
                <View style={styles.panelItemRow}>
                  {pack.backgrounds.map((bg) => (
                    <TouchableOpacity key={bg.key} style={styles.bgChip} onPress={() => { const next = `shop:${bg.key}`; setBackground(next); setOpenDecor(null); void saveEntry(book, chapter, verse, sections, stickers, next); }}>
                      <Image source={bg.image} style={styles.bgPreview} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {openDecor === 'sticker' ? (
          <View style={styles.decorPanel}>
            <Text style={styles.panelSectionTitle}>Quick Stickers</Text>
            <View style={styles.panelItemRow}>
              {STICKER_CHOICES.map((emoji) => <TouchableOpacity key={emoji} style={styles.emojiChip} onPress={() => addEmojiSticker(emoji)}><Text style={styles.emojiText}>{emoji}</Text></TouchableOpacity>)}
            </View>
            {TEST_UNLOCKED_STICKER_PACKS.map((pack) => (
              <View key={pack.id} style={styles.panelSection}>
                <Text style={styles.panelSectionTitle}>{pack.title}</Text>
                <View style={styles.panelItemRow}>
                  {pack.stickers.map((sticker) => (
                    <TouchableOpacity key={sticker.key} style={styles.stickerChip} onPress={() => addShopSticker(sticker.key)}>
                      <Image source={sticker.image} style={styles.stickerPreview} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {openDecor === 'highlight' ? (
          <View style={styles.decorPanel}>
            {HIGHLIGHTER_COLORS.map((color) => (
              <TouchableOpacity key={color} style={[styles.colorChip, { backgroundColor: color }, highlightColor === color ? styles.colorChipSelected : null]} onPress={() => { setHighlightColor(color); setOpenDecor(null); void saveEntry(book, chapter, verse, sections, stickers, background, color); }} />
            ))}
          </View>
        ) : null}
        {openDecor === 'more' ? (
          <View style={styles.decorPanel}>
            <TouchableOpacity style={styles.simpleChip} onPress={() => void saveJournalImage()}>
              <Text>Save image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.simpleChip} onPress={() => void shareJournalImage()}>
              <Text>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.simpleChip} onPress={resetJournal}>
              <Text>Start over</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.referenceRow}>
          <View style={[styles.referenceDropdownContainer, styles.bookCard]}>
            <Pressable onPress={() => setOpenDropdown((current) => (current === 'book' ? null : 'book'))} style={[styles.referenceCard, { backgroundColor: colorTheme.cardBackground }]}>
              <Text numberOfLines={1} style={styles.referenceLabel}>Book</Text>
              <View style={styles.referenceValueRow}><Text numberOfLines={1} style={styles.referenceValueText}>{book || 'Select'}</Text><Text style={styles.referenceChevron}>▼</Text></View>
            </Pressable>
            {openDropdown === 'book' ? <View style={[styles.dropdownMenu, styles.bookDropdownMenu, { backgroundColor: colorTheme.screenBackground, borderColor: colorTheme.border }]}><ScrollView nestedScrollEnabled>{bookOptions.map((bookOption) => <Pressable key={bookOption} onPress={() => { setBook(bookOption); setChapter(''); setVerse(''); setOpenDropdown(null); void saveEntry(bookOption, '', '', sections); }} style={styles.dropdownOption}><Text style={styles.dropdownOptionText}>{bookOption}</Text></Pressable>)}</ScrollView></View> : null}
          </View>
          <View style={styles.referenceDropdownContainer}>
            <Pressable onPress={() => { if (!book) return; setOpenDropdown((current) => (current === 'chapter' ? null : 'chapter')); }} style={[styles.referenceCard, { backgroundColor: colorTheme.cardBackground }, !book ? styles.referenceCardDisabled : null]}>
              <Text numberOfLines={1} style={styles.referenceLabel}>Chapter</Text>
              <View style={styles.referenceValueRow}><Text numberOfLines={1} style={styles.referenceValueText}>{chapter || 'Select'}</Text><Text style={styles.referenceChevron}>▼</Text></View>
            </Pressable>
            {openDropdown === 'chapter' ? <View style={[styles.dropdownMenu, { backgroundColor: colorTheme.screenBackground, borderColor: colorTheme.border }]}><ScrollView nestedScrollEnabled>{chapterOptions.map((chapterOption) => <Pressable key={chapterOption} onPress={() => { setChapter(chapterOption); setVerse(''); setOpenDropdown(null); void saveEntry(book, chapterOption, '', sections); }} style={styles.dropdownOption}><Text style={styles.dropdownOptionText}>{chapterOption}</Text></Pressable>)}</ScrollView></View> : null}
          </View>
          <View style={styles.referenceDropdownContainer}>
            <Pressable onPress={() => { if (!book || !chapter) return; setOpenDropdown((current) => (current === 'verse' ? null : 'verse')); }} style={[styles.referenceCard, { backgroundColor: colorTheme.cardBackground }, !book || !chapter ? styles.referenceCardDisabled : null]}>
              <Text numberOfLines={1} style={styles.referenceLabel}>Verse</Text>
              <View style={styles.referenceValueRow}><Text numberOfLines={1} style={styles.referenceValueText}>{verse || 'Select'}</Text><Text style={styles.referenceChevron}>▼</Text></View>
            </Pressable>
            {openDropdown === 'verse' ? <View style={[styles.dropdownMenu, { backgroundColor: colorTheme.screenBackground, borderColor: colorTheme.border }]}><ScrollView nestedScrollEnabled>{verseOptions.map((verseOption) => <Pressable key={verseOption} onPress={() => { setVerse(verseOption); setOpenDropdown(null); void saveEntry(book, chapter, verseOption, sections); }} style={styles.dropdownOption}><Text style={styles.dropdownOptionText}>{verseOption}</Text></Pressable>)}</ScrollView></View> : null}
          </View>
        </View>

        <View ref={canvasRef} collapsable={false}>
        <ImageBackground source={selectedBg ? selectedBg.image : require('../assets/images/lined-paper.png')} resizeMode={selectedBg ? 'cover' : 'stretch'} style={[styles.canvasWrap, background === 'plain' ? { backgroundColor: colorTheme.paperBackground } : null]}>
          {stickers.length ? (
            <View style={styles.stickerRow}>{stickers.map((sticker) => (
              <Pressable key={sticker.id} onPress={() => removeSticker(sticker.id)} style={styles.stickerItem}>
                {sticker.imageKey && getShopSticker(sticker.imageKey) ? (
                  <Image source={getShopSticker(sticker.imageKey)!.image} style={styles.inlineStickerImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.inlineStickerEmoji}>{sticker.emoji}</Text>
                )}
              </Pressable>
            ))}</View>
          ) : null}

          {book && chapter && verse && verseText ? (
            <View style={[styles.verseCard, { backgroundColor: colorTheme.paperBackground }]}> 
              <Text style={styles.verseReference}>{`${book} ${chapter}:${verse}`}</Text>
              <Text style={styles.verseText}>{verseText}</Text>
            </View>
          ) : null}

          {sections.map((section) => (
            <BibleStudySectionField key={section.id} label={section.label} value={section.text} onChangeText={(text) => updateSection(section.id, text)} cardBackground={colorTheme.cardBackground} accentColor={highlightColor} />
          ))}
        </ImageBackground>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4F2' },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 20 : 28, paddingBottom: Platform.OS === 'web' ? 48 : 120 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIcon: { width: 32, height: 32 },
  title: { fontSize: 22, fontWeight: '600', color: '#1F1F1F' },
  date: { fontSize: 14, color: '#888888', marginTop: 8, marginBottom: 12 },
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
  decorToolbar: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  decorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3EDE8',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  decorButtonActive: {
    backgroundColor: '#E8DCD4',
    borderWidth: 1,
    borderColor: '#D4C2B8',
  },
  decorButtonIcon: { width: 20, height: 20 },
  decorButtonText: { fontSize: 12, fontWeight: '600', color: '#4A403C' },
  decorPanel: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  panelSection: { width: '100%' },
  panelSectionTitle: { width: '100%', fontSize: 12, fontWeight: '700', color: '#6B5F57', marginTop: 2, marginBottom: 6 },
  panelItemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  simpleChip: { borderRadius: 12, backgroundColor: '#F8F5F2', paddingHorizontal: 10, paddingVertical: 8 },
  emojiChip: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8F5F2', alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 21 },
  colorChip: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#D7CCC5' },
  colorChipSelected: { borderWidth: 2, borderColor: '#1F1F1F' },
  stickerChip: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8DCD4', alignItems: 'center', justifyContent: 'center' },
  stickerPreview: { width: 40, height: 40 },
  bgChip: { width: 58, height: 42, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E8DCD4' },
  bgPreview: { width: '100%', height: '100%' },
  referenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10, zIndex: 20 },
  referenceDropdownContainer: { flex: 1, position: 'relative', zIndex: 30 },
  referenceCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 10 },
  bookCard: { flex: 1.5 },
  referenceCardDisabled: { opacity: 0.55 },
  referenceLabel: { fontSize: 9, fontWeight: '600', color: '#8A7F76', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.25 },
  referenceValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  referenceValueText: { fontSize: 12, color: '#333333', flex: 1 },
  referenceChevron: { fontSize: 10, color: '#5B514D' },
  dropdownMenu: { position: 'absolute', top: 74, left: 0, right: 0, maxHeight: 220, backgroundColor: '#FFFDF9', borderRadius: 16, borderWidth: 1, borderColor: '#E8DCD4', paddingVertical: 6, elevation: 5 },
  bookDropdownMenu: { width: 180, right: 'auto' },
  dropdownOption: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownOptionText: { fontSize: 12, color: '#1F1F1F' },
  canvasWrap: { borderRadius: 14, padding: 12, overflow: 'hidden' },
  stickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  stickerItem: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  inlineStickerEmoji: { fontSize: 24 },
  inlineStickerImage: { width: 36, height: 36 },
  verseCard: { backgroundColor: '#FFFDF8', borderRadius: 18, padding: 14, marginBottom: 12 },
  verseReference: { fontSize: 13, fontWeight: '600', color: '#8A7F76', marginBottom: 8 },
  verseText: { fontSize: 16, lineHeight: 24, color: '#333333' },
  section: { marginBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, borderLeftWidth: 4 },
  label: { fontSize: 16, marginBottom: 8, color: '#444444' },
  inputWrapper: { minHeight: MIN_INPUT_HEIGHT, position: 'relative', justifyContent: 'flex-start' },
  inputMeasure: { fontSize: 16, color: 'transparent', paddingVertical: 8, lineHeight: 22 },
  inputOverlay: { ...StyleSheet.absoluteFillObject, fontSize: 16, color: '#333333', paddingVertical: 8, lineHeight: 22 },
});
