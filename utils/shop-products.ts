export type ShopPurchaseProduct = {
  packId: string;
  productId: string;
  entitlementId: string;
  fallbackPriceLabel: string;
};

export const SHOP_PURCHASE_PRODUCTS: ShopPurchaseProduct[] = [
  {
    packId: 'quiet-strength-stickers',
    productId: 'com.pidpod.faithcanvas.shop.quiet_strength_stickers',
    entitlementId: 'shop_pack_quiet_strength_stickers',
    fallbackPriceLabel: '$1',
  },
  {
    packId: 'pressed-florals-stickers',
    productId: 'com.pidpod.faithcanvas.shop.pressed_florals_stickers',
    entitlementId: 'shop_pack_pressed_florals_stickers',
    fallbackPriceLabel: '$1',
  },
  {
    packId: 'verse-markers-stickers',
    productId: 'com.pidpod.faithcanvas.shop.verse_markers_stickers',
    entitlementId: 'shop_pack_verse_markers_stickers',
    fallbackPriceLabel: '$1',
  },
  {
    packId: 'soft-journal-decor-stickers',
    productId: 'com.pidpod.faithcanvas.shop.soft_journal_decor_stickers',
    entitlementId: 'shop_pack_soft_journal_decor_stickers',
    fallbackPriceLabel: '$1',
  },
  {
    packId: 'pastel-note-papers',
    productId: 'com.pidpod.faithcanvas.shop.pastel_note_papers',
    entitlementId: 'shop_pack_pastel_note_papers',
    fallbackPriceLabel: '$1',
  },
];

export const SHOP_PURCHASE_PRODUCT_BY_PACK_ID = SHOP_PURCHASE_PRODUCTS.reduce<
  Record<string, ShopPurchaseProduct>
>((products, product) => {
  products[product.packId] = product;
  return products;
}, {});

export const SHOP_PACK_ID_BY_REVENUECAT_ENTITLEMENT_ID = SHOP_PURCHASE_PRODUCTS.reduce<
  Record<string, string>
>((packIds, product) => {
  packIds[product.entitlementId] = product.packId;
  return packIds;
}, {});

export const SHOP_PACK_ID_BY_STORE_PRODUCT_ID = SHOP_PURCHASE_PRODUCTS.reduce<
  Record<string, string>
>((packIds, product) => {
  packIds[product.productId] = product.packId;
  return packIds;
}, {});

export function getShopPurchaseProduct(packId: string) {
  return SHOP_PURCHASE_PRODUCT_BY_PACK_ID[packId] ?? null;
}
