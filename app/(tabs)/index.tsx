import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppSettings, type TranslationKey } from '@/utils/app-settings';
import { getJournalEntryStorageKey } from '@/utils/journal-storage';
import {
  getDailyInspirationVerse,
  getNextLocalMidnightDelay,
} from '@/utils/daily-inspiration-verses';
import bibleData, { getBookDisplayName, type BibleLanguageKey } from '@/utils/bible-data';
import { JOURNAL_INDEX_KEY } from '@/utils/storage-keys';
import { FocusedScreenView } from '@/components/focused-screen-view';
import { useResponsiveLayout } from '@/utils/responsive-layout';

const TYPE = {
  eyebrow: 11,
  caption: 12,
  body: 14,
  bodyLine: 21,
  button: 13,
  cardTitle: 17,
  cardTitleLine: 23,
  pageTitle: 25,
  pageTitleLine: 31,
} as const;

type HomeJournalEntryType = 'prayer' | 'bible-study' | 'church-day' | 'daily-devotional' | 'journal-studio';

type HomeJournalEntry = {
  id: string;
  type: HomeJournalEntryType;
  date?: string;
  preview?: string;
  updatedAt: number;
  isFavorite?: boolean;
  editor?: 'classic' | 'studio';
  book?: string;
  chapter?: number;
  verse?: number;
};

type MoodOption = {
  key: string;
  lane: 'help' | 'share';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  suggestion: string;
  actionLabel: string;
  route: HomeJournalEntryType;
  verses: HeartCheckVerse[];
};

type HeartCheckVerse = {
  book: string;
  chapter: number;
  verse: number;
  reference: string;
};

type WeeklyMoodSummary = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
};

const REFERENCE_BOOK_PREFIXES = bibleData
  .flatMap((bookEntry) => [
    { displayName: bookEntry.book, canonicalName: bookEntry.book },
    ...(bookEntry.book === 'Psalms'
      ? [{ displayName: 'Psalm', canonicalName: bookEntry.book }]
      : []),
  ])
  .sort((left, right) => right.displayName.length - left.displayName.length);

const MOOD_OPTIONS: MoodOption[] = [
  {
    key: 'angry',
    lane: 'help',
    label: 'Angry at someone',
    icon: 'flame-outline',
    tint: '#B35B4D',
    suggestion: 'Start with a verse that helps you slow down before you respond.',
    actionLabel: 'Open forgiveness verse',
    route: 'bible-study',
    verses: [
      { book: 'Ephesians', chapter: 4, verse: 32, reference: 'Ephesians 4:32' },
      { book: 'James', chapter: 1, verse: 19, reference: 'James 1:19' },
      { book: 'Romans', chapter: 12, verse: 18, reference: 'Romans 12:18' },
      { book: 'Matthew', chapter: 5, verse: 9, reference: 'Matthew 5:9' },
    ],
  },
  {
    key: 'sad',
    lane: 'help',
    label: 'Sad',
    icon: 'rainy-outline',
    tint: '#667DA8',
    suggestion: 'Open a comfort verse and pray honestly through sadness.',
    actionLabel: 'Open comfort verse',
    route: 'prayer',
    verses: [
      { book: 'Psalms', chapter: 34, verse: 18, reference: 'Psalm 34:18' },
      { book: 'Matthew', chapter: 5, verse: 4, reference: 'Matthew 5:4' },
      { book: 'Psalms', chapter: 147, verse: 3, reference: 'Psalm 147:3' },
      { book: 'John', chapter: 11, verse: 35, reference: 'John 11:35' },
    ],
  },
  {
    key: 'anxious',
    lane: 'help',
    label: 'Anxious',
    icon: 'leaf-outline',
    tint: '#5F8A72',
    suggestion: 'Open a peace verse and give the worry to God one step at a time.',
    actionLabel: 'Open peace verse',
    route: 'prayer',
    verses: [
      { book: 'Philippians', chapter: 4, verse: 6, reference: 'Philippians 4:6' },
      { book: '1 Peter', chapter: 5, verse: 7, reference: '1 Peter 5:7' },
      { book: 'Matthew', chapter: 6, verse: 34, reference: 'Matthew 6:34' },
      { book: 'Isaiah', chapter: 41, verse: 10, reference: 'Isaiah 41:10' },
    ],
  },
  {
    key: 'forgiving',
    lane: 'help',
    label: 'Need to forgive',
    icon: 'hand-left-outline',
    tint: '#8D6E63',
    suggestion: 'Open a forgiveness verse without pretending the hurt did not matter.',
    actionLabel: 'Open forgiveness study',
    route: 'bible-study',
    verses: [
      { book: 'Colossians', chapter: 3, verse: 13, reference: 'Colossians 3:13' },
      { book: 'Matthew', chapter: 6, verse: 14, reference: 'Matthew 6:14' },
      { book: 'Luke', chapter: 6, verse: 31, reference: 'Luke 6:31' },
      { book: 'Romans', chapter: 12, verse: 21, reference: 'Romans 12:21' },
    ],
  },
  {
    key: 'grateful',
    lane: 'help',
    label: 'Grateful',
    icon: 'heart-outline',
    tint: '#B66D7A',
    suggestion: 'Open a gratitude verse and remember what God has already done.',
    actionLabel: 'Save gratitude verse',
    route: 'journal-studio',
    verses: [
      { book: '1 Thessalonians', chapter: 5, verse: 18, reference: '1 Thessalonians 5:18' },
      { book: 'Psalms', chapter: 107, verse: 1, reference: 'Psalm 107:1' },
      { book: 'Philippians', chapter: 1, verse: 3, reference: 'Philippians 1:3' },
      { book: 'James', chapter: 1, verse: 17, reference: 'James 1:17' },
    ],
  },
  {
    key: 'encouraged',
    lane: 'share',
    label: 'Encourage someone',
    icon: 'sparkles-outline',
    tint: '#9B7A59',
    suggestion: 'Make a verse that points someone toward love and good works.',
    actionLabel: 'Make encouragement art',
    route: 'journal-studio',
    verses: [
      { book: 'Hebrews', chapter: 10, verse: 24, reference: 'Hebrews 10:24' },
      { book: '1 Thessalonians', chapter: 5, verse: 11, reference: '1 Thessalonians 5:11' },
      { book: 'Proverbs', chapter: 12, verse: 25, reference: 'Proverbs 12:25' },
      { book: 'Romans', chapter: 15, verse: 2, reference: 'Romans 15:2' },
    ],
  },
  {
    key: 'peaceful',
    lane: 'share',
    label: 'Share peace',
    icon: 'flower-outline',
    tint: '#6E9B8A',
    suggestion: 'Make a calming verse for someone who needs peace.',
    actionLabel: 'Make peace verse',
    route: 'journal-studio',
    verses: [
      { book: 'John', chapter: 14, verse: 27, reference: 'John 14:27' },
      { book: 'Numbers', chapter: 6, verse: 24, reference: 'Numbers 6:24' },
      { book: 'Romans', chapter: 15, verse: 13, reference: 'Romans 15:13' },
      { book: '2 Thessalonians', chapter: 3, verse: 16, reference: '2 Thessalonians 3:16' },
    ],
  },
  {
    key: 'comfort-someone',
    lane: 'share',
    label: 'Comfort someone',
    icon: 'people-outline',
    tint: '#6C7FA8',
    suggestion: 'Make a comfort verse for someone who is hurting.',
    actionLabel: 'Make comfort verse',
    route: 'journal-studio',
    verses: [
      { book: '2 Corinthians', chapter: 1, verse: 4, reference: '2 Corinthians 1:4' },
      { book: 'Psalms', chapter: 23, verse: 4, reference: 'Psalm 23:4' },
      { book: 'Romans', chapter: 12, verse: 15, reference: 'Romans 12:15' },
      { book: 'Psalms', chapter: 147, verse: 3, reference: 'Psalm 147:3' },
    ],
  },
  {
    key: 'give-courage',
    lane: 'share',
    label: 'Give courage',
    icon: 'shield-checkmark-outline',
    tint: '#5F8A72',
    suggestion: 'Make a courage verse for someone who needs to feel less alone.',
    actionLabel: 'Make courage verse',
    route: 'journal-studio',
    verses: [
      { book: 'Joshua', chapter: 1, verse: 9, reference: 'Joshua 1:9' },
      { book: 'Deuteronomy', chapter: 31, verse: 6, reference: 'Deuteronomy 31:6' },
      { book: 'Psalms', chapter: 31, verse: 24, reference: 'Psalm 31:24' },
      { book: 'Isaiah', chapter: 41, verse: 10, reference: 'Isaiah 41:10' },
    ],
  },
  {
    key: 'direction',
    lane: 'help',
    label: 'Need direction',
    icon: 'compass-outline',
    tint: '#6C7FA8',
    suggestion: 'Open a guidance verse when you need help trusting the next step.',
    actionLabel: 'Open guidance verse',
    route: 'bible-study',
    verses: [
      { book: 'Proverbs', chapter: 3, verse: 5, reference: 'Proverbs 3:5' },
      { book: 'James', chapter: 1, verse: 5, reference: 'James 1:5' },
      { book: 'Psalms', chapter: 32, verse: 8, reference: 'Psalm 32:8' },
      { book: 'Isaiah', chapter: 41, verse: 10, reference: 'Isaiah 41:10' },
    ],
  },
];
const HELP_MOOD_OPTIONS = MOOD_OPTIONS.filter((option) => option.lane === 'help');
const SHARE_MOOD_OPTIONS = MOOD_OPTIONS.filter((option) => option.lane === 'share');
const MOOD_TRANSLATION_KEYS: Record<
  string,
  { label: TranslationKey; suggestion: TranslationKey; action: TranslationKey }
> = {
  angry: {
    label: 'moodAngry',
    suggestion: 'moodAngrySuggestion',
    action: 'moodOpenForgivenessVerse',
  },
  sad: {
    label: 'moodSad',
    suggestion: 'moodSadSuggestion',
    action: 'moodOpenComfortVerse',
  },
  anxious: {
    label: 'moodAnxious',
    suggestion: 'moodAnxiousSuggestion',
    action: 'moodOpenPeaceVerse',
  },
  forgiving: {
    label: 'moodForgiving',
    suggestion: 'moodForgivingSuggestion',
    action: 'moodOpenForgivenessStudy',
  },
  grateful: {
    label: 'moodGrateful',
    suggestion: 'moodGratefulSuggestion',
    action: 'moodSaveGratitudeVerse',
  },
  encouraged: {
    label: 'moodEncouraged',
    suggestion: 'moodEncouragedSuggestion',
    action: 'moodMakeEncouragementArt',
  },
  peaceful: {
    label: 'moodPeaceful',
    suggestion: 'moodPeacefulSuggestion',
    action: 'moodMakePeaceVerse',
  },
  'comfort-someone': {
    label: 'moodComfortSomeone',
    suggestion: 'moodComfortSomeoneSuggestion',
    action: 'moodMakeComfortVerse',
  },
  'give-courage': {
    label: 'moodGiveCourage',
    suggestion: 'moodGiveCourageSuggestion',
    action: 'moodMakeCourageVerse',
  },
  direction: {
    label: 'moodDirection',
    suggestion: 'moodDirectionSuggestion',
    action: 'moodOpenGuidanceVerse',
  },
};

function safeParseJournalIndex(value: string | null): HomeJournalEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is HomeJournalEntry => {
      if (typeof entry !== 'object' || entry === null) {
        return false;
      }

      const candidate = entry as Partial<HomeJournalEntry>;
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.type === 'string' &&
        typeof candidate.updatedAt === 'number'
      );
    });
  } catch {
    return [];
  }
}

function parseEntryDate(entry: HomeJournalEntry) {
  if (typeof entry.date === 'string' && entry.date.trim().length > 0) {
    const parsedDate = new Date(entry.date.replace(/\s*•\s*/, ' '));
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  const updatedDate = new Date(entry.updatedAt);
  return Number.isNaN(updatedDate.getTime()) ? new Date() : updatedDate;
}

function getDateLocale(language: BibleLanguageKey) {
  return language === 'es' ? 'es' : undefined;
}

function formatRecentEntryDate(date: Date, language: BibleLanguageKey) {
  return date.toLocaleDateString(getDateLocale(language), {
    month: 'short',
    day: 'numeric',
  });
}

function formatLocalizedVerseReference(
  book: string,
  chapter: number,
  verse: number,
  language: BibleLanguageKey
) {
  const bookName = language === 'en' && book === 'Psalms' ? 'Psalm' : getBookDisplayName(book, language);

  return `${bookName} ${chapter}:${verse}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function localizeReferencePreview(preview: string | undefined, language: BibleLanguageKey) {
  if (!preview) {
    return '';
  }

  for (const { displayName, canonicalName } of REFERENCE_BOOK_PREFIXES) {
    const referencePattern = new RegExp(`^${escapeRegExp(displayName)}\\s+(\\d+):(\\d+)\\b`);
    const match = preview.match(referencePattern);

    if (!match) {
      continue;
    }

    const chapter = Number(match[1]);
    const verse = Number(match[2]);

    if (!Number.isFinite(chapter) || !Number.isFinite(verse)) {
      return preview;
    }

    return preview.replace(
      match[0],
      formatLocalizedVerseReference(canonicalName, chapter, verse, language)
    );
  }

  return preview;
}

function getLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDailyHeartCheckVerse(option: MoodOption, date: Date) {
  const dayKey = getLocalDayKey(date);
  const seed = `${option.key}:${dayKey}`.split('').reduce((total, char) => {
    return total + char.charCodeAt(0);
  }, 0);

  return option.verses[seed % option.verses.length] ?? option.verses[0];
}

function getMoodStorageKey(date: Date) {
  return `daily_mood_${getLocalDayKey(date)}`;
}

function getRecentMoodStorageKeys(date: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date);
    day.setDate(day.getDate() - index);
    return getMoodStorageKey(day);
  });
}

function getMostUsedMoodSummary(values: (string | null)[]): WeeklyMoodSummary {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    if (!value) {
      return;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  let topMoodKey: string | null = null;
  let topCount = 0;

  counts.forEach((count, moodKey) => {
    if (count > topCount) {
      topMoodKey = moodKey;
      topCount = count;
    }
  });

  const mood = MOOD_OPTIONS.find((option) => option.key === topMoodKey);

  return mood
    ? { label: mood.label, icon: mood.icon, tint: mood.tint }
    : { label: 'Not yet', icon: 'ellipse-outline', tint: '#8D7C70' };
}

function getEntryTypeLabel(type: HomeJournalEntryType, t: (key: TranslationKey) => string) {
  switch (type) {
    case 'prayer':
      return t('prayerJournal');
    case 'bible-study':
      return t('bibleStudy');
    case 'church-day':
      return t('churchDay');
    case 'daily-devotional':
      return t('dailyDevotional');
    case 'journal-studio':
      return t('tabStudio');
    default:
      return t('tabJournal');
  }
}

function getEntryTypeIcon(type: HomeJournalEntryType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'prayer':
      return 'heart-outline';
    case 'bible-study':
      return 'book-outline';
    case 'church-day':
      return 'sparkles-outline';
    case 'daily-devotional':
      return 'sunny-outline';
    case 'journal-studio':
      return 'color-wand-outline';
    default:
      return 'journal-outline';
  }
}

function countGentleStreak(entries: HomeJournalEntry[], date: Date) {
  const entryDayKeys = new Set(entries.map((entry) => getLocalDayKey(parseEntryDate(entry))));
  let streak = 0;
  const cursor = new Date(date);

  while (entryDayKeys.has(getLocalDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getStudioReferenceFromPayload(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const design = (parsed as { design?: unknown }).design;
    if (typeof design !== 'object' || design === null) {
      return null;
    }

    const candidate = design as { book?: unknown; chapter?: unknown; verse?: unknown };
    if (
      typeof candidate.book !== 'string' ||
      typeof candidate.chapter !== 'number' ||
      typeof candidate.verse !== 'number'
    ) {
      return null;
    }

    return `${candidate.book} ${candidate.chapter}:${candidate.verse}`;
  } catch {
    return null;
  }
}

function replaceStudioPreviewReference(entry: HomeJournalEntry, reference: string) {
  const currentPreview = entry.preview ?? '';
  const notePreview = currentPreview
    .replace(/^[1-3]?\s?[A-Za-z]+(?:\s[A-Za-z]+)*\s+\d+:\d+\s*/, '')
    .trim();

  return {
    ...entry,
    preview: `${reference}${notePreview ? ` ${notePreview}` : ''}`.slice(0, 80),
  };
}

function dedupeJournalEntries(entries: HomeJournalEntry[]) {
  const uniqueById = new Map<string, HomeJournalEntry>();

  [...entries]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .forEach((entry) => {
    uniqueById.set(`${entry.type}:${entry.id}`, entry);
    });

  const studioPreviewKeys = new Set<string>();

  return Array.from(uniqueById.values()).filter((entry) => {
    if (entry.type !== 'journal-studio' && entry.editor !== 'studio') {
      return true;
    }

    const previewKey = entry.preview?.trim().toLowerCase();
    if (!previewKey) {
      return true;
    }

    const dedupeKey = `${getLocalDayKey(parseEntryDate(entry))}:${previewKey}`;
    if (studioPreviewKeys.has(dedupeKey)) {
      return false;
    }

    studioPreviewKeys.add(dedupeKey);
    return true;
  });
}

function hasVisibleJournalContent(entry: HomeJournalEntry) {
  return Boolean(
    entry.preview?.trim() ||
      (entry.book && entry.chapter && entry.verse)
  );
}

async function hydrateStudioJournalEntries(entries: HomeJournalEntry[]) {
  const hydratedEntries = await Promise.all(
    entries.map(async (entry) => {
      if (entry.type !== 'journal-studio' && entry.editor !== 'studio') {
        return entry;
      }

      const storedReference = await AsyncStorage.getItem(
        getJournalEntryStorageKey({ id: entry.id, type: entry.type })
      ).then(
        getStudioReferenceFromPayload
      );

      if (storedReference) {
        return replaceStudioPreviewReference(entry, storedReference);
      }

      if (entry.book && entry.chapter && entry.verse) {
        return replaceStudioPreviewReference(entry, `${entry.book} ${entry.chapter}:${entry.verse}`);
      }

      return entry;
    })
  );

  return hydratedEntries;
}

export default function HomeScreen() {
  const router = useRouter();
  const { colorTheme, language, t } = useAppSettings();
  const layout = useResponsiveLayout();
  const [today, setToday] = useState(() => new Date());
  const [journalEntries, setJournalEntries] = useState<HomeJournalEntry[]>([]);
  const [selectedMoodKey, setSelectedMoodKey] = useState<string | null>(null);
  const [weeklyMoodSummary, setWeeklyMoodSummary] = useState<WeeklyMoodSummary>(() =>
    getMostUsedMoodSummary([])
  );
  const dailyVerse = useMemo(
    () => getDailyInspirationVerse(today, language.key),
    [language.key, today]
  );
  const dailyVerseReference = useMemo(
    () => formatLocalizedVerseReference(dailyVerse.book, dailyVerse.chapter, dailyVerse.verse, language.key),
    [dailyVerse.book, dailyVerse.chapter, dailyVerse.verse, language.key]
  );
  const todayKey = useMemo(() => getLocalDayKey(today), [today]);
  const selectedMood = useMemo(
    () => MOOD_OPTIONS.find((mood) => mood.key === selectedMoodKey) ?? null,
    [selectedMoodKey]
  );
  const selectedMoodVerse = useMemo(
    () => (selectedMood ? getDailyHeartCheckVerse(selectedMood, today) : null),
    [selectedMood, today]
  );
  const selectedMoodVerseReference = selectedMoodVerse
    ? formatLocalizedVerseReference(
        selectedMoodVerse.book,
        selectedMoodVerse.chapter,
        selectedMoodVerse.verse,
        language.key
      )
    : null;
  const getMoodLabel = useCallback(
    (mood: MoodOption) => {
      const key = MOOD_TRANSLATION_KEYS[mood.key]?.label;
      return key ? t(key) : mood.label;
    },
    [t]
  );
  const getMoodSuggestion = useCallback(
    (mood: MoodOption) => {
      const key = MOOD_TRANSLATION_KEYS[mood.key]?.suggestion;
      return key ? t(key) : mood.suggestion;
    },
    [t]
  );
  const getMoodActionLabel = useCallback(
    (mood: MoodOption) => {
      const key = MOOD_TRANSLATION_KEYS[mood.key]?.action;
      return key ? t(key) : mood.actionLabel;
    },
    [t]
  );
  const sortedJournalEntries = useMemo(
    () => [...journalEntries].sort((left, right) => right.updatedAt - left.updatedAt),
    [journalEntries]
  );
  const latestTodayEntry = useMemo(
    () => sortedJournalEntries.find((entry) => getLocalDayKey(parseEntryDate(entry)) === todayKey) ?? null,
    [sortedJournalEntries, todayKey]
  );
  const recentContinueEntries = useMemo(
    () =>
      sortedJournalEntries
        .filter((entry) => entry.id !== latestTodayEntry?.id)
        .slice(0, latestTodayEntry ? 2 : 3),
    [latestTodayEntry, sortedJournalEntries]
  );
  const todayEntryCount = useMemo(
    () => sortedJournalEntries.filter((entry) => getLocalDayKey(parseEntryDate(entry)) === todayKey).length,
    [sortedJournalEntries, todayKey]
  );
  const gentleStreak = useMemo(
    () => countGentleStreak(sortedJournalEntries, today),
    [sortedJournalEntries, today]
  );
  const weekSummary = useMemo(() => {
    const weekDayKeys = new Set<string>();
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(today);
      day.setDate(day.getDate() - index);
      weekDayKeys.add(getLocalDayKey(day));
    }

    const entriesThisWeek = sortedJournalEntries.filter((entry) =>
      weekDayKeys.has(getLocalDayKey(parseEntryDate(entry)))
    );
    const activeDays = new Set(entriesThisWeek.map((entry) => getLocalDayKey(parseEntryDate(entry)))).size;
    const favoriteCount = entriesThisWeek.filter((entry) => entry.isFavorite).length;

    return { activeDays, entryCount: entriesThisWeek.length, favoriteCount };
  }, [sortedJournalEntries, today]);

  const loadHomeJournalState = useCallback(async () => {
    const moodKeys = getRecentMoodStorageKeys(new Date());
    const [journalData, moodData] = await Promise.all([
      AsyncStorage.getItem(JOURNAL_INDEX_KEY),
      AsyncStorage.getItem(getMoodStorageKey(new Date())),
    ]);
    const weeklyMoods = await AsyncStorage.multiGet(moodKeys);

    const visibleEntries = dedupeJournalEntries(
      await hydrateStudioJournalEntries(safeParseJournalIndex(journalData))
    )
      .filter(hasVisibleJournalContent);

    setJournalEntries(visibleEntries);
    setSelectedMoodKey(moodData);
    setWeeklyMoodSummary(getMostUsedMoodSummary(weeklyMoods.map(([, value]) => value)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHomeJournalState();
    }, [loadHomeJournalState])
  );

  useEffect(() => {
    const midnightTimer = setTimeout(() => {
      setToday(new Date());
    }, getNextLocalMidnightDelay(today) + 1000);

    return () => clearTimeout(midnightTimer);
  }, [today]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setToday(new Date());
        void loadHomeJournalState();
      }
    });

    return () => subscription.remove();
  }, [loadHomeJournalState]);

  const openBlankStudio = () => {
    router.push({
      pathname: '/studio',
      params: {
        blankStudioToken: String(Date.now()),
        saveTarget: 'journal-studio',
        openSelectedVerse: 'false',
        selectedBook: '',
        selectedChapter: '',
        selectedVerse: '',
        selectionToken: '',
      },
    });
  };

  const openPrayerJournal = () => {
    router.push({
      pathname: '/studio',
      params: { blankStudioToken: String(Date.now()), saveTarget: 'prayer' },
    });
  };

  const openBreathe = () => {
    router.push('/breathe');
  };

  const openJournalEntry = (entry: HomeJournalEntry) => {
    if (entry.editor === 'studio' || entry.type === 'journal-studio') {
      router.push({ pathname: '/studio', params: { entryId: entry.id, entryType: entry.type, saveTarget: entry.type } });
      return;
    }

    if (entry.type === 'prayer') {
      router.push({ pathname: '/prayer-journal', params: { entryId: entry.id } });
      return;
    }

    if (entry.type === 'bible-study') {
      router.push({ pathname: '/bible-study-journal', params: { entryId: entry.id } });
      return;
    }

    if (entry.type === 'church-day') {
      router.push({ pathname: '/church-day-journal', params: { entryId: entry.id } });
      return;
    }

    if (entry.type === 'daily-devotional') {
      router.push({ pathname: '/daily-devotional-journal', params: { entryId: entry.id } });
      return;
    }
  };

  const openSuggestedJournal = (mood: MoodOption) => {
    const heartCheckVerse = getDailyHeartCheckVerse(mood, today);

    router.push({
      pathname: '/studio',
      params: {
        blankStudioToken: String(Date.now()),
        saveTarget: mood.route,
        openSelectedVerse: 'true',
        selectedBook: heartCheckVerse.book,
        selectedChapter: String(heartCheckVerse.chapter),
        selectedVerse: String(heartCheckVerse.verse),
        selectionToken: String(Date.now()),
      },
    });
  };

  const selectMood = async (mood: MoodOption) => {
    setSelectedMoodKey(mood.key);
    await AsyncStorage.setItem(getMoodStorageKey(today), mood.key);
  };

  const openTodayVerse = () => {
    router.push({
      pathname: '/studio',
      params: {
        blankStudioToken: '',
        saveTarget: 'journal-studio',
        openSelectedVerse: 'true',
        selectedBook: dailyVerse.book,
        selectedChapter: String(dailyVerse.chapter),
        selectedVerse: String(dailyVerse.verse),
        selectionToken: String(Date.now()),
      },
    });
  };

  const openBibleStudy = () => {
    router.push({
      pathname: '/studio',
      params: { blankStudioToken: String(Date.now()), saveTarget: 'bible-study' },
    });
  };

  const openDailyDevotional = () => {
    router.push({
      pathname: '/studio',
      params: {
        blankStudioToken: String(Date.now()),
        saveTarget: 'daily-devotional',
        openSelectedVerse: 'false',
        selectedBook: '',
        selectedChapter: '',
        selectedVerse: '',
        selectionToken: '',
      },
    });
  };

  const openChurchDay = () => {
    router.push({
      pathname: '/studio',
      params: {
        blankStudioToken: String(Date.now()),
        saveTarget: 'church-day',
        openSelectedVerse: 'false',
        selectedBook: '',
        selectedChapter: '',
        selectedVerse: '',
        selectionToken: '',
      },
    });
  };

  const primaryActions = [
    { label: t('homeQuickPrayer'), icon: 'heart-outline' as const, tint: '#A75E6C', onPress: openPrayerJournal },
    { label: t('bibleStudy'), icon: 'book-outline' as const, tint: '#536D9A', onPress: openBibleStudy },
    { label: t('homeQuickDevotional'), icon: 'sunny-outline' as const, tint: '#A97940', onPress: openDailyDevotional },
    { label: t('churchDay'), icon: 'sparkles-outline' as const, tint: '#667DA8', onPress: openChurchDay },
    { label: t('tabStudio'), icon: 'color-wand-outline' as const, tint: '#7A668F', onPress: openBlankStudio },
    { label: t('tabBible'), icon: 'library-outline' as const, tint: '#647569', onPress: () => router.push('/bible') },
  ];

  return (
    <FocusedScreenView style={[styles.screen, { backgroundColor: colorTheme.screenBackground }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          layout.isTablet
            ? [
                styles.tabletContent,
                {
                  maxWidth: layout.contentMaxWidth,
                  paddingHorizontal: layout.pagePaddingHorizontal,
                },
              ]
            : null,
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.homeMockTopBar}>
          <View>
            <Text style={styles.homeMockDate}>
              {today.toLocaleDateString(getDateLocale(language.key), {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <Text style={styles.homeMockTitle}>Faith Canvas</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push('/settings')}
            accessibilityLabel={t('settingsTitle')}
            style={[styles.homeMockSettingsButton, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name="settings-outline" size={19} color="#5B514D" />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.homeMockHero,
            layout.isTablet ? styles.tabletHomeHero : null,
            { borderColor: colorTheme.border },
          ]}>
          <View style={styles.homeMockHeroHeader}>
            <View style={[styles.homeMockIconBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
              <Ionicons name="book-outline" size={18} color="#6C5F59" />
            </View>
            <Text style={styles.homeMockEyebrow}>{t('homeVerseLabel')}</Text>
          </View>
          <Text numberOfLines={4} style={styles.homeMockVerseText}>{dailyVerse.text}</Text>
          <Text style={styles.homeMockReference}>{dailyVerseReference}</Text>
          <View style={styles.homeMockHeroActions}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={openTodayVerse}
              style={[styles.homeMockPrimaryButton, { backgroundColor: colorTheme.tint }]}>
              <Ionicons name="color-wand-outline" size={17} color="#FFFDF9" />
              <Text style={styles.homeMockPrimaryButtonText}>{t('homeOpenInStudio')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={openDailyDevotional}
              style={[styles.homeMockSecondaryButton, { backgroundColor: colorTheme.toolbarBackground }]}>
              <Text style={styles.homeMockSecondaryButtonText}>{t('homeReflect')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.homeMockStatusRow}>
          <View style={[styles.homeMockStatusPill, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
            <Ionicons name="flame-outline" size={16} color="#A75E6C" />
            <Text numberOfLines={1} style={styles.homeMockStatusText}>
              {gentleStreak > 0
                ? t(gentleStreak === 1 ? 'homeDayStreak' : 'homeDayStreakPlural', {
                    count: gentleStreak,
                  })
                : t('homeStartToday')}
            </Text>
          </View>
          <View style={[styles.homeMockStatusPill, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
            <Ionicons name={todayEntryCount > 0 ? 'checkmark-circle-outline' : 'ellipse-outline'} size={16} color="#6F8C7A" />
            <Text numberOfLines={1} style={styles.homeMockStatusText}>
              {todayEntryCount > 0
                ? t('homeTodayCount', { count: todayEntryCount })
                : t('homeNoEntryYet')}
            </Text>
          </View>
        </View>

        <View style={[styles.homeMockActionGrid, layout.isTablet ? styles.tabletHomeActionGrid : null]}>
          {primaryActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              activeOpacity={0.88}
              onPress={action.onPress}
              style={[
                styles.homeMockActionTile,
                layout.isTablet ? styles.tabletHomeActionTile : null,
                { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border },
              ]}>
              <View style={[styles.homeMockActionIcon, { backgroundColor: colorTheme.toolbarBackground }]}>
                <Ionicons name={action.icon} size={19} color={action.tint} />
              </View>
              <Text numberOfLines={1} style={styles.homeMockActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={[
            styles.homeMockMoodPanel,
            layout.isTablet ? styles.tabletHomeMoodPanel : null,
            { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border },
          ]}>
          <View style={styles.homeMockPanelHeader}>
            <Text style={styles.homeMockPanelTitle}>{t('homeWordsFromGod')}</Text>
            <Text style={styles.homeMockPanelHint}>
              {selectedMoodVerseReference ?? t('homePickWhatFits')}
            </Text>
          </View>
          <Text style={styles.homeMockMoodIntro}>
            {t('homeWordsIntro')}
          </Text>
          {[
            { title: t('homeForMe'), options: HELP_MOOD_OPTIONS },
            { title: t('homeHelpSomeone'), options: SHARE_MOOD_OPTIONS },
          ].map((group) => (
            <View key={group.title} style={styles.homeMockMoodGroup}>
              <Text style={styles.homeMockMoodGroupTitle}>{group.title}</Text>
              <View style={styles.homeMockMoodWrap}>
                {group.options.map((mood) => (
                  <TouchableOpacity
                    key={mood.key}
                    activeOpacity={0.85}
                    onPress={() => {
                      void selectMood(mood);
                    }}
                    style={[
                      styles.homeMockMoodChip,
                      { backgroundColor: colorTheme.toolbarBackground, borderColor: colorTheme.border },
                      selectedMoodKey === mood.key ? { borderColor: mood.tint, borderWidth: 2 } : null,
                    ]}>
                    <Ionicons name={mood.icon} size={14} color={mood.tint} />
                    <Text numberOfLines={1} style={styles.homeMockMoodChipText}>
                      {getMoodLabel(mood)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          {selectedMood ? (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => openSuggestedJournal(selectedMood)}
              style={styles.homeMockSuggestion}>
              <View style={styles.homeMockSuggestionCopy}>
                <Text numberOfLines={2} style={styles.homeMockSuggestionText}>
                  {getMoodSuggestion(selectedMood)}
                </Text>
                <Text style={styles.homeMockSuggestionAction}>
                  {getMoodActionLabel(selectedMood)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#8D7C70" />
            </TouchableOpacity>
          ) : null}
        </View>

        {latestTodayEntry ? (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => openJournalEntry(latestTodayEntry)}
            style={[styles.homeMockContinueCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
            <View style={[styles.homeMockIconBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
              <Ionicons name={getEntryTypeIcon(latestTodayEntry.type)} size={18} color="#7A6F66" />
            </View>
            <View style={styles.homeMockContinueText}>
              <Text style={styles.homeMockEyebrow}>{t('homeContinueToday')}</Text>
              <Text numberOfLines={1} style={styles.homeMockContinueTitle}>
                {getEntryTypeLabel(latestTodayEntry.type, t)}
              </Text>
              <Text numberOfLines={1} style={styles.homeMockContinuePreview}>
                {localizeReferencePreview(latestTodayEntry.preview, language.key) || t('homeKeepWriting')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8D7C70" />
          </TouchableOpacity>
        ) : null}

        {recentContinueEntries.length > 0 ? (
          <View style={[styles.homeMockRecentPanel, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
            <View style={styles.homeMockPanelHeader}>
              <Text style={styles.homeMockPanelTitle}>{t('homeRecentWork')}</Text>
              <Text style={styles.homeMockPanelHint}>
                {t('homeThisWeek', { count: weekSummary.entryCount })}
              </Text>
            </View>
            {recentContinueEntries.map((entry) => (
              <TouchableOpacity
                key={`${entry.type}-${entry.id}`}
                activeOpacity={0.88}
                onPress={() => openJournalEntry(entry)}
                style={styles.homeMockRecentRow}>
                <Ionicons name={getEntryTypeIcon(entry.type)} size={17} color="#7A6F66" />
                <View style={styles.homeMockRecentText}>
                  <Text numberOfLines={1} style={styles.homeMockRecentTitle}>
                    {getEntryTypeLabel(entry.type, t)}
                  </Text>
                  <Text numberOfLines={1} style={styles.homeMockRecentPreview}>
                    {localizeReferencePreview(entry.preview, language.key) || t('homeKeepWriting')}
                  </Text>
                </View>
                <Text style={styles.homeMockRecentDate}>{formatRecentEntryDate(parseEntryDate(entry), language.key)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {false ? (
          <>
        <View style={[styles.welcome, { borderColor: colorTheme.border }]}>
        <View style={styles.welcomeTopRow}>
          <View style={styles.welcomeTodayGroup}>
            <View style={[styles.sunBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
              <Ionicons name="sunny-outline" size={20} color="#9B7A59" />
            </View>
            <Text style={styles.kicker}>{t('homeGreeting')}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push('/settings')}
            accessibilityLabel={t('settingsTitle')}
            style={[styles.settingsButton, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name="settings-outline" size={19} color="#5B514D" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>{t('homeTitle')}</Text>
        <Text style={styles.subtitle}>{t('homeSubtitle')}</Text>
        <View style={styles.softPrompts}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={openBreathe}
            style={styles.softPrompt}>
            <Ionicons name="leaf-outline" size={15} color="#6F8C7A" />
            <Text style={styles.softPromptText}>{t('homePromptBreathe')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={openPrayerJournal}
            style={styles.softPrompt}>
            <Ionicons name="heart-outline" size={15} color="#B66D7A" />
            <Text style={styles.softPromptText}>{t('homePromptPray')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={openTodayVerse}
            style={styles.softPrompt}>
            <Ionicons name="sparkles-outline" size={15} color="#7C73A6" />
            <Text style={styles.softPromptText}>{t('homePromptCreate')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.dailyStatusCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
        <View style={styles.dailyStatusItem}>
          <Ionicons name="flame-outline" size={18} color="#B66D7A" />
          <View style={styles.dailyStatusTextGroup}>
            <Text style={styles.dailyStatusValue}>
              {gentleStreak > 0 ? `${gentleStreak} day${gentleStreak === 1 ? '' : 's'}` : 'Start today'}
            </Text>
            <Text style={styles.dailyStatusLabel}>walking with God</Text>
          </View>
        </View>
        <View style={styles.dailyStatusDivider} />
        <View style={styles.dailyStatusItem}>
          <Ionicons name={todayEntryCount > 0 ? 'checkmark-circle-outline' : 'ellipse-outline'} size={18} color="#6F8C7A" />
          <View style={styles.dailyStatusTextGroup}>
            <Text style={styles.dailyStatusValue}>{todayEntryCount > 0 ? 'Checked in' : 'Not yet'}</Text>
            <Text style={styles.dailyStatusLabel}>today</Text>
          </View>
        </View>
      </View>

      {latestTodayEntry ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => openJournalEntry(latestTodayEntry!)}
          style={[styles.continueCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
          <View style={[styles.iconBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name={getEntryTypeIcon(latestTodayEntry!.type)} size={18} color="#7A6F66" />
          </View>
          <View style={styles.continueText}>
            <Text style={styles.continueLabel}>Continue today</Text>
            <Text numberOfLines={1} style={styles.continueTitle}>
              {getEntryTypeLabel(latestTodayEntry!.type, t)}
            </Text>
            <Text numberOfLines={1} style={styles.continuePreview}>
              {localizeReferencePreview(latestTodayEntry!.preview, language.key) || t('homeKeepWriting')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#8D7C70" />
        </TouchableOpacity>
      ) : null}

      {recentContinueEntries.length > 0 ? (
        <View style={[styles.recentCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
          <View style={styles.recentHeaderRow}>
            <View style={[styles.iconBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
              <Ionicons name="time-outline" size={18} color="#7A6F66" />
            </View>
            <View style={styles.recentHeaderText}>
              <Text style={styles.recentLabel}>Recent work</Text>
              <Text style={styles.recentHint}>Pick up where you left off.</Text>
            </View>
          </View>
          {recentContinueEntries.map((entry) => (
            <TouchableOpacity
              key={`${entry.type}-${entry.id}`}
              activeOpacity={0.88}
              onPress={() => openJournalEntry(entry)}
              style={styles.recentEntryRow}>
              <Ionicons name={getEntryTypeIcon(entry.type)} size={17} color="#7A6F66" />
              <View style={styles.recentEntryText}>
                <Text numberOfLines={1} style={styles.recentEntryTitle}>
                  {getEntryTypeLabel(entry.type, t)}
                </Text>
                <Text numberOfLines={1} style={styles.recentEntryPreview}>
                  {localizeReferencePreview(entry.preview, language.key) || t('homeKeepWriting')}
                </Text>
              </View>
              <Text style={styles.recentEntryDate}>{formatRecentEntryDate(parseEntryDate(entry), language.key)}</Text>
              <Ionicons name="chevron-forward" size={16} color="#8D7C70" />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={[styles.moodCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#7A6F66" />
          </View>
          <Text style={styles.cardLabel}>Find a verse for...</Text>
        </View>
        <Text style={styles.moodTitle}>What are you walking through?</Text>
        <View style={styles.moodChipRow}>
          {MOOD_OPTIONS.map((mood) => (
            <TouchableOpacity
              key={mood.key}
              activeOpacity={0.85}
              onPress={() => {
                void selectMood(mood);
              }}
              style={[
                styles.moodChip,
                { backgroundColor: colorTheme.toolbarBackground, borderColor: colorTheme.border },
                selectedMoodKey === mood.key ? [styles.moodChipActive, { borderColor: mood.tint }] : null,
              ]}>
              <Ionicons name={mood.icon} size={14} color={mood.tint} />
              <Text style={styles.moodChipText}>{mood.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {selectedMood ? (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => openSuggestedJournal(selectedMood!)}
            style={styles.moodSuggestion}>
            <Text style={styles.moodSuggestionText}>
              {selectedMood!.suggestion} {selectedMood!.actionLabel}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#8D7C70" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.verseCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name="book-outline" size={18} color="#7A6F66" />
          </View>
          <Text style={styles.cardLabel}>{t('homeVerseLabel')}</Text>
        </View>
        <Text style={styles.verseText}>{dailyVerse.text}</Text>
        <View style={styles.referenceRow}>
          <Text style={styles.reference}>{dailyVerseReference}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={openTodayVerse}
          style={[styles.verseArtButton, { backgroundColor: colorTheme.toolbarBackground }]}>
          <Ionicons name="sparkles-outline" size={16} color="#5B514D" />
          <Text style={styles.verseArtButtonText}>Turn today into verse art</Text>
          <Ionicons name="chevron-forward" size={16} color="#8D7C70" />
        </TouchableOpacity>
      </View>

      <View style={[styles.studioPromptCard, { backgroundColor: '#F6EEFB', borderColor: colorTheme.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconBadge, { backgroundColor: '#FFFDF9' }]}>
            <Ionicons name="color-wand-outline" size={18} color="#8A669C" />
          </View>
          <Text style={styles.cardLabel}>Create from today</Text>
        </View>
        <Text style={styles.studioPromptTitle}>Make your faith feel like yours.</Text>
        <View style={styles.studioPromptActions}>
          <TouchableOpacity activeOpacity={0.88} onPress={openTodayVerse} style={styles.studioPromptButton}>
            <Ionicons name="phone-portrait-outline" size={16} color="#5B514D" />
            <Text style={styles.studioPromptButtonText}>Lock-screen verse</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.comfortStack}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={openPrayerJournal}
          style={[styles.comfortCard, styles.prayerCard, { borderColor: colorTheme.border }]}>
          <Ionicons name="heart-outline" size={21} color="#A56778" />
          <Text style={styles.comfortTitle}>{t('homePrayerTitle')}</Text>
          <Text style={styles.comfortText}>{t('homePrayerText')}</Text>
          <View style={styles.cardLinkRow}>
            <Text style={styles.cardLinkText}>{t('homePrayerAction')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#8D7C70" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() =>
            router.push({
              pathname: '/studio',
              params: {
                blankStudioToken: String(Date.now()),
                saveTarget: 'daily-devotional',
                openSelectedVerse: 'false',
                selectedBook: '',
                selectedChapter: '',
                selectedVerse: '',
                selectionToken: '',
              },
            })
          }
          style={[styles.comfortCard, styles.questionCard, { borderColor: colorTheme.border }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={21} color="#6F8C7A" />
          <Text style={styles.comfortTitle}>{t('homeQuestionTitle')}</Text>
          <Text style={styles.comfortText}>{t('homeQuestionText')}</Text>
          <View style={styles.cardLinkRow}>
            <Text style={styles.cardLinkText}>{t('dailyDevotional')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#8D7C70" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.actionSection}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/bible')}
          accessibilityLabel={t('homeBibleAction')}
          style={[styles.actionIconButton, { backgroundColor: colorTheme.tint }]}>
          <Ionicons name="book" size={28} color="#FFFDF9" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={openPrayerJournal}
          accessibilityLabel={t('homePrayerAction')}
          style={[styles.actionIconButton, styles.secondaryActionButton, { backgroundColor: colorTheme.toolbarBackground, borderColor: colorTheme.border }]}>
          <Ionicons name="create-outline" size={28} color="#5B514D" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={openBlankStudio}
          style={[styles.fullWidthAction, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
          <Ionicons name="color-wand-outline" size={18} color="#5B514D" />
          <Text style={styles.fullWidthActionText}>{t('homeCreateAction')}</Text>
          <Ionicons name="chevron-forward" size={18} color="#8D7C70" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() =>
          router.push({
            pathname: '/studio',
            params: {
              blankStudioToken: String(Date.now()),
              saveTarget: 'church-day',
              openSelectedVerse: 'false',
              selectedBook: '',
              selectedChapter: '',
              selectedVerse: '',
              selectionToken: '',
            },
          })
        }
        style={[styles.churchNote, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
        <View style={[styles.churchIcon, { backgroundColor: '#EEF3FF' }]}>
          <Ionicons name="sparkles-outline" size={19} color="#6C7FA8" />
        </View>
        <View style={styles.churchNoteText}>
          <Text style={styles.churchNoteTitle}>{t('homeChurchNote')}</Text>
          <Text style={styles.churchNoteBody}>{t('homeChurchText')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#8D7C70" />
      </TouchableOpacity>

      <View style={[styles.weekCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name="calendar-clear-outline" size={18} color="#7A6F66" />
          </View>
          <Text style={styles.cardLabel}>Your week with God</Text>
        </View>
        <View style={styles.weekStatsRow}>
          <View style={styles.weekStat}>
            <Text style={styles.weekStatValue}>{weekSummary.activeDays}</Text>
            <Text style={styles.weekStatLabel}>days</Text>
          </View>
          <View style={styles.weekStat}>
            <Text style={styles.weekStatValue}>{weekSummary.entryCount}</Text>
            <Text style={styles.weekStatLabel}>entries</Text>
          </View>
          <View style={styles.weekStat}>
            <Text style={styles.weekStatValue}>{weekSummary.favoriteCount}</Text>
            <Text style={styles.weekStatLabel}>saved</Text>
          </View>
          <View style={styles.weekStat}>
            <Ionicons name={weeklyMoodSummary.icon} size={18} color={weeklyMoodSummary.tint} />
            <Text numberOfLines={1} style={styles.weekMoodValue}>{weeklyMoodSummary.label}</Text>
            <Text style={styles.weekStatLabel}>mood</Text>
          </View>
        </View>
      </View>
          </>
        ) : null}
      </ScrollView>
    </FocusedScreenView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingTop: Platform.OS === 'web' ? 26 : 58,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'web' ? 34 : 112,
  },
  tabletContent: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: Platform.OS === 'web' ? 30 : 62,
    paddingBottom: Platform.OS === 'web' ? 42 : 130,
  },
  homeMockTopBar: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeMockDate: {
    color: '#7A6F66',
    fontSize: 12,
    fontWeight: '700',
  },
  homeMockTitle: {
    marginTop: 2,
    color: '#1F1F1F',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  homeMockSettingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeMockHero: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    marginBottom: 10,
    backgroundColor: '#F7F0E8',
  },
  tabletHomeHero: {
    padding: 22,
  },
  homeMockHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 12,
  },
  homeMockIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeMockEyebrow: {
    color: '#8D7C70',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  homeMockVerseText: {
    color: '#1F1F1F',
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '700',
  },
  homeMockReference: {
    marginTop: 10,
    color: '#6F635C',
    fontSize: 12,
    fontWeight: '800',
  },
  homeMockHeroActions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
  },
  homeMockPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  homeMockPrimaryButtonText: {
    color: '#FFFDF9',
    fontSize: 13,
    fontWeight: '800',
  },
  homeMockSecondaryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeMockSecondaryButtonText: {
    color: '#5B514D',
    fontSize: 13,
    fontWeight: '800',
  },
  homeMockStatusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  homeMockStatusPill: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  homeMockStatusText: {
    flex: 1,
    color: '#4A403C',
    fontSize: 12,
    fontWeight: '800',
  },
  homeMockActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  tabletHomeActionGrid: {
    gap: 10,
  },
  homeMockActionTile: {
    width: '31.8%',
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
    justifyContent: 'space-between',
  },
  tabletHomeActionTile: {
    width: '32.25%',
    minHeight: 104,
    padding: 12,
  },
  homeMockActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeMockActionLabel: {
    color: '#1F1F1F',
    fontSize: 12,
    fontWeight: '800',
  },
  homeMockMoodPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 13,
    marginBottom: 10,
  },
  tabletHomeMoodPanel: {
    padding: 18,
  },
  homeMockPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  homeMockPanelTitle: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '800',
  },
  homeMockPanelHint: {
    color: '#8D7C70',
    fontSize: 12,
    fontWeight: '700',
  },
  homeMockMoodIntro: {
    color: '#665C57',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  homeMockMoodGroup: {
    marginTop: 2,
    marginBottom: 10,
  },
  homeMockMoodGroupTitle: {
    color: '#7A6F66',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  homeMockMoodWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  homeMockMoodChip: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  homeMockMoodChipText: {
    color: '#4A403C',
    fontSize: 12,
    fontWeight: '800',
  },
  homeMockSuggestion: {
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#F8F5F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeMockSuggestionCopy: {
    flex: 1,
  },
  homeMockSuggestionText: {
    color: '#4A403C',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  homeMockSuggestionAction: {
    marginTop: 4,
    color: '#7A6F66',
    fontSize: 12,
    fontWeight: '800',
  },
  homeMockContinueCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  homeMockContinueText: {
    flex: 1,
    minWidth: 0,
  },
  homeMockContinueTitle: {
    marginTop: 3,
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '800',
  },
  homeMockContinuePreview: {
    marginTop: 2,
    color: '#665C57',
    fontSize: 12,
  },
  homeMockRecentPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 13,
  },
  homeMockRecentRow: {
    minHeight: 45,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  homeMockRecentText: {
    flex: 1,
    minWidth: 0,
  },
  homeMockRecentTitle: {
    color: '#1F1F1F',
    fontSize: 13,
    fontWeight: '800',
  },
  homeMockRecentPreview: {
    marginTop: 1,
    color: '#665C57',
    fontSize: 12,
  },
  homeMockRecentDate: {
    color: '#8D7C70',
    fontSize: 11,
    fontWeight: '800',
  },
  welcome: {
    backgroundColor: '#FFF3F2',
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
  },
  welcomeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  welcomeTodayGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sunBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: TYPE.eyebrow,
    fontWeight: '700',
    color: '#9C7988',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPE.pageTitle,
    lineHeight: TYPE.pageTitleLine,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  subtitle: {
    fontSize: TYPE.body,
    lineHeight: TYPE.bodyLine,
    color: '#665C57',
    marginTop: 8,
  },
  softPrompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 15,
  },
  softPrompt: {
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  softPromptText: {
    fontSize: TYPE.button,
    fontWeight: '700',
    color: '#5E5550',
  },
  dailyStatusCard: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyStatusItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dailyStatusTextGroup: {
    flex: 1,
  },
  dailyStatusValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  dailyStatusLabel: {
    marginTop: 1,
    fontSize: 11,
    color: '#7A6F66',
  },
  dailyStatusDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 12,
  },
  continueCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 13,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  continueText: {
    flex: 1,
  },
  continueLabel: {
    fontSize: TYPE.eyebrow,
    fontWeight: '800',
    color: '#8D7C70',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  continueTitle: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  continuePreview: {
    marginTop: 2,
    fontSize: 12,
    color: '#665C57',
  },
  recentCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 13,
    marginBottom: 12,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  recentHeaderText: {
    flex: 1,
  },
  recentLabel: {
    fontSize: TYPE.eyebrow,
    fontWeight: '800',
    color: '#8D7C70',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  recentHint: {
    marginTop: 2,
    fontSize: 12,
    color: '#665C57',
  },
  recentEntryRow: {
    minHeight: 46,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  recentEntryText: {
    flex: 1,
    minWidth: 0,
  },
  recentEntryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  recentEntryPreview: {
    marginTop: 1,
    fontSize: 12,
    color: '#665C57',
  },
  recentEntryDate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8D7C70',
  },
  moodCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  moodTitle: {
    fontSize: TYPE.cardTitle,
    lineHeight: TYPE.cardTitleLine,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 10,
  },
  moodChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moodChipActive: {
    borderWidth: 2,
  },
  moodChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A403C',
  },
  moodSuggestion: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#F8F5F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moodSuggestionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#4A403C',
  },
  verseCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: TYPE.eyebrow,
    fontWeight: '700',
    color: '#8D7C70',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  verseText: {
    fontSize: TYPE.cardTitle,
    lineHeight: TYPE.cardTitleLine,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  referenceRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reference: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: '#8D7C70',
  },
  verseArtButton: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verseArtButtonText: {
    flex: 1,
    fontSize: TYPE.button,
    fontWeight: '800',
    color: '#5B514D',
  },
  studioPromptCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  studioPromptTitle: {
    fontSize: TYPE.cardTitle,
    lineHeight: TYPE.cardTitleLine,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  studioPromptActions: {
    gap: 8,
  },
  studioPromptButton: {
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  studioPromptButtonText: {
    fontSize: TYPE.button,
    fontWeight: '700',
    color: '#5B514D',
  },
  comfortStack: {
    gap: 10,
    marginBottom: 12,
  },
  comfortCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  prayerCard: {
    backgroundColor: '#FCEEF3',
  },
  questionCard: {
    backgroundColor: '#EEF9F3',
  },
  comfortTitle: {
    fontSize: TYPE.cardTitle,
    lineHeight: TYPE.cardTitleLine,
    fontWeight: '700',
    color: '#1F1F1F',
    marginTop: 10,
    marginBottom: 6,
  },
  comfortText: {
    fontSize: TYPE.body,
    lineHeight: TYPE.bodyLine,
    color: '#625853',
  },
  cardLinkRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLinkText: {
    fontSize: TYPE.button,
    fontWeight: '700',
    color: '#5B514D',
  },
  actionSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  actionIconButton: {
    flexGrow: 1,
    flexBasis: 148,
    minHeight: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryActionButton: {
    borderWidth: 1,
  },
  primaryActionText: {
    color: '#FFFDF9',
    fontSize: TYPE.button,
    fontWeight: '700',
  },
  secondaryActionText: {
    color: '#5B514D',
    fontSize: TYPE.button,
    fontWeight: '700',
  },
  fullWidthAction: {
    flexBasis: '100%',
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  fullWidthActionText: {
    flex: 1,
    marginLeft: 10,
    color: '#5B514D',
    fontSize: TYPE.button,
    fontWeight: '700',
  },
  churchNote: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  churchIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  churchNoteText: {
    flex: 1,
  },
  churchNoteTitle: {
    fontSize: TYPE.body,
    lineHeight: 19,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 3,
  },
  churchNoteBody: {
    fontSize: TYPE.caption,
    lineHeight: 19,
    color: '#6E645E',
  },
  weekCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  weekStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekStat: {
    width: '48.7%',
    minHeight: 78,
    borderRadius: 8,
    backgroundColor: '#F8F5F2',
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  weekMoodValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  weekStatLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#7A6F66',
    textTransform: 'uppercase',
    letterSpacing: 0,
    textAlign: 'center',
  },
});
