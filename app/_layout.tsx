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
  const { colorTheme } = useAppSettings();

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
          headerStyle: { backgroundColor: colorTheme.screenBackground },
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings', presentation: 'card' }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
