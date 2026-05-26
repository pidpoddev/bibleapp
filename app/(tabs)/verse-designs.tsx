import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppSettings } from '@/utils/app-settings';
import {
  deleteVerseDesign,
  getVerseDesignReferenceLabel,
  loadVerseDesigns,
  type VerseDesignListItem,
} from '@/utils/verse-design-list';

function getDesignPreviewLabel(
  item: VerseDesignListItem,
  t: ReturnType<typeof useAppSettings>['t']
) {
  const parts = [];
  const stickerCount = item.stickers.length;
  const noteCount = item.notes.length;
  const highlightCount = Object.keys(item.highlights).length;

  if (item.verseCards.length > 0) {
    parts.push(t('verseDesignCardType'));
  }

  if (stickerCount > 0) {
    parts.push(
      stickerCount === 1
        ? t('stickersCount', { count: stickerCount })
        : t('stickersCountPlural', { count: stickerCount })
    );
  }

  if (noteCount > 0) {
    parts.push(
      noteCount === 1
        ? t('notesCount', { count: noteCount })
        : t('notesCountPlural', { count: noteCount })
    );
  }

  if (highlightCount > 0) {
    parts.push(
      highlightCount === 1
        ? t('highlightsCount', { count: highlightCount })
        : t('highlightsCountPlural', { count: highlightCount })
    );
  }

  return parts.length > 0 ? parts.join(' • ') : t('savedVerseDesign');
}

function formatSavedAt(savedAt: string) {
  const date = new Date(savedAt);

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

export default function VerseDesignsScreen() {
  const navigation = useNavigation<any>();
  const { colorTheme, t } = useAppSettings();
  const [designs, setDesigns] = useState<VerseDesignListItem[]>([]);

  const refreshDesigns = useCallback(async () => {
    try {
      setDesigns(await loadVerseDesigns());
    } catch (error) {
      console.warn('Failed to load verse designs', error);
      setDesigns([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshDesigns();
    }, [refreshDesigns])
  );

  const openDesign = (item: VerseDesignListItem) => {
    navigation.navigate('studio', {
      design: item,
      restoreToken: `${item.key}-${Date.now()}`,
      selectedBook: item.book,
      selectedChapter: item.chapter,
      selectedVerse: item.verse,
    });
  };

  const removeDesign = (item: VerseDesignListItem) => {
    const performDelete = async () => {
      try {
        await deleteVerseDesign(item);
        await refreshDesigns();
      } catch (error) {
        console.warn('Failed to delete verse design', error);
      }
    };

    if (Platform.OS === 'web') {
      void performDelete();
      return;
    }

    Alert.alert(
      t('verseDesignDeleteTitle'),
      t('verseDesignDeleteMessage', {
        reference: getVerseDesignReferenceLabel(item),
      }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            void performDelete();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <Text style={styles.title}>{t('verseDesignsTitle')}</Text>
      <Text style={styles.subtitle}>{t('verseDesignsSubtitle')}</Text>

      <FlatList
        data={designs}
        keyExtractor={(item) => `${item.book}:${item.key}`}
        contentContainerStyle={[
          styles.listContent,
          designs.length === 0 ? styles.emptyListContent : null,
        ]}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openDesign(item)}
            style={[
              styles.designCard,
              {
                backgroundColor: colorTheme.cardBackground,
                borderColor: colorTheme.border,
              },
            ]}>
            <View style={styles.designTextBlock}>
              <Text style={styles.reference}>{getVerseDesignReferenceLabel(item)}</Text>
              <Text numberOfLines={2} style={styles.preview}>
                {getDesignPreviewLabel(item, t)}
              </Text>
              {formatSavedAt(item.savedAt) ? (
                <Text style={styles.savedAt}>
                  {t('verseDesignSavedAt', { date: formatSavedAt(item.savedAt) })}
                </Text>
              ) : null}
            </View>

            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                removeDesign(item);
              }}
              style={[
                styles.deleteButton,
                { backgroundColor: colorTheme.toolbarBackground },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('verseDesignDeleteAccessibility', {
                reference: getVerseDesignReferenceLabel(item),
              })}>
              <Ionicons name="trash-outline" size={19} color="#9A4C56" />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('verseDesignsEmptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('verseDesignsEmptyText')}</Text>
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
    paddingTop: Platform.OS === 'web' ? 28 : 72,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7A6F66',
    marginTop: 8,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: Platform.OS === 'web' ? 48 : 120,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  designCard: {
    borderWidth: 1,
    borderColor: '#E8DCD4',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  designTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  reference: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  preview: {
    fontSize: 13,
    lineHeight: 19,
    color: '#7A6F66',
  },
  savedAt: {
    fontSize: 12,
    lineHeight: 18,
    color: '#9B8B82',
    marginTop: 4,
  },
  deleteButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EDE8',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#7A6F66',
    textAlign: 'center',
  },
});
