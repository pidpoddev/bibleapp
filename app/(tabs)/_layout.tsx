import { Href, Link, Slot, usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppSettings } from '@/utils/app-settings';

const FAVORITES_TAB_ICON = require('../../assets/images/toolbar-icons/favorites-tab.png');
const JOURNAL_TAB_ICON = require('../../assets/images/toolbar-icons/journal-tab.png');
const BIBLE_TAB_ICON = require('../../assets/images/toolbar-icons/bible-tab.png');
const HOME_TAB_ICON = require('../../assets/images/toolbar-icons/home-tab.png');
const SHOP_TAB_ICON = require('../../assets/images/toolbar-icons/shop-tab.png');

type TabItem = {
  key: string;
  label: string;
  href: Href;
  icon: number;
};

function getActiveTabKey(pathname: string) {
  if (pathname.startsWith('/bible')) {
    return 'bible';
  }

  if (pathname.startsWith('/journal')) {
    return 'journal';
  }

  if (pathname.startsWith('/favorites')) {
    return 'favorites';
  }

  if (pathname.startsWith('/shop')) {
    return 'shop';
  }

  return 'home';
}

export default function TabLayout() {
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { colorTheme, t } = useAppSettings();
  const activeTabKey = getActiveTabKey(pathname);
  const isWeb = Platform.OS === 'web';

  const tabs: TabItem[] = [
    { key: 'home', label: t('tabHome'), href: '/', icon: HOME_TAB_ICON },
    { key: 'bible', label: t('tabBible'), href: '/bible', icon: BIBLE_TAB_ICON },
    { key: 'journal', label: t('tabJournal'), href: '/journal', icon: JOURNAL_TAB_ICON },
    { key: 'favorites', label: t('tabFavorites'), href: '/favorites', icon: FAVORITES_TAB_ICON },
    { key: 'shop', label: t('tabShop'), href: '/shop', icon: SHOP_TAB_ICON },
  ];

  return (
    <View style={[styles.shell, { backgroundColor: colorTheme.screenBackground }]}>
      <View style={styles.content}>
        <Slot />
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.tabBarLowerShield,
          {
            backgroundColor: colorTheme.screenBackground,
            height: isWeb ? 18 : 40,
          },
        ]}
      />

      <View
        accessibilityElementsHidden={!isFocused}
        importantForAccessibility={isFocused ? 'auto' : 'no-hide-descendants'}
        style={[
          styles.tabBar,
          {
            backgroundColor: colorTheme.toolbarBackground,
            marginHorizontal: isWeb ? 12 : 16,
            marginBottom: isWeb ? 8 : 16,
          },
        ]}>
        {tabs.map((tab) => {
          const isActive = activeTabKey === tab.key;

          return (
            <Link key={tab.key} href={tab.href} replace asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isActive }}
                style={styles.tabButton}>
                <Image
                  source={tab.icon}
                  resizeMode="contain"
                  style={[
                    styles.tabIcon,
                    { opacity: isActive ? 1 : 0.72 },
                    tab.key === 'shop' ? styles.shopIcon : null,
                  ]}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? colorTheme.tint : '#8F877F' },
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 96,
    zIndex: 0,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    height: 76,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 100,
  },
  tabBarLowerShield: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
    elevation: 99,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabIcon: {
    width: 22,
    height: 21,
  },
  shopIcon: {
    width: 23,
    height: 23,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
});
