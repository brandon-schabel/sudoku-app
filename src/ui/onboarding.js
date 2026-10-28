/** Create first-run onboarding; contract skeleton for shell integration. */
export function createOnboarding({ root, app }) {
  return { maybeShow() { if (app.settings().onboardingDone) return; } };
}
