import { App } from '@capacitor/app';

/**
 * Android's back button (gesture or key) in the app (ADR-0020). `back` does what back means right
 * now and returns false when there's nothing to go back from, and the app then closes.
 */
export function listenToBackButton(back: () => boolean): void {
  void App.addListener('backButton', () => {
    if (!back()) void App.exitApp();
  });
}
