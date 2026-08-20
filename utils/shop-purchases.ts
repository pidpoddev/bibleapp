import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  CustomerInfo,
  LogHandler,
  PurchasesStoreProduct,
} from 'react-native-purchases';

import { getOwnedShopPackIds, unlockShopPacks } from '@/utils/shop-library';
import {
  getShopPurchaseProduct,
  SHOP_PACK_ID_BY_REVENUECAT_ENTITLEMENT_ID,
  SHOP_PACK_ID_BY_STORE_PRODUCT_ID,
  SHOP_PURCHASE_PRODUCTS,
} from '@/utils/shop-products';

type PurchaseAvailability = 'available' | 'missing_key' | 'unsupported_platform' | 'failed';

export type ShopStoreProduct = {
  packId: string;
  productId: string;
  priceLabel: string;
  title?: string;
};

export type ShopPurchaseSyncResult = {
  availability: PurchaseAvailability;
  ownedPackIds: Set<string>;
  productsByPackId: Record<string, ShopStoreProduct>;
};

export type ShopPurchaseResult =
  | { status: 'purchased'; ownedPackIds: Set<string> }
  | { status: 'cancelled'; ownedPackIds: Set<string> }
  | { status: 'unavailable'; ownedPackIds: Set<string> }
  | { status: 'failed'; ownedPackIds: Set<string>; error: unknown };

export type ShopRestoreResult =
  | { status: 'restored'; ownedPackIds: Set<string>; restoredPackCount: number }
  | { status: 'unavailable'; ownedPackIds: Set<string> }
  | { status: 'failed'; ownedPackIds: Set<string>; error: unknown };

let hasConfiguredPurchases = false;
let hasInstalledRevenueCatLogHandler = false;
let purchasesModule: typeof import('react-native-purchases') | null | undefined;

declare const require: (moduleName: string) => unknown;

const EXPECTED_STORE_SETUP_ERROR_PATTERNS = [
  'BILLING_UNAVAILABLE',
  'Billing service unavailable on device',
  'PurchaseNotAllowedError',
  'ConfigurationError',
  'no Play Store products registered',
  'offerings empty',
  'why-are-offerings-empty',
];

function getRevenueCatApiKey() {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';
  }

  return '';
}

function getPurchasesModule() {
  if (Constants.appOwnership === 'expo') {
    return null;
  }

  if (purchasesModule !== undefined) {
    return purchasesModule;
  }

  try {
    purchasesModule = require('react-native-purchases') as typeof import('react-native-purchases');
  } catch (error) {
    purchasesModule = null;
    logUnexpectedPurchaseError('RevenueCat native module is not available', error);
  }

  return purchasesModule;
}

function getStoreProductType(module: typeof import('react-native-purchases')) {
  return module.PURCHASE_TYPE.INAPP;
}

function isUserCancelledPurchase(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'userCancelled' in error &&
    (error as { userCancelled?: boolean }).userCancelled === true
  );
}

function stringifyPurchaseError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name} ${error.message} ${error.stack ?? ''}`;
  }

  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function hasExpectedStoreSetupMessage(message: string) {
  return EXPECTED_STORE_SETUP_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function getPurchaseErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : null;
}

function isExpectedStoreSetupError(error: unknown) {
  const code = getPurchaseErrorCode(error);
  const purchasesErrorCode = purchasesModule?.PURCHASES_ERROR_CODE;

  return (
    (purchasesErrorCode !== undefined &&
      (code === purchasesErrorCode.PURCHASE_NOT_ALLOWED_ERROR ||
        code === purchasesErrorCode.CONFIGURATION_ERROR)) ||
    code === 'PurchaseNotAllowedError' ||
    code === 'ConfigurationError' ||
    hasExpectedStoreSetupMessage(stringifyPurchaseError(error))
  );
}

function logUnexpectedPurchaseError(message: string, error: unknown) {
  if (!isExpectedStoreSetupError(error)) {
    console.warn(message, error);
  }
}

function installRevenueCatLogHandler(module: typeof import('react-native-purchases')) {
  if (hasInstalledRevenueCatLogHandler) {
    return;
  }

  const logHandler: LogHandler = (level, message) => {
    if (hasExpectedStoreSetupMessage(message)) {
      return;
    }

    if (level === module.LOG_LEVEL.ERROR) {
      console.error(message);
    } else if (level === module.LOG_LEVEL.WARN) {
      console.warn(message);
    } else if (__DEV__ && level === module.LOG_LEVEL.INFO) {
      console.info(message);
    }
  };

  module.default.setLogHandler(logHandler);
  hasInstalledRevenueCatLogHandler = true;
}

function mapStoreProducts(products: PurchasesStoreProduct[]) {
  return products.reduce<Record<string, ShopStoreProduct>>((storeProducts, product) => {
    const packId = SHOP_PACK_ID_BY_STORE_PRODUCT_ID[product.identifier];

    if (packId) {
      storeProducts[packId] = {
        packId,
        productId: product.identifier,
        priceLabel: product.priceString,
        title: product.title,
      };
    }

    return storeProducts;
  }, {});
}

async function configureRevenueCat(): Promise<PurchaseAvailability> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return 'unsupported_platform';
  }

  const module = getPurchasesModule();

  if (!module) {
    return 'unsupported_platform';
  }

  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    return 'missing_key';
  }

  if (!hasConfiguredPurchases) {
    installRevenueCatLogHandler(module);
    await module.default.setLogLevel(module.LOG_LEVEL.WARN);
    module.default.configure({ apiKey });
    hasConfiguredPurchases = true;
  }

  return 'available';
}

async function savePurchasedPacksFromCustomerInfo(customerInfo: CustomerInfo) {
  const purchasedPackIds = new Set<string>();

  // Only active entitlements count. Product ID history can still list refunded
  // non-consumables after the entitlement becomes inactive.
  Object.keys(customerInfo.entitlements.active).forEach((entitlementId) => {
    const packId = SHOP_PACK_ID_BY_REVENUECAT_ENTITLEMENT_ID[entitlementId];

    if (packId) {
      purchasedPackIds.add(packId);
    }
  });

  if (purchasedPackIds.size > 0) {
    return unlockShopPacks(Array.from(purchasedPackIds));
  }

  return getOwnedShopPackIds();
}

export async function refreshShopPurchases(): Promise<ShopPurchaseSyncResult> {
  const ownedPackIds = await getOwnedShopPackIds();
  const availability = await configureRevenueCat();

  if (availability !== 'available') {
    return {
      availability,
      ownedPackIds,
      productsByPackId: {},
    };
  }

  const module = getPurchasesModule();

  if (!module) {
    return {
      availability: 'unsupported_platform',
      ownedPackIds,
      productsByPackId: {},
    };
  }

  try {
    const [customerInfo, products] = await Promise.all([
      module.default.getCustomerInfo(),
      module.default.getProducts(
        SHOP_PURCHASE_PRODUCTS.map((product) => product.productId),
        getStoreProductType(module)
      ),
    ]);

    return {
      availability,
      ownedPackIds: await savePurchasedPacksFromCustomerInfo(customerInfo),
      productsByPackId: mapStoreProducts(products),
    };
  } catch (error) {
    logUnexpectedPurchaseError('Failed to refresh shop purchases', error);

    return {
      availability: 'failed',
      ownedPackIds,
      productsByPackId: {},
    };
  }
}

export async function purchaseShopPack(packId: string): Promise<ShopPurchaseResult> {
  const product = getShopPurchaseProduct(packId);
  const ownedPackIds = await getOwnedShopPackIds();

  if (!product) {
    return { status: 'unavailable', ownedPackIds };
  }

  const availability = await configureRevenueCat();

  if (availability !== 'available') {
    return { status: 'unavailable', ownedPackIds };
  }

  const module = getPurchasesModule();

  if (!module) {
    return { status: 'unavailable', ownedPackIds };
  }

  try {
    const purchaseResult = await module.default.purchaseProduct(
      product.productId,
      null,
      getStoreProductType(module)
    );

    return {
      status: 'purchased',
      ownedPackIds: await savePurchasedPacksFromCustomerInfo(purchaseResult.customerInfo),
    };
  } catch (error) {
    if (isUserCancelledPurchase(error)) {
      return { status: 'cancelled', ownedPackIds };
    }

    if (isExpectedStoreSetupError(error)) {
      return { status: 'unavailable', ownedPackIds };
    }

    console.warn('Failed to purchase shop pack', error);
    return { status: 'failed', ownedPackIds, error };
  }
}

export async function restoreShopPurchases(): Promise<ShopRestoreResult> {
  const ownedPackIds = await getOwnedShopPackIds();
  const availability = await configureRevenueCat();

  if (availability !== 'available') {
    return { status: 'unavailable', ownedPackIds };
  }

  const module = getPurchasesModule();

  if (!module) {
    return { status: 'unavailable', ownedPackIds };
  }

  try {
    const previouslyOwnedPaidPackIds = new Set(
      Array.from(ownedPackIds).filter((packId) => getShopPurchaseProduct(packId) !== null)
    );
    const customerInfo = await module.default.restorePurchases();
    const nextOwnedPackIds = await savePurchasedPacksFromCustomerInfo(customerInfo);
    const restoredPackCount = Array.from(nextOwnedPackIds).filter(
      (packId) =>
        getShopPurchaseProduct(packId) !== null && !previouslyOwnedPaidPackIds.has(packId)
    ).length;

    return {
      status: 'restored',
      ownedPackIds: nextOwnedPackIds,
      restoredPackCount,
    };
  } catch (error) {
    if (isExpectedStoreSetupError(error)) {
      return { status: 'unavailable', ownedPackIds };
    }

    console.warn('Failed to restore shop purchases', error);
    return { status: 'failed', ownedPackIds, error };
  }
}
