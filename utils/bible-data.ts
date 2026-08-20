import bibleBbe from '@/assets/bibles/bible-en-bbe.json';
import bibleBsb from '@/assets/bibles/bible-en-bsb.json';
import bibleWeb from '@/assets/bibles/bible-en-web.json';
import bibleBes from '@/assets/bibles/bible-es-bes.json';
import bibleBlm from '@/assets/bibles/bible-es-blm.json';
import bibleRv1909 from '@/assets/bibles/bible-es-rv1909.json';

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
  displayName?: string;
  chapters: BibleChapter[];
};

export type BibleLanguageKey = 'en' | 'es';
export type EnglishBibleVersionKey = 'bsb' | 'bbe' | 'web';
export type SpanishBibleVersionKey = 'bes' | 'blm' | 'rv1909';
export type BibleVersionKey = EnglishBibleVersionKey | SpanishBibleVersionKey;

export type BibleVersionOption = {
  key: BibleVersionKey;
  language: BibleLanguageKey;
  label: string;
  shortName: string;
  description: string;
  attribution: string;
  licenseLabel: string;
};

const bibleDataByVersion: Record<BibleVersionKey, BibleBook[]> = {
  bsb: bibleBsb as BibleBook[],
  bbe: bibleBbe as BibleBook[],
  web: bibleWeb as BibleBook[],
  bes: bibleBes as BibleBook[],
  blm: bibleBlm as BibleBook[],
  rv1909: bibleRv1909 as BibleBook[],
};

export const DEFAULT_BIBLE_VERSION_BY_LANGUAGE: Record<BibleLanguageKey, BibleVersionKey> = {
  en: 'bsb',
  es: 'bes',
};

export const BIBLE_VERSION_OPTIONS: BibleVersionOption[] = [
  {
    key: 'bsb',
    language: 'en',
    label: 'Modern: Berean Standard Bible',
    shortName: 'BSB',
    description: 'Readable modern English for daily reading.',
    attribution:
      'Berean Standard Bible. Public domain text from Berean Bible and Bible Hub.',
    licenseLabel: 'Public domain',
  },
  {
    key: 'bbe',
    language: 'en',
    label: 'Simple: Bible in Basic English',
    shortName: 'BBE',
    description: 'Simpler vocabulary with a more classic sentence style.',
    attribution: 'Bible in Basic English. Public domain in the United States.',
    licenseLabel: 'Public domain',
  },
  {
    key: 'web',
    language: 'en',
    label: 'Classic Free: World English Bible',
    shortName: 'WEB',
    description: 'Modern public-domain English using LORD wording.',
    attribution: 'World English Bible. Public domain text from eBible.org.',
    licenseLabel: 'Public domain',
  },
  {
    key: 'bes',
    language: 'es',
    label: 'Sencilla: Biblia en Español Sencillo',
    shortName: 'BES',
    description: 'Español más sencillo para lectores jóvenes.',
    attribution:
      'La Biblia en Español Sencillo, copyright 2018, 2019 AudioBiblia.org / Irma Flores. Used under CC BY 4.0.',
    licenseLabel: 'CC BY 4.0',
  },
  {
    key: 'blm',
    language: 'es',
    label: 'Moderna libre: Santa Biblia libre para el mundo',
    shortName: 'SBLM',
    description: 'Español moderno, dominio público, con estilo de España.',
    attribution:
      'Santa Biblia libre para el mundo. Public domain draft translation by David Williams and Michael Paul Johnson.',
    licenseLabel: 'Public domain',
  },
  {
    key: 'rv1909',
    language: 'es',
    label: 'Clásica: Reina Valera 1909',
    shortName: 'RV1909',
    description: 'Español clásico y tradicional.',
    attribution: 'Santa Biblia Reina Valera 1909. Dominio público.',
    licenseLabel: 'Dominio público',
  },
];

export function getBibleVersionOptions(language: BibleLanguageKey) {
  return BIBLE_VERSION_OPTIONS.filter((version) => version.language === language);
}

export function getBibleVersionByKey(versionKey: BibleVersionKey) {
  return BIBLE_VERSION_OPTIONS.find((version) => version.key === versionKey);
}

export function getDefaultBibleVersionKey(language: BibleLanguageKey) {
  return DEFAULT_BIBLE_VERSION_BY_LANGUAGE[language];
}

export function normalizeBibleVersionKey(
  language: BibleLanguageKey,
  versionKey?: string
): BibleVersionKey {
  const options = getBibleVersionOptions(language);
  const matchedOption = options.find((option) => option.key === versionKey);

  return matchedOption?.key ?? getDefaultBibleVersionKey(language);
}

export function getBibleData(versionKey: BibleVersionKey = DEFAULT_BIBLE_VERSION_BY_LANGUAGE.en) {
  return bibleDataByVersion[versionKey] ?? bibleDataByVersion[DEFAULT_BIBLE_VERSION_BY_LANGUAGE.en];
}

function findBook(book: string, versionKey?: BibleVersionKey) {
  return getBibleData(versionKey).find((entry) => entry.book === book);
}

function findChapter(book: string, chapter: number, versionKey?: BibleVersionKey) {
  return findBook(book, versionKey)?.chapters.find((entry) => entry.chapter === chapter);
}

export function getBooks(versionKey?: BibleVersionKey) {
  return getBibleData(versionKey).map((entry) => entry.book);
}

export function getBookDisplayName(
  book: string,
  language: BibleLanguageKey = 'en',
  versionKey?: BibleVersionKey
) {
  const resolvedVersionKey = versionKey ?? getDefaultBibleVersionKey(language);
  const bookEntry = findBook(book, resolvedVersionKey);

  return language === 'es' ? bookEntry?.displayName ?? book : book;
}

/** Clearer label in the book list so Gospel John is not confused with 1–3 John. */
export function getBookListLabel(
  book: string,
  language: BibleLanguageKey = 'en',
  versionKey?: BibleVersionKey
) {
  const baseName = getBookDisplayName(book, language, versionKey);

  if (book === 'John') {
    return language === 'es' ? 'Juan (Evangelio)' : 'John (Gospel)';
  }

  return baseName;
}

export function getChapters(book: string, versionKey?: BibleVersionKey) {
  return findBook(book, versionKey)?.chapters.map((entry) => entry.chapter) ?? [];
}

export function getVerses(book: string, chapter: number, versionKey?: BibleVersionKey) {
  return findChapter(book, chapter, versionKey)?.verses.map((entry) => entry.verse) ?? [];
}

export function getVerseText(
  book: string,
  chapter: number,
  verse: number,
  language: BibleLanguageKey = 'en',
  versionKey?: BibleVersionKey
) {
  const resolvedVersionKey = versionKey ?? getDefaultBibleVersionKey(language);

  return (
    findChapter(book, chapter, resolvedVersionKey)?.verses.find(
      (entry) => entry.verse === verse
    )?.text ?? ''
  );
}

export default bibleDataByVersion[DEFAULT_BIBLE_VERSION_BY_LANGUAGE.en];
