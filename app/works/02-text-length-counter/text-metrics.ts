const graphemeSegmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

export type TextMetrics = {
  charactersWithWhitespace: number;
  charactersWithoutWhitespace: number;
  lines: number;
  readingTime: string;
};

export function countGraphemes(text: string): number {
  return Array.from(graphemeSegmenter.segment(text)).length;
}

export function removeWhitespace(text: string): string {
  return text.replace(/\s/gu, "");
}

export function countLines(text: string): number {
  if (text === "") {
    return 0;
  }

  return text.split(/\r\n|\r|\n/u).length;
}

export function formatReadingTime(characterCount: number): string {
  if (characterCount === 0) {
    return "—";
  }

  if (characterCount < 500) {
    return "1分未満";
  }

  return `約${Math.ceil(characterCount / 500)}分`;
}

export function analyzeText(text: string): TextMetrics {
  const charactersWithoutWhitespace = countGraphemes(removeWhitespace(text));

  return {
    charactersWithWhitespace: countGraphemes(text),
    charactersWithoutWhitespace,
    lines: countLines(text),
    readingTime: formatReadingTime(charactersWithoutWhitespace),
  };
}
