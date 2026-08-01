const injectionPatterns = [
  /ignore\s+(all\s+)?previous/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /reveal\s+(your|the)\s+(instructions|secrets|api\s+key)/i,
  /show\s+me\s+the\s+(hidden|private|draft)/i,
  /disregard\s+(the|your)\s+rules/i
];

export function looksLikePromptInjection(value: string) {
  return injectionPatterns.some((pattern) => pattern.test(value));
}

export function containsAbuseSignal(value: string) {
  return /(?:https?:\/\/|www\.)[^\s]+/gi.test(value) && value.length > 1200;
}
