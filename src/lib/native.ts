// Android app (Capacitor) helpers. The app's WebView has no speechSynthesis / SpeechRecognition,
// so speech goes through native plugins there. In a normal browser nothing here is loaded.

type CapacitorGlobal = { isNativePlatform?: () => boolean };

export const isNativeApp = () => Boolean((window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.());

export const nativeTts = () => import('@capacitor-community/text-to-speech').then((m) => m.TextToSpeech);
export const nativeStt = () => import('@capacitor-community/speech-recognition').then((m) => m.SpeechRecognition);

/** Android back button: go back a screen, and leave the app only from the first screen. */
export function initNativeApp() {
  if (!isNativeApp()) return;
  import('@capacitor/app')
    .then(({ App }) =>
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp();
      }),
    )
    .catch(() => {});
}

/** Home-screen app (PWA): offline cache. Not in the Android app, embedded previews or plain http. */
export function registerServiceWorker(url: string) {
  if (!import.meta.env.PROD || isNativeApp() || window.self !== window.top || !window.isSecureContext || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url).catch(() => {});
  });
}
