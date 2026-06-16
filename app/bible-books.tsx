import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Image,
  Keyboard,
  Platform,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAppSettings } from '@/utils/app-settings';
import bible from '../assets/bible.json';

type BibleBook = {
  book: string;
  chapters: {
    chapter: number;
    verses: {
      verse: number;
      text: string;
    }[];
  }[];
};

const books = bible as BibleBook[];

const BOOK_ROW_HEIGHT = 66;
const SECTION_HEADER_HEIGHT = 36;
const BIBLE_HEADER_ICON = require('../assets/images/toolbar-icons/bible-tab.png');

function normalizeBookName(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
}

function parseReference(input: string) {
  const regex = /([1-3]?\s?[A-Za-z]+)\s(\d+):(\d+)/;
  const match = input.match(regex);

  if (!match) return null;

  return {
    book: match[1].trim(),
    chapter: parseInt(match[2], 10),
    verse: parseInt(match[3], 10),
  };
}

export default function BibleBooksScreen() {
  const router = useRouter();
  const { colorTheme, t } = useAppSettings();
  const sectionListRef = useRef<SectionList<BibleBook> | null>(null);
  const pendingScrollTargetRef = useRef<{
    sectionIndex: number;
    itemIndex: number;
  } | null>(null);
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const panelTranslateY = useSharedValue(0);
  const sections = useMemo(
    () => [
      { title: t('oldTestament'), data: books.slice(0, 39) },
      { title: t('newTestament'), data: books.slice(39) },
    ],
    [t]
  );

  const chapterOptions = selectedBook?.chapters.map((entry) => entry.chapter) ?? [];
  const verseOptions = useMemo(() => {
    if (!selectedBook || selectedChapter === null) {
      return [];
    }

    return (
      selectedBook.chapters.find((entry) => entry.chapter === selectedChapter)?.verses ?? []
    );
  }, [selectedBook, selectedChapter]);

  const closeSelectionPanel = () => {
    setSelectedBook(null);
    setSelectedChapter(null);
    setSelectedVerse(null);
  };

  const closeSelectionGesture = Gesture.Pan()
    .enabled(Platform.OS !== 'web')
    .activeOffsetY(1)
    .failOffsetX([-28, 28])
    .onUpdate((event) => {
      panelTranslateY.value = Math.max(0, Math.min(event.translationY, 420));
    })
    .onEnd((event) => {
      const shouldClose =
        event.translationY > 70 ||
        (event.velocityY > 500 && event.translationY > 10);

      if (shouldClose) {
        panelTranslateY.value = withTiming(520, { duration: 180 }, () => {
          runOnJS(closeSelectionPanel)();
        });
        return;
      }

      panelTranslateY.value = withSpring(0, {
        damping: 18,
        stiffness: 180,
      });
    });

  const selectionPanelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panelTranslateY.value }],
  }));

  const navigateToVerse = (book: string, chapter: number, verse: number) => {
    router.replace({
      pathname: '/studio',
      params: {
        openSelectedVerse: 'true',
        selectedBook: book,
        selectedChapter: String(chapter),
        selectedVerse: String(verse),
        selectionToken: String(Date.now()),
      },
    });
  };

  const scrollBookIntoView = (bookName: string) => {
    const sectionIndex = sections.findIndex((section) =>
      section.data.some((book) => book.book === bookName)
    );

    if (sectionIndex === -1) {
      return;
    }

    const itemIndex = sections[sectionIndex].data.findIndex(
      (book) => book.book === bookName
    );

    if (itemIndex === -1) {
      return;
    }

    pendingScrollTargetRef.current = { sectionIndex, itemIndex };

    const performScroll = () => {
      sectionListRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex,
        viewPosition: 0,
        viewOffset: 0,
        animated: true,
      });
    };

    requestAnimationFrame(performScroll);
    setTimeout(performScroll, 120);
  };

  const handleSearch = () => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      return;
    }

    Keyboard.dismiss();

    const ref = parseReference(trimmedQuery);

    if (ref) {
      const matchedBook = books.find(
        (book) => normalizeBookName(book.book) === normalizeBookName(ref.book)
      );
      const matchedChapter = matchedBook?.chapters.find(
        (chapter) => chapter.chapter === ref.chapter
      );
      const matchedVerse = matchedChapter?.verses.find(
        (verse) => verse.verse === ref.verse
      );

      if (matchedBook && matchedChapter && matchedVerse) {
        navigateToVerse(matchedBook.book, matchedChapter.chapter, matchedVerse.verse);
        return;
      }
    }

    console.log('Keyword search:', trimmedQuery);
  };

  const handleBookSelect = (book: BibleBook) => {
    if (selectedBook?.book === book.book) {
      closeSelectionPanel();
      return;
    }

    panelTranslateY.value = 0;
    scrollBookIntoView(book.book);

    const firstChapter = book.chapters[0]?.chapter ?? 1;
    const firstVerse = book.chapters[0]?.verses[0]?.verse ?? 1;

    setSelectedBook(book);
    setSelectedChapter(firstChapter);
    setSelectedVerse(firstVerse);
  };

  const handleChapterSelect = (chapter: number) => {
    if (!selectedBook) {
      return;
    }

    const firstVerse =
      selectedBook.chapters.find((entry) => entry.chapter === chapter)?.verses[0]?.verse ?? 1;

    setSelectedChapter(chapter);
    setSelectedVerse(firstVerse);
  };

  const handleVerseSelect = (verse: number) => {
    setSelectedVerse(verse);
  };

  const handleOpenVerse = () => {
    if (!selectedBook || selectedChapter === null || selectedVerse === null) {
      return;
    }

    navigateToVerse(selectedBook.book, selectedChapter, selectedVerse);
  };

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextBlock}>
          <View style={styles.titleRow}>
            <Image source={BIBLE_HEADER_ICON} style={styles.titleIcon} resizeMode="contain" />
            <Text style={styles.title}>{t('tabBible')}</Text>
          </View>
          <Text style={styles.subtitle}>{t('bibleSubtitle')}</Text>
        </View>

      </View>

      <View
        style={[
          styles.searchBar,
          { backgroundColor: colorTheme.toolbarBackground },
          isSearchFocused
            ? [styles.searchBarFocused, { backgroundColor: colorTheme.accent }]
            : null,
        ]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSearch}
          style={styles.searchIconButton}>
          <Ionicons name="search" size={18} color="#7A6F66" />
        </TouchableOpacity>

        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor="#9B928C"
          onSubmitEditing={handleSearch}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          returnKeyType="search"
          style={styles.searchInput}
        />

        {searchQuery.trim().length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}>
            <Ionicons name="close" size={16} color="#7A6F66" />
          </TouchableOpacity>
        ) : null}
      </View>

      <SectionList
        ref={sectionListRef}
        sections={sections}
        keyExtractor={(item) => item.book}
        contentContainerStyle={styles.listContent}
        onScrollToIndexFailed={(info) => {
          const pendingTarget = pendingScrollTargetRef.current;

          (
            sectionListRef.current as
              | (SectionList<BibleBook> & {
                  scrollToOffset?: (params: { offset: number; animated?: boolean }) => void;
                })
              | null
          )?.scrollToOffset?.({
            offset:
              info.index * BOOK_ROW_HEIGHT +
              info.highestMeasuredFrameIndex * 2 +
              SECTION_HEADER_HEIGHT,
            animated: true,
          });

          setTimeout(() => {
            if (!pendingTarget) {
              return;
            }

            sectionListRef.current?.scrollToLocation({
              sectionIndex: pendingTarget.sectionIndex,
              itemIndex: pendingTarget.itemIndex,
              viewPosition: 0,
              viewOffset: 0,
              animated: true,
            });
          }, 120);
        }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleBookSelect(item)}
            style={[
              styles.bookButton,
              { backgroundColor: colorTheme.toolbarBackground },
              selectedBook?.book === item.book
                ? [
                    styles.bookButtonSelected,
                    {
                      backgroundColor: colorTheme.cardBackground,
                      borderColor: colorTheme.border,
                    },
                  ]
                : null,
            ]}>
            <Text
              style={[
                styles.bookLabel,
                selectedBook?.book === item.book ? styles.bookLabelSelected : null,
              ]}>
              {item.book}
            </Text>
          </TouchableOpacity>
        )}
      />

      {selectedBook ? (
        <GestureDetector gesture={closeSelectionGesture}>
          <Animated.View
            style={[
              styles.selectionPanel,
              selectionPanelAnimatedStyle,
              {
                backgroundColor: colorTheme.screenBackground,
                borderColor: colorTheme.border,
              },
            ]}>
            <View style={styles.selectionHandle} />
            <Text style={styles.selectionTitle}>{selectedBook.book}</Text>

            <Text style={styles.selectionLabel}>{t('chapter')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}>
              {chapterOptions.map((chapter) => (
                <TouchableOpacity
                  key={`${selectedBook.book}-chapter-${chapter}`}
                  activeOpacity={0.85}
                  onPress={() => handleChapterSelect(chapter)}
                  style={[
                    styles.optionPill,
                    { backgroundColor: colorTheme.toolbarBackground },
                    selectedChapter === chapter
                      ? [
                          styles.optionPillSelected,
                          { backgroundColor: colorTheme.selectionBackground },
                        ]
                      : null,
                  ]}>
                  <Text
                    style={[
                      styles.optionPillText,
                      selectedChapter === chapter ? styles.optionPillTextSelected : null,
                    ]}>
                    {chapter}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text key={`verse-label-${t('verse')}`} style={styles.selectionLabel}>
              {t('verse')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}>
              {verseOptions.map((verse) => (
                <TouchableOpacity
                  key={`${selectedBook.book}-${selectedChapter}-verse-${verse.verse}`}
                  activeOpacity={0.85}
                  onPress={() => handleVerseSelect(verse.verse)}
                  style={[
                    styles.optionPill,
                    { backgroundColor: colorTheme.toolbarBackground },
                    selectedVerse === verse.verse
                      ? [
                          styles.optionPillSelected,
                          { backgroundColor: colorTheme.selectionBackground },
                        ]
                      : null,
                  ]}>
                  <Text
                    style={[
                      styles.optionPillText,
                      selectedVerse === verse.verse ? styles.optionPillTextSelected : null,
                    ]}>
                    {verse.verse}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              key={`open-${selectedBook.book}-${selectedChapter}-${selectedVerse}`}
              activeOpacity={0.9}
              onPress={handleOpenVerse}
              style={[styles.openButton, { backgroundColor: colorTheme.tint }]}>
              <Text style={styles.openButtonText}>
                {t('openReference', {
                  book: selectedBook.book,
                  chapter: selectedChapter ?? '',
                  verse: selectedVerse ?? '',
                })}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    paddingTop: Platform.OS === 'web' ? 24 : 60,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    width: 28,
    height: 28,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7A6F66',
  },
  headerRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  searchBar: {
    marginHorizontal: 20,
    marginBottom: 14,
    minHeight: 54,
    borderRadius: 24,
    backgroundColor: '#F4EFEA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchBarFocused: {
    backgroundColor: '#EDE4DD',
  },
  searchIconButton: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F1F1F',
    paddingVertical: 12,
  },
  clearButton: {
    height: 32,
    width: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'web' ? 96 : 220,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8D7C70',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 10,
  },
  bookButton: {
    backgroundColor: '#F3EDE8',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  bookButtonSelected: {
    backgroundColor: '#E8DCD4',
    borderWidth: 1,
    borderColor: '#D8C9BE',
  },
  bookLabel: {
    fontSize: 18,
    color: '#1F1F1F',
    fontWeight: '500',
  },
  bookLabelSelected: {
    fontWeight: '700',
  },
  selectionPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'web' ? 16 : 88,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFDF9',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  selectionHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D7CCC5',
    marginBottom: 12,
  },
  selectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  selectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8D7C70',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  pillRow: {
    paddingBottom: 12,
    gap: 8,
  },
  optionPill: {
    minWidth: 44,
    height: 40,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionPillSelected: {
    backgroundColor: '#E8DCD4',
    borderWidth: 1,
    borderColor: '#D8C9BE',
  },
  optionPillText: {
    fontSize: 16,
    color: '#1F1F1F',
    fontWeight: '500',
  },
  optionPillTextSelected: {
    fontWeight: '700',
  },
  openButton: {
    marginTop: 4,
    borderRadius: 20,
    backgroundColor: '#1F1F1F',
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButtonText: {
    color: '#FFFDF9',
    fontSize: 16,
    fontWeight: '700',
  },
});
