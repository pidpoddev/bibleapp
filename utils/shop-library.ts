import AsyncStorage from '@react-native-async-storage/async-storage';

import { SHOP_BACKGROUND_PACKS } from '@/utils/shop-backgrounds';
import { SHOP_STICKER_PACKS } from '@/utils/shop-stickers';
import { SHOP_OWNED_PACKS_STORAGE_KEY } from '@/utils/storage-keys';

const INCLUDED_SHOP_PACK_IDS = [
  ...SHOP_BACKGROUND_PACKS.filter((pack) => pack.isIncluded).map((pack) => pack.id),
  ...SHOP_STICKER_PACKS.filter((pack) => pack.isIncluded).map((pack) => pack.id),
];
const KNOWN_USABLE_SHOP_PACK_IDS = new Set([
  ...SHOP_BACKGROUND_PACKS.map((pack) => pack.id),
  ...SHOP_STICKER_PACKS.map((pack) => pack.id),
]);

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

export async function getOwnedShopPackIds() {
  const storedPackIds = safeParseOwnedPackIds(
    await AsyncStorage.getItem(SHOP_OWNED_PACKS_STORAGE_KEY)
  ).filter((packId) => KNOWN_USABLE_SHOP_PACK_IDS.has(packId));

  return new Set([...INCLUDED_SHOP_PACK_IDS, ...storedPackIds]);
}

export async function unlockShopPack(packId: string) {
  const ownedPackIds = await getOwnedShopPackIds();
  ownedPackIds.add(packId);

  await AsyncStorage.setItem(
    SHOP_OWNED_PACKS_STORAGE_KEY,
    JSON.stringify(Array.from(ownedPackIds).sort())
  );

  return ownedPackIds;
}
