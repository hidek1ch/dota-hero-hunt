(() => {
  'use strict';

  const SP_MODE_META = {
    lore: {
      className: 'specialLore',
      icon: '✦',
      label: 'ЛОР-АРХИВ',
      title: 'Угадай героя по его истории',
      meta: 'официальная история героя · свободный раунд',
      clueTitle: 'История героя',
      mystery: 'архивная запись',
      badge: 'Официальная история героя',
      score: 1000,
      source: 'официальный лор Dota 2'
    },
    ai: {
      className: 'specialAI',
      icon: '◎',
      label: 'НЕЙРОВЗГЛЯД',
      title: 'Угадай героя по нейровзгляду',
      meta: 'одно большое описание героя · свободный раунд',
      clueTitle: 'Дневник наблюдений',
      mystery: 'образ героя',
      badge: 'Один большой образ героя',
      score: 1000,
      source: 'локальный генератор образов'
    },
    voice: {
      className: 'specialVoice',
      icon: '♫',
      label: 'ГОЛОС ГЕРОЯ',
      title: 'Угадай героя по голосу',
      meta: 'реальный голосовой фрагмент · свободный раунд',
      clueTitle: 'Голосовая запись',
      mystery: 'аудиофрагмент',
      badge: 'Настоящий голосовой фрагмент',
      score: 1000,
      source: 'игровая озвучка Dota 2'
    }
  };

  const SP_TAG_VISUAL = {
    area: 'вокруг фигуры будто дрожит само пространство',
    attacks: 'каждое движение чувствуется как серия повторяющихся ударов',
    control: 'всю сцену держит жёсткий контроль и чувство власти над противником',
    displace: 'чужие силуэты смещаются так, словно их уводят с места силой',
    economy: 'в этом образе ощущается жадная тяга к ресурсам, золоту и ускоренному росту',
    global: 'присутствие будто дотягивается туда, где фигуры сейчас даже нет',
    lowhp: 'опасность становится ярче именно тогда, когда цель уже ослаблена',
    mana: 'энергия здесь важнее плоти: запас силы ощущается почти материально',
    mobility: 'образ не стоит спокойно — он резко врывается и меняет дистанцию',
    position: 'всё держится на правильной позиции и умении занять точку раньше других',
    range: 'угроза ощущается ещё до сближения, словно удар придёт издалека',
    stealth: 'часть фигуры как будто скрыта, и именно неопределённость создаёт давление',
    summons: 'рядом постоянно угадывается чьё‑то подчинённое присутствие',
    sustain: 'фигура как будто умеет переживать урон и оставаться в сцене дольше ожидаемого',
    target: 'внимание образа всегда собирается вокруг одной выбранной цели',
    tempo: 'есть ощущение, что именно эта фигура задаёт темп всей сцене',
    terrain: 'геометрия места и окружение становятся частью самого образа',
    timing: 'всё решает один короткий, идеально пойманный момент',
    transform: 'внутри образа есть готовность резко изменить собственную форму или состояние'
  };

  const SP_ATTR_VISUAL = {
    strength: 'тяжёлую и уверенную фигуру, которая ощущается массивной даже в тишине',
    agility: 'быстрый и тонкий силуэт, собранный из резких, нервных линий',
    intelligence: 'образ, построенный из воли, знаков и управляемой энергии',
    universal: 'смешанную фигуру, где сила, ловкость и энергия переплетены без доминирующей черты'
  };

  const SP_BASE_NEW_ROUND = newRound;
  const SP_BASE_SHOW_PAGE = showPage;
  const SP_BASE_RENDER_CLUES = renderClues;
  const SP_BASE_SAVE_SOLO = saveSoloState;
  const SP_BASE_UPDATE_ATTEMPTS = updateAttempts;
  const SP_BASE_RECORD_TELEMETRY = typeof recordClueTelemetry === 'function' ? recordClueTelemetry : null;

  let spMode = null;
  let spLoading = false;
  let spHeroIds = null;
  let spPrefetchToken = 0;
  let spCurrentAudio = null;
  const spMemory = { lore: new Map(), voice: new Map() };

  window.__dhhSpecialMode = null;

  function $(id){ return document.getElementById(id); }
  function spEscRe(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function spWords(v){return String(v||'').match(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё'’\-]{1,}/g)||[];}
  function spCleanText(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function spNormalizeSimple(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[’']/g,'').replace(/[^a-zа-я0-9]+/gi,' ').trim();}
  function spHeroData(name){return HEROES.find(h=>h.name===name);}
  function spRoundData(name){return ROUNDS.find(r=>r.hero===name);}
  function spAliases(name){const h=spHeroData(name);return [name,h?.ru,...(h?.aliases||[])].filter(Boolean);}
  function spSetSession(key,val){try{sessionStorage.setItem(key,JSON.stringify(val));}catch{}}
  function spGetSession(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
  function spUUID(){if(typeof makeRoundToken==='function')return makeRoundToken();try{if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();}catch{} return '00000000-0000-4000-8000-'+Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12);}

  function spRedactHero(text,name){
    let out=String(text||'');
    for(const alias of spAliases(name).sort((a,b)=>b.length-a.length)){
      if(String(alias).length<3) continue;
      out=out.replace(new RegExp(spEscRe(alias),'giu'),'[имя скрыто]');
    }
    return out;
  }

  function spPauseAudio(){
    try{ if(spCurrentAudio){ spCurrentAudio.pause(); } }catch{}
    document.querySelector('.voicePlayer.playing')?.classList.remove('playing');
  }

  async function spFetchJson(url, timeout=8000){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),timeout);
    try{
      const r=await fetch(url,{signal:ctrl.signal,cache:'force-cache',credentials:'omit'});
      if(!r.ok) throw new Error('http_'+r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  function spPatchHomeCards(){
    const lore=$('loreHomeCard');
    const ai=$('aiHomeCard');
    const voice=$('voiceHomeCard');
    if(lore){
      const copy=lore.querySelector('.modeCopy');
      if(copy) copy.innerHTML='<b>Лор-архив</b><small>Читай цельную историю героя и угадывай, о ком идёт речь.</small><span class="modePill">свободный архив</span>';
    }
    if(ai){
      const copy=ai.querySelector('.modeCopy');
      if(copy) copy.innerHTML='<b>Нейровзгляд</b><small>Один большой образ героя в формате дневника наблюдений — без портрета и прямого имени.</small><span class="modePill">дневник · без уровней</span>';
    }
    if(voice){
      const copy=voice.querySelector('.modeCopy');
      if(copy) copy.innerHTML='<b>Голос героя</b><small>Слушай настоящий голосовой фрагмент и угадывай героя по озвучке.</small><span class="modePill">аудио · без текста</span>';
    }
  }

  function spResetGameTheme(){
    const game=$('game');
    if(game) game.classList.remove('specialMode','specialLore','specialAI','specialVoice');
    spPauseAudio();
    const q=$('gameQuestion'); if(q) q.textContent='Кто этот герой?';
    const ct=$('clueTitle'); if(ct) ct.textContent='Цепочка связей';
    const ml=$('mysteryLabel'); if(ml) ml.textContent='буква раунда';
    const meta=$('gameModeMeta'); if(meta) meta.textContent='127 героев · 3 содержательные подсказки';
    const mode=$('gameModeLabel'); if(mode) mode.textContent='FINAL BETA';
    const letter=$('letter'); if(letter) letter.textContent='?';
  }

  function spApplyTheme(mode){
    const m=SP_MODE_META[mode], game=$('game'); if(!m||!game) return;
    game.classList.remove('specialLore','specialAI','specialVoice');
    game.classList.add('specialMode',m.className);
    $('gameModeLabel').textContent=m.label;
    $('gameModeMeta').textContent=m.meta;
    $('gameQuestion').textContent=m.title;
    $('clueTitle').textContent=m.clueTitle;
    $('letter').textContent=m.icon;
    $('mysteryLabel').textContent=m.mystery;
    $('newRound').textContent='Новый раунд';
    $('score').textContent=String(m.score);
    $('nextClue').textContent='Свободный режим';
  }

  function spClearAnswer(){
    spPauseAudio();
    const ap=document.getElementById('answerPanel'); if(ap) ap.remove();
    document.querySelector('.gameGrid')?.classList.remove('hasAnswer');
    document.querySelectorAll('.hideAfterAnswer').forEach(el=>el.classList.remove('hideAfterAnswer'));
  }

  function spLoadingClue(mode){
    const box=$('clues'); if(!box) return;
    box.innerHTML='';
    const c=document.createElement('div');
    c.className='specialCard loadingCard';
    c.innerHTML=`<div class="specialLead">${mode==='lore'?'Загружаю историю героя…':mode==='voice'?'Загружаю голос героя…':'Открываю запись нейровзгляда…'}</div>`;
    box.appendChild(c);
    $('levelBadge').textContent='Подготовка режима';
    $('nextClue').disabled=true;
    $('guess').disabled=true;
    $('guessBtn').disabled=true;
  }

  function spRenderSource(box, round, mode){
    return;
  }

  function spAttachVoiceControls(container, audioUrl){
    const playBtn=container.querySelector('.voicePlayBtn');
    const audio=container.querySelector('audio');
    if(!playBtn || !audio) return;
    spCurrentAudio = audio;
    const setState=(playing)=>{
      container.classList.toggle('playing', !!playing);
      const label=playBtn.querySelector('.voiceBtnText');
      if(label) label.textContent=playing ? 'Пауза' : 'Слушать голос';
      const icon=playBtn.querySelector('.voiceBtnIcon');
      if(icon) icon.textContent=playing ? '❚❚' : '▶';
    };
    playBtn.onclick=async()=>{
      try{
        if(audio.paused){ spPauseAudio(); spCurrentAudio = audio; await audio.play(); setState(true); }
        else { audio.pause(); setState(false); }
      }catch{
        const hint=container.querySelector('.voiceHint');
        if(hint) hint.textContent='Не удалось воспроизвести фрагмент. Нажми play на плеере ещё раз.';
      }
    };
    audio.onplay=()=>{ spCurrentAudio = audio; setState(true); };
    audio.onpause=()=>setState(false);
    audio.onended=()=>setState(false);
  }

  function spRenderSpecialClues(){
    const m=SP_MODE_META[spMode];
    if(!m || !round) return SP_BASE_RENDER_CLUES();
    const box=$('clues');
    box.innerHTML='';
    $('score').textContent=String(m.score);
    $('levelBadge').textContent=m.badge;
    $('nextClue').disabled=true;

    if(spMode==='voice'){
      const wrap=document.createElement('div');
      wrap.className='voicePlayer specialCard';
      wrap.innerHTML=`
        <div class="specialLead">Слушай фрагмент и угадывай героя по голосу.</div>
        <div class="voiceControls">
          <button class="voicePlayBtn" type="button"><span class="voiceBtnIcon">▶</span><span class="voiceBtnText">Слушать голос</span></button>
          <div class="voiceWave" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
        <audio controls preload="none" crossorigin="anonymous" src="${escapeHtml(round.audioUrl||'')}"></audio>
      `;
      box.appendChild(wrap);
      spRenderSource(box, round, spMode);
      spAttachVoiceControls(wrap, round.audioUrl);
    } else {
      const card=document.createElement('article');
      card.className=`specialCard storyCard ${spMode==='ai'?'diaryCard':'archiveCard'}`;
      const lead=spMode==='ai' ? 'Дневник наблюдений' : 'История героя';
      card.innerHTML=`<div class="specialLead">${lead}</div><div class="storyBody">${escapeHtml(round.clues[0]||'').replace(/\n/g,'<br>')}</div>`;
      box.appendChild(card);
      spRenderSource(box, round, spMode);
    }
  }

  renderClues = function(){ return spMode ? spRenderSpecialClues() : SP_BASE_RENDER_CLUES(); };
  saveSoloState = function(){ if(spMode) return; return SP_BASE_SAVE_SOLO(); };
  if(SP_BASE_RECORD_TELEMETRY){ recordClueTelemetry = function(...args){ if(spMode) return; return SP_BASE_RECORD_TELEMETRY(...args); }; }
  updateAttempts = function(){
    const r=SP_BASE_UPDATE_ATTEMPTS();
    if(spMode && !finished){
      const left=Math.max(0, maxAttempts()-attemptsAtStage);
      const input=$('guess');
      if(input && !input.disabled) input.placeholder=`Введите имя героя · попыток: ${left}`;
      const info=$('attemptInfo');
      if(info && left===0) info.textContent='Попытки закончились — начни новый раунд.';
    }
    return r;
  };

  function spPickHero(){
    const pool=HEROES.filter(h=>h.name!==lastHero);
    return pool[Math.floor(Math.random()*pool.length)];
  }

  function spExtractSignature(heroName){
    const base=spRoundData(heroName); if(!base) return '';
    const all=[...(base.clues||[]),...((base.variants||[]).flat())];
    for(const c of all){
      const m=String(c).match(/—\s*([^.!?]{3,64})/);
      if(m){ const v=m[1].trim(); if(!spNormalizeSimple(v).includes(spNormalizeSimple(heroName))) return v; }
    }
    return '';
  }

  function spBuildAI(hero){
    const base=spRoundData(hero.name);
    const tags=(base?.variantTags?.[0]||[]).filter(t=>!String(t).startsWith('sig:'));
    const senses=[...new Set(tags)].map(t=>SP_TAG_VISUAL[t]).filter(Boolean);
    while(senses.length<4) senses.push('в образе есть напряжение и готовность к резкому действию');
    const attr=SP_ATTR_VISUAL[hero.attribute] || SP_ATTR_VISUAL.universal;
    const sig=spExtractSignature(hero.name);
    const lines=[
      `Вижу ${attr}.`,
      `Рядом с этой фигурой ${senses[0]}, а ещё ${senses[1]}.`,
      `Вся сцена подсказывает, что ${senses[2]}, и из‑за этого образ не кажется пассивным или случайным.`,
      `Если записать впечатление одной строкой, то это герой, у которого ${senses[3]}.`
    ];
    if(sig) lines.push(`Больше всего в памяти остаётся приём, похожий на «${sig}».`);
    return {
      clues:[lines.join(' ')],
      sourceLabel:'нейровзгляд Dota Hero Hunt',
      sourceNote:'одно большое описание без портрета'
    };
  }

  function spLoreText(raw, heroName){
    const box=document.createElement('div');
    box.innerHTML=String(raw||'')
      .replace(/<br\s*\/?\s*>\s*<br\s*\/?\s*>/gi,'\n\n')
      .replace(/<br\s*\/?\s*>/gi,' ');
    const text=(box.textContent||'')
      .replace(/\r/g,'')
      .replace(/[ \t]+/g,' ')
      .replace(/ *\n */g,'\n')
      .replace(/\n{3,}/g,'\n\n')
      .trim();
    return spRedactHero(text,heroName);
  }

  function spLoreSentences(text){
    return String(text||'')
      .split(/(?<=[.!?])\s+|\n+/)
      .map(x=>x.replace(/\s+/g,' ').trim())
      .filter(x=>spWords(x).length>=5);
  }

  function spBuildLoreFromText(hero, text, sourceLabel){
    const clean=spLoreText(text, hero.name);
    let sentences=spLoreSentences(clean);
    if(sentences.length<4) sentences=clean.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    if(!sentences.length) throw new Error('lore_no_story');
    let body=sentences.slice(0, Math.min(6, sentences.length)).join(' ');
    body=body.replace(/\s+/g,' ').trim();
    if(body.length>1300) body=body.slice(0,1280).replace(/\s+\S*$/,'')+'…';
    if(spWords(body).length<20) throw new Error('lore_story_too_short');
    return {
      clues:[body],
      sourceLabel,
      sourceNote:'официальная история · имя героя скрыто'
    };
  }

  function spKBSlug(name){
    const special={'Anti-Mage':'anti_mage',"Nature's Prophet":'nature_s_prophet'};
    if(special[name]) return special[name];
    return name.toLowerCase().replace(/[’']/g,'').replace(/-/g,'_').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
  }
  function spVoiceSlug(name){
    const special={'Anti-Mage':'antimage'};
    if(special[name]) return special[name];
    return name.toLowerCase().replace(/[’']/g,'').replace(/-/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
  }

  async function spLoadHeroIds(){
    if(spHeroIds) return spHeroIds;
    const cached=spGetSession('dhh_official_hero_ids_v3');
    if(cached && Object.keys(cached).length>120){ spHeroIds=cached; return cached; }
    const j=await spFetchJson('https://www.dota2.com/datafeed/herolist?language=english',6500);
    const list=j?.result?.data?.heroes || [];
    const map={};
    list.forEach(h=>{ if(h.name_english_loc) map[h.name_english_loc]=h.id; if(h.name_loc) map[h.name_loc]=h.id; });
    if(Object.keys(map).length<120) throw new Error('hero_list_incomplete');
    spHeroIds=map; spSetSession('dhh_official_hero_ids_v3', map); return map;
  }

  async function spLoadLore(hero){
    if(spMemory.lore.has(hero.name)) return spMemory.lore.get(hero.name);
    const cache=spGetSession('dhh_lore_single_'+hero.name);
    if(cache?.clues?.length){ spMemory.lore.set(hero.name, cache); return cache; }
    const ids=await spLoadHeroIds(), id=ids[hero.name];
    if(!id) throw new Error('hero_id_missing');
    const j=await spFetchJson(`https://www.dota2.com/datafeed/herodata?hero_id=${encodeURIComponent(id)}&language=russian`,7000);
    const d=j?.result?.data?.heroes?.[0], text=d?.bio_loc||d?.lore_loc||'';
    if(Number(d?.id)!==Number(id)) throw new Error('lore_hero_id_mismatch');
    if(d?.name_english_loc && spNormalizeSimple(d.name_english_loc)!==spNormalizeSimple(hero.name)) throw new Error('lore_hero_name_mismatch');
    if(!/[А-Яа-яЁё]/.test(text) || spWords(text).length<25) throw new Error('lore_empty');
    const built=spBuildLoreFromText(hero, text, 'официальный лор Dota 2');
    spMemory.lore.set(hero.name, built); spSetSession('dhh_lore_single_'+hero.name, built); return built;
  }

  const SP_ALL_HERO_NAMES = HEROES.map(h=>spNormalizeSimple(h.name)).filter(Boolean).sort((a,b)=>b.length-a.length);
  function spContainsHeroName(text,currentHero){
    const n=spNormalizeSimple(text); if(!n) return true;
    for(const heroName of SP_ALL_HERO_NAMES){
      if(heroName===spNormalizeSimple(currentHero)) continue;
      if(heroName.length>=5 && (` ${n} `).includes(` ${heroName} `)) return true;
    }
    for(const a of spAliases(currentHero)){
      const x=spNormalizeSimple(a);
      if(x.length>=3 && n.includes(x)) return true;
    }
    return false;
  }

  function spQuoteScore(item){
    const t=spCleanText(item.text||'');
    const w=spWords(t);
    let s=w.length + w.filter(x=>x.length>=7).length*1.4;
    const c=String(item.criteria||'').toLowerCase();
    if(c.includes('cast')||c.includes('ability')) s+=1.7;
    if(c.includes('kill')||c.includes('rival')) s+=1.0;
    if(/[!?]/.test(t)) s+=0.25;
    return s;
  }

  function spNormalizeAudioUrl(v){
    if(!v) return '';
    const s=String(v).trim();
    if(!s) return '';
    if(/^https?:\/\//i.test(s)) return s;
    if(/^\/\//.test(s)) return 'https:'+s;
    if(/\.(mp3|ogg|wav|webm)(\?|$)/i.test(s)){
      const clean=s.replace(/^\/+/, '');
      if(s.startsWith('/')) return 'https://raw.githubusercontent.com/mdiller/dotabase/master'+s;
      return 'https://raw.githubusercontent.com/mdiller/dotabase/master/'+clean;
    }
    return '';
  }

  function spExtractAudioUrl(item){
    const direct=[
      item?.mp3, item?.ogg, item?.wav, item?.webm, item?.url, item?.audio, item?.sound, item?.sound_url,
      item?.audio_url, item?.clip, item?.vo, item?.voice, item?.file, item?.filename, item?.response_mp3
    ];
    const nested=item?.files && typeof item.files==='object' ? Object.values(item.files) : [];
    for(const raw of [...direct, ...nested]){
      const u=spNormalizeAudioUrl(raw);
      if(u) return u;
    }
    return '';
  }

  function spSelectVoice(hero, arr){
    const dedupe=new Set();
    const candidates=(Array.isArray(arr)?arr:[]).map(x=>{
      const text=spCleanText(x?.text||'');
      return {...x, text, audioUrl: spExtractAudioUrl(x)};
    }).filter(x=>{
      const wc=spWords(x.text).length;
      const key=spNormalizeSimple(x.text);
      if(!x.audioUrl) return false;
      if(!x.text || wc<3 || wc>11 || x.text.length<8 || x.text.length>92 || dedupe.has(key)) return false;
      if(spContainsHeroName(x.text, hero.name)) return false;
      if(/^(ha+|heh+|hmm+|mmm+|oh+|ah+|yes|no|right|good|fine)[!.? ]*$/i.test(x.text)) return false;
      dedupe.add(key);
      return true;
    }).map(x=>({...x, _score: spQuoteScore(x)})).sort((a,b)=>a._score-b._score);
    if(!candidates.length) throw new Error('no_voice_candidates');
    const pick=candidates[Math.floor((candidates.length-1)*0.55)] || candidates[0];
    return {
      clues:[''],
      audioUrl: pick.audioUrl,
      sourceLabel:'игровая озвучка Dota 2',
      sourceNote:'без текстовой подсказки'
    };
  }

  async function spLoadVoice(hero){
    if(spMemory.voice.has(hero.name)) return spMemory.voice.get(hero.name);
    const cache=spGetSession('dhh_voice_audio_'+hero.name);
    if(cache?.audioUrl){ spMemory.voice.set(hero.name, cache); return cache; }
    const slug=spVoiceSlug(hero.name);
    const arr=await spFetchJson(`https://raw.githubusercontent.com/mdiller/dotabase/master/json/responses/${encodeURIComponent(slug)}.json`,7000);
    const built=spSelectVoice(hero, arr);
    spMemory.voice.set(hero.name, built); spSetSession('dhh_voice_audio_'+hero.name, built); return built;
  }

  async function spBuildSpecial(mode, hero){
    if(mode==='ai') return spBuildAI(hero);
    if(mode==='lore') return await spLoadLore(hero);
    if(mode==='voice') return await spLoadVoice(hero);
    throw new Error('unknown_mode');
  }

  async function startSpecialRound(mode){
    if(spLoading) return;
    const m=SP_MODE_META[mode]; if(!m) return;
    spLoading=true; spMode=mode; window.__dhhSpecialMode=mode;
    challengeMode=false; dailyMode=false; dailySelectedDay=null;
    $('challengeHud')?.classList.add('hiddenAuth');
    spClearAnswer(); spApplyTheme(mode); SP_BASE_SHOW_PAGE('game'); spLoadingClue(mode);

    let hero=spPickHero(), built=null, lastError=null;
    const tries=mode==='ai'?1:7;
    for(let attempt=0; attempt<tries; attempt++){
      if(attempt>0) hero=spPickHero();
      try{ built=await spBuildSpecial(mode, hero); break; }catch(e){ lastError=e; }
    }

    if(!built){
      const box=$('clues');
      box.innerHTML='';
      const c=document.createElement('div');
      c.className='specialCard';
      c.innerHTML='<div class="specialLead">Источник временно недоступен</div><div class="storyBody">Нажми «Новый раунд» — будет выбран другой герой.</div>';
      box.appendChild(c);
      $('nextClue').disabled=true;
      $('newRound').textContent='Новый раунд';
      spLoading=false;
      console.warn('special mode source unavailable', lastError);
      return;
    }

    lastHero=hero.name;
    revealed=1;
    finished=false;
    attemptsAtStage=0;
    roundTelemetryToken=spUUID();
    round={
      hero:hero.name,
      letter:'?', word:'',
      clues:built.clues && built.clues.length ? built.clues.slice(0,1) : [''],
      scores:[m.score],
      sourceLabel:built.sourceLabel,
      sourceNote:built.sourceNote,
      specialMode:mode,
      audioUrl:built.audioUrl||''
    };

    $('guess').value='';
    $('feedback').textContent='';
    $('feedback').className='feedback';
    $('guess').disabled=false;
    $('guessBtn').disabled=false;
    spRenderSpecialClues();
    updateAttempts();
    $('guess').focus();
    spLoading=false;
    spPrefetch(mode);
  }

  function spPrefetch(mode){
    const token=++spPrefetchToken;
    const go=async()=>{ if(token!==spPrefetchToken || spMode!==mode) return; const hero=spPickHero(); try{ await spBuildSpecial(mode, hero); }catch{} };
    if('requestIdleCallback' in window) requestIdleCallback(go,{timeout:2200}); else setTimeout(go,500);
  }

  function spResetMode(){
    spMode=null;
    window.__dhhSpecialMode=null;
    spPrefetchToken++;
    spPauseAudio();
    spResetGameTheme();
  }

  newRound = function(){ return spMode ? startSpecialRound(spMode) : SP_BASE_NEW_ROUND(); };
  showPage = function(page){ if(page==='home') spResetMode(); return SP_BASE_SHOW_PAGE(page); };

  document.querySelectorAll('[data-special-mode]').forEach(btn=>{
    btn.addEventListener('click',()=>startSpecialRound(btn.dataset.specialMode));
  });
  const start=$('startBtn'); if(start) start.onclick=()=>{ spResetMode(); SP_BASE_NEW_ROUND(); };
  const back=$('backHome'); if(back) back.onclick=()=>{ if(dailyMode) return openDailyHunt(); if(challengeMode) return showPage('friends'); spResetMode(); SP_BASE_SHOW_PAGE('home'); };

  spPatchHomeCards();

  window.__DHH_SPECIAL_QA__ = {
    modes:Object.keys(SP_MODE_META),
    buildAI:(name)=>spBuildAI(spHeroData(name)),
    voiceSlug:spVoiceSlug,
    kbSlug:spKBSlug,
    version:'special-modes-v4-polish'
  };
})();
