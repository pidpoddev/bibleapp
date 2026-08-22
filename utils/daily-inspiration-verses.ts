import {
  getDefaultBibleVersionKey,
  getVerseText,
  type BibleLanguageKey,
  type BibleVersionKey,
} from '@/utils/bible-data';
import { CURATED_DAILY_INSPIRATION_VERSE_REFERENCES } from '@/utils/daily-inspiration-verse-references';
import {
  getSeasonalVerseSelection,
  type SeasonalVerseTheme,
} from '@/utils/daily-inspiration-seasonal';

export type DailyInspirationVerse = {
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
  dayIndex: number;
  seasonalTheme?: SeasonalVerseTheme;
};

const DAILY_VERSE_COUNT = CURATED_DAILY_INSPIRATION_VERSE_REFERENCES.length;
const ROTATION_EPOCH = new Date(2024, 0, 1);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const FALLBACK_REFERENCE = {
  book: 'Psalms',
  chapter: 46,
  verse: 10,
};

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getRotationDayIndex(date = new Date()) {
  const localDate = startOfLocalDay(date);
  const daysSinceEpoch = Math.floor(
    (localDate.getTime() - startOfLocalDay(ROTATION_EPOCH).getTime()) / MILLISECONDS_PER_DAY
  );

  return ((daysSinceEpoch % DAILY_VERSE_COUNT) + DAILY_VERSE_COUNT) % DAILY_VERSE_COUNT;
}

export function getNextLocalMidnightDelay(date = new Date()) {
  const nextMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  return Math.max(0, nextMidnight.getTime() - date.getTime());
}

export function formatVerseReference(book: string, chapter: number, verse: number) {
  const displayBook = book === 'Psalms' ? 'Psalm' : book;

  return `${displayBook} ${chapter}:${verse}`;
}

function resolveVerseReference(date: Date) {
  const seasonalSelection = getSeasonalVerseSelection(date);

  if (seasonalSelection) {
    return {
      reference: seasonalSelection.reference,
      dayIndex: getRotationDayIndex(date),
      seasonalTheme: seasonalSelection.theme,
    };
  }

  const dayIndex = getRotationDayIndex(date);

  return {
    reference: CURATED_DAILY_INSPIRATION_VERSE_REFERENCES[dayIndex] ?? FALLBACK_REFERENCE,
    dayIndex,
  };
}

export function getDailyInspirationVerse(
  date = new Date(),
  language: BibleLanguageKey = 'en',
  versionKey?: BibleVersionKey
): DailyInspirationVerse {
  const { reference, dayIndex, seasonalTheme } = resolveVerseReference(date);
  const resolvedVersionKey = versionKey ?? getDefaultBibleVersionKey(language);
  const localizedText =
    getVerseText(reference.book, reference.chapter, reference.verse, language, resolvedVersionKey) ||
    getVerseText(reference.book, reference.chapter, reference.verse, 'en', 'bsb');

  return {
    book: reference.book,
    chapter: reference.chapter,
    verse: reference.verse,
    reference: formatVerseReference(reference.book, reference.chapter, reference.verse),
    text: localizedText,
    dayIndex,
    seasonalTheme,
  };
}

export function getDailyInspirationVerseCount() {
  return DAILY_VERSE_COUNT;
}
