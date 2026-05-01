export type VerseContent = {
  reference: string;
  text: string;
};

export const VERSES: VerseContent[] = [
  {
    reference: 'John 3',
    text:
      'For God so loved the world that He gave His only Son, that whoever believes in Him should not perish but have eternal life.',
  },
];

export const DEFAULT_VERSE_REFERENCE = VERSES[0].reference;

export function getVerseByReference(reference: string): VerseContent {
  return VERSES.find((verse) => verse.reference === reference) ?? VERSES[0];
}
