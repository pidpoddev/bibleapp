import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getBooks, getChapters, getVerses, getVerseText } from '@/utils/bible-data';
import { useAppSettings } from '@/utils/app-settings';

type BibleStudySection = {
  id: string;
  label: string;
  text: string;
};

type BibleStudyEntry = {
  id: string;
  type: 'bible-study';
  date: string;
  book: string;
  chapter: string;
  verse: string;
  sections: BibleStudySection[];
  preview: string;
  isFavorite: boolean;
  updatedAt: number;
};

const JOURNAL_INDEX_KEY = 'journal_index';
const MIN_INPUT_HEIGHT = 72;
const generateId = () => Date.now().toString();
const getFormattedDateTime = () =>
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

const getFormattedDateStamp = () => `${getFormattedDateTime()} • ${getFormattedTime()}`;

const defaultSections: BibleStudySection[] = [
  { id: '1', label: '💡 What stands out:', text: '' },
  { id: '2', label: '✨ What it means:', text: '' },
  { id: '3', label: '➡️ How I can apply it:', text: '' },
  { id: '4', label: '🙏 Prayer response:', text: '' },
  { id: '5', label: '🗒️ Notes:', text: '' },
];

type BibleStudySectionFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  cardBackground: string;
  accentColor: string;
};

const BibleStudySectionField = memo(function BibleStudySectionField({
  label,
  value,
  onChangeText,
  cardBackground,
  accentColor,
}: BibleStudySectionFieldProps) {
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

      <View style={styles.inputWrapper}>
        <Text pointerEvents="none" style={styles.inputMeasure}>
          {draftText.length ? `${draftText}\n` : ' '}
        </Text>
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

function buildPreview(
  book: string,
  chapter: string,
  verse: string,
  sections: BibleStudySection[]
) {
  const reference = [book.trim(), chapter.trim(), verse.trim() ? `:${verse.trim()}` : '']
    .join(' ')
    .replace(/\s+:$/, '')
    .trim();
  const reflection = sections
    .map((section) => section.text.trim())
    .filter(Boolean)
    .join(' ');

  return `${reference} ${reflection}`.trim().slice(0, 80);
}

function normalizeLoadedSectionText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/g, '');
}

export default function BibleStudyJournalScreen() {
  const { colorTheme, language } = useAppSettings();
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  const today = useMemo(() => getFormattedDateStamp(), []);
  const [currentId, setCurrentId] = useState(() => entryId ?? generateId());
  const [entryDate, setEntryDate] = useState(today);
  const [book, setBook] = useState('');
  const [chapter, setChapter] = useState('');
  const [verse, setVerse] = useState('');
  const [openDropdown, setOpenDropdown] = useState<'book' | 'chapter' | 'verse' | null>(
    null
  );
  const [sections, setSections] = useState<BibleStudySection[]>(defaultSections);
  const bookOptions = useMemo(() => getBooks(), []);
  const chapterOptions = useMemo(
    () => (book ? getChapters(book).map(String) : []),
    [book]
  );
  const verseOptions = useMemo(
    () =>
      book && chapter
        ? getVerses(book, Number(chapter)).map(String)
        : [],
    [book, chapter]
  );
  const verseText = useMemo(
    () =>
      book && chapter && verse
        ? getVerseText(book, Number(chapter), Number(verse), language.key)
        : '',
    [book, chapter, language.key, verse]
  );

  const updateIndex = useCallback(async (entry: BibleStudyEntry) => {
    try {
      const existingIndex = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
      const parsedIndex = existingIndex
        ? (JSON.parse(existingIndex) as BibleStudyEntry[])
        : [];

      const nextIndex = parsedIndex.some((item) => item.id === entry.id)
        ? parsedIndex.map((item) => (item.id === entry.id ? entry : item))
        : [entry, ...parsedIndex];

      nextIndex.sort((left, right) => right.updatedAt - left.updatedAt);

      await AsyncStorage.setItem(JOURNAL_INDEX_KEY, JSON.stringify(nextIndex));
    } catch (error) {
      console.log('Error updating bible study index:', error);
    }
  }, []);

  const saveEntry = useCallback(
    async (
      nextBook: string,
      nextChapter: string,
      nextVerse: string,
      nextSections: BibleStudySection[]
    ) => {
      const id = currentId || generateId();

      if (!currentId) {
        setCurrentId(id);
      }

      const entry: BibleStudyEntry = {
        id,
        type: 'bible-study',
        date: entryDate,
        book: nextBook,
        chapter: nextChapter,
        verse: nextVerse,
        sections: nextSections,
        preview: buildPreview(nextBook, nextChapter, nextVerse, nextSections),
        isFavorite: false,
        updatedAt: Date.now(),
      };

      try {
        await AsyncStorage.setItem(`journal_bible_study_${id}`, JSON.stringify(entry));
        await updateIndex(entry);
      } catch (error) {
        console.log('Error saving bible study:', error);
      }
    },
    [currentId, entryDate, updateIndex]
  );

  useEffect(() => {
    const loadEntry = async () => {
      if (!entryId) {
        await saveEntry('', '', '', defaultSections);
        return;
      }

      try {
        const storedEntry = await AsyncStorage.getItem(`journal_bible_study_${entryId}`);

        if (!storedEntry) {
          return;
        }

        const parsedEntry = JSON.parse(storedEntry) as BibleStudyEntry;

        setCurrentId(parsedEntry.id);
        setEntryDate(parsedEntry.date || today);
        setBook(parsedEntry.book || '');
        setChapter(parsedEntry.chapter || '');
        setVerse(parsedEntry.verse || '');
        const nextSections = Array.isArray(parsedEntry.sections)
          ? parsedEntry.sections.map((section) => ({
              ...section,
              text:
                typeof section.text === 'string'
                  ? normalizeLoadedSectionText(section.text)
                  : '',
            }))
          : defaultSections;
        setSections(nextSections);
      } catch (error) {
        console.log('Error loading bible study:', error);
      }
    };

    void loadEntry();
  }, [entryId, saveEntry, today]);

  const updateSection = useCallback((sectionId: string, text: string) => {
    setSections((currentSections) => {
      const updatedSections = currentSections.map((section, sectionIndex) =>
        section.id === sectionId ? { ...section, text } : section
      );

      void saveEntry(book, chapter, verse, updatedSections);
      return updatedSections;
    });
  }, [book, chapter, saveEntry, verse]);

  const handleBookSelect = (nextBook: string) => {
    setBook(nextBook);
    setChapter('');
    setVerse('');
    setOpenDropdown(null);
    void saveEntry(nextBook, '', '', sections);
  };

  const handleChapterSelect = (nextChapter: string) => {
    setChapter(nextChapter);
    setVerse('');
    setOpenDropdown(null);
    void saveEntry(book, nextChapter, '', sections);
  };

  const handleVerseSelect = (nextVerse: string) => {
    setVerse(nextVerse);
    setOpenDropdown(null);
    void saveEntry(book, chapter, nextVerse, sections);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colorTheme.editorBackground }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => setOpenDropdown(null)}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>📖 Bible Study</Text>
        <Text style={styles.date}>{entryDate}</Text>

        <View style={styles.referenceRow}>
          <View style={[styles.referenceDropdownContainer, styles.bookCard]}>
            <Pressable
              onPress={() =>
                setOpenDropdown((current) => (current === 'book' ? null : 'book'))
              }
              style={[styles.referenceCard, { backgroundColor: colorTheme.cardBackground }]}>
              <Text numberOfLines={1} style={styles.referenceLabel}>Book</Text>
              <View style={styles.referenceValueRow}>
                <Text numberOfLines={1} style={styles.referenceValueText}>
                  {book || 'Select'}
                </Text>
                <Text style={styles.referenceChevron}>▼</Text>
              </View>
            </Pressable>

            {openDropdown === 'book' ? (
              <View
                style={[
                  styles.dropdownMenu,
                  styles.bookDropdownMenu,
                  {
                    backgroundColor: colorTheme.screenBackground,
                    borderColor: colorTheme.border,
                  },
                ]}>
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator>
                  {bookOptions.map((bookOption) => (
                    <Pressable
                      key={bookOption}
                      onPress={() => handleBookSelect(bookOption)}
                      style={[
                        styles.dropdownOption,
                        book === bookOption
                          ? [
                              styles.dropdownOptionSelected,
                              { backgroundColor: colorTheme.selectionBackground },
                            ]
                          : null,
                      ]}>
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[
                          styles.dropdownOptionText,
                          book === bookOption && styles.dropdownOptionTextSelected,
                        ]}>
                        {bookOption}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View style={styles.referenceDropdownContainer}>
            <Pressable
              onPress={() => {
                if (!book) {
                  return;
                }

                setOpenDropdown((current) => (current === 'chapter' ? null : 'chapter'));
              }}
              style={[
                styles.referenceCard,
                { backgroundColor: colorTheme.cardBackground },
                !book && styles.referenceCardDisabled,
              ]}>
              <Text numberOfLines={1} style={styles.referenceLabel}>Chapter</Text>
              <View style={styles.referenceValueRow}>
                <Text numberOfLines={1} style={styles.referenceValueText}>
                  {chapter || 'Select'}
                </Text>
                <Text style={styles.referenceChevron}>▼</Text>
              </View>
            </Pressable>

            {openDropdown === 'chapter' ? (
              <View
                style={[
                  styles.dropdownMenu,
                  {
                    backgroundColor: colorTheme.screenBackground,
                    borderColor: colorTheme.border,
                  },
                ]}>
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator>
                  {chapterOptions.map((chapterOption) => (
                    <Pressable
                      key={chapterOption}
                      onPress={() => handleChapterSelect(chapterOption)}
                      style={[
                        styles.dropdownOption,
                        chapter === chapterOption
                          ? [
                              styles.dropdownOptionSelected,
                              { backgroundColor: colorTheme.selectionBackground },
                            ]
                          : null,
                      ]}>
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          chapter === chapterOption && styles.dropdownOptionTextSelected,
                        ]}>
                        {chapterOption}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View style={styles.referenceDropdownContainer}>
            <Pressable
              onPress={() => {
                if (!book || !chapter) {
                  return;
                }

                setOpenDropdown((current) => (current === 'verse' ? null : 'verse'));
              }}
              style={[
                styles.referenceCard,
                { backgroundColor: colorTheme.cardBackground },
                (!book || !chapter) && styles.referenceCardDisabled,
              ]}>
              <Text numberOfLines={1} style={styles.referenceLabel}>Verse</Text>
              <View style={styles.referenceValueRow}>
                <Text numberOfLines={1} style={styles.referenceValueText}>
                  {verse || 'Select'}
                </Text>
                <Text style={styles.referenceChevron}>▼</Text>
              </View>
            </Pressable>

            {openDropdown === 'verse' ? (
              <View
                style={[
                  styles.dropdownMenu,
                  {
                    backgroundColor: colorTheme.screenBackground,
                    borderColor: colorTheme.border,
                  },
                ]}>
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator>
                  {verseOptions.map((verseOption) => (
                    <Pressable
                      key={verseOption}
                      onPress={() => handleVerseSelect(verseOption)}
                      style={[
                        styles.dropdownOption,
                        verse === verseOption
                          ? [
                              styles.dropdownOptionSelected,
                              { backgroundColor: colorTheme.selectionBackground },
                            ]
                          : null,
                      ]}>
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          verse === verseOption && styles.dropdownOptionTextSelected,
                        ]}>
                        {verseOption}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>

        {book && chapter && verse && verseText ? (
          <View style={[styles.verseCard, { backgroundColor: colorTheme.paperBackground }]}>
            <Text style={styles.verseReference}>{`${book} ${chapter}:${verse}`}</Text>
            <Text style={styles.verseText}>{verseText}</Text>
          </View>
        ) : null}

        {sections.map((section) => (
          <BibleStudySectionField
            key={section.id}
            label={section.label}
            value={section.text}
            onChangeText={(text) => updateSection(section.id, text)}
            cardBackground={colorTheme.cardBackground}
            accentColor={colorTheme.accent}
          />
        ))}
      </ScrollView>
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
    paddingBottom: Platform.OS === 'web' ? 48 : 120,
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
    marginBottom: 20,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 18,
    zIndex: 20,
  },
  referenceDropdownContainer: {
    flex: 1,
    position: 'relative',
    zIndex: 30,
  },
  referenceCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bookCard: {
    flex: 1.5,
  },
  referenceCardDisabled: {
    opacity: 0.55,
  },
  referenceLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#8A7F76',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  referenceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  referenceValueText: {
    fontSize: 12,
    color: '#333333',
    flex: 1,
  },
  referenceChevron: {
    fontSize: 10,
    color: '#5B514D',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 74,
    left: 0,
    right: 0,
    maxHeight: 220,
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8DCD4',
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  bookDropdownMenu: {
    width: 180,
    right: 'auto',
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownOptionSelected: {
    backgroundColor: '#F3EDE8',
  },
  dropdownOptionText: {
    fontSize: 12,
    color: '#1F1F1F',
  },
  dropdownOptionTextSelected: {
    fontWeight: '600',
    color: '#5B514D',
  },
  verseCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  verseReference: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A7F76',
    marginBottom: 8,
  },
  verseText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#D8E4F6',
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
  inputWrapper: {
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
});
