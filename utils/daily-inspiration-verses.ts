import bibleData, { getVerseText, type BibleLanguageKey } from '@/utils/bible-data';

export type DailyInspirationVerse = {
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
  dayIndex: number;
};

type DailyVerseReference = {
  book: string;
  chapter: number;
  verse: number;
  score: number;
};

const DAILY_VERSE_COUNT = 365;

const SOURCE_BOOKS = new Set([
  'Psalms',
  'Proverbs',
  'Isaiah',
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Romans',
  '1 Corinthians',
  '2 Corinthians',
  'Galatians',
  'Ephesians',
  'Philippians',
  'Colossians',
  '1 Thessalonians',
  '2 Thessalonians',
  '1 Timothy',
  '2 Timothy',
  'Titus',
  'Hebrews',
  'James',
  '1 Peter',
  '2 Peter',
  '1 John',
  '2 John',
  '3 John',
  'Jude',
  'Revelation',
]);

const INSPIRATION_TERMS = [
  'love',
  'peace',
  'hope',
  'joy',
  'faith',
  'mercy',
  'grace',
  'comfort',
  'strength',
  'courage',
  'wisdom',
  'kind',
  'good',
  'bless',
  'light',
  'life',
  'truth',
  'pray',
  'trust',
  'rest',
  'healed',
  'forgive',
  'righteous',
  'salvation',
  'deliver',
  'refuge',
  'heart',
  'spirit',
  'seek',
  'thanks',
  'endures',
  'forever',
];

const EXCLUSION_TERMS = [
  'abomination',
  'adultery',
  'beast',
  'blood',
  'burn',
  'curse',
  'death',
  'destroy',
  'devour',
  'drunk',
  'evil',
  'fire',
  'flesh',
  'hell',
  'kill',
  'plague',
  'punish',
  'slaughter',
  'sword',
  'terror',
  'vengeance',
  'war',
  'wicked',
  'wrath',
];

function scoreVerse(text: string) {
  const normalizedText = text.toLowerCase();
  const inspirationScore = INSPIRATION_TERMS.reduce(
    (score, term) => score + (normalizedText.includes(term) ? 2 : 0),
    0
  );
  const exclusionPenalty = EXCLUSION_TERMS.reduce(
    (score, term) => score + (normalizedText.includes(term) ? 4 : 0),
    0
  );
  const lengthScore = text.length >= 55 && text.length <= 150 ? 3 : 0;

  return inspirationScore + lengthScore - exclusionPenalty;
}

function getReferenceSortKey(reference: DailyVerseReference) {
  return `${reference.book.padStart(16, '0')}-${String(reference.chapter).padStart(3, '0')}-${String(
    reference.verse
  ).padStart(3, '0')}`;
}

function buildDailyVerseReferences() {
  const candidates = bibleData.flatMap((bookEntry) => {
    if (!SOURCE_BOOKS.has(bookEntry.book)) {
      return [];
    }

    return bookEntry.chapters.flatMap((chapterEntry) =>
      chapterEntry.verses
        .map((verseEntry) => ({
          book: bookEntry.book,
          chapter: chapterEntry.chapter,
          verse: verseEntry.verse,
          score: scoreVerse(verseEntry.text),
        }))
        .filter((reference) => reference.score > 0)
    );
  });

  return candidates
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return getReferenceSortKey(left).localeCompare(getReferenceSortKey(right));
    })
    .slice(0, DAILY_VERSE_COUNT);
}

const DAILY_VERSE_REFERENCES = buildDailyVerseReferences();

function getLocalDayOfYear(date: Date) {
  const localYearStart = new Date(date.getFullYear(), 0, 1);
  const localToday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((localToday.getTime() - localYearStart.getTime()) / millisecondsPerDay);
}

export function getNextLocalMidnightDelay(date = new Date()) {
  const nextMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  return Math.max(0, nextMidnight.getTime() - date.getTime());
}

export function formatVerseReference(book: string, chapter: number, verse: number) {
  const displayBook = book === 'Psalms' ? 'Psalm' : book;

  return `${displayBook} ${chapter}:${verse}`;
}

export function getDailyInspirationVerse(
  date = new Date(),
  language: BibleLanguageKey = 'en'
): DailyInspirationVerse {
  const dayIndex = getLocalDayOfYear(date) % DAILY_VERSE_COUNT;
  const reference = DAILY_VERSE_REFERENCES[dayIndex] ?? {
    book: 'Psalms',
    chapter: 46,
    verse: 10,
    score: 0,
  };
  const localizedText =
    getVerseText(reference.book, reference.chapter, reference.verse, language) ||
    getVerseText(reference.book, reference.chapter, reference.verse, 'en');

  return {
    book: reference.book,
    chapter: reference.chapter,
    verse: reference.verse,
    reference: formatVerseReference(reference.book, reference.chapter, reference.verse),
    text: localizedText,
    dayIndex,
  };
}

export function getDailyInspirationVerseCount() {
  return DAILY_VERSE_REFERENCES.length;
}
