import test from 'node:test';
import assert from 'node:assert/strict';
import { niceTicks, signedTicks, scale, runs, pathOf, areaPathOf, labelIndexes, formatNumber, dayLabel, nearestIndex, heatMix, scoreColor, clamp } from '../../lib/statistics/chart-math.js';

test('nice ticks start at zero, are ascending and cover the top value', () => {
  for (const top of [0.3, 1, 7, 87, 100, 101, 1234, 99999, 2.5e6]) {
    const { max, ticks } = niceTicks(top);
    assert.equal(ticks[0], 0); assert.ok(max >= top, `${top} -> ${max}`);
    assert.deepEqual(ticks, [...ticks].sort((a, b) => a - b)); assert.ok(ticks.length >= 3 && ticks.length <= 8);
  }
  assert.deepEqual(niceTicks(87).ticks, [0, 25, 50, 75, 100]);
  assert.deepEqual(niceTicks(0).ticks, [0, 1, 2, 3, 4]);
  assert.deepEqual(niceTicks(NaN).ticks, [0, 1, 2, 3, 4]);
});

test('signed ticks are symmetric around zero', () => {
  const t = signedTicks(-30, 80);
  assert.equal(t.min, -t.max); assert.ok(t.ticks.includes(0)); assert.ok(t.max >= 80);
  assert.ok(signedTicks(0, 0).max >= 1);
});

test('scale maps the domain to the range, including inverted ranges and a flat domain', () => {
  const y = scale(0, 100, 200, 0);
  assert.equal(y(0), 200); assert.equal(y(100), 0); assert.equal(y(50), 100);
  assert.ok(Number.isFinite(scale(5, 5, 0, 10)(5)));
});

test('gaps split a series into runs and are never treated as zero', () => {
  assert.deepEqual(runs([null, null, 3, 0, 5, undefined, 2, NaN]), [[[2, 3], [3, 0], [4, 5]], [[6, 2]]]);
  assert.deepEqual(runs([]), []); assert.deepEqual(runs([null]), []);
  assert.equal(pathOf([]), '');
  assert.match(pathOf([[1, 2]]), /^M1\.00,2\.00h/);
  assert.equal(pathOf([[0, 10], [5, 20]]), 'M0.00,10.00L5.00,20.00');
  assert.equal(areaPathOf([[1, 2]], 9), '');
  assert.match(areaPathOf([[0, 10], [5, 20]], 50), /Z$/);
});

test('labels are thinned so none overlap and the last one is kept when it fits', () => {
  assert.deepEqual(labelIndexes(0, 500, 40), []);
  assert.deepEqual(labelIndexes(1, 500, 40), [0]);
  for (const [n, w] of [[7, 700], [30, 600], [90, 400], [24, 300]]) {
    const idx = labelIndexes(n, w, 36); const slot = w / (n - 1);
    for (let i = 1; i < idx.length; i += 1) assert.ok((idx[i] - idx[i - 1]) * slot >= 36, `${n} ${w}: ${idx}`);
    assert.equal(idx[0], 0); assert.equal(idx.at(-1), n - 1);
  }
});

test('numbers are compact and locale aware; missing values show a dash', () => {
  assert.equal(formatNumber(0), '0'); assert.equal(formatNumber(1234), '1,234'); assert.equal(formatNumber(12500), '12.5k'); assert.equal(formatNumber(2500000), '2.5M');
  assert.equal(formatNumber(0.5), '0.5'); assert.equal(formatNumber(null), '-'); assert.equal(formatNumber(undefined), '-'); assert.equal(formatNumber(NaN), '-');
  assert.equal(formatNumber(1234, 'de'), '1.234');
  assert.equal(dayLabel(20261005), '05.10');
});

test('pointer positions map to the nearest data point', () => {
  assert.equal(nearestIndex(0, 0, 100, 11), 0); assert.equal(nearestIndex(100, 0, 100, 11), 10); assert.equal(nearestIndex(54, 0, 100, 11), 5);
  assert.equal(nearestIndex(-50, 0, 100, 11), 0); assert.equal(nearestIndex(500, 0, 100, 11), 10); assert.equal(nearestIndex(5, 0, 100, 1), 0);
  assert.equal(clamp(5, 0, 3), 3);
});

test('heat colours and score colours follow the documented bands', () => {
  assert.deepEqual(heatMix(0, 10), [38, 40, 50]); assert.deepEqual(heatMix(10, 10), [232, 138, 78]); assert.deepEqual(heatMix(5, 0), [38, 40, 50]);
  const mid = heatMix(2, 10); assert.ok(mid[0] > 38 && mid[0] < 232);
  assert.equal(scoreColor(90), '#34d399'); assert.equal(scoreColor(65), '#2dd4bf'); assert.equal(scoreColor(45), '#fbbf24'); assert.equal(scoreColor(10), '#f87171'); assert.equal(scoreColor(null), '#6b7280');
});

test('rangeTicks frames a curve that does not start at zero and always covers the data', async () => {
  const { rangeTicks } = await import('../../lib/statistics/chart-math.js');
  for (const [lo, hi] of [[1810, 1842], [1842, 1842], [0, 3], [95, 100], [10000, 10500], [5, 5]]) {
    const t = rangeTicks(lo, hi);
    assert.ok(t.min <= lo && t.max >= hi, `${lo}-${hi} covered by ${t.min}-${t.max}`);
    assert.ok(t.ticks.length >= 2 && t.ticks.every((v, i, a) => i === 0 || v > a[i - 1]), 'ticks increase');
    assert.ok(t.min >= 0);
  }
  const t = rangeTicks(1810, 1842);
  assert.ok(t.min > 1000, 'does not start at zero');
  assert.deepEqual(rangeTicks(NaN, 3).ticks, [0, 1, 2, 3, 4]);
});
