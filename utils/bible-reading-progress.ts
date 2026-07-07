import AsyncStorage from '@react-native-async-storage/async-storage';

import bibleData from '@/utils/bible-data';
import { BIBLE_READING_PROGRESS_STORAGE_KEY } from '@/utils/storage-keys';

export type BibleVerseReference = {
  book: string;
  chapter: number;
  verse: number;
};

export type BibleReadingProgress = {
  readCount: number;
  totalCount: number;
  percent: number;
};

export function makeBibleVerseKey(reference: BibleVerseReference) {
  return `${reference.book}|${reference.chapter}|${reference.verse}`;
}

function safeParseReadKeys(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function getBibleVerseTotalCount() {
  return bibleData.reduce((bookTotal, book) => {
    return (
      bookTotal +
      book.chapters.reduce((chapterTotal, chapter) => chapterTotal + chapter.verses.length, 0)
    );
  }, 0);
}

export async function markBibleVerseRead(reference: BibleVerseReference) {
  const readKeys = new Set(
    safeParseReadKeys(await AsyncStorage.getItem(BIBLE_READING_PROGRESS_STORAGE_KEY))
  );
  const nextKey = makeBibleVerseKey(reference);

  if (readKeys.has(nextKey)) {
    return;
  }

  readKeys.add(nextKey);
  await AsyncStorage.setItem(
    BIBLE_READING_PROGRESS_STORAGE_KEY,
    JSON.stringify(Array.from(readKeys).sort())
  );
}

export async function getBibleReadVerseKeys() {
  return new Set(
    safeParseReadKeys(await AsyncStorage.getItem(BIBLE_READING_PROGRESS_STORAGE_KEY))
  );
}

export async function getBibleReadingProgress(): Promise<BibleReadingProgress> {
  const totalCount = getBibleVerseTotalCount();
  const readKeys = await getBibleReadVerseKeys();
  const readCount = Math.min(readKeys.size, totalCount);

  return {
    readCount,
    totalCount,
    percent: totalCount > 0 ? (readCount / totalCount) * 100 : 0,
  };
}
