import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { getModuleSeoContent, moduleSeoLocales, MODULE_SEO_SLUGS } = await import('../../lib/module-seo.js');
const { HOWTO } = await import('../../lib/module-howto.js');
const LOCALES = ['en', 'ro', 'fr', 'it', 'de', 'es', 'nl', 'pt', 'tr'];
const NEW = ['counting', 'statistics', 'battlepass', 'theme_studio'];
const messages = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(readFileSync(new URL(`../../messages/${l}.json`, import.meta.url), 'utf8'))]));

test('the new module pages exist, are written in every language and are indexed in every language', () => {
  for (const slug of NEW) {
    assert.ok(MODULE_SEO_SLUGS.includes(slug));
    assert.deepEqual([...moduleSeoLocales(slug)].sort(), [...LOCALES].sort());
    const english = getModuleSeoContent(slug, 'en');
    for (const locale of LOCALES) {
      const c = getModuleSeoContent(slug, locale);
      for (const key of ['heroTitle', 'heroSubtitle', 'metaTitle', 'metaDescription', 'ogTitle', 'ogDescription']) assert.ok(c[key], `${slug} ${locale} ${key}`);
      assert.ok(c.intro.length >= 2 && c.features.length >= 5 && c.faq.length >= 4 && c.audience.length >= 3 && c.pains.length >= 3, `${slug} ${locale}`);
      if (locale !== 'en') assert.notEqual(c.heroTitle, english.heroTitle, `${slug} ${locale} is translated`);
      const text = JSON.stringify(c);
      assert.ok(!/[–—]/.test(text), `${slug} ${locale} has no dashes`);
      assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(text), `${slug} ${locale} has no emoji`);
      assert.ok(!/[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/.test(text), `${slug} ${locale} uses typographic apostrophes`);
    }
  }
});

test('every new module has its how to guide, its card and its commands in every language', () => {
  for (const slug of NEW) {
    assert.ok(HOWTO[slug]);
    for (const locale of LOCALES) {
      const m = messages[locale];
      assert.ok(m.moduleGuide.items[slug]?.what && m.moduleGuide.items[slug].customize.length, `${slug} ${locale} guide`);
      assert.ok(m.landing.modulesDetail.some((x) => x.key === slug), `${slug} ${locale} card`);
    }
  }
  for (const locale of LOCALES) {
    const keys = messages[locale].commands.groups.map((g) => g.key);
    for (const k of ['counting', 'battlepass', 'statistics']) assert.ok(keys.includes(k), `${locale} commands ${k}`);
  }
});

test('every module page is written in full in every language', () => {
  for (const slug of MODULE_SEO_SLUGS) {
    assert.deepEqual([...moduleSeoLocales(slug)].sort(), [...LOCALES].sort(), `${slug} languages`);
    const english = getModuleSeoContent(slug, 'en');
    for (const locale of LOCALES) {
      const c = getModuleSeoContent(slug, locale);
      for (const key of ['heroTitle', 'heroSubtitle', 'metaTitle', 'metaDescription', 'ogTitle', 'ogDescription']) assert.ok(c[key], `${slug} ${locale} ${key}`);
      assert.ok(c.intro.length >= 2 && c.features.length >= 3 && c.faq.length >= 3 && c.audience?.length >= 2 && c.pains?.length >= 2, `${slug} ${locale} sections`);
      assert.equal(c.features.length, english.features.length, `${slug} ${locale} same features as English`);
      assert.equal(c.faq.length, english.faq.length, `${slug} ${locale} same questions as English`);
      if (locale !== 'en') assert.notEqual(c.heroSubtitle, english.heroSubtitle, `${slug} ${locale} is translated`);
      const text = JSON.stringify(c);
      assert.ok(!/[–—]/.test(text), `${slug} ${locale} has no dashes`);
      assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(text), `${slug} ${locale} has no emoji`);
      if (locale !== 'en' && locale !== 'ro') assert.ok(!/[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/.test(text), `${slug} ${locale} uses typographic apostrophes`);
    }
  }
});
