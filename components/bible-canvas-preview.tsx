import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getShopBackground } from '@/utils/shop-backgrounds';
import { getShopSticker, getShopStickerDisplaySize } from '@/utils/shop-stickers';
import type { HighlightColor } from '@/utils/verse-storage';
import type { VerseDesignListItem } from '@/utils/verse-design-list';

const STAGE_WIDTH = 340;
const CROP_PADDING = 16;
const MIN_CROP_HEIGHT = 120;
const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: '#FFF3A3',
  pink: '#FFD2E1',
  blue: '#CFE7FF',
};
const CARD_COLORS: Record<string, { backgroundColor: string; borderColor: string }> = {
  'paper-white': { backgroundColor: '#FFFFFF', borderColor: '#E7DDD5' },
  'paper-cream': { backgroundColor: '#FFFDF8', borderColor: '#E8DCD4' },
  'paper-blush': { backgroundColor: '#FFF1F5', borderColor: '#E7B7C7' },
  'paper-lavender': { backgroundColor: '#F5F0FF', borderColor: '#C8C0EF' },
  'paper-sky': { backgroundColor: '#F0F7FF', borderColor: '#BDD5ED' },
  'paper-mint': { backgroundColor: '#F1FBF6', borderColor: '#B8DAC7' },
  'paper-clear': { backgroundColor: 'rgba(255,255,255,0.68)', borderColor: '#D7CCC5' },
  'paper-transparent': { backgroundColor: 'transparent', borderColor: 'transparent' },
};
const NOTE_COLORS: Record<string, { backgroundColor: string; borderColor: string; color: string }> = {
  butter: { backgroundColor: '#FFF8DC', borderColor: '#D8C9A3', color: '#4D433D' },
  rose: { backgroundColor: '#FFE9EE', borderColor: '#E3B8C2', color: '#4A343A' },
  sage: { backgroundColor: '#ECF5E8', borderColor: '#B9CEB0', color: '#344437' },
  sky: { backgroundColor: '#EAF3FF', borderColor: '#B8CBE5', color: '#303C4F' },
  linen: { backgroundColor: '#FFFDF9', borderColor: '#DCCFC5', color: '#3A302B' },
  peach: { backgroundColor: '#FFE4D4', borderColor: '#E8B89A', color: '#4A342C' },
  coral: { backgroundColor: '#FFD9D6', borderColor: '#E5A8A3', color: '#4A3030' },
  honey: { backgroundColor: '#FFF0C8', borderColor: '#E0C57A', color: '#4A3F28' },
  mint: { backgroundColor: '#DFF5EE', borderColor: '#A5D4C4', color: '#2F433C' },
  seafoam: { backgroundColor: '#D9F2F0', borderColor: '#9DCEC9', color: '#2C4241' },
  cocoa: { backgroundColor: '#F3E6DA', borderColor: '#D0B49A', color: '#3F3228' },
  blush: { backgroundColor: '#FCE4EC', borderColor: '#E5B0C0', color: '#4A3038' },
  dusk: { backgroundColor: '#E8EDF7', borderColor: '#B4BED6', color: '#303848' },
};

function getContentBounds(design: VerseDesignListItem) {
  const boxes = [
    ...design.verseCards.map((card) => ({
      left: card.x,
      top: card.y,
      right: card.x + (card.width ?? 292) * card.scale,
      bottom: card.y + (card.height ?? 180) * card.scale,
    })),
    ...design.notes.map((note) => ({
      left: note.x,
      top: note.y,
      right: note.x + note.width,
      bottom: note.y + note.height,
    })),
    ...design.stickers.map((sticker) => {
      const shopSticker = getShopSticker(sticker.imageKey);
      const visibleSize = shopSticker
        ? getShopStickerDisplaySize(shopSticker, 96)
        : { width: 62, height: 62 };
      const centerX = sticker.x + 48;
      const centerY = sticker.y + 48;
      const visibleWidth = visibleSize.width * sticker.scale;
      const visibleHeight = visibleSize.height * sticker.scale;

      return {
        left: centerX - visibleWidth / 2,
        top: centerY - visibleHeight / 2,
        right: centerX + visibleWidth / 2,
        bottom: centerY + visibleHeight / 2,
      };
    }),
    ...design.drawingStrokes.flatMap((stroke) =>
      stroke.points.map((point) => ({
        left: point.x - stroke.width,
        top: point.y - stroke.width,
        right: point.x + stroke.width,
        bottom: point.y + stroke.width,
      }))
    ),
  ];

  if (boxes.length === 0) {
    return { left: 0, top: 0, right: STAGE_WIDTH, bottom: 240 };
  }

  return {
    left: Math.max(0, Math.min(...boxes.map((box) => box.left)) - CROP_PADDING),
    top: Math.max(0, Math.min(...boxes.map((box) => box.top)) - CROP_PADDING),
    right: Math.min(STAGE_WIDTH, Math.max(...boxes.map((box) => box.right)) + CROP_PADDING),
    bottom: Math.max(...boxes.map((box) => box.bottom)) + CROP_PADDING,
  };
}

export function BibleCanvasPreview({ design }: { design: VerseDesignListItem }) {
  const [availableWidth, setAvailableWidth] = useState(STAGE_WIDTH);
  const bounds = useMemo(() => getContentBounds(design), [design]);
  const cropWidth = Math.max(1, bounds.right - bounds.left);
  const cropHeight = Math.max(MIN_CROP_HEIGHT, bounds.bottom - bounds.top);
  const stageHeight = Math.max(bounds.bottom, cropHeight);
  const scale = Math.min(1, availableWidth / cropWidth);
  const background = getShopBackground(design.backgroundKey);
  const fontFamily = design.selectedFont === 'Playwrite' ? 'Playwrite' : design.selectedFont === 'serif' ? 'serif' : undefined;

  return (
    <View
      accessibilityLabel="Your decorated Bible canvas"
      style={[styles.preview, { height: cropHeight * scale }]}
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}>
      <View
        pointerEvents="none"
        style={[
          styles.stage,
          {
            height: stageHeight,
            left: -bounds.left * scale,
            top: -bounds.top * scale,
            transformOrigin: 'top left',
            transform: [{ scale }],
          },
        ]}>
        {background ? <Image source={background.image} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
        {!background ? (
          <View style={StyleSheet.absoluteFill}>
            {Array.from({ length: Math.ceil(stageHeight / 52) }).map((_, index) => (
              <View key={index} style={[styles.paperLine, { top: 28 + index * 52 }]} />
            ))}
          </View>
        ) : null}

        {design.drawingStrokes.flatMap((stroke) => {
          if (stroke.points.length === 1) {
            const point = stroke.points[0];
            return point ? [<View key={`${stroke.id}-dot`} style={[styles.stroke, { left: point.x - stroke.width / 2, top: point.y - stroke.width / 2, width: stroke.width, height: stroke.width, borderRadius: stroke.width / 2, backgroundColor: stroke.color }]} />] : [];
          }
          return stroke.points.slice(1).map((point, index) => {
            const previous = stroke.points[index];
            if (!previous) return null;
            const dx = point.x - previous.x;
            const dy = point.y - previous.y;
            const length = Math.hypot(dx, dy);
            return <View key={`${stroke.id}-${index}`} style={[styles.stroke, { left: (previous.x + point.x) / 2 - length / 2, top: (previous.y + point.y) / 2 - stroke.width / 2, width: length, height: stroke.width, borderRadius: stroke.width / 2, backgroundColor: stroke.color, transform: [{ rotateZ: `${Math.atan2(dy, dx)}rad` }] }]} />;
          });
        })}

        {design.verseCards.map((card) => {
          const colors = CARD_COLORS[card.cardColorKey ?? 'paper-cream'] ?? CARD_COLORS['paper-cream'];
          const words = card.text.split(' ').filter(Boolean);
          const referenceDisplay = card.referenceDisplay ?? 'number';
          const referenceLabel =
            referenceDisplay === 'none'
              ? null
              : referenceDisplay === 'full'
                ? `${design.book} ${design.chapter}:${card.verse}`
                : `VERSE ${card.verse}`;
          return (
            <View key={card.id} style={[styles.verseCard, colors, card.cardColorKey === 'paper-transparent' ? styles.transparentVerseCard : null, { left: card.x, top: card.y, width: card.width ?? 292, minHeight: card.height ?? 112, zIndex: card.zIndex, transform: [{ scale: card.scale }, { rotateZ: `${card.rotation}deg` }] }]}>
              {referenceLabel ? <Text style={styles.verseNumber}>{referenceLabel}</Text> : null}
              <Text style={[styles.verseText, { fontFamily, fontSize: design.fontSize, lineHeight: Math.round(design.fontSize * 1.42) }]}>
                {words.map((word, index) => <Text key={`${word}-${index}`} style={design.highlights[`${card.verse}-${index}`] ? { backgroundColor: HIGHLIGHT_COLORS[design.highlights[`${card.verse}-${index}`]] } : undefined}>{word}{index < words.length - 1 ? ' ' : ''}</Text>)}
              </Text>
            </View>
          );
        })}

        {design.notes.map((note) => {
          const colors = NOTE_COLORS[note.styleKey ?? 'butter'] ?? NOTE_COLORS.butter;
          return <View key={note.id} style={[styles.note, colors, { left: note.x, top: note.y, width: note.width, height: note.height, zIndex: note.zIndex, transform: [{ rotateZ: `${note.rotation ?? 0}deg` }] }]}>{note.label ? <Text style={[styles.noteLabel, { color: colors.color }]}>{note.label}</Text> : null}<Text numberOfLines={7} style={[styles.noteText, { color: colors.color }]}>{note.text || note.placeholder || ''}</Text></View>;
        })}

        {design.stickers.map((sticker) => {
          const shopSticker = getShopSticker(sticker.imageKey);
          const size = shopSticker ? getShopStickerDisplaySize(shopSticker, 96) : null;
          return <View key={sticker.id} style={[styles.sticker, { left: sticker.x, top: sticker.y, zIndex: sticker.zIndex, transform: [{ scale: sticker.scale }, { rotateZ: `${sticker.rotation ?? 0}deg` }] }]}>{shopSticker && size ? <Image source={shopSticker.image} resizeMode="contain" style={size} /> : <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>}</View>;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', overflow: 'hidden', borderRadius: 16, backgroundColor: '#FCFAF6' },
  stage: { position: 'absolute', width: STAGE_WIDTH, overflow: 'hidden', backgroundColor: '#FCFAF6' },
  paperLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(207,187,175,0.72)' },
  stroke: { position: 'absolute', zIndex: 18 },
  verseCard: { position: 'absolute', borderWidth: 1, borderRadius: 20, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 14, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  transparentVerseCard: { borderWidth: 0, borderColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  verseNumber: { color: '#8D7C70', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 },
  verseText: { color: '#342E2A' },
  note: { position: 'absolute', borderWidth: 1, borderRadius: 16, padding: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  noteLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 },
  noteText: { fontSize: 14, lineHeight: 20 },
  sticker: { position: 'absolute', width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  stickerEmoji: { fontSize: 58 },
});
