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
export type AppLanguageKey = 'en' | 'es';

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

type AppLanguage = {
  key: AppLanguageKey;
  name: string;
  nativeName: string;
};

const TRANSLATIONS = {
  en: {
    tabBible: 'Bible',
    tabStudio: 'Studio',
    tabJournal: 'Journal',
    tabFavorites: 'Favorites',
    settingsTitle: 'Settings',
    settingsSubtitle: 'Pick a soft pastel palette and language that feel most like you.',
    settingsColors: 'Colors',
    settingsLanguage: 'Language',
    colorHint: 'Soft, sweet, and easy on the eyes',
    languageHint: 'Use this language as the app default',
    languageEnglish: 'English',
    languageSpanish: 'Spanish',
    bibleTitle: 'Bible ✨',
    bibleSubtitle: 'Find a verse to create with',
    searchPlaceholder: 'Search "John 3:16"',
    oldTestament: 'Old Testament',
    newTestament: 'New Testament',
    chapter: 'Chapter',
    verse: 'Verse',
    openReference: 'Open {{book}} {{chapter}}:{{verse}}',
    journalTitle: 'Journal ✍️',
    journalSubtitle: 'Choose your journaling style 💕',
    prayerJournal: 'Prayer Journal',
    bibleStudy: 'Bible Study',
    dailyDevotional: 'Daily Devotional',
    favoritesTitle: '💖 Favorites',
    favoritesSubtitle: 'Saved verse designs you love',
    verseDesignCardType: '📖 Verse Design',
    savedVerseDesign: 'Saved verse design',
    stickersCount: '{{count}} sticker',
    stickersCountPlural: '{{count}} stickers',
    notesCount: '{{count}} note',
    notesCountPlural: '{{count}} notes',
    favoritesEmptyTitle: 'No verse favorites yet 💖',
    favoritesEmptyText: 'Save a Studio verse design and it will appear here.',
    prayerListTitle: '🙏 Prayer Journal',
    prayerListSubtitle: 'Your prayers, gratitude, and heart notes',
    newEntry: '+ New Entry',
    favoritesFilter: '❤️ Favorites',
    delete: 'Delete',
    prayerEmptyTitle: 'No prayer entries yet',
    prayerEmptyText: 'Start your first prayer page and it will show up here.',
    prayerFavoritesEmptyTitle: 'No favorites yet 💖',
    prayerFavoritesEmptyText: 'Favorite a prayer entry and it will show up here.',
    prayerJournalTitle: '🙏 Prayer Journal',
  },
  es: {
    tabBible: 'Biblia',
    tabStudio: 'Estudio',
    tabJournal: 'Diario',
    tabFavorites: 'Favoritos',
    settingsTitle: 'Configuración',
    settingsSubtitle:
      'Elige una paleta pastel suave y el idioma que más se sienta como tú.',
    settingsColors: 'Colores',
    settingsLanguage: 'Idioma',
    colorHint: 'Suave, dulce y agradable para la vista',
    languageHint: 'Usa este idioma como predeterminado de la app',
    languageEnglish: 'Inglés',
    languageSpanish: 'Español',
    bibleTitle: 'Biblia ✨',
    bibleSubtitle: 'Encuentra un versículo para crear',
    searchPlaceholder: 'Buscar "John 3:16"',
    oldTestament: 'Antiguo Testamento',
    newTestament: 'Nuevo Testamento',
    chapter: 'Capítulo',
    verse: 'Versículo',
    openReference: 'Abrir {{book}} {{chapter}}:{{verse}}',
    journalTitle: 'Diario ✍️',
    journalSubtitle: 'Elige tu estilo de journaling 💕',
    prayerJournal: 'Diario de Oración',
    bibleStudy: 'Estudio Bíblico',
    dailyDevotional: 'Devocional Diario',
    favoritesTitle: '💖 Favoritos',
    favoritesSubtitle: 'Diseños de versículos que amas',
    verseDesignCardType: '📖 Diseño de Versículo',
    savedVerseDesign: 'Diseño de versículo guardado',
    stickersCount: '{{count}} sticker',
    stickersCountPlural: '{{count}} stickers',
    notesCount: '{{count}} nota',
    notesCountPlural: '{{count}} notas',
    favoritesEmptyTitle: 'Aún no hay versículos favoritos 💖',
    favoritesEmptyText: 'Guarda un diseño de Estudio y aparecerá aquí.',
    prayerListTitle: '🙏 Diario de Oración',
    prayerListSubtitle: 'Tus oraciones, gratitud y notas del corazón',
    newEntry: '+ Nueva Entrada',
    favoritesFilter: '❤️ Favoritos',
    delete: 'Eliminar',
    prayerEmptyTitle: 'Aún no hay entradas de oración',
    prayerEmptyText: 'Comienza tu primera página de oración y aparecerá aquí.',
    prayerFavoritesEmptyTitle: 'Aún no hay favoritos 💖',
    prayerFavoritesEmptyText: 'Marca una entrada de oración como favorita y aparecerá aquí.',
    prayerJournalTitle: '🙏 Diario de Oración',
  },
} as const;

type TranslationKey = keyof typeof TRANSLATIONS.en;
type TranslationParams = Record<string, string | number>;

type AppSettingsContextValue = {
  colorTheme: ColorTheme;
  colorThemes: ColorTheme[];
  language: AppLanguage;
  languages: AppLanguage[];
  setColorThemeKey: (key: ColorThemeKey) => void;
  setLanguageKey: (key: AppLanguageKey) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  isLoaded: boolean;
};

const SETTINGS_STORAGE_KEY = 'app_settings_v1';
const LANGUAGES: AppLanguage[] = [
  { key: 'en', name: 'English', nativeName: 'English' },
  { key: 'es', name: 'Spanish', nativeName: 'Español' },
];

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
const DEFAULT_LANGUAGE_KEY: AppLanguageKey = 'en';

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function getColorThemeByKey(key: ColorThemeKey) {
  return (
    COLOR_THEMES.find((theme) => theme.key === key) ??
    COLOR_THEMES.find((theme) => theme.key === DEFAULT_COLOR_THEME_KEY) ??
    COLOR_THEMES[0]
  );
}

function getLanguageByKey(key: AppLanguageKey) {
  return (
    LANGUAGES.find((language) => language.key === key) ??
    LANGUAGES.find((language) => language.key === DEFAULT_LANGUAGE_KEY) ??
    LANGUAGES[0]
  );
}

function translate(
  languageKey: AppLanguageKey,
  key: TranslationKey,
  params?: TranslationParams
) {
  const template =
    TRANSLATIONS[languageKey][key] ?? TRANSLATIONS[DEFAULT_LANGUAGE_KEY][key] ?? key;

  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (result, [paramKey, value]) =>
      result.replaceAll(`{{${paramKey}}}`, String(value)),
    template
  );
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [colorThemeKey, setColorThemeKeyState] =
    useState<ColorThemeKey>(DEFAULT_COLOR_THEME_KEY);
  const [languageKey, setLanguageKeyState] =
    useState<AppLanguageKey>(DEFAULT_LANGUAGE_KEY);
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
          languageKey?: AppLanguageKey;
        };

        if (parsedSettings.colorThemeKey) {
          setColorThemeKeyState(parsedSettings.colorThemeKey);
        }

        if (parsedSettings.languageKey) {
          setLanguageKeyState(parsedSettings.languageKey);
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
      JSON.stringify({ colorThemeKey: key, languageKey })
    ).catch((error) => {
      console.log('Error saving app settings:', error);
    });
  };

  const setLanguageKey = (key: AppLanguageKey) => {
    setLanguageKeyState(key);

    void AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ colorThemeKey, languageKey: key })
    ).catch((error) => {
      console.log('Error saving app settings:', error);
    });
  };

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      colorTheme: getColorThemeByKey(colorThemeKey),
      colorThemes: COLOR_THEMES,
      language: getLanguageByKey(languageKey),
      languages: LANGUAGES,
      setColorThemeKey,
      setLanguageKey,
      t: (key, params) => translate(languageKey, key, params),
      isLoaded,
    }),
    [colorThemeKey, languageKey, isLoaded]
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
