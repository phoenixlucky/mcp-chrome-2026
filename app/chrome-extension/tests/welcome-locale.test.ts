/**
 * Welcome page locale switching tests
 * @description Verifies the real i18n helpers in
 * entrypoints/welcome/locale.ts: default follows the browser language,
 * the user's choice is persisted and wins on the next visit, and the
 * document <html lang> / <title> stay in sync.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  LOCALE_STORAGE_KEY,
  PAGE_TITLE,
  applyLocale,
  detectDefaultLocale,
  setLocale,
  t,
} from '../entrypoints/welcome/locale';

function setBrowserLanguage(lang: string): void {
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    get: () => lang,
  });
}

beforeEach(() => {
  localStorage.clear();
  setBrowserLanguage('en-US');
  applyLocale('en');
});

describe('detectDefaultLocale', () => {
  it('follows the browser language when nothing is stored', () => {
    setBrowserLanguage('zh-CN');
    expect(detectDefaultLocale()).toBe('zh');
    setBrowserLanguage('zh');
    expect(detectDefaultLocale()).toBe('zh');
    setBrowserLanguage('zh-TW');
    expect(detectDefaultLocale()).toBe('zh');
    setBrowserLanguage('en-US');
    expect(detectDefaultLocale()).toBe('en');
    setBrowserLanguage('ja');
    expect(detectDefaultLocale()).toBe('en');
  });

  it('prefers the persisted choice over the browser language', () => {
    setBrowserLanguage('zh-CN');
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    expect(detectDefaultLocale()).toBe('en');

    setBrowserLanguage('en-US');
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh');
    expect(detectDefaultLocale()).toBe('zh');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
    setBrowserLanguage('ja');
    expect(detectDefaultLocale()).toBe('en');
  });
});

describe('setLocale', () => {
  it('persists the choice to localStorage', () => {
    setLocale('en');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    setLocale('zh');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh');
  });

  it('keeps document lang and title in sync', () => {
    setLocale('zh');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(document.title).toBe(PAGE_TITLE.zh);

    setLocale('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe(PAGE_TITLE.en);
  });
});

describe('t', () => {
  it('returns the localized string for the given locale', () => {
    expect(t('subtitle', 'zh')).toContain('安装扩展后');
    expect(t('subtitle', 'en')).toBe(
      'After the extension is installed, this is the only required step.',
    );
    expect(t('copy', 'zh')).toBe('复制');
    expect(t('copy', 'en')).toBe('Copy');
  });
});
