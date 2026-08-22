import type {
  DrawingStrokeData,
  NoteData,
  StickerData,
  VerseCardData,
  VerseEditorState,
} from '@/utils/verse-storage';

export const CANVAS_HORIZONTAL_PADDING = 32;
export const REFERENCE_STAGE_WIDTH = 358;
export const STUDIO_STAGE_MIN_WIDTH = 340;
export const STUDIO_STAGE_MAX_WIDTH = 1248;

type PositionedLike = {
  verseCards: VerseCardData[];
  notes: NoteData[];
  stickers: StickerData[];
  drawingStrokes: DrawingStrokeData[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function scaleLength(value: number, ratio: number) {
  return Math.round(value * ratio * 100) / 100;
}

export function getStudioStageWidth(windowWidth: number, studioMaxWidth?: number) {
  const availableWidth = Math.max(0, windowWidth - CANVAS_HORIZONTAL_PADDING);
  const cappedWidth =
    typeof studioMaxWidth === 'number'
      ? Math.min(availableWidth, studioMaxWidth - CANVAS_HORIZONTAL_PADDING)
      : availableWidth;

  return clamp(cappedWidth, STUDIO_STAGE_MIN_WIDTH, STUDIO_STAGE_MAX_WIDTH);
}

export function getStageLayoutScale(stageWidth: number) {
  return clamp(stageWidth / REFERENCE_STAGE_WIDTH, 1, 1.5);
}

export function inferDesignStageWidth(state: PositionedLike, explicitStageWidth?: number | null) {
  if (typeof explicitStageWidth === 'number' && explicitStageWidth > 0) {
    return clamp(explicitStageWidth, STUDIO_STAGE_MIN_WIDTH, STUDIO_STAGE_MAX_WIDTH);
  }

  const boxes = [
    ...state.verseCards.map((card) => card.x + (card.width ?? 292) * card.scale),
    ...state.notes.map((note) => note.x + note.width),
    ...state.stickers.map((sticker) => sticker.x + 96 * sticker.scale),
    ...state.drawingStrokes.flatMap((stroke) =>
      stroke.points.map((point) => point.x + stroke.width)
    ),
  ];

  const inferredRight = boxes.length > 0 ? Math.max(...boxes) + 16 : STUDIO_STAGE_MIN_WIDTH;

  return clamp(inferredRight, STUDIO_STAGE_MIN_WIDTH, STUDIO_STAGE_MAX_WIDTH);
}

export function scaleVerseEditorState(
  state: VerseEditorState,
  fromStageWidth: number,
  toStageWidth: number
): VerseEditorState {
  if (fromStageWidth <= 0 || toStageWidth <= 0 || fromStageWidth === toStageWidth) {
    return {
      ...state,
      stageWidth: toStageWidth,
    };
  }

  const ratio = toStageWidth / fromStageWidth;

  return {
    ...state,
    stageWidth: toStageWidth,
    verseCards: state.verseCards.map((card) => ({
      ...card,
      x: scaleLength(card.x, ratio),
      y: scaleLength(card.y, ratio),
      width: typeof card.width === 'number' ? scaleLength(card.width, ratio) : card.width,
      height: typeof card.height === 'number' ? scaleLength(card.height, ratio) : card.height,
    })),
    notes: state.notes.map((note) => ({
      ...note,
      x: scaleLength(note.x, ratio),
      y: scaleLength(note.y, ratio),
      width: scaleLength(note.width, ratio),
      height: scaleLength(note.height, ratio),
    })),
    stickers: state.stickers.map((sticker) => ({
      ...sticker,
      x: scaleLength(sticker.x, ratio),
      y: scaleLength(sticker.y, ratio),
    })),
    drawingStrokes: state.drawingStrokes.map((stroke) => ({
      ...stroke,
      width: scaleLength(stroke.width, ratio),
      points: stroke.points.map((point) => ({
        x: scaleLength(point.x, ratio),
        y: scaleLength(point.y, ratio),
      })),
    })),
  };
}

export function prepareEditorStateForStage(
  state: VerseEditorState,
  targetStageWidth: number
): VerseEditorState {
  const sourceStageWidth = inferDesignStageWidth(state, state.stageWidth);

  return scaleVerseEditorState(state, sourceStageWidth, targetStageWidth);
}

export function withStageWidth(state: VerseEditorState, stageWidth: number): VerseEditorState {
  return {
    ...state,
    stageWidth,
  };
}
