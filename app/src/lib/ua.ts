/**
 * User-Agent のごく粗い分類。
 *
 * 「モバイルで多いのか」「Safari で不具合が出ていないか」を見るための目安であって、
 * 厳密な判定ではない。外部ライブラリは入れない（Workers のバンドルを小さく保つため）。
 * 生の User-Agent は responses.user_agent にそのまま残すので、細かく見たいときはそちらを使う。
 */

export type UaInfo = {
  deviceType: 'mobile' | 'tablet' | 'desktop' | null;
  os: string | null;
  browser: string | null;
};

export function parseUa(ua: string | null | undefined): UaInfo {
  if (!ua) return { deviceType: null, os: null, browser: null };

  const tablet = /\biPad\b/i.test(ua) || (/\bAndroid\b/i.test(ua) && !/\bMobile\b/i.test(ua));
  const mobile = /\b(iPhone|iPod|Android.*Mobile|Windows Phone)\b/i.test(ua);
  const deviceType: UaInfo['deviceType'] = tablet ? 'tablet' : mobile ? 'mobile' : 'desktop';

  let os: string | null = null;
  if (/\b(iPhone|iPad|iPod)\b/i.test(ua)) os = 'iOS';
  else if (/\bAndroid\b/i.test(ua)) os = 'Android';
  else if (/\bWindows NT\b/i.test(ua)) os = 'Windows';
  else if (/\bMac OS X\b/i.test(ua)) os = 'macOS';
  else if (/\bLinux\b/i.test(ua)) os = 'Linux';

  // 並びが重要。Edge と Chrome は UA に Chrome を含み、Chrome は Safari を含む。
  let browser: string | null = null;
  if (/\bEdgA?\/|\bEdge\//i.test(ua)) browser = 'Edge';
  else if (/\b(CriOS|Chrome)\//i.test(ua)) browser = 'Chrome';
  else if (/\bFxiOS|Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/\bSafari\//i.test(ua)) browser = 'Safari';

  return { deviceType, os, browser };
}
