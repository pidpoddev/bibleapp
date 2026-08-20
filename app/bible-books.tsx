import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  FlatList,
  Image,
  ImageBackground,
  Keyboard,
  Platform,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAppSettings } from '@/utils/app-settings';
import {
  getBibleReadVerseKeys,
  makeBibleVerseKey,
  markBibleVerseRead,
} from '@/utils/bible-reading-progress';
import {
  getBibleData,
  getBookDisplayName,
  getBookListLabel,
  getVerseText,
  type BibleBook,
  type BibleLanguageKey,
  type BibleVersionKey,
} from '@/utils/bible-data';
import {
  getGenesisReadingImage,
  type GenesisReadingImage,
} from '@/utils/genesis-reading-images';
import { FocusedScreenView } from '@/components/focused-screen-view';
import { BibleCanvasPreview } from '@/components/bible-canvas-preview';
import { useResponsiveLayout } from '@/utils/responsive-layout';
import { loadVerseDesigns, type VerseDesignListItem } from '@/utils/verse-design-list';

type SearchResult = {
  type: 'verse';
  book: string;
  chapter: number;
  verse: number;
  text: string;
};

type BookSearchResult = {
  type: 'book';
  book: BibleBook;
};

type BibleSearchResult = SearchResult | BookSearchResult;

type ReaderSelection = {
  book: string;
  chapter: number;
  verse: number;
};

type ReaderListItem =
  | {
      type: 'chapterHeader';
      key: string;
      book: string;
      chapter: number;
    }
  | {
      type: 'chapterImage';
      key: string;
      book: string;
      chapter: number;
      image: GenesisReadingImage;
    }
  | {
      type: 'verse';
      key: string;
      book: string;
      chapter: number;
      verse: number;
    };

const BOOK_ROW_HEIGHT = 66;
const SECTION_HEADER_HEIGHT = 36;
const BIBLE_HEADER_ICON = require('../assets/images/toolbar-icons/bible-tab.png');

function normalizeBookName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '');
}

function bookMatchesNameQuery(book: string, displayName: string, query: string) {
  const normalizedQuery = normalizeBookName(query);

  if (!normalizedQuery) {
    return false;
  }

  const normalizedBook = normalizeBookName(book);
  const displayCore = displayName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  const normalizedDisplayCore = normalizeBookName(displayCore);

  return (
    normalizedBook === normalizedQuery ||
    normalizedDisplayCore === normalizedQuery ||
    normalizedBook.startsWith(normalizedQuery) ||
    normalizedDisplayCore.startsWith(normalizedQuery)
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseReference(input: string) {
  const regex = /([1-3]?\s?[\p{L}.]+)\s(\d+):(\d+)/u;
  const match = input.match(regex);

  if (!match) return null;

  return {
    book: match[1].trim(),
    chapter: parseInt(match[2], 10),
    verse: parseInt(match[3], 10),
  };
}

function findReferenceResult(
  input: string,
  languageKey: BibleLanguageKey,
  versionKey: BibleVersionKey,
  books: BibleBook[]
): SearchResult | null {
  const reference = parseReference(input);

  if (!reference) {
    return null;
  }

  const normalizedReferenceBook = normalizeBookName(reference.book);
  const matchedBook = books.find((book) => {
    const displayName = getBookDisplayName(book.book, languageKey, versionKey);

    return (
      normalizeBookName(book.book) === normalizedReferenceBook ||
      normalizeBookName(displayName) === normalizedReferenceBook
    );
  });
  const matchedChapter = matchedBook?.chapters.find(
    (chapter) => chapter.chapter === reference.chapter
  );
  const matchedVerse = matchedChapter?.verses.find(
    (verse) => verse.verse === reference.verse
  );

  if (!matchedBook || !matchedChapter || !matchedVerse) {
    return null;
  }

  return {
    type: 'verse',
    book: matchedBook.book,
    chapter: matchedChapter.chapter,
    verse: matchedVerse.verse,
    text: getVerseText(
      matchedBook.book,
      matchedChapter.chapter,
      matchedVerse.verse,
      languageKey,
      versionKey
    ),
  };
}

export default function BibleBooksScreen() {
  const router = useRouter();
  const { colorTheme, language, bibleVersionKey, bibleReadingImagesEnabled, t } =
    useAppSettings();
  const layout = useResponsiveLayout();
  const sectionListRef = useRef<SectionList<BibleBook> | null>(null);
  const readingListRef = useRef<FlatList<ReaderListItem> | null>(null);
  const readerViewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
  const pendingScrollTargetRef = useRef<{
    sectionIndex: number;
    itemIndex: number;
  } | null>(null);
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<BibleSearchResult[]>([]);
  const [searchFeedback, setSearchFeedback] = useState('');
  const [highlightUnread, setHighlightUnread] = useState(true);
  const [hideRead, setHideRead] = useState(false);
  const [readVerseKeys, setReadVerseKeys] = useState<Set<string>>(() => new Set());
  const [readerSelection, setReaderSelection] = useState<ReaderSelection | null>(null);
  const [readerOpenToken, setReaderOpenToken] = useState(0);
  const [isSelectionPanelCollapsed, setIsSelectionPanelCollapsed] = useState(false);
  const [verseDesigns, setVerseDesigns] = useState<VerseDesignListItem[]>([]);
  const panelTranslateY = useSharedValue(0);
  const books = useMemo(() => getBibleData(bibleVersionKey), [bibleVersionKey]);
  const displayBookName = useCallback(
    (book: string) => getBookListLabel(book, language.key, bibleVersionKey),
    [bibleVersionKey, language.key]
  );
  const sections = useMemo(
    () => [
      { title: t('oldTestament'), data: books.slice(0, 39) },
      { title: t('newTestament'), data: books.slice(39) },
    ],
    [books, t]
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void loadVerseDesigns()
        .then((designs) => {
          if (isActive) setVerseDesigns(designs);
        })
        .catch((error) => console.warn('Failed to load Bible canvas previews', error));

      return () => {
        isActive = false;
      };
    }, [])
  );

  const designByVerse = useMemo(() => {
    const designs = new Map<string, VerseDesignListItem>();
    verseDesigns.filter((design) => design.includeInBible).forEach((design) => {
      design.selectedVerses.forEach((verse) => {
        const key = makeBibleVerseKey({ book: design.book, chapter: design.chapter, verse });
        if (!designs.has(key)) designs.set(key, design);
      });
    });
    return designs;
  }, [verseDesigns]);

  useEffect(() => {
    if (!selectedBook) {
      return;
    }

    const nextSelectedBook = books.find((book) => book.book === selectedBook.book);

    if (!nextSelectedBook) {
      setSelectedBook(null);
      setSelectedChapter(null);
      setSelectedVerse(null);
      setReaderSelection(null);
      return;
    }

    const nextSelectedChapter =
      nextSelectedBook.chapters.find((chapter) => chapter.chapter === selectedChapter) ??
      nextSelectedBook.chapters[0];
    const nextSelectedVerse =
      nextSelectedChapter?.verses.find((verse) => verse.verse === selectedVerse) ??
      nextSelectedChapter?.verses[0];

    setSelectedBook(nextSelectedBook);
    setSelectedChapter(nextSelectedChapter?.chapter ?? null);
    setSelectedVerse(nextSelectedVerse?.verse ?? null);
    setReaderSelection((currentSelection) =>
      currentSelection
        ? {
            book: nextSelectedBook.book,
            chapter: nextSelectedChapter?.chapter ?? currentSelection.chapter,
            verse: nextSelectedVerse?.verse ?? currentSelection.verse,
          }
        : currentSelection
    );
  }, [books, selectedBook, selectedChapter, selectedVerse]);

  const verseOptions = useMemo(() => {
    if (!selectedBook || selectedChapter === null) {
      return [];
    }

    return (
      selectedBook.chapters.find((entry) => entry.chapter === selectedChapter)?.verses ?? []
    );
  }, [selectedBook, selectedChapter]);
  const readerBook = useMemo(
    () => books.find((book) => book.book === readerSelection?.book) ?? null,
    [books, readerSelection?.book]
  );
  const isGenesisImageReader =
    bibleReadingImagesEnabled && readerSelection?.book === 'Genesis' && Boolean(readerBook);
  const readerItems = useMemo<ReaderListItem[]>(() => {
    if (!readerBook || !readerSelection) {
      return [];
    }

    if (isGenesisImageReader) {
      return readerBook.chapters
        .filter((chapter) => chapter.chapter >= readerSelection.chapter)
        .flatMap((chapter) => {
          const isSelectedChapter = chapter.chapter === readerSelection.chapter;
          const shouldStartAtSelectedVerse = isSelectedChapter && readerSelection.verse > 1;
          const items: ReaderListItem[] = [
            {
              type: 'chapterHeader',
              key: `${readerBook.book}-${chapter.chapter}-header`,
              book: readerBook.book,
              chapter: chapter.chapter,
            },
          ];

          const chapterImage = getGenesisReadingImage(chapter.chapter);
          if (chapterImage && !shouldStartAtSelectedVerse) {
            items.push({
              type: 'chapterImage',
              key: `${readerBook.book}-${chapter.chapter}-image`,
              book: readerBook.book,
              chapter: chapter.chapter,
              image: chapterImage,
            });
          }

          chapter.verses
            .filter((verse) => !shouldStartAtSelectedVerse || verse.verse >= readerSelection.verse)
            .forEach((verse) => {
              items.push({
                type: 'verse',
                key: `${readerBook.book}-${chapter.chapter}-${verse.verse}`,
                book: readerBook.book,
                chapter: chapter.chapter,
                verse: verse.verse,
              });
            });

          return items;
        });
    }

    return (
      readerBook.chapters
        .find((entry) => entry.chapter === readerSelection.chapter)
        ?.verses.filter((verse) => verse.verse >= readerSelection.verse) ?? []
    ).map((verse) => ({
      type: 'verse',
      key: `${readerBook.book}-${readerSelection.chapter}-${verse.verse}`,
      book: readerBook.book,
      chapter: readerSelection.chapter,
      verse: verse.verse,
    }));
  }, [isGenesisImageReader, readerBook, readerSelection]);
  const readerInitialIndex = Math.max(
    isGenesisImageReader && readerSelection?.verse === 1
      ? 0
      : readerItems.findIndex(
          (item) =>
            item.type === 'verse' &&
            item.chapter === readerSelection?.chapter &&
            item.verse === readerSelection?.verse
        ),
    0
  );
  useEffect(() => {
    if (!readerSelection || readerItems.length === 0) {
      return undefined;
    }

    const targetIndex = readerItems.findIndex(
      (item) =>
        item.type === 'verse' &&
        item.book === readerSelection.book &&
        item.chapter === readerSelection.chapter &&
        item.verse === readerSelection.verse
    );

    if (targetIndex < 0) {
      return undefined;
    }

    let isCancelled = false;
    const scrollToSelectedVerse = (animated: boolean) => {
      if (isCancelled) {
        return;
      }

      readingListRef.current?.scrollToIndex({
        index: targetIndex,
        animated,
        viewPosition: 0.08,
      });
    };
    const frame = requestAnimationFrame(() => scrollToSelectedVerse(false));
    const retry = setTimeout(() => scrollToSelectedVerse(true), 260);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(retry);
    };
  }, [
    readerItems,
    readerOpenToken,
    readerSelection,
  ]);
  const selectedChapterReadCount = useMemo(() => {
    if (!selectedBook || selectedChapter === null) {
      return 0;
    }

    return verseOptions.filter((verse) =>
      readVerseKeys.has(
        makeBibleVerseKey({
          book: selectedBook.book,
          chapter: selectedChapter,
          verse: verse.verse,
        })
      )
    ).length;
  }, [readVerseKeys, selectedBook, selectedChapter, verseOptions]);

  const selectedChapterUnreadCount = Math.max(verseOptions.length - selectedChapterReadCount, 0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      getBibleReadVerseKeys()
        .then((nextReadKeys) => {
          if (isActive) {
            setReadVerseKeys(nextReadKeys);
          }
        })
        .catch((error) => {
          console.warn('Failed to load Bible reading progress', error);
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const isVerseRead = useCallback(
    (book: string, chapter: number, verse: number) =>
      readVerseKeys.has(makeBibleVerseKey({ book, chapter, verse })),
    [readVerseKeys]
  );

  const getBookReadStats = useCallback(
    (book: BibleBook) => {
      const totalCount = book.chapters.reduce(
        (bookTotal, chapter) => bookTotal + chapter.verses.length,
        0
      );
      const readCount = book.chapters.reduce((bookTotal, chapter) => {
        return (
          bookTotal +
          chapter.verses.filter((verse) =>
            isVerseRead(book.book, chapter.chapter, verse.verse)
          ).length
        );
      }, 0);

      return {
        readCount,
        totalCount,
        unreadCount: Math.max(totalCount - readCount, 0),
      };
    },
    [isVerseRead]
  );

  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          data: hideRead
            ? section.data.filter((book) => getBookReadStats(book).unreadCount > 0)
            : section.data,
        }))
        .filter((section) => section.data.length > 0),
    [getBookReadStats, hideRead, sections]
  );

  const chapterOptions = useMemo(() => {
    if (!selectedBook) {
      return [];
    }

    return selectedBook.chapters
      .filter(
        (chapter) =>
          !hideRead ||
          chapter.verses.some(
            (verse) => !isVerseRead(selectedBook.book, chapter.chapter, verse.verse)
          )
      )
      .map((entry) => entry.chapter);
  }, [hideRead, isVerseRead, selectedBook]);

  const displayedVerseOptions = useMemo(() => {
    if (!selectedBook || selectedChapter === null) {
      return [];
    }

    return hideRead
      ? verseOptions.filter(
          (verse) => !isVerseRead(selectedBook.book, selectedChapter, verse.verse)
        )
      : verseOptions;
  }, [hideRead, isVerseRead, selectedBook, selectedChapter, verseOptions]);

  const collapseSelectionPanel = () => {
    setIsSelectionPanelCollapsed(true);
    panelTranslateY.value = 0;
  };

  const expandSelectionPanel = () => {
    setIsSelectionPanelCollapsed(false);
    panelTranslateY.value = 0;
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
          runOnJS(collapseSelectionPanel)();
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

  const markVerseAsRead = useCallback((book: string, chapter: number, verse: number) => {
    const nextReadKey = makeBibleVerseKey({ book, chapter, verse });

    setReadVerseKeys((currentKeys) => {
      if (currentKeys.has(nextReadKey)) {
        return currentKeys;
      }

      const nextReadKeys = new Set(currentKeys);
      nextReadKeys.add(nextReadKey);
      return nextReadKeys;
    });

    void markBibleVerseRead({ book, chapter, verse }).catch((error) => {
      console.warn('Failed to track Bible reading progress', error);
    });
  }, []);

  const openVerseInReader = (book: string, chapter: number, verse: number) => {
    Keyboard.dismiss();
    setSearchResults([]);
    setSearchFeedback('');
    setSearchQuery('');
    collapseSelectionPanel();
    markVerseAsRead(book, chapter, verse);
    setReaderOpenToken((currentToken) => currentToken + 1);
    setReaderSelection({ book, chapter, verse });
  };

  const sendVerseToStudio = (
    book: string,
    chapter: number,
    verse: number,
    existingDesign?: VerseDesignListItem
  ) => {
    markVerseAsRead(book, chapter, verse);
    router.push({
      pathname: '/studio',
      params: {
        saveTarget: 'bible-study',
        openSelectedVerse: 'true',
        selectedBook: book,
        selectedChapter: String(chapter),
        selectedVerse: String(verse),
        editDesignKey: existingDesign?.key ?? '',
        includeInBible: existingDesign ? '' : 'true',
        selectedVerses: existingDesign?.selectedVerses.join(',') ?? String(verse),
        selectionToken: String(Date.now()),
      },
    });
  };

  const scrollBookIntoView = (bookName: string) => {
    const sectionIndex = visibleSections.findIndex((section) =>
      section.data.some((book) => book.book === bookName)
    );

    if (sectionIndex === -1) {
      return;
    }

    const itemIndex = visibleSections[sectionIndex].data.findIndex(
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

  const updateKeywordSearchResults = (trimmedQuery: string) => {
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchFeedback('');
      return;
    }

    const exactReferenceMatch = findReferenceResult(
      trimmedQuery,
      language.key,
      bibleVersionKey,
      books
    );

    if (exactReferenceMatch) {
      const shouldHideReadMatch =
        hideRead &&
        isVerseRead(
          exactReferenceMatch.book,
          exactReferenceMatch.chapter,
          exactReferenceMatch.verse
        );
      setSearchResults(shouldHideReadMatch ? [] : [exactReferenceMatch]);
      setSearchFeedback(
        shouldHideReadMatch
          ? t('searchNoResultsText', { query: trimmedQuery })
          : t('searchResultCount', { count: 1, query: trimmedQuery })
      );
      return;
    }

    const normalizedQuery = normalizeSearchText(trimmedQuery);
    const matchingBooks = books
      .filter((book) => {
        const displayName = displayBookName(book.book);

        return bookMatchesNameQuery(book.book, displayName, trimmedQuery);
      })
      .filter((book) => !hideRead || getBookReadStats(book).unreadCount > 0)
      .map((book) => ({ type: 'book' as const, book }));
    const nextResults: BibleSearchResult[] = [...matchingBooks];

    books.some((book) =>
      book.chapters.some((chapter) =>
        chapter.verses.some((verse) => {
          if (nextResults.length >= 18) {
            return true;
          }

          const verseText = getVerseText(
            book.book,
            chapter.chapter,
            verse.verse,
            language.key,
            bibleVersionKey
          );
          if (
            !normalizeSearchText(verseText).includes(normalizedQuery) ||
            (hideRead && isVerseRead(book.book, chapter.chapter, verse.verse))
          ) {
            return false;
          }

          nextResults.push({
            type: 'verse',
            book: book.book,
            chapter: chapter.chapter,
            verse: verse.verse,
            text: verseText,
          });

          return nextResults.length >= 18;
        })
      )
    );

    setSearchResults(nextResults);
    setSearchFeedback(
      nextResults.length > 0
        ? t('searchResultCount', { count: nextResults.length, query: trimmedQuery })
        : t('searchNoResultsText', { query: trimmedQuery })
    );
  };

  const handleSearchTextChange = (nextQuery: string) => {
    setSearchQuery(nextQuery);
    updateKeywordSearchResults(nextQuery.trim());
  };

  const handleSearch = () => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchFeedback('');
      return;
    }

    Keyboard.dismiss();

    const exactReferenceMatch = findReferenceResult(
      trimmedQuery,
      language.key,
      bibleVersionKey,
      books
    );

    if (exactReferenceMatch) {
      setSearchResults([exactReferenceMatch]);
      setSearchFeedback(t('searchResultCount', { count: 1, query: trimmedQuery }));
      openVerseInReader(
        exactReferenceMatch.book,
        exactReferenceMatch.chapter,
        exactReferenceMatch.verse
      );
      return;
    }

    const exactBookMatch = books.find(
      (book) =>
        (normalizeBookName(book.book) === normalizeBookName(trimmedQuery) ||
          normalizeBookName(displayBookName(book.book)) === normalizeBookName(trimmedQuery)) &&
        (!hideRead || getBookReadStats(book).unreadCount > 0)
    );

    if (exactBookMatch) {
      handleBookSearchResultPress(exactBookMatch);
      return;
    }

    updateKeywordSearchResults(trimmedQuery);
  };

  const handleBookSelect = (book: BibleBook) => {
    if (selectedBook?.book === book.book) {
      collapseSelectionPanel();
      return;
    }

    panelTranslateY.value = 0;
    setIsSelectionPanelCollapsed(false);
    scrollBookIntoView(book.book);
    setReaderSelection(null);
    setSearchResults([]);
    setSearchFeedback('');

    const firstVisibleChapter =
      book.chapters.find(
        (chapter) =>
          !hideRead ||
          chapter.verses.some((verse) => !isVerseRead(book.book, chapter.chapter, verse.verse))
      ) ?? book.chapters[0];
    const firstChapter = firstVisibleChapter?.chapter ?? 1;
    const firstVerse =
      firstVisibleChapter?.verses.find(
        (verse) => !hideRead || !isVerseRead(book.book, firstChapter, verse.verse)
      )?.verse ??
      firstVisibleChapter?.verses[0]?.verse ??
      1;

    setSelectedBook(book);
    setSelectedChapter(firstChapter);
    setSelectedVerse(firstVerse);
  };

  const handleBookSearchResultPress = (book: BibleBook) => {
    Keyboard.dismiss();
    setSearchResults([]);
    setSearchFeedback('');
    setSearchQuery('');
    handleBookSelect(book);
  };

  const handleChapterSelect = (chapter: number) => {
    if (!selectedBook) {
      return;
    }

    const chapterVerses =
      selectedBook.chapters.find((entry) => entry.chapter === chapter)?.verses ?? [];
    const firstVerse =
      chapterVerses.find(
        (verse) => !hideRead || !isVerseRead(selectedBook.book, chapter, verse.verse)
      )?.verse ??
      chapterVerses[0]?.verse ??
      1;

    setSelectedChapter(chapter);
    setSelectedVerse(firstVerse);
  };

  const handleVerseSelect = (verse: number) => {
    setSelectedVerse(verse);
  };

  const handleToggleHideRead = () => {
    setHideRead((currentValue) => {
      const nextValue = !currentValue;

      if (nextValue && selectedBook) {
        const firstUnreadChapter = selectedBook.chapters.find((chapter) =>
          chapter.verses.some((verse) => !isVerseRead(selectedBook.book, chapter.chapter, verse.verse))
        );
        const firstUnreadVerse = firstUnreadChapter?.verses.find(
          (verse) =>
            firstUnreadChapter &&
            !isVerseRead(selectedBook.book, firstUnreadChapter.chapter, verse.verse)
        );

        if (firstUnreadChapter && firstUnreadVerse) {
          setSelectedChapter(firstUnreadChapter.chapter);
          setSelectedVerse(firstUnreadVerse.verse);
        } else {
          collapseSelectionPanel();
        }
      }

      return nextValue;
    });
  };

  const handleOpenVerse = () => {
    if (!selectedBook || selectedChapter === null || selectedVerse === null) {
      return;
    }

    openVerseInReader(selectedBook.book, selectedChapter, selectedVerse);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchFeedback('');
  };

  const handleReaderViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!readerSelection) {
        return;
      }

      viewableItems.forEach((item) => {
        const readerItem = item.item as ReaderListItem | undefined;

        if (!readerItem || readerItem.type !== 'verse') {
          return;
        }

        markVerseAsRead(readerItem.book, readerItem.chapter, readerItem.verse);
      });
    },
    [markVerseAsRead, readerSelection]
  );

  const isShowingSearchResults = searchQuery.trim().length > 0 && (searchResults.length > 0 || searchFeedback.length > 0);
  const hasOpenSelectionPanel = selectedBook !== null && !isSelectionPanelCollapsed;
  const selectionSummary =
    selectedBook && selectedChapter !== null && selectedVerse !== null
      ? `${displayBookName(selectedBook.book)} ${selectedChapter}:${selectedVerse}`
      : selectedBook?.book
        ? displayBookName(selectedBook.book)
        : undefined;

  return (
    <FocusedScreenView style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <View
        style={[
          styles.headerRow,
          layout.isTablet
            ? [
                styles.tabletPageWidth,
                {
                  maxWidth: layout.contentMaxWidth,
                  paddingHorizontal: layout.pagePaddingHorizontal,
                },
              ]
            : null,
        ]}>
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
          layout.isTablet
            ? [
                styles.tabletPageWidth,
                {
                  maxWidth: layout.contentMaxWidth,
                  marginHorizontal: layout.pagePaddingHorizontal,
                },
              ]
            : null,
          { backgroundColor: colorTheme.toolbarBackground },
          isSearchFocused
            ? [styles.searchBarFocused, { backgroundColor: colorTheme.accent }]
            : null,
        ]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSearch}
          accessibilityRole="button"
          accessibilityLabel={t('bibleSearchAccessibility')}
          style={styles.searchIconButton}>
          <Ionicons name="search" size={18} color="#7A6F66" />
        </TouchableOpacity>

        <TextInput
          value={searchQuery}
          onChangeText={handleSearchTextChange}
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
            onPress={clearSearch}
            accessibilityRole="button"
            accessibilityLabel={t('bibleClearSearchAccessibility')}
            style={styles.clearButton}>
            <Ionicons name="close" size={16} color="#7A6F66" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View
        style={[
          styles.filterToggleRow,
          layout.isTablet
            ? [
                styles.tabletPageWidth,
                {
                  maxWidth: layout.contentMaxWidth,
                  marginHorizontal: layout.pagePaddingHorizontal,
                },
              ]
            : null,
        ]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setHighlightUnread((currentValue) => !currentValue)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: highlightUnread }}
          accessibilityLabel={t('bibleHighlightUnreadAccessibility')}
          style={[
            styles.highlightToggle,
            {
              backgroundColor: colorTheme.toolbarBackground,
              borderColor: highlightUnread ? colorTheme.tint : colorTheme.border,
            },
          ]}>
          <View
            style={[
              styles.highlightCheckbox,
              highlightUnread
                ? { backgroundColor: colorTheme.tint, borderColor: colorTheme.tint }
                : null,
            ]}>
            {highlightUnread ? <Ionicons name="checkmark" size={14} color="#FFFDF9" /> : null}
          </View>
          <Text style={styles.highlightToggleLabel}>{t('bibleHighlightUnread')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleToggleHideRead}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hideRead }}
          accessibilityLabel={t('bibleHideReadAccessibility')}
          style={[
            styles.highlightToggle,
            {
              backgroundColor: colorTheme.toolbarBackground,
              borderColor: hideRead ? colorTheme.tint : colorTheme.border,
            },
          ]}>
          <View
            style={[
              styles.highlightCheckbox,
              hideRead ? { backgroundColor: colorTheme.tint, borderColor: colorTheme.tint } : null,
            ]}>
            {hideRead ? <Ionicons name="checkmark" size={14} color="#FFFDF9" /> : null}
          </View>
          <Text style={styles.highlightToggleLabel}>{t('bibleHideRead')}</Text>
        </TouchableOpacity>
      </View>

      {isShowingSearchResults ? (
        <ScrollView
          contentContainerStyle={[
            styles.listContent,
            layout.isTablet
              ? [
                  styles.tabletListContent,
                  {
                    maxWidth: layout.contentMaxWidth,
                    paddingHorizontal: layout.pagePaddingHorizontal,
                  },
                ]
              : null,
            hasOpenSelectionPanel ? styles.listContentWithSelection : null,
          ]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>{t('searchMatchesTitle')}</Text>
          <Text style={styles.searchFeedback}>{searchFeedback}</Text>

          {searchResults.length > 0 ? (
            searchResults.map((result) => {
              if (result.type === 'book') {
                return (
                  <TouchableOpacity
                    key={`book-${result.book.book}`}
                    activeOpacity={0.88}
                    onPress={() => handleBookSearchResultPress(result.book)}
                    style={[
                      styles.resultCard,
                      styles.bookResultCard,
                      {
                        backgroundColor: colorTheme.cardBackground,
                        borderColor: colorTheme.border,
                      },
                    ]}>
                    <View style={styles.bookResultIcon}>
                      <Ionicons name="book-outline" size={18} color="#7A6F66" />
                    </View>
                    <View style={styles.bookResultText}>
                      <Text style={styles.resultReference}>{displayBookName(result.book.book)}</Text>
                      <Text style={styles.resultText}>
                        {result.book.chapters.length} {t('commonChapters')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#8D7C70" />
                  </TouchableOpacity>
                );
              }

              const hasReadVerse = isVerseRead(result.book, result.chapter, result.verse);

              return (
                <TouchableOpacity
                  key={`${result.book}-${result.chapter}-${result.verse}`}
                  activeOpacity={0.88}
                  onPress={() => openVerseInReader(result.book, result.chapter, result.verse)}
                  style={[
                    styles.resultCard,
                    highlightUnread && !hasReadVerse ? styles.unreadResultCard : null,
                    highlightUnread && hasReadVerse ? styles.readResultCard : null,
                    {
                      backgroundColor: colorTheme.cardBackground,
                      borderColor: colorTheme.border,
                    },
                  ]}>
                  <View style={styles.resultReferenceRow}>
                    <Text
                      style={[
                        styles.resultReference,
                        highlightUnread && !hasReadVerse ? styles.unreadReferenceText : null,
                        highlightUnread && hasReadVerse ? styles.readReferenceText : null,
                      ]}>
                      {displayBookName(result.book)} {result.chapter}:{result.verse}
                    </Text>
                    {highlightUnread ? (
                      <Text style={hasReadVerse ? styles.readBadge : styles.unreadBadge}>
                        {hasReadVerse ? t('commonRead') : t('commonUnread')}
                      </Text>
                    ) : null}
                  </View>
                  <Text numberOfLines={3} style={styles.resultText}>
                    {result.text}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <View
              style={[
                styles.emptySearchCard,
                {
                  backgroundColor: colorTheme.cardBackground,
                  borderColor: colorTheme.border,
                },
              ]}>
              <Text style={styles.emptySearchTitle}>{t('searchNoResultsTitle')}</Text>
              <Text style={styles.emptySearchText}>{searchFeedback}</Text>
            </View>
          )}
        </ScrollView>
      ) : readerSelection && readerBook ? (
        <FlatList
          ref={readingListRef}
          data={readerItems}
          key={`${readerSelection.book}-${readerSelection.chapter}-${readerOpenToken}-${
            isGenesisImageReader ? 'images' : 'plain'
          }`}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[
            styles.readerContent,
            layout.isTablet
              ? [
                  styles.tabletReaderContent,
                  {
                    maxWidth: layout.readingMaxWidth,
                    paddingHorizontal: layout.pagePaddingHorizontal,
                  },
                ]
              : null,
          ]}
          initialScrollIndex={readerInitialIndex}
          onScrollToIndexFailed={(info) => {
            readingListRef.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * info.index),
              animated: false,
            });

            setTimeout(() => {
              readingListRef.current?.scrollToIndex({
                index: Math.min(info.index, Math.max(readerItems.length - 1, 0)),
                animated: false,
                viewPosition: 0.08,
              });
            }, 100);
          }}
          onViewableItemsChanged={handleReaderViewableItemsChanged}
          viewabilityConfig={readerViewabilityConfig}
          ListHeaderComponent={
            <View style={styles.readerHeader}>
              <TouchableOpacity
                activeOpacity={0.84}
                onPress={() => setReaderSelection(null)}
                accessibilityRole="button"
                accessibilityLabel={t('bibleBackToBooksAccessibility')}
                style={styles.readerBackButton}>
                <Ionicons name="chevron-back" size={16} color="#5B514D" />
                <Text style={styles.readerBackText}>{t('bibleBackToBooks')}</Text>
              </TouchableOpacity>
              <Text style={styles.readerTitle}>
                {isGenesisImageReader
                  ? displayBookName(readerSelection.book)
                  : `${displayBookName(readerSelection.book)} ${readerSelection.chapter}`}
              </Text>
              <Text style={styles.readerSubtitle}>
                {isGenesisImageReader
                  ? t('bibleReaderGenesisSubtitle')
                  : t('bibleReaderVerseSubtitle')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'chapterHeader') {
              return (
                <View style={styles.readerChapterHeader}>
                  <Text style={styles.readerChapterEyebrow}>{displayBookName(item.book)}</Text>
                  <Text style={styles.readerChapterTitle}>
                    {displayBookName(item.book)} {item.chapter}
                  </Text>
                </View>
              );
            }

            if (item.type === 'chapterImage') {
              return (
                <View
                  style={[
                    styles.readerChapterImageCard,
                    {
                      backgroundColor: colorTheme.cardBackground,
                      borderColor: colorTheme.border,
                    },
                  ]}>
                  <ImageBackground
                    source={item.image.image}
                    resizeMode="cover"
                    imageStyle={styles.readerChapterImageBackgroundImage}
                    style={styles.readerChapterImageBackground}>
                    <View style={styles.readerChapterImageOverlay}>
                      <Text style={styles.readerChapterImageEyebrow}>
                        {displayBookName(item.book)} {item.chapter}
                      </Text>
                      <Text style={styles.readerChapterImageTitle}>
                        {item.image.title[language.key] ?? item.image.title.en}
                      </Text>
                    </View>
                  </ImageBackground>
                  <Text style={styles.readerChapterImageSummary}>
                    {item.image.summary[language.key] ?? item.image.summary.en}
                  </Text>
                </View>
              );
            }

            const hasReadVerse = isVerseRead(
              item.book,
              item.chapter,
              item.verse
            );
            const verseText = getVerseText(
              item.book,
              item.chapter,
              item.verse,
              language.key,
              bibleVersionKey
            );
            const verseDesign = designByVerse.get(
              makeBibleVerseKey({ book: item.book, chapter: item.chapter, verse: item.verse })
            );

            return (
              <View
                style={[
                  styles.readerVerseCard,
                  {
                    backgroundColor: colorTheme.cardBackground,
                    borderColor: colorTheme.border,
                  },
                  highlightUnread && !hasReadVerse ? styles.readerVerseUnread : null,
                ]}>
                <View style={styles.readerVerseTopRow}>
                  <Text
                    style={[
                      styles.readerVerseNumber,
                      highlightUnread && !hasReadVerse ? styles.readerVerseNumberUnread : null,
                    ]}>
                    {item.verse}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      sendVerseToStudio(
                        item.book,
                        item.chapter,
                        item.verse,
                        verseDesign
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t('bibleSendToStudioAccessibility', {
                      reference: `${displayBookName(item.book)} ${item.chapter}:${item.verse}`,
                    })}
                    style={styles.readerStudioButton}>
                    <Ionicons
                      name={verseDesign ? 'color-wand' : 'color-wand-outline'}
                      size={17}
                      color="#5B514D"
                    />
                  </TouchableOpacity>
                </View>
                {verseDesign ? (
                  <View style={styles.readerCanvasWrap}>
                    <BibleCanvasPreview design={verseDesign} />
                    <Text style={styles.readerCanvasCaption}>My Canvas · {displayBookName(item.book)} {item.chapter}:{item.verse}</Text>
                  </View>
                ) : (
                  <Text style={styles.readerVerseText}>{verseText}</Text>
                )}
              </View>
            );
          }}
        />
      ) : (
        <SectionList
          ref={sectionListRef}
          sections={visibleSections}
          keyExtractor={(item) => item.book}
          contentContainerStyle={[
            styles.listContent,
            layout.isTablet
              ? [
                  styles.tabletListContent,
                  {
                    maxWidth: layout.contentMaxWidth,
                    paddingHorizontal: layout.pagePaddingHorizontal,
                  },
                ]
              : null,
            hasOpenSelectionPanel ? styles.listContentWithSelection : null,
          ]}
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
          ListEmptyComponent={
            <View
              style={[
                styles.emptySearchCard,
                {
                  backgroundColor: colorTheme.cardBackground,
                  borderColor: colorTheme.border,
                },
              ]}>
              <Text style={styles.emptySearchTitle}>{t('bibleEverythingVisibleRead')}</Text>
              <Text style={styles.emptySearchText}>
                {t('bibleShowCompletedBooks')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const bookStats = getBookReadStats(item);
            const hasUnreadVerses = bookStats.unreadCount > 0;

            return (
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
                  highlightUnread && hasUnreadVerses ? styles.bookButtonHasUnread : null,
                ]}>
                <View style={styles.bookRowText}>
                  <Text
                    style={[
                      styles.bookLabel,
                      selectedBook?.book === item.book ? styles.bookLabelSelected : null,
                      highlightUnread && hasUnreadVerses ? styles.bookLabelHasUnread : null,
                    ]}>
                    {displayBookName(item.book)}
                  </Text>
                  {highlightUnread ? (
                    <Text style={styles.bookProgressText}>
                      {t('bibleBookProgress', {
                        read: bookStats.readCount,
                        total: bookStats.totalCount,
                      })}
                    </Text>
                  ) : null}
                </View>
                {highlightUnread && hasUnreadVerses ? (
                  <Text style={styles.unreadBookBadge}>
                    {t('bibleUnreadCount', { count: bookStats.unreadCount })}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {selectedBook && isSelectionPanelCollapsed ? (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={expandSelectionPanel}
          accessibilityRole="button"
          accessibilityLabel={t('bibleShowSelectorAccessibility', {
            reference: selectionSummary ?? '',
          })}
          style={[
            styles.collapsedSelectionTab,
            layout.isTablet ? styles.tabletSelectionTab : null,
            {
              backgroundColor: colorTheme.screenBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <View style={styles.collapsedSelectionHandle} />
        </TouchableOpacity>
      ) : null}

      {selectedBook && !isSelectionPanelCollapsed ? (
        <GestureDetector gesture={closeSelectionGesture}>
          <Animated.View
            style={[
              styles.selectionPanel,
              layout.isTablet ? styles.tabletSelectionPanel : null,
              selectionPanelAnimatedStyle,
              {
                backgroundColor: colorTheme.screenBackground,
                borderColor: colorTheme.border,
              },
            ]}>
            <View style={styles.selectionHandle} />
            <Text style={styles.selectionTitle}>{displayBookName(selectedBook.book)}</Text>

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
              {highlightUnread && verseOptions.length > 0
                ? ` · ${t('bibleChapterUnreadCount', { count: selectedChapterUnreadCount })}`
                : ''}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}>
              {displayedVerseOptions.map((verse) => {
                const hasReadVerse =
                  selectedChapter !== null &&
                  isVerseRead(selectedBook.book, selectedChapter, verse.verse);

                return (
                  <TouchableOpacity
                    key={`${selectedBook.book}-${selectedChapter}-verse-${verse.verse}`}
                    activeOpacity={0.85}
                    onPress={() => handleVerseSelect(verse.verse)}
                    style={[
                      styles.optionPill,
                      { backgroundColor: colorTheme.toolbarBackground },
                      highlightUnread && !hasReadVerse ? styles.unreadVersePill : null,
                      highlightUnread && hasReadVerse ? styles.readVersePill : null,
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
                        highlightUnread && !hasReadVerse ? styles.unreadVersePillText : null,
                        highlightUnread && hasReadVerse ? styles.readVersePillText : null,
                        selectedVerse === verse.verse ? styles.optionPillTextSelected : null,
                      ]}>
                      {verse.verse}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {hideRead && selectedChapterUnreadCount === 0 ? (
              <Text style={styles.noUnreadText}>{t('bibleAllVersesRead')}</Text>
            ) : null}

            <TouchableOpacity
              key={`open-${selectedBook.book}-${selectedChapter}-${selectedVerse}`}
              activeOpacity={0.9}
              onPress={handleOpenVerse}
              style={[styles.openButton, { backgroundColor: colorTheme.tint }]}>
              <Text style={styles.openButtonText}>
                {t('openReference', {
                  book: displayBookName(selectedBook.book),
                  chapter: selectedChapter ?? '',
                  verse: selectedVerse ?? '',
                })}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
      ) : null}
    </FocusedScreenView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    paddingTop: Platform.OS === 'web' ? 24 : 60,
  },
  tabletPageWidth: {
    width: '100%',
    alignSelf: 'center',
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
  filterToggleRow: {
    marginHorizontal: 20,
    marginBottom: 2,
    flexDirection: 'row',
    gap: 8,
  },
  highlightToggle: {
    flex: 1,
    minHeight: 44,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highlightCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C9BBB0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF9',
  },
  highlightToggleLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#4E433E',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'web' ? 96 : 220,
  },
  tabletListContent: {
    width: '100%',
    alignSelf: 'center',
  },
  listContentWithSelection: {
    paddingBottom: Platform.OS === 'web' ? 320 : 380,
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
  searchFeedback: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7A6F66',
    marginBottom: 10,
  },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  unreadResultCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#B7773C',
  },
  readResultCard: {
    opacity: 0.7,
  },
  resultReferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  resultReference: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B514D',
    marginBottom: 6,
  },
  unreadReferenceText: {
    color: '#3F2F24',
    fontWeight: '900',
  },
  readReferenceText: {
    color: '#8D8178',
    fontWeight: '600',
  },
  unreadBadge: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#FFF2D7',
    color: '#7A4A16',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  readBadge: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#ECE5DE',
    color: '#81756D',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#3F3934',
  },
  bookResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookResultText: {
    flex: 1,
  },
  emptySearchCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptySearchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5B514D',
    marginBottom: 6,
  },
  emptySearchText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7A6F66',
  },
  bookButton: {
    backgroundColor: '#F3EDE8',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bookButtonSelected: {
    backgroundColor: '#E8DCD4',
    borderWidth: 1,
    borderColor: '#D8C9BE',
  },
  bookButtonHasUnread: {
    borderLeftWidth: 5,
    borderLeftColor: '#B7773C',
  },
  bookRowText: {
    flex: 1,
  },
  bookLabel: {
    fontSize: 18,
    color: '#1F1F1F',
    fontWeight: '500',
  },
  bookLabelSelected: {
    fontWeight: '700',
  },
  bookLabelHasUnread: {
    fontWeight: '800',
  },
  bookProgressText: {
    marginTop: 3,
    fontSize: 12,
    color: '#7A6F66',
    fontWeight: '600',
  },
  unreadBookBadge: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#FFF2D7',
    color: '#7A4A16',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  readerContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'web' ? 96 : 160,
  },
  tabletReaderContent: {
    width: '100%',
    alignSelf: 'center',
  },
  readerHeader: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  readerBackButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#F3EDE8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  readerBackText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5B514D',
  },
  readerTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  readerSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: '#7A6F66',
  },
  readerChapterHeader: {
    paddingTop: 18,
    paddingBottom: 12,
  },
  readerChapterEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#8D7C70',
  },
  readerChapterTitle: {
    marginTop: 3,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  readerChapterImageCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 10,
    marginTop: 4,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  readerChapterImageBackground: {
    aspectRatio: 0.9,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  readerChapterImageBackgroundImage: {
    borderRadius: 16,
  },
  readerChapterImageOverlay: {
    margin: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 253, 249, 0.82)',
  },
  readerChapterImageEyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#8D7C70',
  },
  readerChapterImageTitle: {
    marginTop: 2,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    color: '#2E2925',
  },
  readerChapterImageSummary: {
    marginTop: 10,
    paddingHorizontal: 4,
    fontSize: 15,
    lineHeight: 22,
    color: '#4A403C',
  },
  readerVerseCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  readerVerseUnread: {
    borderLeftWidth: 5,
    borderLeftColor: '#B7773C',
  },
  readerVerseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  readerVerseNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#8D7C70',
  },
  readerVerseNumberUnread: {
    color: '#3F2F24',
    fontWeight: '900',
  },
  readerVerseText: {
    fontSize: 17,
    lineHeight: 27,
    color: '#342E2A',
  },
  readerCanvasWrap: {
    gap: 8,
  },
  readerCanvasCaption: {
    color: '#8D7C70',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  readerStudioButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedSelectionTab: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'web' ? 0 : -10,
    zIndex: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: 46,
    paddingTop: 14,
    backgroundColor: '#FFFDF9',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  tabletSelectionTab: {
    left: 24,
    right: 24,
    maxWidth: 860,
    alignSelf: 'center',
  },
  collapsedSelectionHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D7CCC5',
  },
  selectionPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
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
  tabletSelectionPanel: {
    left: 24,
    right: 24,
    maxWidth: 860,
    alignSelf: 'center',
    paddingHorizontal: 28,
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
  unreadVersePill: {
    borderWidth: 1,
    borderColor: '#D99B5E',
    backgroundColor: '#FFF2D7',
  },
  readVersePill: {
    opacity: 0.48,
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
  unreadVersePillText: {
    color: '#3F2F24',
    fontWeight: '900',
  },
  readVersePillText: {
    color: '#8A7D75',
    fontWeight: '500',
  },
  optionPillTextSelected: {
    fontWeight: '700',
  },
  noUnreadText: {
    marginTop: -2,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
    color: '#7A6F66',
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
