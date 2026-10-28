/** Available built-in themes. */
export const THEMES = ['graphite', 'ocean', 'lavender', 'sand', 'rose', 'sage'];
/** Default user settings. */
export const DEFAULT_SETTINGS = Object.freeze({schema:2,theme:'graphite',colorMode:'system',highlightRelated:true,highlightSameDigit:true,showMistakes:true,cleanupNotes:true,showTimer:true,inputMode:'cell-first',colorblind:false,textSize:'default',reducedMotion:'system',haptics:false,sounds:false,confirmNewGame:true,confirmRestart:true,lastDifficulty:'easy',onboardingDone:false});
/** Normalize arbitrary persisted settings without throwing. @param {unknown} raw */
export function normalizeSettings(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {...DEFAULT_SETTINGS};
  for (const k of Object.keys(out)) if (typeof DEFAULT_SETTINGS[k] === 'boolean' && typeof r[k] === 'boolean') out[k] = r[k];
  if (THEMES.includes(r.theme)) out.theme = r.theme;
  for (const [k, vals] of Object.entries({colorMode:['system','light','dark'],inputMode:['cell-first','number-first'],textSize:['default','large','xlarge'],reducedMotion:['system','on','off'],lastDifficulty:['easy','medium','hard','expert']})) if (vals.includes(r[k])) out[k] = r[k];
  return out;
}
