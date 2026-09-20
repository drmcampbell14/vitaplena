/* Vita Plena — the globals this app really does put on `window`, declared so
   checkJs can be run in CI without drowning in false positives.

   Two kinds live here: the handful of functions the app hangs off `window` on
   purpose (inline HTML handlers need to reach them), and browser APIs that
   TypeScript's DOM lib does not ship — vendor-prefixed audio and speech, and the
   Google Identity Services script loaded from a <script> tag. */

interface Window {
  /** The action registry inline onclick= handlers call into. */
  A: Record<string, any>;
  /** App state, exposed for debugging and for handlers defined outside modules. */
  S: any;
  /** Redraw every screen; called from modules that must not import the shell. */
  busRender: () => void;
  /** Item writers reached from inline handlers. */
  delItem: (id: string) => Promise<any>;
  updItem: (id: string, data: any) => Promise<any>;
  toggleTaskOn: (id: string, dateS: string) => void;
  /** Google Calendar connect, reached from an inline handler. */
  connectGcal: () => void;
  /** The parsed quick-add a user has not confirmed yet. */
  _qaPending: any;
  /** Universalis JSONP callback — no longer used by the app, kept for old caches. */
  universalisCallback?: (payload: any) => void;

  /** Safari still only has the prefixed constructors. */
  webkitAudioContext?: typeof AudioContext;
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

/** Google Identity Services, loaded from a <script> tag rather than npm. */
declare const google: any;

/** Build stamp injected by Vite's `define` (see vite.config.js). */
declare const __BUILD__: string;

/** Vite's build-time environment (import.meta.env). Only the keys the app reads. */
interface ImportMetaEnv {
  /** Overrides the site the native shells talk to (a branch deploy, for instance). */
  readonly VITE_SITE_URL?: string;
  /** "1" shows the Sign in with Apple button (needs the Apple provider in Firebase). */
  readonly VITE_APPLE_SIGNIN?: string;
  /** The Apple Services ID used for Sign in with Apple on the web. */
  readonly VITE_APPLE_SERVICE_ID?: string;
  /** RevenueCat public SDK keys; their presence switches the paywall on in that store's build. */
  readonly VITE_RC_IOS_KEY?: string;
  readonly VITE_RC_ANDROID_KEY?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
