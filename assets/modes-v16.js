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

  const SPECIAL_KEY = 'dhh_special_state_v16';
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
    return {v:16,mode:spMode,hero:round.hero,clues:round.clues,voiceUrls:round.voiceUrls||[],attempts:attemptsAtStage,finished:!!finished};
  }
  function saveSpecial(){ try{ const s=specialState(); if(s)sessionStorage.setItem(SPECIAL_KEY,JSON.stringify(s)); }catch{} }
  function loadSpecial(){ try{ const s=JSON.parse(sessionStorage.getItem(SPECIAL_KEY)||'null'); return s&&s.v===16&&MODE_SET.has(s.mode)&&heroByName(s.hero)?s:null; }catch{return null;} }
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
    return [intro,...chosen].join(' ');
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

  function visionHash(text){
    let h=2166136261>>>0;
    for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
    return h>>>0;
  }
  function pickBySeed(list,seed,step=0){return list[(seed+step*2654435761>>>0)%list.length];}
  const VISION_LINES={
    area:[
      'пространство рядом с фигурой выглядит шире самой фигуры, будто она давит не телом, а присутствием',
      'фон вокруг неё расползается кругами, словно сцена не может сохранить прежнюю форму',
      'в кадре слишком много воздуха и напряжения вокруг одного силуэта — будто он занимает больше места, чем должен'
    ],
    attacks:[
      'в силуэте есть повторяющийся ритм: короткий импульс, пауза, ещё импульс — и так без ощущения покоя',
      'движение читается сериями, словно фигура существует не в одном жесте, а в цепочке быстрых вспышек',
      'линии вокруг героя дрожат от частого движения, как у изображения, которое камера не успевает поймать'
    ],
    control:[
      'композиция слишком упорядочена: остальные формы будто невольно подчиняются одной центральной воле',
      'в образе нет суеты — только неприятное чувство, что всё вокруг уже расставлено по чужому плану',
      'силуэт кажется неподвижным центром, вокруг которого остальные детали теряют самостоятельность'
    ],
    displace:[
      'геометрия вокруг фигуры слегка сломана: привычные направления будто перестают совпадать',
      'края сцены смещены относительно друг друга, словно кто-то передвинул саму картинку',
      'в образе чувствуется странная неправильность положения — будто всё оказалось на полшага не там'
    ],
    economy:[
      'слои изображения будто накапливаются один за другим, делая силуэт всё тяжелее и насыщеннее',
      'каждая новая деталь остаётся в образе, словно фигура ничего не отдаёт обратно пустоте',
      'в композиции есть ощущение накопления: сначала почти ничего, затем всё больше веса, блеска и уверенности'
    ],
    global:[
      'горизонт здесь важнее переднего плана: присутствие фигуры как будто продолжается далеко за границы кадра',
      'силуэт ощущается сразу в нескольких далёких точках, хотя физически перед глазами он один',
      'сцена слишком велика для одного героя — и именно поэтому кажется, что он каким-то образом заполняет её всю'
    ],
    lowhp:[
      'в образе есть хищное ожидание: самая яркая часть композиции будто просыпается только у края чужой слабости',
      'силуэт не спешит; он становится выразительнее именно там, где другая фигура уже начинает гаснуть',
      'цвет вокруг героя заметно обостряется рядом с чем-то уязвимым, словно слабость для него — отдельный источник света'
    ],
    mana:[
      'тело здесь почти вторично: важнее пульсирующее внутреннее свечение, похожее на сжатую энергию',
      'образ будто собран вокруг невидимого запаса света, который можно почувствовать даже без цвета',
      'внутри силуэта есть постоянная пульсация — не сердцебиение, а что-то более холодное и энергетическое'
    ],
    mobility:[
      'контур смазан ровно настолько, чтобы казалось: фигура уже покинула место, где её успел заметить взгляд',
      'в кадре есть ощущение опоздания — ты смотришь туда, где герой был мгновение назад',
      'силуэт словно состоит из нескольких положений сразу, и ни одно не выглядит окончательным'
    ],
    position:[
      'главная деталь образа — пустота вокруг него; кажется, что точка, выбранная фигурой, важнее самой фигуры',
      'композиция держится на расстояниях: один шаг в сторону полностью разрушил бы это ощущение',
      'герой выглядит частью идеально выбранного места, а не случайным объектом, поставленным в кадр'
    ],
    range:[
      'между зрителем и фигурой намеренно оставлено много холодного пространства',
      'образ будто отказывается подпускать камеру ближе: его удобнее чувствовать издалека',
      'силуэт остаётся на дистанции, и эта дистанция сама становится частью его характера'
    ],
    stealth:[
      'часть силуэта растворяется в фоне, а самые важные линии как будто специально не дорисованы',
      'зритель видит не столько героя, сколько след его присутствия в полумраке',
      'образ собран из недосказанности: чем внимательнее смотришь, тем больше замечаешь пустых мест'
    ],
    summons:[
      'за основной фигурой постоянно угадываются вторичные тени, будто она никогда не бывает действительно одна',
      'фон отвечает на присутствие героя несколькими дополнительными силуэтами, похожими на эхо',
      'у образа странно много спутниковых форм — не украшений, а почти самостоятельных присутствий'
    ],
    sustain:[
      'на силуэте будто уже есть трещины, но он всё равно выглядит удивительно устойчивым',
      'образ производит впечатление вещи, которую можно повредить много раз, но трудно заставить исчезнуть',
      'в фигуре чувствуется упрямая целостность: она не выглядит хрупкой даже там, где должна была бы'
    ],
    target:[
      'вся композиция незаметно сходится к одной точке, а остальной фон становится почти неважным',
      'в образе есть туннельное внимание: будто весь мир на мгновение сводится к одному выбранному месту',
      'линии взгляда и света собираются в одном направлении, оставляя остальную сцену без значения'
    ],
    tempo:[
      'в кадре есть собственный метроном: окружение кажется вынужденным жить в ритме этой фигуры',
      'образ задаёт скорость всей сцене — даже неподвижные детали выглядят так, будто подстраиваются под него',
      'чувствуется внутренний ритм, который постепенно захватывает весь фон'
    ],
    terrain:[
      'камни, деревья и проходы выглядят не фоном, а продолжением характера фигуры',
      'окружение слишком тесно связано с героем, чтобы считать его простой декорацией',
      'ландшафт в этом образе будто участвует в портрете наравне с самим силуэтом'
    ],
    timing:[
      'вся сцена похожа на кадр, замерший за долю секунды до чего-то важного',
      'образ держится на одном точном мгновении: раньше он был бы пустым, позже — уже совсем другим',
      'напряжение возникает не от движения, а от чувства идеально выбранного момента'
    ],
    transform:[
      'контур не выглядит окончательным: одна форма просвечивает сквозь другую',
      'силуэт кажется временным состоянием, которое вот-вот сменится чем-то иным',
      'в образе нет устойчивой формы — только переход между несколькими возможными обликами'
    ]
  };
  function aiVision(heroName){
    const hero=heroByName(heroName), r=roundByHero(heroName), seed=visionHash(heroName);
    const tags=unique(((r?.variantTags||[])[0]||[]).filter(t=>!String(t).startsWith('sig:'))).slice(0,4);
    const chosen=tags.map((tag,i)=>pickBySeed(VISION_LINES[tag]||VISION_LINES.timing,seed,i));
    const openings=[
      'Если закрыть название и оставить только впечатление, я представляю не персонажа, а сцену.',
      'В голове появляется не лицо, а короткий кинематографичный кадр.',
      'Этот герой у меня складывается не из деталей костюма, а из света, расстояния и движения.',
      'Я бы не рисовал его буквально. Скорее оставил бы несколько визуальных ощущений.',
      'Первым приходит не портрет, а атмосфера — будто герой существует раньше собственного изображения.',
      'Если превратить героя в образ, он начинается с настроения, а уже потом становится силуэтом.'
    ];
    const transitions=[
      'В центре кадра', 'Чуть дальше', 'На втором плане', 'Если смотреть дольше', 'Самая странная деталь', 'После первого впечатления'
    ];
    const closings=[
      'Получается образ, который узнаётся не по предметам или словам, а по собственной пластике.',
      'В нём нет прямой подсказки — только характер сцены, из которого постепенно проступает личность.',
      'Такой портрет я бы оставил без подписи: вся идея в том, чтобы узнать героя по настроению.',
      'Это скорее сон о герое, чем его иллюстрация: конкретика исчезает, а характер остаётся.',
      'Фигура остаётся без имени, но у сцены появляется очень определённый почерк.'
    ];
    const sentences=[pickBySeed(openings,seed)];
    chosen.forEach((line,i)=>sentences.push(`${pickBySeed(transitions,seed,i)} ${line}.`));
    sentences.push(pickBySeed(closings,seed,7));
    return redact(sentences.join(' '),heroName);
  }

  function voiceSlug(name){
    if(name==='Anti-Mage')return 'antimage';
    return name.toLowerCase().replace(/[’']/g,'').replace(/-/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
  }
  function containsHeroName(text,heroName){
    const n=norm(text); return aliases(heroName).some(a=>{const x=norm(a); return x.length>=3&&n.includes(x);});
  }
  function goodVoiceText(text,heroName){
    const t=String(text||'').trim(),wc=words(t).length;
    if(!t||wc<3||wc>13||t.length<8||t.length>120||containsHeroName(t,heroName))return false;
    return !/^(yes|no|aye|right|good|fine|hmm|mm|ah|oh|thanks|thank you)[.!? ]*$/i.test(t);
  }
  function normalizeLegacyVoiceUrl(url){
    const u=String(url||'').trim();
    if(!u)return '';
    return u.replace(/^http:\/\//i,'https://');
  }
  function wikiFallback(url){
    const m=String(url||'').match(/dota2\.gamepedia\.com\/([0-9a-f]\/[^/]+\/[^?#]+\.mp3)/i);
    return m?`https://static.wikia.nocookie.net/dota2_gamepedia/images/${m[1]}`:'';
  }
  async function loadLegacyVoice(heroName){
    if(LORE_MISSING.has(heroName))return null;
    const slug=loreSlug(heroName);
    const groups=await fetchJson(`https://raw.githubusercontent.com/mrprona92/SecretBrand/master/app/src/main/assets/heroes/${encodeURIComponent(slug)}/responses.json`,6500);
    const pool=[];
    for(const group of Array.isArray(groups)?groups:[]){
      for(const item of Array.isArray(group?.responses)?group.responses:[]){
        const title=String(item?.title||'').trim(),url=normalizeLegacyVoiceUrl(item?.url);
        if(!url||!goodVoiceText(title,heroName))continue;
        if(/Unused Responses|Removed responses/i.test(String(group?.name||'')))continue;
        pool.push({title,url});
      }
    }
    if(!pool.length)return null;
    const pick=pool[Math.floor(Math.random()*pool.length)];
    const wf=wikiFallback(pick.url);
    return {urls:unique([pick.url,wf]),path:'legacy'};
  }
  async function loadCurrentVoice(heroName){
    const slug=voiceSlug(heroName);
    const arr=await fetchJson(`https://raw.githubusercontent.com/mdiller/dotabase/master/json/responses/${encodeURIComponent(slug)}.json`,7500);
    const seen=new Set();
    const pool=(Array.isArray(arr)?arr:[]).filter(x=>{
      const t=String(x?.text||'').trim(),mp3=String(x?.mp3||'').trim(),key=norm(t);
      if(!mp3||!goodVoiceText(t,heroName)||seen.has(key))return false;
      seen.add(key); return !/Loadout/i.test(String(x.pretty_criteria||''));
    });
    if(!pool.length)return null;
    const pick=pool[Math.floor(Math.random()*pool.length)];
    const path=String(pick.mp3).startsWith('/')?String(pick.mp3):'/'+String(pick.mp3);
    const clean=path.replace(/^\/+/, '');
    return {urls:[
      `https://php.dotabase.dillerm.io/dota-vpk/${clean}`,
      `https://dotabase.dillerm.io/dota-vpk/${clean}`,
      `https://php.dotabase.dillerm.io/dota-vpk/?file=${encodeURIComponent(clean)}`
    ],path};
  }
  async function loadVoice(heroName){
    if(voiceCache.has(heroName))return voiceCache.get(heroName);
    let built=null;
    try{built=await loadLegacyVoice(heroName);}catch{}
    if(!built){try{built=await loadCurrentVoice(heroName);}catch{}}
    if(!built||!built.urls?.length)throw new Error('voice_candidates_empty');
    voiceCache.set(heroName,built);return built;
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
      card.innerHTML=`<div class="specialLead">Слушай реплику и угадывай героя только по голосу.</div>
        <div class="voiceControls"><button class="voicePlayBtn" type="button"><span class="voiceBtnIcon">▶</span><span class="voiceBtnText">Слушать голос</span></button>
        <div class="voiceWave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div>
        <audio preload="metadata"></audio>`;
      box.appendChild(card);
      const audio=card.querySelector('audio'),btn=card.querySelector('.voicePlayBtn'),urls=unique(round.voiceUrls||[]); spAudio=audio;
      let sourceIndex=0,sourceReady=false;
      const state=playing=>{card.classList.toggle('playing',playing);btn.querySelector('.voiceBtnText').textContent=playing?'Пауза':'Слушать голос';btn.querySelector('.voiceBtnIcon').textContent=playing?'❚❚':'▶';};
      const useSource=index=>{if(index>=urls.length){sourceReady=false;setFeedback('Эта реплика сейчас не загрузилась. Нажми «Новый раунд», чтобы взять другой фрагмент.','bad');return false;}sourceIndex=index;sourceReady=true;audio.src=urls[index];audio.load();return true;};
      if(!useSource(0))btn.disabled=true;
      btn.onclick=async()=>{if(!sourceReady)return;try{if(audio.paused){await audio.play();state(true);}else{audio.pause();state(false);}}catch{if(useSource(sourceIndex+1)){try{await audio.play();state(true);}catch{}}}};
      audio.onplay=()=>{setFeedback('');state(true);}; audio.onpause=()=>state(false); audio.onended=()=>state(false);
      audio.onerror=()=>{state(false);useSource(sourceIndex+1);};
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

  window.__DHH_SPECIAL_QA__={version:'v16',loadSpecial,aiVision,voiceSlug,loreSlug};
})();
