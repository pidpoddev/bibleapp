import bible from '@/assets/bible.json';
import bibleEs from '@/assets/bible-es.json';

export type BibleVerse = {
  verse: number;
  text: string;
};

export type BibleChapter = {
  chapter: number;
  verses: BibleVerse[];
};

export type BibleBook = {
  book: string;
  chapters: BibleChapter[];
};

export type BibleLanguageKey = 'en' | 'es';

type SpanishBibleVerseEntry = {
  book_name: string;
  book: number;
  chapter: number;
  verse: number;
  text: string;
};

type SpanishBibleData = {
  metadata: {
    name: string;
    lang_short: string;
  };
  verses: SpanishBibleVerseEntry[];
};

const bibleData = bible as BibleBook[];
const spanishBibleData = bibleEs as SpanishBibleData;
const englishBookNumberMap = new Map(
  bibleData.map((entry, index) => [entry.book, index + 1] as const)
);
const spanishBookNameMap = new Map(
  bibleData.map((entry, index) => {
    const bookNumber = index + 1;
    const spanishBook = spanishBibleData.verses.find((verse) => verse.book === bookNumber);
    return [entry.book, spanishBook?.book_name ?? entry.book] as const;
  })
);
const spanishVerseTextMap = new Map(
  spanishBibleData.verses.map((entry) => [
    `${entry.book}-${entry.chapter}-${entry.verse}`,
    entry.text,
  ])
);

function findBook(book: string) {
  return bibleData.find((entry) => entry.book === book);
}

function findChapter(book: string, chapter: number) {
  return findBook(book)?.chapters.find((entry) => entry.chapter === chapter);
}

export function getBooks() {
  return bibleData.map((entry) => entry.book);
}

export function getBookDisplayName(book: string, language: BibleLanguageKey = 'en') {
  return language === 'es' ? spanishBookNameMap.get(book) ?? book : book;
}

export function getChapters(book: string) {
  return findBook(book)?.chapters.map((entry) => entry.chapter) ?? [];
}

export function getVerses(book: string, chapter: number) {
  return findChapter(book, chapter)?.verses.map((entry) => entry.verse) ?? [];
}

export function getVerseText(
  book: string,
  chapter: number,
  verse: number,
  language: BibleLanguageKey = 'en'
) {
  if (language === 'es') {
    const bookNumber = englishBookNumberMap.get(book);

    if (bookNumber) {
      return spanishVerseTextMap.get(`${bookNumber}-${chapter}-${verse}`) ?? '';
    }
  }

  return (
    findChapter(book, chapter)?.verses.find((entry) => entry.verse === verse)?.text ?? ''
  );
}

export default bibleData;
