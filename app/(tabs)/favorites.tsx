import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppSettings } from '@/utils/app-settings';

type FavoriteVerseDesign = {
  key: string;
  book: string;
  chapter: number;
  verse: number;
  selectedVerses?: number[];
  savedAt?: string;
  stickers: unknown[];
  notes: unknown[];
  highlights: Record<string, string>;
  selectedFont: string;
  fontSize: number;
};

const SAVED_DESIGNS_STORAGE_KEY = 'favorites';

function getReferenceLabel(item: FavoriteVerseDesign) {
  const verses =
    item.selectedVerses && item.selectedVerses.length > 0
      ? item.selectedVerses.join(', ')
      : String(item.verse);

  return `${item.book} ${item.chapter}:${verses}`;
}

function getPreviewLabel(item: FavoriteVerseDesign) {
  const stickerCount = item.stickers?.length ?? 0;
  const noteCount = item.notes?.length ?? 0;

  if (stickerCount === 0 && noteCount === 0) {
    return 'Saved verse design';
  }

  const parts = [];

  if (stickerCount > 0) {
    parts.push(`${stickerCount} sticker${stickerCount === 1 ? '' : 's'}`);
  }

  if (noteCount > 0) {
    parts.push(`${noteCount} note${noteCount === 1 ? '' : 's'}`);
  }

  return parts.join(' • ');
}

export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const { colorTheme } = useAppSettings();
  const [favorites, setFavorites] = useState<FavoriteVerseDesign[]>([]);

  const loadFavorites = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(SAVED_DESIGNS_STORAGE_KEY);
      const parsed = data ? (JSON.parse(data) as FavoriteVerseDesign[]) : [];
      setFavorites(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.warn('Failed to load saved verse designs', error);
      setFavorites([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <Text style={styles.title}>💖 Favorites</Text>
      <Text style={styles.subtitle}>Saved verse designs you love</Text>

      <FlatList
        data={favorites}
        numColumns={2}
        keyExtractor={(item) => item.key}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[
          styles.listContent,
          favorites.length === 0 ? styles.emptyListContent : null,
        ]}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              navigation.navigate('studio', {
                design: item,
                restoreToken: Date.now().toString(),
                selectedBook: item.book,
                selectedChapter: item.chapter,
                selectedVerse: item.verse,
              });
            }}
            style={[styles.card, { backgroundColor: colorTheme.cardBackground }]}>
            <Text style={styles.cardType}>📖 Verse Design</Text>
            <Text style={styles.cardDate}>{getReferenceLabel(item)}</Text>
            <Text numberOfLines={4} style={styles.cardPreview}>
              {getPreviewLabel(item)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No verse favorites yet 💖</Text>
            <Text style={styles.emptyText}>
              Save a Studio verse design and it will appear here.
            </Text>
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
    paddingTop: 72,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 120,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  gridRow: {
    gap: 0,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    margin: 8,
    padding: 14,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    minHeight: 140,
  },
  cardType: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 6,
  },
  cardDate: {
    fontSize: 12,
    color: '#8A7F76',
    marginBottom: 8,
    fontWeight: '600',
  },
  cardPreview: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
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
