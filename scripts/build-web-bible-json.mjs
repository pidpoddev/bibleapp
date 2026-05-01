import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BOOKS = [
  ['genesis', 'Genesis'],
  ['exodus', 'Exodus'],
  ['leviticus', 'Leviticus'],
  ['numbers', 'Numbers'],
  ['deuteronomy', 'Deuteronomy'],
  ['joshua', 'Joshua'],
  ['judges', 'Judges'],
  ['ruth', 'Ruth'],
  ['1samuel', '1 Samuel'],
  ['2samuel', '2 Samuel'],
  ['1kings', '1 Kings'],
  ['2kings', '2 Kings'],
  ['1chronicles', '1 Chronicles'],
  ['2chronicles', '2 Chronicles'],
  ['ezra', 'Ezra'],
  ['nehemiah', 'Nehemiah'],
  ['esther', 'Esther'],
  ['job', 'Job'],
  ['psalms', 'Psalms'],
  ['proverbs', 'Proverbs'],
  ['ecclesiastes', 'Ecclesiastes'],
  ['songofsolomon', 'Song of Solomon'],
  ['isaiah', 'Isaiah'],
  ['jeremiah', 'Jeremiah'],
  ['lamentations', 'Lamentations'],
  ['ezekiel', 'Ezekiel'],
  ['daniel', 'Daniel'],
  ['hosea', 'Hosea'],
  ['joel', 'Joel'],
  ['amos', 'Amos'],
  ['obadiah', 'Obadiah'],
  ['jonah', 'Jonah'],
  ['micah', 'Micah'],
  ['nahum', 'Nahum'],
  ['habakkuk', 'Habakkuk'],
  ['zephaniah', 'Zephaniah'],
  ['haggai', 'Haggai'],
  ['zechariah', 'Zechariah'],
  ['malachi', 'Malachi'],
  ['matthew', 'Matthew'],
  ['mark', 'Mark'],
  ['luke', 'Luke'],
  ['john', 'John'],
  ['acts', 'Acts'],
  ['romans', 'Romans'],
  ['1corinthians', '1 Corinthians'],
  ['2corinthians', '2 Corinthians'],
  ['galatians', 'Galatians'],
  ['ephesians', 'Ephesians'],
  ['philippians', 'Philippians'],
  ['colossians', 'Colossians'],
  ['1thessalonians', '1 Thessalonians'],
  ['2thessalonians', '2 Thessalonians'],
  ['1timothy', '1 Timothy'],
  ['2timothy', '2 Timothy'],
  ['titus', 'Titus'],
  ['philemon', 'Philemon'],
  ['hebrews', 'Hebrews'],
  ['james', 'James'],
  ['1peter', '1 Peter'],
  ['2peter', '2 Peter'],
  ['1john', '1 John'],
  ['2john', '2 John'],
  ['3john', '3 John'],
  ['jude', 'Jude'],
  ['revelation', 'Revelation'],
];

function normalizeVerseText(parts) {
  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .trim();
}

function buildBook(rawEntries, book) {
  const chapterMap = new Map();

  for (const entry of rawEntries) {
    if (
      entry?.type !== 'paragraph text' &&
      entry?.type !== 'line text'
    ) {
      continue;
    }

    const chapterNumber = Number(entry.chapterNumber);
    const verseNumber = Number(entry.verseNumber);
    const value = typeof entry.value === 'string' ? entry.value.trim() : '';

    if (!Number.isFinite(chapterNumber) || !Number.isFinite(verseNumber) || !value) {
      continue;
    }

    if (!chapterMap.has(chapterNumber)) {
      chapterMap.set(chapterNumber, new Map());
    }

    const verseMap = chapterMap.get(chapterNumber);

    if (!verseMap.has(verseNumber)) {
      verseMap.set(verseNumber, []);
    }

    verseMap.get(verseNumber).push(value);
  }

  const chapters = Array.from(chapterMap.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([chapter, versesMap]) => ({
      chapter,
      verses: Array.from(versesMap.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([verse, parts]) => ({
          verse,
          text: normalizeVerseText(parts),
        })),
    }));

  return {
    book,
    chapters,
  };
}

async function main() {
  const sourceDir = process.argv[2] ?? '/tmp/world-english-bible-source/json';
  const outputFile = process.argv[3] ?? path.resolve('assets/bible.json');
  const dataset = [];

  for (const [slug, bookName] of BOOKS) {
    const filePath = path.join(sourceDir, `${slug}.json`);
    const rawFile = await readFile(filePath, 'utf8');
    const rawEntries = JSON.parse(rawFile);
    dataset.push(buildBook(rawEntries, bookName));
  }

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(dataset, null, 2));

  console.log(`Wrote ${dataset.length} books to ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
