(() => {
  'use strict';

  const META = {
    lore: {
      className: 'specialLore',
      icon: '✦',
      label: 'ЛОР-АРХИВ',
      title: 'Угадай героя по его истории',
      meta: 'свободный режим · большой фрагмент истории героя',
      clueTitle: 'История героя',
      mystery: 'история',
      badge: 'Большой фрагмент истории',
      score: 1000
    },
    ai: {
      className: 'specialAI',
      icon: '◎',
      label: 'НЕЙРОВЗГЛЯД',
      title: 'Угадай героя по нейровзгляду',
      meta: 'свободный режим · одно большое описание образа',
      clueTitle: 'Нейровзгляд',
      mystery: 'образ',
      badge: 'Один большой образ героя',
      score: 1000
    },
    voice: {
      className: 'specialVoice',
      icon: '♫',
      label: 'ГОЛОС ГЕРОЯ',
      title: 'Угадай героя по голосу',
      meta: 'свободный режим · голосовой фрагмент без текста',
      clueTitle: 'Голос героя',
      mystery: 'голос',
      badge: 'Голосовой фрагмент',
      score: 1000
    }
  };

  const TAG_TEXT = {
    area: 'умеет давить сразу на несколько целей и контролировать пространство',
    attacks: 'сильнее всего раскрывается в серии последовательных атак',
    control: 'любит ломать темп соперника и навязывать свои правила боя',
    displace: 'может менять расположение врагов и ломать их планы',
    economy: 'любит накапливать преимущество и быстро превращать ресурсы в силу',
    global: 'способен влиять на события даже на большом расстоянии',
    lowhp: 'становится особенно опасным против ослабленных целей',
    mana: 'сильно связан с маной, её запасом и расходом',
    mobility: 'резко меняет дистанцию и легко врывается в эпизод',
    position: 'очень зависит от правильной позиции и выбора точки входа',
    range: 'чувствует себя увереннее, когда может работать с дистанции',
    stealth: 'строит давление на неожиданности и скрытности',
    summons: 'не любит действовать в одиночку и усиливается через призыв',
    sustain: 'умеет держаться дольше ожидаемого и переживать давление',
    target: 'любит быстро сосредотачиваться на одной приоритетной цели',
    tempo: 'лучше всего раскрывается, когда сам задаёт темп сражения',
    terrain: 'особенно ценит окружение, проходы, деревья и геометрию карты',
    timing: 'очень зависит от точно пойманного момента',
    transform: 'умеет резко менять собственное состояние или форму'
  };

  const ATTR = {
    strength: 'мощный и выносливый',
    agility: 'быстрый и опасный',
    intelligence: 'хладнокровный и расчётливый',
    universal: 'гибкий и многогранный'
  };

  const BASE_NEW_ROUND = newRound;
  const BASE_SHOW_PAGE = showPage;
  const BASE_RENDER_CLUES = renderClues;
  const BASE_SAVE_SOLO = saveSoloState;
  const BASE_UPDATE_ATTEMPTS = updateAttempts;
  const BASE_MAX_ATTEMPTS = maxAttempts;

  let spMode = null;
  let spSpeaking = false;
  let spUtterance = null;
  let spVoicesReady = false;

  const $ = (id) => document.getElementById(id);
  const heroByName = (name) => HEROES.find(h => h.name === name);
  const roundByHero = (name) => ROUNDS.find(r => r.hero === name);
  const normSimple = (v) => String(v || '').toLowerCase().replace(/ё/g,'е').replace(/[’']/g,'').replace(/[^a-zа-я0-9]+/gi,' ').trim();
  const esc = (v) => String(v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function aliases(name){
    const h = heroByName(name);
    return [name, h?.ru, ...(h?.aliases || [])].filter(Boolean);
  }
  function redact(text, heroName){
    let out = String(text || '');
    for (const alias of aliases(heroName).sort((a,b)=>b.length-a.length)) {
      if (String(alias).length < 3) continue;
      out = out.replace(new RegExp(String(alias).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'giu'), '[имя скрыто]');
    }
    return out;
  }
  function words(v){ return String(v||'').match(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё'’\-]{1,}/g) || []; }
  function unique(arr){ return [...new Set(arr.filter(Boolean))]; }

  function patchHomeCards(){
    const lore=$('loreHomeCard'), ai=$('aiHomeCard'), voice=$('voiceHomeCard');
    if(lore){ const copy=lore.querySelector('.modeCopy'); if(copy) copy.innerHTML='<b>Лор-архив</b><small>Читай большой фрагмент истории героя и угадывай, о ком идёт речь.</small><span class="modePill">свободный режим</span>'; }
    if(ai){ const copy=ai.querySelector('.modeCopy'); if(copy) copy.innerHTML='<b>Нейровзгляд</b><small>Один большой образ героя: как его видит нейросеть, без прямого имени и без портрета.</small><span class="modePill">дневник наблюдений</span>'; }
    if(voice){ const copy=voice.querySelector('.modeCopy'); if(copy) copy.innerHTML='<b>Голос героя</b><small>Слушай голосовой фрагмент и угадывай героя только по звучанию фразы.</small><span class="modePill">голос · без текста</span>'; }
  }

  function setTheme(mode){
    const meta = META[mode], game = $('game');
    if(!meta || !game) return;
    game.classList.remove('specialLore','specialAI','specialVoice');
    game.classList.add('specialMode', meta.className);
    $('gameModeLabel').textContent = meta.label;
    $('gameModeMeta').textContent = meta.meta;
    $('gameQuestion').textContent = meta.title;
    $('clueTitle').textContent = meta.clueTitle;
    $('letter').textContent = meta.icon;
    $('mysteryLabel').textContent = meta.mystery;
    $('levelBadge').textContent = meta.badge;
    $('score').textContent = String(meta.score);
    $('nextClue').textContent = 'Свободный режим';
    $('nextClue').disabled = true;
  }

  function resetTheme(){
    spStopVoice();
    const game=$('game');
    if(game) game.classList.remove('specialMode','specialLore','specialAI','specialVoice');
    $('gameModeLabel').textContent='FINAL BETA';
    $('gameModeMeta').textContent='127 героев · 3 содержательные подсказки';
    $('gameQuestion').textContent='Кто этот герой?';
    $('clueTitle').textContent='Цепочка связей';
    $('mysteryLabel').textContent='буква раунда';
    $('letter').textContent='?';
  }

  function abilityNames(heroName){
    const r = roundByHero(heroName);
    const pool = [ ...(r?.clues || []), ...((r?.variants || []).flat()) ];
    const out = [];
    for (const line of pool) {
      const m = String(line).match(/—\s*([^.!?]{2,80})/);
      if (m) out.push(m[1].trim());
    }
    return unique(out).slice(0,3);
  }

  function heroTags(heroName){
    const r = roundByHero(heroName);
    const tags = ((r?.variantTags || [])[0] || []).filter(t => !String(t).startsWith('sig:'));
    return unique(tags).slice(0,4);
  }

  function descriptor(heroName){
    const hero = heroByName(heroName), r = roundByHero(heroName);
    const a = ATTR[hero?.attribute] || ATTR.universal;
    const tags = heroTags(heroName).map(t => TAG_TEXT[t]).filter(Boolean);
    const abilities = abilityNames(heroName);
    const opener = r?.word ? `Его образ лучше всего раскрывается через слово «${r.word.toLowerCase()}».` : 'Этот герой ощущается сразу, как только начинает навязывать свой ритм.';
    const t1 = tags[0] || 'умеет навязывать свои правила боя';
    const t2 = tags[1] || 'очень чувствителен к моменту входа в эпизод';
    const ab = abilities.length ? `Особенно хорошо героя выдают такие детали, как ${abilities.map(x=>`«${x}»`).join(' и ')}.` : '';
    return { hero, r, a, tags, abilities, opener, t1, t2, ab };
  }

  function buildLore(heroName){
    const {hero, a, t1, t2, ab, opener, r} = descriptor(heroName);
    const lines = [
      opener,
      `Перед тобой ${a} герой, который не любит быть пассивным наблюдателем и почти всегда старается продавить ситуацию под себя.`,
      `Если читать это как короткую историю персонажа, то в центре его образа стоят способность менять ход эпизода, умение выбирать правильный момент и привычка действовать так, чтобы соперник терял удобную позицию.`,
      `По этому досье хорошо чувствуется, что герой ${t1} и одновременно ${t2}.`,
      ab,
      r?.clues?.[1] ? `Внутри этого образа особенно важна мысль: ${redact(r.clues[1], hero.name).charAt(0).toLowerCase()+redact(r.clues[1], hero.name).slice(1)}` : ''
    ].filter(Boolean);
    return { text: redact(lines.join(' '), hero.name) };
  }

  function buildAI(heroName){
    const {hero, a, tags, ab} = descriptor(heroName);
    const pieces = [
      `Нейросеть видит ${a} силуэт, собранный не из портрета, а из поведения, ритма и энергии.`,
      tags[0] ? `Первое впечатление такое: герой ${TAG_TEXT[tags[0]]}.` : '',
      tags[1] ? `Вторая мысль нейросети — этот образ очень много выигрывает, когда заранее чувствует темп столкновения и успевает навязать его другим.` : '',
      tags[2] ? `Третья деталь: фигура не кажется случайной — у неё есть своя точка входа, своя дистанция и очень узнаваемый почерк.` : '',
      ab ? `В памяти сильнее всего остаются механики ${ab.replace(/Особенно хорошо героя выдают такие детали, как /,'').replace(/\.$/,'')}.` : '',
      `В целом это герой, которого хочется угадывать не по лицу, а по тому, как он меняет сам рисунок драки.`
    ].filter(Boolean);
    return { text: redact(pieces.join(' '), hero.name) };
  }

  function buildVoiceText(heroName){
    const {hero, tags, abilities} = descriptor(heroName);
    const lines = [];
    if(tags.includes('global')) lines.push('Расстояние меня не остановит. Я всё равно доберусь до нужного момента.');
    if(tags.includes('stealth')) lines.push('Ты меня не видишь, но я уже рядом.');
    if(tags.includes('lowhp')) lines.push('Чем слабее ты становишься, тем ближе твой конец.');
    if(tags.includes('control')) lines.push('Теперь всё пойдёт по моим правилам.');
    if(tags.includes('attacks')) lines.push('Один удар зовёт за собой следующий.');
    if(tags.includes('summons')) lines.push('Я не прихожу один.');
    if(tags.includes('mana')) lines.push('Сила здесь решает не меньше, чем сама плоть.');
    if(tags.includes('terrain')) lines.push('Даже сама карта сегодня играет на моей стороне.');
    if(tags.includes('mobility')) lines.push('Я уже ближе, чем тебе кажется.');
    if(tags.includes('sustain')) lines.push('Тебе придётся потратить куда больше сил, чтобы меня остановить.');
    if(!lines.length) lines.push('Этот бой закончится так, как удобно мне.');
    let text = lines.slice(0,2).join(' ');
    if(abilities[0] && text.length < 120) text += ` ${abilities[0]} — и всё изменится.`;
    return redact(text, hero.name);
  }

  function loadingText(mode){
    return mode === 'lore' ? 'Готовлю историю героя…' : mode === 'ai' ? 'Формирую нейровзгляд…' : 'Готовлю голосовой фрагмент…';
  }

  function renderLoading(mode){
    $('clues').innerHTML = `<div class="specialCard loadingCard"><div class="specialLead">${loadingText(mode)}</div></div>`;
    $('levelBadge').textContent = 'Подготовка режима';
    $('guess').disabled = true;
    $('guessBtn').disabled = true;
  }

  function renderSpecial(){
    if(!spMode || !round) return BASE_RENDER_CLUES();
    const box = $('clues');
    box.innerHTML='';
    const meta = META[spMode];
    $('score').textContent = String(meta.score);
    $('levelBadge').textContent = meta.badge;
    $('nextClue').textContent='Свободный режим';
    $('nextClue').disabled=true;

    if(spMode === 'voice') {
      const card = document.createElement('article');
      card.className = 'specialCard voicePlayer';
      card.innerHTML = `
        <div class="specialLead">Слушай фрагмент и угадывай героя по голосу.</div>
        <div class="voiceControls">
          <button class="voicePlayBtn" type="button"><span class="voiceBtnIcon">▶</span><span class="voiceBtnText">Слушать голос</span></button>
          <div class="voiceWave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
        </div>
      `;
      box.appendChild(card);
      const btn = card.querySelector('.voicePlayBtn');
      btn.onclick = () => spSpeaking ? spStopVoice() : spSpeak(round.voiceText || '');
    } else {
      const card = document.createElement('article');
      card.className = `specialCard ${spMode === 'ai' ? 'diaryCard' : 'archiveCard'}`;
      card.innerHTML = `<div class="specialLead">${spMode === 'ai' ? 'Дневник наблюдений' : 'История героя'}</div><div class="storyBody">${esc(round.clues[0] || '').replace(/\n/g,'<br>')}</div>`;
      box.appendChild(card);
    }
  }

  function chooseHero(){
    const pool = HEROES.filter(h => h.name !== lastHero);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function buildRound(mode, hero){
    if(mode === 'lore') return { clues: [buildLore(hero.name).text] };
    if(mode === 'ai') return { clues: [buildAI(hero.name).text] };
    return { clues: [''], voiceText: buildVoiceText(hero.name) };
  }

  async function start(mode){
    spMode = mode;
    challengeMode = false; dailyMode = false; dailySelectedDay = null;
    $('challengeHud')?.classList.add('hiddenAuth');
    setTheme(mode);
    BASE_SHOW_PAGE('game');
    renderLoading(mode);

    const hero = chooseHero();
    const built = buildRound(mode, hero);
    lastHero = hero.name;
    revealed = 1;
    finished = false;
    attemptsAtStage = 0;
    round = { hero: hero.name, letter: '?', word: '', clues: built.clues, scores: [META[mode].score], specialMode: mode, voiceText: built.voiceText || '' };

    $('guess').value = '';
    $('feedback').textContent = '';
    $('feedback').className = 'feedback';
    $('guess').disabled = false;
    $('guessBtn').disabled = false;
    renderSpecial();
    updateAttempts();
    $('guess').focus();
  }

  function spSpeak(text){
    if(!('speechSynthesis' in window) || !text) {
      $('feedback').textContent = 'Голосовой режим не поддерживается этим браузером.';
      $('feedback').className = 'feedback bad';
      return;
    }
    spStopVoice();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const ru = voices.find(v => /^ru/i.test(v.lang)) || voices.find(v => /russian/i.test(v.name)) || voices[0];
    if(ru) utt.voice = ru;
    utt.lang = ru?.lang || 'ru-RU';
    utt.rate = 0.92;
    utt.pitch = 0.95;
    utt.onstart = () => {
      spSpeaking = true;
      const player = document.querySelector('.voicePlayer');
      player?.classList.add('playing');
      const text = player?.querySelector('.voiceBtnText');
      const icon = player?.querySelector('.voiceBtnIcon');
      if(text) text.textContent = 'Остановить';
      if(icon) icon.textContent = '■';
    };
    utt.onend = utt.onerror = () => spStopVoice();
    spUtterance = utt;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  }
  function spStopVoice(){
    try { window.speechSynthesis?.cancel(); } catch {}
    spSpeaking = false; spUtterance = null;
    const player = document.querySelector('.voicePlayer');
    player?.classList.remove('playing');
    const text = player?.querySelector('.voiceBtnText');
    const icon = player?.querySelector('.voiceBtnIcon');
    if(text) text.textContent = 'Слушать голос';
    if(icon) icon.textContent = '▶';
  }

  renderClues = function(){ return spMode ? renderSpecial() : BASE_RENDER_CLUES(); };
  saveSoloState = function(){ if(spMode) return; return BASE_SAVE_SOLO(); };
  maxAttempts = function(){ return spMode ? 6 : BASE_MAX_ATTEMPTS(); };
  updateAttempts = function(){
    const res = BASE_UPDATE_ATTEMPTS();
    if(spMode && !finished){
      const left = Math.max(0, maxAttempts() - attemptsAtStage);
      $('guess').disabled = false;
      $('guessBtn').disabled = false;
      $('guess').placeholder = `Введите имя героя · попыток: ${left}`;
      const info = $('attemptInfo');
      if(info) info.textContent = `Попыток в раунде: ${left}/${maxAttempts()}`;
    }
    return res;
  };

  newRound = function(){ return spMode ? start(spMode) : BASE_NEW_ROUND(); };
  showPage = function(page){ if(page === 'home') { spMode = null; resetTheme(); } return BASE_SHOW_PAGE(page); };

  document.querySelectorAll('[data-special-mode]').forEach(btn => btn.addEventListener('click', () => start(btn.dataset.specialMode)));
  const startBtn = $('startBtn'); if(startBtn) startBtn.onclick = () => { spMode = null; resetTheme(); BASE_NEW_ROUND(); };
  const backHome = $('backHome'); if(backHome) backHome.onclick = () => { if(dailyMode) return openDailyHunt(); if(challengeMode) return showPage('friends'); spMode = null; resetTheme(); BASE_SHOW_PAGE('home'); };

  patchHomeCards();
  if('speechSynthesis' in window){
    try {
      const synth = window.speechSynthesis;
      if(synth.onvoiceschanged !== undefined) synth.onvoiceschanged = () => { spVoicesReady = true; };
      synth.getVoices();
    } catch {}
  }
})();
