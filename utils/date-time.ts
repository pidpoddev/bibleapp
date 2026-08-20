export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** e.g. "Aug 20, 2026 Prayer Journal" */
export function formatJournalEntryTitle(
  typeLabel: string,
  date: Date = new Date(),
  language: 'en' | 'es' = 'en'
) {
  const dateLabel = date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${dateLabel} ${typeLabel}`.trim();
}

export function formatEntryDateTime(value: string | number | Date) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  const normalizedDate = parsedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const normalizedTime = parsedDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${normalizedDate} • ${normalizedTime}`;
}
