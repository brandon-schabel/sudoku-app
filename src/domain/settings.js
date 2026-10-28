/** Available built-in themes. */
export const THEMES = Object.freeze(['graphite', 'ocean', 'lavender', 'sand', 'rose', 'sage']);
/** @typedef {'easy'|'medium'|'hard'|'expert'} Difficulty */
/** @typedef {{schema:2,theme:string,colorMode:'system'|'light'|'dark',highlightRelated:boolean,highlightSameDigit:boolean,showMistakes:boolean,cleanupNotes:boolean,showTimer:boolean,inputMode:'cell-first'|'number-first',colorblind:boolean,textSize:'default'|'large'|'xlarge',reducedMotion:'system'|'on'|'off',haptics:boolean,sounds:boolean,confirmNewGame:boolean,confirmRestart:boolean,lastDifficulty:Difficulty,onboardingDone:boolean}} Settings */
/** Default user settings. */
export const DEFAULT_SETTINGS = Object.freeze({
  schema: 2,
  theme: 'graphite',
  colorMode: 'system',
  highlightRelated: true,
  highlightSameDigit: true,
  showMistakes: true,
  cleanupNotes: true,
  showTimer: true,
  inputMode: 'cell-first',
  colorblind: false,
  textSize: 'default',
  reducedMotion: 'system',
  haptics: false,
  sounds: false,
  confirmNewGame: true,
  confirmRestart: true,
  lastDifficulty: 'easy',
  onboardingDone: false
});
/** Normalize arbitrary persisted settings without throwing. @param {unknown} raw */
export function normalizeSettings(raw) {
  try {
    const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const out = {...DEFAULT_SETTINGS};
    for (const key of Object.keys(out)) {
      if (typeof DEFAULT_SETTINGS[key] === 'boolean' && typeof r[key] === 'boolean') out[key] = r[key];
    }
    if (THEMES.includes(r.theme)) out.theme = r.theme;

    const allowedValues = {
      colorMode: ['system', 'light', 'dark'],
      inputMode: ['cell-first', 'number-first'],
      textSize: ['default', 'large', 'xlarge'],
      reducedMotion: ['system', 'on', 'off'],
      lastDifficulty: ['easy', 'medium', 'hard', 'expert']
    };
    for (const [key, values] of Object.entries(allowedValues)) {
      if (values.includes(r[key])) out[key] = r[key];
    }
    return out;
  } catch { return {...DEFAULT_SETTINGS}; }
}
