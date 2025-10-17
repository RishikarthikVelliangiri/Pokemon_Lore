#!/usr/bin/env tsx
import assert from 'node:assert';
import { sanitizeQuery } from '../src/utils/validation';
import { findKeywordOverride } from '../src/lib/keyword-overrides';

const cases = [
  {
    prompt: 'pokemon seeking truths: reshiram',
    expected: 'reshiram',
    hint: 'burns away lies',
  },
  {
    prompt: 'pokemon that could replace the suns light (volcarona)',
    expected: 'volcarona',
    hint: 'replacement for the sun',
  },
  {
    prompt: 'legendary guardian of the seas that calms storms',
    expected: 'lugia',
    hint: 'guardian of the seas',
  },
  {
    prompt: 'pokemon that can carry continents on its shoulders',
    expected: 'regigigas',
    hint: 'towed the continents',
  },
  {
    prompt: 'pokemon that created the land masses and expanded land',
    expected: 'groudon',
    hint: 'continent pokémon',
  },
  {
    prompt: 'legendary that expanded the seas with endless rain',
    expected: 'kyogre',
    hint: 'expanded the seas',
  },
  {
    prompt: 'what pokemon calms groudon and kyogre from the ozone layer',
    expected: 'rayquaza',
    hint: 'calms groudon',
  },
  {
    prompt: 'legendary pokemon that controls time itself',
    expected: 'dialga',
    hint: 'controls time',
  },
  {
    prompt: 'which pokemon controls space and warps dimensions',
    expected: 'palkia',
    hint: 'controls space',
  },
  {
    prompt: 'renegade pokemon ruling the distortion world of antimatter',
    expected: 'giratina',
    hint: 'distortion world',
  },
  {
    prompt: 'pokemon called the original one that created the universe',
    expected: 'arceus',
    hint: 'original one',
  },
];

const run = () => {
  for (const testCase of cases) {
    const sanitized = sanitizeQuery(testCase.prompt).toLowerCase();
    const match = findKeywordOverride(sanitized);
    assert(match, `Expected keyword override for prompt: ${testCase.prompt}`);
    assert(
      match.override.names.includes(testCase.expected),
      `Override should include ${testCase.expected}, got ${match.override.names.join(', ')}`
    );
    if (testCase.hint) {
      assert(match.override.loreHints && match.override.loreHints.length > 0, 'Expected lore hints to be present');
      const combinedHints = match.override.loreHints.join(' ').toLowerCase();
      assert(
        combinedHints.includes(testCase.hint.toLowerCase().slice(0, Math.min(10, testCase.hint.length))),
        `Lore hints should reference ${testCase.hint}`
      );
    }
    console.log(`✅ Override test passed for prompt: "${testCase.prompt}" -> ${testCase.expected}`);
  }
};

try {
  run();
  console.log('✅ All keyword override regression tests passed.');
} catch (err) {
  console.error('❌ Keyword override regression test failed:', err);
  process.exit(1);
}
