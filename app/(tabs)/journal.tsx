import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { useAppSettings } from '@/utils/app-settings';
import { JOURNAL_INDEX_KEY } from '@/utils/storage-keys';

type JournalTemplate = {
  key: 'prayer' | 'bible-study' | 'church-day' | 'daily-devotional' | 'journal-studio';
  emoji: string;
  iconImage?: any;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  soft: string;
};

type JournalEntryType = JournalTemplate['key'];

type JournalLogEntry = {
  id: string;
  type: JournalEntryType;
  date?: string;
  preview?: string;
  updatedAt: number;
  isFavorite?: boolean;
  book?: string;
  chapter?: number;
  verse?: number;
};

type JournalLogGroup = {
  key: string;
  title: string;
  entries: JournalLogEntry[];
  mood?: WeeklyMoodSummary;
};

type WeeklyMoodSummary = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
};

const PRAYER_JOURNAL_ICON = require('../../assets/images/toolbar-icons/journal-prayer.png');
const BIBLE_STUDY_JOURNAL_ICON = require('../../assets/images/toolbar-icons/journal-bible-study.png');
const CHURCH_DAY_JOURNAL_ICON = require('../../assets/images/toolbar-icons/journal-church-day.png');
const DAILY_DEVOTIONAL_JOURNAL_ICON = require('../../assets/images/toolbar-icons/journal-daily-devotional.png');
const STUDIO_JOURNAL_ICON = require('../../assets/images/toolbar-icons/journal-studio.png');
const MOOD_LABELS: Record<string, WeeklyMoodSummary> = {
  grateful: { label: 'Grateful', icon: 'heart-outline', tint: '#B66D7A' },
  anxious: { label: 'Anxious', icon: 'leaf-outline', tint: '#6F8C7A' },
  confused: { label: 'Confused', icon: 'book-outline', tint: '#6C7FA8' },
  peaceful: { label: 'Peaceful', icon: 'flower-outline', tint: '#6E9B8A' },
  sad: { label: 'Sad', icon: 'rainy-outline', tint: '#7A86A8' },
  tired: { label: 'Tired', icon: 'moon-outline', tint: '#8A669C' },
  happy: { label: 'Happy', icon: 'sparkles-outline', tint: '#9B7A59' },
};

function safeParseJournalIndex(value: string | null): JournalLogEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is JournalLogEntry => {
      if (typeof entry !== 'object' || entry === null) {
        return false;
      }

      const candidate = entry as Partial<JournalLogEntry>;
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

function parseEntryDate(entry: JournalLogEntry) {
  if (typeof entry.date === 'string' && entry.date.trim().length > 0) {
    const normalizedDate = entry.date.replace(/\s*•\s*/, ' ');
    const parsedDate = new Date(normalizedDate);

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  const updatedDate = new Date(entry.updatedAt);
  return Number.isNaN(updatedDate.getTime()) ? new Date() : updatedDate;
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

  return topMoodKey && MOOD_LABELS[topMoodKey]
    ? MOOD_LABELS[topMoodKey]
    : { label: 'Not yet', icon: 'ellipse-outline', tint: '#8D7C70' };
}

function formatLogDayTitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatLogTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getEntryStorageKey(entry: Pick<JournalLogEntry, 'id' | 'type'>) {
  switch (entry.type) {
    case 'prayer':
      return `journal_prayer_${entry.id}`;
    case 'bible-study':
      return `journal_bible_study_${entry.id}`;
    case 'church-day':
      return `journal_church_day_${entry.id}`;
    case 'daily-devotional':
      return `journal_daily_devotional_${entry.id}`;
    case 'journal-studio':
      return `journal_studio_${entry.id}`;
    default:
      return null;
  }
}

function hasVisibleJournalContent(entry: JournalLogEntry) {
  return Boolean(
    entry.preview?.trim() ||
      (entry.book && entry.chapter && entry.verse)
  );
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

function replaceStudioPreviewReference(entry: JournalLogEntry, reference: string) {
  const currentPreview = entry.preview ?? '';
  const notePreview = currentPreview
    .replace(/^[1-3]?\s?[A-Za-z]+(?:\s[A-Za-z]+)*\s+\d+:\d+\s*/, '')
    .trim();

  return {
    ...entry,
    preview: `${reference}${notePreview ? ` ${notePreview}` : ''}`.slice(0, 80),
  };
}

async function hydrateStudioLogEntries(entries: JournalLogEntry[]) {
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

export default function JournalScreen() {
  const router = useRouter();
  const { colorTheme, t } = useAppSettings();
  const [selectedView, setSelectedView] = useState<'new' | 'logs'>('new');
  const [journalLogs, setJournalLogs] = useState<JournalLogGroup[]>([]);
  const [weeklyMoodSummary, setWeeklyMoodSummary] = useState<WeeklyMoodSummary>(() =>
    getMostUsedMoodSummary([])
  );

  const templates: JournalTemplate[] = useMemo(() => [
    {
      key: 'prayer',
      emoji: '🙏',
      iconImage: PRAYER_JOURNAL_ICON,
      title: t('prayerJournal'),
      subtitle: 'Talk to God and write what is on your heart.',
      icon: 'heart-outline',
      tint: '#B66D7A',
      soft: '#FCEEF3',
    },
    {
      key: 'bible-study',
      emoji: '📖',
      iconImage: BIBLE_STUDY_JOURNAL_ICON,
      title: t('bibleStudy'),
      subtitle: 'Dig into a verse and capture what you learn.',
      icon: 'book-outline',
      tint: '#6C7FA8',
      soft: '#EEF3FF',
    },
    {
      key: 'church-day',
      emoji: '⛪',
      iconImage: CHURCH_DAY_JOURNAL_ICON,
      title: t('churchDay'),
      subtitle: 'Save sermon notes, key verses, and reflections.',
      icon: 'sparkles-outline',
      tint: '#8C7A66',
      soft: '#F7F0E8',
    },
    {
      key: 'daily-devotional',
      emoji: '🌅',
      iconImage: DAILY_DEVOTIONAL_JOURNAL_ICON,
      title: t('dailyDevotional'),
      subtitle: 'Reflect, apply, ask questions, and pray daily.',
      icon: 'sunny-outline',
      tint: '#9B7A59',
      soft: '#FFF4E8',
    },
    {
      key: 'journal-studio',
      emoji: '🎨',
      iconImage: STUDIO_JOURNAL_ICON,
      title: t('tabStudio'),
      subtitle: 'Open creative page with verse cards and stickers.',
      icon: 'color-wand-outline',
      tint: '#8A669C',
      soft: '#F6EEFB',
    },
  ], [t]);

  const templateMap = useMemo(
    () =>
      templates.reduce(
        (currentMap, template) => {
          currentMap[template.key] = template;
          return currentMap;
        },
        {} as Record<JournalEntryType, JournalTemplate>
      ),
    [templates]
  );

  const loadJournalLogs = useCallback(async () => {
    const [data, weeklyMoods] = await Promise.all([
      AsyncStorage.getItem(JOURNAL_INDEX_KEY),
      AsyncStorage.multiGet(getRecentMoodStorageKeys(new Date())),
    ]);
    const entries = (await hydrateStudioLogEntries(safeParseJournalIndex(data)))
      .filter((entry) => entry.type in templateMap)
      .filter(hasVisibleJournalContent)
      .sort((left, right) => right.updatedAt - left.updatedAt);

    const groupsByDay = new Map<string, JournalLogGroup>();

    entries.forEach((entry) => {
      const entryDate = parseEntryDate(entry);
      const dayKey = getLocalDayKey(entryDate);
      const existingGroup = groupsByDay.get(dayKey);

      if (existingGroup) {
        existingGroup.entries.push(entry);
        return;
      }

      groupsByDay.set(dayKey, {
        key: dayKey,
        title: formatLogDayTitle(entryDate),
        entries: [entry],
      });
    });

    const moodPairs = await AsyncStorage.multiGet(
      Array.from(groupsByDay.keys()).map((dayKey) => `daily_mood_${dayKey}`)
    );
    const moodByDay = new Map(
      moodPairs.map(([storageKey, moodKey]) => [
        storageKey.replace('daily_mood_', ''),
        moodKey && MOOD_LABELS[moodKey] ? MOOD_LABELS[moodKey] : undefined,
      ])
    );

    setJournalLogs(
      Array.from(groupsByDay.values()).map((group) => ({
        ...group,
        mood: moodByDay.get(group.key),
      }))
    );
    setWeeklyMoodSummary(getMostUsedMoodSummary(weeklyMoods.map(([, value]) => value)));
  }, [templateMap]);

  useFocusEffect(
    useCallback(() => {
      void loadJournalLogs();
    }, [loadJournalLogs])
  );

  const weeklySummary = useMemo(() => {
    const weekDayKeys = new Set<string>();
    const today = new Date();

    for (let index = 0; index < 7; index += 1) {
      const day = new Date(today);
      day.setDate(day.getDate() - index);
      weekDayKeys.add(getLocalDayKey(day));
    }

    const weekEntries = journalLogs.flatMap((group) =>
      group.entries.filter((entry) => weekDayKeys.has(getLocalDayKey(parseEntryDate(entry))))
    );
    const activeDays = new Set(weekEntries.map((entry) => getLocalDayKey(parseEntryDate(entry)))).size;
    const favoriteCount = weekEntries.filter((entry) => entry.isFavorite).length;

    return {
      activeDays,
      entryCount: weekEntries.length,
      favoriteCount,
    };
  }, [journalLogs]);

  const openTemplate = (template: JournalTemplate) => {
    router.push(
      template.key === 'prayer'
        ? {
            pathname: '/prayer-journal',
            params: { newEntryToken: Date.now().toString() },
          }
        : template.key === 'bible-study'
          ? {
              pathname: '/bible-study-journal',
              params: { newEntryToken: Date.now().toString() },
            }
          : template.key === 'church-day'
            ? {
                pathname: '/church-day-journal',
                params: { newEntryToken: Date.now().toString() },
              }
            : template.key === 'daily-devotional'
              ? {
                  pathname: '/daily-devotional-journal',
                  params: { newEntryToken: Date.now().toString() },
                }
              : {
                  pathname: '/studio',
                  params: { blankStudioToken: Date.now().toString() },
                }
    );
  };

  const openLogEntry = (entry: JournalLogEntry) => {
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

    if (entry.type === 'journal-studio') {
      router.push({ pathname: '/studio', params: { entryId: entry.id } });
    }
  };

  const deleteLogEntry = useCallback(async (entryToDelete: JournalLogEntry) => {
    const data = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
    const entries = safeParseJournalIndex(data);
    const nextEntries = entries.filter(
      (entry) => !(entry.id === entryToDelete.id && entry.type === entryToDelete.type)
    );

    await AsyncStorage.setItem(JOURNAL_INDEX_KEY, JSON.stringify(nextEntries));

    const storageKey = getEntryStorageKey(entryToDelete);
    if (storageKey) {
      await AsyncStorage.removeItem(storageKey);
    }

    setJournalLogs((currentGroups) =>
      currentGroups
        .map((group) => ({
          ...group,
          entries: group.entries.filter(
            (entry) => !(entry.id === entryToDelete.id && entry.type === entryToDelete.type)
          ),
        }))
        .filter((group) => group.entries.length > 0)
    );
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.segmentedControl, { backgroundColor: colorTheme.toolbarBackground }]}>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedView === 'new' }}
            activeOpacity={0.85}
            onPress={() => setSelectedView('new')}
            style={[
              styles.segmentButton,
              selectedView === 'new'
                ? [styles.segmentButtonActive, { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border }]
                : null,
            ]}>
            <Text style={styles.segmentButtonText}>New Entry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedView === 'logs' }}
            activeOpacity={0.85}
            onPress={() => setSelectedView('logs')}
            style={[
              styles.segmentButton,
              selectedView === 'logs'
                ? [styles.segmentButtonActive, { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border }]
                : null,
            ]}>
            <Text style={styles.segmentButtonText}>Daily Logs</Text>
          </TouchableOpacity>
        </View>

        {selectedView === 'new' ? (
          <View style={styles.cardStack}>
            {templates.map((template) => (
              <TouchableOpacity
                key={template.key}
                activeOpacity={0.9}
                onPress={() => openTemplate(template)}
                style={[
                  styles.templateCard,
                  { backgroundColor: template.soft, borderColor: colorTheme.border },
                ]}>
                <View
                  style={[
                    styles.iconShell,
                    template.iconImage ? styles.iconShellTransparent : { backgroundColor: '#FFFFFF' },
                  ]}>
                  {template.iconImage ? (
                    <Image source={template.iconImage} resizeMode="contain" style={styles.templateImageIcon} />
                  ) : (
                    <Text style={styles.templateEmoji}>{template.emoji}</Text>
                  )}
                </View>

                <View style={styles.templateContent}>
                  <View style={styles.titleRow}>
                    <Text style={styles.templateTitle}>{template.title}</Text>
                    <Ionicons name={template.icon} size={18} color={template.tint} />
                  </View>
                  <Text style={styles.templateSubtitle}>{template.subtitle}</Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color={template.tint} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.logsStack}>
            {journalLogs.length > 0 ? (
              <>
                <View style={[styles.weekReflectionCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
                  <View style={styles.weekReflectionHeader}>
                    <Ionicons name="calendar-clear-outline" size={18} color="#7A6F66" />
                    <Text style={styles.weekReflectionTitle}>Your week with God</Text>
                  </View>
                  <View style={styles.weekReflectionStats}>
                    <View style={styles.weekReflectionStat}>
                      <Text style={styles.weekReflectionValue}>{weeklySummary.activeDays}</Text>
                      <Text style={styles.weekReflectionLabel}>days</Text>
                    </View>
                    <View style={styles.weekReflectionStat}>
                      <Text style={styles.weekReflectionValue}>{weeklySummary.entryCount}</Text>
                      <Text style={styles.weekReflectionLabel}>entries</Text>
                    </View>
                    <View style={styles.weekReflectionStat}>
                      <Text style={styles.weekReflectionValue}>{weeklySummary.favoriteCount}</Text>
                      <Text style={styles.weekReflectionLabel}>saved</Text>
                    </View>
                    <View style={styles.weekReflectionStat}>
                      <Ionicons name={weeklyMoodSummary.icon} size={18} color={weeklyMoodSummary.tint} />
                      <Text numberOfLines={1} style={styles.weekReflectionMoodValue}>{weeklyMoodSummary.label}</Text>
                      <Text style={styles.weekReflectionLabel}>mood</Text>
                    </View>
                  </View>
                </View>
                {journalLogs.map((group, groupIndex) => (
                <View key={group.key} style={[styles.logDayGroup, groupIndex % 2 === 0 ? styles.scrapbookBlush : styles.scrapbookBlue]}>
                  <View style={styles.scrapbookTapeLeft} />
                  <View style={styles.scrapbookTapeRight} />
                  <View style={styles.logDayHeader}>
                    <Text style={styles.logDayTitle}>{group.title}</Text>
                    <Text style={styles.logDayCount}>{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</Text>
                  </View>
                  {group.mood ? (
                    <View style={styles.logDayMoodRow}>
                      <Ionicons name={group.mood.icon} size={14} color={group.mood.tint} />
                      <Text style={styles.logDayMoodText}>{group.mood.label}</Text>
                    </View>
                  ) : null}
                  <View style={styles.logEntryStack}>
                    {group.entries.map((entry) => {
                      const template = templateMap[entry.type];
                      const entryDate = parseEntryDate(entry);
                      const renderDeleteAction = () => (
                        <RectButton
                          style={styles.deleteAction}
                          onPress={() => {
                            void deleteLogEntry(entry);
                          }}>
                          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                          <Text style={styles.deleteActionText}>Delete</Text>
                        </RectButton>
                      );

                      return (
                        <Swipeable
                          key={`${entry.type}:${entry.id}`}
                          overshootRight={false}
                          renderRightActions={renderDeleteAction}
                          rightThreshold={38}>
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => openLogEntry(entry)}
                            style={[
                              styles.logEntryCard,
                              { backgroundColor: template.soft, borderColor: colorTheme.border },
                            ]}>
                            <Image source={template.iconImage} resizeMode="contain" style={styles.logEntryIcon} />
                            <View style={styles.logEntryContent}>
                              <View style={styles.logEntryTitleRow}>
                                <Text style={styles.logEntryTitle}>{template.title}</Text>
                                {entry.isFavorite ? <Ionicons name="heart" size={14} color={template.tint} /> : null}
                              </View>
                              <Text style={styles.logEntryPreview} numberOfLines={1}>
                                {entry.preview || 'Open to keep writing...'}
                              </Text>
                            </View>
                            <Text style={styles.logEntryTime}>{formatLogTime(entryDate)}</Text>
                          </TouchableOpacity>
                        </Swipeable>
                      );
                    })}
                  </View>
                </View>
                ))}
              </>
            ) : (
              <View style={styles.emptyLogs}>
                <Ionicons name="calendar-clear-outline" size={28} color="#9A8F88" />
                <Text style={styles.emptyLogsTitle}>No daily logs yet</Text>
                <Text style={styles.emptyLogsText}>Create a journal entry and it will appear here by date.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 22 : 72,
    paddingBottom: Platform.OS === 'web' ? 48 : 120,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 18,
    padding: 5,
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    borderWidth: 1,
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A403C',
  },
  cardStack: {
    gap: 10,
  },
  logsStack: {
    gap: 14,
  },
  weekReflectionCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 13,
  },
  weekReflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  weekReflectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  weekReflectionStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekReflectionStat: {
    width: '48.7%',
    minHeight: 78,
    borderRadius: 8,
    backgroundColor: '#F8F5F2',
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekReflectionValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  weekReflectionMoodValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  weekReflectionLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '800',
    color: '#7A6F66',
    textTransform: 'uppercase',
    letterSpacing: 0,
    textAlign: 'center',
  },
  logDayGroup: {
    position: 'relative',
    borderRadius: 8,
    padding: 14,
    gap: 8,
    overflow: 'hidden',
  },
  scrapbookBlush: {
    backgroundColor: '#FFF4F6',
  },
  scrapbookBlue: {
    backgroundColor: '#F4F7FF',
  },
  scrapbookTapeLeft: {
    position: 'absolute',
    top: 8,
    left: 18,
    width: 44,
    height: 12,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 230, 178, 0.72)',
    transform: [{ rotate: '-5deg' }],
  },
  scrapbookTapeRight: {
    position: 'absolute',
    top: 8,
    right: 22,
    width: 44,
    height: 12,
    borderRadius: 3,
    backgroundColor: 'rgba(232, 214, 248, 0.78)',
    transform: [{ rotate: '5deg' }],
  },
  logDayHeader: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  logDayTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1F1F',
    marginTop: 2,
  },
  logDayCount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A6F66',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logDayMoodRow: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logDayMoodText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5F5651',
  },
  logEntryStack: {
    gap: 8,
  },
  logEntryCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteAction: {
    width: 88,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D65C5C',
    gap: 4,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  logEntryIcon: {
    width: 34,
    height: 34,
    marginRight: 10,
  },
  logEntryContent: {
    flex: 1,
    paddingRight: 8,
  },
  logEntryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logEntryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  logEntryPreview: {
    marginTop: 2,
    fontSize: 12,
    color: '#665E59',
  },
  logEntryTime: {
    fontSize: 11,
    color: '#7A6F66',
    fontWeight: '700',
  },
  emptyLogs: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyLogsTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  emptyLogsText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#7A6F66',
    textAlign: 'center',
  },
  templateCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconShell: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconShellTransparent: {
    backgroundColor: 'transparent',
  },
  templateEmoji: {
    fontSize: 24,
  },
  templateImageIcon: {
    width: 60,
    height: 60,
  },
  templateContent: {
    flex: 1,
    paddingRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  templateSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5F5651',
  },
});
