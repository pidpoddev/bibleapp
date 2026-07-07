import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { EncryptedCloudSaveAction } from '@/components/encrypted-cloud-save-action';
import { getBooks, getChapters, getVerses, getVerseText } from '@/utils/bible-data';
import { useAppSettings } from '@/utils/app-settings';
import { JOURNAL_INDEX_KEY } from '@/utils/storage-keys';
import { formatEntryDateTime } from '@/utils/date-time';
import {
  CHURCH_DAY_SECTION_KEYS,
  localizeJournalSections,
  makeJournalSections,
} from '@/utils/journal-localization';
import { getShopBackground, TEST_UNLOCKED_BACKGROUND_PACKS } from '@/utils/shop-backgrounds';
import { getShopSticker, TEST_UNLOCKED_STICKER_PACKS } from '@/utils/shop-stickers';

type ChurchDaySection = { id: string; label: string; text: string };
type DecorSticker = { id: string; emoji?: string; imageKey?: string };
type ChurchDayEntry = { id: string; type: 'church-day'; date: string; book: string; chapter: string; verse: string; sections: ChurchDaySection[]; stickers?: DecorSticker[]; background?: string; highlightColor?: string; preview: string; isFavorite: boolean; updatedAt: number; };
type ChurchDayUndoSnapshot = { book: string; chapter: string; verse: string; sections: ChurchDaySection[]; stickers: DecorSticker[]; background: string; highlightColor: string };

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
const HEADER_ICON = require('../assets/images/toolbar-icons/journal-church-day.png');
function getLatestWebSections(sections: ChurchDaySection[]) {
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

const Field = memo(function Field({ label, value, onChangeText, placeholder, cardBackground, accentColor }: { label: string; value: string; onChangeText: (text: string) => void; placeholder: string; cardBackground: string; accentColor: string; }) {
  const [draftText, setDraftText] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  useEffect(() => { if (!isFocused && (value.length > 0 || draftText.length === 0)) setDraftText(value); }, [draftText.length, isFocused, value]);
  const handleTextChange = (text: string) => { setDraftText(text); onChangeText(text); };
  return (
    <View style={[styles.section, { backgroundColor: cardBackground, borderLeftColor: accentColor }]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Text pointerEvents="none" style={styles.inputMeasure}>{draftText.length ? `${draftText}\n` : ' '}</Text>
        <TextInput multiline scrollEnabled={false} blurOnSubmit={false} placeholder={placeholder} placeholderTextColor="#A79B92" style={styles.inputOverlay} textAlignVertical="top" value={draftText} onFocus={() => setIsFocused(true)} onBlur={(event) => { const text = (event.target as unknown as { value?: string }).value; if (typeof text === 'string') handleTextChange(text); if (Platform.OS !== 'web') setIsFocused(false); }} onChange={(event) => { const text = event.nativeEvent.text ?? (event.target as unknown as { value?: string }).value; if (typeof text === 'string') handleTextChange(text); }} onChangeText={handleTextChange} {...(Platform.OS === 'web' ? { onInput: (event: { currentTarget?: { value?: string }; target?: { value?: string } }) => { const text = event.currentTarget?.value ?? event.target?.value; if (typeof text === 'string') handleTextChange(text); } } : null)} />
      </View>
    </View>
  );
});

const buildPreview = (book: string, chapter: string, verse: string, sections: ChurchDaySection[]) => `${book && chapter && verse ? `${book} ${chapter}:${verse}` : ''} ${sections.map((s) => s.text.trim()).filter(Boolean).join(' ')}`.trim().slice(0, 80);

export default function ChurchDayJournalScreen() {
  const { colorTheme, language, t } = useAppSettings();
  const router = useRouter();
  const { entryId, newEntryToken } = useLocalSearchParams<{ entryId?: string; newEntryToken?: string }>();
  const draftEntryId = entryId ?? newEntryToken;
  const [currentId, setCurrentId] = useState(() => draftEntryId ?? generateId());
  const [entryDate, setEntryDate] = useState(() => formatEntryDateTime(new Date()));
  const [book, setBook] = useState('');
  const [chapter, setChapter] = useState('');
  const [verse, setVerse] = useState('');
  const [openDropdown, setOpenDropdown] = useState<'book' | 'chapter' | 'verse' | null>(null);
  const canvasRef = useRef<View>(null);
  const defaultSections = useMemo(
    () => makeJournalSections(CHURCH_DAY_SECTION_KEYS, t) as ChurchDaySection[],
    [t]
  );
  const [sections, setSections] = useState<ChurchDaySection[]>(() => defaultSections);
  const sectionsRef = useRef<ChurchDaySection[]>(defaultSections);
  const [stickers, setStickers] = useState<DecorSticker[]>([]);
  const [background, setBackground] = useState<string>('lined');
  const [highlightColor, setHighlightColor] = useState<string>('#FFF3A3');
  const [openDecor, setOpenDecor] = useState<'bg' | 'sticker' | 'highlight' | 'more' | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [undoHistory, setUndoHistory] = useState<ChurchDayUndoSnapshot[]>([]);

  const bookOptions = useMemo(() => getBooks(), []);
  const chapterOptions = useMemo(() => (book ? getChapters(book).map(String) : []), [book]);
  const verseOptions = useMemo(() => (book && chapter ? getVerses(book, Number(chapter)).map(String) : []), [book, chapter]);
  const verseText = useMemo(() => (book && chapter && verse ? getVerseText(book, Number(chapter), Number(verse), language.key) : ''), [book, chapter, verse, language.key]);
  const selectedBg = getShopBackground(background.startsWith('shop:') ? background.replace('shop:', '') : null);

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

  const updateIndex = useCallback(async (entry: ChurchDayEntry) => {
    const saved = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
    const entries = saved ? (JSON.parse(saved) as ChurchDayEntry[]) : [];
    const nextEntries = entries.some((item) => item.id === entry.id) ? entries.map((item) => (item.id === entry.id ? entry : item)) : [entry, ...entries];
    nextEntries.sort((a, b) => b.updatedAt - a.updatedAt);
    await AsyncStorage.setItem(JOURNAL_INDEX_KEY, JSON.stringify(nextEntries));
  }, []);

  const saveEntry = useCallback(async (nextBook: string, nextChapter: string, nextVerse: string, nextSections: ChurchDaySection[], nextStickers = stickers, nextBackground = background, nextHighlightColor = highlightColor) => {
    const id = entryId ?? newEntryToken ?? currentId ?? generateId();
    if (!currentId) setCurrentId(id);
    const entry: ChurchDayEntry = { id, type: 'church-day', date: entryDate, book: nextBook, chapter: nextChapter, verse: nextVerse, sections: nextSections, stickers: nextStickers, background: nextBackground, highlightColor: nextHighlightColor, preview: buildPreview(nextBook, nextChapter, nextVerse, nextSections), isFavorite: isFavorite, updatedAt: Date.now() };
    await AsyncStorage.setItem(`journal_church_day_${id}`, JSON.stringify(entry));
    await updateIndex(entry);
  }, [background, currentId, entryDate, entryId, highlightColor, isFavorite, newEntryToken, stickers, updateIndex]);

  const recordUndoSnapshot = useCallback(() => {
    setUndoHistory((currentHistory) => [...currentHistory.slice(-19), { book, chapter, verse, sections, stickers, background, highlightColor }]);
  }, [background, book, chapter, highlightColor, sections, stickers, verse]);

  const undoLastEdit = useCallback(() => {
    setUndoHistory((currentHistory) => {
      const previous = currentHistory[currentHistory.length - 1];
      if (!previous) return currentHistory;
      setBook(previous.book);
      setChapter(previous.chapter);
      setVerse(previous.verse);
      setSections(previous.sections);
      setStickers(previous.stickers);
      setBackground(previous.background);
      setHighlightColor(previous.highlightColor);
      setOpenDecor(null);
      void saveEntry(previous.book, previous.chapter, previous.verse, previous.sections, previous.stickers, previous.background, previous.highlightColor);
      return currentHistory.slice(0, -1);
    });
  }, [saveEntry]);

  useEffect(() => {
    const load = async () => {
      const storageEntryId = entryId ?? newEntryToken;

      if (storageEntryId) {
        const saved = await AsyncStorage.getItem(`journal_church_day_${storageEntryId}`);
        if (saved) {
          const parsed = JSON.parse(saved) as ChurchDayEntry;
          setCurrentId(parsed.id);
          setEntryDate(parsed.date || formatEntryDateTime(new Date()));
          setBook(parsed.book || ''); setChapter(parsed.chapter || ''); setVerse(parsed.verse || '');
          const loadedSections = Array.isArray(parsed.sections) ? parsed.sections : defaultSections;
          sectionsRef.current = loadedSections;
          setSections(loadedSections);
          setStickers(Array.isArray(parsed.stickers) ? parsed.stickers : []);
          setBackground(typeof parsed.background === 'string' ? parsed.background : 'lined');
          setHighlightColor(typeof parsed.highlightColor === 'string' ? parsed.highlightColor : '#FFF3A3');
          setIsFavorite(Boolean(parsed.isFavorite));
          setUndoHistory([]);
          return;
        }
      }

      if (!entryId) {
        const nextId = newEntryToken ?? generateId();
        const nextDate = formatEntryDateTime(new Date());
        setCurrentId(nextId);
        setEntryDate(nextDate);
        setBook('');
        setChapter('');
        setVerse('');
        setOpenDropdown(null);
        sectionsRef.current = defaultSections;
        setSections(defaultSections);
        setStickers([]);
        setBackground('lined');
        setHighlightColor('#FFF3A3');
        setOpenDecor(null);
        setIsFavorite(false);
        setUndoHistory([]);
        return;
      }
    };
    void load();
  }, [defaultSections, entryId, newEntryToken, updateIndex]);

  const updateSection = (id: string, text: string) => {
    recordUndoSnapshot();
    setSections((current) => {
      const next = current.map((section) => (section.id === id ? { ...section, text } : section));
      sectionsRef.current = next;
      void saveEntry(book, chapter, verse, next);
      return next;
    });
  };

  const toggleFavorite = async () => {
    const nextValue = !isFavorite;
    const latestSections = getLatestWebSections(sectionsRef.current);
    sectionsRef.current = latestSections;
    setIsFavorite(nextValue);
    const id = entryId ?? newEntryToken ?? currentId ?? generateId();
    const entry: ChurchDayEntry = { id, type: 'church-day', date: entryDate, book, chapter, verse, sections: latestSections, stickers, background, highlightColor, preview: buildPreview(book, chapter, verse, latestSections), isFavorite: nextValue, updatedAt: Date.now() };
    await AsyncStorage.setItem(`journal_church_day_${id}`, JSON.stringify(entry));
    await updateIndex(entry);
    if (!entryId) {
      router.replace({ pathname: '/church-day-journal', params: { entryId: id } });
    }
  };

  const captureSectionsBeforeAction = () => {
    const latestSections = getLatestWebSections(sectionsRef.current);
    sectionsRef.current = latestSections;
    setSections(latestSections);
  };

  const addNoteSection = () => {
    recordUndoSnapshot();
    const next = [...sections, { id: generateId(), label: t('editorNote'), text: '' }];
    sectionsRef.current = next;
    setSections(next);
    void saveEntry(book, chapter, verse, next);
  };

  const resetJournal = () => {
    recordUndoSnapshot();
    sectionsRef.current = defaultSections;
    setSections(defaultSections);
    setStickers([]);
    setBackground('lined');
    setHighlightColor('#FFF3A3');
    setOpenDecor(null);
    void saveEntry(book, chapter, verse, defaultSections, [], 'lined', '#FFF3A3');
  };
  const saveJournalImage = async () => {
    if (!canvasRef.current) return;
    const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
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
  const localizedSections = useMemo(
    () => localizeJournalSections(sections, CHURCH_DAY_SECTION_KEYS, t),
    [sections, t]
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: colorTheme.editorBackground }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollBeginDrag={() => { setOpenDropdown(null); }} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Image source={HEADER_ICON} style={styles.titleIcon} resizeMode="contain" />
          <Text style={styles.title}>{t('churchDay')}</Text>
        </View>
        <Text style={styles.date}>{entryDate}</Text>
        <TouchableOpacity style={styles.favoriteButton} onPressIn={captureSectionsBeforeAction} onPress={() => void toggleFavorite()} {...(Platform.OS === 'web' ? { onMouseDown: captureSectionsBeforeAction, onPointerDown: captureSectionsBeforeAction } : null)}><Text style={styles.favoriteButtonText}>{isFavorite ? `❤️ ${t('editorSavedToFavorites')}` : `🤍 ${t('editorSaveToFavorites')}`}</Text></TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.decorToolbar} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={[styles.decorButton, openDecor === 'highlight' ? styles.decorButtonActive : null]} onPress={() => setOpenDecor((c) => c === 'highlight' ? null : 'highlight')}>
            <Image source={JOURNAL_TOOLBAR_ICONS.text} style={styles.decorButtonIcon} resizeMode="contain" />
            <Text style={styles.decorButtonText}>{t('editorText')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.decorButton, openDecor === 'bg' ? styles.decorButtonActive : null]} onPress={() => setOpenDecor((c) => c === 'bg' ? null : 'bg')}>
            <Image source={JOURNAL_TOOLBAR_ICONS.canvas} style={styles.decorButtonIcon} resizeMode="contain" />
            <Text style={styles.decorButtonText}>{t('editorCanvas')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.decorButton, openDecor === 'sticker' ? styles.decorButtonActive : null]} onPress={() => setOpenDecor((c) => c === 'sticker' ? null : 'sticker')}>
            <Image source={JOURNAL_TOOLBAR_ICONS.decor} style={styles.decorButtonIcon} resizeMode="contain" />
            <Text style={styles.decorButtonText}>{t('editorDecor')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.decorButton} onPress={addNoteSection}>
            <Image source={JOURNAL_TOOLBAR_ICONS.note} style={styles.decorButtonIcon} resizeMode="contain" />
            <Text style={styles.decorButtonText}>{t('editorNote')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.decorButton, openDecor === 'more' ? styles.decorButtonActive : null]} onPress={() => setOpenDecor((c) => c === 'more' ? null : 'more')}>
            <Image source={JOURNAL_TOOLBAR_ICONS.more} style={styles.decorButtonIcon} resizeMode="contain" />
            <Text style={styles.decorButtonText}>{t('editorMore')}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={undoHistory.length === 0} style={[styles.decorButton, undoHistory.length === 0 ? styles.decorButtonDisabled : null]} onPress={undoLastEdit}>
            <Ionicons name="arrow-undo-outline" size={20} color="#4A403C" />
            <Text style={styles.decorButtonText}>{t('actionUndo')}</Text>
          </TouchableOpacity>
        </ScrollView>
        {openDecor === 'bg' ? <View style={styles.decorPanel}><Text style={styles.panelSectionTitle}>{t('editorBasic')}</Text><View style={styles.panelItemRow}><TouchableOpacity style={styles.simpleChip} onPress={() => { recordUndoSnapshot(); setBackground('lined'); setOpenDecor(null); void saveEntry(book, chapter, verse, sections, stickers, 'lined'); }}><Text>{t('editorLined')}</Text></TouchableOpacity><TouchableOpacity style={styles.simpleChip} onPress={() => { recordUndoSnapshot(); setBackground('plain'); setOpenDecor(null); void saveEntry(book, chapter, verse, sections, stickers, 'plain'); }}><Text>{t('editorPlain')}</Text></TouchableOpacity></View>{TEST_UNLOCKED_BACKGROUND_PACKS.map((pack) => <View key={pack.id} style={styles.panelSection}><Text style={styles.panelSectionTitle}>{pack.title}</Text><View style={styles.panelItemRow}>{pack.backgrounds.map((bg) => <TouchableOpacity key={bg.key} style={styles.bgChip} onPress={() => { recordUndoSnapshot(); const next = `shop:${bg.key}`; setBackground(next); setOpenDecor(null); void saveEntry(book, chapter, verse, sections, stickers, next); }}><Image source={bg.previewImage ?? bg.image} style={styles.bgPreview} /></TouchableOpacity>)}</View></View>)}</View> : null}
        {openDecor === 'sticker' ? <View style={styles.decorPanel}><Text style={styles.panelSectionTitle}>{t('editorQuickStickers')}</Text><View style={styles.panelItemRow}>{STICKER_CHOICES.map((emoji) => <TouchableOpacity key={emoji} style={styles.emojiChip} onPress={() => { recordUndoSnapshot(); const next = [...stickers, { id: `${Date.now()}-${stickers.length}`, emoji }]; setStickers(next); setOpenDecor(null); void saveEntry(book, chapter, verse, sections, next); }}><Text style={styles.emojiText}>{emoji}</Text></TouchableOpacity>)}</View>{TEST_UNLOCKED_STICKER_PACKS.map((pack) => <View key={pack.id} style={styles.panelSection}><Text style={styles.panelSectionTitle}>{pack.title}</Text><View style={styles.panelItemRow}>{pack.stickers.map((sticker) => <TouchableOpacity key={sticker.key} style={styles.stickerChip} onPress={() => { recordUndoSnapshot(); const next = [...stickers, { id: `${Date.now()}-${stickers.length}`, imageKey: sticker.key }]; setStickers(next); setOpenDecor(null); void saveEntry(book, chapter, verse, sections, next); }}><Image source={sticker.previewImage ?? sticker.image} style={styles.stickerPreview} /></TouchableOpacity>)}</View></View>)}</View> : null}
        {openDecor === 'highlight' ? <View style={styles.decorPanel}>{HIGHLIGHTER_COLORS.map((color) => <TouchableOpacity key={color} style={[styles.colorChip, { backgroundColor: color }, highlightColor === color ? styles.colorChipSelected : null]} onPress={() => { recordUndoSnapshot(); setHighlightColor(color); setOpenDecor(null); void saveEntry(book, chapter, verse, sections, stickers, background, color); }} />)}</View> : null}
        {openDecor === 'more' ? <View style={styles.decorPanel}><TouchableOpacity style={[styles.simpleChip, styles.moreActionChip]} onPress={() => void saveJournalImage()}><Ionicons name="download-outline" size={16} color="#5B514D" /><Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={styles.moreActionText}>{t('actionSaveImage')}</Text></TouchableOpacity><EncryptedCloudSaveAction buttonStyle={[styles.simpleChip, styles.moreActionChip]} textStyle={styles.moreActionText} iconColor="#5B514D" /><TouchableOpacity style={[styles.simpleChip, styles.moreActionChip]} onPress={() => void shareJournalImage()}><Ionicons name="share-outline" size={16} color="#5B514D" /><Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={styles.moreActionText}>{t('actionShare')}</Text></TouchableOpacity><TouchableOpacity style={[styles.simpleChip, styles.moreActionChip]} onPress={resetJournal}><Ionicons name="arrow-redo-outline" size={16} color="#5B514D" /><Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={styles.moreActionText}>{t('actionStartOver')}</Text></TouchableOpacity></View> : null}

        <View style={styles.dropdownRow}>{[{ key: 'book' as const, label: t('commonBook'), value: book || t('commonSelect'), options: bookOptions, onPick: (value: string) => { setBook(value); setChapter(''); setVerse(''); void saveEntry(value, '', '', sections); } }, { key: 'chapter' as const, label: t('commonChapter'), value: chapter || t('commonSelect'), options: chapterOptions, onPick: (value: string) => { setChapter(value); setVerse(''); void saveEntry(book, value, '', sections); } }, { key: 'verse' as const, label: t('commonVerse'), value: verse || t('commonSelect'), options: verseOptions, onPick: (value: string) => { setVerse(value); void saveEntry(book, chapter, value, sections); } }].map((dropdown) => (<View key={dropdown.key} style={styles.dropdownContainer}><Pressable onPress={() => setOpenDropdown((current) => current === dropdown.key ? null : dropdown.key)} style={[styles.dropdownButton, { backgroundColor: colorTheme.cardBackground }]}><Text style={styles.dropdownLabel}>{dropdown.label}</Text><Text numberOfLines={1} style={styles.dropdownValue}>{dropdown.value}</Text></Pressable>{openDropdown === dropdown.key ? <View style={[styles.dropdownMenu, { backgroundColor: colorTheme.screenBackground, borderColor: colorTheme.border }]}><ScrollView nestedScrollEnabled>{dropdown.options.map((option) => <Pressable key={option} onPress={() => { dropdown.onPick(option); setOpenDropdown(null); }} style={styles.dropdownOption}><Text style={styles.dropdownOptionText}>{option}</Text></Pressable>)}</ScrollView></View> : null}</View>))}</View>

        <View ref={canvasRef} collapsable={false}><ImageBackground source={selectedBg ? selectedBg.image : require('../assets/images/lined-paper.png')} resizeMode={selectedBg ? 'cover' : 'stretch'} style={[styles.canvasWrap, background === 'plain' ? { backgroundColor: colorTheme.paperBackground } : null]}>
          {stickers.length ? <View style={styles.stickerRow}>{stickers.map((sticker) => <Pressable key={sticker.id} onPress={() => { recordUndoSnapshot(); const next = stickers.filter((item) => item.id !== sticker.id); setStickers(next); void saveEntry(book, chapter, verse, sections, next); }} style={styles.stickerItem}>{sticker.imageKey && getShopSticker(sticker.imageKey) ? <Image source={getShopSticker(sticker.imageKey)!.image} style={styles.inlineStickerImage} resizeMode="contain" /> : <Text style={styles.inlineStickerEmoji}>{sticker.emoji}</Text>}</Pressable>)}</View> : null}
          {book && chapter && verse ? <TouchableOpacity activeOpacity={0.88} onPress={() => router.push({ pathname: '/studio', params: { saveTarget: 'church-day', openSelectedVerse: 'true', selectedBook: book, selectedChapter: chapter, selectedVerse: verse, selectionToken: String(Date.now()) } })} style={[styles.verseCard, { backgroundColor: colorTheme.paperBackground }]}><Text style={styles.verseRef}>{`${book} ${chapter}:${verse}`}</Text><Text style={styles.verseText}>{verseText}</Text><Text style={styles.decorateLink}>{t('editorDecorateVerseInStudio')}</Text></TouchableOpacity> : null}
          {localizedSections.map((section) => <Field key={section.id} label={section.label} value={section.text} onChangeText={(text) => updateSection(section.id, text)} placeholder={t('editorWriteHere')} cardBackground={colorTheme.cardBackground} accentColor={highlightColor} />)}
        </ImageBackground></View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 20 : 30, paddingBottom: 120 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIcon: { width: 36, height: 36 },
  title: { fontSize: 26, fontWeight: '700', color: '#1F1F1F' },
  date: { marginTop: 8, marginBottom: 16, color: '#7A6F66', fontSize: 13 },
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
  decorToolbar: { flexDirection: 'row', gap: 8, marginBottom: 10 }, decorButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3EDE8', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 }, decorButtonActive: { backgroundColor: '#E8DCD4', borderWidth: 1, borderColor: '#D4C2B8' }, decorButtonDisabled: { opacity: 0.45 }, decorButtonIcon: { width: 20, height: 20 }, decorButtonText: { fontSize: 12, fontWeight: '600', color: '#4A403C' }, decorPanel: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }, panelSection: { width: '100%' }, panelSectionTitle: { width: '100%', fontSize: 12, fontWeight: '700', color: '#6B5F57', marginTop: 2, marginBottom: 6 }, panelItemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }, simpleChip: { borderRadius: 12, backgroundColor: '#F8F5F2', paddingHorizontal: 10, paddingVertical: 8 }, moreActionChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexBasis: '30%', flexGrow: 1, minHeight: 36, gap: 6 }, moreActionText: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: '#4A403C' }, emojiChip: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8F5F2', alignItems: 'center', justifyContent: 'center' }, emojiText: { fontSize: 21 }, colorChip: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#D7CCC5' }, colorChipSelected: { borderWidth: 2, borderColor: '#1F1F1F' }, stickerChip: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8DCD4', alignItems: 'center', justifyContent: 'center' }, stickerPreview: { width: 40, height: 40 }, bgChip: { width: 58, height: 42, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E8DCD4' }, bgPreview: { width: '100%', height: '100%' },
  dropdownRow: { flexDirection: 'row', gap: 8, marginBottom: 14 }, dropdownContainer: { flex: 1, position: 'relative' }, dropdownButton: { borderRadius: 14, padding: 10, minHeight: 62 }, dropdownLabel: { fontSize: 10, color: '#8A7F76', fontWeight: '700', textTransform: 'uppercase' }, dropdownValue: { marginTop: 6, fontSize: 13, color: '#1F1F1F' }, dropdownMenu: { position: 'absolute', top: 68, left: 0, right: 0, maxHeight: 180, borderWidth: 1, borderRadius: 12, zIndex: 30 }, dropdownOption: { paddingHorizontal: 10, paddingVertical: 10 }, dropdownOptionText: { fontSize: 13, color: '#1F1F1F' },
  canvasWrap: { borderRadius: 14, padding: 12, overflow: 'hidden' }, stickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }, stickerItem: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }, inlineStickerEmoji: { fontSize: 24 }, inlineStickerImage: { width: 36, height: 36 },
  verseCard: { borderRadius: 16, padding: 14, marginBottom: 14 }, verseRef: { fontWeight: '700', color: '#8A7F76', marginBottom: 6, fontSize: 12 }, verseText: { color: '#333333', lineHeight: 22, fontSize: 15 }, decorateLink: { marginTop: 10, color: '#A0617B', fontWeight: '700', fontSize: 13 },
  section: { borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, borderLeftWidth: 4 }, sectionLabel: { color: '#1F1F1F', fontWeight: '600', marginBottom: 8, fontSize: 15 }, sectionInput: { minHeight: 92, fontSize: 15, color: '#333333', textAlignVertical: 'top' },
  label: { fontSize: 16, marginBottom: 8, color: '#444444' }, inputWrapper: { minHeight: MIN_INPUT_HEIGHT, position: 'relative', justifyContent: 'flex-start' }, inputMeasure: { fontSize: 16, color: 'transparent', paddingVertical: 8, lineHeight: 22 }, inputOverlay: { ...StyleSheet.absoluteFillObject, fontSize: 16, color: '#333333', paddingVertical: 8, lineHeight: 22 },
});
