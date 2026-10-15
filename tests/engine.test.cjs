'use strict';
// Run with: node --test tests/engine.test.cjs. No packages or build step required.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, TYPES, WORD_BANKS, WORLD, ZONES, shieldIntersection } = require('../game-core.js');

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function fresh(level = 0, seed = 22) {
  const events = [];
  const game = new Game(level, { random: seeded(seed), onEvent: event => events.push(event) });
  game._nextSpawn = Infinity;
  return { game, events };
}

function spawn(game) {
  assert.equal(game._spawn(), true, 'The empty sky should admit a threat.');
  game._nextSpawn = Infinity;
  return game.threats.at(-1);
}

function simulate(level, wpm, seed) {
  const game = new Game(level, { random: seeded(seed) });
  let target = null;
  let work = 0;
  let maxThreats = 0;
  const dt = 1 / 60;
  while (!game.finished && game.elapsed < game.level.duration + 1) {
    if (!target && game.threats.length) {
      target = [...game.threats].sort((a, b) => a.remaining - b.remaining)[0];
      work = target.word.length * 60 / (wpm * 5) + 0.25;
    }
    game.update(dt);
    maxThreats = Math.max(maxThreats, game.threats.length);
    assert.equal(new Set(game.threats.map(threat => threat.word)).size, game.threats.length);
    assert.ok(game.threats.length <= game.level.maxActive);
    if (target) {
      work -= dt;
      if (!game.threats.some(threat => threat.id === target.id)) target = null;
      else if (work <= 0 && !game.finished) { game.submit(target.word); target = null; }
    }
  }
  return { ...game.snapshotStats(), maxThreats };
}

test('configuration has ten increasing WPM levels and substantial, unique word banks', () => {
  assert.equal(LEVELS.length, 10);
  for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].targetWpm > LEVELS[i - 1].targetWpm);
  for (const [type, words] of Object.entries(WORD_BANKS)) {
    assert.ok(words.length >= 40, type);
    assert.equal(new Set(words).size, words.length, type);
    assert.ok(words.every(word => /^[a-z]+$/.test(word)), type);
    assert.ok(TYPES[type].score > 0);
  }
});

test('a new game starts with five hearts, a full timer, and fresh statistics', () => {
  const { game } = fresh();
  assert.equal(game.hearts, 5);
  assert.equal(game.remaining, 60);
  assert.equal(game.score, 0);
  assert.equal(game.stats.successful, 0);
  assert.equal(game.finished, false);
});

test('exact case-insensitive submission resolves immediately and cannot later damage the shield', () => {
  const { game, events } = fresh();
  const threat = spawn(game);
  game.update(1);
  const result = game.submit(threat.word.toUpperCase());
  assert.equal(result.correct, true);
  assert.equal(game.threats.length, 0);
  assert.ok(result.points >= TYPES[threat.type].score);
  game.update(threat.duration + 1);
  assert.equal(game.hearts, 5);
  assert.equal(game.stats.successful, 1);
  assert.equal(events.filter(event => event.type === 'intercept').length, 1);
  assert.equal(game.submit(threat.word).correct, false, 'A word cannot score twice.');
});

test('incorrect, partial, empty, and padded submissions award nothing and do not remove a target', () => {
  const { game, events } = fresh();
  const threat = spawn(game);
  for (const word of ['definitelywrong', threat.word.slice(0, -1), '', `${threat.word} `]) {
    assert.equal(game.submit(word).correct, false);
    assert.equal(game.score, 0);
    assert.equal(game.threats.length, 1);
  }
  assert.equal(events.filter(event => event.type === 'intercept').length, 0);
  assert.equal(game.stats.accuracy, 0);
  assert.equal(game.submit(threat.word).correct, true);
  assert.ok(game.stats.accuracy > 0 && game.stats.accuracy < 100);
});

test('all trajectories terminate precisely at the shield boundary, not its center', () => {
  for (const zone of ZONES) {
    const point = shieldIntersection(zone.x, zone.y, WORLD.shieldX + 15, WORLD.shieldY - 12);
    assert.ok(Math.abs(Math.hypot(point.x - WORLD.shieldX, point.y - WORLD.shieldY) - WORLD.shieldRadius) < 1e-7);
  }
  const { game, events } = fresh();
  const threat = spawn(game);
  game.update(threat.duration - 0.01);
  assert.equal(game.hearts, 5);
  assert.equal(game.threats.length, 1);
  game.update(0.02);
  assert.equal(game.hearts, 4);
  assert.equal(game.threats.length, 0);
  assert.equal(game.stats.missed, 1);
  const impact = events.find(event => event.type === 'breach').threat;
  assert.ok(Math.abs(Math.hypot(impact.x - WORLD.shieldX, impact.y - WORLD.shieldY) - WORLD.shieldRadius) < 1e-7);
});

test('every 12 consecutive hits rewards a heart, capped at eight', () => {
  const { game, events } = fresh();
  for (let hit = 1; hit <= 60; hit++) {
    const threat = spawn(game);
    game.submit(threat.word);
    assert.equal(game.hearts, Math.min(8, 5 + Math.floor(hit / 12)));
  }
  assert.equal(game.stats.longestStreak, 60);
  assert.equal(events.filter(event => event.type === 'heart').length, 3);
});

test('incorrect submissions and shield breaches reset the consecutive streak', () => {
  const { game } = fresh();
  for (let hit = 0; hit < 11; hit++) game.submit(spawn(game).word);
  game.submit('wrong');
  assert.equal(game.streak, 0);
  game.submit(spawn(game).word);
  assert.equal(game.hearts, 5);
  const threat = spawn(game);
  game.update(threat.duration + 0.01);
  assert.equal(game.streak, 0);
  assert.equal(game.stats.longestStreak, 11);
});

test('surviving the timer wins exactly once, awards a completion bonus, and stops simulation', () => {
  const { game, events } = fresh();
  game.update(59.9);
  assert.equal(game.finished, false);
  game.update(0.2);
  assert.equal(game.finished, true);
  assert.equal(game.won, true);
  assert.equal(game.remaining, 0);
  assert.equal(game.elapsed, 60);
  assert.ok(game.completionBonus > 0);
  const score = game.score;
  game.update(100);
  game.submit('cat');
  assert.equal(game.score, score);
  assert.equal(events.filter(event => event.type === 'complete').length, 1);
});

test('five breaches end the game immediately and never award a win bonus', () => {
  const { game, events } = fresh();
  for (let miss = 0; miss < 5; miss++) {
    const threat = spawn(game);
    threat.age = threat.duration - 0.01;
    game.update(0.02);
  }
  assert.equal(game.finished, true);
  assert.equal(game.won, false);
  assert.equal(game.hearts, 0);
  assert.equal(game.stats.missed, 5);
  assert.equal(game.completionBonus, 0);
  assert.equal(events.filter(event => event.type === 'gameover').length, 1);
});

test('WPM uses five-character words and only accepted text; idle time never creates WPM', () => {
  const { game } = fresh();
  game.update(10);
  assert.equal(game.stats.currentWpm, 0);
  const threat = spawn(game);
  game.submit('wrong');
  assert.equal(game.stats.averageWpm, 0);
  game.submit(threat.word);
  assert.equal(game.stats.averageWpm, threat.word.length * 12 / game.elapsed);
  assert.equal(game.stats.accuracy, threat.word.length / (threat.word.length + 5) * 100);
  game.update(16);
  assert.equal(game.stats.currentWpm, 0, 'The rolling WPM falls to zero after inactivity.');
});

test('creating another run resets all state independently', () => {
  const original = fresh().game;
  original.submit(spawn(original).word);
  original.update(9);
  const next = fresh().game;
  assert.equal(next.elapsed, 0);
  assert.equal(next.score, 0);
  assert.equal(next.hearts, 5);
  assert.equal(next.threats.length, 0);
  assert.notEqual(next.threats, original.threats);
  assert.notEqual(next.stats, original.stats);
});

test('invalid or paused time advances no gameplay, and large delta steps retain collisions', () => {
  const { game } = fresh();
  const threat = spawn(game);
  for (const delta of [0, -1, NaN, Infinity]) game.update(delta);
  assert.equal(game.elapsed, 0);
  assert.equal(threat.age, 0);
  game.update(threat.duration + 1);
  assert.equal(game.stats.missed, 1);
});

test('a typist at each configured WPM can fairly survive all ten levels across 12 seeded scenarios', () => {
  const summary = [];
  for (let level = 0; level < LEVELS.length; level++) {
    let intercepted = 0;
    let missed = 0;
    let lowestHearts = 8;
    for (let seed = 1; seed <= 12; seed++) {
      const result = simulate(level, LEVELS[level].targetWpm, seed);
      assert.equal(result.won, true, `Level ${level + 1}, seed ${seed}, target ${LEVELS[level].targetWpm} WPM`);
      assert.equal(result.missed, 0, `Fair EDF workload should have no unavoidable breaches: level ${level + 1}, seed ${seed}`);
      intercepted += result.successful;
      missed += result.missed;
      lowestHearts = Math.min(lowestHearts, result.hearts);
    }
    summary.push({ level: level + 1, WPM: LEVELS[level].targetWpm, averageHits: Math.round(intercepted / 12), missed, lowestHearts });
  }
  console.table(summary);
});

test('an unattended player loses, including in the beginner level', () => {
  for (const level of [0, 4, 9]) {
    const game = new Game(level, { random: seeded(10) });
    game.update(500);
    assert.equal(game.won, false);
    assert.equal(game.finished, true);
    assert.equal(game.hearts, 0);
  }
});
