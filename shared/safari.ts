export const SAFARI_PENALTY_MS = 1000;
export const isSafariUserAgent = (userAgent: string): boolean =>
  /Safari\//i.test(userAgent) &&
  /Version\//i.test(userAgent) &&
  !/Chrome|Chromium|CriOS|Edg|OPR|OPiOS|FxiOS|Firefox|Android|SamsungBrowser/i.test(userAgent);
