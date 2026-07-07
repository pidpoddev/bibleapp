import type { TranslationKey } from '@/utils/app-settings';

type Translator = (key: TranslationKey, params?: Record<string, string | number>) => string;

type JournalSection = {
  id: string;
  label: string;
  text: string;
};

type SectionKey = {
  id: string;
  labelKey: TranslationKey;
};

export const PRAYER_SECTION_KEYS: SectionKey[] = [
  { id: '1', labelKey: 'journalPrayerPromptPrayingFor' },
  { id: '2', labelKey: 'journalPrayerPromptThankfulFor' },
  { id: '3', labelKey: 'journalPrayerPromptHeart' },
  { id: '4', labelKey: 'journalPrayerPromptPeace' },
  { id: '5', labelKey: 'journalPrayerPromptAnswered' },
];

export const BIBLE_STUDY_SECTION_KEYS: SectionKey[] = [
  { id: '1', labelKey: 'journalBibleStudyPromptStandsOut' },
  { id: '2', labelKey: 'journalBibleStudyPromptMeans' },
  { id: '3', labelKey: 'journalBibleStudyPromptApply' },
  { id: '4', labelKey: 'journalBibleStudyPromptPrayer' },
  { id: '5', labelKey: 'editorNote' },
];

export const CHURCH_DAY_SECTION_KEYS: SectionKey[] = [
  { id: '1', labelKey: 'journalChurchPromptMessage' },
  { id: '2', labelKey: 'journalChurchPromptSpoke' },
  { id: '3', labelKey: 'journalChurchPromptPrayer' },
];

export const DAILY_DEVOTIONAL_SECTION_KEYS: SectionKey[] = [
  { id: '1', labelKey: 'journalDailyPromptReflections' },
  { id: '2', labelKey: 'journalDailyPromptApplication' },
  { id: '3', labelKey: 'journalDailyPromptQuestions' },
  { id: '4', labelKey: 'journalDailyPromptKeyVerses' },
  { id: '5', labelKey: 'journalDailyPromptPrayer' },
];

export function makeJournalSections(keys: SectionKey[], t: Translator) {
  return keys.map(({ id, labelKey }) => ({
    id,
    label: t(labelKey),
    text: '',
  }));
}

export function localizeJournalSections<TSection extends JournalSection>(
  sections: TSection[],
  keys: SectionKey[],
  t: Translator
) {
  const keyById = new Map(keys.map((entry) => [entry.id, entry.labelKey]));

  return sections.map((section) => {
    const labelKey = keyById.get(section.id);

    return labelKey
      ? {
          ...section,
          label: t(labelKey),
        }
      : section;
  });
}
