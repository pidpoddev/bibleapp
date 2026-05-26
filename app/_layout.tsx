import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppSettingsProvider, useAppSettings } from '@/utils/app-settings';

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
          headerStyle: { backgroundColor: colorTheme.screenBackground },
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="bible-books" options={{ title: t('tabBible') }} />
        <Stack.Screen name="bible-study-journal" options={{ title: t('bibleStudy') }} />
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
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
