/* Iron Dome: Typing Defense — simulation and balancing, independent of the DOM. */
(function (root) {
  'use strict';

  const WORLD = Object.freeze({ width: 1200, height: 720, shieldX: 600, shieldY: 350, shieldRadius: 76 });
  const ZONES = Object.freeze([
    { id: 'lebanon', name: 'Lebanon', x: 590, y: 145, flag: '🇱🇧' },
    { id: 'syria', name: 'Syria', x: 765, y: 165, flag: '🇸🇾' },
    { id: 'iraq', name: 'Iraq', x: 910, y: 240, flag: '🇮🇶' },
    { id: 'iran', name: 'Iran', x: 1090, y: 300, flag: '🇮🇷' },
    { id: 'yemen', name: 'Yemen', x: 900, y: 625, flag: '🇾🇪' },
    { id: 'gaza', name: 'Gaza', x: 425, y: 440, flag: '🇵🇸' }
  ].map(Object.freeze));

  const WORD_BANKS = Object.freeze({
    drone: Object.freeze(('cat blue rain tree sun moon star lake leaf wind bird fish wave sky sand hill rock rose ' +
      'snow pine fox owl bee ant dog red gold mint fern pond dawn dusk calm glow teal ' +
      'gem dew mist warm cool kite sail wing nest seed peak plum pear lime dune bay').split(' ')),
    uav: Object.freeze(('engine rocket shield danger comet planet orbit signal silver cloud garden forest river ' +
      'valley harbor beacon rescue glider radar pilot winged launch flight patrol scout ' +
      'copper amber violet breeze horizon stream meadow canyon summit desert island ' +
      'crystal spark trail ember solar lunar ocean anchor bridge tunnel timber feather ' +
      'safety power light bright agile steady').split(' ')),
    cruise: Object.freeze(('velocity intercept defense aircraft guidance altitude compass thunder lightning ' +
      'guardian protector sentinel satellite horizon quadrant frequency direction distance ' +
      'airspace approach movement coverage response reaction precision accurate vigilance ' +
      'watchtower fortress adventure courage harmony cascade emerald sapphire titanium ' +
      'operation tactical strategy maneuver tracking thermal infrared corridor perimeter ' +
      'aeronaut aerodynamic calculate pressure turbine shelter').split(' ')),
    ballistic: Object.freeze(('trajectory acceleration navigation destruction propulsion atmosphere observation ' +
      'calibration computation protection resilience deployment turbulence coordinates ' +
      'transmission orientation resistance stabilization equilibrium intelligence monitoring ' +
      'aerodynamics supersonic designation integration atmospheric instrument capability ' +
      'engineering technology generation formation separation interception turbulence ' +
      'exploration evacuation performance efficiency determination preparation trajectory ' +
      'activation resolution electronic astronautics recognition temperature').split(' ').filter((word, i, words) => words.indexOf(word) === i)),
    heavy: Object.freeze(('synchronization electromagnetic reconnaissance countermeasure communication ' +
      'electrodynamics instrumentation identification intercontinental characterization ' +
      'superconductivity telecommunications electromagnetic multidisciplinary ' +
      'reconfiguration synchronization crystallography aerodynamically interoperability ' +
      'electromechanical decentralization microelectronics experimentation ' +
      'uninterruptedly counterintelligence differentiation reinforcement ' +
      'infrastructure meteorological initialization optimization ' +
      'photoluminescence semiconductors thermodynamics ' +
      'sophistication accountability technological maneuverability ' +
      'computationally detectability observability sustainability ' +
      'electromagnetism interconnection standardization responsiveness ' +
      'transformation nanotechnology').split(' ').filter((word, i, words) => words.indexOf(word) === i))
  });

  const TYPES = Object.freeze({
    drone: Object.freeze({ name: 'Small drone', score: 50, color: '#76d8b4', size: 10, pace: 1.65, warning: 0 }),
    uav: Object.freeze({ name: 'Attack UAV', score: 100, color: '#ffd279', size: 13, pace: 1.45, warning: 0 }),
    cruise: Object.freeze({ name: 'Cruise missile', score: 150, color: '#ffb678', size: 15, pace: 1.25, warning: 0 }),
    ballistic: Object.freeze({ name: 'Ballistic missile', score: 250, color: '#ff8394', size: 18, pace: 1.15, warning: 0.65 }),
    heavy: Object.freeze({ name: 'Heavy ballistic', score: 400, color: '#d6a0ff', size: 22, pace: 1.1, warning: 1.35 })
  });

  const LEVELS = Object.freeze([
    { name: 'First Light', wpmMin: 10, wpmMax: 15, targetWpm: 12, duration: 60, difficulty: 'Beginner', maxActive: 2, load: 0.72, weights: [1, 0, 0, 0, 0] },
    { name: 'On Watch', wpmMin: 15, wpmMax: 20, targetWpm: 17, duration: 60, difficulty: 'Easy', maxActive: 2, load: 0.76, weights: [0.65, 0.35, 0, 0, 0] },
    { name: 'Clear Skies', wpmMin: 20, wpmMax: 25, targetWpm: 22, duration: 75, difficulty: 'Easy–Medium', maxActive: 3, load: 0.79, weights: [0.35, 0.5, 0.15, 0, 0] },
    { name: 'Rising Tide', wpmMin: 25, wpmMax: 30, targetWpm: 27, duration: 75, difficulty: 'Medium', maxActive: 3, load: 0.82, weights: [0.2, 0.4, 0.35, 0.05, 0] },
    { name: 'Steel Resolve', wpmMin: 30, wpmMax: 35, targetWpm: 32, duration: 90, difficulty: 'Medium', maxActive: 4, load: 0.85, weights: [0.15, 0.25, 0.4, 0.2, 0] },
    { name: 'Night Watch', wpmMin: 35, wpmMax: 40, targetWpm: 37, duration: 90, difficulty: 'Challenging', maxActive: 4, load: 0.88, weights: [0.1, 0.2, 0.35, 0.3, 0.05] },
    { name: 'Storm Front', wpmMin: 40, wpmMax: 45, targetWpm: 42, duration: 90, difficulty: 'Hard', maxActive: 5, load: 0.9, weights: [0.05, 0.15, 0.3, 0.35, 0.15] },
    { name: 'Iron Will', wpmMin: 45, wpmMax: 50, targetWpm: 47, duration: 105, difficulty: 'Hard', maxActive: 5, load: 0.92, weights: [0.05, 0.1, 0.25, 0.35, 0.25] },
    { name: 'Sky Guardian', wpmMin: 50, wpmMax: 60, targetWpm: 55, duration: 105, difficulty: 'Expert', maxActive: 6, load: 0.94, weights: [0.03, 0.07, 0.2, 0.35, 0.35] },
    { name: 'Unbreakable', wpmMin: 60, wpmMax: null, targetWpm: 65, duration: 120, difficulty: 'Extreme', maxActive: 6, load: 0.96, weights: [0, 0.05, 0.15, 0.35, 0.45] }
  ].map((level, index) => Object.freeze({ ...level, number: index + 1, weights: Object.freeze(level.weights) })));

  const TYPE_KEYS = Object.keys(TYPES);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // First intersection along a line from an outside launch point to an interior target.
  // The returned endpoint is the shield boundary, never the center of the country.
  function shieldIntersection(startX, startY, targetX, targetY) {
    const dx = targetX - startX;
    const dy = targetY - startY;
    const ox = startX - WORLD.shieldX;
    const oy = startY - WORLD.shieldY;
    const a = dx * dx + dy * dy;
    const b = 2 * (ox * dx + oy * dy);
    const c = ox * ox + oy * oy - WORLD.shieldRadius * WORLD.shieldRadius;
    const t = (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
    return { x: startX + dx * t, y: startY + dy * t };
  }

  class Game {
    constructor(levelIndex = 0, options = {}) {
      this.levelIndex = clamp(Math.trunc(Number(levelIndex) || 0), 0, LEVELS.length - 1);
      this.level = LEVELS[this.levelIndex];
      this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
      this.random = typeof options.random === 'function' ? options.random : Math.random;
      this.elapsed = 0;
      this.remaining = this.level.duration;
      this.hearts = 5;
      this.score = 0;
      this.streak = 0;
      this.threats = [];
      this.finished = false;
      this.won = false;
      this.completionBonus = 0;
      this.stats = {
        successful: 0, missed: 0, longestStreak: 0, correctChars: 0,
        submittedChars: 0, submissions: 0, correctSubmissions: 0,
        currentWpm: 0, averageWpm: 0, peakWpm: 0, accuracy: 100
      };
      this._serial = 0;
      this._nextSpawn = 0.85;
      this._recentWords = [];
      this._recentHits = [];
      this._previousZone = null;
    }

    _emit(type, detail = {}) {
      this.onEvent({ type, ...detail });
    }

    _rng() {
      return clamp(Number(this.random()) || 0, 0, 0.999999999);
    }

    _pick(items) {
      return items[Math.floor(this._rng() * items.length)];
    }

    _type() {
      let roll = this._rng();
      for (let i = 0; i < this.level.weights.length; i++) {
        roll -= this.level.weights[i];
        if (roll < 0) return TYPE_KEYS[i];
      }
      return TYPE_KEYS[this.level.weights.lastIndexOf(Math.max(...this.level.weights))];
    }

    _word(type) {
      const active = new Set(this.threats.map(threat => threat.word));
      const available = WORD_BANKS[type].filter(word => !active.has(word));
      const fresh = available.filter(word => !this._recentWords.includes(word));
      return this._pick(fresh.length ? fresh : available);
    }

    _zone(type) {
      // Longer missiles use more distant launch sites, preserving a distinct fast visual speed.
      let candidates = type === 'heavy' || type === 'ballistic'
        ? ZONES.filter(zone => ['iraq', 'iran', 'yemen', 'syria'].includes(zone.id))
        : ZONES;
      if (this.levelIndex === 0) candidates = candidates.filter(zone => ['lebanon', 'syria', 'gaza', 'iraq'].includes(zone.id));
      const alternatives = candidates.filter(zone => zone.id !== this._previousZone);
      if (alternatives.length) candidates = alternatives;
      // Prefer launch sectors not already crowded, so labels and flight paths stay apart.
      const scores = candidates.map(zone => {
        const clearance = this.threats.reduce((min, threat) => Math.min(min, distance(zone.x, zone.y, threat.x, threat.y)), 800);
        return { zone, score: clearance + this._rng() * 190 };
      });
      scores.sort((a, b) => b.score - a.score);
      return scores[0].zone;
    }

    _canAdmit(word, duration) {
      const cps = this.level.targetWpm * 5 / 60;
      const totalLetters = this.threats.reduce((sum, threat) => sum + threat.word.length, word.length);
      // Bound both simultaneous objects and outstanding work, rather than unlimited spawning.
      if (totalLetters > cps * (11.5 + this.levelIndex * 0.5) + 5) return false;
      const jobs = this.threats.map(threat => ({ chars: threat.word.length, deadline: threat.remaining }));
      jobs.push({ chars: word.length, deadline: duration });
      jobs.sort((a, b) => a.deadline - b.deadline);
      let work = 0.9; // Seeing, choosing and submitting the first target takes time too.
      for (const job of jobs) {
        work += job.chars / cps + 0.15;
        if (work > job.deadline) return false;
      }
      return true;
    }

    _spawn() {
      if (this.threats.length >= this.level.maxActive) return false;
      const type = this._type();
      const descriptor = TYPES[type];
      const word = this._word(type);
      if (!word) return false;
      const cps = this.level.targetWpm * 5 / 60;
      const typingTime = word.length / cps;
      const reaction = 3.4 - this.levelIndex * 0.11;
      const warningDuration = descriptor.warning;
      const duration = Math.max(4.6, typingTime * descriptor.pace + reaction + warningDuration);
      if (!this._canAdmit(word, duration)) return false;

      const zone = this._zone(type);
      const startX = zone.x + (this._rng() - 0.5) * 22;
      const startY = zone.y + (this._rng() - 0.5) * 18;
      if (this.threats.some(threat => distance(startX, startY, threat.x, threat.y) < 105)) return false;
      const targetAngle = this._rng() * Math.PI * 2;
      const targetRadius = Math.sqrt(this._rng()) * WORLD.shieldRadius * 0.48;
      const targetX = WORLD.shieldX + Math.cos(targetAngle) * targetRadius;
      const targetY = WORLD.shieldY + Math.sin(targetAngle) * targetRadius;
      const endpoint = shieldIntersection(startX, startY, targetX, targetY);
      const threat = {
        id: ++this._serial, type, word, zone: zone.id,
        startX, startY, endX: endpoint.x, endY: endpoint.y,
        targetX, targetY, x: startX, y: startY,
        angle: Math.atan2(endpoint.y - startY, endpoint.x - startX),
        age: 0, progress: 0, duration, remaining: duration,
        warning: warningDuration, warningDuration
      };
      this.threats.push(threat);
      this._previousZone = zone.id;
      this._recentWords.push(word);
      if (this._recentWords.length > 36) this._recentWords.shift();
      // Character throughput, not a fixed object count, drives every level's cadence.
      const interval = typingTime / this.level.load * (0.96 + this._rng() * 0.08);
      this._nextSpawn = this.elapsed + Math.max(0.85, interval);
      this._emit('spawn', { threat: { ...threat } });
      return true;
    }

    update(dt) {
      if (this.finished || !Number.isFinite(dt) || dt <= 0) return;
      // Small internal steps make tests/slow callers safe and preserve every boundary collision.
      let pending = Math.min(dt, 3600);
      while (pending > 1e-8 && !this.finished) {
        const step = Math.min(pending, 0.05, this.remaining);
        pending -= step;
        this.elapsed = Math.min(this.level.duration, this.elapsed + step);
        this.remaining = Math.max(0, this.level.duration - this.elapsed);
        for (let i = this.threats.length - 1; i >= 0; i--) {
          const threat = this.threats[i];
          threat.age += step;
          threat.remaining = Math.max(0, threat.duration - threat.age);
          threat.warning = Math.max(0, threat.warningDuration - threat.age);
          threat.progress = clamp((threat.age - threat.warningDuration) / (threat.duration - threat.warningDuration), 0, 1);
          threat.x = threat.startX + (threat.endX - threat.startX) * threat.progress;
          threat.y = threat.startY + (threat.endY - threat.startY) * threat.progress;
          if (threat.remaining <= 1e-8) {
            this.threats.splice(i, 1);
            this.hearts = Math.max(0, this.hearts - 1);
            this.streak = 0;
            this.stats.missed++;
            this._emit('breach', { threat: { ...threat }, hearts: this.hearts });
            if (this.hearts === 0) {
              this._finish(false);
              break;
            }
          }
        }
        if (this.finished) break;
        if (this.remaining <= 1e-8) {
          this.elapsed = this.level.duration;
          this.remaining = 0;
          this._finish(true);
          break;
        }
        if (this.elapsed + 1e-8 >= this._nextSpawn) {
          if (!this._spawn()) this._nextSpawn = this.elapsed + 0.25;
        }
      }
      this._updateStats();
    }

    submit(text) {
      if (this.finished) return { correct: false, reason: 'finished' };
      const word = String(text == null ? '' : text).toLowerCase();
      this.stats.submissions++;
      this.stats.submittedChars += Math.max(1, word.length);
      const index = this.threats.findIndex(threat => threat.word === word && threat.remaining > 0);
      if (index === -1) {
        this.streak = 0;
        this._updateStats();
        this._emit('incorrect', { word, accuracy: this.stats.accuracy });
        return { correct: false, reason: word ? 'no-match' : 'empty' };
      }

      // Resolution is immediate. The visual interceptor can never leave a damaging threat behind.
      const threat = this.threats.splice(index, 1)[0];
      const descriptor = TYPES[threat.type];
      this.streak++;
      this.stats.successful++;
      this.stats.correctSubmissions++;
      this.stats.correctChars += word.length;
      this.stats.longestStreak = Math.max(this.stats.longestStreak, this.streak);
      this._recentHits.push({ at: this.elapsed, chars: word.length });
      const fastBonus = Math.round(descriptor.score * 0.4 * threat.remaining / threat.duration / 5) * 5;
      const streakBonus = Math.min(100, Math.floor(this.streak / 3) * 5);
      const points = descriptor.score + fastBonus + streakBonus;
      this.score += points;
      this._updateStats();
      this._emit('intercept', { threat: { ...threat }, points, fastBonus, streakBonus, streak: this.streak, score: this.score });
      if (this.streak % 12 === 0 && this.hearts < 8) {
        this.hearts++;
        this._emit('heart', { hearts: this.hearts, streak: this.streak });
      }
      return { correct: true, threat: { ...threat }, points };
    }

    _updateStats() {
      const cutoff = this.elapsed - 15;
      while (this._recentHits.length && this._recentHits[0].at < cutoff) this._recentHits.shift();
      const recentChars = this._recentHits.reduce((sum, hit) => sum + hit.chars, 0);
      this.stats.currentWpm = recentChars * 12 / Math.max(1, Math.min(15, this.elapsed));
      this.stats.averageWpm = this.stats.correctChars * 12 / Math.max(1, this.elapsed);
      this.stats.peakWpm = Math.max(this.stats.peakWpm, this.stats.currentWpm);
      this.stats.accuracy = this.stats.submittedChars ? this.stats.correctChars / this.stats.submittedChars * 100 : 100;
    }

    snapshotStats() {
      this._updateStats();
      return {
        ...this.stats, score: this.score, hearts: this.hearts, streak: this.streak,
        level: this.levelIndex + 1, elapsed: this.elapsed, duration: this.level.duration,
        completionTime: this.elapsed, won: this.won, completionBonus: this.completionBonus
      };
    }

    _finish(won) {
      if (this.finished) return;
      this.finished = true;
      this.won = won;
      if (won) {
        const perfectBonus = this.stats.submissions > 0 && this.stats.correctSubmissions === this.stats.submissions ? 250 : 0;
        this.completionBonus = 500 + this.levelIndex * 150 + this.hearts * 75 + perfectBonus;
        this.score += this.completionBonus;
      }
      this.threats.length = 0;
      const stats = this.snapshotStats();
      this._emit(won ? 'complete' : 'gameover', { won, score: this.score, completionBonus: this.completionBonus, stats });
    }
  }

  const api = Object.freeze({ Game, LEVELS, TYPES, ZONES, WORLD, WORD_BANKS, shieldIntersection });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IronCore = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
