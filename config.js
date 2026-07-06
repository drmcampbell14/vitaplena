// ============================================================
// VITA PLENA — CONFIGURATION
// ============================================================

const VP_CONFIG = {

  // --- SUPABASE (your database) ---
  SUPABASE_URL: 'https://xqeahbyfuhccbnvnhuko.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_43QRbFmTwcsXPEhAuJjs1Q__JkC-urs',

  // --- GOOGLE CALENDAR ---
  // Get this from: console.cloud.google.com → Credentials → OAuth Client ID
  GOOGLE_CLIENT_ID: 'PASTE_YOUR_GOOGLE_CLIENT_ID_HERE',

  // --- APP SETTINGS ---
  APP_NAME: 'Vita Plena',
  APP_VERSION: '0.1.0',
  TRIAL_DAYS: 14,

  // --- PRICING ---
  PRICE_VITA_MONTHLY: 7.99,
  PRICE_PLENA_MONTHLY: 11.99,
};

const SUPABASE_URL = VP_CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = VP_CONFIG.SUPABASE_ANON_KEY;
const GOOGLE_CLIENT_ID = VP_CONFIG.GOOGLE_CLIENT_ID;
