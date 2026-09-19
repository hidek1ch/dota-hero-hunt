(() => {
  'use strict';

  const META = {
    lore: {
      className: 'specialLore', icon: '✦', label: 'ЛОР-АРХИВ',
      title: 'Угадай героя по его истории', meta: 'свободный режим · история героя без названий способностей',
      clueTitle: 'История героя', mystery: 'история', badge: 'Фрагмент истории', score: 1000
    },
    ai: {
      className: 'specialAI', icon: '◎', label: 'НЕЙРОВЗГЛЯД',
      title: 'Угадай героя по нейровзгляду', meta: 'свободный режим · один цельный образ без прямых подсказок',
      clueTitle: 'Нейровзгляд', mystery: 'образ', badge: 'Дневник наблюдений', score: 1000
    },
    voice: {
      className: 'specialVoice', icon: '♫', label: 'ГОЛОС ГЕРОЯ',
      title: 'Угадай героя по голосу', meta: 'свободный режим · настоящая реплика героя из Dota 2',
      clueTitle: 'Голос героя', mystery: 'голос', badge: 'Настоящая реплика', score: 1000
    }
  };

  const SPECIAL_KEY = 'dhh_special_state_v15';
  const MODE_SET = new Set(Object.keys(META));

  const BASE_NEW_ROUND = newRound;
  const BASE_SHOW_PAGE = showPage;
  const BASE_RENDER_CLUES = renderClues;
  const BASE_SAVE_SOLO = saveSoloState;
  const BASE_UPDATE_ATTEMPTS = updateAttempts;
  const BASE_MAX_ATTEMPTS = maxAttempts;
  const BASE_RESTORE_NAVIGATION = typeof restoreNavigation === 'function' ? restoreNavigation : null;

  let spMode = null;
  let spAudio = null;
  let spLoading = false;
  const loreCache = new Map();
  const voiceCache = new Map();

  const $ = id => document.getElementById(id);
  const heroByName = name => HEROES.find(h => h.name === name);
  const roundByHero = name => ROUNDS.find(r => r.hero === name);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const words = v => String(v || '').match(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё'’\-]{1,}/g) || [];
  const norm = v => String(v || '').toLowerCase().replace(/ё/g,'е').replace(/[’']/g,'').replace(/[^a-zа-я0-9]+/gi,' ').trim();
  const unique = a => [...new Set(a.filter(Boolean))];

  const LORE_SLUG = {
    'Anti-Mage':'antimage','Centaur Warrunner':'centaur','Clockwerk':'rattletrap','Doom':'doom_bringer',
    "Nature's Prophet":'furion','Lifestealer':'life_stealer','Magnus':'magnataur','Necrophos':'necrolyte',
    'Outworld Destroyer':'obsidian_destroyer','Queen of Pain':'queenofpain','Shadow Fiend':'nevermore',
    'Timbersaw':'shredder','Treant Protector':'treant','Wraith King':'skeleton_king','Zeus':'zuus',
    'Io':'wisp','Windranger':'windrunner','Vengeful Spirit':'vengefulspirit','Underlord':'underlord'
  };
  const LORE_MISSING = new Set(['Dark Willow','Grimstroke','Hoodwink','Kez','Largo','Marci','Mars','Muerta','Primal Beast','Ringmaster','Snapfire','Void Spirit']);

  const VISION = {
    area:'вокруг фигуры будто меняется само пространство: воздух плотнее, контуры шире, а фон словно отступает',
    attacks:'силуэт кажется собранным из коротких резких импульсов, будто покой для него противоестественен',
    control:'в образе чувствуется почти неприятное спокойствие — как у того, кто уверен, что остальные будут двигаться по его правилам',
    displace:'композиция выглядит неустойчивой: линии вокруг фигуры будто постоянно сдвигаются и теряют прежнее место',
    economy:'в образе есть ощущение накопления — всё лишнее исчезает, а каждая новая деталь делает фигуру тяжелее и увереннее',
    global:'силуэт не помещается в одну сцену: кажется, что его присутствие продолжается далеко за пределами кадра',
    lowhp:'вокруг образа есть хищное терпение — он будто ждёт не начала, а именно момента чужой слабости',
    mana:'фигура воспринимается скорее как поток энергии, чем как обычное тело; внутри неё постоянно что-то пульсирует',
    mobility:'контуры не успевают закрепиться: кажется, что фигура уже ушла из точки, в которой ты её только что увидел',
    position:'образ построен вокруг пустого пространства; важнее самой фигуры выглядит то, где именно она решила остановиться',
    range:'между фигурой и зрителем остаётся намеренная дистанция, словно приближаться к ней — уже ошибка',
    stealth:'края силуэта растворяются в фоне, а самое тревожное ощущение создаёт именно то, чего не видно',
    summons:'образ не выглядит одиноким: за основной фигурой постоянно угадываются вторичные тени и чужое присутствие',
    sustain:'фигура кажется слишком стойкой для своей формы — будто её можно повредить, но трудно действительно убрать из сцены',
    target:'весь образ стягивается в одну точку, как будто всё лишнее для него перестаёт существовать, когда цель выбрана',
    tempo:'в композиции есть внутренний ритм; кажется, что окружающая сцена вынуждена подстраиваться под него',
    terrain:'фон здесь не декорация: камни, деревья и проходы ощущаются частью самой фигуры',
    timing:'образ кажется неподвижным ровно до одного мгновения, после которого вся сцена внезапно меняется',
    transform:'силуэт выглядит незавершённым, как будто привычная форма для него — лишь временное состояние'
  };
  const ATTR_VISION = {
    strength:'тяжёлый, уверенный силуэт с ощущением массы и давления',
    agility:'быстрый, нервный силуэт с острыми линиями и почти хищной пластикой',
    intelligence:'холодный, собранный образ, в котором важнее всего ощущение воли и энергии',
    universal:'неоднозначный образ, где сила, движение и энергия не дают выбрать одну главную черту'
  };

  function aliases(name){ const h=heroByName(name); return [name,h?.ru,...(h?.aliases||[])].filter(Boolean); }
  function redact(text, heroName){
    let out=String(text||'');
    for(const a of aliases(heroName).sort((x,y)=>y.length-x.length)){
      if(String(a).length<3) continue;
      out=out.replace(new RegExp(String(a).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'giu'),'[имя скрыто]');
    }
    return out;
  }
  function abilityNames(heroName){
    const r=roundByHero(heroName), pool=[...(r?.clues||[]),...((r?.variants||[]).flat())], out=[];
    for(const line of pool){ const m=String(line).match(/—\s*([^.!?]{2,80})/); if(m) out.push(m[1].trim()); }
    return unique(out);
  }
  function stripAbilities(text, heroName){
    let out=String(text||'');
    for(const a of abilityNames(heroName).sort((x,y)=>y.length-x.length)){
      if(a.length<3) continue;
      out=out.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'giu'),'');
    }
    return out.replace(/\s{2,}/g,' ').replace(/\s+([,.!?;:])/g,'$1').trim();
  }
  function clearAnswer(){
    spStopAudio();
    document.getElementById('answerPanel')?.remove();
    document.querySelector('.gameGrid')?.classList.remove('hasAnswer');
    document.querySelectorAll('.hideAfterAnswer').forEach(el=>el.classList.remove('hideAfterAnswer'));
  }
  function patchHomeCards(){
    const lore=$('loreHomeCard'), ai=$('aiHomeCard'), voice=$('voiceHomeCard');
    if(lore){ const c=lore.querySelector('.modeCopy'); if(c)c.innerHTML='<b>Лор-архив</b><small>Читай историю героя без названий способностей и угадывай персонажа.</small><span class="modePill">свободный режим</span>'; }
    if(ai){ const c=ai.querySelector('.modeCopy'); if(c)c.innerHTML='<b>Нейровзгляд</b><small>Нейросеть описывает не механику, а впечатление, форму и атмосферу героя.</small><span class="modePill">без прямых намёков</span>'; }
    if(voice){ const c=voice.querySelector('.modeCopy'); if(c)c.innerHTML='<b>Голос героя</b><small>Настоящая реплика из игровых файлов Dota 2. Никакого синтезированного голоса.</small><span class="modePill">реальный voice line</span>'; }
  }
  function setTheme(mode){
    const m=META[mode], game=$('game'); if(!m||!game)return;
    game.classList.remove('specialLore','specialAI','specialVoice'); game.classList.add('specialMode',m.className);
    $('gameModeLabel').textContent=m.label; $('gameModeMeta').textContent=m.meta; $('gameQuestion').textContent=m.title;
    $('clueTitle').textContent=m.clueTitle; $('letter').textContent=m.icon; $('mysteryLabel').textContent=m.mystery;
    $('levelBadge').textContent=m.badge; $('score').textContent=String(m.score); $('nextClue').textContent='Свободный режим'; $('nextClue').disabled=true;
    $('newRound').textContent='Новый раунд';
  }
  function resetTheme(){
    const game=$('game'); if(game)game.classList.remove('specialMode','specialLore','specialAI','specialVoice');
    $('gameModeLabel').textContent='FINAL BETA'; $('gameModeMeta').textContent='127 героев · 3 содержательные подсказки';
    $('gameQuestion').textContent='Кто этот герой?'; $('clueTitle').textContent='Цепочка связей'; $('mysteryLabel').textContent='буква раунда'; $('letter').textContent='?';
  }
  function setFeedback(text,type=''){ const f=$('feedback'); if(!f)return; f.textContent=text; f.className='feedback'+(type?' '+type:''); }

  function specialState(){
    if(!spMode||!round||!MODE_SET.has(spMode))return null;
    return {v:15,mode:spMode,hero:round.hero,clues:round.clues,voiceUrls:round.voiceUrls||[],attempts:attemptsAtStage,finished:!!finished};
  }
  function saveSpecial(){ try{ const s=specialState(); if(s)sessionStorage.setItem(SPECIAL_KEY,JSON.stringify(s)); }catch{} }
  function loadSpecial(){ try{ const s=JSON.parse(sessionStorage.getItem(SPECIAL_KEY)||'null'); return s&&s.v===15&&MODE_SET.has(s.mode)&&heroByName(s.hero)?s:null; }catch{return null;} }
  function clearSpecial(){ try{sessionStorage.removeItem(SPECIAL_KEY);}catch{} }

  function loreSlug(name){
    if(LORE_SLUG[name]) return LORE_SLUG[name];
    return name.toLowerCase().replace(/[’']/g,'').replace(/-/g,'_').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
  }
  async function fetchText(url,timeout=7000){
    const c=new AbortController(), t=setTimeout(()=>c.abort(),timeout);
    try{ const r=await fetch(url,{signal:c.signal,cache:'force-cache',credentials:'omit'}); if(!r.ok)throw new Error('http_'+r.status); return await r.text(); }
    finally{clearTimeout(t);}
  }
  async function fetchJson(url,timeout=7000){ return JSON.parse(await fetchText(url,timeout)); }
  function cleanLore(raw,heroName){
    const box=document.createElement('div'); box.innerHTML=String(raw||'').replace(/<br\s*\/?>/gi,' ');
    let text=(box.textContent||'').replace(/\s+/g,' ').trim();
    text=redact(stripAbilities(text,heroName),heroName);
    const heroNorms=aliases(heroName).map(norm).filter(x=>x.length>=3);
    let sentences=text.split(/(?<=[.!?])\s+/).filter(Boolean);
    sentences=sentences.filter(s=>!heroNorms.some(h=>norm(s).includes(h)) || s.includes('[имя скрыто]'));
    if(!sentences.length) sentences=[text];
    text=sentences.join(' ').replace(/\s+/g,' ').trim();
    if(text.length>1450) text=text.slice(0,1420).replace(/\s+\S*$/,'')+'…';
    return text;
  }
  function fallbackLore(heroName){
    const hero=heroByName(heroName), r=roundByHero(heroName), tags=((r?.variantTags||[])[0]||[]).filter(t=>!String(t).startsWith('sig:'));
    const themes={
      area:'Его история постоянно возвращается к теме масштаба: личная судьба этого существа слишком велика, чтобы оставаться только личной.',
      global:'В легендах о нём расстояние почти теряет смысл: события далеко друг от друга всё равно оказываются частью одной судьбы.',
      stealth:'В рассказах о нём важнее всего тайна — окружающие редко понимают, что произошло, пока последствия уже не стали очевидными.',
      summons:'Его история никогда не ощущается историей одиночки: рядом всегда есть другие существа, последователи или созданные им силы.',
      transform:'Главная тема его прошлого — перемена формы и природы; привычный облик здесь никогда не кажется окончательным.',
      mana:'Его происхождение связано с силами, которые трудно воспринимать как обычную материю: это скорее воля, энергия и древняя магия.',
      terrain:'Место, из которого он пришёл, так же важно, как он сам: окружение словно сформировало его характер и судьбу.',
      lowhp:'В его истории постоянно чувствуется соседство с гибелью — не как случайность, а как знакомая и почти родная часть мира.',
      sustain:'Его прошлое — история выживания и упрямого продолжения пути даже тогда, когда разумнее было бы исчезнуть.',
      control:'В легендах он редко следует чужой воле; наоборот, его присутствие заставляет других принимать навязанные правила.',
      mobility:'Его путь никогда не был прямым: исчезновения, возвращения и резкие перемены места кажутся естественной частью его судьбы.',
      timing:'Его история построена вокруг ожидания нужного мгновения — будто всё важное в ней случается ровно тогда, когда должно.',
      range:'Он будто всегда существовал на некотором расстоянии от обычного мира, наблюдая и вмешиваясь оттуда, где его трудно достать.',
      attacks:'В рассказах о нём чувствуется непрерывность: одно действие почти всегда тянет за собой следующее, не оставляя времени на покой.',
      position:'Для него место никогда не бывает случайным; каждая важная глава истории начинается с выбора точки, где всё изменится.',
      target:'Его судьба часто сужается до одной цели, идеи или противника — и всё остальное на время теряет значение.',
      tempo:'Его легенда ощущается как история того, кто не принимает чужой ритм и всегда пытается задать собственный.',
      displace:'В его прошлом много сломанных путей и чужих судеб: рядом с ним всё слишком легко оказывается не там, где должно было быть.',
      economy:'Его история связана с накоплением — силы, богатства, знаний или власти; ничто полученное не остаётся просто трофеем.'
    };
    const chosen=unique(tags.map(t=>themes[t]).filter(Boolean)).slice(0,3);
    const intro=hero?.attribute==='strength'?'Это история существа, чья воля ощущается почти физически.':hero?.attribute==='agility'?'Это история существа, которое будто никогда не принадлежало одному месту и одному состоянию.':hero?.attribute==='intelligence'?'Это история существа, чьё происхождение связано скорее с тайной и волей, чем с обычной жизнью.':'Это история существа, в котором трудно отделить природу, волю и судьбу друг от друга.';
    return [intro,...chosen,'Имя в архиве скрыто: остаётся только понять, чья судьба описана в этих фрагментах.'].join(' ');
  }
  async function loadLore(heroName){
    if(loreCache.has(heroName))return loreCache.get(heroName);
    let text='';
    if(!LORE_MISSING.has(heroName)){
      try{
        const slug=loreSlug(heroName);
        const raw=await fetchText(`https://raw.githubusercontent.com/mrprona92/SecretBrand/master/app/src/main/assets/heroes/${encodeURIComponent(slug)}/lore_russian.txt`,6500);
        text=cleanLore(raw,heroName);
        if(words(text).length<22)text='';
      }catch{}
    }
    if(!text)text=fallbackLore(heroName);
    const built={text}; loreCache.set(heroName,built); return built;
  }

  function aiVision(heroName){
    const hero=heroByName(heroName), r=roundByHero(heroName);
    const tags=unique(((r?.variantTags||[])[0]||[]).filter(t=>!String(t).startsWith('sig:'))).slice(0,4);
    const images=tags.map(t=>VISION[t]).filter(Boolean);
    const base=ATTR_VISION[hero?.attribute]||ATTR_VISION.universal;
    while(images.length<3)images.push('вокруг фигуры есть напряжение, которое трудно объяснить одной конкретной деталью');
    const paragraphs=[
      `Я вижу ${base}. Не лицо и не костюм — скорее общее ощущение от того, как этот персонаж присутствует в сцене.`,
      `Первое, что бросается в глаза: ${images[0]}. Затем становится заметно другое: ${images[1]}.`,
      `Если задержаться на образе дольше, появляется ещё одна мысль — ${images[2]}. Это не похоже на портрет героя; скорее на сон о нём, где характер читается через свет, расстояние и движение.`,
      `В итоге нейровзгляд оставляет не прямую подсказку, а настроение: этот персонаж меняет атмосферу вокруг себя ещё до того, как становится понятно, кто именно перед тобой.`
    ];
    return redact(paragraphs.join(' '),heroName);
  }

  function voiceSlug(name){
    if(name==='Anti-Mage')return 'antimage';
    return name.toLowerCase().replace(/[’']/g,'').replace(/-/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
  }
  function containsHeroName(text,heroName){
    const n=norm(text); return aliases(heroName).some(a=>{const x=norm(a); return x.length>=3&&n.includes(x);});
  }
  async function loadVoice(heroName){
    if(voiceCache.has(heroName))return voiceCache.get(heroName);
    const slug=voiceSlug(heroName);
    const arr=await fetchJson(`https://raw.githubusercontent.com/mdiller/dotabase/master/json/responses/${encodeURIComponent(slug)}.json`,7500);
    const seen=new Set();
    const pool=(Array.isArray(arr)?arr:[]).filter(x=>{
      const t=String(x?.text||'').trim(), mp3=String(x?.mp3||'').trim(), wc=words(t).length, key=norm(t);
      if(!mp3||!t||wc<3||wc>12||t.length<9||t.length>110||seen.has(key)||containsHeroName(t,heroName))return false;
      if(/^(yes|no|aye|right|good|fine|hmm|mm|ah|oh)[.!? ]*$/i.test(t))return false;
      seen.add(key); return true;
    });
    if(!pool.length)throw new Error('voice_candidates_empty');
    const filtered=pool.filter(x=>!/Loadout/i.test(String(x.pretty_criteria||''))) || pool;
    const pick=filtered[Math.floor(Math.random()*filtered.length)]||pool[0];
    const path=String(pick.mp3).startsWith('/')?String(pick.mp3):'/'+String(pick.mp3);
    const built={
      urls:[`https://dotabase.dillerm.io/dota-vpk${path}`,`https://php.dotabase.dillerm.io/dota-vpk${path}`],
      path
    };
    voiceCache.set(heroName,built); return built;
  }

  function renderLoading(mode){
    const label=mode==='lore'?'Загружаю историю героя…':mode==='ai'?'Формирую нейровзгляд…':'Загружаю настоящую реплику героя…';
    $('clues').innerHTML=`<div class="specialCard loadingCard"><div class="specialLead">${label}</div></div>`;
    $('levelBadge').textContent='Подготовка режима'; $('guess').disabled=true; $('guessBtn').disabled=true;
  }
  function renderSpecial(){
    if(!spMode||!round)return BASE_RENDER_CLUES();
    const m=META[spMode], box=$('clues'); box.innerHTML='';
    $('score').textContent=String(m.score); $('levelBadge').textContent=m.badge; $('nextClue').textContent='Свободный режим'; $('nextClue').disabled=true;
    if(spMode==='voice'){
      const card=document.createElement('article'); card.className='specialCard voicePlayer';
      const sources=(round.voiceUrls||[]).map(u=>`<source src="${esc(u)}" type="audio/mpeg">`).join('');
      card.innerHTML=`<div class="specialLead">Слушай реплику и угадывай героя только по голосу.</div>
        <div class="voiceControls"><button class="voicePlayBtn" type="button"><span class="voiceBtnIcon">▶</span><span class="voiceBtnText">Слушать голос</span></button>
        <div class="voiceWave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div>
        <audio preload="auto">${sources}</audio>`;
      box.appendChild(card);
      const audio=card.querySelector('audio'), btn=card.querySelector('.voicePlayBtn'); spAudio=audio;
      const state=playing=>{card.classList.toggle('playing',playing);btn.querySelector('.voiceBtnText').textContent=playing?'Пауза':'Слушать голос';btn.querySelector('.voiceBtnIcon').textContent=playing?'❚❚':'▶';};
      btn.onclick=async()=>{try{if(audio.paused){await audio.play();state(true);}else{audio.pause();state(false);}}catch{setFeedback('Не удалось загрузить реплику. Нажми «Новый раунд» — будет выбран другой аудиофрагмент.','bad');}};
      audio.onplay=()=>state(true); audio.onpause=()=>state(false); audio.onended=()=>state(false);
      audio.onerror=()=>setFeedback('Аудиофайл этой реплики недоступен. Нажми «Новый раунд».','bad');
    }else{
      const card=document.createElement('article'); card.className=`specialCard ${spMode==='ai'?'diaryCard':'archiveCard'}`;
      card.innerHTML=`<div class="specialLead">${spMode==='ai'?'Дневник наблюдений':'История героя'}</div><div class="storyBody">${esc(round.clues[0]||'')}</div>`; box.appendChild(card);
    }
  }
  function spStopAudio(){ try{if(spAudio){spAudio.pause();spAudio.currentTime=0;}}catch{} spAudio=null; }

  function pickHero(){ const pool=HEROES.filter(h=>h.name!==lastHero); return pool[Math.floor(Math.random()*pool.length)]; }
  async function buildRound(mode,hero){
    if(mode==='lore'){const x=await loadLore(hero.name);return{clues:[x.text]};}
    if(mode==='ai')return{clues:[aiVision(hero.name)]};
    const v=await loadVoice(hero.name);return{clues:[''],voiceUrls:v.urls};
  }
  async function startSpecial(mode,restored=null){
    if(spLoading)return; spLoading=true; spMode=mode; clearAnswer(); challengeMode=false; dailyMode=false; dailySelectedDay=null; $('challengeHud')?.classList.add('hiddenAuth');
    setTheme(mode); BASE_SHOW_PAGE('game'); renderLoading(mode);
    try{
      let hero,built;
      if(restored){ hero=heroByName(restored.hero); built={clues:restored.clues||[''],voiceUrls:restored.voiceUrls||[]}; }
      else{
        let err=null;
        for(let i=0;i<8;i++){hero=pickHero();try{built=await buildRound(mode,hero);err=null;break;}catch(e){err=e;}}
        if(err||!built)throw err||new Error('round_unavailable');
      }
      lastHero=hero.name; revealed=1; finished=false; attemptsAtStage=restored?Math.max(0,Number(restored.attempts)||0):0;
      round={hero:hero.name,letter:'?',word:'',clues:built.clues?.length?built.clues:[''],scores:[META[mode].score],specialMode:mode,voiceUrls:built.voiceUrls||[]};
      $('guess').value=''; setFeedback(''); $('guess').disabled=false; $('guessBtn').disabled=false; renderSpecial(); updateAttempts(); saveSpecial(); $('guess').focus();
    }catch(e){
      $('clues').innerHTML='<div class="specialCard"><div class="specialLead">Не удалось подготовить этот раунд</div><div class="storyBody">Нажми «Новый раунд» — игра попробует другого героя.</div></div>';
      $('guess').disabled=true;$('guessBtn').disabled=true;console.warn('special round error',e);
    }finally{spLoading=false;}
  }
  async function restoreSpecialState(s){
    if(!s||!MODE_SET.has(s.mode))return false;
    if(s.finished){await startSpecial(s.mode);return true;}
    await startSpecial(s.mode,s);return true;
  }

  renderClues=function(){return spMode?renderSpecial():BASE_RENDER_CLUES();};
  saveSoloState=function(){if(spMode){saveSpecial();return;}clearSpecial();return BASE_SAVE_SOLO();};
  maxAttempts=function(){return spMode?6:BASE_MAX_ATTEMPTS();};
  updateAttempts=function(){
    const r=BASE_UPDATE_ATTEMPTS();
    if(spMode&&!finished){const left=Math.max(0,maxAttempts()-attemptsAtStage);$('guess').disabled=false;$('guessBtn').disabled=false;$('guess').placeholder=`Введите имя героя · попыток: ${left}`;const info=$('attemptInfo');if(info)info.textContent=`Попыток в раунде: ${left}/${maxAttempts()}`;}
    if(spMode)saveSpecial(); return r;
  };
  newRound=function(){return spMode?startSpecial(spMode):BASE_NEW_ROUND();};
  showPage=function(page){if(page==='home'){spMode=null;spStopAudio();clearSpecial();resetTheme();}return BASE_SHOW_PAGE(page);};
  if(BASE_RESTORE_NAVIGATION){restoreNavigation=async function(){const s=loadSpecial();if(s)return restoreSpecialState(s);return BASE_RESTORE_NAVIGATION();};}

  document.querySelectorAll('[data-special-mode]').forEach(btn=>btn.addEventListener('click',()=>{clearSpecial();startSpecial(btn.dataset.specialMode);}));
  const startBtn=$('startBtn');if(startBtn)startBtn.onclick=()=>{spMode=null;clearSpecial();resetTheme();BASE_NEW_ROUND();};
  const back=$('backHome');if(back)back.onclick=()=>{if(dailyMode)return openDailyHunt();if(challengeMode)return showPage('friends');spMode=null;spStopAudio();clearSpecial();resetTheme();BASE_SHOW_PAGE('home');};

  patchHomeCards();
  window.addEventListener('load',()=>{const s=loadSpecial();if(s&&!spMode)setTimeout(()=>{if(!spMode)restoreSpecialState(s);},120);});
  setTimeout(()=>{const s=loadSpecial();if(s&&!spMode)restoreSpecialState(s);},700);

  window.__DHH_SPECIAL_QA__={version:'v15',loadSpecial,aiVision,voiceSlug,loreSlug};
})();
