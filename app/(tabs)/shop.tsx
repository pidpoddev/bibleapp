import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppSettings, type AppLanguageKey } from '@/utils/app-settings';
import { SHOP_BACKGROUND_PACKS, type ShopBackground } from '@/utils/shop-backgrounds';
import { getOwnedShopPackIds } from '@/utils/shop-library';
import {
  purchaseShopPack,
  refreshShopPurchases,
  restoreShopPurchases,
  type ShopStoreProduct,
} from '@/utils/shop-purchases';
import { getShopPurchaseProduct } from '@/utils/shop-products';
import { SHOP_NOTE_STYLE_PACKS, type ShopNoteStyle } from '@/utils/shop-note-styles';
import { SHOP_STICKER_PACKS, type ShopSticker } from '@/utils/shop-stickers';
import { FocusedScreenView } from '@/components/focused-screen-view';
import { useResponsiveLayout } from '@/utils/responsive-layout';

const SHOP_TAB_ICON = require('../../assets/images/toolbar-icons/shop-tab.png');

type ShopCategory = {
  key: string;
  titleKey:
    | 'shopCategoryAll'
    | 'shopCategoryCanvas'
    | 'shopCategoryThemes'
    | 'shopCategoryDecor'
    | 'shopCategoryStickers'
    | 'shopCategoryTools'
    | 'shopCategoryNoteStyles';
  icon: keyof typeof Ionicons.glyphMap;
};

type ShopPack = {
  id: string;
  title: string;
  subtitle: string;
  categoryKey: string;
  category: string;
  colors: string[];
  icon: keyof typeof Ionicons.glyphMap;
  tag: string;
  status: 'included' | 'paid' | 'preview';
  priceLabel?: string;
  previewImage?: ImageSourcePropType;
  stickers?: ShopSticker[];
  backgrounds?: ShopBackground[];
  noteStyles?: ShopNoteStyle[];
};

const CATEGORIES: ShopCategory[] = [
  { key: 'all', titleKey: 'shopCategoryAll', icon: 'storefront-outline' },
  { key: 'backgrounds', titleKey: 'shopCategoryCanvas', icon: 'image-outline' },
  { key: 'note-styles', titleKey: 'shopCategoryNoteStyles', icon: 'document-text-outline' },
  { key: 'themes', titleKey: 'shopCategoryThemes', icon: 'color-palette-outline' },
  { key: 'decor', titleKey: 'shopCategoryDecor', icon: 'sparkles-outline' },
  { key: 'stickers', titleKey: 'shopCategoryStickers', icon: 'pricetags-outline' },
  { key: 'tools', titleKey: 'shopCategoryTools', icon: 'brush-outline' },
];

const STICKER_PACK_COLORS: Record<string, string[]> = {
  'floral-faith-stickers': ['#F4D6CE', '#DDE5CF', '#F9F7EC'],
  'scripture-verse-label-stickers': ['#E8D4A8', '#F7EBC8', '#2F2C28'],
  'faith-canvas-pastel-stickers': ['#F8C8D4', '#CDB5EF', '#BFE3D6'],
  'prayer-night-stickers': ['#D9C7F0', '#BFD7F1', '#F7D9E5'],
  'quiet-strength-stickers': ['#E8DED1', '#9FAF9A', '#C88C93'],
  'pressed-florals-stickers': ['#EFE6D9', '#A4AD8C', '#C58B8B'],
  'verse-markers-stickers': ['#FCEEF3', '#F4F1FF', '#EFF7FF'],
  'soft-journal-decor-stickers': ['#FCEEF3', '#EEF9F3', '#EFF7FF'],
};

const STICKER_PACK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'floral-faith-stickers': 'flower-outline',
  'scripture-verse-label-stickers': 'pricetag-outline',
  'faith-canvas-pastel-stickers': 'heart-outline',
  'prayer-night-stickers': 'moon-outline',
  'quiet-strength-stickers': 'leaf-outline',
  'pressed-florals-stickers': 'flower-outline',
  'verse-markers-stickers': 'arrow-forward-circle-outline',
  'soft-journal-decor-stickers': 'albums-outline',
};

const PACKS: ShopPack[] = [
  {
    ...SHOP_BACKGROUND_PACKS[0],
    categoryKey: 'backgrounds',
    colors: ['#F7F4EE', '#F2CFCB', '#CDB5EF'],
    icon: 'image-outline',
    status: 'included',
    previewImage: SHOP_BACKGROUND_PACKS[0].backgrounds[0].image,
  },
  ...SHOP_STICKER_PACKS.map((pack): ShopPack => ({
    ...pack,
    categoryKey: 'stickers',
    colors: STICKER_PACK_COLORS[pack.id] ?? ['#F4D6CE', '#DDE5CF', '#F9F7EC'],
    icon: STICKER_PACK_ICONS[pack.id] ?? 'pricetags-outline',
    status: pack.isIncluded ? 'included' : 'paid',
    priceLabel: pack.priceLabel,
    previewImage: pack.stickers[0]?.previewImage ?? pack.stickers[0]?.image,
  })),
  {
    id: 'cozy-canvas-kit',
    title: 'Cozy Canvas Kit',
    subtitle: 'Lined paper, soft wash canvas pages, and warm desk textures',
    categoryKey: 'backgrounds',
    category: 'Canvas backgrounds',
    colors: ['#FFFDF9', '#F7D8D5', '#EADBC8'],
    icon: 'albums-outline',
    tag: 'Preview',
    status: 'preview',
  },
  ...SHOP_NOTE_STYLE_PACKS.map(
    (pack): ShopPack => ({
      ...pack,
      categoryKey: 'note-styles',
      icon: 'document-text-outline',
      status: pack.isIncluded ? 'included' : 'paid',
      priceLabel: pack.priceLabel,
    })
  ),
  {
    id: 'faith-notes',
    title: 'Faith Notes',
    subtitle: 'Tiny crosses, hearts, stars, tabs, and page markers',
    categoryKey: 'decor',
    category: 'Decor',
    colors: ['#F7C9D4', '#D9F4E6', '#F6E8A9'],
    icon: 'sparkles-outline',
    tag: 'Preview',
    status: 'preview',
  },
  {
    id: 'soft-ribbons',
    title: 'Soft Ribbons',
    subtitle: 'Decor strips, washi corners, divider bows, and sweet page labels',
    categoryKey: 'decor',
    category: 'Decor',
    colors: ['#E7B7C7', '#DDD6F8', '#F8D7C5'],
    icon: 'ribbon-outline',
    tag: 'Preview',
    status: 'preview',
  },
  {
    id: 'gentle-highlighters',
    title: 'Gentle Highlighters',
    subtitle: 'Pastel highlight strips for marking favorite words',
    categoryKey: 'tools',
    category: 'Tools',
    colors: ['#FFF3A3', '#FFD2E1', '#CFE7FF'],
    icon: 'color-filter-outline',
    tag: 'Preview',
    status: 'preview',
  },
  {
    id: 'journal-pens',
    title: 'Journal Pens',
    subtitle: 'Pretty pen styles for prayers, notes, and verse art',
    categoryKey: 'tools',
    category: 'Tools',
    colors: ['#5B514D', '#9A4C56', '#6D8B74'],
    icon: 'brush-outline',
    tag: 'Preview',
    status: 'preview',
  },
  {
    id: 'marketplace-starter-bundle',
    title: 'Starter Bundle',
    subtitle: 'A little bit of everything: canvas pages, decor, labels, and tools',
    categoryKey: 'all',
    category: 'Bundle',
    colors: ['#FCEEF3', '#EEF9F3', '#F4F1FF'],
    icon: 'bag-handle-outline',
    tag: 'Preview',
    status: 'preview',
  },
];

const SHOP_TEXT_TRANSLATIONS: Record<string, Partial<Record<AppLanguageKey, string>>> = {
  'Soft Glitter Backgrounds': { es: 'Fondos con brillo suave' },
  '10 shimmering paper backgrounds for Canvas and journals': {
    es: '10 fondos de papel brillante para Canvas y diarios',
  },
  'Floral Faith Stickers': { es: 'Stickers florales de fe' },
  'Scripture Verse Labels': { es: 'Etiquetas de versículos bíblicos' },
  'Cozy Canvas Kit': { es: 'Kit de lienzo acogedor' },
  'Lined paper, soft wash canvas pages, and warm desk textures': {
    es: 'Papel con líneas, lienzos suaves y texturas cálidas de escritorio',
  },
  'Quiet Mornings': { es: 'Mañanas tranquilas' },
  'Soft paper, sunrise washes, and peaceful note pages': {
    es: 'Papel suave, tonos de amanecer y páginas de notas tranquilas',
  },
  'Sunday Table': { es: 'Mesa de domingo' },
  'A coordinated theme with cream paper, sage tabs, and blush accents': {
    es: 'Un tema coordinado con papel crema, pestañas salvia y detalles rosados',
  },
  'Pastel Note Papers': { es: 'Papeles de nota pastel' },
  'Eight sticky-note colors for Canvas notes: peach, coral, honey, mint, and more': {
    es: 'Ocho colores de notas adhesivas para Canvas: durazno, coral, miel, menta y más',
  },
  'Faith Notes': { es: 'Notas de fe' },
  'Tiny crosses, hearts, stars, tabs, and page markers': {
    es: 'Cruces pequeñas, corazones, estrellas, pestañas y marcadores de página',
  },
  'Soft Ribbons': { es: 'Cintas suaves' },
  'Decor strips, washi corners, divider bows, and sweet page labels': {
    es: 'Tiras decorativas, esquinas washi, moños divisores y etiquetas dulces',
  },
  'Gentle Highlighters': { es: 'Resaltadores suaves' },
  'Pastel highlight strips for marking favorite words': {
    es: 'Tiras pastel para resaltar palabras favoritas',
  },
  'Journal Pens': { es: 'Plumas de diario' },
  'Pretty pen styles for prayers, notes, and verse art': {
    es: 'Estilos de pluma bonitos para oraciones, notas y arte de versículos',
  },
  'Starter Bundle': { es: 'Paquete inicial' },
  'A little bit of everything: canvas pages, decor, labels, and tools': {
    es: 'Un poco de todo: páginas de lienzo, decoración, etiquetas y herramientas',
  },
  'Pearl White Shimmer': { es: 'Brillo blanco perla' },
  'Warm Pearl Sparkle': { es: 'Destello perla cálido' },
  'Lavender Sparkle': { es: 'Destello lavanda' },
  'Lavender Mist': { es: 'Niebla lavanda' },
  'Lavender Dream': { es: 'Sueño lavanda' },
  'Champagne Glimmer': { es: 'Destello champán' },
  'Blush Pink Shimmer': { es: 'Brillo rosa suave' },
  'Blush Pink Glow': { es: 'Resplandor rosa suave' },
  'Soft Champagne': { es: 'Champán suave' },
  'Champagne Sparkle': { es: 'Brillo champán' },
};

export default function ShopScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ category?: string | string[] }>();
  const { colorTheme, language, t } = useAppSettings();
  const layout = useResponsiveLayout();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const openedFromStudio = pathname === '/studio-shop' || pathname.endsWith('/studio-shop');
  const routeCategoryParam = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const initialCategory =
    typeof routeCategoryParam === 'string' &&
    CATEGORIES.some((category) => category.key === routeCategoryParam)
      ? routeCategoryParam
      : 'all';
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [ownedPackIds, setOwnedPackIds] = useState<Set<string>>(() => new Set());
  const [storeProductsByPackId, setStoreProductsByPackId] = useState<
    Record<string, ShopStoreProduct>
  >({});
  const [isPurchasePending, setIsPurchasePending] = useState(false);
  const [shopMessage, setShopMessage] = useState('');
  const packCategoryLabels = {
    all: t('shopCategoryBundle'),
    backgrounds: t('shopCategoryCanvas'),
    'note-styles': t('shopCategoryNoteStyles'),
    themes: t('shopCategoryThemes'),
    decor: t('shopCategoryDecor'),
    stickers: t('shopCategoryStickers'),
    tools: t('shopCategoryTools'),
  };
  const visiblePacks = PACKS.filter(
    (pack) => selectedCategory === 'all' || pack.categoryKey === selectedCategory
  );
  const localizeShopText = useCallback(
    (text: string) => SHOP_TEXT_TRANSLATIONS[text]?.[language.key] ?? text,
    [language.key]
  );

  const isPackAvailable = (pack: ShopPack) => pack.status === 'included' || ownedPackIds.has(pack.id);
  const packHasUsableAssets = (pack: ShopPack) =>
    Boolean(pack.stickers || pack.backgrounds || pack.noteStyles);
  const getPackPriceLabel = (pack: ShopPack) =>
    storeProductsByPackId[pack.id]?.priceLabel ??
    getShopPurchaseProduct(pack.id)?.fallbackPriceLabel ??
    pack.priceLabel;
  const getPackPurchaseLabel = (pack: ShopPack) => {
    const priceLabel = getPackPriceLabel(pack);

    return priceLabel ? t('shopBuyPrice', { price: priceLabel }) : t('shopUnlock');
  };

  useEffect(() => {
    setShopMessage('');
  }, [selectedPackId]);

  useEffect(() => {
    if (
      typeof routeCategoryParam === 'string' &&
      CATEGORIES.some((category) => category.key === routeCategoryParam)
    ) {
      setSelectedCategory(routeCategoryParam);
      setSelectedPackId(null);
    }
  }, [routeCategoryParam]);

  const getPackStatusLabel = (pack: ShopPack) => {
    if (pack.status === 'included') {
      return t('shopIncluded');
    }

    if (ownedPackIds.has(pack.id)) {
      return t('shopOwned');
    }

    return getPackPriceLabel(pack) ?? t('shopUnlock');
  };

  const selectCategory = (categoryKey: string) => {
    setSelectedCategory(categoryKey);
    setSelectedPackId(null);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    });
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      refreshShopPurchases()
        .then((purchaseState) => {
          if (isActive) {
            setOwnedPackIds(purchaseState.ownedPackIds);
            setStoreProductsByPackId(purchaseState.productsByPackId);
          }
        })
        .catch((error) => {
          console.warn('Failed to load shop purchases', error);
          getOwnedShopPackIds()
            .then((nextOwnedPackIds) => {
              if (isActive) {
                setOwnedPackIds(nextOwnedPackIds);
              }
            })
            .catch((ownedError) => {
              console.warn('Failed to load owned shop packs', ownedError);
            });
        });

      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const handlePrimaryPackAction = async (pack: ShopPack) => {
    if (!isPackAvailable(pack)) {
      if (!getShopPurchaseProduct(pack.id) || !packHasUsableAssets(pack)) {
        setShopMessage(t('shopPreviewSavedToolsPending'));
        return;
      }

      setIsPurchasePending(true);
      setShopMessage(t('shopPurchaseLoading'));

      try {
        const purchaseResult = await purchaseShopPack(pack.id);
        setOwnedPackIds(purchaseResult.ownedPackIds);

        if (purchaseResult.status === 'purchased') {
          setShopMessage(t('shopPurchaseSuccess'));
        } else if (purchaseResult.status === 'cancelled') {
          setShopMessage(t('shopPurchaseCancelled'));
        } else if (purchaseResult.status === 'unavailable') {
          setShopMessage(t('shopPurchaseUnavailable'));
        } else {
          setShopMessage(t('shopPurchaseFailed'));
        }
      } finally {
        setIsPurchasePending(false);
      }

      return;
    }

    if (packHasUsableAssets(pack)) {
      if (openedFromStudio && router.canGoBack()) {
        router.back();
        return;
      }

      router.push({
        pathname: '/studio',
        params: {
          openToolbar: pack.backgrounds ? 'backgrounds' : pack.stickers ? 'stickers' : '',
          selectionToken: String(Date.now()),
        },
      });
      return;
    }

    setShopMessage(t('shopPreviewSavedToolsPending'));
  };

  const handleRestorePurchases = async () => {
    setIsPurchasePending(true);
    setShopMessage(t('shopRestoreLoading'));

    try {
      const restoreResult = await restoreShopPurchases();
      setOwnedPackIds(restoreResult.ownedPackIds);

      if (restoreResult.status === 'restored') {
        setShopMessage(
          restoreResult.restoredPackCount > 0 ? t('shopRestoreSuccess') : t('shopRestoreEmpty')
        );
      } else if (restoreResult.status === 'unavailable') {
        setShopMessage(t('shopPurchaseUnavailable'));
      } else {
        setShopMessage(t('shopRestoreFailed'));
      }
    } finally {
      setIsPurchasePending(false);
    }
  };

  const renderPackExpandedDetail = (pack: ShopPack) => {
    const isIncluded = pack.status === 'included';
    const isOwned = ownedPackIds.has(pack.id);
    const isAvailable = isIncluded || isOwned;
    const hasUsableAssets = packHasUsableAssets(pack);

    return (
      <View style={styles.packDetailInline}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isAvailable
              ? hasUsableAssets
                ? `${t('shopUseInStudio')}: ${localizeShopText(pack.title)}`
                : `${t('shopViewPreview')}: ${localizeShopText(pack.title)}`
              : `${getPackPurchaseLabel(pack)}: ${localizeShopText(pack.title)}`
          }
          onPress={() => handlePrimaryPackAction(pack)}
          disabled={isPurchasePending}
          style={[
            styles.addButton,
            { backgroundColor: colorTheme.tint },
            isPurchasePending ? styles.disabledButton : null,
          ]}>
          <Ionicons
            name={
              isAvailable
                ? hasUsableAssets
                  ? 'brush-outline'
                  : 'checkmark-circle-outline'
                : 'lock-open-outline'
            }
            size={17}
            color="#FFFDF9"
          />
          <Text style={styles.addButtonText}>
            {isAvailable
              ? hasUsableAssets
                ? t('shopUseInStudio')
                : t('shopSavedPreview')
              : isPurchasePending
                ? t('shopPurchaseLoading')
                : getPackPurchaseLabel(pack)}
          </Text>
        </Pressable>
        {shopMessage ? <Text style={styles.shopMessage}>{shopMessage}</Text> : null}

        {pack.stickers ? (
          <View style={styles.stickerPreviewGrid}>
            {pack.stickers.map((sticker) => (
              <View key={sticker.key} style={styles.stickerPreviewCard}>
                <Image
                  source={sticker.previewImage ?? sticker.image}
                  resizeMode="contain"
                  style={styles.stickerPreviewImage}
                />
                <Text style={styles.stickerPreviewName}>{localizeShopText(sticker.name)}</Text>
              </View>
            ))}
          </View>
        ) : pack.backgrounds ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.backgroundPreviewScroll}
            contentContainerStyle={styles.backgroundPreviewRow}>
            {pack.backgrounds.map((background) => (
              <View key={background.key} style={styles.backgroundPreviewCard}>
                <Image
                  source={background.previewImage ?? background.image}
                  resizeMode="cover"
                  style={styles.backgroundPreviewImage}
                />
                <Text
                  maxFontSizeMultiplier={1.05}
                  numberOfLines={2}
                  style={styles.backgroundPreviewName}>
                  {localizeShopText(background.name)}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : pack.noteStyles ? (
          <View style={styles.noteStylePreviewGrid}>
            {pack.noteStyles.map((noteStyle) => (
              <View
                key={noteStyle.key}
                style={[
                  styles.noteStylePreviewCard,
                  {
                    backgroundColor: noteStyle.backgroundColor,
                    borderColor: noteStyle.borderColor,
                  },
                ]}>
                <Text style={[styles.noteStylePreviewName, { color: noteStyle.textColor }]}>
                  {localizeShopText(noteStyle.label)}
                </Text>
                <Text style={[styles.noteStylePreviewSample, { color: noteStyle.mutedTextColor }]}>
                  Aa
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.placeholderDetail}>
            <Ionicons name={pack.icon} size={26} color="#5B514D" />
            <Text style={styles.placeholderDetailText}>{t('shopPackPreviewSoon')}</Text>
          </View>
        )}

        <Text style={styles.testPackNote}>
          {isAvailable
            ? hasUsableAssets
              ? t('shopIncludedNote')
              : t('shopPreviewLocalShelf')
            : t('shopUnlockParentApproval')}
        </Text>
      </View>
    );
  };

  return (
    <FocusedScreenView style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.content,
          layout.isTablet
            ? [
                styles.tabletContent,
                {
                  maxWidth: layout.contentMaxWidth,
                  paddingHorizontal: layout.pagePaddingHorizontal,
                },
              ]
            : null,
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.titleRow}>
              <View
                style={[
                  styles.headerIconBadge,
                  { backgroundColor: colorTheme.toolbarBackground },
                ]}>
                <Image source={SHOP_TAB_ICON} style={styles.headerIconImage} resizeMode="contain" />
              </View>
              <Text style={styles.title}>{t('tabShop')}</Text>
            </View>
            <Text style={styles.subtitle}>{t('shopSubtitle')}</Text>
          </View>
          <View style={[styles.shelfBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('shopRestorePurchases')}
              disabled={isPurchasePending}
              onPress={handleRestorePurchases}
              style={styles.restoreButton}>
              <Ionicons name="refresh-outline" size={17} color="#5B514D" />
              <Text numberOfLines={1} style={styles.restoreButtonText}>
                {t('shopRestorePurchases')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.categoryRow}>
          {CATEGORIES.map((category) => (
            <Pressable
              key={category.key}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedCategory === category.key }}
              onPress={() => selectCategory(category.key)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: colorTheme.toolbarBackground,
                  borderColor: colorTheme.border,
                },
                selectedCategory === category.key ? styles.categoryChipActive : null,
              ]}>
              <Ionicons name={category.icon} size={17} color="#5B514D" />
              <Text style={styles.categoryText}>{t(category.titleKey)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.featureBand}>
          <View style={styles.featureTextBlock}>
            <Text style={styles.featureTitle}>{t('shopFeatureTitle')}</Text>
            <Text style={styles.featureText}>{t('shopFeatureText')}</Text>
          </View>
          <View style={styles.featurePreview}>
            <View style={[styles.previewPage, { backgroundColor: '#FFF6D9' }]}>
              <View style={styles.previewLine} />
              <View style={[styles.previewLine, styles.previewLineShort]} />
              <View style={styles.previewSticker}>
                <Ionicons name="heart" size={13} color="#C05A67" />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('shopShelfTitle')}</Text>
          <Text style={styles.sectionMeta}>
            {t('shopSupplyCount', { count: visiblePacks.length })}
          </Text>
        </View>

        {visiblePacks.length > 0 ? (
          <View style={styles.packGrid}>
            {visiblePacks.map((pack) => (
              <View
                key={pack.id}
                style={[
                  styles.packCard,
                  selectedPackId === pack.id ? styles.packCardSelected : null,
                  {
                    backgroundColor: colorTheme.cardBackground,
                    borderColor: colorTheme.border,
                  },
                ]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: selectedPackId === pack.id }}
                  onPress={() =>
                    setSelectedPackId((current) => (current === pack.id ? null : pack.id))
                  }
                  style={styles.packSummary}>
                  <View style={styles.packTopRow}>
                    {pack.previewImage ? (
                      <View style={styles.packImagePreview}>
                        <Image
                          source={pack.previewImage}
                          resizeMode="contain"
                          style={styles.packPreviewImage}
                        />
                      </View>
                    ) : (
                      <View style={styles.packIconShell}>
                        <Ionicons name={pack.icon} size={22} color="#5B514D" />
                      </View>
                    )}
                    <Text style={styles.packTag}>
                      {getPackStatusLabel(pack)}
                    </Text>
                  </View>

                  <View style={styles.swatchRow}>
                    {pack.colors.map((color) => (
                      <View
                        key={`${pack.id}-${color}`}
                        style={[styles.swatch, { backgroundColor: color }]}
                      />
                    ))}
                  </View>

                  <Text style={styles.packCategory}>
                    {packCategoryLabels[pack.categoryKey as keyof typeof packCategoryLabels] ??
                      pack.category}
                  </Text>
                  <Text style={styles.packTitle}>{localizeShopText(pack.title)}</Text>
                  <Text style={styles.packSubtitle}>{localizeShopText(pack.subtitle)}</Text>

                  <View style={styles.packActionRow}>
                    <Text style={styles.previewAction}>
                      {pack.id === selectedPackId
                        ? t('shopSelected')
                        : (pack.status === 'included' || ownedPackIds.has(pack.id)) && pack.backgrounds
                          ? t('shopViewBackgrounds')
                          : (pack.status === 'included' || ownedPackIds.has(pack.id)) && pack.stickers
                            ? t('shopViewStickers')
                            : pack.status === 'included' || ownedPackIds.has(pack.id)
                              ? t('shopViewPreview')
                              : getPackPurchaseLabel(pack)}
                    </Text>
                    <Ionicons
                      name={pack.id === selectedPackId ? 'chevron-down' : 'chevron-forward'}
                      size={16}
                      color="#8A7F76"
                    />
                  </View>
                </Pressable>
                {pack.id === selectedPackId ? renderPackExpandedDetail(pack) : null}
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.placeholderDetail,
              styles.packGridEmptyState,
              {
                backgroundColor: colorTheme.cardBackground,
                borderColor: colorTheme.border,
              },
            ]}>
            <Ionicons name="sparkles-outline" size={26} color="#5B514D" />
            <Text style={styles.emptyGridTitle}>{t('shopEmptyTitle')}</Text>
            <Text style={styles.placeholderDetailText}>
              {t('shopEmptyText')}
            </Text>
          </View>
        )}
      </ScrollView>
    </FocusedScreenView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 28 : 72,
    paddingBottom: Platform.OS === 'web' ? 120 : 130,
  },
  tabletContent: {
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconImage: {
    width: 26,
    height: 26,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7A6F66',
    marginTop: 6,
    maxWidth: 260,
  },
  shelfBadge: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EDE8',
  },
  restoreButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restoreButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B514D',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 18,
    gap: 10,
  },
  categoryChip: {
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  categoryChipActive: {
    borderColor: '#C88C93',
    backgroundColor: '#FFF6FA',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A403C',
  },
  featureBand: {
    minHeight: 136,
    borderRadius: 8,
    backgroundColor: '#F8EDEF',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  featureTextBlock: {
    flex: 1,
    paddingRight: 14,
  },
  featureTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  featureText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#7A6F66',
    marginTop: 6,
  },
  featurePreview: {
    width: 92,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPage: {
    width: 74,
    height: 92,
    borderRadius: 8,
    padding: 11,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  previewLine: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D8CFC4',
    marginBottom: 9,
  },
  previewLineShort: {
    width: '68%',
  },
  previewSticker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginLeft: 28,
  },
  packDetailInline: {
    borderTopWidth: 1,
    borderTopColor: '#EFE6DD',
    marginTop: 14,
    paddingTop: 14,
  },
  addButton: {
    minHeight: 44,
    borderRadius: 22,
    marginTop: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.65,
  },
  addButtonText: {
    color: '#FFFDF9',
    fontSize: 14,
    fontWeight: '700',
  },
  shopMessage: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#F8EDEF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    color: '#7A4F58',
  },
  stickerPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  stickerPreviewCard: {
    width: 112,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE6DD',
    backgroundColor: '#FFFDF9',
    padding: 8,
  },
  stickerPreviewImage: {
    width: '100%',
    height: 82,
  },
  stickerPreviewName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B514D',
    marginTop: 6,
    textAlign: 'center',
  },
  noteStylePreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  noteStylePreviewCard: {
    width: 96,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  noteStylePreviewName: {
    fontSize: 12,
    fontWeight: '700',
  },
  noteStylePreviewSample: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  backgroundPreviewScroll: {
    marginTop: 16,
    maxWidth: '100%',
  },
  backgroundPreviewRow: {
    gap: 10,
    paddingRight: 4,
  },
  backgroundPreviewCard: {
    width: 108,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFE6DD',
    backgroundColor: '#FFFDF9',
    padding: 7,
    overflow: 'hidden',
  },
  backgroundPreviewImage: {
    width: 92,
    height: 62,
    borderRadius: 6,
    overflow: 'hidden',
  },
  backgroundPreviewName: {
    minHeight: 28,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#5B514D',
    marginTop: 6,
    textAlign: 'center',
  },
  placeholderDetail: {
    minHeight: 92,
    borderRadius: 8,
    backgroundColor: '#FFFDF9',
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packGridEmptyState: {
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  emptyGridTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5B514D',
    marginTop: 8,
  },
  placeholderDetailText: {
    fontSize: 13,
    color: '#7A6F66',
    marginTop: 8,
  },
  testPackNote: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7A6F66',
    marginTop: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  sectionMeta: {
    fontSize: 13,
    color: '#8A7F76',
  },
  packGrid: {
    gap: 12,
  },
  packCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  packSummary: {
    width: '100%',
  },
  packCardSelected: {
    borderColor: '#C88C93',
  },
  packTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packIconShell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3EDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packImagePreview: {
    width: 74,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFE6DD',
  },
  packPreviewImage: {
    width: '100%',
    height: '100%',
  },
  packTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A4C56',
  },
  swatchRow: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 12,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginRight: -5,
  },
  packCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A7F76',
    marginBottom: 5,
  },
  packTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  packSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#7A6F66',
    marginTop: 6,
  },
  packActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  previewAction: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5B514D',
  },
});
