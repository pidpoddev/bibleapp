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

import { useAppSettings } from '@/utils/app-settings';
import {
  getDailyInspirationVerse,
  getNextLocalMidnightDelay,
} from '@/utils/daily-inspiration-verses';
import { JOURNAL_INDEX_KEY } from '@/utils/storage-keys';

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
  book?: string;
  chapter?: number;
  verse?: number;
};

type MoodOption = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  suggestion: string;
  route: HomeJournalEntryType;
};

type WeeklyMoodSummary = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
};

const MOOD_OPTIONS: MoodOption[] = [
  { key: 'grateful', label: 'Grateful', icon: 'heart-outline', tint: '#B66D7A', suggestion: 'Save what God did today.', route: 'prayer' },
  { key: 'anxious', label: 'Anxious', icon: 'leaf-outline', tint: '#6F8C7A', suggestion: 'Write a prayer before you carry it alone.', route: 'prayer' },
  { key: 'confused', label: 'Confused', icon: 'book-outline', tint: '#6C7FA8', suggestion: 'Slow down with a Bible Study note.', route: 'bible-study' },
  { key: 'peaceful', label: 'Peaceful', icon: 'flower-outline', tint: '#6E9B8A', suggestion: 'Capture what feels calm and steady today.', route: 'daily-devotional' },
  { key: 'sad', label: 'Sad', icon: 'rainy-outline', tint: '#7A86A8', suggestion: 'Write an honest prayer. God can hold this with you.', route: 'prayer' },
  { key: 'tired', label: 'Tired', icon: 'moon-outline', tint: '#8A669C', suggestion: 'Keep it simple with a devotional.', route: 'daily-devotional' },
  { key: 'happy', label: 'Happy', icon: 'sparkles-outline', tint: '#9B7A59', suggestion: 'Turn today into verse art.', route: 'journal-studio' },
];

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

function formatRecentEntryDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function getEntryTypeLabel(type: HomeJournalEntryType) {
  switch (type) {
    case 'prayer':
      return 'Prayer Journal';
    case 'bible-study':
      return 'Bible Study';
    case 'church-day':
      return 'Church Day';
    case 'daily-devotional':
      return 'Daily Devotional';
    case 'journal-studio':
      return 'Studio';
    default:
      return 'Journal';
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

async function hydrateStudioJournalEntries(entries: HomeJournalEntry[]) {
  const hydratedEntries = await Promise.all(
    entries.map(async (entry) => {
      if (entry.type !== 'journal-studio') {
        return entry;
      }

      const storedReference = await AsyncStorage.getItem(`journal_studio_${entry.id}`).then(
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
  const todayKey = useMemo(() => getLocalDayKey(today), [today]);
  const selectedMood = useMemo(
    () => MOOD_OPTIONS.find((mood) => mood.key === selectedMoodKey) ?? null,
    [selectedMoodKey]
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

    setJournalEntries(await hydrateStudioJournalEntries(safeParseJournalIndex(journalData)));
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

  const openRoute = (pathname: string) => {
    router.push(pathname as never);
  };

  const openBlankStudio = () => {
    router.push({
      pathname: '/studio',
      params: {
        blankStudioToken: String(Date.now()),
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
      pathname: '/prayer-journal',
      params: { newEntryToken: String(Date.now()) },
    });
  };

  const openJournalEntry = (entry: HomeJournalEntry) => {
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

    router.push({ pathname: '/studio', params: { entryId: entry.id } });
  };

  const openSuggestedJournal = (mood: MoodOption) => {
    if (mood.route === 'prayer') {
      openPrayerJournal();
      return;
    }

    if (mood.route === 'bible-study') {
      router.push({ pathname: '/bible-study-journal', params: { newEntryToken: String(Date.now()) } });
      return;
    }

    if (mood.route === 'daily-devotional') {
      router.push({ pathname: '/daily-devotional-journal', params: { newEntryToken: String(Date.now()) } });
      return;
    }

    openTodayVerse();
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
        openSelectedVerse: 'true',
        selectedBook: dailyVerse.book,
        selectedChapter: String(dailyVerse.chapter),
        selectedVerse: String(dailyVerse.verse),
        selectionToken: String(Date.now()),
      },
    });
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colorTheme.screenBackground }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
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
            onPress={openBlankStudio}
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
            onPress={openBlankStudio}
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
          onPress={() => openJournalEntry(latestTodayEntry)}
          style={[styles.continueCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
          <View style={[styles.iconBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name={getEntryTypeIcon(latestTodayEntry.type)} size={18} color="#7A6F66" />
          </View>
          <View style={styles.continueText}>
            <Text style={styles.continueLabel}>Continue today</Text>
            <Text numberOfLines={1} style={styles.continueTitle}>
              {getEntryTypeLabel(latestTodayEntry.type)}
            </Text>
            <Text numberOfLines={1} style={styles.continuePreview}>
              {latestTodayEntry.preview || 'Open to keep writing...'}
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
                  {getEntryTypeLabel(entry.type)}
                </Text>
                <Text numberOfLines={1} style={styles.recentEntryPreview}>
                  {entry.preview || 'Open to keep writing...'}
                </Text>
              </View>
              <Text style={styles.recentEntryDate}>{formatRecentEntryDate(parseEntryDate(entry))}</Text>
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
          <Text style={styles.cardLabel}>Heart check</Text>
        </View>
        <Text style={styles.moodTitle}>How are you feeling?</Text>
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
            onPress={() => openSuggestedJournal(selectedMood)}
            style={styles.moodSuggestion}>
            <Text style={styles.moodSuggestionText}>{selectedMood.suggestion}</Text>
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
          <Text style={styles.reference}>{dailyVerse.reference}</Text>
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
          onPress={() => openRoute('/daily-devotional-journal')}
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
        onPress={() => openRoute('/church-day-journal')}
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
    </ScrollView>
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
