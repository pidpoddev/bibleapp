import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useAppSettings } from '@/utils/app-settings';

type PrayerJournalListItem = {
  id: string;
  type: 'prayer';
  date: string;
  preview: string;
  isFavorite?: boolean;
  updatedAt: number;
};

const JOURNAL_INDEX_KEY = 'journal_index';
const PURGE_TODAY_FLAG_KEY = 'prayer_purge_today_v2_2026_04_29';

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayLongDatePrefix = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const getTodayShortDatePrefix = () =>
  new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const formatEntryDate = (date: string) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
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

const purgeTodayPrayerEntriesOnce = async () => {
  const hasPurged = await AsyncStorage.getItem(PURGE_TODAY_FLAG_KEY);

  if (hasPurged === 'done') {
    return;
  }

  const data = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
  const allEntries = data ? (JSON.parse(data) as PrayerJournalListItem[]) : [];
  const todayKey = getLocalDateKey();

  const entriesToDelete = allEntries.filter((entry) => {
    if (entry.type !== 'prayer') {
      return false;
    }

    if (typeof entry.date === 'string') {
      const trimmedDate = entry.date.trim();

      if (
        trimmedDate.startsWith(getTodayLongDatePrefix()) ||
        trimmedDate.startsWith(getTodayShortDatePrefix())
      ) {
        return true;
      }
    }

    const parsedDate = new Date(entry.date);
    if (Number.isNaN(parsedDate.getTime())) {
      return false;
    }

    return getLocalDateKey(parsedDate) === todayKey;
  });

  if (entriesToDelete.length > 0) {
    await Promise.all(
      entriesToDelete.map((entry) => AsyncStorage.removeItem(`journal_prayer_${entry.id}`))
    );

    const remainingEntries = allEntries.filter(
      (entry) => !entriesToDelete.some((deletedEntry) => deletedEntry.id === entry.id)
    );

    await AsyncStorage.setItem(JOURNAL_INDEX_KEY, JSON.stringify(remainingEntries));
  }

  await AsyncStorage.setItem(PURGE_TODAY_FLAG_KEY, 'done');
};

export default function PrayerJournalListScreen() {
  const router = useRouter();
  const { colorTheme, t } = useAppSettings();
  const [entries, setEntries] = useState<PrayerJournalListItem[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  const handleNewEntry = () => {
    router.push({
      pathname: '/prayer-journal',
      params: { newEntryToken: Date.now().toString() },
    });
  };

  const deleteEntry = async (id: string) => {
    try {
      await AsyncStorage.removeItem(`journal_prayer_${id}`);

      const data = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
      const allEntries = data ? (JSON.parse(data) as PrayerJournalListItem[]) : [];
      const nextEntries = allEntries.filter((entry) => entry.id !== id);

      await AsyncStorage.setItem(JOURNAL_INDEX_KEY, JSON.stringify(nextEntries));
      setEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== id));
    } catch (error) {
      console.log('Error deleting prayer journal:', error);
    }
  };

  const loadEntries = useCallback(async () => {
    try {
      await purgeTodayPrayerEntriesOnce();

      const data = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
      const allEntries = data ? (JSON.parse(data) as PrayerJournalListItem[]) : [];

      let prayerEntries = allEntries
        .filter((entry) => entry.type === 'prayer')
        .sort((left, right) => right.updatedAt - left.updatedAt);

      if (showFavorites) {
        prayerEntries = prayerEntries.filter((entry) => entry.isFavorite);
      }

      setEntries(prayerEntries);
    } catch (error) {
      console.log('Error loading prayer journals:', error);
    }
  }, [showFavorites]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <Text
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.1}
        minimumFontScale={0.7}
        numberOfLines={1}
        style={styles.title}>
        {t('prayerListTitle')}
      </Text>
      <Text style={styles.subtitle}>{t('prayerListSubtitle')}</Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleNewEntry}
          style={[styles.newButton, { backgroundColor: colorTheme.toolbarBackground }]}>
          <Text style={styles.newButtonText}>{t('newEntry')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => setShowFavorites((current) => !current)}
          style={[
            styles.filterButton,
            { backgroundColor: colorTheme.toolbarBackground },
            showFavorites
              ? [
                  styles.filterButtonActive,
                  { backgroundColor: colorTheme.selectionBackground, borderColor: colorTheme.border },
                ]
              : null,
          ]}>
          <Text style={styles.filterButtonText}>{t('favoritesFilter')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        {entries.length > 0 ? (
          entries.map((entry) => (
            <Swipeable
              key={entry.id}
              overshootRight={false}
              renderRightActions={() => (
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => deleteEntry(entry.id)}
                  style={styles.deleteAction}>
                  <Text style={styles.deleteActionText}>{t('delete')}</Text>
                </TouchableOpacity>
              )}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() =>
                  router.push({
                    pathname: '/prayer-journal',
                    params: { entryId: entry.id },
                  })
                }
                style={[styles.card, { backgroundColor: colorTheme.cardBackground }]}>
                <Text style={styles.date}>{formatEntryDate(entry.date)}</Text>
                <Text numberOfLines={3} style={styles.preview}>
                  {entry.preview || 'Open this entry to keep writing...'}
                </Text>
              </TouchableOpacity>
            </Swipeable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {showFavorites ? t('prayerFavoritesEmptyTitle') : t('prayerEmptyTitle')}
            </Text>
            <Text style={styles.emptyText}>
              {showFavorites
                ? t('prayerFavoritesEmptyText')
                : t('prayerEmptyText')}
            </Text>
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 28 : 52,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    color: '#1F1F1F',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    color: '#777777',
  },
  newButton: {
    backgroundColor: '#F6F1EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  newButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  actionsRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  filterButton: {
    backgroundColor: '#FFF4F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterButtonActive: {
    backgroundColor: '#F3DCE3',
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  listContent: {
    paddingTop: 20,
    paddingBottom: Platform.OS === 'web' ? 48 : 120,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  deleteAction: {
    width: 96,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#E77C7C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  date: {
    fontSize: 13,
    color: '#8A7F76',
    marginBottom: 6,
    fontWeight: '600',
  },
  preview: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
  },
  emptyState: {
    marginTop: 40,
    backgroundColor: '#F9F5F0',
    borderRadius: 20,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#777777',
  },
});
