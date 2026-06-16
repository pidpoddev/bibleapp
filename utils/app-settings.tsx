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
    tabHome: 'Home',
    tabBible: 'Bible',
    tabStudio: 'Studio',
    tabJournal: 'Journal',
    tabFavorites: 'Favorites',
    tabShop: 'Shop',
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
    startHereTitle: 'Start here',
    startHereSubtitle: 'Pick what you need today',
    startHereAnxiousTitle: 'Feeling anxious',
    startHereAnxiousSubtitle: 'A calming promise',
    startHereFriendTitle: 'Friend drama',
    startHereFriendSubtitle: 'Choose kindness',
    startHereCourageTitle: 'Need courage',
    startHereCourageSubtitle: 'God is with you',
    startHereLovedTitle: 'God loves me',
    startHereLovedSubtitle: 'Remember your worth',
    startHereChurchTitle: 'Before church',
    startHereChurchSubtitle: 'Listen with your heart',
    homeGreeting: 'Today',
    homeTitle: 'A soft place to start',
    homeSubtitle: 'Breathe, read, pray, and bring your real heart to God.',
    homeVerseLabel: 'Verse for today',
    homeVerseReference: 'Psalm 46:10',
    homeVerseText: 'Be still, and know that I am God.',
    homePrayerTitle: 'A little prayer',
    homePrayerText:
      'God, help me feel close to You today. Give me peace, courage, and a kind heart.',
    homeQuestionTitle: 'Heart check',
    homeQuestionText: 'What do you want to ask God today?',
    homeBibleAction: 'Read a verse',
    homePrayerAction: 'Write a prayer',
    homeCreateAction: 'Make verse art',
    homeChurchNote: 'Before church',
    homeChurchText: 'Show me one thing to remember today.',
    homePromptBreathe: 'Breathe',
    homePromptPray: 'Pray',
    homePromptCreate: 'Create',
    studioBackToDesigns: 'Go to verse designs',
    studioStartOver: 'Start over',
    studioStartOverToast: 'Started over',
    verseDesignsTitle: 'Verse Designs',
    verseDesignsSubtitle: 'All the verse cards you have decorated',
    verseDesignsEmptyTitle: 'No decorated verse cards yet',
    verseDesignsEmptyText: 'Create a verse in Studio and it will show up here.',
    verseDesignDeleteTitle: 'Delete verse design?',
    verseDesignDeleteMessage: 'This will delete {{reference}} from your decorated verse cards.',
    verseDesignDeleteAccessibility: 'Delete {{reference}}',
    verseDesignSavedAt: 'Saved {{date}}',
    oldTestament: 'Old Testament',
    newTestament: 'New Testament',
    chapter: 'Chapter',
    verse: 'Verse',
    openReference: 'Open {{book}} {{chapter}}:{{verse}}',
    journalTitle: 'Journal ✍️',
    journalSubtitle: 'Choose your journaling style 💕',
    prayerJournal: 'Prayer Journal',
    bibleStudy: 'Bible Study',
    churchDay: 'Church Day',
    dailyDevotional: 'Daily Devotional',
    homeQuestionFeeling: 'How are you feeling today?',
    homeGreatDay: 'I am having a great day',
    homeNeedGuidance: 'I could use guidance',
    homeGreatDayPrompt: 'Love that for you. Keep the joy going.',
    homeGuidancePrompt: 'What do you want help with right now?',
    homeChooseReason: 'Tell me why you feel this way',
    homeActionReadVerse: 'Read a supportive verse',
    homeActionJournal: 'Journal about it',
    homeActionChurchDay: 'Church Day notes',
    favoritesTitle: '💖 Favorites',
    favoritesSubtitle: 'Saved verse designs you love',
    verseDesignCardType: '📖 Verse Design',
    savedVerseDesign: 'Saved verse design',
    stickersCount: '{{count}} sticker',
    stickersCountPlural: '{{count}} stickers',
    notesCount: '{{count}} note',
    notesCountPlural: '{{count}} notes',
    highlightsCount: '{{count}} highlight',
    highlightsCountPlural: '{{count}} highlights',
    favoritesEmptyTitle: 'No verse favorites yet 💖',
    favoritesEmptyText: 'Save a Studio verse design and it will appear here.',
    prayerListTitle: '🙏 Prayer Journal',
    prayerListSubtitle: 'Your prayers, gratitude, and heart notes',
    newEntry: '+ New Entry',
    favoritesFilter: '❤️ Favorites',
    cancel: 'Cancel',
    delete: 'Delete',
    prayerEmptyTitle: 'No prayer entries yet',
    prayerEmptyText: 'Start your first prayer page and it will show up here.',
    prayerFavoritesEmptyTitle: 'No favorites yet 💖',
    prayerFavoritesEmptyText: 'Favorite a prayer entry and it will show up here.',
    prayerJournalTitle: '🙏 Prayer Journal',
    shopSubtitle: 'Creative supplies for Studio and journals',
    shopBackgrounds: 'Backgrounds',
    shopStickers: 'Stickers',
    shopHighlighters: 'Highlighters',
    shopPens: 'Pens',
    shopFeatureTitle: 'This week’s shelf',
    shopFeatureText: 'Warm backgrounds, sweet stickers, and soft colors',
    shopPreview: 'Preview',
    shopPackPreviewSoon: 'Pack preview coming soon',
    shopViewBackgrounds: 'View backgrounds',
    shopViewStickers: 'View stickers',
    shopBuyLabel: 'Buy {{price}}',
  },
  es: {
    tabHome: 'Inicio',
    tabBible: 'Biblia',
    tabStudio: 'Estudio',
    tabJournal: 'Diario',
    tabFavorites: 'Favoritos',
    tabShop: 'Tienda',
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
    startHereTitle: 'Empieza aquí',
    startHereSubtitle: 'Elige lo que necesitas hoy',
    startHereAnxiousTitle: 'Con ansiedad',
    startHereAnxiousSubtitle: 'Una promesa de paz',
    startHereFriendTitle: 'Problemas con amigas',
    startHereFriendSubtitle: 'Elige bondad',
    startHereCourageTitle: 'Necesito valor',
    startHereCourageSubtitle: 'Dios está contigo',
    startHereLovedTitle: 'Dios me ama',
    startHereLovedSubtitle: 'Recuerda tu valor',
    startHereChurchTitle: 'Antes de iglesia',
    startHereChurchSubtitle: 'Escucha con el corazón',
    homeGreeting: 'Hoy',
    homeTitle: 'Un lugar dulce para empezar',
    homeSubtitle: 'Respira, lee, ora y trae tu corazón real a Dios.',
    homeVerseLabel: 'Versículo de hoy',
    homeVerseReference: 'Salmo 46:10',
    homeVerseText: 'Estad quietos, y conoced que yo soy Dios.',
    homePrayerTitle: 'Una oración pequeña',
    homePrayerText:
      'Dios, ayúdame a sentirme cerca de Ti hoy. Dame paz, valor y un corazón bondadoso.',
    homeQuestionTitle: 'Revisa tu corazón',
    homeQuestionText: '¿Qué quieres preguntarle a Dios hoy?',
    homeBibleAction: 'Leer un versículo',
    homePrayerAction: 'Escribir oración',
    homeCreateAction: 'Crear arte',
    homeChurchNote: 'Antes de iglesia',
    homeChurchText: 'Muéstrame una cosa para recordar hoy.',
    homePromptBreathe: 'Respira',
    homePromptPray: 'Ora',
    homePromptCreate: 'Crea',
    studioBackToDesigns: 'Ir a diseños de versículos',
    studioStartOver: 'Empezar de nuevo',
    studioStartOverToast: 'Empezado de nuevo',
    verseDesignsTitle: 'Diseños de Versículos',
    verseDesignsSubtitle: 'Todas las tarjetas de versículos que has decorado',
    verseDesignsEmptyTitle: 'Aún no hay tarjetas decoradas',
    verseDesignsEmptyText: 'Crea un versículo en Estudio y aparecerá aquí.',
    verseDesignDeleteTitle: '¿Eliminar diseño?',
    verseDesignDeleteMessage: 'Esto eliminará {{reference}} de tus tarjetas decoradas.',
    verseDesignDeleteAccessibility: 'Eliminar {{reference}}',
    verseDesignSavedAt: 'Guardado {{date}}',
    oldTestament: 'Antiguo Testamento',
    newTestament: 'Nuevo Testamento',
    chapter: 'Capítulo',
    verse: 'Versículo',
    openReference: 'Abrir {{book}} {{chapter}}:{{verse}}',
    journalTitle: 'Diario ✍️',
    journalSubtitle: 'Elige tu estilo de journaling 💕',
    prayerJournal: 'Diario de Oración',
    bibleStudy: 'Estudio Bíblico',
    churchDay: 'Día de Iglesia',
    dailyDevotional: 'Devocional Diario',
    homeQuestionFeeling: '¿Cómo te sientes hoy?',
    homeGreatDay: 'Estoy teniendo un gran día',
    homeNeedGuidance: 'Necesito guía',
    homeGreatDayPrompt: 'Me encanta eso. Mantengamos esa alegría.',
    homeGuidancePrompt: '¿Con qué quieres ayuda ahora?',
    homeChooseReason: 'Cuéntame por qué te sientes así',
    homeActionReadVerse: 'Leer un versículo de apoyo',
    homeActionJournal: 'Escribir en mi diario',
    homeActionChurchDay: 'Notas de Día de Iglesia',
    favoritesTitle: '💖 Favoritos',
    favoritesSubtitle: 'Diseños de versículos que amas',
    verseDesignCardType: '📖 Diseño de Versículo',
    savedVerseDesign: 'Diseño de versículo guardado',
    stickersCount: '{{count}} sticker',
    stickersCountPlural: '{{count}} stickers',
    notesCount: '{{count}} nota',
    notesCountPlural: '{{count}} notas',
    highlightsCount: '{{count}} resaltado',
    highlightsCountPlural: '{{count}} resaltados',
    favoritesEmptyTitle: 'Aún no hay versículos favoritos 💖',
    favoritesEmptyText: 'Guarda un diseño de Estudio y aparecerá aquí.',
    prayerListTitle: '🙏 Diario de Oración',
    prayerListSubtitle: 'Tus oraciones, gratitud y notas del corazón',
    newEntry: '+ Nueva Entrada',
    favoritesFilter: '❤️ Favoritos',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    prayerEmptyTitle: 'Aún no hay entradas de oración',
    prayerEmptyText: 'Comienza tu primera página de oración y aparecerá aquí.',
    prayerFavoritesEmptyTitle: 'Aún no hay favoritos 💖',
    prayerFavoritesEmptyText: 'Marca una entrada de oración como favorita y aparecerá aquí.',
    prayerJournalTitle: '🙏 Diario de Oración',
    shopSubtitle: 'Recursos creativos para Estudio y diarios',
    shopBackgrounds: 'Fondos',
    shopStickers: 'Stickers',
    shopHighlighters: 'Resaltadores',
    shopPens: 'Plumas',
    shopFeatureTitle: 'La colección de esta semana',
    shopFeatureText: 'Fondos cálidos, stickers dulces y colores suaves',
    shopPreview: 'Vista previa',
    shopPackPreviewSoon: 'Vista previa del paquete próximamente',
    shopViewBackgrounds: 'Ver fondos',
    shopViewStickers: 'Ver stickers',
    shopBuyLabel: 'Comprar {{price}}',
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
  const template: string =
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
