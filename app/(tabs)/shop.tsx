import { Ionicons } from '@expo/vector-icons';
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
import { useState } from 'react';

import { useAppSettings } from '@/utils/app-settings';
import {
  SHOP_BACKGROUND_PACKS,
  type ShopBackground,
} from '@/utils/shop-backgrounds';
import { SHOP_STICKER_PACKS, type ShopSticker } from '@/utils/shop-stickers';

const SHOP_TAB_ICON = require('../../assets/images/toolbar-icons/shop-tab.png');

type ShopCategory = {
  key: string;
  title: string;
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
  price?: string;
  productId?: string;
  previewImage?: ImageSourcePropType;
  stickers?: ShopSticker[];
  backgrounds?: ShopBackground[];
};

const CATEGORIES: ShopCategory[] = [
  { key: 'all', title: 'All', icon: 'storefront-outline' },
  { key: 'backgrounds', title: 'Canvas', icon: 'image-outline' },
  { key: 'themes', title: 'Themes', icon: 'color-palette-outline' },
  { key: 'decor', title: 'Decor', icon: 'sparkles-outline' },
  { key: 'stickers', title: 'Stickers', icon: 'pricetags-outline' },
  { key: 'tools', title: 'Tools', icon: 'brush-outline' },
];

const PACKS: ShopPack[] = [
  {
    ...SHOP_BACKGROUND_PACKS[0],
    categoryKey: 'backgrounds',
    colors: ['#F7F4EE', '#F2CFCB', '#CDB5EF'],
    icon: 'image-outline',
    previewImage: SHOP_BACKGROUND_PACKS[0].backgrounds[0].image,
  },
  {
    ...SHOP_STICKER_PACKS[0],
    categoryKey: 'stickers',
    colors: ['#F4D6CE', '#DDE5CF', '#F9F7EC'],
    icon: 'flower-outline',
    previewImage: SHOP_STICKER_PACKS[0].stickers[0].image,
  },
  {
    ...SHOP_STICKER_PACKS[1],
    categoryKey: 'stickers',
    colors: ['#E8D4A8', '#F7EBC8', '#2F2C28'],
    icon: 'pricetag-outline',
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
    tag: 'Best Value',
    price: '$2.99',
    productId: 'cozy_canvas_kit',
  },
  {
    id: 'quiet-mornings',
    title: 'Quiet Mornings',
    subtitle: 'Soft paper, sunrise washes, and peaceful note pages',
    categoryKey: 'themes',
    category: 'Themes',
    colors: ['#FFF6D9', '#F9D7E5', '#DDEBFF'],
    icon: 'sunny-outline',
    tag: 'Starter',
    price: '$1.99',
    productId: 'quiet_mornings_theme',
  },
  {
    id: 'sunday-table',
    title: 'Sunday Table',
    subtitle: 'A coordinated theme with cream paper, sage tabs, and blush accents',
    categoryKey: 'themes',
    category: 'Themes',
    colors: ['#FFF8EA', '#BFD5C7', '#E9A9B5'],
    icon: 'color-palette-outline',
    tag: 'New',
    price: '$2.49',
    productId: 'sunday_table_theme',
  },
  {
    id: 'faith-notes',
    title: 'Faith Notes',
    subtitle: 'Tiny crosses, hearts, stars, tabs, and page markers',
    categoryKey: 'decor',
    category: 'Decor',
    colors: ['#F7C9D4', '#D9F4E6', '#F6E8A9'],
    icon: 'sparkles-outline',
    tag: 'New',
    price: '$1.99',
    productId: 'faith_notes_decor',
  },
  {
    id: 'soft-ribbons',
    title: 'Soft Ribbons',
    subtitle: 'Decor strips, washi corners, divider bows, and sweet page labels',
    categoryKey: 'decor',
    category: 'Decor',
    colors: ['#E7B7C7', '#DDD6F8', '#F8D7C5'],
    icon: 'ribbon-outline',
    tag: 'Decor',
    price: '$1.49',
    productId: 'soft_ribbons_decor',
  },
  {
    id: 'gentle-highlighters',
    title: 'Gentle Highlighters',
    subtitle: 'Pastel highlight strips for marking favorite words',
    categoryKey: 'tools',
    category: 'Tools',
    colors: ['#FFF3A3', '#FFD2E1', '#CFE7FF'],
    icon: 'color-filter-outline',
    tag: 'Studio',
    price: '$0.99',
    productId: 'gentle_highlighters',
  },
  {
    id: 'journal-pens',
    title: 'Journal Pens',
    subtitle: 'Pretty pen styles for prayers, notes, and verse art',
    categoryKey: 'tools',
    category: 'Tools',
    colors: ['#5B514D', '#9A4C56', '#6D8B74'],
    icon: 'brush-outline',
    tag: 'Soon',
    price: '$1.99',
    productId: 'journal_pens',
  },
  {
    id: 'marketplace-starter-bundle',
    title: 'Starter Bundle',
    subtitle: 'A little bit of everything: canvas pages, decor, labels, and tools',
    categoryKey: 'all',
    category: 'Bundle',
    colors: ['#FCEEF3', '#EEF9F3', '#F4F1FF'],
    icon: 'bag-handle-outline',
    tag: 'Bundle',
    price: '$4.99',
    productId: 'marketplace_starter_bundle',
  },
];

export default function ShopScreen() {
  const { colorTheme, t } = useAppSettings();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPackId, setSelectedPackId] = useState(PACKS[0].id);
  const [cartCount, setCartCount] = useState(0);
  const selectedPack = PACKS.find((pack) => pack.id === selectedPackId) ?? PACKS[0];
  const visiblePacks = PACKS.filter(
    (pack) => selectedCategory === 'all' || pack.categoryKey === selectedCategory
  );

  const selectCategory = (categoryKey: string) => {
    setSelectedCategory(categoryKey);
    const nextPack =
      PACKS.find((pack) => categoryKey === 'all' || pack.categoryKey === categoryKey) ?? PACKS[0];
    setSelectedPackId(nextPack.id);
  };

  return (
    <View style={[styles.container, { backgroundColor: colorTheme.screenBackground }]}>
      <ScrollView
        contentContainerStyle={styles.content}
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
          <View style={[styles.cartBadge, { backgroundColor: colorTheme.toolbarBackground }]}>
            <Ionicons name="cart-outline" size={22} color="#5B514D" />
            {cartCount > 0 ? (
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountText}>{cartCount}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((category) => (
            <Pressable
              key={category.key}
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
              <Text style={styles.categoryText}>{category.title}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.featureBand}>
          <View style={styles.featureTextBlock}>
            <Text style={styles.featureTitle}>Canvas marketplace</Text>
            <Text style={styles.featureText}>
              Shop backgrounds, themes, decor, stickers, and creative tools for your journal pages.
            </Text>
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
                {selectedPack.category}
              </Text>
              <Text
                maxFontSizeMultiplier={1.15}
                numberOfLines={2}
                adjustsFontSizeToFit
                style={styles.packDetailTitle}>
                {selectedPack.title}
              </Text>
              <Text maxFontSizeMultiplier={1.15} style={styles.packDetailText}>
                {selectedPack.subtitle}
              </Text>
            </View>
            <View style={styles.testPill}>
              <Text maxFontSizeMultiplier={1.1} style={styles.testPillText}>
                {selectedPack.price ?? t('shopPreview')}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => setCartCount((count) => count + 1)}
            style={[styles.addButton, { backgroundColor: colorTheme.tint }]}>
            <Ionicons name="bag-add-outline" size={17} color="#FFFDF9" />
            <Text style={styles.addButtonText}>
              {selectedPack.price === 'Free test' ? 'Unlock pack' : 'Add to cart'}
            </Text>
          </Pressable>

          {selectedPack.stickers ? (
            <View style={styles.stickerPreviewGrid}>
              {selectedPack.stickers.map((sticker) => (
                <View key={sticker.key} style={styles.stickerPreviewCard}>
                  <Image
                    source={sticker.previewImage ?? sticker.image}
                    resizeMode="contain"
                    style={styles.stickerPreviewImage}
                  />
                  <Text style={styles.stickerPreviewName}>{sticker.name}</Text>
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
                    {background.name}
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

          {selectedPack.id === 'floral-faith-stickers' ? (
            <Text style={styles.testPackNote}>
              Test pack is unlocked in Studio and Prayer Journal stickers.
            </Text>
          ) : null}
          {selectedPack.id === 'scripture-verse-label-stickers' ? (
            <Text style={styles.testPackNote}>
              Test unlocked now for Studio and Prayer Journal; this pack is priced for purchase at
              launch.
            </Text>
          ) : null}
          {selectedPack.id === 'soft-glitter-backgrounds' ? (
            <Text style={styles.testPackNote}>
              Test unlocked now for Studio and Prayer Journal backgrounds.
            </Text>
          ) : null}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Marketplace</Text>
          <Text style={styles.sectionMeta}>{visiblePacks.length} supplies</Text>
        </View>

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
                <Text style={styles.packTag}>{pack.tag}</Text>
              </View>

              <View style={styles.swatchRow}>
                {pack.colors.map((color) => (
                  <View
                    key={`${pack.id}-${color}`}
                    style={[styles.swatch, { backgroundColor: color }]}
                  />
                ))}
              </View>

              <Text style={styles.packCategory}>{pack.category}</Text>
              <Text style={styles.packTitle}>{pack.title}</Text>
              <Text style={styles.packSubtitle}>{pack.subtitle}</Text>

              <View style={styles.packActionRow}>
                <Text style={styles.previewAction}>
                  {(pack.stickers || pack.backgrounds) && pack.price === 'Free test'
                    ? pack.backgrounds
                      ? t('shopViewBackgrounds')
                      : t('shopViewStickers')
                    : pack.price
                      ? t('shopBuyLabel', { price: pack.price })
                      : t('shopPreview')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#8A7F76" />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
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
    paddingBottom: Platform.OS === 'web' ? 48 : 130,
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
  cartBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EDE8',
  },
  cartCountBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#C88C93',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  cartCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFDF9',
  },
  categoryRow: {
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
