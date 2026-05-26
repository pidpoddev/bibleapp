import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppSettings } from '@/utils/app-settings';

const TODAY_VERSE = {
  book: 'Psalm',
  chapter: 46,
  verse: 10,
};

export default function HomeScreen() {
  const router = useRouter();
  const { colorTheme, t } = useAppSettings();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colorTheme.screenBackground }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.kicker}>{t('homeGreeting')}</Text>
        <Text style={styles.title}>{t('homeTitle')}</Text>
        <Text style={styles.subtitle}>{t('homeSubtitle')}</Text>
      </View>

      <View
        style={[
          styles.verseCard,
          {
            backgroundColor: colorTheme.cardBackground,
            borderColor: colorTheme.border,
          },
        ]}>
        <View style={styles.cardHeaderRow}>
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: colorTheme.toolbarBackground },
            ]}>
            <Ionicons name="book-outline" size={18} color="#7A6F66" />
          </View>
          <Text style={styles.cardLabel}>{t('homeVerseLabel')}</Text>
        </View>

        <Text style={styles.verseText}>{t('homeVerseText')}</Text>
        <Text style={styles.reference}>{t('homeVerseReference')}</Text>
      </View>

      <View style={styles.twoColumnRow}>
        <View
          style={[
            styles.smallCard,
            {
              backgroundColor: colorTheme.toolbarBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <Ionicons name="heart-outline" size={20} color="#7A6F66" />
          <Text style={styles.smallCardTitle}>{t('homePrayerTitle')}</Text>
          <Text style={styles.smallCardText}>{t('homePrayerText')}</Text>
        </View>

        <View
          style={[
            styles.smallCard,
            {
              backgroundColor: colorTheme.toolbarBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#7A6F66" />
          <Text style={styles.smallCardTitle}>{t('homeQuestionTitle')}</Text>
          <Text style={styles.smallCardText}>{t('homeQuestionText')}</Text>
        </View>
      </View>

      <View
        style={[
          styles.churchNote,
          {
            backgroundColor: colorTheme.cardBackground,
            borderColor: colorTheme.border,
          },
        ]}>
        <Ionicons name="sparkles-outline" size={20} color="#8D7C70" />
        <View style={styles.churchNoteText}>
          <Text style={styles.churchNoteTitle}>{t('homeChurchNote')}</Text>
          <Text style={styles.churchNoteBody}>{t('homeChurchText')}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/bible')}
          style={[styles.actionButton, { backgroundColor: colorTheme.tint }]}>
          <Ionicons name="book" size={18} color="#FFFDF9" />
          <Text style={styles.primaryActionText}>{t('homeBibleAction')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/prayer-journal-list')}
          style={[
            styles.actionButton,
            styles.secondaryActionButton,
            {
              backgroundColor: colorTheme.toolbarBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <Ionicons name="create-outline" size={18} color="#5B514D" />
          <Text style={styles.secondaryActionText}>{t('homePrayerAction')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() =>
          router.push({
            pathname: '/studio',
            params: {
              selectedBook: TODAY_VERSE.book,
              selectedChapter: String(TODAY_VERSE.chapter),
              selectedVerse: String(TODAY_VERSE.verse),
            },
          })
        }
        style={[
          styles.fullWidthAction,
          {
            backgroundColor: colorTheme.cardBackground,
            borderColor: colorTheme.border,
          },
        ]}>
        <Ionicons name="color-wand-outline" size={18} color="#5B514D" />
        <Text style={styles.fullWidthActionText}>{t('homeCreateAction')}</Text>
        <Ionicons name="chevron-forward" size={18} color="#8D7C70" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  content: {
    paddingTop: Platform.OS === 'web' ? 28 : 62,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'web' ? 32 : 112,
  },
  header: {
    marginBottom: 18,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8D7C70',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6E645E',
  },
  verseCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8DCD4',
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EDE8',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8D7C70',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  verseText: {
    fontSize: 23,
    lineHeight: 32,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 14,
  },
  reference: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8D7C70',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  smallCard: {
    flex: 1,
    minHeight: 174,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8DCD4',
    backgroundColor: '#F3EDE8',
    padding: 16,
  },
  smallCardTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginTop: 12,
    marginBottom: 8,
  },
  smallCardText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6E645E',
  },
  churchNote: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8DCD4',
    backgroundColor: '#FFFFFF',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  churchNoteText: {
    flex: 1,
  },
  churchNoteTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  churchNoteBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6E645E',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: '#E8DCD4',
  },
  primaryActionText: {
    color: '#FFFDF9',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionText: {
    color: '#5B514D',
    fontSize: 14,
    fontWeight: '700',
  },
  fullWidthAction: {
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E8DCD4',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  fullWidthActionText: {
    flex: 1,
    marginLeft: 10,
    color: '#5B514D',
    fontSize: 14,
    fontWeight: '700',
  },
});
