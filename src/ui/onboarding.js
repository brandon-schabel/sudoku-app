/**
 * STUB owned by C2 (docs/UI-CONTRACT.md): first-run onboarding. C2 replaces this file.
 * @module ui/onboarding
 */

/**
 * @param {{root:HTMLElement, app:any}} opts
 * @returns {{maybeShow():void}}
 */
export function createOnboarding({ app }) {
  return {
    maybeShow() {
      if (!app.settings().onboardingDone) app.setSetting("onboardingDone", true);
    }
  };
}
