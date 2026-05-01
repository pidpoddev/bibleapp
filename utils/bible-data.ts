import bible from '@/assets/bible.json';

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

const bibleData = bible as BibleBook[];

function findBook(book: string) {
  return bibleData.find((entry) => entry.book === book);
}

function findChapter(book: string, chapter: number) {
  return findBook(book)?.chapters.find((entry) => entry.chapter === chapter);
}

export function getBooks() {
  return bibleData.map((entry) => entry.book);
}

export function getChapters(book: string) {
  return findBook(book)?.chapters.map((entry) => entry.chapter) ?? [];
}

export function getVerses(book: string, chapter: number) {
  return findChapter(book, chapter)?.verses.map((entry) => entry.verse) ?? [];
}

export function getVerseText(book: string, chapter: number, verse: number) {
  return (
    findChapter(book, chapter)?.verses.find((entry) => entry.verse === verse)?.text ?? ''
  );
}

export default bibleData;
