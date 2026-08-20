import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { LogBox, Platform } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppSettingsProvider, useAppSettings } from '@/utils/app-settings';
import { DEV_SCREENSHOT_ROUTE } from '@/utils/dev-screenshot-route';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppSettingsProvider>
        <RootNavigator />
      </AppSettingsProvider>
    </GestureHandlerRootView>
  );
}

function ScreenshotRouteSync() {
  const router = useRouter();

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    LogBox.ignoreAllLogs(Boolean(DEV_SCREENSHOT_ROUTE));

    if (!DEV_SCREENSHOT_ROUTE) {
      return;
    }

    const timer = setTimeout(() => {
      router.replace(DEV_SCREENSHOT_ROUTE as never);
    }, 400);

    return () => clearTimeout(timer);
  }, [DEV_SCREENSHOT_ROUTE, router]);

  return null;
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { colorTheme, t } = useAppSettings();

  const navigationTheme = useMemo(() => {
    const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: colorTheme.screenBackground,
        card: colorTheme.screenBackground,
        primary: colorTheme.tint,
        border: colorTheme.border,
      },
    };
  }, [colorScheme, colorTheme.border, colorTheme.screenBackground, colorTheme.tint]);

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colorTheme.screenBackground },
          headerBackTitle: 'Back',
          headerTintColor: '#5B514D',
          headerTitleStyle: { color: '#1F1F1F', fontWeight: '700' },
          headerStyle: { backgroundColor: colorTheme.screenBackground },
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="bible-books" options={{ title: t('tabBible') }} />
        <Stack.Screen name="breathe" options={{ title: t('breatheTitle') }} />
        <Stack.Screen name="bible-study-journal" options={{ title: t('bibleStudy') }} />
        <Stack.Screen name="church-day-journal" options={{ title: t('churchDay') }} />
        <Stack.Screen
          name="daily-devotional-journal"
          options={{ title: t('dailyDevotional') }}
        />
        <Stack.Screen name="journal-studio" options={{ title: t('tabStudio') }} />
        <Stack.Screen name="studio" options={{ title: t('tabStudio') }} />
        <Stack.Screen name="studio-shop" options={{ title: t('tabShop'), headerBackTitle: 'Back' }} />
        <Stack.Screen name="journal-editor" options={{ title: t('tabJournal') }} />
        <Stack.Screen
          name="prayer-journal"
          options={{ title: t('prayerJournal') }}
        />
        <Stack.Screen
          name="prayer-journal-list"
          options={{ title: t('prayerJournal') }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: t('settingsTitle'), presentation: 'card' }}
        />
      </Stack>
      <ScreenshotRouteSync />
      {Platform.OS === 'android' ? null : <StatusBar style="auto" />}
    </ThemeProvider>
  );
}
