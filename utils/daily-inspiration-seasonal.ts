import type { DailyInspirationVerseReference } from '@/utils/daily-inspiration-verse-references';

export type SeasonalVerseTheme =
  | 'new-year'
  | 'thanksgiving'
  | 'advent'
  | 'christmas'
  | 'palm-sunday'
  | 'holy-week'
  | 'good-friday'
  | 'easter';

export type SeasonalVerseSelection = {
  reference: DailyInspirationVerseReference;
  theme: SeasonalVerseTheme;
};

const NEW_YEAR_VERSES: DailyInspirationVerseReference[] = [
  { book: 'Lamentations', chapter: 3, verse: 22 },
  { book: 'Lamentations', chapter: 3, verse: 23 },
  { book: '2 Corinthians', chapter: 5, verse: 17 },
  { book: 'Isaiah', chapter: 43, verse: 19 },
  { book: 'Jeremiah', chapter: 29, verse: 11 },
];

const THANKSGIVING_VERSES: DailyInspirationVerseReference[] = [
  { book: 'Psalms', chapter: 100, verse: 4 },
  { book: 'Psalms', chapter: 107, verse: 1 },
  { book: '1 Thessalonians', chapter: 5, verse: 18 },
  { book: 'Psalms', chapter: 136, verse: 1 },
  { book: 'Philippians', chapter: 1, verse: 3 },
];

const ADVENT_VERSES: DailyInspirationVerseReference[] = [
  { book: 'Isaiah', chapter: 9, verse: 6 },
  { book: 'Isaiah', chapter: 7, verse: 14 },
  { book: 'Micah', chapter: 5, verse: 2 },
  { book: 'Luke', chapter: 1, verse: 37 },
  { book: 'Isaiah', chapter: 40, verse: 3 },
  { book: 'Jeremiah', chapter: 33, verse: 15 },
  { book: 'Isaiah', chapter: 11, verse: 1 },
  { book: 'Malachi', chapter: 4, verse: 2 },
  { book: 'Luke', chapter: 1, verse: 46 },
  { book: 'Luke', chapter: 1, verse: 47 },
  { book: 'Matthew', chapter: 1, verse: 23 },
  { book: 'John', chapter: 1, verse: 9 },
  { book: 'Isaiah', chapter: 52, verse: 7 },
  { book: 'Romans', chapter: 15, verse: 13 },
  { book: 'Psalms', chapter: 130, verse: 5 },
  { book: 'Isaiah', chapter: 61, verse: 1 },
  { book: 'Luke', chapter: 2, verse: 10 },
  { book: 'Luke', chapter: 2, verse: 11 },
  { book: 'John', chapter: 1, verse: 14 },
  { book: 'Matthew', chapter: 2, verse: 10 },
  { book: 'Isaiah', chapter: 12, verse: 2 },
  { book: 'Galatians', chapter: 4, verse: 4 },
  { book: 'Titus', chapter: 2, verse: 11 },
];

const CHRISTMAS_VERSES: DailyInspirationVerseReference[] = [
  { book: 'Luke', chapter: 2, verse: 11 },
  { book: 'Luke', chapter: 2, verse: 14 },
  { book: 'John', chapter: 1, verse: 14 },
  { book: 'Isaiah', chapter: 9, verse: 6 },
  { book: 'Matthew', chapter: 1, verse: 23 },
  { book: 'Luke', chapter: 2, verse: 10 },
  { book: 'Micah', chapter: 5, verse: 2 },
];

const PALM_SUNDAY_VERSES: DailyInspirationVerseReference[] = [
  { book: 'Matthew', chapter: 21, verse: 9 },
  { book: 'John', chapter: 12, verse: 13 },
  { book: 'Zechariah', chapter: 9, verse: 9 },
  { book: 'Luke', chapter: 19, verse: 38 },
];

const HOLY_WEEK_VERSES: DailyInspirationVerseReference[] = [
  { book: 'John', chapter: 13, verse: 34 },
  { book: 'Matthew', chapter: 26, verse: 39 },
  { book: 'Isaiah', chapter: 53, verse: 5 },
  { book: 'Philippians', chapter: 2, verse: 8 },
];

const GOOD_FRIDAY_VERSES: DailyInspirationVerseReference[] = [
  { book: 'Isaiah', chapter: 53, verse: 5 },
  { book: 'Romans', chapter: 5, verse: 8 },
  { book: 'John', chapter: 3, verse: 16 },
  { book: '1 Peter', chapter: 2, verse: 24 },
  { book: 'Colossians', chapter: 1, verse: 14 },
];

const EASTER_VERSES: DailyInspirationVerseReference[] = [
  { book: 'Matthew', chapter: 28, verse: 6 },
  { book: 'Mark', chapter: 16, verse: 6 },
  { book: 'Luke', chapter: 24, verse: 6 },
  { book: 'John', chapter: 11, verse: 25 },
  { book: '1 Corinthians', chapter: 15, verse: 20 },
  { book: 'Romans', chapter: 6, verse: 4 },
  { book: 'Acts', chapter: 2, verse: 24 },
  { book: 'Colossians', chapter: 1, verse: 13 },
  { book: '1 Peter', chapter: 1, verse: 3 },
  { book: 'Revelation', chapter: 1, verse: 18 },
];

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function dayOffset(from: Date, to: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / millisecondsPerDay);
}

function pickFromPool<T>(pool: T[], date: Date) {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

  return pool[seed % pool.length];
}

/** Anonymous Gregorian algorithm for Western Easter Sunday. */
export function getGregorianEasterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: number) {
  const firstOfMonth = new Date(year, month, 1);
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;

  return new Date(year, month, 1 + offset + (occurrence - 1) * 7);
}

export function getSeasonalVerseSelection(date = new Date()): SeasonalVerseSelection | null {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (month === 0 && day === 1) {
    return { reference: pickFromPool(NEW_YEAR_VERSES, date), theme: 'new-year' };
  }

  const thanksgiving = getNthWeekdayOfMonth(year, 10, 4, 4);
  if (sameLocalDay(date, thanksgiving)) {
    return { reference: pickFromPool(THANKSGIVING_VERSES, date), theme: 'thanksgiving' };
  }

  if (month === 11 && day >= 1 && day <= 23) {
    return { reference: ADVENT_VERSES[(day - 1) % ADVENT_VERSES.length], theme: 'advent' };
  }

  if (month === 11 && day >= 24 && day <= 26) {
    return { reference: CHRISTMAS_VERSES[(day - 24) % CHRISTMAS_VERSES.length], theme: 'christmas' };
  }

  const easterSunday = getGregorianEasterSunday(year);
  const offsetFromEaster = dayOffset(easterSunday, date);

  if (offsetFromEaster === -7) {
    return { reference: pickFromPool(PALM_SUNDAY_VERSES, date), theme: 'palm-sunday' };
  }

  if (offsetFromEaster === -2) {
    return { reference: pickFromPool(GOOD_FRIDAY_VERSES, date), theme: 'good-friday' };
  }

  if (offsetFromEaster >= -6 && offsetFromEaster <= -3) {
    return {
      reference: HOLY_WEEK_VERSES[(offsetFromEaster + 6) % HOLY_WEEK_VERSES.length],
      theme: 'holy-week',
    };
  }

  if (offsetFromEaster === 0) {
    return { reference: EASTER_VERSES[0], theme: 'easter' };
  }

  if (offsetFromEaster === 1) {
    return { reference: EASTER_VERSES[1], theme: 'easter' };
  }

  if (offsetFromEaster >= 2 && offsetFromEaster <= 7) {
    return {
      reference: EASTER_VERSES[(offsetFromEaster - 1) % EASTER_VERSES.length],
      theme: 'easter',
    };
  }

  return null;
}
