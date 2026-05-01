import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ColorThemeKey =
  | 'default'
  | 'blush'
  | 'lavender'
  | 'peach'
  | 'mint'
  | 'sky';

type ColorTheme = {
  key: ColorThemeKey;
  name: string;
  accent: string;
  soft: string;
  border: string;
  tint: string;
  screenBackground: string;
  editorBackground: string;
  cardBackground: string;
  paperBackground: string;
  toolbarBackground: string;
  selectionBackground: string;
};

type AppSettingsContextValue = {
  colorTheme: ColorTheme;
  colorThemes: ColorTheme[];
  setColorThemeKey: (key: ColorThemeKey) => void;
  isLoaded: boolean;
};

const SETTINGS_STORAGE_KEY = 'app_settings_v1';

const COLOR_THEMES: ColorTheme[] = [
  {
    key: 'default',
    name: 'Default',
    accent: '#F3EDE8',
    soft: '#FFFDF9',
    border: '#E8DCD4',
    tint: '#C88C93',
    screenBackground: '#FFFDF9',
    editorBackground: '#F7F4F2',
    cardBackground: '#FFFFFF',
    paperBackground: '#FFFDF8',
    toolbarBackground: '#F3EDE8',
    selectionBackground: '#E8DCD4',
  },
  {
    key: 'blush',
    name: 'Blush Pink',
    accent: '#F3D1DC',
    soft: '#FCEEF3',
    border: '#E7B7C7',
    tint: '#D989A7',
    screenBackground: '#FFF7FA',
    editorBackground: '#FDF3F6',
    cardBackground: '#FFFFFF',
    paperBackground: '#FFF9FB',
    toolbarBackground: '#FCEEF3',
    selectionBackground: '#F3D1DC',
  },
  {
    key: 'lavender',
    name: 'Lavender',
    accent: '#DDD6F8',
    soft: '#F4F1FF',
    border: '#C8C0EF',
    tint: '#A58BDE',
    screenBackground: '#FAF8FF',
    editorBackground: '#F3EFFC',
    cardBackground: '#FFFFFF',
    paperBackground: '#FCFBFF',
    toolbarBackground: '#F4F1FF',
    selectionBackground: '#DDD6F8',
  },
  {
    key: 'peach',
    name: 'Peach',
    accent: '#F8D7C5',
    soft: '#FFF1E8',
    border: '#EEC0A6',
    tint: '#DE9B74',
    screenBackground: '#FFF9F5',
    editorBackground: '#FBF1EA',
    cardBackground: '#FFFFFF',
    paperBackground: '#FFFDFB',
    toolbarBackground: '#FFF1E8',
    selectionBackground: '#F8D7C5',
  },
  {
    key: 'mint',
    name: 'Mint',
    accent: '#CFEADF',
    soft: '#EEF9F3',
    border: '#B8DAC7',
    tint: '#79B89A',
    screenBackground: '#F7FCF9',
    editorBackground: '#EFF7F2',
    cardBackground: '#FFFFFF',
    paperBackground: '#FBFEFC',
    toolbarBackground: '#EEF9F3',
    selectionBackground: '#CFEADF',
  },
  {
    key: 'sky',
    name: 'Sky Blue',
    accent: '#D4E6F8',
    soft: '#EFF7FF',
    border: '#BDD5ED',
    tint: '#7FAFD8',
    screenBackground: '#F7FBFF',
    editorBackground: '#EEF4FA',
    cardBackground: '#FFFFFF',
    paperBackground: '#FBFDFF',
    toolbarBackground: '#EFF7FF',
    selectionBackground: '#D4E6F8',
  },
];

const DEFAULT_COLOR_THEME_KEY: ColorThemeKey = 'default';

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function getColorThemeByKey(key: ColorThemeKey) {
  return (
    COLOR_THEMES.find((theme) => theme.key === key) ??
    COLOR_THEMES.find((theme) => theme.key === DEFAULT_COLOR_THEME_KEY) ??
    COLOR_THEMES[0]
  );
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [colorThemeKey, setColorThemeKeyState] =
    useState<ColorThemeKey>(DEFAULT_COLOR_THEME_KEY);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);

        if (!storedSettings) {
          setIsLoaded(true);
          return;
        }

        const parsedSettings = JSON.parse(storedSettings) as {
          colorThemeKey?: ColorThemeKey;
        };

        if (parsedSettings.colorThemeKey) {
          setColorThemeKeyState(parsedSettings.colorThemeKey);
        }
      } catch (error) {
        console.log('Error loading app settings:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    void loadSettings();
  }, []);

  const setColorThemeKey = (key: ColorThemeKey) => {
    setColorThemeKeyState(key);

    void AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ colorThemeKey: key })
    ).catch((error) => {
      console.log('Error saving app settings:', error);
    });
  };

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      colorTheme: getColorThemeByKey(colorThemeKey),
      colorThemes: COLOR_THEMES,
      setColorThemeKey,
      isLoaded,
    }),
    [colorThemeKey, isLoaded]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider');
  }

  return context;
}
