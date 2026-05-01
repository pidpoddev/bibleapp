import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppSettings } from '@/utils/app-settings';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { colorTheme, t } = useAppSettings();
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      initialRouteName="bible"
      screenOptions={{
        tabBarActiveTintColor: colorTheme.tint ?? Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: '#8F877F',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          lineHeight: 16,
          paddingBottom: isWeb ? 0 : 2,
        },
        tabBarItemStyle: {
          paddingTop: isWeb ? 4 : 0,
          paddingBottom: isWeb ? 2 : 0,
        },
        tabBarStyle: {
          position: isWeb ? 'relative' : 'absolute',
          left: isWeb ? 0 : 16,
          right: isWeb ? 0 : 16,
          bottom: isWeb ? 0 : 16,
          height: isWeb ? 78 : 72,
          paddingTop: isWeb ? 8 : 10,
          paddingBottom: isWeb ? 12 : 10,
          marginHorizontal: isWeb ? 12 : 0,
          marginTop: isWeb ? 8 : 0,
          marginBottom: isWeb ? 8 : 0,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          backgroundColor: colorTheme.toolbarBackground,
          shadowColor: '#000000',
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="bible"
        options={{
          title: t('tabBible'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              size={22}
              name={focused ? 'book' : 'book-outline'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: t('tabStudio'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              size={22}
              name={focused ? 'color-wand' : 'color-wand-outline'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: t('tabJournal'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              size={22}
              name={focused ? 'create' : 'create-outline'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t('tabFavorites'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              size={22}
              name={focused ? 'heart' : 'heart-outline'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
