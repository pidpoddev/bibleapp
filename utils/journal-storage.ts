import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BIBLE_READING_PROGRESS_STORAGE_KEY,
  JOURNAL_INDEX_KEY,
  LEGACY_SAVED_DESIGNS_STORAGE_KEY,
  SAVED_DESIGNS_BACKUP_STORAGE_KEY,
  SAVED_DESIGNS_STORAGE_KEY,
  SHOP_OWNED_PACKS_STORAGE_KEY,
  VERSE_DESIGN_INDEX_STORAGE_KEY,
  VERSE_DESIGN_TIMESTAMPS_STORAGE_KEY,
} from '@/utils/storage-keys';

export type JournalEntryType =
  | 'prayer'
  | 'bible-study'
  | 'church-day'
  | 'daily-devotional'
  | 'journal-studio';

export type JournalEntryEditor = 'classic' | 'studio';

export type JournalIndexEntry = {
  id: string;
  type: JournalEntryType;
  date?: string;
  preview?: string;
  updatedAt: number;
  isFavorite?: boolean;
  editor?: JournalEntryEditor;
  book?: string;
  chapter?: number | string;
  verse?: number | string;
};

export type HydratedJournalEntry = JournalIndexEntry & {
  storageKey: string;
  payload: Record<string, unknown> | null;
  searchableText: string;
};

const JOURNAL_ENTRY_PREFIX_BY_TYPE: Record<JournalEntryType, string> = {
  prayer: 'journal_prayer_',
  'bible-study': 'journal_bible_study_',
  'church-day': 'journal_church_day_',
  'daily-devotional': 'journal_daily_devotional_',
  'journal-studio': 'journal_studio_',
};

const EXACT_JOURNAL_DATA_KEYS = [
  JOURNAL_INDEX_KEY,
  BIBLE_READING_PROGRESS_STORAGE_KEY,
  SAVED_DESIGNS_STORAGE_KEY,
  SAVED_DESIGNS_BACKUP_STORAGE_KEY,
  LEGACY_SAVED_DESIGNS_STORAGE_KEY,
  VERSE_DESIGN_INDEX_STORAGE_KEY,
  VERSE_DESIGN_TIMESTAMPS_STORAGE_KEY,
  SHOP_OWNED_PACKS_STORAGE_KEY,
];

export function getJournalEntryStorageKey(entry: Pick<JournalIndexEntry, 'id' | 'type'>) {
  return `${JOURNAL_ENTRY_PREFIX_BY_TYPE[entry.type]}${entry.id}`;
}

export function safeParseJournalIndex(value: string | null): JournalIndexEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is JournalIndexEntry => {
      if (typeof entry !== 'object' || entry === null) {
        return false;
      }

      const candidate = entry as Partial<JournalIndexEntry>;
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.type === 'string' &&
        candidate.type in JOURNAL_ENTRY_PREFIX_BY_TYPE &&
        typeof candidate.updatedAt === 'number'
      );
    });
  } catch {
    return [];
  }
}

function parseStoredJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function parseStoredObject(value: string | null) {
  const parsed = parseStoredJson(value);

  return typeof parsed === 'object' && parsed !== null
    ? (parsed as Record<string, unknown>)
    : null;
}

function collectText(value: unknown, output: string[]) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      output.push(trimmed);
    }
    return;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    output.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, output));
    return;
  }

  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((item) => collectText(item, output));
  }
}

export function buildSearchableJournalText(
  entry: JournalIndexEntry,
  payload: Record<string, unknown> | null
) {
  const pieces: string[] = [
    entry.type,
    entry.date ?? '',
    entry.preview ?? '',
    entry.book ? `${entry.book} ${entry.chapter ?? ''}:${entry.verse ?? ''}` : '',
  ];

  collectText(payload, pieces);

  return pieces.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

export async function getHydratedJournalEntries() {
  const indexData = await AsyncStorage.getItem(JOURNAL_INDEX_KEY);
  const entries = safeParseJournalIndex(indexData);

  return Promise.all(
    entries.map(async (entry): Promise<HydratedJournalEntry> => {
      const storageKey = getJournalEntryStorageKey(entry);
      const payload = parseStoredObject(await AsyncStorage.getItem(storageKey));

      return {
        ...entry,
        storageKey,
        payload,
        searchableText: buildSearchableJournalText(entry, payload),
      };
    })
  );
}

const JOURNAL_DATA_STORAGE_PREFIXES = [
  ...Object.values(JOURNAL_ENTRY_PREFIX_BY_TYPE),
  'verse_',
];

function isJournalDataStorageKey(key: string) {
  return (
    EXACT_JOURNAL_DATA_KEYS.includes(key) ||
    JOURNAL_DATA_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

export async function getJournalDataStorageKeys() {
  const keys = await AsyncStorage.getAllKeys();

  return Array.from(new Set(keys.filter(isJournalDataStorageKey))).sort();
}

export async function buildJournalExportSnapshot() {
  const [entries, userDataKeys] = await Promise.all([
    getHydratedJournalEntries(),
    getJournalDataStorageKeys(),
  ]);
  const userDataPairs = await AsyncStorage.multiGet(userDataKeys);
  const userData = userDataPairs.reduce<Record<string, unknown>>(
    (accumulator, [key, value]) => {
      accumulator[key] = parseStoredJson(value);
      return accumulator;
    },
    {}
  );

  return {
    exportedAt: new Date().toISOString(),
    entryCount: entries.length,
    favoriteCount: entries.filter((entry) => entry.isFavorite).length,
    userDataKeyCount: userDataKeys.length,
    journalIndex: entries.map(({ payload, searchableText, storageKey, ...entry }) => entry),
    journalEntries: entries.reduce<Record<string, Record<string, unknown> | null>>(
      (accumulator, entry) => {
        accumulator[entry.storageKey] = entry.payload;
        return accumulator;
      },
      {}
    ),
    savedDesigns: EXACT_JOURNAL_DATA_KEYS.filter((key) => key !== JOURNAL_INDEX_KEY).reduce<
      Record<string, unknown>
    >((accumulator, key) => {
      if (Object.prototype.hasOwnProperty.call(userData, key)) {
        accumulator[key] = userData[key];
      }
      return accumulator;
    }, {}),
    userData,
  };
}

export async function resetJournalData() {
  const keysToRemove = await getJournalDataStorageKeys();

  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }
}
