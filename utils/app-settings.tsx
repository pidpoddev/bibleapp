import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  getBibleVersionOptions,
  getDefaultBibleVersionKey,
  normalizeBibleVersionKey,
  type BibleVersionKey,
  type BibleVersionOption,
} from '@/utils/bible-data';

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
    settingsAccount: 'Account',
    settingsAccountSubtitle: 'Sign in for future device sync',
    settingsAccountEmail: 'Email',
    settingsAccountPassword: 'Password',
    settingsAccountSignedIn: 'Signed in',
    settingsAccountSyncStatus: 'Sync: coming soon',
    settingsAccountAction: 'Sign in',
    settingsAccountCreateAction: 'Create account',
    settingsAccountCreateSubtitle: 'Create an account for future iPad and device sync',
    settingsAccountConfirmPassword: 'Confirm password',
    settingsAccountSignOut: 'Sign out',
    settingsAccountSaved: 'Account saved',
    settingsAccountCreated: 'Account created',
    settingsAccountEmailError: 'Enter a valid email address.',
    settingsAccountPasswordError: 'Use at least 8 characters.',
    settingsAccountPasswordMatchError: 'Passwords need to match.',
    settingsCloudSave: 'Cloud Save',
    settingsCloudSaveUnavailableTitle: 'Cloud Save is off for launch',
    settingsCloudSaveUnavailableText:
      'Faith Canvas keeps journals, favorites, verse art, and settings on this device for launch. A parent-approved Cloud Save flow can be added later.',
    settingsUsername: 'Username',
    settingsSecretPhrase: 'Secret Phrase',
    settingsPhrasePlaceholder: 'Enter Secret Phrase',
    settingsPhraseWarning: "Don't lose the phrase! It can't be recovered.",
    settingsSyncLogTitle: 'Cloud Save Log',
    settingsSyncLogEmpty: 'No uploads or downloads yet.',
    settingsAppearance: 'Appearance',
    settingsColors: 'Colors',
    settingsLanguage: 'Language',
    settingsPhraseHint: 'Save your journal with a secret phrase.',
    settingsPhraseShow: 'Show phrase',
    settingsPhraseHide: 'Hide phrase',
    settingsSyncConnect: 'Connect',
    settingsSyncNow: 'Sync Now',
    settingsDisconnect: 'Disconnect this device',
    settingsBibleReadingTitle: 'Bible Reading',
    settingsBibleVersionTitle: 'Bible Version',
    settingsBibleVersionHint: 'Choose the Bible text used for reading, search, and verse art.',
    settingsBibleVersionAttribution: 'Bible text: {{attribution}}',
    settingsBibleReadingImages: 'Bible Reading Images Beta',
    settingsBibleReadingImagesHint: 'Beta: show gentle Genesis chapter images while reading.',
    settingsBibleProgressTitle: '% of the Bible Read',
    settingsBibleProgressHint: '{{read}} of {{total}} verses opened',
    settingsDataPrivacy: 'Data & Privacy',
    settingsDataSafety: 'Data safety',
    settingsJournalBackupTitle: 'Journal backup',
    settingsJournalBackupHint: 'Export entries before changing devices or clearing local data.',
    settingsExportJournalData: 'Export journal data',
    settingsResetJournalData: 'Reset journal data',
    settingsResetTitle: 'Reset journal data?',
    settingsResetMessage:
      'This clears all local journal entries, favorites, and verse designs from this device.',
    settingsResetSuccess: 'Journal entries, favorites, and verse designs were reset.',
    settingsResetError: 'Could not reset journal data.',
    settingsUsernameShuffle: 'Make a new username',
    settingsUsernameChangeTitle: 'Change username?',
    settingsUsernameChangeMessage:
      'Change your Cloud Save username from {{currentUsername}} to {{nextUsername}}? Your saved files will stay connected.',
    settingsUsernameChangeAction: 'Change',
    settingsExportDownloaded: 'Journal backup downloaded.',
    settingsExportReady: 'Journal backup is ready to save or share.',
    settingsExportError: 'Could not prepare journal backup.',
    settingsSyncErrorUsernamePhraseMismatch:
      'That Username and Secret Phrase do not match.',
    settingsSyncErrorUsernameTaken: 'That username is taken. Try changing it a little.',
    settingsSyncErrorPhraseMismatch: 'That Secret Phrase does not match this device.',
    settingsSyncErrorReconnect:
      'Cloud Save needs to reconnect. Enter your Secret Phrase again.',
    settingsSyncErrorEnterPhrase: 'Enter your Secret Phrase first.',
    settingsSyncErrorTimedOut:
      'Cloud Save could not reach the server. Check the connection and try again.',
    settingsCloudConnectedNothingNew: 'Cloud Save is connected. Nothing new to save.',
    settingsCloudSavedCount: '{{count}} saved',
    settingsCloudDownloadedCount: '{{count}} downloaded',
    settingsCloudRemovedCount: '{{count}} removed',
    settingsSyncConflictNeedsCheck:
      '{{count}} saved things need a quick check.',
    settingsSyncConflictNeedsCheckOne:
      '{{count}} saved thing needs a quick check.',
    settingsSyncConnectedGotStuck:
      'Cloud Save connected, but syncing got stuck. Tap Sync Now to try again.',
    settingsSyncConnectedFinishNeeded:
      'Cloud Save is connected. Sync still needs to finish.',
    settingsUsernameTooShort: 'Pick a username with at least 3 letters or numbers.',
    settingsSyncStarting: 'Starting Cloud Save...',
    settingsSyncConnecting: 'Connecting Cloud Save...',
    settingsSyncProtectingPhrase: 'Protecting your Secret Phrase...',
    settingsSyncConnectedBackground: 'Connected. Syncing in the background.',
    settingsSyncUsernameChangedBackground: 'Username changed. Syncing in the background.',
    settingsSyncBackground: 'Syncing in the background.',
    settingsSyncCheckingUsername: 'Checking username...',
    settingsSyncSavingUsername: 'Saving username...',
    settingsSyncGotStuck: 'Cloud Save got stuck. Try again.',
    settingsSyncLogLoading: 'Loading Cloud Save Log...',
    settingsSyncLogNothing: 'Nothing saved or downloaded yet.',
    settingsSyncLogLoaded: 'Cloud Save Log loaded.',
    settingsSyncLogLoadError: 'Could not load Cloud Save Log.',
    settingsSyncConflictEnterPhrase: 'Enter your Secret Phrase to fix this.',
    settingsSyncConflictFixing: 'Fixing saved versions...',
    settingsSyncConflictPicked: 'Saved version picked.',
    settingsSyncConflictPickError: 'Could not pick that version.',
    settingsSyncConflictBothSaving: 'Saving both versions...',
    settingsSyncConflictBothSaved: 'Both versions were saved.',
    settingsSyncConflictBothError: 'Could not save both versions.',
    settingsSyncDownload: 'Download',
    settingsSyncUpload: 'Upload',
    settingsSyncItemCount: '{{count}} item',
    settingsSyncItemCountPlural: '{{count}} items',
    settingsConflictPickTitle: 'Pick the version you want',
    settingsConflictSubtitle: 'This was saved on more than one device.',
    settingsConflictPick: 'Pick',
    settingsConflictKeepBoth: 'Keep Both',
    settingsAboutTitle: 'Help',
    settingsAboutImageLabel: 'Faith Canvas app icon',
    settingsAboutAppName: 'Faith Canvas',
    settingsAboutVersion: 'Version 1.0.0 • PidPod, the applications brand of Bumfuzzle Inc., a Tennessee corporation',
    settingsAboutRatingTitle: 'Why stores list a Teen rating',
    settingsAboutRatingBody:
      'Apple and Google rate Faith Canvas Teen (about 13+) because the Bible itself includes some violent, mature, or graphic wording. The app is still a gentle journal with no ads, chat, or social feed. A parent or guardian should decide which books and verses a child reads.',
    settingsPrivacyLocal: 'Your journal, favorites, verse art, and settings stay on this device unless you choose Cloud Save.',
    settingsPrivacyCloud: 'Cloud Save is off for launch, so saved app content stays on this device unless you export it yourself.',
    settingsPrivacyNoAds: 'No third-party ads, public profiles, followers, open chat, or social feed.',
    settingsPrivacyPolicy: 'Privacy Policy',
    settingsChildSafety: 'Child Safety',
    settingsSupport: 'Support',
    settingsSupportEmail: 'Email support@pidpod.com',
    colorHint: 'Soft, sweet, and easy on the eyes',
    languageHint: 'Use this language as the app default',
    languageEnglish: 'English',
    languageSpanish: 'Spanish',
    bibleTitle: 'Bible ✨',
    bibleSubtitle: 'Find a verse to create with',
    searchPlaceholder: 'Search "John 3:16"',
    searchMatchesTitle: 'Search results',
    searchResultCount: '{{count}} matches for "{{query}}"',
    searchNoResultsTitle: 'No verses found',
    searchNoResultsText: 'Try a verse like John 3:16 or another word for "{{query}}".',
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
    breatheTitle: 'Breathe',
    breatheSubtitle: 'Slow down with God for one quiet minute.',
    breatheVerseLabel: 'Quiet verse',
    breatheVerseReference: 'Psalm 46:10',
    breatheVerseText: 'Be still, and know that I am God.',
    breatheStepInhale: 'Breathe in',
    breatheStepHold: 'Hold softly',
    breatheStepExhale: 'Breathe out',
    breatheStepRest: 'Rest',
    breathePrayerTitle: 'A tiny prayer',
    breathePrayerText: 'Jesus, calm my mind and help me feel safe with You.',
    breathePrimaryAction: 'Write a prayer',
    breatheSecondaryAction: 'Pick a verse for art',
    studioBackToDesigns: 'Go to verse designs',
    studioStartOver: 'Start over',
    studioStartOverToast: 'Started over',
    studioDiscardNewPage: 'Discard & new page',
    studioDiscardNewPageTitle: 'Discard this page?',
    studioDiscardNewPageMessage:
      'Starts a blank Studio page. Unsaved changes on this page will be lost. Anything already saved in Journal stays there.',
    studioDiscardConfirm: 'Discard',
    studioVerseReferenceLabel: 'Reference',
    studioVerseReferenceNumber: 'Verse #',
    studioVerseReferenceNone: 'Hide number',
    studioVerseReferenceFull: 'Book + chapter:verse',
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
    homeOpenInStudio: 'Open in Studio',
    homeReflect: 'Reflect',
    homeDayStreak: '{{count}} day streak',
    homeDayStreakPlural: '{{count}} day streak',
    homeTodayCount: '{{count}} today',
    homeStartToday: 'Start today',
    homeNoEntryYet: 'No entry yet',
    homeQuickPrayer: 'Prayer',
    homeQuickDevotional: 'Devotional',
    homeWordsFromGod: 'Words from God',
    homePickWhatFits: 'Pick what fits',
    homeWordsIntro: 'Find a verse for your heart, or make one to encourage someone else.',
    homeForMe: 'For me',
    homeHelpSomeone: 'I want to help someone',
    homeContinueToday: 'Continue today',
    homeRecentWork: 'Recent work',
    homeRemoveFromRecent: 'Remove from Recent',
    homeRemoveFromRecentAccessibility: 'Remove {{title}} from Recent work',
    homeThisWeek: '{{count}} this week',
    homeKeepWriting: 'Open to keep writing...',
    journalNewEntryTab: 'New Entry',
    journalDailyLogsTab: 'Daily Logs',
    journalPrayerSubtitle: 'Talk to God and write what is on your heart.',
    journalBibleStudySubtitle: 'Dig into a verse and capture what you learn.',
    journalChurchSubtitle: 'Save sermon notes, key verses, and reflections.',
    journalDailyDevotionalSubtitle: 'Reflect, apply, ask questions, and pray daily.',
    journalStudioSubtitle: 'Open creative page with verse cards and stickers.',
    journalWeekWithGod: 'Your week with God',
    journalDays: 'days',
    journalEntries: 'entries',
    journalEntry: 'entry',
    journalSaved: 'saved',
    journalMood: 'mood',
    journalNotYet: 'Not yet',
    journalEmptyLogsTitle: 'No daily logs yet',
    journalEmptyLogsText: 'Create a journal entry and it will appear here by date.',
    journalBlank: 'Blank Journal',
    journalNewPage: '+ New Page',
    favoritesSearchPlaceholder: 'Search saved entries',
    favoritesClearSearch: 'Clear saved-entry search',
    favoritesNoSearchResultsTitle: 'No saved entries found',
    favoritesNoSearchResultsText: 'Try a different word, phrase, reference, or journal type.',
    moodAngry: 'Angry at someone',
    moodSad: 'Sad',
    moodAnxious: 'Anxious',
    moodForgiving: 'Need to forgive',
    moodGrateful: 'Grateful',
    moodEncouraged: 'Encourage someone',
    moodPeaceful: 'Share peace',
    moodComfortSomeone: 'Comfort someone',
    moodGiveCourage: 'Give courage',
    moodDirection: 'Need direction',
    moodConfused: 'Confused',
    moodPeacefulJournal: 'Peaceful',
    moodTired: 'Tired',
    moodHappy: 'Happy',
    moodAngrySuggestion: 'Start with a verse that helps you slow down before you respond.',
    moodSadSuggestion: 'Open a comfort verse and pray honestly through sadness.',
    moodAnxiousSuggestion: 'Open a peace verse and give the worry to God one step at a time.',
    moodForgivingSuggestion: 'Open a forgiveness verse without pretending the hurt did not matter.',
    moodGratefulSuggestion: 'Open a gratitude verse and remember what God has already done.',
    moodEncouragedSuggestion: 'Make a verse that points someone toward love and good works.',
    moodPeacefulSuggestion: 'Make a calming verse for someone who needs peace.',
    moodComfortSomeoneSuggestion: 'Make a comfort verse for someone who is hurting.',
    moodGiveCourageSuggestion: 'Make a courage verse for someone who needs to feel less alone.',
    moodDirectionSuggestion: 'Open a guidance verse when you need help trusting the next step.',
    moodOpenForgivenessVerse: 'Open forgiveness verse',
    moodOpenComfortVerse: 'Open comfort verse',
    moodOpenPeaceVerse: 'Open peace verse',
    moodOpenForgivenessStudy: 'Open forgiveness study',
    moodSaveGratitudeVerse: 'Save gratitude verse',
    moodMakeEncouragementArt: 'Make encouragement art',
    moodMakePeaceVerse: 'Make peace verse',
    moodMakeComfortVerse: 'Make comfort verse',
    moodMakeCourageVerse: 'Make courage verse',
    moodOpenGuidanceVerse: 'Open guidance verse',
    favoritesTitle: '💖 Favorites',
    favoritesSubtitle: 'Saved prayers, notes, and verse designs you love',
    favoritesDeleteTitle: 'Delete saved favorite?',
    favoritesDeleteMessage: 'This will remove this saved favorite from this device.',
    favoritesDeleteAccessibility: 'Delete saved favorite',
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
    shopFeatureTitle: 'Creative shelf',
    shopFeatureText: 'Included backgrounds, stickers, and creative previews for your pages.',
    shopPreview: 'Preview',
    shopSelected: 'Selected',
    shopIncluded: 'Included',
    shopIncludedNote: 'This pack is ready to use in Studio and journal decoration tools.',
    shopPreviewNote: 'This idea is a preview for future creative tools and is not for sale yet.',
    shopShelfTitle: 'Creative shelf',
    shopSupplyCount: '{{count}} supplies',
    shopCategoryAll: 'All',
    shopCategoryCanvas: 'Canvas',
    shopCategoryNoteStyles: 'Note styles',
    shopCategoryThemes: 'Themes',
    shopCategoryDecor: 'Decor',
    shopCategoryStickers: 'Stickers',
    shopCategoryTools: 'Tools',
    shopCategoryBundle: 'Bundle',
    shopPackPreviewSoon: 'Pack preview coming soon',
    shopViewBackgrounds: 'View backgrounds',
    shopViewStickers: 'View stickers',
    shopOwned: 'Owned',
    shopLocked: 'Locked',
    shopUnlock: 'Unlock',
    shopBuyPrice: 'Buy {{price}}',
    shopUseInStudio: 'Use in Studio',
    shopSavedPreview: 'Saved preview',
    shopViewPreview: 'View preview',
    shopPurchaseNotConnected: 'Purchases are not connected yet, so this pack was not unlocked.',
    shopPurchaseLoading: 'Connecting to the store...',
    shopPurchaseSuccess: 'Pack unlocked. It is ready to use in Studio and journals.',
    shopPurchaseCancelled: 'Purchase cancelled.',
    shopPurchaseUnavailable:
      'Purchases are not ready on this device yet. A parent can try again after store setup is finished.',
    shopPurchaseFailed: 'Purchase did not finish. Please try again.',
    shopRestorePurchases: 'Restore',
    shopRestoreLoading: 'Checking purchases...',
    shopRestoreSuccess: 'Purchases restored.',
    shopRestoreEmpty: 'No previous Shop purchases were found for this store account.',
    shopRestoreFailed: 'Purchases could not be restored. Please try again.',
    shopPreviewSavedToolsPending: 'This preview is saved, but its creative tools are not built yet.',
    shopPreviewLocalShelf: 'This preview is in your local shelf. Its tools still need to be built before it appears in Studio.',
    shopUnlockParentApproval: 'Unlock will require a purchase or parent approval once payments are connected.',
    shopEmptyTitle: 'Nothing is showing here yet',
    shopEmptyText: 'Try another category while this shelf is still being filled.',
    actionCancel: 'Cancel',
    actionDelete: 'Delete',
    actionDone: 'Done',
    actionSave: 'Save',
    actionSaveImage: 'Save image',
    actionShare: 'Share',
    actionStartOver: 'Start over',
    actionUndo: 'Undo',
    actionSaveToCloud: 'Save to Cloud',
    actionSaving: 'Saving...',
    commonBook: 'Book',
    commonChapter: 'Chapter',
    commonVerse: 'Verse',
    commonSelect: 'Select',
    commonRead: 'Read',
    commonUnread: 'Unread',
    commonChapters: 'chapters',
    commonStudio: 'Studio',
    bibleSearchAccessibility: 'Search Bible',
    bibleClearSearchAccessibility: 'Clear search',
    bibleHighlightUnread: 'Highlight unread',
    bibleHighlightUnreadAccessibility: 'Highlight unread verses',
    bibleHideRead: 'Hide read',
    bibleHideReadAccessibility: 'Hide read verses and books',
    bibleBookProgress: '{{read}}/{{total}} read',
    bibleUnreadCount: '{{count}} unread',
    bibleChapterUnreadCount: '{{count}} unread',
    bibleBackToBooks: 'Books',
    bibleBackToBooksAccessibility: 'Back to Bible books',
    bibleReaderGenesisSubtitle:
      'Scroll through Genesis. Soft chapter images appear between chapters.',
    bibleReaderVerseSubtitle:
      'Scroll to read. Tap Studio on any verse when you want to make something with it.',
    bibleSendToStudioAccessibility: 'Send {{reference}} to Studio',
    bibleEverythingVisibleRead: 'Everything visible is read',
    bibleShowCompletedBooks: 'Turn off Hide read to show completed books again.',
    bibleShowSelectorAccessibility: 'Show chapter and verse selector for {{reference}}',
    bibleAllVersesRead: 'All verses in this chapter are read.',
    cloudSaveModalBody: 'Your journal is locked before it saves.',
    cloudSaveExistingSessionPrompt: 'Enter your Secret Phrase to save this device.',
    cloudSaveNewSessionPrompt: 'Enter your Secret Phrase to turn on Cloud Save.',
    cloudSavePhraseMismatch: 'That phrase does not match this device.',
    cloudSaveReconnect: 'Cloud Save needs to reconnect. Enter your Secret Phrase again.',
    cloudSaveEnterPhrase: 'Enter your Secret Phrase first.',
    cloudSaveGenericError: 'Could not save to cloud.',
    cloudSaveConflictMessage: 'Saved to cloud. Some things need a quick check in Settings.',
    cloudSaveSuccessCount: 'Saved {{count}} things to cloud.',
    cloudSaveSuccessCountOne: 'Saved {{count}} thing to cloud.',
    editorText: 'Text',
    editorDecor: 'Decor',
    editorCanvas: 'Canvas',
    editorNote: 'Note',
    editorDraw: 'Draw',
    editorMore: 'More',
    editorBasic: 'Basic',
    editorLined: 'Lined',
    editorPlain: 'Plain',
    editorQuickStickers: 'Quick Stickers',
    editorAddMoreDecor: 'Add more',
    editorWriteHere: 'Write here...',
    editorSavedToFavorites: 'Saved to Favorites',
    editorSaveToFavorites: 'Save to Favorites',
    editorCardColor: 'Card color',
    editorHighlightColor: 'Highlight color',
    editorPenColor: 'Pen color',
    editorPenSize: 'Pen size',
    editorUndoStroke: 'Undo stroke',
    editorClearDrawing: 'Clear drawing',
    editorPickVerseToStart: 'Pick a verse to start',
    editorVerseNumber: 'Verse {{number}}',
    editorChapterNumber: 'Chapter {{number}}',
    editorChapterShort: 'Ch {{number}}',
    editorAddToFavorites: 'Add to Favorites',
    editorExportToImages: 'Export to Images',
    editorSaveTo: 'Save to',
    editorDecorateVerseInStudio: 'Decorate this verse in Studio',
    editorLock: 'Lock',
    editorUnlock: 'Unlock',
    editorUnlockStudio: 'Unlock Studio',
    editorLockStudio: 'Lock Studio',
    editorUndoLastEdit: 'Undo last edit',
    editorSavingImage: 'Saving image',
    editorSharingImage: 'Sharing image',
    editorSavedImage: 'Saved image',
    editorSavedToTarget: 'Saved to {{target}} as "{{title}}"',
    editorAddSomethingFirst: 'Add something first',
    editorAddedToFavorites: 'Added to Favorites',
    editorCloudSavedReviewSync: 'Cloud saved, review sync',
    editorSavedToCloud: 'Saved to cloud',
    editorNoteStyleTitle: 'Note style',
    editorUseNoteStyleAccessibility: 'Use {{style}} note style',
    editorMoreNoteStylesInShop: 'More note styles in Shop',
    editorNoteStyleButter: 'Butter',
    editorNoteStyleRose: 'Rose',
    editorNoteStyleSage: 'Sage',
    editorNoteStyleSky: 'Sky',
    editorNoteStyleLinen: 'Linen',
    editorNoteStylePeach: 'Peach',
    editorNoteStyleCoral: 'Coral',
    editorNoteStyleHoney: 'Honey',
    editorNoteStyleMint: 'Mint',
    editorNoteStyleSeafoam: 'Seafoam',
    editorNoteStyleCocoa: 'Cocoa',
    editorNoteStyleBlush: 'Blush',
    editorNoteStyleDusk: 'Dusk',
    journalPrayerPromptPrayingFor: "What I'm praying for",
    journalPrayerPromptThankfulFor: "What I'm thankful for",
    journalPrayerPromptHeart: "What's on my heart",
    journalPrayerPromptPeace: 'Give me peace about',
    journalPrayerPromptAnswered: 'Answered prayers',
    journalBibleStudyPromptStandsOut: 'What stands out',
    journalBibleStudyPromptMeans: 'What it means',
    journalBibleStudyPromptApply: 'How I can apply it',
    journalBibleStudyPromptPrayer: 'Prayer response',
    journalChurchPromptMessage: 'Key message',
    journalChurchPromptSpoke: 'How this spoke to me',
    journalChurchPromptPrayer: 'Prayer for this week',
    journalDailyPromptReflections: 'Reflections',
    journalDailyPromptApplication: 'Application to my life',
    journalDailyPromptQuestions: 'Questions',
    journalDailyPromptKeyVerses: 'Key verses',
    journalDailyPromptPrayer: 'Prayer of the day',
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
    settingsAccount: 'Cuenta',
    settingsAccountSubtitle: 'Inicia sesión para sincronizar dispositivos en el futuro',
    settingsAccountEmail: 'Correo electrónico',
    settingsAccountPassword: 'Contraseña',
    settingsAccountSignedIn: 'Sesión iniciada',
    settingsAccountSyncStatus: 'Sincronización: próximamente',
    settingsAccountAction: 'Iniciar sesión',
    settingsAccountCreateAction: 'Crear cuenta',
    settingsAccountCreateSubtitle: 'Crea una cuenta para sincronizar iPad y otros dispositivos en el futuro',
    settingsAccountConfirmPassword: 'Confirmar contraseña',
    settingsAccountSignOut: 'Cerrar sesión',
    settingsAccountSaved: 'Cuenta guardada',
    settingsAccountCreated: 'Cuenta creada',
    settingsAccountEmailError: 'Ingresa un correo electrónico válido.',
    settingsAccountPasswordError: 'Usa al menos 8 caracteres.',
    settingsAccountPasswordMatchError: 'Las contraseñas deben coincidir.',
    settingsCloudSave: 'Guardado en la nube',
    settingsCloudSaveUnavailableTitle: 'Guardado en la nube desactivado para el lanzamiento',
    settingsCloudSaveUnavailableText:
      'Faith Canvas guarda diarios, favoritos, arte bíblico y ajustes en este dispositivo para el lanzamiento. Un flujo de Guardado en la nube aprobado por padres puede agregarse después.',
    settingsUsername: 'Nombre de usuario',
    settingsSecretPhrase: 'Frase secreta',
    settingsPhrasePlaceholder: 'Ingresa la frase secreta',
    settingsPhraseWarning: 'No pierdas la frase. No se puede recuperar.',
    settingsSyncLogTitle: 'Registro de guardado en la nube',
    settingsSyncLogEmpty: 'Todavía no hay subidas ni descargas.',
    settingsAppearance: 'Apariencia',
    settingsColors: 'Colores',
    settingsLanguage: 'Idioma',
    settingsPhraseHint: 'Guarda tu diario con una frase secreta.',
    settingsPhraseShow: 'Mostrar frase',
    settingsPhraseHide: 'Ocultar frase',
    settingsSyncConnect: 'Conectar',
    settingsSyncNow: 'Sincronizar ahora',
    settingsDisconnect: 'Desconectar este dispositivo',
    settingsBibleReadingTitle: 'Lectura bíblica',
    settingsBibleVersionTitle: 'Versión de la Biblia',
    settingsBibleVersionHint:
      'Elige el texto bíblico usado para lectura, búsqueda y arte de versículos.',
    settingsBibleVersionAttribution: 'Texto bíblico: {{attribution}}',
    settingsBibleReadingImages: 'Imágenes de lectura bíblica Beta',
    settingsBibleReadingImagesHint:
      'Beta: mostrar imágenes suaves de los capítulos de Génesis al leer.',
    settingsBibleProgressTitle: '% de la Biblia leída',
    settingsBibleProgressHint: '{{read}} de {{total}} versículos abiertos',
    settingsDataPrivacy: 'Datos y privacidad',
    settingsDataSafety: 'Seguridad de datos',
    settingsJournalBackupTitle: 'Respaldo del diario',
    settingsJournalBackupHint:
      'Exporta tus entradas antes de cambiar de dispositivo o borrar datos locales.',
    settingsExportJournalData: 'Exportar datos del diario',
    settingsResetJournalData: 'Restablecer datos del diario',
    settingsResetTitle: '¿Restablecer datos del diario?',
    settingsResetMessage:
      'Esto borra todas las entradas locales, favoritos y diseños de versículos de este dispositivo.',
    settingsResetSuccess: 'Se restablecieron las entradas, favoritos y diseños de versículos.',
    settingsResetError: 'No se pudieron restablecer los datos del diario.',
    settingsUsernameShuffle: 'Crear otro nombre de usuario',
    settingsUsernameChangeTitle: '¿Cambiar nombre de usuario?',
    settingsUsernameChangeMessage:
      '¿Cambiar tu nombre de usuario de Guardado en la nube de {{currentUsername}} a {{nextUsername}}? Tus archivos guardados seguirán conectados.',
    settingsUsernameChangeAction: 'Cambiar',
    settingsExportDownloaded: 'Respaldo del diario descargado.',
    settingsExportReady: 'El respaldo del diario está listo para guardar o compartir.',
    settingsExportError: 'No se pudo preparar el respaldo del diario.',
    settingsSyncErrorUsernamePhraseMismatch:
      'Ese nombre de usuario y frase secreta no coinciden.',
    settingsSyncErrorUsernameTaken: 'Ese nombre de usuario ya está usado. Prueba cambiarlo un poco.',
    settingsSyncErrorPhraseMismatch: 'Esa frase secreta no coincide con este dispositivo.',
    settingsSyncErrorReconnect:
      'Guardado en la nube necesita reconectarse. Ingresa tu frase secreta otra vez.',
    settingsSyncErrorEnterPhrase: 'Ingresa tu frase secreta primero.',
    settingsSyncErrorTimedOut:
      'Guardado en la nube no pudo comunicarse con el servidor. Revisa la conexión e inténtalo de nuevo.',
    settingsCloudConnectedNothingNew: 'Guardado en la nube está conectado. No hay nada nuevo que guardar.',
    settingsCloudSavedCount: '{{count}} guardado(s)',
    settingsCloudDownloadedCount: '{{count}} descargado(s)',
    settingsCloudRemovedCount: '{{count}} eliminado(s)',
    settingsSyncConflictNeedsCheck:
      '{{count}} cosas guardadas necesitan una revisión rápida.',
    settingsSyncConflictNeedsCheckOne:
      '{{count}} cosa guardada necesita una revisión rápida.',
    settingsSyncConnectedGotStuck:
      'Guardado en la nube se conectó, pero la sincronización se trabó. Toca Sincronizar ahora para intentar otra vez.',
    settingsSyncConnectedFinishNeeded:
      'Guardado en la nube está conectado. La sincronización aún necesita terminar.',
    settingsUsernameTooShort: 'Elige un nombre de usuario con al menos 3 letras o números.',
    settingsSyncStarting: 'Iniciando Guardado en la nube...',
    settingsSyncConnecting: 'Conectando Guardado en la nube...',
    settingsSyncProtectingPhrase: 'Protegiendo tu frase secreta...',
    settingsSyncConnectedBackground: 'Conectado. Sincronizando en segundo plano.',
    settingsSyncUsernameChangedBackground: 'Nombre de usuario cambiado. Sincronizando en segundo plano.',
    settingsSyncBackground: 'Sincronizando en segundo plano.',
    settingsSyncCheckingUsername: 'Revisando nombre de usuario...',
    settingsSyncSavingUsername: 'Guardando nombre de usuario...',
    settingsSyncGotStuck: 'Guardado en la nube se trabó. Inténtalo de nuevo.',
    settingsSyncLogLoading: 'Cargando registro de Guardado en la nube...',
    settingsSyncLogNothing: 'Todavía no se ha guardado ni descargado nada.',
    settingsSyncLogLoaded: 'Registro de Guardado en la nube cargado.',
    settingsSyncLogLoadError: 'No se pudo cargar el registro de Guardado en la nube.',
    settingsSyncConflictEnterPhrase: 'Ingresa tu frase secreta para arreglar esto.',
    settingsSyncConflictFixing: 'Arreglando versiones guardadas...',
    settingsSyncConflictPicked: 'Versión guardada elegida.',
    settingsSyncConflictPickError: 'No se pudo elegir esa versión.',
    settingsSyncConflictBothSaving: 'Guardando ambas versiones...',
    settingsSyncConflictBothSaved: 'Ambas versiones fueron guardadas.',
    settingsSyncConflictBothError: 'No se pudieron guardar ambas versiones.',
    settingsSyncDownload: 'Descarga',
    settingsSyncUpload: 'Subida',
    settingsSyncItemCount: '{{count}} elemento',
    settingsSyncItemCountPlural: '{{count}} elementos',
    settingsConflictPickTitle: 'Elige la versión que quieres',
    settingsConflictSubtitle: 'Esto se guardó en más de un dispositivo.',
    settingsConflictPick: 'Elegir',
    settingsConflictKeepBoth: 'Conservar ambas',
    settingsAboutTitle: 'Ayuda',
    settingsAboutImageLabel: 'Icono de la app Faith Canvas',
    settingsAboutAppName: 'Faith Canvas',
    settingsAboutVersion: 'Version 1.0.0 • PidPod, la marca de aplicaciones de Bumfuzzle Inc., una corporacion de Tennessee',
    settingsAboutRatingTitle: 'Por que las tiendas marcan clasificacion Teen',
    settingsAboutRatingBody:
      'Apple y Google clasifican Faith Canvas como Teen (alrededor de 13+) porque la Biblia incluye algunos pasajes violentos, maduros o graficos. La app sigue siendo un diario suave, sin anuncios, chat ni feed social. Un padre o tutor debe decidir que libros y versiculos lee un nino.',
    settingsPrivacyLocal: 'Tu diario, favoritos, arte de versiculos y configuracion se quedan en este dispositivo a menos que elijas Guardado en la nube.',
    settingsPrivacyCloud: 'Guardado en la nube está desactivado para el lanzamiento, así que el contenido guardado permanece en este dispositivo a menos que lo exportes.',
    settingsPrivacyNoAds: 'Sin anuncios de terceros, perfiles publicos, seguidores, chat abierto ni feed social.',
    settingsPrivacyPolicy: 'Politica de privacidad',
    settingsChildSafety: 'Seguridad infantil',
    settingsSupport: 'Soporte',
    settingsSupportEmail: 'Enviar correo a support@pidpod.com',
    colorHint: 'Suave, dulce y agradable para la vista',
    languageHint: 'Usa este idioma como predeterminado de la app',
    languageEnglish: 'Inglés',
    languageSpanish: 'Español',
    bibleTitle: 'Biblia ✨',
    bibleSubtitle: 'Encuentra un versículo para crear',
    searchPlaceholder: 'Buscar "John 3:16"',
    searchMatchesTitle: 'Resultados de búsqueda',
    searchResultCount: '{{count}} resultados para "{{query}}"',
    searchNoResultsTitle: 'No se encontraron versículos',
    searchNoResultsText: 'Prueba con un versículo como John 3:16 u otra palabra para "{{query}}".',
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
    breatheTitle: 'Respira',
    breatheSubtitle: 'Haz una pausa con Dios por un minuto tranquilo.',
    breatheVerseLabel: 'Versículo tranquilo',
    breatheVerseReference: 'Salmo 46:10',
    breatheVerseText: 'Estad quietos, y conoced que yo soy Dios.',
    breatheStepInhale: 'Respira',
    breatheStepHold: 'Sostén suave',
    breatheStepExhale: 'Suelta',
    breatheStepRest: 'Descansa',
    breathePrayerTitle: 'Una oración pequeña',
    breathePrayerText: 'Jesús, calma mi mente y ayúdame a sentirme segura contigo.',
    breathePrimaryAction: 'Escribir oración',
    breatheSecondaryAction: 'Elegir versículo para arte',
    studioBackToDesigns: 'Ir a diseños de versículos',
    studioStartOver: 'Empezar de nuevo',
    studioStartOverToast: 'Empezado de nuevo',
    studioDiscardNewPage: 'Descartar y nueva página',
    studioDiscardNewPageTitle: '¿Descartar esta página?',
    studioDiscardNewPageMessage:
      'Abre una página en blanco de Estudio. Se perderán los cambios no guardados de esta página. Lo que ya esté guardado en Diario se queda.',
    studioDiscardConfirm: 'Descartar',
    studioVerseReferenceLabel: 'Referencia',
    studioVerseReferenceNumber: 'Versículo #',
    studioVerseReferenceNone: 'Ocultar número',
    studioVerseReferenceFull: 'Libro + capítulo:versículo',
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
    homeOpenInStudio: 'Abrir en Estudio',
    homeReflect: 'Reflexionar',
    homeDayStreak: 'racha de {{count}} día',
    homeDayStreakPlural: 'racha de {{count}} días',
    homeTodayCount: '{{count}} hoy',
    homeStartToday: 'Empieza hoy',
    homeNoEntryYet: 'Aún no hay entrada',
    homeQuickPrayer: 'Oración',
    homeQuickDevotional: 'Devocional',
    homeWordsFromGod: 'Palabras de Dios',
    homePickWhatFits: 'Elige lo que encaja',
    homeWordsIntro: 'Encuentra un versículo para tu corazón, o crea uno para animar a alguien más.',
    homeForMe: 'Para mí',
    homeHelpSomeone: 'Quiero ayudar a alguien',
    homeContinueToday: 'Continuar hoy',
    homeRecentWork: 'Trabajo reciente',
    homeRemoveFromRecent: 'Quitar de Recientes',
    homeRemoveFromRecentAccessibility: 'Quitar {{title}} de Trabajo reciente',
    homeThisWeek: '{{count}} esta semana',
    homeKeepWriting: 'Abrir para seguir escribiendo...',
    journalNewEntryTab: 'Nueva entrada',
    journalDailyLogsTab: 'Registros diarios',
    journalPrayerSubtitle: 'Habla con Dios y escribe lo que hay en tu corazón.',
    journalBibleStudySubtitle: 'Profundiza en un versículo y guarda lo que aprendes.',
    journalChurchSubtitle: 'Guarda notas del sermón, versículos clave y reflexiones.',
    journalDailyDevotionalSubtitle: 'Reflexiona, aplica, haz preguntas y ora cada día.',
    journalStudioSubtitle: 'Abre una página creativa con tarjetas de versículos y stickers.',
    journalWeekWithGod: 'Tu semana con Dios',
    journalDays: 'días',
    journalEntries: 'entradas',
    journalEntry: 'entrada',
    journalSaved: 'guardado',
    journalMood: 'ánimo',
    journalNotYet: 'Todavía no',
    journalEmptyLogsTitle: 'Aún no hay registros diarios',
    journalEmptyLogsText: 'Crea una entrada del diario y aparecerá aquí por fecha.',
    journalBlank: 'Diario en blanco',
    journalNewPage: '+ Nueva página',
    favoritesSearchPlaceholder: 'Buscar entradas guardadas',
    favoritesClearSearch: 'Borrar búsqueda de entradas guardadas',
    favoritesNoSearchResultsTitle: 'No se encontraron entradas guardadas',
    favoritesNoSearchResultsText: 'Prueba otra palabra, frase, referencia o tipo de diario.',
    moodAngry: 'Enojada con alguien',
    moodSad: 'Triste',
    moodAnxious: 'Ansiosa',
    moodForgiving: 'Necesito perdonar',
    moodGrateful: 'Agradecida',
    moodEncouraged: 'Animar a alguien',
    moodPeaceful: 'Compartir paz',
    moodComfortSomeone: 'Consolar a alguien',
    moodGiveCourage: 'Dar valor',
    moodDirection: 'Necesito dirección',
    moodConfused: 'Confundida',
    moodPeacefulJournal: 'En paz',
    moodTired: 'Cansada',
    moodHappy: 'Feliz',
    moodAngrySuggestion: 'Empieza con un versículo que te ayude a bajar la velocidad antes de responder.',
    moodSadSuggestion: 'Abre un versículo de consuelo y ora con honestidad en la tristeza.',
    moodAnxiousSuggestion: 'Abre un versículo de paz y entrega la preocupación a Dios paso a paso.',
    moodForgivingSuggestion: 'Abre un versículo sobre perdón sin fingir que el dolor no importó.',
    moodGratefulSuggestion: 'Abre un versículo de gratitud y recuerda lo que Dios ya ha hecho.',
    moodEncouragedSuggestion: 'Crea un versículo que dirija a alguien hacia el amor y las buenas obras.',
    moodPeacefulSuggestion: 'Crea un versículo tranquilo para alguien que necesita paz.',
    moodComfortSomeoneSuggestion: 'Crea un versículo de consuelo para alguien que está sufriendo.',
    moodGiveCourageSuggestion: 'Crea un versículo de valor para alguien que necesita sentirse menos sola.',
    moodDirectionSuggestion: 'Abre un versículo de guía cuando necesites confiar en el próximo paso.',
    moodOpenForgivenessVerse: 'Abrir versículo de perdón',
    moodOpenComfortVerse: 'Abrir versículo de consuelo',
    moodOpenPeaceVerse: 'Abrir versículo de paz',
    moodOpenForgivenessStudy: 'Abrir estudio de perdón',
    moodSaveGratitudeVerse: 'Guardar versículo de gratitud',
    moodMakeEncouragementArt: 'Crear arte de ánimo',
    moodMakePeaceVerse: 'Crear versículo de paz',
    moodMakeComfortVerse: 'Crear versículo de consuelo',
    moodMakeCourageVerse: 'Crear versículo de valor',
    moodOpenGuidanceVerse: 'Abrir versículo de guía',
    favoritesTitle: '💖 Favoritos',
    favoritesSubtitle: 'Oraciones, notas y diseños de versículos guardados',
    favoritesDeleteTitle: '¿Eliminar favorito guardado?',
    favoritesDeleteMessage: 'Esto quitará este favorito guardado de este dispositivo.',
    favoritesDeleteAccessibility: 'Eliminar favorito guardado',
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
    shopFeatureTitle: 'Colección creativa',
    shopFeatureText: 'Fondos incluidos, stickers y vistas previas creativas para tus páginas.',
    shopPreview: 'Vista previa',
    shopSelected: 'Seleccionado',
    shopIncluded: 'Incluido',
    shopIncludedNote: 'Este paquete está listo para usar en Estudio y en herramientas del diario.',
    shopPreviewNote: 'Esta idea es una vista previa para futuras herramientas y aún no está en venta.',
    shopShelfTitle: 'Colección creativa',
    shopSupplyCount: '{{count}} recursos',
    shopCategoryAll: 'Todo',
    shopCategoryCanvas: 'Lienzos',
    shopCategoryNoteStyles: 'Estilos de nota',
    shopCategoryThemes: 'Temas',
    shopCategoryDecor: 'Decoración',
    shopCategoryStickers: 'Stickers',
    shopCategoryTools: 'Herramientas',
    shopCategoryBundle: 'Paquete',
    shopPackPreviewSoon: 'Vista previa del paquete próximamente',
    shopViewBackgrounds: 'Ver fondos',
    shopViewStickers: 'Ver stickers',
    shopOwned: 'Adquirido',
    shopLocked: 'Bloqueado',
    shopUnlock: 'Desbloquear',
    shopBuyPrice: 'Comprar {{price}}',
    shopUseInStudio: 'Usar en Estudio',
    shopSavedPreview: 'Vista guardada',
    shopViewPreview: 'Ver vista previa',
    shopPurchaseNotConnected: 'Las compras aún no están conectadas, así que este paquete no se desbloqueó.',
    shopPurchaseLoading: 'Conectando con la tienda...',
    shopPurchaseSuccess: 'Paquete desbloqueado. Ya está listo para usar en Estudio y diarios.',
    shopPurchaseCancelled: 'Compra cancelada.',
    shopPurchaseUnavailable:
      'Las compras aún no están listas en este dispositivo. Un padre puede intentarlo de nuevo cuando termine la configuración de la tienda.',
    shopPurchaseFailed: 'La compra no terminó. Inténtalo otra vez.',
    shopRestorePurchases: 'Restaurar',
    shopRestoreLoading: 'Revisando compras...',
    shopRestoreSuccess: 'Compras restauradas.',
    shopRestoreEmpty: 'No se encontraron compras anteriores de la Tienda para esta cuenta.',
    shopRestoreFailed: 'No se pudieron restaurar las compras. Inténtalo otra vez.',
    shopPreviewSavedToolsPending: 'Esta vista previa está guardada, pero sus herramientas creativas aún no están listas.',
    shopPreviewLocalShelf: 'Esta vista previa está en tu colección local. Sus herramientas aún deben construirse antes de aparecer en Estudio.',
    shopUnlockParentApproval: 'Desbloquear requerirá una compra o aprobación de un padre cuando los pagos estén conectados.',
    shopEmptyTitle: 'Todavía no aparece nada aquí',
    shopEmptyText: 'Prueba otra categoría mientras esta colección se sigue llenando.',
    actionCancel: 'Cancelar',
    actionDelete: 'Eliminar',
    actionDone: 'Listo',
    actionSave: 'Guardar',
    actionSaveImage: 'Guardar imagen',
    actionShare: 'Compartir',
    actionStartOver: 'Empezar de nuevo',
    actionUndo: 'Deshacer',
    actionSaveToCloud: 'Guardar en la nube',
    actionSaving: 'Guardando...',
    commonBook: 'Libro',
    commonChapter: 'Capítulo',
    commonVerse: 'Versículo',
    commonSelect: 'Seleccionar',
    commonRead: 'Leído',
    commonUnread: 'Sin leer',
    commonChapters: 'capítulos',
    commonStudio: 'Estudio',
    bibleSearchAccessibility: 'Buscar en la Biblia',
    bibleClearSearchAccessibility: 'Borrar búsqueda',
    bibleHighlightUnread: 'Resaltar sin leer',
    bibleHighlightUnreadAccessibility: 'Resaltar versículos sin leer',
    bibleHideRead: 'Ocultar leídos',
    bibleHideReadAccessibility: 'Ocultar versículos y libros leídos',
    bibleBookProgress: '{{read}}/{{total}} leídos',
    bibleUnreadCount: '{{count}} sin leer',
    bibleChapterUnreadCount: '{{count}} sin leer',
    bibleBackToBooks: 'Libros',
    bibleBackToBooksAccessibility: 'Volver a libros de la Biblia',
    bibleReaderGenesisSubtitle:
      'Desplázate por Génesis. Las imágenes suaves aparecen al inicio de cada capítulo.',
    bibleReaderVerseSubtitle:
      'Desplázate para leer. Toca Estudio en cualquier versículo cuando quieras crear algo.',
    bibleSendToStudioAccessibility: 'Enviar {{reference}} a Estudio',
    bibleEverythingVisibleRead: 'Todo lo visible está leído',
    bibleShowCompletedBooks: 'Desactiva Ocultar leídos para ver libros completados otra vez.',
    bibleShowSelectorAccessibility: 'Mostrar selector de capítulo y versículo para {{reference}}',
    bibleAllVersesRead: 'Todos los versículos de este capítulo están leídos.',
    cloudSaveModalBody: 'Tu diario se bloquea antes de guardarse.',
    cloudSaveExistingSessionPrompt: 'Ingresa tu frase secreta para guardar este dispositivo.',
    cloudSaveNewSessionPrompt: 'Ingresa tu frase secreta para activar Guardado en la nube.',
    cloudSavePhraseMismatch: 'Esa frase no coincide con este dispositivo.',
    cloudSaveReconnect: 'Guardado en la nube necesita reconectarse. Ingresa tu frase secreta otra vez.',
    cloudSaveEnterPhrase: 'Ingresa tu frase secreta primero.',
    cloudSaveGenericError: 'No se pudo guardar en la nube.',
    cloudSaveConflictMessage: 'Guardado en la nube. Algunas cosas necesitan revisión en Configuración.',
    cloudSaveSuccessCount: '{{count}} cosas guardadas en la nube.',
    cloudSaveSuccessCountOne: '{{count}} cosa guardada en la nube.',
    editorText: 'Texto',
    editorDecor: 'Decorar',
    editorCanvas: 'Lienzo',
    editorNote: 'Nota',
    editorDraw: 'Dibujar',
    editorMore: 'Más',
    editorBasic: 'Básico',
    editorLined: 'Con líneas',
    editorPlain: 'Simple',
    editorQuickStickers: 'Stickers rápidos',
    editorAddMoreDecor: 'Agregar más',
    editorWriteHere: 'Escribe aquí...',
    editorSavedToFavorites: 'Guardado en Favoritos',
    editorSaveToFavorites: 'Guardar en Favoritos',
    editorCardColor: 'Color de tarjeta',
    editorHighlightColor: 'Color de resaltado',
    editorPenColor: 'Color de pluma',
    editorPenSize: 'Tamaño de pluma',
    editorUndoStroke: 'Deshacer trazo',
    editorClearDrawing: 'Borrar dibujo',
    editorPickVerseToStart: 'Elige un versículo para empezar',
    editorVerseNumber: 'Versículo {{number}}',
    editorChapterNumber: 'Capítulo {{number}}',
    editorChapterShort: 'Cap. {{number}}',
    editorAddToFavorites: 'Agregar a Favoritos',
    editorExportToImages: 'Exportar a imágenes',
    editorSaveTo: 'Guardar en',
    editorDecorateVerseInStudio: 'Decorar este versículo en Estudio',
    editorLock: 'Bloquear',
    editorUnlock: 'Desbloquear',
    editorUnlockStudio: 'Desbloquear Estudio',
    editorLockStudio: 'Bloquear Estudio',
    editorUndoLastEdit: 'Deshacer último cambio',
    editorSavingImage: 'Guardando imagen',
    editorSharingImage: 'Compartiendo imagen',
    editorSavedImage: 'Imagen guardada',
    editorSavedToTarget: 'Guardado en {{target}} como "{{title}}"',
    editorAddSomethingFirst: 'Agrega algo primero',
    editorAddedToFavorites: 'Agregado a Favoritos',
    editorCloudSavedReviewSync: 'Nube guardada, revisa sincronización',
    editorSavedToCloud: 'Guardado en la nube',
    editorNoteStyleTitle: 'Estilo de nota',
    editorUseNoteStyleAccessibility: 'Usar estilo de nota {{style}}',
    editorMoreNoteStylesInShop: 'Más estilos de nota en Tienda',
    editorNoteStyleButter: 'Mantequilla',
    editorNoteStyleRose: 'Rosa',
    editorNoteStyleSage: 'Salvia',
    editorNoteStyleSky: 'Cielo',
    editorNoteStyleLinen: 'Lino',
    editorNoteStylePeach: 'Durazno',
    editorNoteStyleCoral: 'Coral',
    editorNoteStyleHoney: 'Miel',
    editorNoteStyleMint: 'Menta',
    editorNoteStyleSeafoam: 'Espuma de mar',
    editorNoteStyleCocoa: 'Cacao',
    editorNoteStyleBlush: 'Rubor',
    editorNoteStyleDusk: 'Atardecer',
    journalPrayerPromptPrayingFor: 'Por lo que estoy orando',
    journalPrayerPromptThankfulFor: 'Por lo que doy gracias',
    journalPrayerPromptHeart: 'Lo que hay en mi corazón',
    journalPrayerPromptPeace: 'Dame paz sobre',
    journalPrayerPromptAnswered: 'Oraciones respondidas',
    journalBibleStudyPromptStandsOut: 'Lo que resalta',
    journalBibleStudyPromptMeans: 'Lo que significa',
    journalBibleStudyPromptApply: 'Cómo puedo aplicarlo',
    journalBibleStudyPromptPrayer: 'Respuesta en oración',
    journalChurchPromptMessage: 'Mensaje principal',
    journalChurchPromptSpoke: 'Cómo me habló esto',
    journalChurchPromptPrayer: 'Oración para esta semana',
    journalDailyPromptReflections: 'Reflexiones',
    journalDailyPromptApplication: 'Aplicación a mi vida',
    journalDailyPromptQuestions: 'Preguntas',
    journalDailyPromptKeyVerses: 'Versículos clave',
    journalDailyPromptPrayer: 'Oración del día',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;
type TranslationParams = Record<string, string | number>;

type AppSettingsContextValue = {
  colorTheme: ColorTheme;
  colorThemes: ColorTheme[];
  language: AppLanguage;
  languages: AppLanguage[];
  bibleVersionKey: BibleVersionKey;
  bibleVersionOptions: BibleVersionOption[];
  bibleReadingImagesEnabled: boolean;
  setColorThemeKey: (key: ColorThemeKey) => void;
  setLanguageKey: (key: AppLanguageKey) => void;
  setBibleVersionKey: (key: BibleVersionKey) => void;
  setBibleReadingImagesEnabled: (enabled: boolean) => void;
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
const DEFAULT_BIBLE_READING_IMAGES_ENABLED = false;

type StoredAppSettings = {
  colorThemeKey?: ColorThemeKey;
  languageKey?: AppLanguageKey;
  bibleVersionKeys?: Partial<Record<AppLanguageKey, BibleVersionKey>>;
  bibleReadingImagesEnabled?: boolean;
};

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
  const [bibleVersionKeysByLanguage, setBibleVersionKeysByLanguage] = useState<
    Record<AppLanguageKey, BibleVersionKey>
  >({
    en: getDefaultBibleVersionKey('en'),
    es: getDefaultBibleVersionKey('es'),
  });
  const [bibleReadingImagesEnabled, setBibleReadingImagesEnabledState] = useState(
    DEFAULT_BIBLE_READING_IMAGES_ENABLED
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const settingsRef = useRef<Required<StoredAppSettings>>({
    colorThemeKey: DEFAULT_COLOR_THEME_KEY,
    languageKey: DEFAULT_LANGUAGE_KEY,
    bibleVersionKeys: {
      en: getDefaultBibleVersionKey('en'),
      es: getDefaultBibleVersionKey('es'),
    },
    bibleReadingImagesEnabled: DEFAULT_BIBLE_READING_IMAGES_ENABLED,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);

        if (!storedSettings) {
          setIsLoaded(true);
          return;
        }

        const parsedSettings = JSON.parse(storedSettings) as StoredAppSettings;

        if (parsedSettings.colorThemeKey) {
          settingsRef.current.colorThemeKey = parsedSettings.colorThemeKey;
          setColorThemeKeyState(parsedSettings.colorThemeKey);
        }

        if (parsedSettings.languageKey) {
          settingsRef.current.languageKey = parsedSettings.languageKey;
          setLanguageKeyState(parsedSettings.languageKey);
        }

        if (parsedSettings.bibleVersionKeys) {
          const nextBibleVersionKeys = {
            en: normalizeBibleVersionKey('en', parsedSettings.bibleVersionKeys.en),
            es: normalizeBibleVersionKey('es', parsedSettings.bibleVersionKeys.es),
          };
          settingsRef.current.bibleVersionKeys = nextBibleVersionKeys;
          setBibleVersionKeysByLanguage(nextBibleVersionKeys);
        }

        if (typeof parsedSettings.bibleReadingImagesEnabled === 'boolean') {
          settingsRef.current.bibleReadingImagesEnabled =
            parsedSettings.bibleReadingImagesEnabled;
          setBibleReadingImagesEnabledState(parsedSettings.bibleReadingImagesEnabled);
        }
      } catch (error) {
        console.log('Error loading app settings:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    void loadSettings();
  }, []);

  const persistSettings = (nextSettings: StoredAppSettings) => {
    settingsRef.current = {
      ...settingsRef.current,
      ...nextSettings,
      bibleVersionKeys: nextSettings.bibleVersionKeys
        ? {
            ...settingsRef.current.bibleVersionKeys,
            ...nextSettings.bibleVersionKeys,
          }
        : settingsRef.current.bibleVersionKeys,
    };

    void AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(settingsRef.current)
    ).catch((error) => {
      console.log('Error saving app settings:', error);
    });
  };

  const setColorThemeKey = (key: ColorThemeKey) => {
    setColorThemeKeyState(key);
    persistSettings({ colorThemeKey: key });
  };

  const setLanguageKey = (key: AppLanguageKey) => {
    setLanguageKeyState(key);
    persistSettings({ languageKey: key });
  };

  const setBibleVersionKey = (key: BibleVersionKey) => {
    const nextVersionKey = normalizeBibleVersionKey(languageKey, key);
    const nextBibleVersionKeys = {
      ...bibleVersionKeysByLanguage,
      [languageKey]: nextVersionKey,
    };

    setBibleVersionKeysByLanguage(nextBibleVersionKeys);
    persistSettings({ bibleVersionKeys: nextBibleVersionKeys });
  };

  const setBibleReadingImagesEnabled = (enabled: boolean) => {
    setBibleReadingImagesEnabledState(enabled);
    persistSettings({ bibleReadingImagesEnabled: enabled });
  };

  const bibleVersionKey = normalizeBibleVersionKey(
    languageKey,
    bibleVersionKeysByLanguage[languageKey]
  );

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      colorTheme: getColorThemeByKey(colorThemeKey),
      colorThemes: COLOR_THEMES,
      language: getLanguageByKey(languageKey),
      languages: LANGUAGES,
      bibleVersionKey,
      bibleVersionOptions: getBibleVersionOptions(languageKey),
      bibleReadingImagesEnabled,
      setColorThemeKey,
      setLanguageKey,
      setBibleVersionKey,
      setBibleReadingImagesEnabled,
      t: (key, params) => translate(languageKey, key, params),
      isLoaded,
    }),
    [colorThemeKey, languageKey, bibleVersionKey, bibleReadingImagesEnabled, isLoaded]
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
