import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppSettings } from '@/utils/app-settings';

const TODAY_VERSE = {
  book: 'Psalms',
  chapter: 46,
  verse: 10,
};

export default function HomeScreen() {
  const router = useRouter();
  const { colorTheme, t } = useAppSettings();

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

  const openTodayVerse = () => {
    router.push({
      pathname: '/studio',
      params: {
        blankStudioToken: '',
        openSelectedVerse: 'true',
        selectedBook: TODAY_VERSE.book,
        selectedChapter: String(TODAY_VERSE.chapter),
        selectedVerse: String(TODAY_VERSE.verse),
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
          <View style={[styles.sunBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name="sunny-outline" size={20} color="#9B7A59" />
          </View>
          <Text style={styles.kicker}>{t('homeGreeting')}</Text>
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

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={openTodayVerse}
        style={[styles.verseCard, { backgroundColor: colorTheme.cardBackground, borderColor: colorTheme.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name="book-outline" size={18} color="#7A6F66" />
          </View>
          <Text style={styles.cardLabel}>{t('homeVerseLabel')}</Text>
        </View>
        <Text style={styles.verseText}>{t('homeVerseText')}</Text>
        <View style={styles.referenceRow}>
          <Text style={styles.reference}>{t('homeVerseReference')}</Text>
          <Ionicons name="chevron-forward" size={18} color="#8D7C70" />
        </View>
      </TouchableOpacity>

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
          style={[styles.actionButton, { backgroundColor: colorTheme.tint }]}>
          <Ionicons name="book" size={18} color="#FFFDF9" />
          <Text style={styles.primaryActionText}>{t('homeBibleAction')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={openPrayerJournal}
          style={[styles.actionButton, styles.secondaryActionButton, { backgroundColor: colorTheme.toolbarBackground, borderColor: colorTheme.border }]}>
          <Ionicons name="create-outline" size={18} color="#5B514D" />
          <Text style={styles.secondaryActionText}>{t('homePrayerAction')}</Text>
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
    gap: 9,
    marginBottom: 10,
  },
  sunBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9C7988',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    fontSize: 29,
    lineHeight: 36,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
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
    fontSize: 12,
    fontWeight: '700',
    color: '#5E5550',
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
    fontSize: 12,
    fontWeight: '700',
    color: '#8D7C70',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  verseText: {
    fontSize: 22,
    lineHeight: 31,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#8D7C70',
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
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginTop: 10,
    marginBottom: 6,
  },
  comfortText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#625853',
  },
  cardLinkRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B514D',
  },
  actionSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 148,
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
    fontSize: 14,
    fontWeight: '700',
  },
  churchNote: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 3,
  },
  churchNoteBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6E645E',
  },
});
