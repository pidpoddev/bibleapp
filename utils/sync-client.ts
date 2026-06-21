import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

const SYNC_SESSION_STORAGE_KEY = 'private_sync_session_v1';
const SYNC_VERSION_STORAGE_KEY = 'private_sync_versions_v1';
const SYNC_LAST_PULL_STORAGE_KEY = 'private_sync_last_pull_v1';
const SYNC_API_URL = 'https://pidpod.com';
const MAX_SYNC_ITEM_CHARS = 512 * 1024;
const KDF_ITERATIONS = 210_000;
const KDF_SALT = 'BibleApp Private Sync Phrase v1';

export type SyncItemType =
  | 'account_session'
  | 'app_settings'
  | 'daily_mood'
  | 'journal_index'
  | 'journal_entry'
  | 'studio_journal_entry'
  | 'verse_state_map'
  | 'verse_design_index'
  | 'verse_design_timestamps'
  | 'saved_designs'
  | 'saved_designs_backup'
  | 'legacy_saved_designs'
  | 'shop_entitlements';

type SyncSession = {
  userId: string;
  deviceId: string;
  deviceSecret: string;
  recoveryId: string;
  phraseFingerprint: string;
  createdAt: number;
  lastSyncedAt?: string;
};

type SyncStoredVersion = {
  versionId: string;
  itemType: SyncItemType;
  localStorageKey: string;
  deleted?: boolean;
};

type SyncStoredVersions = Record<string, SyncStoredVersion | string>;

type LocalSyncRecord = {
  clientItemId: string;
  itemType: SyncItemType;
  localStorageKey: string;
  value: unknown;
  updatedAt: number;
  deleted?: boolean;
};

type EncryptedPushItem = {
  clientItemId: string;
  itemType: SyncItemType;
  localStorageKey: string;
  schemaVersion: number;
  baseVersionId: string | null;
  clientUpdatedAt: number;
  encryptionVersion: number;
  nonce: string;
  ciphertext: string;
  payloadSha256: string;
  deleted?: boolean;
};

type PullResponseItem = {
  clientItemId: string;
  itemType: SyncItemType;
  localStorageKey: string | null;
  currentVersionId: string;
  deletedAt?: string | null;
  version: {
    id: string;
    deviceId?: string;
    deviceName?: string | null;
    clientUpdatedAt?: number;
    serverCreatedAt?: string;
    nonce: string;
    ciphertext: string;
    payloadSha256: string;
  };
};

type PullResponse = {
  pulledAt: string;
  items: PullResponseItem[];
};

type ConflictResponseRow = {
  item_id: string;
  client_item_id: string;
  item_type: SyncItemType;
  local_storage_key: string | null;
  version_id: string;
  device_id: string;
  device_name: string | null;
  client_updated_at: number;
  server_created_at: string;
  nonce: string;
  ciphertext: string;
  payload_sha256: string;
};

export type SyncConflictVersion = {
  id: string;
  deviceId: string;
  deviceName: string;
  clientUpdatedAt: number;
  serverCreatedAt: string;
  localStorageKey: string;
  itemType: SyncItemType;
  value: unknown;
  preview: string;
};

export type SyncConflict = {
  itemId: string;
  clientItemId: string;
  itemType: SyncItemType;
  localStorageKey: string;
  versions: SyncConflictVersion[];
};

export type SyncLogEvent = {
  id: string;
  type: 'push' | 'pull' | 'restore';
  itemCount: number;
  createdAt: string;
};

export type SyncLog = {
  events: SyncLogEvent[];
  cursor: {
    last_pushed_at?: string | null;
    last_pulled_at?: string | null;
    updated_at?: string | null;
  } | null;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const SYNCABLE_EXACT_KEYS: Record<string, SyncItemType> = {
  account_session_v1: 'account_session',
  app_settings_v1: 'app_settings',
  journal_index: 'journal_index',
  studio_favorites_v2: 'saved_designs',
  studio_favorites_backup_v1: 'saved_designs_backup',
  favorites: 'legacy_saved_designs',
  verse_design_index_v1: 'verse_design_index',
  verse_design_timestamps_v1: 'verse_design_timestamps',
};

const BLOCKED_MEDIA_PATTERNS = [
  'data:image/',
  'data:video/',
  'base64,',
  'file://',
  'ph://',
  'assets-library://',
  'content://',
  'blob:',
];

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triplet = (first << 16) | (second << 8) | third;

    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? alphabet[triplet & 63] : '=';
  }

  return output;
}

function base64ToBytes(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleanValue = value.replace(/=+$/, '');
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of cleanValue) {
    const nextValue = alphabet.indexOf(char);
    if (nextValue === -1) {
      continue;
    }

    buffer = (buffer << 6) | nextValue;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 255);
    }
  }

  return Uint8Array.from(output);
}

function normalizePhrase(phrase: string) {
  return phrase.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function derivePhraseMaterial(phrase: string) {
  const normalizedPhrase = normalizePhrase(phrase);
  const derived = await pbkdf2Async(sha256, normalizedPhrase, KDF_SALT, {
    c: KDF_ITERATIONS,
    dkLen: 96,
    asyncTick: 20,
  });
  const recoveryKey = derived.slice(0, 32);
  const authKey = derived.slice(32, 64);
  const encryptionKey = derived.slice(64, 96);

  return {
    recoveryId: bytesToHex(sha256(new Uint8Array([...recoveryKey, ...encoder.encode('recovery')]))),
    authSecret: bytesToHex(sha256(new Uint8Array([...authKey, ...encoder.encode('auth')]))),
    encryptionKey,
    phraseFingerprint: bytesToHex(sha256(encryptionKey)).slice(0, 16),
  };
}

function getDeviceName() {
  const platform = typeof navigator !== 'undefined' ? navigator.userAgent : 'Bible App device';
  return platform.slice(0, 120);
}

function generateDeviceSecret() {
  return bytesToHex(randomBytes(32));
}

export async function getSyncSession() {
  const value = await AsyncStorage.getItem(SYNC_SESSION_STORAGE_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as SyncSession;
  } catch {
    return null;
  }
}

async function getStoredVersions() {
  const value = await AsyncStorage.getItem(SYNC_VERSION_STORAGE_KEY);
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as SyncStoredVersions;
  } catch {
    return {};
  }
}

async function saveStoredVersions(versions: SyncStoredVersions) {
  await AsyncStorage.setItem(SYNC_VERSION_STORAGE_KEY, JSON.stringify(versions));
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  session?: SyncSession
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  if (session) {
    headers['x-sync-user-id'] = session.userId;
    headers['x-sync-device-id'] = session.deviceId;
    headers['x-sync-device-secret'] = session.deviceSecret;
  }

  const response = await fetch(`${SYNC_API_URL}${path}`, {
    ...init,
    headers,
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'Sync request failed.');
  }

  return payload as T;
}

export async function connectPrivateSyncPhrase(phrase: string) {
  const material = await derivePhraseMaterial(phrase);
  const deviceSecret = generateDeviceSecret();
  const response = await requestJson<{
    userId: string;
    deviceId: string;
    status?: string;
    message?: string;
  }>(
    '/v1/sync/bootstrap',
    {
      method: 'POST',
      body: JSON.stringify({
        recoveryId: material.recoveryId,
        authSecret: material.authSecret,
        deviceSecret,
        deviceName: getDeviceName(),
      }),
    }
  );
  const session: SyncSession = {
    userId: response.userId,
    deviceId: response.deviceId,
    deviceSecret,
    recoveryId: material.recoveryId,
    phraseFingerprint: material.phraseFingerprint,
    createdAt: Date.now(),
  };

  await AsyncStorage.setItem(SYNC_SESSION_STORAGE_KEY, JSON.stringify(session));
  return {
    ...session,
    status: response.status || 'connected',
    message: response.message || 'Connected',
  };
}

function getItemTypeForStorageKey(key: string): SyncItemType | null {
  if (SYNCABLE_EXACT_KEYS[key]) {
    return SYNCABLE_EXACT_KEYS[key];
  }

  if (key.startsWith('daily_mood_')) {
    return 'daily_mood';
  }

  if (
    key.startsWith('journal_prayer_') ||
    key.startsWith('journal_bible_study_') ||
    key.startsWith('journal_church_day_') ||
    key.startsWith('journal_daily_devotional_')
  ) {
    return 'journal_entry';
  }

  if (key.startsWith('journal_studio_')) {
    return 'studio_journal_entry';
  }

  if (key.startsWith('verse_')) {
    return 'verse_state_map';
  }

  return null;
}

function getStoredVersionMeta(
  versions: SyncStoredVersions,
  clientItemId: string
): SyncStoredVersion | null {
  const storedVersion = versions[clientItemId];

  if (!storedVersion) {
    return null;
  }

  if (typeof storedVersion === 'string') {
    const itemType = getItemTypeForStorageKey(clientItemId);

    if (!itemType) {
      return null;
    }

    return {
      versionId: storedVersion,
      itemType,
      localStorageKey: clientItemId,
    };
  }

  return storedVersion;
}

function setStoredVersionMeta(
  versions: SyncStoredVersions,
  clientItemId: string,
  version: SyncStoredVersion
) {
  versions[clientItemId] = version;
}

function parseStoredValue(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function hasBlockedMediaPayload(json: string) {
  const lowerJson = json.toLowerCase();
  return BLOCKED_MEDIA_PATTERNS.some((pattern) => lowerJson.includes(pattern));
}

async function collectLocalSyncRecords(versions: SyncStoredVersions) {
  const keys = await AsyncStorage.getAllKeys();
  const syncableKeys = keys.filter((key) => getItemTypeForStorageKey(key) !== null);
  const syncableKeySet = new Set(syncableKeys);
  const pairs = await AsyncStorage.multiGet(syncableKeys);
  const now = Date.now();

  const records = pairs.reduce<LocalSyncRecord[]>((nextRecords, [localStorageKey, rawValue]) => {
    const itemType = getItemTypeForStorageKey(localStorageKey);
    if (!itemType || rawValue === null) {
      return nextRecords;
    }

    if (rawValue.length > MAX_SYNC_ITEM_CHARS || hasBlockedMediaPayload(rawValue)) {
      return nextRecords;
    }

    nextRecords.push({
      clientItemId: localStorageKey,
      itemType,
      localStorageKey,
      value: parseStoredValue(rawValue),
      updatedAt: now,
    });
    return nextRecords;
  }, []);

  Object.keys(versions).forEach((clientItemId) => {
    if (syncableKeySet.has(clientItemId)) {
      return;
    }

    const version = getStoredVersionMeta(versions, clientItemId);

    if (!version || version.deleted) {
      return;
    }

    records.push({
      clientItemId,
      itemType: version.itemType,
      localStorageKey: version.localStorageKey,
      value: null,
      updatedAt: now,
      deleted: true,
    });
  });

  return records;
}

async function encryptRecord(
  record: LocalSyncRecord,
  encryptionKey: Uint8Array,
  versions: SyncStoredVersions
): Promise<EncryptedPushItem> {
  const payload = {
    localStorageKey: record.localStorageKey,
    itemType: record.itemType,
    value: record.value,
    deleted: record.deleted === true,
  };
  const plaintext = encoder.encode(JSON.stringify(payload));
  const nonce = randomBytes(24);
  const cipher = xchacha20poly1305(encryptionKey, nonce);
  const ciphertext = cipher.encrypt(plaintext);

  return {
    clientItemId: record.clientItemId,
    itemType: record.itemType,
    localStorageKey: record.localStorageKey,
    schemaVersion: 1,
    baseVersionId: getStoredVersionMeta(versions, record.clientItemId)?.versionId ?? null,
    clientUpdatedAt: record.updatedAt,
    encryptionVersion: 1,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    payloadSha256: bytesToHex(sha256(plaintext)),
    deleted: record.deleted === true,
  };
}

async function decryptPulledItem(item: PullResponseItem, encryptionKey: Uint8Array) {
  const cipher = xchacha20poly1305(encryptionKey, base64ToBytes(item.version.nonce));
  const plaintext = cipher.decrypt(base64ToBytes(item.version.ciphertext));
  const payloadText = decoder.decode(plaintext);
  const digest = bytesToHex(sha256(encoder.encode(payloadText)));

  if (digest !== item.version.payloadSha256) {
    throw new Error('Downloaded sync item failed integrity check.');
  }

  return JSON.parse(payloadText) as {
    localStorageKey: string;
    itemType: SyncItemType;
    value: unknown;
    deleted?: boolean;
  };
}

export async function pushEncryptedSync(phrase: string) {
  const session = await getSyncSession();
  if (!session) {
    throw new Error('Create or enter your Private Sync Phrase first.');
  }

  const material = await derivePhraseMaterial(phrase);
  if (material.phraseFingerprint !== session.phraseFingerprint) {
    throw new Error('Private Sync Phrase does not match this device.');
  }

  const versions = await getStoredVersions();
  const records = await collectLocalSyncRecords(versions);
  const items = await Promise.all(
    records.map((record) => encryptRecord(record, material.encryptionKey, versions))
  );
  const response = await requestJson<{
    pushed: { clientItemId: string; versionId: string; hasConflict: boolean }[];
  }>(
    '/v1/sync/push',
    {
      method: 'POST',
      body: JSON.stringify({ items }),
    },
    session
  );
  const nextVersions = { ...versions };
  const recordsByClientItemId = new Map(records.map((record) => [record.clientItemId, record]));
  response.pushed.forEach((item) => {
    if (!item.hasConflict) {
      const record = recordsByClientItemId.get(item.clientItemId);

      if (record) {
        setStoredVersionMeta(nextVersions, item.clientItemId, {
          versionId: item.versionId,
          itemType: record.itemType,
          localStorageKey: record.localStorageKey,
          deleted: record.deleted === true,
        });
      }
    }
  });
  const nextSession = { ...session, lastSyncedAt: new Date().toISOString() };

  await Promise.all([
    saveStoredVersions(nextVersions),
    AsyncStorage.setItem(SYNC_SESSION_STORAGE_KEY, JSON.stringify(nextSession)),
  ]);

  return {
    pushedCount: response.pushed.length,
    conflictCount: response.pushed.filter((item) => item.hasConflict).length,
  };
}

export async function pullEncryptedSync(phrase: string, options: { full?: boolean } = {}) {
  const session = await getSyncSession();
  if (!session) {
    throw new Error('Create or enter your Private Sync Phrase first.');
  }

  const material = await derivePhraseMaterial(phrase);
  if (material.phraseFingerprint !== session.phraseFingerprint) {
    throw new Error('Private Sync Phrase does not match this device.');
  }

  const since = options.full ? null : await AsyncStorage.getItem(SYNC_LAST_PULL_STORAGE_KEY);
  const response = await requestJson<PullResponse>(
    `/v1/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`,
    { method: 'GET' },
    session
  );
  const versions = await getStoredVersions();
  const writes: [string, string][] = [];
  const removals: string[] = [];

  for (const item of response.items) {
    const payload = await decryptPulledItem(item, material.encryptionKey);
    const localStorageKey = payload.localStorageKey || item.localStorageKey;

    if (!localStorageKey) {
      continue;
    }

    const isDeleted = Boolean(item.deletedAt || payload.deleted);

    if (isDeleted) {
      removals.push(localStorageKey);
    } else {
      const valueText = JSON.stringify(payload.value);

      if (hasBlockedMediaPayload(valueText)) {
        continue;
      }

      writes.push([localStorageKey, valueText]);
    }

    setStoredVersionMeta(versions, item.clientItemId, {
      versionId: item.currentVersionId,
      itemType: item.itemType,
      localStorageKey,
      deleted: isDeleted,
    });
  }

  if (writes.length > 0) {
    await AsyncStorage.multiSet(writes);
  }

  if (removals.length > 0) {
    await AsyncStorage.multiRemove(removals);
  }

  const nextSession = { ...session, lastSyncedAt: response.pulledAt };
  await Promise.all([
    saveStoredVersions(versions),
    AsyncStorage.setItem(SYNC_LAST_PULL_STORAGE_KEY, response.pulledAt),
    AsyncStorage.setItem(SYNC_SESSION_STORAGE_KEY, JSON.stringify(nextSession)),
  ]);

  return { pulledCount: writes.length, deletedCount: removals.length };
}

export async function getEncryptedSyncLog() {
  const session = await getSyncSession();
  if (!session) {
    throw new Error('Connect Private Sync first.');
  }

  return requestJson<SyncLog>('/v1/sync/log', { method: 'GET' }, session);
}

function getPreviewText(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return 'Saved app data';
  }

  const candidate = value as {
    preview?: unknown;
    date?: unknown;
    book?: unknown;
    chapter?: unknown;
    verse?: unknown;
    design?: { book?: unknown; chapter?: unknown; verse?: unknown };
  };
  const preview = typeof candidate.preview === 'string' ? candidate.preview.trim() : '';

  if (preview) {
    return preview.slice(0, 96);
  }

  const book = candidate.book ?? candidate.design?.book;
  const chapter = candidate.chapter ?? candidate.design?.chapter;
  const verse = candidate.verse ?? candidate.design?.verse;

  if (typeof book === 'string' && (typeof chapter === 'number' || typeof chapter === 'string')) {
    return `${book} ${chapter}${verse ? `:${verse}` : ''}`;
  }

  return typeof candidate.date === 'string' ? candidate.date : 'Saved app data';
}

function getJournalStoragePrefix(itemType: SyncItemType, localStorageKey: string, value: unknown) {
  if (localStorageKey.startsWith('journal_prayer_')) {
    return 'journal_prayer_';
  }
  if (localStorageKey.startsWith('journal_bible_study_')) {
    return 'journal_bible_study_';
  }
  if (localStorageKey.startsWith('journal_church_day_')) {
    return 'journal_church_day_';
  }
  if (localStorageKey.startsWith('journal_daily_devotional_')) {
    return 'journal_daily_devotional_';
  }
  if (localStorageKey.startsWith('journal_studio_') || itemType === 'studio_journal_entry') {
    return 'journal_studio_';
  }

  if (typeof value === 'object' && value !== null) {
    const valueType = (value as { type?: unknown }).type;

    if (valueType === 'prayer') {
      return 'journal_prayer_';
    }
    if (valueType === 'bible-study') {
      return 'journal_bible_study_';
    }
    if (valueType === 'church-day') {
      return 'journal_church_day_';
    }
    if (valueType === 'daily-devotional') {
      return 'journal_daily_devotional_';
    }
    if (valueType === 'journal-studio') {
      return 'journal_studio_';
    }
  }

  return null;
}

function cloneJournalConflictValue(version: SyncConflictVersion) {
  if (typeof version.value !== 'object' || version.value === null) {
    return null;
  }

  const prefix = getJournalStoragePrefix(version.itemType, version.localStorageKey, version.value);

  if (!prefix) {
    return null;
  }

  const clonedValue = JSON.parse(JSON.stringify(version.value)) as Record<string, unknown>;
  const nextId = `${Date.now()}-${bytesToHex(randomBytes(6))}`;
  const updatedAt = Date.now();

  clonedValue.id = nextId;
  clonedValue.updatedAt = updatedAt;

  return {
    id: nextId,
    localStorageKey: `${prefix}${nextId}`,
    value: clonedValue,
    indexEntry: {
      id: nextId,
      type: clonedValue.type,
      date: clonedValue.date,
      preview: clonedValue.preview,
      updatedAt,
      isFavorite: clonedValue.isFavorite,
      book: clonedValue.book,
      chapter: clonedValue.chapter,
      verse: clonedValue.verse,
    },
  };
}

async function writeConflictVersionToLocal(
  conflict: SyncConflict,
  version: SyncConflictVersion,
  versions: SyncStoredVersions
) {
  if (hasBlockedMediaPayload(JSON.stringify(version.value))) {
    throw new Error('This conflict contains local media and cannot be synced.');
  }

  await AsyncStorage.setItem(version.localStorageKey, JSON.stringify(version.value));
  setStoredVersionMeta(versions, conflict.clientItemId, {
    versionId: version.id,
    itemType: conflict.itemType,
    localStorageKey: version.localStorageKey,
  });
}

async function addJournalCopyToLocal(version: SyncConflictVersion) {
  const cloned = cloneJournalConflictValue(version);

  if (!cloned) {
    throw new Error('Save both is only available for journal entry conflicts.');
  }

  const indexValue = await AsyncStorage.getItem('journal_index');
  let indexEntries: unknown[] = [];

  try {
    const parsedIndex = indexValue ? (JSON.parse(indexValue) as unknown) : [];
    indexEntries = Array.isArray(parsedIndex) ? parsedIndex : [];
  } catch {
    indexEntries = [];
  }

  indexEntries.unshift(cloned.indexEntry);
  await AsyncStorage.multiSet([
    [cloned.localStorageKey, JSON.stringify(cloned.value)],
    ['journal_index', JSON.stringify(indexEntries)],
  ]);
}

export async function getEncryptedSyncConflicts(phrase: string) {
  const session = await getSyncSession();
  if (!session) {
    throw new Error('Create or enter your Private Sync Phrase first.');
  }

  const material = await derivePhraseMaterial(phrase);
  if (material.phraseFingerprint !== session.phraseFingerprint) {
    throw new Error('Private Sync Phrase does not match this device.');
  }

  const response = await requestJson<{ conflicts: ConflictResponseRow[] }>(
    '/v1/sync/conflicts',
    { method: 'GET' },
    session
  );
  const conflictsByItemId = new Map<string, SyncConflict>();

  for (const row of response.conflicts) {
    const item: PullResponseItem = {
      clientItemId: row.client_item_id,
      itemType: row.item_type,
      localStorageKey: row.local_storage_key,
      currentVersionId: row.version_id,
      version: {
        id: row.version_id,
        deviceId: row.device_id,
        deviceName: row.device_name,
        clientUpdatedAt: Number(row.client_updated_at),
        serverCreatedAt: row.server_created_at,
        nonce: row.nonce,
        ciphertext: row.ciphertext,
        payloadSha256: row.payload_sha256,
      },
    };
    const payload = await decryptPulledItem(item, material.encryptionKey);
    const localStorageKey = payload.localStorageKey || row.local_storage_key || row.client_item_id;
    const version: SyncConflictVersion = {
      id: row.version_id,
      deviceId: row.device_id,
      deviceName: row.device_name || 'Unknown device',
      clientUpdatedAt: Number(row.client_updated_at),
      serverCreatedAt: row.server_created_at,
      localStorageKey,
      itemType: row.item_type,
      value: payload.value,
      preview: getPreviewText(payload.value),
    };
    const existingConflict = conflictsByItemId.get(row.item_id);

    if (existingConflict) {
      existingConflict.versions.push(version);
    } else {
      conflictsByItemId.set(row.item_id, {
        itemId: row.item_id,
        clientItemId: row.client_item_id,
        itemType: row.item_type,
        localStorageKey,
        versions: [version],
      });
    }
  }

  return Array.from(conflictsByItemId.values());
}

export async function keepEncryptedSyncConflictVersion(
  phrase: string,
  conflict: SyncConflict,
  version: SyncConflictVersion
) {
  const session = await getSyncSession();
  if (!session) {
    throw new Error('Create or enter your Private Sync Phrase first.');
  }

  const versions = await getStoredVersions();
  await writeConflictVersionToLocal(conflict, version, versions);
  await requestJson(
    `/v1/sync/conflicts/${encodeURIComponent(conflict.itemId)}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'keep_version', versionId: version.id }),
    },
    session
  );
  await saveStoredVersions(versions);
}

export async function saveBothEncryptedSyncConflictVersions(
  phrase: string,
  conflict: SyncConflict
) {
  const [versionToKeep, ...versionsToCopy] = conflict.versions;

  if (!versionToKeep || versionsToCopy.length === 0) {
    throw new Error('There are not two conflict versions to save.');
  }

  const session = await getSyncSession();
  if (!session) {
    throw new Error('Create or enter your Private Sync Phrase first.');
  }

  const versions = await getStoredVersions();
  await writeConflictVersionToLocal(conflict, versionToKeep, versions);

  for (const version of versionsToCopy) {
    await addJournalCopyToLocal(version);
  }

  await requestJson(
    `/v1/sync/conflicts/${encodeURIComponent(conflict.itemId)}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'keep_version', versionId: versionToKeep.id }),
    },
    session
  );
  await saveStoredVersions(versions);
  await pushEncryptedSync(phrase);
}

export async function disconnectPrivateSync() {
  await AsyncStorage.multiRemove([
    SYNC_SESSION_STORAGE_KEY,
    SYNC_VERSION_STORAGE_KEY,
    SYNC_LAST_PULL_STORAGE_KEY,
  ]);
}
