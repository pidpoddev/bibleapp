import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppSettings } from '@/utils/app-settings';

export default function JournalScreen() {
  const { template } = useLocalSearchParams<{ template?: string }>();
  const router = useRouter();
  const { colorTheme, t } = useAppSettings();

  const templateLabel =
    template === 'prayer'
      ? t('prayerJournal')
      : template === 'bible-study'
        ? t('bibleStudy')
        : template === 'daily-devotional'
          ? t('dailyDevotional')
          : t('journalBlank');

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <Text style={styles.title}>{t('journalTitle')}</Text>

      <Text style={styles.subtitle}>
        {templateLabel}
      </Text>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (template === 'bible-study') {
            router.push('/bible-study-journal');
            return;
          }

          if (template === 'prayer') {
            router.push('/prayer-journal');
            return;
          }
        }}
        style={[styles.button, { backgroundColor: colorTheme.toolbarBackground }]}>
        <Text style={styles.buttonText}>{t('journalNewPage')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    padding: 20,
    paddingTop: Platform.OS === 'web' ? 28 : 72,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    color: '#777777',
  },
  button: {
    marginTop: 24,
    alignSelf: 'flex-start',
    backgroundColor: '#F3EDE8',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
});
