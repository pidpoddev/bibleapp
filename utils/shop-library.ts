import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { SHOP_BACKGROUND_PACKS } from '@/utils/shop-backgrounds';
import { SHOP_NOTE_STYLE_PACKS } from '@/utils/shop-note-styles';
import { SHOP_STICKER_PACKS } from '@/utils/shop-stickers';
import { SHOP_OWNED_PACKS_STORAGE_KEY } from '@/utils/storage-keys';

const INCLUDED_SHOP_PACK_IDS = [
  ...SHOP_BACKGROUND_PACKS.filter((pack) => pack.isIncluded).map((pack) => pack.id),
  ...SHOP_NOTE_STYLE_PACKS.filter((pack) => pack.isIncluded).map((pack) => pack.id),
  ...SHOP_STICKER_PACKS.filter((pack) => pack.isIncluded).map((pack) => pack.id),
];
const KNOWN_USABLE_SHOP_PACK_IDS = new Set([
  ...SHOP_BACKGROUND_PACKS.map((pack) => pack.id),
  ...SHOP_NOTE_STYLE_PACKS.map((pack) => pack.id),
  ...SHOP_STICKER_PACKS.map((pack) => pack.id),
]);

// Development iOS builds are used by the Simulator QA workflow. Treat every
// catalog pack as owned for reads only — never persist that synthetic set.
const ASSUME_ALL_PACKS_OWNED = __DEV__ && Platform.OS === 'ios';

let unlockWriteQueue: Promise<unknown> = Promise.resolve();

function enqueueUnlockWrite<T>(operation: () => Promise<T>): Promise<T> {
  const nextWrite = unlockWriteQueue.then(operation, operation);
  unlockWriteQueue = nextWrite.then(
    () => undefined,
    () => undefined
  );
  return nextWrite;
}

function safeParseOwnedPackIds(value: string | null) {
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

async function getPersistedOwnedShopPackIds() {
  const storedPackIds = safeParseOwnedPackIds(
    await AsyncStorage.getItem(SHOP_OWNED_PACKS_STORAGE_KEY)
  ).filter((packId) => KNOWN_USABLE_SHOP_PACK_IDS.has(packId));

  return new Set([...INCLUDED_SHOP_PACK_IDS, ...storedPackIds]);
}

export async function getOwnedShopPackIds() {
  if (ASSUME_ALL_PACKS_OWNED) {
    return new Set(KNOWN_USABLE_SHOP_PACK_IDS);
  }

  return getPersistedOwnedShopPackIds();
}

export async function unlockShopPack(packId: string) {
  return unlockShopPacks([packId]);
}

export async function unlockShopPacks(packIds: string[]) {
  return enqueueUnlockWrite(async () => {
    // Always merge against persisted ownership so __DEV__ iOS never writes the
    // full synthetic catalog into AsyncStorage.
    const ownedPackIds = await getPersistedOwnedShopPackIds();

    packIds
      .filter((packId) => KNOWN_USABLE_SHOP_PACK_IDS.has(packId))
      .forEach((packId) => ownedPackIds.add(packId));

    await AsyncStorage.setItem(
      SHOP_OWNED_PACKS_STORAGE_KEY,
      JSON.stringify(Array.from(ownedPackIds).sort())
    );

    if (ASSUME_ALL_PACKS_OWNED) {
      return new Set(KNOWN_USABLE_SHOP_PACK_IDS);
    }

    return ownedPackIds;
  });
}
