/**
 * useMonetTheme — Material You / Monet-inspired adaptive color engine
 *
 * Uses React Native's `useColorScheme` to detect system dark/light mode,
 * then returns a curated Material You color token set.
 *
 * Deliberately avoids PlatformColor / DynamicColorIOS — those APIs require
 * native theme setup that isn't available in Expo Go and can cause crashes
 * when assigned to backgroundColor on RCTView-managed components.
 *
 * The palette is inspired by Material You Monet tonal system:
 *   Primary   → blue-violet tonal family
 *   Surface   → neutral dark/light
 *   Accent    → system-style blue
 */
import { useColorScheme } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonetTheme {
  /** Brand / primary action color */
  primary: string;
  /** Container behind primary elements */
  primaryVariant: string;
  /** Text/icon on primary */
  onPrimary: string;

  /** Page / screen background */
  background: string;
  /** Card / bottom-sheet surface */
  surface: string;
  /** Slightly elevated or variant surface */
  surfaceVariant: string;

  /** Primary text on background */
  onBackground: string;
  /** Primary text on surface */
  onSurface: string;
  /** Secondary / muted text */
  onSurfaceVariant: string;

  /** Dividers, borders */
  outline: string;
  /** Hairline dividers */
  outlineVariant: string;

  /** Error / danger color */
  error: string;

  /** Modal backdrop overlay */
  scrim: string;

  /** StatusBar style */
  statusBar: 'light' | 'dark';

  /** true when scheme is dark */
  isDark: boolean;
}

// ─── Palettes ─────────────────────────────────────────────────────────────────

/**
 * Dark — deep-space Monet palette
 * Primary family: #A8C7FA (MD3 primary on-dark)
 */
const DARK: MonetTheme = {
  primary:          '#A8C7FA',   // MD3 primary (dark)
  primaryVariant:   '#1A3A5C',   // MD3 primary-container (dark)
  onPrimary:        '#002D6B',   // on-primary

  background:       '#0D1117',   // near-black neutral background
  surface:          '#161B22',   // card / sheet surface
  surfaceVariant:   '#1F2937',   // slightly elevated row bg

  onBackground:     '#E6EDF3',   // primary text
  onSurface:        '#E6EDF3',
  onSurfaceVariant: '#8B949E',   // muted / secondary text

  outline:          '#30363D',   // borders, dividers
  outlineVariant:   '#21262D',   // hairlines

  error:   '#FF6B6B',
  scrim:   'rgba(0,0,0,0.65)',
  statusBar: 'light',
  isDark: true,
};

/**
 * Light — airy Monet palette
 * Primary family: #0057A8 (MD3 primary on-light)
 */
const LIGHT: MonetTheme = {
  primary:          '#1A73E8',   // MD3 primary (light)
  primaryVariant:   '#D3E4FF',   // primary-container
  onPrimary:        '#FFFFFF',   // on-primary

  background:       '#F3F6FB',   // light neutral background
  surface:          '#FFFFFF',   // card / sheet
  surfaceVariant:   '#E8EFF8',   // row / input bg

  onBackground:     '#0D1117',   // primary text
  onSurface:        '#0D1117',
  onSurfaceVariant: '#4A5568',   // muted text

  outline:          '#BCC8D8',   // borders
  outlineVariant:   '#DCE5F0',   // hairlines

  error:   '#D32F2F',
  scrim:   'rgba(0,0,0,0.38)',
  statusBar: 'dark',
  isDark: false,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMonetTheme(): MonetTheme {
  const scheme = useColorScheme();
  // Treat 'null' (no system preference available) as dark
  return scheme === 'light' ? LIGHT : DARK;
}
