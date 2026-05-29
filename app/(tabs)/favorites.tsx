import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { useAppSettings } from '@/utils/app-settings';
import { JOURNAL_INDEX_KEY } from '@/utils/storage-keys';

const FAVORITES_ICON = require('../../assets/images/toolbar-icons/favorites-tab.png');

type JournalFavorite = {
  id: string;
  type: 'prayer' | 'bible-study' | 'church-day' | 'daily-devotional' | 'journal-studio';
  date: string;
  preview: string;
  updatedAt: number;
  isFavorite?: boolean;
};

type UnifiedFavorite = {
  id: string;
  type: JournalFavorite['type'];
  title: string;
  subtitle: string;
  preview: string;
  updatedAt: number;
  entryId: string;
};

function safeParseArray<T>(value: string | null): T[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function formatSavedAt(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTypeBadge(type: UnifiedFavorite['type']) {
  switch (type) {
    case 'prayer':
      return { emoji: '🙏', icon: 'heart-outline' as const, tint: '#B66D7A', soft: '#FCEEF3' };
    case 'bible-study':
      return { emoji: '📖', icon: 'book-outline' as const, tint: '#6C7FA8', soft: '#EEF3FF' };
    case 'church-day':
      return { emoji: '⛪', icon: 'sparkles-outline' as const, tint: '#8C7A66', soft: '#F7F0E8' };
    case 'daily-devotional':
      return { emoji: '🌅', icon: 'sunny-outline' as const, tint: '#9B7A59', soft: '#FFF4E8' };
    case 'journal-studio':
      return { emoji: '🎨', icon: 'color-wand-outline' as const, tint: '#8A669C', soft: '#F6EEFB' };
    default:
      return { emoji: '⭐️', icon: 'bookmark-outline' as const, tint: '#7A6F66', soft: '#F8F5F2' };
  }
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { colorTheme, t } = useAppSettings();
  const [favorites, setFavorites] = useState<UnifiedFavorite[]>([]);

  const journalTypeMap = useMemo(
    () => ({
      prayer: { title: t('prayerJournal'), subtitle: 'Prayer Journal' },
      'bible-study': { title: t('bibleStudy'), subtitle: 'Bible Study' },
      'church-day': { title: t('churchDay'), subtitle: 'Church Day' },
      'daily-devotional': { title: t('dailyDevotional'), subtitle: 'Daily Devotional' },
      'journal-studio': { title: t('tabStudio'), subtitle: 'Journal Studio' },
    }),
    [t]
  );

  const loadFavorites = useCallback(async () => {
    try {
      const journalData = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
      const journalEntries = safeParseArray<JournalFavorite>(journalData);

      const unifiedJournal: UnifiedFavorite[] = (Array.isArray(journalEntries)
        ? journalEntries
        : []
      )
        .filter((entry) => Boolean(entry.isFavorite))
        .filter((entry) => entry.type in journalTypeMap)
        .map((entry) => ({
          id: `${entry.type}:${entry.id}`,
          type: entry.type,
          title: journalTypeMap[entry.type].title,
          subtitle: journalTypeMap[entry.type].subtitle,
          preview: entry.preview || 'Open to keep writing...',
          updatedAt: entry.updatedAt,
          entryId: entry.id,
        }));

      const nextFavorites = [...unifiedJournal].sort(
        (left, right) => right.updatedAt - left.updatedAt
      );

      setFavorites(nextFavorites);
    } catch (error) {
      console.warn('Failed to load favorites', error);
      setFavorites([]);
    }
  }, [journalTypeMap]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
    }, [loadFavorites])
  );

  const deleteFavorite = useCallback(
    async (item: UnifiedFavorite) => {
      const journalData = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
      const journalEntries = safeParseArray<JournalFavorite>(journalData);
      const nextJournalEntries = journalEntries.filter((entry) => entry.id !== item.entryId);
      await AsyncStorage.setItem(JOURNAL_INDEX_KEY, JSON.stringify(nextJournalEntries));

      if (item.type === 'prayer') {
        await AsyncStorage.removeItem(`journal_prayer_${item.entryId}`);
      } else if (item.type === 'bible-study') {
        await AsyncStorage.removeItem(`journal_bible_study_${item.entryId}`);
      } else if (item.type === 'church-day') {
        await AsyncStorage.removeItem(`journal_church_day_${item.entryId}`);
      } else if (item.type === 'daily-devotional') {
        await AsyncStorage.removeItem(`journal_daily_devotional_${item.entryId}`);
      } else if (item.type === 'journal-studio') {
        await AsyncStorage.removeItem(`journal_studio_${item.entryId}`);
      }

      setFavorites((current) => current.filter((favorite) => favorite.id !== item.id));
    },
    []
  );

  const openFavorite = (item: UnifiedFavorite) => {
    if (item.type === 'prayer') {
      router.push({ pathname: '/prayer-journal', params: { entryId: item.entryId } });
      return;
    }

    if (item.type === 'bible-study') {
      router.push({ pathname: '/bible-study-journal', params: { entryId: item.entryId } });
      return;
    }

    if (item.type === 'church-day') {
      router.push({ pathname: '/church-day-journal', params: { entryId: item.entryId } });
      return;
    }

    if (item.type === 'daily-devotional') {
      router.push({ pathname: '/daily-devotional-journal', params: { entryId: item.entryId } });
      return;
    }

    if (item.type === 'journal-studio') {
      router.push({ pathname: '/journal-studio', params: { entryId: item.entryId } });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <View style={[styles.heroCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
        <View style={styles.titleRow}>
          <Image source={FAVORITES_ICON} resizeMode="contain" style={styles.titleIcon} />
          <Text style={styles.title}>{t('tabFavorites')}</Text>
        </View>
        <Text style={styles.subtitle}>{t('favoritesSubtitle')}</Text>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          favorites.length === 0 ? styles.emptyListContent : null,
        ]}
        renderItem={({ item }) => {
          const badge = getTypeBadge(item.type);
          const renderDeleteAction = () => (
            <RectButton
              style={styles.deleteAction}
              onPress={() => {
                void deleteFavorite(item);
              }}>
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              <Text style={styles.deleteActionText}>Delete</Text>
            </RectButton>
          );

          return (
            <Swipeable
              overshootRight={false}
              renderRightActions={renderDeleteAction}
              rightThreshold={38}>
              <Pressable
                onPress={() => openFavorite(item)}
                style={[styles.card, { backgroundColor: badge.soft, borderColor: colorTheme.border }]}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardBadgeShell}>
                    <Text style={styles.cardEmoji}>{badge.emoji}</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <View style={styles.cardMetaTitleRow}>
                      <Text style={styles.cardType}>{item.subtitle}</Text>
                      <Ionicons name={badge.icon} size={16} color={badge.tint} />
                    </View>
                    <Text style={styles.cardDate}>{formatSavedAt(item.updatedAt)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={badge.tint} />
                </View>
                <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                <Text numberOfLines={3} style={styles.cardPreview}>{item.preview}</Text>
              </Pressable>
            </Swipeable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('favoritesEmptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('favoritesEmptyText')}</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 18 : 34,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#1F1F1F',
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
    marginTop: 6,
    lineHeight: 21,
    color: '#6E645E',
    marginBottom: 6,
  },
  listContent: {
    paddingBottom: Platform.OS === 'web' ? 48 : 120,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  deleteAction: {
    width: 88,
    marginBottom: 10,
    borderRadius: 20,
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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardBadgeShell: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardEmoji: {
    fontSize: 20,
  },
  cardMeta: {
    flex: 1,
  },
  cardMetaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardType: {
    fontSize: 12,
    color: '#6F655F',
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 11,
    color: '#968B84',
    marginTop: 3,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: '#1F1F1F',
    fontWeight: '700',
    marginBottom: 4,
  },
  cardPreview: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4F4742',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#888888',
    textAlign: 'center',
  },
});
