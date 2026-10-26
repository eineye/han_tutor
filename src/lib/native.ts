// Android app (Capacitor) helpers. The app's WebView has no speechSynthesis / SpeechRecognition,
// so speech goes through native plugins there. In a normal browser nothing here is loaded.

type CapacitorGlobal = { isNativePlatform?: () => boolean };

export const isNativeApp = () => Boolean((window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.());

export const nativeTts = () => import('@capacitor-community/text-to-speech').then((m) => m.TextToSpeech);
export const nativeStt = () => import('@capacitor-community/speech-recognition').then((m) => m.SpeechRecognition);

/**
 * The phone could not speak Korean: no Korean voice data (most common) or no speech engine at all.
 * Asks once per app start, then opens the phone's voice-data install screen.
 */
let voiceHelpShown = false;
export function offerKoreanVoiceInstall(reason: 'language' | 'engine') {
  if (voiceHelpShown) return;
  voiceHelpShown = true;
  const steps =
    '설정 › 텍스트 음성 변환 › Google 엔진 › 음성 데이터 설치 › 한국어\nSettings › Text-to-speech › Google engine › Install voice data › Korean\nसेटिङ › Text-to-speech › Google › Install voice data › Korean';
  if (reason === 'engine') {
    window.alert(`휴대폰 음성 엔진을 쓸 수 없어요. Google 텍스트 음성 변환을 설치·선택해 주세요.\nThe phone's speech engine is not available. Please install / choose Google Text-to-speech.\nफोनको आवाज इन्जिन उपलब्ध छैन। Google Text-to-speech इन्स्टल गर्नुहोस्।\n\n${steps}`);
    return;
  }
  const ok = window.confirm(
    `이 휴대폰에 한국어 음성이 없어요. 설치 화면을 열까요?\nKorean voice is not installed on this phone. Open the install screen?\nयो फोनमा कोरियाली आवाज छैन। इन्स्टल गर्ने स्क्रिन खोल्ने?\n\n${steps}`,
  );
  if (ok)
    nativeTts()
      .then((t) => t.openInstall())
      .catch(() => {});
}

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
