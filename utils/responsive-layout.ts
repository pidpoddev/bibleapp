import { Platform, useWindowDimensions } from 'react-native';

const TABLET_MIN_SHORT_SIDE = 768;

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const isTablet = shortSide >= TABLET_MIN_SHORT_SIDE;
  const tabletScale = isTablet ? (shortSide >= 1000 ? 1.28 : 1.18) : 1;

  return {
    width,
    height,
    shortSide,
    longSide,
    isTablet,
    isLandscape: width > height,
    contentMaxWidth: isTablet ? 1180 : undefined,
    readingMaxWidth: isTablet ? 760 : undefined,
    settingsMaxWidth: isTablet ? 980 : undefined,
    studioMaxWidth: isTablet ? 1280 : undefined,
    pagePaddingHorizontal: isTablet ? 24 : 18,
    isNativeTablet: isTablet && Platform.OS !== 'web',
    tabletScale,
  };
}
