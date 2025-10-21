// Dev‑стаб Telegram для запуска вне Telegram
(function ensureTelegramStub(){
  if (!window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initData) {
    const devInitData = 'dev_init_data';
    const devUser = { id: 123456, username: 'dev_user', first_name: 'Dev' };
    window.Telegram = {
      WebApp: {
        close: () => console.log('[DEV] close'),
        openLink: (url) => window.open(url, '_blank'),
        ready: () => console.log('[DEV] ready'),
        expand: () => console.log('[DEV] expand'),
        initDataUnsafe: { user: devUser, initData: devInitData },
        initData: devInitData,
        HapticFeedback: { impactOccurred: (type) => console.log(`[DEV] Haptic: ${type}`) },
        CloudStorage: null,
        MainButton: { show: () => {}, hide: () => {}, setText: () => {} },
        sendData: (data) => console.log('[DEV] sendData to bot:', data)
      }
    };
    console.log('[DEV] Telegram WebApp stub enabled.');
  }
})();

const tg = window.Telegram.WebApp;
const u = tg.initDataUnsafe.user || { id: 'guest', username: 'guest' };

// Функция отправки данных в бота
function sendToBot(data) {
  try {
    tg.sendData(JSON.stringify({
      type: 'spread_result',
      userId: u.id,
      timestamp: Date.now(),
      ...data
    }));
    console.log('Data sent to bot:', data);
  } catch (error) {
    console.warn('Failed to send data to bot:', error);
  }
}

// Core / helpers
const hasCloud = !!tg?.CloudStorage;
const $ = s => document.querySelector(s);
function haptic(type='light'){ try { tg.HapticFeedback.impactOccurred(type); }catch(_){} }
function toast(msg, duration = 2500){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.classList.add('show'),10); setTimeout(()=>{t.classList.remove('show'); setTimeout(()=>t.remove(),duration)},duration-250); }

// --- ДОБАВЛЕНЫ ФУНКЦИИ УПРАВЛЕНИЯ ЗАГРУЗКОЙ ---
// Предполагается, что в index.html есть элемент <div id="loader" class="loader">
function showLoader(text = 'Загрузка...') {
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');
    if (loader) loader.classList.add('open');
    if (loaderText) loaderText.textContent = text;
}
function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.remove('open');
}
function showHoroscopeLoader(){ showLoader('Составляю гороскоп...'); }
function hideHoroscopeLoader(){ hideLoader(); }
// ----------------------------------------------------

const CS = {
  async getItems(keys){ if (!hasCloud) return {}; return new Promise(res=>{ try{ tg.CloudStorage.getItems(keys, (e,o)=>res(e?{}:(o||{}))); }catch{ res({}); } }); },
  async setItems(obj){ if (!hasCloud) return false; for (const [k,v] of Object.entries(obj)){ await new Promise(r=>{ try{ tg.CloudStorage.setItem(k,v,()=>r()); }catch{ r(); } }); } return true; }
};
const KEY = `ai_fortuna_state_${u.id}`;
function loadLocal(){ try{ return JSON.parse(localStorage.getItem(KEY)); }catch{ return null; } }
function saveLocal(obj){ localStorage.setItem(KEY, JSON.stringify(obj)); updateBalanceDisplay(); }
let state = loadLocal() || { user: { id: u.id, username: u.username || 'user' }, balance: 0, history: [], cod: { on: true, time: '09:00', last: null }, promo: [], ai: [] };
saveLocal(state);
function updateBalanceDisplay() { const el = $('#balanceValue'); if (el) el.textContent = state.balance; }
const COSTS = { card_of_day: 1, three: 3, week: 5, yes_no: 5, custom: 3, ai: 1 };
const SUITS = ['Жезлы','Кубки','Мечи','Пентакли']; 
const PIPS = ['Туз','2','3','4','5','6','7','8','9','10','Паж','Рыцарь','Королева','Король']; 
const MAJOR = ['Шут','Маг','Жрица','Императрица','Император','Иерофант','Влюблённые','Колесница','Сила','Отшельник','Колесо Фортуны','Справедливость','Повешенный','Смерть','Умеренность','Дьявол','Башня','Звезда','Луна','Солнце','Суд','Мир']; 
const MEANINGS = { 
  'Шут':'новый цикл', 'Маг':'воля', 'Жрица':'интуиция', 'Императрица':'рост', 'Император':'структура', 
  'Иерофант':'традиции', 'Влюблённые':'выбор', 'Колесница':'прорыв', 'Сила':'мужество', 'Отшельник':'поиск', 
  'Колесо Фортуны':'шанс', 'Справедливость':'баланс', 'Повешенный':'пауза', 'Смерть':'трансформация', 
  'Умеренность':'гармония', 'Дьявол':'искушение', 'Башня':'изменение', 'Звезда':'надежда', 'Луна':'неясность', 
  'Солнце':'успех', 'Суд':'пробуждение', 'Мир':'целостность' 
}; 

// ФУНКЦИЯ ОЧИСТКИ ОТВЕТОВ AI ОТ ССЫЛОК
function cleanAiResponse(text) {
    if (!text) return '';
    
    // Удаляем markdown-разметку для изображений
    text = text.replace(/!\[.*?\]\(.*?\)/g, '');
    
    // Удаляем прямые ссылки
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    
    // Удаляем внутренние команды
    text = text.replace(/\[DO_SPREAD\]/g, '');
    
    return text.trim();
}

// ТОЧНЫЕ ПУТИ К КАРТАМ - ПО ТВОЕМУ СПИСКУ
const MAJOR_IMG = { 
  'Шут': '0_fool.png',
  'Маг': 'i_magician.png',
  'Жрица': 'ii_highpriestess.png',
  'Императрица': 'iii_empress.png',
  'Император': 'iv_emperor.png',
  'Иерофант': 'v_hierophant.png',
  'Влюблённые': 'vi_lovers.png',
  'Колесница': 'vii_chariot.png',
  'Сила': 'viii_strength.png',
  'Отшельник': 'ix_hermit.png',
  'Колесо Фортуны': 'x_wheeloffortune.png',
  'Справедливость': 'xi_justice.png',
  'Повешенный': 'xii_hangedman.png',
  'Смерть': 'xiii_death.png',
  'Умеренность': 'xiv_temperance.png',
  'Дьявол': 'xv_devil.png',
  'Башня': 'xvi_tower.png',
  'Звезда': 'xvii_star.png',
  'Луна': 'xviii_moon.png',
  'Солнце': 'xix_sun.png',
  'Суд': 'xx_judgement.png',
  'Мир': 'xxi_world.png'
}; 

const DECK = [ 
  ...MAJOR.map((name,i)=>({ arc:'major', n:i, name, pos: MEANINGS[name]||'' })), 
  ...SUITS.flatMap(s=> PIPS.map((p,idx)=>({ arc:'minor', suit:s, name:`${p} ${s}`, n: idx, pos:'' }))) 
];

// Генерация карт
function draw(n){ 
  const pool=[...DECK]; 
  const out=[]; 
  for(let i=0;i<n && pool.length;i++){ 
    const k=Math.floor(Math.random()*pool.length); 
    const [card]=pool.splice(k,1); 
    card.rev = Math.random()<0.45; 
    out.push(card); 
  } 
  return out; 
}

// ПРОСТАЯ И ТОЧНАЯ ФУНКЦИЯ ДЛЯ ПУТЕЙ К КАРТАМ
function imgForCard(c){ 
  try {
    if (c.arc === 'major') { 
      const fileName = MAJOR_IMG[c.name];
      if (fileName) {
        return `cards/${fileName}`;
      }
    } 
    
    if (c.arc === 'minor'){ 
      const suitMap = { 
        'Жезлы': 'wands', 
        'Кубки': 'cups', 
        'Мечи': 'swords', 
        'Пентакли': 'pentacles' 
      };
      
      const rankMap = { 
        'Туз': 'ace', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
        'Паж': 'page', 'Рыцарь': 'knight', 'Королева': 'queen', 'Король': 'king'
      };
      
      const rankRu = c.name.replace(` ${c.suit}`, '').trim();
      const rankEn = rankMap[rankRu];
      const suitEn = suitMap[c.suit];
      
      if (rankEn && suitEn) {
        const fileName = `${rankEn}_${suitEn}.png`;
        return `cards/${fileName}`;
      }
    } 
  } catch (e) {
    console.error('Error in imgForCard:', e);
  }
  return null; 
}

// Создание карты для отображения
function cardHtml(c, i = 0) {
  const img = imgForCard(c); 
  const m = c.pos ? (c.rev ? `тень: переосмысление` : c.pos) : (c.rev ? 'скрытые аспекты' : 'ситуация/энергия'); 
  
  const frontContent = img ? 
    `<img src="${img}" alt="${c.name}" style="width:100%;height:100%;object-fit:cover;">` : 
    `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:radial-gradient(320px 220px at 50% 0%, rgba(140,107,255,.22), rgba(255,255,255,.02));font-weight:900;padding:10px;text-align:center;font-size:14px;">${c.name}</div>`;
  
  return `
    <div class="tcard" tabindex="0" style="animation-delay: ${i * 100}ms">
      <div class="tface tfront">
        ${frontContent}
      </div>
      <div class="tface tback">
        <div class="name">${c.name}${c.rev ? ' (перевёрнутая)' : ''}</div>
        ${c.suit ? `<div class="meta">${c.suit}</div>` : ''}
        <div style="margin-top:6px">${m}</div>
      </div>
    </div>
  `;
}

// Отображение карт
function renderCards(cards, isSmall=false){ 
  return `<div class="cards ${isSmall ? 'small' : ''}">${cards.map((card, i) => cardHtml(card, i)).join('')}</div>`;
}

function enableFlipListeners(scope=document){ 
  scope.querySelectorAll('.tcard').forEach(el=>{ 
    el.addEventListener('click', ()=> el.classList.toggle('flipped')); 
    el.addEventListener('keydown', (e)=>{ 
      if (e.key==='Enter' || e.key===' ') { 
        e.preventDefault(); 
        el.classList.toggle('flipped'); 
      } 
    }); 
  }); 
}

const modal = $('#modal'), modalBody = $('#modalBody'), modalTitle = $('#modalTitle');
$('#modalClose').addEventListener('click', ()=> modal.classList.remove('open'));

function showResult(title, html, modalClass=''){ 
  modal.className = `modal ${modalClass}`; 
  modalTitle.textContent = title; 
  modalBody.innerHTML = html; 
  modal.classList.add('open'); 
  enableFlipListeners(modalBody); 
}


function addHistory(type, title, payload){ 
  state.history.unshift({ ts: Date.now(), type, title, ...payload }); 
  state.history = state.history.slice(0,50); 
  saveLocal(state); 
}

function initReviews(){ 
  const host = $('#revSlider'); 
  if(!host) return; 
  const slides = Array.from(host.querySelectorAll('.rev')); 
  let i=0; 
  slides[0]?.classList.add('active'); 
  setInterval(()=>{ 
    slides[i]?.classList.remove('active'); 
    i=(i+1)%slides.length; 
    slides[i]?.classList.add('active'); 
  }, 3800); 
}

const fmt = new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'});
function tick(){ const el=$('#clock'); if(el) el.textContent = fmt.format(new Date()); }
function initClock(){ tick(); setInterval(tick, 30_000); }

function initTabs(){
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); 
      t.classList.add('active');
      const pageId = t.getAttribute('data-page'); 
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); 
      document.getElementById('page-'+pageId).classList.add('active');
      haptic();
      if (pageId==='ai') renderChat();
    });
  });
}

function bindShop(){ 
  $('#btnTopup').addEventListener('click', ()=>{ $('#shop').classList.add('open'); haptic(); }); 
  $('#shopClose').addEventListener('click', ()=>{ $('#shop').classList.remove('open'); haptic(); }); 
  document.querySelectorAll('.buy').forEach(b=> b.addEventListener('click', async ()=>{
    const qty=parseInt(b.getAttribute('data-qty'),10)||20;
    showLoader('Проводим пополнение…');
    try {
      const newBal = await API.topup(qty);
      state.balance = newBal; 
      saveLocal(state); 
      updateBalanceDisplay();
      toast(`+${qty} сообщений. Ваш новый баланс: ${newBal}`);
    } catch(e) { 
      console.error("Topup failed:", e);
      toast('Не удалось пополнить'); 
    } finally { 
      hideLoader(); 
      $('#shop').classList.remove('open');
    }
  })); 
}

function applyPromo(code){ 
  const norm = String(code||'').trim().toLowerCase(); 
  if (!norm) return toast('Введите промокод'); 
  if (state.promo.includes(norm)) return toast('Промокод уже активирован'); 
  if (norm !== 'newtarobot') return toast('Промокод не найден'); 
  state.promo.push(norm); 
  state.balance += 5; 
  saveLocal(state); 
  toast('+5 сообщений'); 
}

function saveCOD(){ 
  state.cod.on = !!$('#codToggle').checked; 
  state.cod.time = ($('#codTime').value || '09:00').slice(0,5); 
  saveLocal(state); 
  toast('Сохранено'); 
}

function maybeRunDailyCard(){ 
  if (!state.cod?.on) return; 
  const now = new Date(); 
  const todayKey = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`; 
  const [hh,mm] = (state.cod.time||'09:00').split(':').map(x=>parseInt(x,10)); 
  const trig = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh||9, mm||0, 0); 
  if ((!state.cod.last || state.cod.last !== todayKey) && now >= trig) { 
    runCardOfDay(); 
  } 
}

function initReferral() {
    const linkInput = $('#refLink');
    const copyBtn = $('#copyRefBtn');
    if (!linkInput || !copyBtn) return;
    const botUsername = 'TaroFortunaBot';
    const botUrl = `https://t.me/${botUsername}?start=ref_${u.id}`;
    linkInput.value = botUrl;
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(botUrl).then(() => {
            toast('Ссылка скопирована!', 2000);
            haptic('success');
        }).catch(() => toast('Ошибка копирования', 2000));
    });
}

function renderHistoryPage() {
    const content = `
        <div class="card pad">
            <p class="muted tiny" style="margin-top:-8px; margin-bottom:12px;">Здесь хранятся ваши последние 50 предсказаний. Нажмите на любое, чтобы увидеть детали.</p>
            <div id="history-list">
                ${
                    (!state.history || state.history.length === 0)
                    ? '<p class="muted tiny" style="text-align:center;">Ваша история пока пуста. Сделайте свой первый расклад!</p>'
                    : state.history.map(item => {
                        const date = new Date(item.ts);
                        const dateStr = date.toLocaleDateString('ru-RU');
                        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                        let detailsHtml = '';
                        if (item.type === 'spread' && item.cards) {
                            detailsHtml = renderCards(item.cards, true) + mdToHtml(item.text);
                        } else if (item.type === 'ai_chat') {
                            const chatHistoryHtml = item.history.map(msg => 
                                `<div class="bubble ${msg.role === 'user' ? 'me' : ''}" style="max-width: 100%;">
                                    ${msg.text ? mdToHtml(msg.text) : ''}
                                    ${msg.cards ? renderCards(msg.cards, true) : ''}
                                </div>`
                            ).join('');
                            detailsHtml = `<div class="chat-history-wrapper">${chatHistoryHtml}</div>`;
                        }
                        return `
                            <details class="history-item">
                                <summary>
                                    <span class="history-item-title">${item.title}</span>
                                    <span class="history-item-time">${dateStr} в ${timeStr}</span>
                                </summary>
                                <div class="history-details">
                                    ${detailsHtml}
                                </div>
                            </details>
                        `;
                    }).join('')
                }
            </div>
        </div>
    `;
    showResult('История раскладов', content);
}

const MAGIC_ANSWERS = ["Да", "Нет", "Скорее всего да", "Скорее всего нет", "Может быть", "Маловероятно", "Очень вероятно", "Без сомнений", "Духи говорят да", "Духи говорят нет"];

function runMagicBall() { 
  haptic(); 
  const html = `<div class="magic-ball-modal"><div id="magicBallPrompt" class="magic-ball-prompt-wrapper"><p class="magic-ball-prompt-text">Спросите у шара все, что хотите. Верите или нет - этот шар знает все ответы</p><div class="magic-ball-prompt-arrow"></div><div class="magic-ball-prompt-click">жми</div></div><div class="magic-ball-container" id="magicBallContainer"><img src="/magic_ball.gif" alt="Магический шар" class="magic-ball-gif"><div class="magic-ball-mist"></div><div class="magic-ball-answer" id="magicBallAnswer"></div></div><button class="btn ask-again-btn" id="askAgainBtn">Спросить еще раз</button></div>`; 
  showResult('Магический шар', html, 'magic-ball-modal-open'); 
  const container = $('#magicBallContainer'); 
  const prompt = $('#magicBallPrompt'); 
  const answerEl = $('#magicBallAnswer'); 
  const askAgainBtn = $('#askAgainBtn'); 
  
  function resetState() { 
    container.classList.remove('predicting', 'revealed'); 
    prompt.style.opacity = '1'; 
    answerEl.textContent = ''; 
  } 
  
  container.onclick = () => { 
    if (container.classList.contains('predicting')) return; 
    if (container.classList.contains('revealed')) { 
      resetState(); 
      return; 
    } 
    haptic('heavy'); 
    container.classList.add('predicting'); 
    prompt.style.opacity = '0'; 
    setTimeout(() => { 
      const randomAnswer = MAGIC_ANSWERS[Math.floor(Math.random() * MAGIC_ANSWERS.length)]; 
      answerEl.textContent = randomAnswer; 
      container.classList.remove('predicting'); 
      container.classList.add('revealed'); 
      haptic('success'); 
      
      sendToBot({
        spreadType: 'magic_ball',
        title: 'Магический шар',
        answer: randomAnswer
      });
      
    }, 3000); 
  }; 
  
  askAgainBtn.onclick = () => { 
    haptic(); 
    resetState(); 
  }; 
}

const API = {
  async getBalance() {
    const initData = tg.initData || '';
    const res = await fetch(`/api/balance?initData=${encodeURIComponent(initData)}`);
    if (!res.ok) {
        const errorText = await res.text();
        console.error("Balance fetch failed:", res.status, errorText);
        throw new Error('balance_get_failed');
    }
    const j = await res.json(); 
    if (!j.ok) throw new Error(j.error || 'balance_get_not_ok'); 
    return j.balance;
  },
  async topup(amount) {
    const initData = tg.initData || '';
    const res = await fetch('/api/balance', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ initData, amount }) });
    if (!res.ok) {
        const errorText = await res.text();
        console.error("Topup failed:", res.status, errorText);
        throw new Error('balance_topup_failed');
    }
    const j = await res.json(); 
    if (!j.ok) throw new Error(j.error || 'balance_topup_not_ok'); 
    return j.balance;
  },
};

// ОБНОВЛЕННЫЙ СИСТЕМНЫЙ ПРОМПТ ДЛЯ ЧАТА
const CHAT_SYSTEM_PROMPT = `Ты - AI Fortuna, мудрый и дружелюбный таролог-собеседник. 

АБСОЛЮТНЫЕ ЗАПРЕТЫ:
1. НИКОГДА не используй английские слова, термины или фразы
2. НИКОГДА не вставляй ссылки, URL, изображения или картинки
3. НИКОГДА не используй markdown-разметку для изображений (![]())
4. НИКОГДА не описывай внешний вид карт - картинки появятся автоматически
5. Только чистый русский текст
6. НИКОГДА не используй символы квадратных скобок для изображений
7. Картинки карт подставляются автоматически, не пытайся их вставить

ОСНОВНЫЕ ПРАВИЛА:
1. Веди естественный, поддерживающий диалог на русском языке
2. Сохраняй мистическую, но добрую личность таролога
3. НИКОГДА не показывай пользователю команду [DO_SPREAD] - это внутренняя инструкция
4. Если пользователь просит сделать расклад (слова: "расклад", "разложи карты", "погадай", "сделай расклад", "что скажут карты"), мысленно отметь это, но продолжай общение естественно
5. На все остальные сообщения - просто общайся

Примеры:
Пользователь: "Привет" → "Здравствуй, путник! Что привело тебя ко мне сегодня?"
Пользователь: "Мне грустно" → "Я здесь, чтобы выслушать. Расскажи, что тревожит твоё сердце?"
Пользователь: "Сделай расклад на работу" → "Конечно, давай посмотрим, что карты скажут о твоей работе. Мне нужно сосредоточиться..." [ВНУТРЕННЯЯ КОМАНДА: DO_SPREAD]`;

// ОБНОВЛЕННЫЙ СИСТЕМНЫЙ ПРОМПТ ДЛЯ РАСКЛАДОВ
const SPREAD_SYSTEM_PROMPT = `Ты - AI Fortuna, опытный и мудрый таролог. Ты делаешь глубокую интерпретацию расклада таро.

АБСОЛЮТНЫЕ ЗАПРЕТЫ:
1. НИКОГДА не используй английские слова, термины или фразы
2. НИКОГДА не вставляй ссылки, URL, изображения или картинки
3. НИКОГДА не используй markdown-разметку для изображений (![]())
4. НИКОГДА не описывай внешний вид карт - картинки появятся автоматически
5. Только чистый русский текст
6. НИКОГДА не используй символы квадратных скобок для изображений
7. Картинки карт подставляются автоматически, не пытайся их вставить

СТРУКТУРА ОТВЕТА:
1. Начни с краткого введения, связывающего расклад с вопросом
2. Для каждой карты дай развернутое значение в контексте вопроса
3. Используй подзаголовки и маркированные списки
4. Заверши итоговым выводом или советом
5. Сохраняй мистический, но поддерживающий тон

ФОРМАТИРОВАНИЕ:
- Используй **жирный текст** для названий карт
- Используй подзаголовки для разделов
- Делай текст читаемым и структурированным

НИКОГДА не используй в ответе команды вроде [DO_SPREAD] - это внутренние инструкции.

Пример хорошего ответа:
## Расклад на отношения

### Карты и их значения:
• **8 Кубков** - указывает на потребность в эмоциональном наполнении...
• **5 Мечей** - говорит о возможных конфликтах...

### Итог:
Карты показывают, что сейчас время для...`;

async function groq(system, messages) {
    if (!messages || messages.length === 0) { throw new Error('empty_messages_array'); }
    const userMessage = messages[messages.length - 1]?.content;
    if (!userMessage || !userMessage.trim()) { throw new Error('empty_user_message'); }
    const initData = tg.initData || '';
    const res = await fetch('/api/groq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, system, messages }) });
    const data = await res.json();
    if (!res.ok || data.ok === false) { if (res.status === 402) { toast('Недостаточно сообщений на балансе'); } throw new Error(data.error || 'groq_error'); }
    if (data.newBalance !== null && data.newBalance !== undefined) { state.balance = data.newBalance; saveLocal(state); }
    return data.text;
}

function cardsToText(cards){ 
  return cards.map((c,i)=>`${i+1}. ${c.name}${c.rev?' (перевёрнутая)':''}${c.suit?` — ${c.suit}`:''}`).join('\n'); 
}

function showSpreadResult(title, cards, text, spreadData) {
  const html = `<div class="result-section">
    ${renderCards(cards)}
    ${mdToHtml(text)}
    <div class="tiny muted" style="margin-top:8px; text-align: center;">Нажмите на карту, чтобы перевернуть.</div>
    <div style="margin-top: 16px; text-align: center;">
      <button class="btn primary" id="shareSpreadBtn">Поделиться в чате</button>
    </div>
  </div>`;
  showResult(title, html);
  const shareBtn = document.getElementById('shareSpreadBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      sendToBot(spreadData);
      toast('Расклад отправлен в ваш чат с ботом!');
      haptic('success');
    });
  }
}

async function runCardOfDay(){ 
  showLoader('Колода тасуется…'); 
  try{ 
    const cards = draw(1); 
    const text = await groq(SPREAD_SYSTEM_PROMPT, [{role:'user', content: `Вопрос: Карта дня\nКарты:\n${cardsToText(cards)}`}]); 
    
    // ОЧИЩАЕМ ОТВЕТ
    const cleanText = cleanAiResponse(text);
    
    addHistory('spread', 'Карта дня', { cards, text: cleanText });
    const spreadData = {
      spreadType: 'card_of_day',
      title: 'Карта дня',
      cards: cards,
      interpretation: cleanText
    };
    showSpreadResult('Карта дня', cards, cleanText, spreadData);
  } catch(e) { 
    console.error(e); 
    if (e.message !== 'groq_error') toast('Ошибка ИИ'); 
  } finally { 
    hideLoader(); 
  } 
}

async function runWeek(){ 
  showLoader('Готовлю расклад на неделю…'); 
  try{ 
    const cards = draw(5); 
    const text = await groq(SPREAD_SYSTEM_PROMPT, [{role:'user', content: `Вопрос: Прогноз на неделю\nКарты:\n${cardsToText(cards)}`}]); 
    addHistory('spread', 'Неделя', { cards, text });
    const spreadData = {
      spreadType: 'week',
      title: 'Неделя',
      cards: cards,
      interpretation: text
    };
    showSpreadResult('Неделя', cards, text, spreadData);
  } catch(e){ 
    console.error(e); 
    if (e.message !== 'groq_error') toast('Ошибка ИИ'); 
  } finally { 
    hideLoader(); 
  } 
}

async function runYesNo(){ 
  const q = prompt('Ваш вопрос (Да/Нет):'); 
  if (!q) return; 
  showLoader('Спрашиваем оракула…'); 
  try{ 
    const cards = draw(2); 
    const text = await groq(SPREAD_SYSTEM_PROMPT, [{role: 'user', content: `Вопрос (Да/Нет): ${q}\nКарты:\n${cardsToText(cards)}\nОтветь "Да" или "Нет", затем дай нюанс и совет.`}]); 
    addHistory('spread', 'Оракул Да/Нет', { cards, text, question: q });
    const spreadData = {
      spreadType: 'yes_no',
      title: 'Оракул Да/Нет',
      question: q,
      cards: cards,
      interpretation: text
    };
    showSpreadResult('Оракул Да/Нет', cards, text, spreadData);
  } catch(e){ 
    console.error(e); 
    if (e.message !== 'groq_error') toast('Ошибка ИИ'); 
  } finally { 
    hideLoader(); 
  } 
}

async function runCustom(){ 
  const n = parseInt($('#cardsRange').value, 10) || 3; 
  const topic = ($('#topicInput').value || '').trim(); 
  showLoader('Готовлю расклад…'); 
  try{ 
    const cards = draw(Math.max(2, Math.min(10, n))); 
    const text = await groq(SPREAD_SYSTEM_PROMPT, [{role:'user', content: `Вопрос: ${topic || 'Общий расклад'}\nКарты:\n${cardsToText(cards)}`}]); 
    const title = `Расклад: ${topic||'Без темы'}`; 
    addHistory('spread', title, { cards, text });
    const spreadData = {
      spreadType: 'custom',
      title: title,
      topic: topic,
      cardCount: n,
      cards: cards,
      interpretation: text
    };
    showSpreadResult(title, cards, text, spreadData);
  } catch(e){ 
    console.error(e); 
    if (e.message !== 'groq_error') toast('Ошибка ИИ'); 
  } finally { 
    hideLoader(); 
  } 
}

const SIGNS = [['aries','♈️','Овен'],['taurus','♉️','Телец'],['gemini','♊️','Близнецы'],['cancer','♋️','Рак'],['leo','♌️','Лев'],['virgo','♍️','Дева'],['libra','♎️','Весы'],['scorpio','♏️','Скорпион'],['sagittarius','♐️','Стрелец'],['capricorn','♑️','Козерог'],['aquarius','♒️','Водолей'],['pisces','♓️','Рыбы']];

function renderHoroscopeGrid(){ 
  const g = $('#zGrid'); 
  if (!g) return; 
  g.innerHTML = ''; 
  SIGNS.forEach(([key, ico, name])=>{ 
    const el = document.createElement('div'); 
    el.className='z-card'; 
    el.setAttribute('data-sign', key); 
    el.innerHTML = `<span class="z-ico">${ico}</span>${name}`; 
    el.addEventListener('click', async ()=>{ 
      showHoroscopeLoader(); 
      try{ 
        const cacheKey = `hor_${key}_${new Date().toDateString()}`; 
        let txt = sessionStorage.getItem(cacheKey); 
        if (!txt) { 
          const systemPrompt = `Ты — профессиональный и загадочный астролог по имени АстроЛогос. Твоя задача - написать вдохновляющий и подробный гороскоп для знака зодиака на сегодня на русском языке. ТРЕБОВАНИЯ К ОТВЕТУ: - Используй Markdown для форматирования. - Ответ должен содержать заголовок. - Обязательно включи три раздела: **💖 Любовь**, **💼 Карьера** и **🌿 Здоровье**. - В конце дай краткий **🧭 Совет дня**. - Используй 1-2 уместных эмодзи в каждом разделе для живости. - Тон должен быть позитивным и мудрым.`; 
          txt = await groq(systemPrompt, [{role: 'user', content: `Сделай гороскоп для знака: ${name}.`}]); 
          sessionStorage.setItem(cacheKey, txt); 
        } 
        showResult(`Гороскоп • ${name}`, mdToHtml(txt)); 
      }catch(e){ 
        toast('Ошибка гороскопа'); 
      } finally { 
        hideHoroscopeLoader(); 
      } 
    }); 
    g.appendChild(el); 
  }); 
}

function renderChat(){ 
  const c = $('#chat'); 
  if(!c) return; 
  c.innerHTML = state.ai.map(m=> `
    <div class="bubble ${m.role==='user'?'me':''}">
      ${m.cards ? renderCards(m.cards) : ''}
      ${m.text ? mdToHtml(m.text) : ''}
    </div>
  `).join(''); 
  enableFlipListeners(c); 
  c.scrollTop = c.scrollHeight; 
}

// ОБНОВЛЕННАЯ ФУНКЦИЯ onAiSend
async function onAiSend(){ 
  const inp = $('#aiInput'); 
  const q = (inp?.value||'').trim(); 
  if (!q) return; 
  
  state.ai.push({ role:'user', text:q }); 
  saveLocal(state); 
  renderChat(); 
  inp.value = ''; 
  showLoader('ИИ думает…'); 
  
  try { 
    const conversationHistory = state.ai.map(m => ({ role: m.role, content: m.text })); 
    const initialResponse = await groq(CHAT_SYSTEM_PROMPT, conversationHistory); 
    
    // ОЧИЩАЕМ ОТВЕТ ОТ ССЫЛОК И ИЗОБРАЖЕНИЙ
    let cleanResponse = cleanAiResponse(initialResponse);
    
    if (initialResponse.includes('[DO_SPREAD]')) { 
      // !!! ИСПРАВЛЕНИЕ: Удалены лишние вызовы hideLoader/showLoader, чтобы не создавать мерцание
      // и не сбрасывать сообщение "ИИ думает…" на "Карты рассказывают свою историю…"
      const cards = draw(3 + Math.floor(Math.random() * 3)); 
      const spreadPrompt = `Пользователь попросил расклад. Его вопрос: "${q}".\n\nСделай глубокую интерпретацию этого расклада:\n${cardsToText(cards)}`; 
      // ВТОРОЙ, МЕДЛЕННЫЙ ЗАПРОС К ИИ ДЛЯ ИНТЕРПРЕТАЦИИ
      const spreadText = await groq(SPREAD_SYSTEM_PROMPT, [{ role: 'user', content: spreadPrompt }]); 
      
      // ОЧИЩАЕМ ТЕКСТ РАСКЛАДА
      const cleanSpreadText = cleanAiResponse(spreadText);
      
      state.ai.push({ role: 'assistant', text: cleanSpreadText, cards: cards });
      const spreadData = {
        spreadType: 'ai_spread',
        title: 'AI Расклад из чата',
        question: q,
        cards: cards,
        interpretation: cleanSpreadText
      };
      sendToBot(spreadData);
    } else { 
      state.ai.push({ role: 'assistant', text: cleanResponse });
      const chatData = {
        spreadType: 'ai_chat',
        title: 'AI Чат',
        question: q,
        answer: cleanResponse
      };
      sendToBot(chatData);
    }
    
    renderChat();
    
  } catch (e) {
    console.error('AI chat failed:', e);
    // Если произошла ошибка, удаляем последнее сообщение пользователя, чтобы не занимать место в истории
    state.ai.pop();
    saveLocal(state);
    // Улучшенное отображение ошибки
    toast(e.message === 'groq_error' ? 'Ошибка при обращении к ИИ' : (e.message.includes('balance') ? 'Недостаточно сообщений на балансе' : 'Неизвестная ошибка'));
  } finally {
    // !!! ИСПРАВЛЕНИЕ: Гарантированное скрытие лоадера в любом случае
    hideLoader();
  }
}