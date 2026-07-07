import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
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
    | 'shopCategoryTools';
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
  status: 'included' | 'preview';
  previewImage?: ImageSourcePropType;
  stickers?: ShopSticker[];
  backgrounds?: ShopBackground[];
};

const CATEGORIES: ShopCategory[] = [
  { key: 'all', titleKey: 'shopCategoryAll', icon: 'storefront-outline' },
  { key: 'backgrounds', titleKey: 'shopCategoryCanvas', icon: 'image-outline' },
  { key: 'themes', titleKey: 'shopCategoryThemes', icon: 'color-palette-outline' },
  { key: 'decor', titleKey: 'shopCategoryDecor', icon: 'sparkles-outline' },
  { key: 'stickers', titleKey: 'shopCategoryStickers', icon: 'pricetags-outline' },
  { key: 'tools', titleKey: 'shopCategoryTools', icon: 'brush-outline' },
];

const PACKS: ShopPack[] = [
  {
    ...SHOP_BACKGROUND_PACKS[0],
    categoryKey: 'backgrounds',
    colors: ['#F7F4EE', '#F2CFCB', '#CDB5EF'],
    icon: 'image-outline',
    status: 'included',
    previewImage: SHOP_BACKGROUND_PACKS[0].backgrounds[0].image,
  },
  {
    ...SHOP_STICKER_PACKS[0],
    categoryKey: 'stickers',
    colors: ['#F4D6CE', '#DDE5CF', '#F9F7EC'],
    icon: 'flower-outline',
    status: 'included',
    previewImage: SHOP_STICKER_PACKS[0].stickers[0].image,
  },
  {
    ...SHOP_STICKER_PACKS[1],
    categoryKey: 'stickers',
    colors: ['#E8D4A8', '#F7EBC8', '#2F2C28'],
    icon: 'pricetag-outline',
    status: 'included',
    previewImage: SHOP_STICKER_PACKS[1].stickers[0].image,
  },
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
  {
    id: 'quiet-mornings',
    title: 'Quiet Mornings',
    subtitle: 'Soft paper, sunrise washes, and peaceful note pages',
    categoryKey: 'themes',
    category: 'Themes',
    colors: ['#FFF6D9', '#F9D7E5', '#DDEBFF'],
    icon: 'sunny-outline',
    tag: 'Preview',
    status: 'preview',
  },
  {
    id: 'sunday-table',
    title: 'Sunday Table',
    subtitle: 'A coordinated theme with cream paper, sage tabs, and blush accents',
    categoryKey: 'themes',
    category: 'Themes',
    colors: ['#FFF8EA', '#BFD5C7', '#E9A9B5'],
    icon: 'color-palette-outline',
    tag: 'Preview',
    status: 'preview',
  },
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
  '10 shimmering paper backgrounds for Studio and journals': {
    es: '10 fondos de papel brillante para Estudio y diarios',
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
  const { colorTheme, language, t } = useAppSettings();
  const layout = useResponsiveLayout();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPackId, setSelectedPackId] = useState(PACKS[0].id);
  const [ownedPackIds, setOwnedPackIds] = useState<Set<string>>(() => new Set());
  const [shopMessage, setShopMessage] = useState('');
  const selectedPack = PACKS.find((pack) => pack.id === selectedPackId) ?? PACKS[0];
  const isSelectedPackIncluded = selectedPack.status === 'included';
  const isSelectedPackOwned = ownedPackIds.has(selectedPack.id);
  const isSelectedPackAvailable = isSelectedPackIncluded || isSelectedPackOwned;
  const selectedPackHasUsableAssets = Boolean(selectedPack.stickers || selectedPack.backgrounds);
  const packCategoryLabels = {
    all: t('shopCategoryBundle'),
    backgrounds: t('shopCategoryCanvas'),
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

  useEffect(() => {
    setShopMessage('');
  }, [selectedPackId]);

  const getPackStatusLabel = (pack: ShopPack) => {
    if (pack.status === 'included') {
      return t('shopIncluded');
    }

    if (ownedPackIds.has(pack.id)) {
      return t('shopOwned');
    }

    return t('shopUnlock');
  };

  const selectCategory = (categoryKey: string) => {
    setSelectedCategory(categoryKey);
    const nextPack =
      PACKS.find((pack) => categoryKey === 'all' || pack.categoryKey === categoryKey) ?? PACKS[0];
    setSelectedPackId(nextPack.id);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    });
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      getOwnedShopPackIds()
        .then((nextOwnedPackIds) => {
          if (isActive) {
            setOwnedPackIds(nextOwnedPackIds);
          }
        })
        .catch((error) => {
          console.warn('Failed to load owned shop packs', error);
        });

      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const handlePrimaryPackAction = async () => {
    if (!isSelectedPackAvailable) {
      setShopMessage(t('shopPurchaseNotConnected'));
      return;
    }

    if (selectedPackHasUsableAssets) {
      router.push({
        pathname: '/studio',
        params: {
          openToolbar: selectedPack.backgrounds ? 'backgrounds' : 'stickers',
          selectionToken: String(Date.now()),
        },
      });
      return;
    }

    setShopMessage(t('shopPreviewSavedToolsPending'));
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
            <Ionicons name="sparkles-outline" size={22} color="#5B514D" />
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

        <View
          style={[
            styles.packDetail,
            {
              backgroundColor: colorTheme.cardBackground,
              borderColor: colorTheme.border,
            },
          ]}>
          <View style={styles.packDetailHeader}>
            <View style={styles.packDetailTitleBlock}>
              <Text maxFontSizeMultiplier={1.15} style={styles.packDetailCategory}>
                {packCategoryLabels[
                  selectedPack.categoryKey as keyof typeof packCategoryLabels
                ] ?? selectedPack.category}
              </Text>
              <Text
                maxFontSizeMultiplier={1.15}
                numberOfLines={2}
                adjustsFontSizeToFit
                style={styles.packDetailTitle}>
                {localizeShopText(selectedPack.title)}
              </Text>
              <Text maxFontSizeMultiplier={1.15} style={styles.packDetailText}>
                {localizeShopText(selectedPack.subtitle)}
              </Text>
            </View>
            <View style={styles.testPill}>
              <Text maxFontSizeMultiplier={1.1} style={styles.testPillText}>
                {isSelectedPackIncluded
                  ? t('shopIncluded')
                  : isSelectedPackOwned
                    ? t('shopOwned')
                    : t('shopLocked')}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isSelectedPackAvailable
                ? selectedPackHasUsableAssets
                  ? `${t('shopUseInStudio')}: ${localizeShopText(selectedPack.title)}`
                  : `${t('shopViewPreview')}: ${localizeShopText(selectedPack.title)}`
                : `${t('shopUnlock')}: ${localizeShopText(selectedPack.title)}`
            }
            onPress={handlePrimaryPackAction}
            style={[styles.addButton, { backgroundColor: colorTheme.tint }]}>
            <Ionicons
              name={
                isSelectedPackAvailable
                  ? selectedPackHasUsableAssets
                    ? 'brush-outline'
                    : 'checkmark-circle-outline'
                  : 'lock-open-outline'
              }
              size={17}
              color="#FFFDF9"
            />
            <Text style={styles.addButtonText}>
              {isSelectedPackAvailable
                ? selectedPackHasUsableAssets
                  ? t('shopUseInStudio')
                  : t('shopSavedPreview')
                : t('shopUnlock')}
            </Text>
          </Pressable>
          {shopMessage ? <Text style={styles.shopMessage}>{shopMessage}</Text> : null}

          {selectedPack.stickers ? (
            <View style={styles.stickerPreviewGrid}>
              {selectedPack.stickers.map((sticker) => (
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
          ) : selectedPack.backgrounds ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.backgroundPreviewScroll}
              contentContainerStyle={styles.backgroundPreviewRow}>
              {selectedPack.backgrounds.map((background) => (
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
          ) : (
            <View style={styles.placeholderDetail}>
              <Ionicons name={selectedPack.icon} size={26} color="#5B514D" />
              <Text style={styles.placeholderDetailText}>{t('shopPackPreviewSoon')}</Text>
            </View>
          )}

          <Text style={styles.testPackNote}>
            {isSelectedPackAvailable
              ? selectedPackHasUsableAssets
                ? t('shopIncludedNote')
                : t('shopPreviewLocalShelf')
              : t('shopUnlockParentApproval')}
          </Text>
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
              <Pressable
                key={pack.id}
                onPress={() => setSelectedPackId(pack.id)}
                style={[
                  styles.packCard,
                  selectedPackId === pack.id ? styles.packCardSelected : null,
                  {
                    backgroundColor: colorTheme.cardBackground,
                    borderColor: colorTheme.border,
                  },
                ]}>
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
                            : t('shopUnlock')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#8A7F76" />
                </View>
              </Pressable>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EDE8',
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
  packDetail: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 22,
    backgroundColor: '#FFFFFF',
  },
  packDetailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  packDetailTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  packDetailCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A7F76',
    marginBottom: 4,
  },
  packDetailTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  packDetailText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#7A6F66',
    marginTop: 6,
  },
  testPill: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8EDEF',
    flexShrink: 0,
  },
  testPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A4C56',
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
