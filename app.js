/* Business Quest - フロントエンド（GitHub Pages 静的配信）
 * 問題・正解・解説はログイン後に GAS から受け取る（本リポジトリには含めない）
 */
(() => {
'use strict';

// ---------- 定数 ----------
const MOCK = new URLSearchParams(location.search).has('mock');
const AREAS = {
  acc: { name: '会計の洞窟', sub: '財務諸表・経営指標・管理会計', color: '#ffd23f' },
  fin: { name: '財務の港', sub: '投資評価・資本コスト・企業価値', color: '#5fd0ff' },
  str: { name: '戦略の城', sub: 'フレームワーク・競争戦略・ケース', color: '#ff7b6b' },
  mkt: { name: 'マーケの街', sub: 'STP・4P・顧客・ケース', color: '#5fc98a' },
  mix: { name: '大陸横断クエスト', sub: '4分野からランダム出題', color: '#ffffff' },
  ct:  { name: '試練の塔', sub: 'クリティカル・シンキング（論理・推論・データ解釈）', color: '#b06bff' }
};
const MODES = { q10: { n: 10, label: 'クエスト' }, q20: { n: 20, label: 'ロングクエスト' }, rev: { n: 10, label: 'リベンジ' } };
const PTS = { 1: 100, 2: 150, 3: 200 };
const L = 'ABCD';

// ---------- 状態 ----------
const S = { token: null, name: '', emp: '', bank: null, me: null, area: null, adminToken: null, adm: null, admTab: 'results' };
let Q = null; // 進行中のクエスト

// ---------- 小道具 ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
}
function loading(on) { $('loading').classList.toggle('show', !!on); }

// ---------- 効果音（WebAudio） ----------
let sndOn = true, actx = null;
try { sndOn = localStorage.getItem('bq_snd') !== 'off'; } catch (e) {}
function beep(seq) {
  if (!sndOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    let t = actx.currentTime;
    seq.forEach(([f, d, type]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d); t += d * 0.9;
    });
  } catch (e) {}
}
const SFX = {
  ok: () => beep([[784, .09], [1047, .09], [1319, .16]]),
  ng: () => beep([[196, .18, 'sawtooth'], [147, .25, 'sawtooth']]),
  sel: () => beep([[660, .05]]),
  fan: () => beep([[523, .12], [659, .12], [784, .12], [1047, .3]]),
  door: () => beep([[220, .1], [330, .1], [440, .1], [880, .25]])
};
function renderSnd() { $('sndBtn').textContent = sndOn ? '♪ ON' : '♪ OFF'; }
$('sndBtn').onclick = () => { sndOn = !sndOn; try { localStorage.setItem('bq_snd', sndOn ? 'on' : 'off'); } catch (e) {} renderSnd(); };
renderSnd();

// ---------- ドット絵アイコン ----------
const ICONS = {
  acc: ['..yyyy..', '.yYYYYy.', 'yYyyyyYy', 'yYyYYyYy', 'yYyYYyYy', 'yYyyyyYy', '.yYYYYy.', '..yyyy..'],
  fin: ['...w....', '...ww...', '...www..', '...w....', 'bbbbbbbb', '.bBBBBb.', '..bbbb..', 'cccccccc'],
  str: ['r.r..r.r', 'rrr..rrr', '.rRRRRr.', '.rRwwRr.', '.rRwwRr.', '.rRRRRr.', '.rRRRRr.', 'rrrrrrrr'],
  mkt: ['g.......', 'gGGGG...', 'gGGGG...', 'g.......', 'g..hhhh.', 'g.hHHHHh', 'g.hHwwHh', 'g.hHwwHh'],
  mix: ['..wwww..', '.wbbgbw.', 'wbggbbbw', 'wbgbbggw', 'wbbbgbgw', 'wggbbbbw', '.wbbggw.', '..wwww..'],
  ct:  ['...pp...', '..pPPp..', '..pPPp..', '.pPwwPp.', '.pPwwPp.', '.pPPPPp.', 'pPPPPPPp', 'pppppppp']
};
const PAL = { y: '#b37b00', Y: '#ffd23f', w: '#ffffff', b: '#2b6cb0', B: '#5fd0ff', c: '#1b3d7a', r: '#7a1f15', R: '#ff7b6b', g: '#1f6f4a', G: '#5fc98a', h: '#6b3d12', H: '#d68b3a', p: '#4b1d8f', P: '#b06bff' };
function icon(k) {
  const m = ICONS[k] || ICONS.mix; let r = '';
  m.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL[ch]}"/>`; }));
  return `<svg class="icon" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}

// ---------- API ----------
async function api(action, payload) {
  if (MOCK) return window.Mock.call(action, payload || {});
  const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action }, payload || {})), redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ---------- ログイン ----------
$('showPin').onchange = (e) => { $('empInput').type = e.target.checked ? 'text' : 'password'; };
$('empInput').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8); });
$('empInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('loginBtn').onclick = doLogin;
async function doLogin() {
  const id = $('empInput').value.trim().toUpperCase();
  const msg = $('loginMsg');
  if (!/^[A-Z0-9]{8}$/.test(id)) { msg.className = 'msg err'; msg.textContent = '職番は英数字8桁で入力してください'; return; }
  msg.textContent = ''; loading(true);
  try {
    const r = await api('login', { empId: id });
    if (!r.ok) {
      msg.className = 'msg err';
      msg.textContent = r.err === 'locked' ? '試行回数が多すぎます。しばらく待ってから再度お試しください' : 'この職番ではログインできません（未登録または無効）';
      SFX.ng(); return;
    }
    S.token = r.token; S.name = r.name || ''; S.emp = id; S.bank = r.bank; S.me = r.me;
    $('empInput').value = '';
    SFX.door(); renderHub(); show('hubScreen');
  } catch (e) {
    msg.className = 'msg err'; msg.textContent = '通信エラーが発生しました。時間をおいて再度お試しください';
  } finally { loading(false); }
}
$('logoutBtn').onclick = () => { Object.assign(S, { token: null, name: '', emp: '', bank: null, me: null, area: null }); Q = null; show('loginScreen'); };

// ---------- ハブ ----------
function levelInfo() {
  const total = Object.values(S.me?.byCat || {}).reduce((s, c) => s + Number(c.correct || 0), 0);
  const lv = Math.floor(Math.sqrt(total / 3)) + 1;
  const lo = 3 * (lv - 1) ** 2, hi = 3 * lv ** 2;
  return { total, lv, prog: (total - lo) / (hi - lo), need: hi - total };
}
function areaStat(k) {
  const pool = S.bank.questions.filter((q) => (k === 'mix' ? q.c !== 'ct' : q.c === k));
  if (k === 'mix') {
    const cs = ['acc', 'fin', 'str', 'mkt'].map((c) => S.me.byCat[c]).filter(Boolean);
    const n = cs.reduce((s, c) => s + c.n, 0), ok = cs.reduce((s, c) => s + c.correct, 0);
    const mixc = S.me.byCat.mix;
    return { total: pool.length, txt: (mixc ? `挑戦 ${mixc.plays}回・ベスト ${mixc.best}点` : '未挑戦') + (n ? `｜4分野 通算正答率 ${pct(ok, n)}%` : '') };
  }
  const c = S.me.byCat[k];
  return { total: pool.length, txt: c ? `挑戦 ${c.plays}回・正答率 ${pct(c.correct, c.n)}%・ベスト ${c.best}点` : '未挑戦' };
}
function areaBtn(k) {
  const a = AREAS[k], st = areaStat(k);
  return `<button type="button" class="area ${k === 'mix' ? 'mix' : ''} ${S.area === k ? 'sel' : ''}" data-area="${k}">
    ${icon(k)}<div><div class="nm" style="color:${a.color}">${esc(a.name)}</div><div class="sub">${esc(a.sub)}｜全${st.total}問</div>
    <div class="st">${esc(st.txt)}</div></div></button>`;
}
function renderHub() {
  const li = levelInfo();
  $('hubName').textContent = (S.name ? S.name + ' さん' : 'ぼうけんしゃ') + '（職番 ****' + S.emp.slice(-4) + '）';
  $('hubLv').textContent = 'Lv.' + li.lv;
  $('hubExp').style.width = Math.round(li.prog * 100) + '%';
  $('hubExpTxt').textContent = `通算正答 ${li.total}問／次のLvまで あと${li.need}問`;
  $('areasBiz').innerHTML = ['acc', 'fin', 'str', 'mkt', 'mix'].map(areaBtn).join('');
  $('areasCT').innerHTML = areaBtn('ct');
  document.querySelectorAll('[data-area]').forEach((b) => (b.onclick = () => selectArea(b.dataset.area)));
  if (S.area) selectArea(S.area, true); else $('modePanel').style.display = 'none';
}
function revPool(k) {
  const w = new Set(S.me.wrong || []);
  return S.bank.questions.filter((q) => w.has(q.id) && (k === 'mix' ? q.c !== 'ct' : q.c === k));
}
function selectArea(k, silent) {
  S.area = k; if (!silent) SFX.sel();
  document.querySelectorAll('[data-area]').forEach((b) => b.classList.toggle('sel', b.dataset.area === k));
  const p = $('modePanel'); p.style.display = ''; p.classList.toggle('ct', k === 'ct');
  $('modeTitle').textContent = AREAS[k].name + '：クエストを えらぶ';
  const rp = revPool(k);
  $('revBtn').disabled = rp.length === 0;
  $('revTxt').textContent = rp.length ? `前回まちがえた問題 ${rp.length}問から出題` : '誤答した問題はまだありません';
  if (!silent) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => startQuest(S.area, b.dataset.mode)));
$('toRecords').onclick = renderRecords;

// ---------- クエスト ----------
function pickQuestions(k, mode) {
  let pool = mode === 'rev' ? revPool(k) : S.bank.questions.filter((q) => (k === 'mix' ? q.c !== 'ct' : q.c === k));
  const n = Math.min(MODES[mode].n, pool.length);
  pool = shuffle(pool);
  let sel = pool.slice(0, n);
  // 同じケース（資料）の問題は連続させる
  const firstIdx = {};
  sel.forEach((q, i) => { const key = q.p || ('_' + i); if (!(key in firstIdx)) firstIdx[key] = i; });
  sel = sel.map((q, i) => ({ q, k: firstIdx[q.p || ('_' + i)], i })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.q);
  return sel;
}
function startQuest(k, mode) {
  if (!k) return;
  const qs = pickQuestions(k, mode);
  if (!qs.length) return;
  Q = { area: k, mode, items: qs.map((q) => ({ q, perm: shuffle([0, 1, 2, 3]), sel: null, ok: null, sec: 0, pts: 0 })),
        i: 0, score: 0, combo: 0, maxCombo: 0, startedAt: new Date().toISOString(), t0: 0, answered: false, saved: false };
  $('qArea').textContent = AREAS[k].name + '・' + MODES[mode].label;
  $('qArea').style.color = AREAS[k].color;
  $('qTotal').textContent = Q.items.length;
  $('quitBtn').textContent = 'にげる';
  show('quizScreen'); renderQ();
}
function renderPassage(key) {
  const txt = S.bank.passages[key] || '';
  const lines = txt.split('\n'); let html = '', tbl = [];
  const flush = () => { if (tbl.length) { html += '<table>' + tbl.map((r) => '<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</table>'; tbl = []; } };
  lines.forEach((ln) => {
    if (/^\|.*\|$/.test(ln.trim())) tbl.push(ln.trim().slice(1, -1).split('|'));
    else { flush(); if (ln.trim()) html += `<p>${esc(ln)}</p>`; }
  });
  flush(); return html;
}
function renderQ() {
  const it = Q.items[Q.i], q = it.q;
  Q.answered = false; Q.t0 = Date.now();
  $('qNo').textContent = Q.i + 1;
  $('qBar').style.width = (Q.i / Q.items.length) * 100 + '%';
  $('qScore').textContent = Q.score;
  $('qCombo').textContent = Q.combo >= 2 ? `${Q.combo} COMBO!` : '';
  const hasP = !!q.p;
  $('qGrid').classList.toggle('withP', hasP);
  $('pWin').style.display = hasP ? '' : 'none';
  if (hasP) $('pText').innerHTML = renderPassage(q.p);
  $('qTags').innerHTML = `<span class="qtag" style="background:${AREAS[q.c].color}">${esc(S.bank.cats[q.c])}</span><span class="qtag lv">${esc(q.t)}</span><span class="qtag lv">${'★'.repeat(q.lv)}${'☆'.repeat(3 - q.lv)}</span>`;
  $('qText').textContent = q.q;
  $('qChoices').innerHTML = it.perm.map((o, i) => `<button type="button" class="choice" data-i="${i}"><span class="k">${L[i]}.</span><span>${esc(q.ch[o])}</span></button>`).join('');
  document.querySelectorAll('#qChoices .choice').forEach((b) => (b.onclick = () => answer(Number(b.dataset.i))));
  $('qExplain').classList.remove('show');
  $('qWin').scrollIntoView({ block: 'start' });
}
function remapExplain(e, perm) {
  return esc(e).replace(/〔([A-D])〕/g, (m, x) => '(' + L[perm.indexOf(L.indexOf(x))] + ')');
}
function answer(i) {
  if (Q.answered) return;
  Q.answered = true;
  const it = Q.items[Q.i], q = it.q;
  it.sel = it.perm[i]; it.ok = it.sel === q.a; it.sec = Math.round((Date.now() - Q.t0) / 1000);
  if (it.ok) {
    Q.combo++; Q.maxCombo = Math.max(Q.maxCombo, Q.combo);
    const mult = 1 + Math.min(Math.max(Q.combo - 1, 0), 5) * 0.1;
    it.pts = Math.round(PTS[q.lv] * mult); Q.score += it.pts;
  } else { Q.combo = 0; it.pts = 0; }
  const ci = it.perm.indexOf(q.a);
  document.querySelectorAll('#qChoices .choice').forEach((b, j) => {
    b.disabled = true;
    if (j === ci) { b.classList.add('correct'); b.insertAdjacentHTML('beforeend', '<span class="mk" style="color:var(--ok)">◯</span>'); }
    else if (j === i) { b.classList.add('wrong'); b.insertAdjacentHTML('beforeend', '<span class="mk" style="color:var(--ng)">✕</span>'); }
  });
  judge(it.ok);
  $('exRes').className = 'res ' + (it.ok ? 'ok' : 'ng');
  $('exRes').innerHTML = (it.ok ? 'せいかい！' : 'ざんねん…') + (it.ok ? `<span class="pts">+${it.pts} pt${Q.combo >= 2 ? '（' + Q.combo + 'コンボ）' : ''}</span>` : '');
  $('exAns').textContent = `正解：${L[ci]}. ${q.ch[q.a]}`;
  $('exBody').innerHTML = remapExplain(q.e, it.perm);
  $('qExplain').classList.add('show');
  $('qScore').textContent = Q.score;
  $('qCombo').textContent = Q.combo >= 2 ? `${Q.combo} COMBO!` : '';
  $('nextBtn').textContent = Q.i + 1 < Q.items.length ? 'つぎへ ▶' : 'けっかを みる ▶';
  setTimeout(() => $('qExplain').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 450);
}
function judge(ok) {
  const j = $('judge'), s = $('judgeSym');
  s.className = 'sym ' + (ok ? 'ok' : 'ng'); s.textContent = ok ? '◯' : '✕';
  j.classList.add('show'); (ok ? SFX.ok : SFX.ng)();
  setTimeout(() => j.classList.remove('show'), 650);
}
$('nextBtn').onclick = next;
function next() {
  if (!Q || !Q.answered) return;
  if (Q.i + 1 < Q.items.length) { Q.i++; renderQ(); } else finish();
}
let quitArmed = null;
$('quitBtn').onclick = () => {
  if (quitArmed) { clearTimeout(quitArmed); quitArmed = null; Q = null; renderHub(); show('hubScreen'); return; }
  $('quitBtn').textContent = '本当に にげる？（記録されません）';
  quitArmed = setTimeout(() => { quitArmed = null; $('quitBtn').textContent = 'にげる'; }, 3000);
};

// ---------- 結果 ----------
function rankOf(r) {
  if (r >= 90) return ['S', '伝説の賢者', 'この分野は免許皆伝。後進を導く立場へ'];
  if (r >= 80) return ['A', '王国の勇者', '実務で使える水準。ケースでの応用力を磨こう'];
  if (r >= 65) return ['B', '歴戦の戦士', '基礎は固い。誤答の論点をふりかえろう'];
  if (r >= 50) return ['C', '見習い剣士', '伸びしろ大。解説を読んでリベンジしよう'];
  return ['D', '旅立ちの村人', 'まずは基本用語から。リベンジモードで再挑戦'];
}
async function finish() {
  const n = Q.items.length, ok = Q.items.filter((x) => x.ok).length, rate = pct(ok, n);
  const [rk, title, sub] = rankOf(rate);
  const prevBest = (S.me.byCat[Q.area] || {}).best || 0;
  $('rRank').textContent = rk; $('rTitle').innerHTML = esc(title) + (Q.score > prevBest ? '<span class="newbest">NEW BEST</span>' : '');
  $('rSub').textContent = `${AREAS[Q.area].name}・${MODES[Q.mode].label}｜${sub}`;
  $('rRate').textContent = rate + '%'; $('rCorrect').textContent = `${ok}/${n}`; $('rScore').textContent = Q.score; $('rCombo').textContent = Q.maxCombo;
  // 分野別
  const tp = {};
  Q.items.forEach((x) => { const k = S.bank.cats[x.q.c] + '｜' + x.q.t; tp[k] = tp[k] || [0, 0]; tp[k][0]++; if (x.ok) tp[k][1]++; });
  $('rTopics').innerHTML = '<tr><th>分野｜論点</th><th>正答</th><th style="width:40%">正答率</th></tr>' + Object.entries(tp).sort((a, b) => a[1][1] / a[1][0] - b[1][1] / b[1][0]).map(([k, v]) =>
    `<tr><td>${esc(k)}</td><td>${v[1]}/${v[0]}</td><td><div class="meter"><i style="width:${pct(v[1], v[0])}%"></i></div></td></tr>`).join('');
  // ふりかえり
  $('rReview').innerHTML = Q.items.map((x, i) => {
    const ci = x.perm.indexOf(x.q.a), si = x.perm.indexOf(x.sel);
    return `<details class="item"${x.ok ? '' : ' open'}><summary><b class="${x.ok ? 'okc' : 'ngc'}">${x.ok ? '◯' : '✕'}</b><span>Q${i + 1}. ${esc(x.q.q.length > 70 ? x.q.q.slice(0, 70) + '…' : x.q.q)}</span></summary>
      <div class="body">${x.q.p ? '<span class="muted">（ケース／資料付き問題）</span><br>' : ''}あなたの回答：${L[si]}. ${esc(x.q.ch[x.sel])}<br>正解：<b style="color:var(--gold)">${L[ci]}. ${esc(x.q.ch[x.q.a])}</b><br>${remapExplain(x.q.e, x.perm)}</div></details>`;
  }).join('');
  show('resultScreen'); SFX.fan();
  await save();
}
async function save() {
  if (!Q || Q.saved) return;
  const m = $('rSave'); m.className = 'msg'; m.textContent = '記録を保存中…';
  try {
    const r = await api('submit', { token: S.token, result: { cat: Q.area, mode: Q.mode, startedAt: Q.startedAt, score: Q.score,
      answers: Q.items.map((x) => ({ id: x.q.id, sel: x.sel, sec: x.sec })) } });
    if (!r.ok) throw new Error(r.err);
    Q.saved = true; S.me = r.me; m.className = 'msg ok'; m.textContent = '記録を保存しました（あなたの職番のみに記録）';
  } catch (e) {
    m.className = 'msg err';
    m.innerHTML = String(e.message) === 'auth' ? 'ログインの有効期限が切れたため保存できませんでした。再ログインしてください' : '保存に失敗しました <button class="btn small" type="button" id="retrySave">再試行</button>';
    const rb = $('retrySave'); if (rb) rb.onclick = save;
  }
}
$('againBtn').onclick = () => startQuest(Q.area, Q.mode === 'rev' && !revPool(Q.area).length ? 'q10' : Q.mode);
$('toHubBtn').onclick = () => { renderHub(); show('hubScreen'); };

// ---------- マイ記録 ----------
async function renderRecords() {
  loading(true);
  try { const r = await api('history', { token: S.token }); if (r.ok) S.me = r.me; } catch (e) {} finally { loading(false); }
  const bc = S.me.byCat || {};
  $('recCats').innerHTML = '<tr><th>エリア</th><th>挑戦回数</th><th>解答数</th><th>正答率</th><th>ベストスコア</th></tr>' +
    ['acc', 'fin', 'str', 'mkt', 'mix', 'ct'].map((k) => { const c = bc[k]; return `<tr><td style="color:${AREAS[k].color}">${esc(AREAS[k].name)}</td><td>${c ? c.plays : 0}</td><td>${c ? c.n : 0}</td><td>${c ? pct(c.correct, c.n) + '%' : '-'}</td><td>${c ? c.best : '-'}</td></tr>`; }).join('');
  const h = S.me.history || [];
  $('recList').innerHTML = '<tr><th>日時</th><th>エリア</th><th>モード</th><th>正答</th><th>正答率</th><th>スコア</th><th>所要</th></tr>' +
    (h.length ? h.map((x) => `<tr><td>${esc(x.at)}</td><td>${esc((AREAS[x.cat] || {}).name || x.cat)}</td><td>${esc((MODES[x.mode] || {}).label || x.mode)}</td><td>${x.correct}/${x.n}</td><td>${x.rate}%</td><td>${x.score}</td><td>${Math.round(x.secs / 60)}分</td></tr>`).join('') : '<tr><td colspan="7" class="muted">まだ記録がありません</td></tr>');
  show('recordsScreen');
}
$('recBack').onclick = () => { renderHub(); show('hubScreen'); };

// ---------- 隠しコマンド（管理者） ----------
let taps = [];
$('logo').addEventListener('click', () => {
  const now = Date.now(); taps = taps.filter((t) => now - t < 3000); taps.push(now);
  $('logo').classList.remove('shake'); void $('logo').offsetWidth; $('logo').classList.add('shake');
  if (taps.length >= 5) { taps = []; openAdmModal(); }
});
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let kbuf = [];
function openAdmModal() { SFX.door(); $('admPw').value = ''; $('admMsg').textContent = ''; $('admModal').classList.add('show'); setTimeout(() => $('admPw').focus(), 50); }
$('admCancel').onclick = () => $('admModal').classList.remove('show');
$('admPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') admLogin(); });
$('admGo').onclick = admLogin;
async function admLogin() {
  const pw = $('admPw').value;
  if (!pw) return;
  loading(true);
  try {
    const r = await api('adminLogin', { pw });
    if (!r.ok) { $('admMsg').className = 'msg err'; $('admMsg').textContent = r.err === 'locked' ? 'ロック中です。しばらく待ってください' : 'パスワードが違います'; SFX.ng(); return; }
    S.adminToken = r.token; $('admModal').classList.remove('show'); await loadAdmin();
  } catch (e) { $('admMsg').className = 'msg err'; $('admMsg').textContent = '通信エラー'; }
  finally { loading(false); }
}
async function loadAdmin() {
  loading(true);
  try {
    const r = await api('adminData', { token: S.adminToken });
    if (!r.ok) { alertAdm('セッションが切れました。もう一度ログインしてください'); return; }
    S.adm = r; $('sheetLink').href = r.sheetUrl || '#';
    const sel = $('admCat'); sel.innerHTML = '<option value="">全カテゴリ</option>' + Object.keys(AREAS).map((k) => `<option value="${k}">${esc(AREAS[k].name)}</option>`).join('');
    renderAdmin(); show('adminScreen');
  } finally { loading(false); }
}
function alertAdm(t) { S.adminToken = null; show('loginScreen'); $('loginMsg').className = 'msg err'; $('loginMsg').textContent = t; }
$('admReload').onclick = loadAdmin;
$('admExit').onclick = () => { S.adminToken = null; S.adm = null; show(S.token ? 'hubScreen' : 'loginScreen'); if (S.token) renderHub(); };
$('admTabs').querySelectorAll('.tab').forEach((b) => (b.onclick = () => { S.admTab = b.dataset.t; $('admTabs').querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b)); renderAdmin(); }));
$('admFilter').addEventListener('input', () => renderAdmin());
$('admCat').addEventListener('change', () => renderAdmin());
let admRows = [];
function renderAdmin() {
  const d = S.adm; if (!d) return;
  const f = $('admFilter').value.trim(), cat = $('admCat').value;
  const nm = {}; d.users.forEach((u) => (nm[u.id] = u.name));
  const catName = (k) => (AREAS[k] || {}).name || k;
  let head = [], rows = [];
  if (S.admTab === 'results') {
    head = ['終了日時', '職番', '氏名', 'エリア', 'モード', '問題数', '正答', '正答率(%)', 'スコア', '所要(秒)', '問題ID'];
    rows = d.results.filter((r) => (!f || r.id.startsWith(f)) && (!cat || r.cat === cat))
      .map((r) => [r.end, r.id, nm[r.id] || '', catName(r.cat), (MODES[r.mode] || {}).label || r.mode, r.n, r.correct, r.rate, r.score, r.secs, r.qids]);
  } else if (S.admTab === 'users') {
    head = ['職番', '氏名', '有効', 'ログイン回数', '最終ログイン', '受験回数', '解答数', '正答率(%)', '会計', '財務', '戦略', 'マーケ', 'CT'];
    const lg = {}; d.logins.forEach((l) => { if (l.res !== 'OK') return; lg[l.id] = lg[l.id] || { n: 0, last: l.at }; lg[l.id].n++; });
    const rs = {}; d.results.forEach((r) => { const x = (rs[r.id] = rs[r.id] || { plays: 0, n: 0, ok: 0, c: {} }); x.plays++; x.n += +r.n; x.ok += +r.correct; });
    // 分野別正答率は回答明細が無いため受験結果のエリア単位で集計（ミックスは除外）
    d.results.forEach((r) => { if (!['acc', 'fin', 'str', 'mkt', 'ct'].includes(r.cat)) return; const c = (rs[r.id].c[r.cat] = rs[r.id].c[r.cat] || [0, 0]); c[0] += +r.n; c[1] += +r.correct; });
    const ids = new Set([...d.users.map((u) => u.id), ...Object.keys(rs)]);
    rows = [...ids].filter((id) => !f || id.startsWith(f)).sort().map((id) => {
      const u = d.users.find((x) => x.id === id) || {}; const x = rs[id] || { plays: 0, n: 0, ok: 0, c: {} }; const l = lg[id] || { n: 0, last: '' };
      const cr = (k) => (x.c[k] ? pct(x.c[k][1], x.c[k][0]) : '');
      return [id, u.name || '', u.active === false ? '無効' : '有効', l.n, l.last, x.plays, x.n, x.n ? pct(x.ok, x.n) : '', cr('acc'), cr('fin'), cr('str'), cr('mkt'), cr('ct')];
    });
  } else if (S.admTab === 'logins') {
    head = ['日時', '職番', '氏名', '結果', '備考'];
    rows = d.logins.filter((l) => !f || l.id.startsWith(f)).map((l) => [l.at, l.id, nm[l.id] || '', l.res, l.note || '']);
  } else {
    head = ['問題ID', 'エリア', '論点', '問題（抜粋）', '原題', '解答数', '正答率(%)'];
    rows = d.qmeta.filter((m) => !cat || m[1] === cat || (cat === 'mix' && m[1] !== 'ct')).map((m) => { const s = d.qstat[m[0]] || { n: 0, ok: 0 }; return [m[0], catName(m[1]), m[2], m[3], m[4] ? '原題' : '', s.n, s.n ? pct(s.ok, s.n) : '']; })
      .sort((a, b) => (a[6] === '' ? 1 : 0) - (b[6] === '' ? 1 : 0) || (a[6] || 0) - (b[6] || 0) || b[5] - a[5]);
  }
  admRows = [head, ...rows];
  $('admCount').textContent = rows.length + '件';
  $('admTable').innerHTML = '<tr>' + head.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr>' +
    rows.slice(0, 1500).map((r) => '<tr>' + r.map((c, i) => `<td${head[i] === '問題ID' && S.admTab === 'results' ? ' style="font-size:11px;max-width:220px;word-break:break-all"' : ''}>${esc(c)}</td>`).join('') + '</tr>').join('');
}
$('admCsv').onclick = () => {
  if (!admRows.length) return;
  const csv = admRows.map((r) => r.map((c) => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = `assessment_${S.admTab}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// ---------- キー操作 ----------
document.addEventListener('keydown', (e) => {
  kbuf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key); kbuf = kbuf.slice(-KONAMI.length);
  if (kbuf.join() === KONAMI.join()) { kbuf = []; openAdmModal(); return; }
  if (!$('quizScreen').classList.contains('active') || $('admModal').classList.contains('show')) return;
  if (!Q) return;
  if (!Q.answered && /^[1-4]$/.test(e.key)) answer(Number(e.key) - 1);
  else if (!Q.answered && /^[a-dA-D]$/.test(e.key)) answer(L.indexOf(e.key.toUpperCase()));
  else if (Q.answered && e.key === 'Enter') { e.preventDefault(); next(); }
});

if (MOCK) document.title += '（MOCK）';
})();
