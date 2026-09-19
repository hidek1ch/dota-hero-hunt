(() => {
  'use strict';

  const SP_MODE_META = {
    lore: {
      className: 'specialLore', icon: '⌘', label: 'ЛОР-АРХИВ', title: 'Кто скрыт в истории?',
      meta: '127 героев · официальный лор · 3 уровня', clueTitle: 'Архивные следы',
      mystery: 'официальный лор', tiers: ['Сложный архив', 'Средний архив', 'Прямой фрагмент'],
      scores: [1200, 800, 500], source: 'Valve Dota 2 Data Feed'
    },
    ai: {
      className: 'specialAI', icon: 'AI', label: 'НЕЙРОВЗГЛЯД', title: 'Кого увидела нейросеть?',
      meta: '127 героев · образ без портрета · 3 скана', clueTitle: 'Нейросетевой образ',
      mystery: 'синтетический образ', tiers: ['Скан 01 · абстрактный', 'Скан 02 · контекст', 'Скан 03 · ключевой штрих'],
      scores: [1200, 800, 500], source: 'Локальный генератор образов'
    },
    voice: {
      className: 'specialVoice', icon: '”', label: 'ГОЛОС ГЕРОЯ', title: 'Кто произносит эту фразу?',
      meta: 'реальные короткие реплики · сложная → лёгкая', clueTitle: 'Реплики героя',
      mystery: 'голосовой отпечаток', tiers: ['Сложная реплика', 'Средняя реплика', 'Лёгкая реплика'],
      scores: [1200, 800, 500], source: 'Dota 2 game response data'
    }
  };

  const SP_TAG_VISUAL = {
    area: 'пространство вокруг фигуры расходится широкими кругами',
    attacks: 'каждый обычный удар оставляет повторяющийся ритмичный след',
    control: 'воздух вокруг цели словно становится теснее и тяжелее',
    displace: 'силуэты противников сдвигаются со своих мест чужой волей',
    economy: 'за спиной накапливаются монеты, трофеи и следы ускоренного роста',
    global: 'образ будто одновременно присутствует в нескольких далёких точках',
    lowhp: 'чем опаснее становится состояние фигуры, тем ярче она выглядит',
    mana: 'вместо крови по контуру пульсирует запас холодной энергии',
    mobility: 'силуэт рвётся вперёд скачком, оставляя прежнее место пустым',
    position: 'вся сцена построена вокруг идеально выбранной позиции',
    range: 'угроза приходит с дистанции, ещё до сближения фигур',
    stealth: 'часть силуэта растворена и заметна только по последствиям',
    summons: 'рядом появляются отдельные подчинённые фигуры и существа',
    sustain: 'полученный урон будто постепенно затягивается прямо в бою',
    target: 'вся композиция упорно сходится к одной выбранной цели',
    tempo: 'картина ускоряется, будто герой навязывает собственный ритм',
    terrain: 'деревья, стены и сама геометрия местности становятся частью образа',
    timing: 'главный акцент — один короткий момент, когда всё должно совпасть',
    transform: 'форма фигуры меняется прямо внутри сцены'
  };

  const SP_ATTR_VISUAL = {
    strength: 'тяжёлый устойчивый силуэт, который ощущается массивнее окружения',
    agility: 'резкий подвижный силуэт, собранный из тонких быстрых линий',
    intelligence: 'фигура, окружённая слоями знаков, импульсов и управляемой энергии',
    universal: 'смешанный образ без одной доминирующей формы — сила, скорость и энергия сплетены вместе'
  };

  const SP_RU_STOP = new Set(('это этот эта эти его её их он она они как что чтобы когда где куда от до из за над под при для про без между через после перед уже ещё только даже очень был была были быть есть стал стала становится словно будто который которая которые которого которой которых один одна одно несколько много весь вся все свой свои себя себе там здесь потом потому поэтому такой такая такие также или либо но а и да не ни в на по с со к ко у о об обо мы вы ты я мне тебе ему ей нам вам им кто чего чем чему кого кого-то кем какая какой какие каким каких того того-то того же самого самой самых тоже вокруг среди внутри рядом назад вперед вперёд можно нельзя герой героя герою героем герои героями имя имени именем персонаж персонажа dota дота').split(/\s+/));

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
  const spMemory = {lore:new Map(), voice:new Map()};

  window.__dhhSpecialMode = null;

  function spEscRe(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  function spCleanHtml(v){
    const box=document.createElement('div'); box.innerHTML=String(v||'').replace(/<br\s*\/?\s*>/gi,' ');
    return (box.textContent||'').replace(/\s+/g,' ').trim();
  }
  function spWords(v){return String(v||'').match(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё'’\-]{1,}/g)||[]}
  function spNormalizeSimple(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[’']/g,'').replace(/[^a-zа-я0-9]+/gi,' ').trim()}
  function spHeroData(name){return HEROES.find(h=>h.name===name)}
  function spRoundData(name){return ROUNDS.find(r=>r.hero===name)}
  function spAliases(name){const h=spHeroData(name);return [name,h?.ru,...(h?.aliases||[])].filter(Boolean)}
  function spRedactHero(text,name){
    let out=String(text||'');
    for(const alias of spAliases(name).sort((a,b)=>b.length-a.length)){
      if(String(alias).length<3)continue;
      out=out.replace(new RegExp(spEscRe(alias),'giu'),'[имя скрыто]');
    }
    return out;
  }
  function spSetSession(key,val){try{sessionStorage.setItem(key,JSON.stringify(val))}catch{}}
  function spGetSession(key){try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}}
  function spUUID(){if(typeof makeRoundToken==='function')return makeRoundToken();try{if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID()}catch{};return '00000000-0000-4000-8000-'+Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12)}

  async function spFetchJson(url, timeout=7000){
    const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),timeout);
    try{
      const r=await fetch(url,{signal:ctrl.signal,cache:'force-cache',credentials:'omit'});
      if(!r.ok)throw new Error('http_'+r.status);
      return await r.json();
    }finally{clearTimeout(timer)}
  }

  function spResetGameTheme(){
    const game=document.getElementById('game');
    if(game)game.classList.remove('specialMode','specialLore','specialAI','specialVoice');
    const q=document.getElementById('gameQuestion'); if(q)q.textContent='Кто этот герой?';
    const ct=document.getElementById('clueTitle'); if(ct)ct.textContent='Цепочка связей';
    const ml=document.getElementById('mysteryLabel'); if(ml)ml.textContent='буква раунда';
  }

  function spApplyTheme(mode){
    const m=SP_MODE_META[mode], game=document.getElementById('game'); if(!m||!game)return;
    game.classList.remove('specialLore','specialAI','specialVoice');
    game.classList.add('specialMode',m.className);
    document.getElementById('gameModeLabel').textContent=m.label;
    document.getElementById('gameModeMeta').textContent=m.meta;
    document.getElementById('gameQuestion').textContent=m.title;
    document.getElementById('clueTitle').textContent=m.clueTitle;
    document.getElementById('letter').textContent=m.icon;
    document.getElementById('mysteryLabel').textContent=m.mystery;
    document.getElementById('newRound').textContent='Новый раунд';
  }

  function spClearAnswer(){
    const ap=document.getElementById('answerPanel'); if(ap)ap.remove();
    document.querySelector('.gameGrid')?.classList.remove('hasAnswer');
    document.querySelectorAll('.hideAfterAnswer').forEach(el=>el.classList.remove('hideAfterAnswer'));
  }

  function spLoadingClue(mode){
    const m=SP_MODE_META[mode];
    const box=document.getElementById('clues'); if(!box)return;
    box.innerHTML='';
    const c=document.createElement('div');c.className='clue specialClue loadingClue';
    c.textContent=mode==='lore'?'Собираю архивные следы…':mode==='voice'?'Подбираю реплику…':'Строю нейрообраз…';
    box.appendChild(c);
    document.getElementById('levelBadge').textContent='Подготовка раунда';
    document.getElementById('nextClue').disabled=true;
    document.getElementById('guess').disabled=true;
    document.getElementById('guessBtn').disabled=true;
    document.getElementById('score').textContent=m.scores[0];
  }

  function spRenderSpecialClues(){
    const m=SP_MODE_META[spMode]; if(!m||!round)return SP_BASE_RENDER_CLUES();
    const score=(round.scores||m.scores)[Math.min(revealed-1,2)]||500;
    document.getElementById('score').textContent=score;
    document.getElementById('levelBadge').textContent=`${m.tiers[Math.min(revealed-1,2)]} · ${score} очков`;
    const box=document.getElementById('clues'); box.innerHTML='';
    round.clues.slice(0,revealed).forEach((txt,i)=>{
      const c=document.createElement('div');c.className='clue specialClue';
      const tier=document.createElement('span');tier.className='clueTier';tier.textContent=m.tiers[i]||`Подсказка ${i+1}`;
      const body=document.createElement('span');body.className='clueText';body.textContent=txt;
      c.append(tier,body);box.appendChild(c);
    });
    const source=document.createElement('div');source.className='modeSource';
    source.innerHTML=`<b>Источник:</b> ${escapeHtml(round.sourceLabel||m.source)}${round.sourceNote?` · ${escapeHtml(round.sourceNote)}`:''}`;
    box.appendChild(source);
    const next=document.getElementById('nextClue');next.textContent=revealed<round.clues.length?'Открыть следующий уровень':'Подсказки закончились';next.disabled=revealed>=round.clues.length;
  }

  renderClues=function(){return spMode?spRenderSpecialClues():SP_BASE_RENDER_CLUES()};

  saveSoloState=function(){if(spMode)return;return SP_BASE_SAVE_SOLO()};
  if(SP_BASE_RECORD_TELEMETRY){recordClueTelemetry=function(...args){if(spMode)return;return SP_BASE_RECORD_TELEMETRY(...args)}}
  updateAttempts=function(){
    const r=SP_BASE_UPDATE_ATTEMPTS();
    if(spMode&&!finished){
      const left=Math.max(0,maxAttempts()-attemptsAtStage),input=document.getElementById('guess');
      if(input&&!input.disabled)input.placeholder=`Введите имя героя · попыток: ${left}`;
      const info=document.getElementById('attemptInfo'); if(info&&left===0)info.textContent='Попытки закончились — открой следующую подсказку.';
    }
    return r;
  };

  function spPickHero(){
    const pool=HEROES.filter(h=>h.name!==lastHero);
    return pool[Math.floor(Math.random()*pool.length)];
  }

  function spExtractSignature(heroName){
    const base=spRoundData(heroName); if(!base)return '';
    const all=[...(base.clues||[]),...((base.variants||[]).flat())];
    for(const c of all){
      const m=String(c).match(/—\s*([^.!?]{3,64})/); if(m){const v=m[1].trim();if(!spNormalizeSimple(v).includes(spNormalizeSimple(heroName)))return v;}
    }
    return '';
  }

  function spBuildAI(hero){
    const base=spRoundData(hero.name), tags=(base?.variantTags?.[0]||[]).filter(t=>!String(t).startsWith('sig:'));
    const attr=SP_ATTR_VISUAL[hero.attribute]||SP_ATTR_VISUAL.universal;
    const t=[...new Set(tags)].map(x=>SP_TAG_VISUAL[x]).filter(Boolean);
    while(t.length<4)t.push(SP_TAG_VISUAL.position,SP_TAG_VISUAL.timing);
    const sig=spExtractSignature(hero.name);
    const hard=`Нейросеть не рисует лицо. Она видит ${attr}; ${t[0]}.`;
    const medium=`Во втором слое образа ${t[1]}; одновременно ${t[2]}. Это выглядит как метафора привычного стиля героя, а не его игровой портрет.`;
    const easy=sig?`Последний штрих: нейросеть связывает этот образ с механикой «${sig}», но всё ещё не показывает самого героя.`:`Последний штрих: ${t[3]}; вся сцена сходится к узнаваемому игровому приёму этого героя.`;
    return {clues:[hard,medium,easy],sourceLabel:'Dota Hero Hunt · локальный AI-образ',sourceNote:'без внешних изображений'};
  }

  function spLoreStop(w){const x=spNormalizeSimple(w);return x.length<4||SP_RU_STOP.has(x)}
  function spLoreKeywords(text,heroName){
    const originals=spWords(spRedactHero(text,heroName));
    const freq=new Map(),form=new Map(),first=new Map();
    originals.forEach((w,i)=>{const k=spNormalizeSimple(w);if(spLoreStop(k)||k.includes('имя скрыто'))return;freq.set(k,(freq.get(k)||0)+1);if(!form.has(k))form.set(k,w);if(!first.has(k))first.set(k,i)});
    const arr=[...freq.keys()].map(k=>({k,v:form.get(k),f:freq.get(k),i:first.get(k),score:(k.length*1.15)+(freq.get(k)===1?4:0)+( /^[А-ЯA-ZЁ]/.test(form.get(k))?2.5:0)}));
    arr.sort((a,b)=>b.score-a.score||a.i-b.i);
    return arr.map(x=>x.v).filter((v,i,a)=>a.findIndex(x=>spNormalizeSimple(x)===spNormalizeSimple(v))===i).slice(0,18);
  }
  function spLoreSnippet(text,heroName,maxWords=18){
    const clean=spRedactHero(spCleanHtml(text),heroName);
    let sentences=clean.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean);
    sentences=sentences.filter(s=>{const n=spWords(s).length;return n>=8&&n<=38&&!/\[имя скрыто\].*\[имя скрыто\]/i.test(s)});
    if(!sentences.length)sentences=[clean];
    sentences.sort((a,b)=>Math.abs(spWords(a).length-18)-Math.abs(spWords(b).length-18));
    let words=sentences[0].split(/\s+/).filter(Boolean).slice(0,maxWords);
    let out=words.join(' ').replace(/[,:;\-–—]+$/,'').trim();
    if(words.length>=maxWords&&!/[.!?]$/.test(out))out+='…';
    return out;
  }
  function spBuildLoreFromText(hero,text,sourceLabel){
    const clean=spCleanHtml(text), keys=spLoreKeywords(clean,hero.name);
    const safe=keys.length>=8?keys:['история','связь','прошлое','место','сила','враг','союз','судьба'];
    // spLoreKeywords is ordered from more distinctive to more generic: keep the rarer markers for stage 2.
    const hardKeys=(safe.length>=9?safe.slice(-4):safe.slice(Math.max(0,safe.length-4)));
    const mediumKeys=safe.slice(0,Math.min(5,safe.length));
    const hard=`Архивные маркеры: ${hardKeys.join(' · ')}.`;
    const medium=`Более характерные следы официальной истории: ${mediumKeys.join(' · ')}.`;
    const snip=spLoreSnippet(clean,hero.name,18);
    const easy=`Короткий фрагмент архива: «${snip}»`;
    return {clues:[hard,medium,easy],sourceLabel,sourceNote:'имя героя скрыто'};
  }

  function spKBSlug(name){
    const special={'Anti-Mage':'anti_mage',"Nature's Prophet":'nature_s_prophet'};
    if(special[name])return special[name];
    return name.toLowerCase().replace(/[’']/g,'').replace(/-/g,'_').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
  }
  function spVoiceSlug(name){
    const special={'Anti-Mage':'antimage'};if(special[name])return special[name];
    return name.toLowerCase().replace(/[’']/g,'').replace(/-/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
  }

  async function spLoadHeroIds(){
    if(spHeroIds)return spHeroIds;
    const cached=spGetSession('dhh_official_hero_ids_v2');if(cached&&Object.keys(cached).length>120){spHeroIds=cached;return cached}
    const j=await spFetchJson('https://www.dota2.com/datafeed/herolist?language=english',6500);
    const list=j?.result?.data?.heroes||[];const map={};
    list.forEach(h=>{if(h.name_english_loc)map[h.name_english_loc]=h.id;if(h.name_loc)map[h.name_loc]=h.id});
    if(Object.keys(map).length<120)throw new Error('hero_list_incomplete');
    spHeroIds=map;spSetSession('dhh_official_hero_ids_v2',map);return map;
  }

  async function spLoadLore(hero){
    if(spMemory.lore.has(hero.name))return spMemory.lore.get(hero.name);
    const cache=spGetSession('dhh_lore_'+hero.name);if(cache?.clues?.length===3){spMemory.lore.set(hero.name,cache);return cache}
    let built=null;
    try{
      const ids=await spLoadHeroIds(),id=ids[hero.name];if(!id)throw new Error('hero_id_missing');
      const j=await spFetchJson(`https://www.dota2.com/datafeed/herodata?hero_id=${encodeURIComponent(id)}&language=russian`,7000);
      const d=j?.result?.data?.heroes?.[0],text=d?.bio_loc||d?.lore_loc||'';
      if(Number(d?.id)!==Number(id))throw new Error('lore_hero_id_mismatch');
      if(d?.name_english_loc&&spNormalizeSimple(d.name_english_loc)!==spNormalizeSimple(hero.name))throw new Error('lore_hero_name_mismatch');
      if(spWords(spCleanHtml(text)).length<25)throw new Error('lore_empty');
      built=spBuildLoreFromText(hero,text,'Valve Dota 2 Data Feed · RU');
    }catch{
      const slug=spKBSlug(hero.name);
      const j=await spFetchJson(`https://raw.githubusercontent.com/eendor/dota2-knowledge-base/main/data/heroes/${encodeURIComponent(slug)}.json`,7000);
      if(spNormalizeSimple(j?.name)!==spNormalizeSimple(hero.name))throw new Error('lore_fallback_hero_mismatch');
      const text=j?.lore||'';if(spWords(spCleanHtml(text)).length<25)throw new Error('lore_fallback_empty');
      built=spBuildLoreFromText(hero,text,'Valve-derived hero data · EN');
    }
    spMemory.lore.set(hero.name,built);spSetSession('dhh_lore_'+hero.name,built);return built;
  }

  const SP_ALL_HERO_NAMES = HEROES.map(h=>spNormalizeSimple(h.name)).filter(Boolean).sort((a,b)=>b.length-a.length);
  function spContainsHeroName(text,currentHero){
    const n=spNormalizeSimple(text);if(!n)return true;
    for(const heroName of SP_ALL_HERO_NAMES){
      if(heroName===spNormalizeSimple(currentHero))continue;
      if(heroName.length>=5 && (` ${n} `).includes(` ${heroName} `))return true;
    }
    for(const a of spAliases(currentHero)){const x=spNormalizeSimple(a);if(x.length>=3&&n.includes(x))return true}
    return false;
  }
  function spQuoteScore(item){
    const w=spWords(item.text),long=w.filter(x=>x.length>=7).length;
    let s=w.length+long*1.8;
    const c=String(item.criteria||'').toLowerCase();
    if(c.includes('cast')||c.includes('ability'))s+=2.2;
    if(c.includes('kill')||c.includes('rival'))s+=1.2;
    if(/[!?]/.test(item.text))s+=.35;
    if(w.length<=3)s-=1.2;
    return s;
  }
  function spSelectVoice(hero,arr){
    const dedupe=new Set();
    const candidates=(Array.isArray(arr)?arr:[]).filter(x=>{
      const t=String(x?.text||'').replace(/\s+/g,' ').trim(),wc=spWords(t).length,key=spNormalizeSimple(t);
      if(!t||wc<3||wc>11||t.length<8||t.length>92||dedupe.has(key))return false;
      if(spContainsHeroName(t,hero.name))return false;
      if(/^(ha+|heh+|hmm+|mmm+|oh+|ah+|yes|no|right|good|fine)[!.? ]*$/i.test(t))return false;
      if(/[<>]/.test(t))return false;
      dedupe.add(key);return true;
    }).map(x=>({...x,_score:spQuoteScore(x)})).sort((a,b)=>a._score-b._score);
    if(candidates.length<3)throw new Error('not_enough_quotes');
    const at=p=>candidates[Math.max(0,Math.min(candidates.length-1,Math.floor((candidates.length-1)*p)))];
    const picks=[at(.22),at(.58),at(.9)];
    const used=new Set();
    for(let i=0;i<picks.length;i++){
      if(!picks[i]||used.has(spNormalizeSimple(picks[i].text))){picks[i]=candidates.find(x=>!used.has(spNormalizeSimple(x.text)))||candidates[i];}
      used.add(spNormalizeSimple(picks[i].text));
    }
    return {clues:picks.map(x=>`«${String(x.text).trim()}»`),sourceLabel:'Dota 2 response data',sourceNote:'короткие игровые реплики'};
  }
  async function spLoadVoice(hero){
    if(spMemory.voice.has(hero.name))return spMemory.voice.get(hero.name);
    const cache=spGetSession('dhh_voice_'+hero.name);if(cache?.clues?.length===3){spMemory.voice.set(hero.name,cache);return cache}
    const slug=spVoiceSlug(hero.name),arr=await spFetchJson(`https://raw.githubusercontent.com/mdiller/dotabase/master/json/responses/${encodeURIComponent(slug)}.json`,7000);
    const built=spSelectVoice(hero,arr);spMemory.voice.set(hero.name,built);spSetSession('dhh_voice_'+hero.name,built);return built;
  }

  async function spBuildSpecial(mode,hero){
    if(mode==='ai')return spBuildAI(hero);
    if(mode==='lore')return await spLoadLore(hero);
    if(mode==='voice')return await spLoadVoice(hero);
    throw new Error('unknown_mode');
  }

  async function startSpecialRound(mode){
    if(spLoading)return;
    const m=SP_MODE_META[mode];if(!m)return;
    spLoading=true;spMode=mode;window.__dhhSpecialMode=mode;
    challengeMode=false;dailyMode=false;dailySelectedDay=null;
    document.getElementById('challengeHud')?.classList.add('hiddenAuth');
    spClearAnswer();spApplyTheme(mode);SP_BASE_SHOW_PAGE('game');spLoadingClue(mode);
    let hero=spPickHero(),built=null,lastError=null;
    const tries=mode==='ai'?1:4;
    for(let attempt=0;attempt<tries;attempt++){
      if(attempt>0)hero=spPickHero();
      try{built=await spBuildSpecial(mode,hero);break}catch(e){lastError=e}
    }
    if(!built){
      // Never substitute an invented quote/lore line. Keep the round playable via a neutral retry state.
      const box=document.getElementById('clues');box.innerHTML='';const c=document.createElement('div');c.className='clue specialClue';
      c.innerHTML='<span class="clueTier">Источник временно недоступен</span><span class="clueText modeError">Нажми «Новый раунд» — будет выбран другой герой.</span>';box.appendChild(c);
      document.getElementById('newRound').textContent='Новый раунд';document.getElementById('nextClue').disabled=true;spLoading=false;console.warn('special mode source unavailable',lastError);return;
    }
    lastHero=hero.name;revealed=1;finished=false;attemptsAtStage=0;roundTelemetryToken=spUUID();
    round={hero:hero.name,letter:'?',word:'',clues:built.clues.slice(0,3),scores:m.scores,sourceLabel:built.sourceLabel,sourceNote:built.sourceNote,specialMode:mode};
    document.getElementById('guess').value='';document.getElementById('feedback').textContent='';document.getElementById('feedback').className='feedback';
    spRenderSpecialClues();updateAttempts();document.getElementById('guess').focus();spLoading=false;
    spPrefetch(mode);
  }

  function spPrefetch(mode){
    const token=++spPrefetchToken;
    const go=async()=>{if(token!==spPrefetchToken||spMode!==mode)return;const hero=spPickHero();try{await spBuildSpecial(mode,hero)}catch{}};
    if('requestIdleCallback' in window)requestIdleCallback(go,{timeout:2200});else setTimeout(go,500);
  }

  function spResetMode(){spMode=null;window.__dhhSpecialMode=null;spPrefetchToken++;spResetGameTheme()}

  newRound=function(){return spMode?startSpecialRound(spMode):SP_BASE_NEW_ROUND()};
  showPage=function(page){if(page==='home')spResetMode();return SP_BASE_SHOW_PAGE(page)};

  document.querySelectorAll('[data-special-mode]').forEach(btn=>{
    btn.addEventListener('click',()=>startSpecialRound(btn.dataset.specialMode));
  });
  const start=document.getElementById('startBtn');if(start)start.onclick=()=>{spResetMode();SP_BASE_NEW_ROUND()};
  const back=document.getElementById('backHome');if(back)back.onclick=()=>{if(dailyMode)return openDailyHunt();if(challengeMode)return showPage('friends');spResetMode();SP_BASE_SHOW_PAGE('home')};

  // Small self-check exposed for automated QA; no network required.
  window.__DHH_SPECIAL_QA__={
    modes:Object.keys(SP_MODE_META),
    buildAI:(name)=>spBuildAI(spHeroData(name)),
    voiceSlug:spVoiceSlug,
    kbSlug:spKBSlug,
    tags:Object.keys(SP_TAG_VISUAL),
    version:'special-modes-v1'
  };
})();
