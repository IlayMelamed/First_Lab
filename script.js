/* UI, input, audio and persistence. One animation loop, one set of event listeners. */
(() => {
  'use strict';
  const { Game, LEVELS, TYPES } = window.IronCore;
  const $ = id => document.getElementById(id);
  const format = n => Math.round(Number(n) || 0).toLocaleString('en-US');
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const timeLabel = seconds => `${String(Math.floor(Math.ceil(seconds) / 60)).padStart(2, '0')}:${String(Math.ceil(seconds) % 60).padStart(2, '0')}`;
  const STORAGE_KEY = 'iron-dome-typing-defense-v1';
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let storageAvailable = true;
  const defaults = () => ({ nickname: 'Defender', settings: { sound: true, quality: 'high', reducedMotion: systemMotion }, completed: [], best: {}, scores: [] });
  function loadProfile() {
    const clean = defaults();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== 'object') return clean;
      if (typeof saved.nickname === 'string') clean.nickname = saved.nickname.slice(0, 18) || 'Defender';
      if (typeof saved.settings?.sound === 'boolean') clean.settings.sound = saved.settings.sound;
      if (typeof saved.settings?.reducedMotion === 'boolean') clean.settings.reducedMotion = saved.settings.reducedMotion;
      if (saved.settings?.quality === 'low') clean.settings.quality = 'low';
      if (Array.isArray(saved.completed)) clean.completed = [...new Set(saved.completed.filter(n => Number.isInteger(n) && n >= 0 && n < 10))];
      if (saved.best && typeof saved.best === 'object') for (let i = 0; i < 10; i++) if (Number.isFinite(saved.best[i]) && saved.best[i] >= 0) clean.best[i] = saved.best[i];
      if (Array.isArray(saved.scores)) clean.scores = saved.scores.filter(s => s && Number.isFinite(s.score) && s.score >= 0 && Number.isInteger(s.level) && s.level >= 1 && s.level <= 10 && Number.isFinite(s.wpm) && Number.isFinite(s.accuracy) && !isNaN(Date.parse(s.date))).map(s => ({ nickname: String(s.nickname || 'Defender').slice(0,18), score:s.score, level:s.level, wpm:Math.max(0,s.wpm), accuracy:Math.min(100,Math.max(0,s.accuracy)), date:s.date, won:!!s.won })).sort((a,b) => b.score-a.score).slice(0,10);
    } catch (error) {
      // Malformed saved data resets safely. Storage denial still permits a complete session.
      if (error.name !== 'SyntaxError') storageAvailable = false;
    }
    return clean;
  }
  const profile = loadProfile();
  function saveProfile() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }
    catch (_) { storageAvailable = false; }
    $('storage-notice').hidden = storageAvailable;
  }
  saveProfile();

  class Sound {
    constructor() { this.context = null; this.master = null; }
    arm() {
      if (!profile.settings.sound) return;
      try {
        if (!this.context) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          if (!Audio) return;
          this.context = new Audio(); this.master = this.context.createGain();
          this.master.gain.value = 0.16; this.master.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      } catch (_) { /* Silent fallback keeps the game playable. */ }
    }
    tone(freq, duration, offset = 0, wave = 'sine', volume = .3, endFreq = null) {
      if (!profile.settings.sound || !this.context || this.context.state !== 'running') return;
      const t = this.context.currentTime + offset, oscillator = this.context.createOscillator(), gain = this.context.createGain();
      oscillator.type = wave; oscillator.frequency.setValueAtTime(freq, t);
      if (endFreq) oscillator.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
      gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t+.012);
      gain.gain.exponentialRampToValueAtTime(.0001, t+duration);
      oscillator.connect(gain); gain.connect(this.master); oscillator.start(t); oscillator.stop(t+duration+.02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
    play(kind) {
      if (kind === 'click') this.tone(640,.055,0,'sine',.22);
      if (kind === 'intercept') { this.tone(510,.09,0,'sine',.3); this.tone(780,.15,.04,'sine',.25,1400); this.tone(140,.18,.39,'triangle',.3,45); }
      if (kind === 'incorrect') this.tone(220,.1,0,'triangle',.18,160);
      if (kind === 'breach') { this.tone(180,.23,0,'triangle',.35,75); this.tone(250,.15,.12,'sine',.2,100); }
      if (kind === 'heart') [523,659,784,1047].forEach((n,i) => this.tone(n,.2,i*.09,'sine',.3));
      if (kind === 'complete') [392,523,659,784,1047].forEach((n,i) => this.tone(n,.38,i*.13,'triangle',.27));
      if (kind === 'gameover') [330,277,220,165].forEach((n,i) => this.tone(n,.3,i*.16,'sine',.3));
      if (kind === 'warning') { this.tone(440,.12,0,'sine',.16); this.tone(440,.12,.2,'sine',.16); }
    }
    mute() { if (this.master) this.master.gain.setValueAtTime(profile.settings.sound ? .16 : 0, this.context.currentTime); }
  }
  const audio = new Sound();
  const renderer = new window.IronRenderer($('game-canvas'));
  let game = null, screen = 'home', mode = 'menu', visualTime = 0, lastFrame = null;
  let toastUntil = 0, toastPriority = 0, feedbackUntil = 0, lastHearts = -1, composing = false, savedResult = false;
  const input = $('typing-input'), modal = $('modal'), backdrop = $('modal-backdrop');

  function nextMission() { return LEVELS.findIndex((_,i) => !profile.completed.includes(i)); }
  function updateHome() {
    const i = nextMission();
    $('continue-label').textContent = i < 0 ? 'ALL MISSIONS COMPLETE · PLAY AGAIN' : `MISSION ${String(i+1).padStart(2,'0')} · ${LEVELS[i].name.toUpperCase()}`;
    $('personal-best').textContent = profile.scores.length ? format(profile.scores[0].score) : '—';
  }
  function renderLevels() {
    const next = nextMission();
    $('level-grid').innerHTML = LEVELS.map((level,i) => {
      const done = profile.completed.includes(i);
      return `<button class="level-card ${i===next?'current':''}" data-level="${i}" aria-label="Mission ${i+1}, ${level.name}, ${done?'completed, replay':'ready to play'}"><span class="level-number">${String(i+1).padStart(2,'0')}</span><span class="level-status">${done?'✓':'↗'}</span><h3>${level.name}</h3><span class="level-difficulty">${level.difficulty}</span><div class="level-specs"><span>${level.wpmMax?`${level.wpmMin}–${level.wpmMax}`:`${level.wpmMin}+`} WPM</span><span>${level.duration} SEC</span></div><span class="level-best">${done?'COMPLETE · ':'BEST · '}${format(profile.best[i]||0)}</span></button>`;
    }).join('');
  }
  function renderScores() {
    $('empty-scores').hidden = profile.scores.length > 0;
    $('scores-body').innerHTML = profile.scores.map((s,i) => `<tr><td>${String(i+1).padStart(2,'0')}</td><td>${escapeHtml(s.nickname)}</td><td>${format(s.score)}</td><td>${String(s.level).padStart(2,'0')} ${s.won?'✓':''}</td><td>${Math.round(s.wpm)}</td><td>${s.accuracy.toFixed(1)}%</td><td>${new Date(s.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</td></tr>`).join('');
  }
  function applySettings() {
    document.body.classList.toggle('reduced-motion', profile.settings.reducedMotion);
    $('nickname-setting').value = profile.nickname;
    $('sound-setting').checked = profile.settings.sound;
    $('motion-setting').checked = profile.settings.reducedMotion;
    $('quality-setting').value = profile.settings.quality;
    $('sound-button').textContent = profile.settings.sound ? '♪' : '♩';
    $('sound-button').setAttribute('aria-label', profile.settings.sound ? 'Mute sound effects' : 'Enable sound effects');
    $('sound-button').setAttribute('aria-pressed', String(!profile.settings.sound));
    audio.mute();
  }
  function showScreen(name) {
    screen = name;
    document.querySelectorAll('.screen').forEach(el => { el.hidden = el.id !== `${name}-screen`; });
    document.body.classList.toggle('game-active', name==='game');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.action===name));
    if (name !== 'game') { mode = 'menu'; hideModal(); }
    if (name === 'home') updateHome();
    if (name === 'levels') renderLevels();
    if (name === 'scores') renderScores();
    if (name === 'settings') applySettings();
    window.scrollTo({top:0,behavior:'instant'});
    if (name === 'game') renderer.resize();
  }
  function focusInput() { if (mode === 'playing' && screen === 'game' && !document.hidden) input.focus({preventScroll:true}); }
  function startLevel(index) {
    if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length) return;
    hideModal(); renderer.reset(); visualTime = 0; lastFrame = null;
    lastHearts = -1; savedResult = false; toastUntil = 0; toastPriority = 0; feedbackUntil = 0;
    input.value = ''; input.disabled = false; input.parentElement.classList.remove('error','success');
    $('game-toast').classList.remove('visible'); $('input-feedback').textContent = 'Eyes on the sky. Fingers on the keys.';
    game = new Game(index, { onEvent: handleEvent });
    mode = 'playing'; showScreen('game');
    $('mission-label').textContent = `MISSION ${String(index+1).padStart(2,'0')} · ${game.level.name.toUpperCase()}`;
    updateHUD(); focusInput();
    showToast(`${game.level.wpmMin}${game.level.wpmMax?'–'+game.level.wpmMax:'+'} WPM · DEFEND FOR ${game.level.duration} SECONDS`, 3);
  }
  function showToast(message, seconds = 2, warning = false, priority = 0) {
    if (toastUntil > visualTime && toastPriority > priority) return;
    $('game-toast').textContent = message;
    $('game-toast').classList.toggle('warning', warning);
    $('game-toast').classList.add('visible'); toastUntil = visualTime+seconds; toastPriority = priority;
  }
  function feedback(message, good) {
    $('input-feedback').textContent = message; feedbackUntil = visualTime + 1.7;
    input.parentElement.classList.remove('error','success');
    // Restart the brief CSS feedback without changing input focus.
    void input.parentElement.offsetWidth;
    input.parentElement.classList.add(good?'success':'error');
  }
  function handleEvent(event) {
    if (['intercept','breach','heart','complete','gameover'].includes(event.type)) renderer.effect(event);
    if (event.type === 'intercept') {
      audio.play('intercept'); feedback(`Intercept confirmed. +${event.points} points`,true);
      if (event.streak % 3 === 0) showToast(`${event.streak} IN A ROW · KEEP IT GOING`,1.8);
    } else if (event.type === 'incorrect') {
      audio.play('incorrect'); feedback(event.word ? 'No matching target. Clear your mind. Try again.' : 'Type a word from the sky, then press Enter.',false);
    } else if (event.type === 'breach') {
      audio.play('breach'); showToast('SHIELD BREACH · −1 HEART',2.2,true,2);
    } else if (event.type === 'heart') {
      audio.play('heart'); showToast('12 INTERCEPTIONS · +1 BONUS HEART',3,false,3);
    } else if (event.type === 'spawn' && event.threat.type === 'heavy') {
      audio.play('warning'); showToast('HEAVY THREAT DETECTED · LONG WORD INBOUND',2.5,true,1);
    } else if (event.type === 'complete' || event.type === 'gameover') {
      audio.play(event.type); mode = 'result'; input.disabled = true;
      saveResult(event); updateHUD(); showResult(event);
    }
  }
  function updateHUD() {
    if (!game) return;
    $('timer').textContent = timeLabel(game.remaining);
    $('timer').classList.toggle('urgent', game.remaining <= 10);
    $('progress-fill').style.width = `${Math.min(100,game.elapsed/game.level.duration*100)}%`;
    $('score').textContent = format(game.score); $('live-wpm').textContent = Math.round(game.stats.currentWpm);
    $('streak').textContent = game.streak;
    $('accuracy').innerHTML = `${Math.round(game.stats.accuracy)}<small>%</small>`;
    if (lastHearts !== game.hearts) {
      $('hearts').innerHTML = Array.from({length:Math.max(5,game.hearts)},(_,i) => `<span aria-hidden="true" class="${i>=game.hearts?'empty-heart':i>=5?'bonus-heart':''}">♥</span>`).join('');
      $('hearts').setAttribute('aria-label',`${game.hearts} hearts remaining`);
      $('hearts').classList.remove('pulse'); void $('hearts').offsetWidth; $('hearts').classList.add('pulse'); lastHearts=game.hearts;
    }
    const prefix = input.value.toLowerCase();
    const matches = prefix ? game.threats.filter(t => t.word.startsWith(prefix)).length : 0;
    $('target-status').textContent = prefix ? matches===1?'Target acquired':matches>1?`${matches} possible targets`:'No matching signal' : `${game.threats.length} active ${game.threats.length===1?'threat':'threats'}`;
  }
  function showModal(html) {
    modal.innerHTML = html; backdrop.hidden = false;
    modal.focus({preventScroll:true});
    const first = modal.querySelector('button'); if (first) first.focus({preventScroll:true});
  }
  function hideModal() { backdrop.hidden = true; }
  function pauseGame(reason = '') {
    if (mode !== 'playing') return;
    mode = 'paused'; input.blur();
    showModal(`<div class="modal-badge">Ⅱ</div><span class="eyebrow dark">TAKE A BREATH</span><h2 id="modal-title">The sky can wait.</h2><p class="modal-subtitle">${reason || 'Your mission is paused. Pick up right where you left off.'}</p><div class="modal-actions"><button class="primary-button" data-action="resume">Resume mission ↗</button><button class="outline-button" data-action="restart">Restart level</button><button class="text-button" data-action="home">Main menu</button></div><p class="result-note">Press Escape to resume.</p>`);
  }
  function resumeGame() { if (mode!=='paused') return; hideModal(); mode='playing'; lastFrame=null; audio.arm(); focusInput(); }
  function saveResult(event) {
    if (savedResult) return; savedResult=true;
    profile.best[game.levelIndex] = Math.max(profile.best[game.levelIndex]||0,game.score);
    if (event.won && !profile.completed.includes(game.levelIndex)) profile.completed.push(game.levelIndex);
    if (game.score > 0) profile.scores.push({nickname:profile.nickname,score:game.score,level:game.levelIndex+1,wpm:event.stats.averageWpm,accuracy:event.stats.accuracy,date:new Date().toISOString(),won:event.won});
    profile.scores.sort((a,b) => b.score-a.score || b.level-a.level || b.accuracy-a.accuracy);
    profile.scores=profile.scores.slice(0,10); saveProfile();
  }
  function showResult(event) {
    const s=event.stats, final=game.levelIndex===9;
    let subtitle = 'Take a breath, find your rhythm, and give it another go.';
    if (event.won) {
      subtitle = `${game.level.name} complete. Ready for your next mission?`;
      if (final) subtitle = 'The final mission is defended. Try another level or beat your best.';
      if (profile.completed.length === LEVELS.length) subtitle = 'All ten missions complete. Come back and beat your best.';
    }
    showModal(`<div class="modal-badge ${event.won?'':'loss'}">${event.won?'✦':'♡'}</div><span class="eyebrow dark">${event.won?'LEVEL COMPLETE — ISRAEL DEFENDED!':'MISSION ENDED · GAME OVER'}</span><h2 id="modal-title">${event.won?final?'An unbreakable defense.':'A sky worth celebrating.':'Every defender starts somewhere.'}</h2><p class="modal-subtitle">${subtitle}</p><div class="result-score">${format(game.score)}</div><div class="result-score-label">TOTAL MISSION SCORE</div><div class="result-grid"><div><strong>${Math.round(s.averageWpm)}</strong><span>AVERAGE WPM</span></div><div><strong>${s.accuracy.toFixed(1)}%</strong><span>ACCURACY</span></div><div><strong>${s.successful}</strong><span>INTERCEPTED</span></div><div><strong>${game.hearts}</strong><span>HEARTS LEFT</span></div><div><strong>${s.longestStreak}</strong><span>BEST STREAK</span></div><div><strong>${timeLabel(s.elapsed)}</strong><span>MISSION TIME</span></div></div><p class="result-note">Peak ${Math.round(s.peakWpm)} WPM · ${s.missed} shield ${s.missed===1?'breach':'breaches'}${event.won?` · +${format(event.completionBonus)} completion bonus`:''}<br>Saved for ${escapeHtml(profile.nickname)} in this browser.</p><div class="modal-actions">${event.won&&!final?'<button class="primary-button" data-action="next">Next mission ↗</button>':''}<button class="${event.won&&!final?'outline-button':'primary-button'}" data-action="restart">${event.won?'Replay level':'Retry level ↗'}</button><button class="text-button" data-action="home">Main menu</button></div>`);
  }
  function action(name) {
    if (['home','levels','scores','help','settings'].includes(name)) showScreen(name);
    else if (name==='play') startLevel(Math.max(0,nextMission()));
    else if (name==='resume') resumeGame();
    else if (name==='restart' && game) startLevel(game.levelIndex);
    else if (name==='next' && game?.won) startLevel(game.levelIndex+1);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action], [data-level]');
    if (!button || button.disabled) return;
    event.preventDefault(); audio.arm(); audio.play('click');
    if (button.dataset.level !== undefined) startLevel(Number(button.dataset.level));
    else action(button.dataset.action);
  });
  $('pause-button').addEventListener('click', () => { audio.arm(); audio.play('click'); pauseGame(); });
  $('sound-button').addEventListener('click', () => { profile.settings.sound=!profile.settings.sound; applySettings(); audio.arm(); audio.play('click'); saveProfile(); });
  $('typing-form').addEventListener('submit', event => {
    event.preventDefault();
    if (mode!=='playing' || !game || composing) return;
    audio.arm(); const word=input.value; input.value=''; game.submit(word); updateHUD(); focusInput();
  });
  input.addEventListener('compositionstart', () => { composing=true; });
  input.addEventListener('compositionend', () => { composing=false; });
  input.addEventListener('input', () => { updateHUD(); });
  input.addEventListener('paste', event => { event.preventDefault(); feedback('One keystroke at a time. You’ve got this.',false); });
  input.addEventListener('blur', () => { if (mode==='playing') queueMicrotask(() => { if (document.activeElement===document.body) focusInput(); }); });
  $('game-canvas').addEventListener('pointerdown', focusInput);
  document.addEventListener('keydown', event => {
    if (event.key==='Escape') {
      if (mode==='playing') { event.preventDefault(); pauseGame(); }
      else if (mode==='paused') { event.preventDefault(); resumeGame(); }
      return;
    }
    if (!backdrop.hidden && event.key==='Tab') {
      const items=[...modal.querySelectorAll('button, input, [tabindex="0"]')], first=items[0], last=items[items.length-1];
      if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first?.focus(); }
      return;
    }
    if (mode!=='playing' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.key===' ' || ['ArrowUp','ArrowDown','PageUp','PageDown'].includes(event.key)) { event.preventDefault(); return; }
    if (document.activeElement!==input && (/^[a-zA-Z]$/.test(event.key) || event.key==='Backspace' || event.key==='Enter')) {
      event.preventDefault(); focusInput();
      if (event.key==='Backspace') input.value=input.value.slice(0,-1);
      else if (event.key==='Enter') $('typing-form').requestSubmit();
      else if (input.value.length<input.maxLength) input.value+=event.key;
      updateHUD();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame('Paused while you were away. Your shield and timer are safe.'); });
  window.addEventListener('blur', () => pauseGame('Paused while you were away. Ready to get back to it?'));
  window.addEventListener('resize', () => renderer.resize());
  $('nickname-setting').addEventListener('change', event => { profile.nickname=event.target.value.trim().slice(0,18)||'Defender'; event.target.value=profile.nickname; saveProfile(); });
  $('sound-setting').addEventListener('change', event => { profile.settings.sound=event.target.checked; applySettings(); audio.arm(); saveProfile(); });
  $('motion-setting').addEventListener('change', event => { profile.settings.reducedMotion=event.target.checked; applySettings(); saveProfile(); });
  $('quality-setting').addEventListener('change', event => { profile.settings.quality=event.target.value==='low'?'low':'high'; saveProfile(); });
  $('threat-guide').innerHTML = Object.values(TYPES).map(type => `<div class="threat-chip"><strong>${type.name}</strong><span>${type.score} BASE POINTS</span></div>`).join('');

  function frame(timestamp) {
    const delta = lastFrame===null ? 0 : Math.max(0,(timestamp-lastFrame)/1000); lastFrame=timestamp;
    if (screen==='game') {
      if (mode==='playing' && delta>.75) pauseGame('A performance pause kept your mission safe. Resume when you’re ready.');
      const dt=Math.min(.1,delta);
      if (mode==='playing' || mode==='result') visualTime+=dt;
      if (mode==='playing') { game.update(dt); updateHUD(); }
      renderer.draw(game,visualTime,{...profile.settings,prefix:input.value.toLowerCase()});
      if (visualTime>=toastUntil) $('game-toast').classList.remove('visible');
      if (feedbackUntil && visualTime>=feedbackUntil) {
        input.parentElement.classList.remove('error','success');
        $('input-feedback').textContent='Eyes on the sky. Fingers on the keys.'; feedbackUntil=0;
      }
    }
    requestAnimationFrame(frame);
  }
  applySettings(); updateHome(); requestAnimationFrame(frame);
  // Local diagnostics are deliberately absent from the hosted site.
  if (location.protocol==='file:' || ['localhost','127.0.0.1'].includes(location.hostname)) {
    window.IronDebug = Object.freeze({get game(){return game;},get mode(){return mode;},get screen(){return screen;},get renderer(){return renderer;},get profile(){return profile;}});
  }
})();
