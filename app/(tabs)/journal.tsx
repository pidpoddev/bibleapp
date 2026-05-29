import { useRouter } from 'expo-router';
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '@/utils/app-settings';

type JournalTemplate = {
  key: 'prayer' | 'bible-study' | 'church-day' | 'daily-devotional' | 'journal-studio';
  emoji: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  soft: string;
};
const JOURNAL_HEADER_ICON = require('../../assets/images/toolbar-icons/journal-tab.png');

export default function JournalScreen() {
  const router = useRouter();
  const { colorTheme, t } = useAppSettings();

  const templates: JournalTemplate[] = [
    {
      key: 'prayer',
      emoji: '🙏',
      title: t('prayerJournal'),
      subtitle: 'Talk to God and write what is on your heart.',
      icon: 'heart-outline',
      tint: '#B66D7A',
      soft: '#FCEEF3',
    },
    {
      key: 'bible-study',
      emoji: '📖',
      title: t('bibleStudy'),
      subtitle: 'Dig into a verse and capture what you learn.',
      icon: 'book-outline',
      tint: '#6C7FA8',
      soft: '#EEF3FF',
    },
    {
      key: 'church-day',
      emoji: '⛪',
      title: t('churchDay'),
      subtitle: 'Save sermon notes, key verses, and reflections.',
      icon: 'sparkles-outline',
      tint: '#8C7A66',
      soft: '#F7F0E8',
    },
    {
      key: 'daily-devotional',
      emoji: '🌅',
      title: t('dailyDevotional'),
      subtitle: 'Reflect, apply, ask questions, and pray daily.',
      icon: 'sunny-outline',
      tint: '#9B7A59',
      soft: '#FFF4E8',
    },
    {
      key: 'journal-studio',
      emoji: '🎨',
      title: t('tabStudio'),
      subtitle: 'Open creative page with verse cards and stickers.',
      icon: 'color-wand-outline',
      tint: '#8A669C',
      soft: '#F6EEFB',
    },
  ];

  const openTemplate = (template: JournalTemplate) => {
    router.push(
      template.key === 'prayer'
        ? '/prayer-journal-list'
        : template.key === 'bible-study'
          ? '/bible-study-journal'
          : template.key === 'church-day'
            ? '/church-day-journal'
            : template.key === 'daily-devotional'
              ? '/daily-devotional-journal'
              : '/journal-studio'
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
          <View style={styles.heroTitleRow}>
            <Image source={JOURNAL_HEADER_ICON} style={styles.heroIcon} resizeMode="contain" />
            <Text style={styles.title}>{t('tabJournal')}</Text>
          </View>
          <Text style={styles.subtitle}>
            Choose your page style and start writing.
          </Text>
        </View>

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
              <View style={[styles.iconShell, { backgroundColor: '#FFFFFF' }]}>
                <Text style={styles.templateEmoji}>{template.emoji}</Text>
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
    paddingTop: Platform.OS === 'web' ? 18 : 34,
    paddingBottom: Platform.OS === 'web' ? 48 : 120,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 12,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIcon: {
    width: 28,
    height: 28,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 21,
    color: '#6E645E',
    marginBottom: 4,
  },
  cardStack: {
    gap: 10,
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
  templateEmoji: {
    fontSize: 24,
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
