/* 논산대건고 선택과목 수강신청 — 화면 동작 */
(function () {
  'use strict';

  var C = CURRICULUM;
  var CFG = APP_CONFIG;

  // ─────────────────────────────────────────────────────────────
  //  도우미
  // ─────────────────────────────────────────────────────────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** el('div', {class:'a', text:'글자'}, 자식…) */
  function el(tag, attrs) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else node.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child == null || child === false) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  // 받침에 따라 을/를 고르기
  function eul(word) {
    var code = word.charCodeAt(word.length - 1);
    if (code < 0xac00 || code > 0xd7a3) return '을(를)';
    return (code - 0xac00) % 28 ? '을' : '를';
  }

  var AREA = { kor: '국어', math: '수학', eng: '영어', soc: '사회', sci: '과학', art: '예술', pe: '체육', etc: '교양' };

  // 교육과정을 쓰기 편한 모양으로 정리
  var SEMS = C.semesters.map(function (s, i) {
    var toItem = function (a) { return { n: a[0], g: a[1], c: a[2], t: a[3] }; };
    return {
      id: s.id, label: s.label, index: i,
      short: s.id.replace('t', '').replace('_', '-'),
      fixed: s.fixed.map(toItem),
      groups: s.groups.map(function (g) {
        return { id: g.id, name: g.name, limit: g.limit, list: g.list.map(toItem) };
      })
    };
  });
  var GROUPS = [];
  SEMS.forEach(function (sem) {
    sem.groups.forEach(function (g) { g.sem = sem; GROUPS.push(g); });
  });

  var PRESETS = {
    medical: {
      list: ['화학', '생명과학', '세포와 물질대사', '화학 반응의 세계', '보건', '생물의 유전'],
      note: '의학·보건 계열에서 많이 보는 과목이에요. 2학년에 화학·생명과학을 이수한 뒤 3학년에 심화 과목으로 이어 가는 것을 권장해요.'
    },
    engineering: {
      list: ['물리학', '화학', '역학과 에너지', '인공지능 수학', '프로그래밍', '미적분 II', '기하', '전자기와 양자'],
      note: '이공·IT 계열에서 많이 보는 과목이에요. 미적분 II와 기하는 공과대학에서 특히 권장해요.'
    },
    humanities: {
      list: ['사회와 문화', '정치', '경제', '법과 사회', '심화 영어', '세계사', '언어생활 탐구'],
      note: '인문·사회·상경 계열에서 많이 보는 과목이에요. 경제와 정치는 상경·사회과학 계열에 도움이 돼요.'
    },
    edu: {
      list: ['사회와 문화', '현대사회와 윤리', '인간과 심리', '교육의 이해', '독서 토론과 글쓰기'],
      note: '사범·교육 계열에서 많이 보는 과목이에요. 사람을 이해하고 소통하는 과목이 중심이에요.'
    }
  };

  // ─────────────────────────────────────────────────────────────
  //  상태
  // ─────────────────────────────────────────────────────────────
  var state = {
    token: null,
    student: null,
    status: { open: true, message: '' },
    submitted: null,   // { timestamp, selections } — 서버에 저장된 내용
    sel: {},           // { 그룹ID: [과목명, …] } — 지금 화면에서 고른 내용
    career: '',
    tab: SEMS[0].id,
    preset: null,
    built: false
  };

  function emptySel() {
    var s = {};
    GROUPS.forEach(function (g) { s[g.id] = []; });
    return s;
  }

  /** 서버·저장소에서 온 선택을 교육과정에 있는 과목만 남기고 순서를 맞춰요 */
  function cleanSel(raw) {
    var s = emptySel();
    GROUPS.forEach(function (g) {
      var got = (raw && Array.isArray(raw[g.id])) ? raw[g.id] : [];
      g.list.forEach(function (item) {
        if (got.indexOf(item.n) > -1 && s[g.id].length < g.limit) s[g.id].push(item.n);
      });
    });
    return s;
  }

  function sameSel(a, b) { return JSON.stringify(cleanSel(a)) === JSON.stringify(cleanSel(b)); }

  function isDirty() {
    return !state.submitted || !sameSel(state.sel, state.submitted.selections);
  }

  // 임시 저장 (이 브라우저에만)
  function draftKey() { return 'ss2026:draft:' + state.student.studentId; }
  function saveDraft() {
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
        sel: state.sel, career: state.career,
        base: state.submitted ? state.submitted.timestamp : ''
      }));
    } catch (e) { /* 저장소를 못 써도 동작에는 문제없어요 */ }
  }
  function loadDraft() {
    try { return JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (e) { return null; }
  }

  // ─────────────────────────────────────────────────────────────
  //  선택 규칙
  // ─────────────────────────────────────────────────────────────
  /** 과목명 → 고른 학기 번호(0~5) */
  function pickedAt(sel) {
    var map = {};
    GROUPS.forEach(function (g) {
      sel[g.id].forEach(function (n) { map[n] = g.sem.index; });
    });
    return map;
  }

  /** 이 과목을 지금 고를 수 없는 이유 (고를 수 있으면 '') */
  function blockReason(group, name, at) {
    if (name in at && at[name] !== group.sem.index) {
      return SEMS[at[name]].short + '학기에서 이미 선택했어요';
    }
    var need = C.prerequisites[name];
    if (need && !(need in at && at[need] < group.sem.index)) {
      return '이전 학기에 ' + need + eul(need) + ' 선행 이수해야 해요';
    }
    return '';
  }

  /** 선이수 과목이 빠져서 더는 고를 수 없게 된 과목을 함께 빼요 */
  function dropOrphans() {
    var dropped = [];
    var again = true;
    while (again) {
      again = false;
      var at = pickedAt(state.sel);
      GROUPS.forEach(function (g) {
        state.sel[g.id] = state.sel[g.id].filter(function (n) {
          var need = C.prerequisites[n];
          if (need && !(need in at && at[need] < g.sem.index)) {
            dropped.push(n);
            again = true;
            return false;
          }
          return true;
        });
      });
    }
    return dropped;
  }

  function toggle(group, name) {
    var list = state.sel[group.id];
    var i = list.indexOf(name);
    if (i > -1) {
      list.splice(i, 1);
      var dropped = dropOrphans();
      if (dropped.length) toast(name + ' 선택을 취소해서, ' + name + eul(name) + ' 선행 이수해야 하는 ' + dropped.join(', ') + '도 함께 취소됐어요.');
    } else {
      var why = blockReason(group, name, pickedAt(state.sel));
      if (why) return toast(name + ': ' + why + '.');
      if (list.length >= group.limit) {
        if (group.limit > 1) return toast('이 영역은 ' + group.limit + '과목까지 선택할 수 있어요. 다른 과목의 선택을 먼저 취소해 주세요.');
        list.length = 0;          // 1과목만 고르는 영역은 바로 바꿔 줘요
      }
      list.push(name);
      state.sel[group.id] = group.list.map(function (x) { return x.n; })
        .filter(function (n) { return list.indexOf(n) > -1; });
      dropOrphans();
    }
    saveDraft();
    render();
  }

  function stats(sel) {
    var s = { fixed: 0, select: 0, total: 0, kms: 0, soc: 0, sci: 0, art: 0, pe: 0, lib: 0 };
    var add = function (item) {
      if (item.g === 'kor' || item.g === 'math' || item.g === 'eng') s.kms += item.c;
      else if (item.g === 'etc') s.lib += item.c;
      else s[item.g] += item.c;
    };
    SEMS.forEach(function (sem) {
      sem.fixed.forEach(function (f) { s.fixed += f.c; add(f); });
      sem.groups.forEach(function (g) {
        g.list.forEach(function (item) {
          if (sel[g.id].indexOf(item.n) > -1) { s.select += item.c; add(item); }
        });
      });
    });
    s.total = s.fixed + s.select;
    return s;
  }

  /** 제출 전에 고쳐야 할 것들 */
  function problems(sel) {
    var out = [];
    GROUPS.forEach(function (g) {
      var lack = g.limit - sel[g.id].length;
      if (lack > 0) out.push({ tab: g.sem.id, text: g.sem.label + ' ' + g.name + ': ' + lack + '과목을 더 선택해야 해요.' });
    });
    var s = stats(sel);
    if (s.kms > C.maxKms) out.push({ text: '국어·수학·영어 합계가 ' + s.kms + '학점이에요. ' + C.maxKms + '학점 이하로 줄여야 해요.' });
    if (s.lib < C.minLib) out.push({ text: '교양 합계가 ' + s.lib + '학점이에요. ' + C.minLib + '학점 이상이 되어야 해요.' });
    if (!out.length && s.total !== C.totalCredits) out.push({ text: '총 학점이 ' + s.total + '학점이에요. ' + C.totalCredits + '학점이어야 해요.' });
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  //  서버 통신
  // ─────────────────────────────────────────────────────────────
  function api(action, params) {
    if (!CFG.GAS_URL) return Promise.reject(new Error('서버 주소(GAS_URL)가 아직 설정되지 않았어요.'));
    var q = new URLSearchParams(params || {});
    q.set('action', action);
    if (state.token) q.set('token', state.token);
    q.set('_', String(Date.now()));
    var url = CFG.GAS_URL + '?' + q.toString();
    // 구글 계정 여러 개로 로그인된 브라우저에서도 꼬이지 않게 쿠키 없이 요청해요
    return fetch(url, { credentials: 'omit', redirect: 'follow', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .catch(function () { return jsonp(url); });
  }

  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var name = '_gas_' + Math.random().toString(36).slice(2, 10);
      var script = document.createElement('script');
      var timer = setTimeout(function () { done(); reject(new Error('서버 응답이 너무 늦어요.')); }, 25000);
      function done() {
        clearTimeout(timer);
        delete window[name];
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[name] = function (data) { done(); resolve(data); };
      script.onerror = function () { done(); reject(new Error('서버에 연결하지 못했어요.')); };
      script.crossOrigin = 'anonymous';
      script.src = url + '&cb=' + name;
      document.head.appendChild(script);
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  로그인
  // ─────────────────────────────────────────────────────────────
  function setStatus(node, msg, kind) {
    node.textContent = msg || '';
    node.className = 'status' + (kind ? ' ' + kind : '');
  }

  function initGoogle() {
    $('#login-domain').textContent = '@' + CFG.SCHOOL_DOMAIN + ' 계정만 사용할 수 있어요';
    if (!CFG.GAS_URL) setStatus($('#login-status'), '아직 서버 주소가 설정되지 않았어요. config.js 의 GAS_URL 을 입력해 주세요.', 'error');
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (window.google && google.accounts && google.accounts.id) {
        clearInterval(timer);
        google.accounts.id.initialize({
          client_id: CFG.CLIENT_ID,
          callback: onCredential,
          auto_select: false,
          hd: CFG.SCHOOL_DOMAIN
        });
        var box = $('#g-btn');
        box.textContent = '';
        google.accounts.id.renderButton(box, { type: 'standard', theme: 'outline', size: 'large', width: 280, locale: 'ko' });
      } else if (tries > 100) {
        clearInterval(timer);
        $('#g-btn').textContent = '';
        setStatus($('#login-status'), '구글 로그인 버튼을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.', 'error');
      }
    }, 100);
  }

  function emailOf(token) {
    try {
      var part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return String(JSON.parse(atob(part)).email || '').toLowerCase();
    } catch (e) { return ''; }
  }

  function onCredential(response) {
    var token = response && response.credential;
    var relogin = !!state.student;
    var note = relogin ? $('#relogin-status') : $('#login-status');
    var email = token ? emailOf(token) : '';

    if (!email || email.slice(-(CFG.SCHOOL_DOMAIN.length + 1)) !== '@' + CFG.SCHOOL_DOMAIN) {
      return setStatus(note, '학교 계정(@' + CFG.SCHOOL_DOMAIN + ')으로만 로그인할 수 있어요.', 'error');
    }
    if (relogin) {
      if (email !== state.student.email) return setStatus(note, '처음 로그인한 계정(' + state.student.email + ')으로 다시 로그인해 주세요.', 'error');
      state.token = token;
      $('#relogin').hidden = true;
      return toast('다시 로그인됐어요. 하던 일을 이어서 해 주세요.');
    }

    state.token = token;
    setStatus(note, '학생 정보를 확인하고 있어요…', 'busy');
    api('bootstrap').then(function (res) {
      if (!res.ok) { state.token = null; return setStatus(note, res.message || '학생 정보를 찾지 못했어요.', 'error'); }
      applyBootstrap(res, true);
      setStatus(note, '');
      show('sc-portal');
    }).catch(function (err) {
      state.token = null;
      setStatus(note, '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요. (' + err.message + ')', 'error');
    });
  }

  function applyBootstrap(res, first) {
    state.student = res.student;
    state.status = res.status || { open: true, message: '' };
    state.submitted = (res.submission && res.submission.hasSubmitted)
      ? { timestamp: res.submission.timestamp, selections: cleanSel(res.submission.selections) }
      : null;

    if (first) {
      var base = state.submitted ? state.submitted.timestamp : '';
      var draft = loadDraft();
      // 임시 저장은 "같은 제출본에서 이어서 고치던 것"일 때만 불러와요
      if (draft && draft.base === base) {
        state.sel = cleanSel(draft.sel);
        state.career = String(draft.career || '');
      } else {
        state.sel = state.submitted ? cleanSel(state.submitted.selections) : emptySel();
        state.career = draft ? String(draft.career || '') : '';
      }
      dropOrphans();
    }

    var who = state.student.studentId + ' ' + state.student.name;
    $$('[data-who]').forEach(function (n) { n.textContent = who + ' (' + state.student.email + ')'; });
    $$('[data-who-short]').forEach(function (n) { n.textContent = who; });
    renderStatus();
  }

  function needRelogin() {
    setStatus($('#relogin-status'), '');
    $('#relogin').hidden = false;
    var box = $('#g-btn-2');
    box.textContent = '';
    if (window.google && google.accounts) {
      google.accounts.id.renderButton(box, { type: 'standard', theme: 'outline', size: 'large', width: 280, locale: 'ko' });
    }
  }

  function logout() {
    try { google.accounts.id.disableAutoSelect(); } catch (e) { /* 없어도 괜찮아요 */ }
    location.reload();
  }

  // ─────────────────────────────────────────────────────────────
  //  화면 전환
  // ─────────────────────────────────────────────────────────────
  function show(id) {
    $$('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    window.scrollTo(0, 0);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3800);
  }

  function renderStatus() {
    var st = state.status;
    var box = $('#menu-status');
    box.className = 'notice ' + (st.open ? 'good' : 'warn');
    box.textContent = st.open
      ? '지금 제출할 수 있어요.' + (st.until ? ' (마감: ' + st.until + ')' : '') +
        (state.submitted ? ' 마지막 제출: ' + state.submitted.timestamp : ' 아직 제출하지 않았어요.')
      : st.message + ' 과목을 미리 선택해 보거나 제출한 내용을 확인할 수는 있어요.';
    var badge = $('#portal-badge');
    badge.textContent = st.open ? '제출 받는 중' : '제출 마감';
    badge.className = 'badge ' + (st.open ? 'blue' : 'gray');
  }

  // ─────────────────────────────────────────────────────────────
  //  과목 선택 화면
  // ─────────────────────────────────────────────────────────────
  function buildSelect() {
    if (state.built) return;
    state.built = true;

    $('#d-goal').textContent = C.totalCredits;
    $('#d-kms-rule').textContent = C.maxKms + ' 이하';
    $('#d-lib-rule').textContent = C.minLib + ' 이상';

    var tabs = $('#tabs');
    var panes = $('#panes');

    SEMS.forEach(function (sem) {
      tabs.appendChild(el('button', { type: 'button', class: 'tab', role: 'tab', 'data-tab': sem.id },
        el('span', { text: sem.short }), el('small', {})));

      var pane = el('section', { class: 'pane', id: 'pane-' + sem.id, hidden: true });
      pane.appendChild(el('h2', { text: sem.label }));

      pane.appendChild(el('h3', { text: '학교 지정 과목' }, el('small', { text: ' 모두가 듣는 과목이에요' })));
      var fixed = el('div', { class: 'fixed-list' });
      sem.fixed.forEach(function (f) {
        fixed.appendChild(el('span', { class: 'fixed area-' + f.g }, el('b', { text: f.n }), ' ' + f.c + '학점'));
      });
      pane.appendChild(fixed);

      sem.groups.forEach(function (g) {
        pane.appendChild(el('h3', {},
          g.name + ' ',
          el('small', { text: g.limit + '과목 선택' }),
          el('span', { class: 'count', 'data-count': g.id })));
        var grid = el('div', { class: 'subj-grid' });
        g.list.forEach(function (item) {
          grid.appendChild(el('button', {
            type: 'button', class: 'subj area-' + item.g, 'aria-pressed': 'false',
            'data-group': g.id, 'data-name': item.n
          },
            el('span', { class: 'subj-name', text: item.n }),
            el('span', { class: 'subj-meta', text: AREA[item.g] + ' · ' + item.c + '학점 · ' + item.t }),
            el('span', { class: 'subj-note' })));
        });
        pane.appendChild(grid);
      });

      var prev = SEMS[sem.index - 1];
      var next = SEMS[sem.index + 1];
      pane.appendChild(el('div', { class: 'pane-foot' },
        el('button', { type: 'button', class: 'btn-ghost danger', 'data-reset': sem.id, text: '이 학기 선택 초기화' }),
        el('span', { class: 'grow' }),
        prev ? el('button', { type: 'button', class: 'btn', 'data-tab': prev.id, text: '← ' + prev.short }) : null,
        el('button', { type: 'button', class: 'btn-primary small', 'data-tab': next ? next.id : 'final', text: next ? next.short + ' →' : '확인·제출 →' })));
      panes.appendChild(pane);
    });

    tabs.appendChild(el('button', { type: 'button', class: 'tab final', role: 'tab', 'data-tab': 'final' },
      el('span', { text: '확인·제출' }), el('small', {})));

    $('#career').value = state.career;
  }

  function openTab(id) {
    state.tab = id;
    $$('.tab').forEach(function (t) {
      var on = t.getAttribute('data-tab') === id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.pane').forEach(function (p) { p.hidden = p.id !== 'pane-' + id; });
    window.scrollTo(0, 0);
  }

  function render() {
    if (!state.built) return;
    var sel = state.sel;
    var at = pickedAt(sel);
    var preset = state.preset ? PRESETS[state.preset].list : [];

    // 과목 카드
    $$('.subj').forEach(function (btn) {
      var g = groupById(btn.getAttribute('data-group'));
      var name = btn.getAttribute('data-name');
      var on = sel[g.id].indexOf(name) > -1;
      var why = on ? '' : blockReason(g, name, at);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('blocked', !!why);
      btn.classList.toggle('recommended', preset.indexOf(name) > -1);
      // 안내 문구: 선택할 수 없으면 그 이유를, 선행 과목을 이미 선택했으면 선택 가능하다는 것을 알려 줘요
      var note = $('.subj-note', btn);
      var need = C.prerequisites[name];
      note.textContent = why || (need ? '선행 과목 ' + need + ' 선택 완료' : '');
      note.classList.toggle('ok', !why && !!need);
    });

    // 영역별 개수, 탭 표시
    GROUPS.forEach(function (g) {
      var n = sel[g.id].length;
      var c = $('[data-count="' + g.id + '"]');
      c.textContent = n + ' / ' + g.limit;
      c.classList.toggle('done', n === g.limit);
    });
    SEMS.forEach(function (sem) {
      var need = 0, have = 0;
      sem.groups.forEach(function (g) { need += g.limit; have += sel[g.id].length; });
      var tab = $('.tab[data-tab="' + sem.id + '"]');
      tab.classList.toggle('done', have === need);
      $('small', tab).textContent = have === need ? '완료' : have + '/' + need;
    });

    // 학점 현황
    var s = stats(sel);
    ['fixed', 'select', 'total', 'kms', 'soc', 'sci', 'art', 'pe', 'lib'].forEach(function (k) {
      $('#d-' + k).textContent = s[k];
    });
    $('#d-kms-box').classList.toggle('bad', s.kms > C.maxKms);
    $('#d-lib-box').classList.toggle('bad', s.lib < C.minLib);
    $('.dash-main .total').classList.toggle('ok', s.total === C.totalCredits);

    // 확인·제출 탭
    var probs = problems(sel);
    var finalTab = $('.tab.final');
    finalTab.classList.toggle('done', !probs.length);
    $('small', finalTab).textContent = probs.length ? probs.length + '건 남음' : '준비됨';

    var box = $('#checklist');
    box.textContent = '';
    if (!state.status.open) box.appendChild(el('div', { class: 'notice warn', text: state.status.message + ' 지금은 제출할 수 없어요.' }));
    if (probs.length) {
      var ul = el('ul', {});
      probs.forEach(function (p) {
        ul.appendChild(el('li', {}, p.text + ' ',
          p.tab ? el('button', { type: 'button', class: 'link', 'data-tab': p.tab, text: '선택하러 가기' }) : null));
      });
      box.appendChild(el('div', { class: 'notice warn' }, el('strong', { text: '제출하려면 아래 내용을 채워야 해요.' }), ul));
    } else if (!state.submitted) {
      box.appendChild(el('div', { class: 'notice good', text: '모든 조건을 채웠어요. 아래 내용을 확인하고 제출해 주세요.' }));
    } else if (isDirty()) {
      box.appendChild(el('div', { class: 'notice warn', text: '마지막 제출(' + state.submitted.timestamp + ') 뒤에 바꾼 내용이 있어요. 다시 제출해야 반영돼요.' }));
    } else {
      box.appendChild(el('div', { class: 'notice good', text: '제출이 완료된 상태예요. (' + state.submitted.timestamp + ')' }));
    }

    var report = $('#report');
    report.textContent = '';
    report.appendChild(reportNode(sel, { career: state.career }));

    var btn = $('#btn-submit');
    btn.textContent = state.submitted ? '다시 제출하기' : '제출하기';
    btn.disabled = !state.status.open;
  }

  function groupById(id) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i];
    return null;
  }

  /** 설계서 (화면·인쇄·이미지 공용) */
  function reportNode(sel, opts) {
    var s = stats(sel);
    var head = el('header', { class: 'report-head' },
      el('h2', { text: '2026학년도 입학생 교육과정 선택과목 설계서' }),
      el('p', { class: 'report-who' },
        '학번·이름 ', el('b', { text: state.student.studentId + ' ' + state.student.name }),
        opts.career ? ' · 희망 진로 ' : null, opts.career ? el('b', { text: opts.career }) : null),
      el('p', { class: 'muted', text: '총 ' + s.total + '학점 · 국·수·영 ' + s.kms + '학점 · 교양 ' + s.lib + '학점' +
        (opts.timestamp ? ' · 제출 ' + opts.timestamp : '') }));

    var grid = el('div', { class: 'report-grid' });
    SEMS.forEach(function (sem) {
      var ul = el('ul', {});
      sem.fixed.forEach(function (f) {
        ul.appendChild(el('li', {}, el('span', { text: f.n }), el('small', { text: f.c + '학점 · 지정' })));
      });
      sem.groups.forEach(function (g) {
        g.list.forEach(function (item) {
          if (sel[g.id].indexOf(item.n) > -1) {
            ul.appendChild(el('li', { class: 'picked' }, el('span', { text: item.n }), el('small', { text: item.c + '학점 · 선택' })));
          }
        });
        for (var k = sel[g.id].length; k < g.limit; k++) {
          ul.appendChild(el('li', { class: 'empty' }, el('span', { text: '(' + g.name + ' 미선택)' })));
        }
      });
      grid.appendChild(el('section', {}, el('h3', { text: sem.label }), ul));
    });
    return el('div', {}, head, grid);
  }

  // ─────────────────────────────────────────────────────────────
  //  제출
  // ─────────────────────────────────────────────────────────────
  function submit() {
    var note = $('#submit-status');
    var probs = problems(state.sel);
    if (probs.length) {
      setStatus(note, '아직 채우지 않은 조건이 ' + probs.length + '건 있어요. 위쪽 안내를 확인해 주세요.', 'error');
      $('#checklist').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    var btn = $('#btn-submit');
    btn.disabled = true;
    setStatus(note, '저장하고 있어요…', 'busy');

    var sending = cleanSel(state.sel);
    api('submit', { selections: JSON.stringify(sending) }).then(function (res) {
      if (res.ok) {
        state.submitted = { timestamp: res.timestamp, selections: sending };
        saveDraft();
        renderStatus();
        render();
        setStatus(note, res.message + (res.warning ? ' 다만 명단에 학번이 빠져 있을 수 있으니 담당 선생님께 알려 주세요.' : ''), 'good');
        return;
      }
      if (res.code === 'AUTH') {
        setStatus(note, '로그인이 만료됐어요. 다시 로그인한 뒤 제출 버튼을 한 번 더 눌러 주세요.', 'error');
        needRelogin();
      } else {
        if (res.code === 'CLOSED') { state.status = { open: false, message: res.message }; renderStatus(); }
        setStatus(note, res.message || '제출하지 못했어요.', 'error');
      }
      render();
    }).catch(function (err) {
      setStatus(note, '서버에 연결하지 못했어요. 잠시 후 다시 눌러 주세요. (' + err.message + ')', 'error');
      render();
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  제출 내역 확인 화면
  // ─────────────────────────────────────────────────────────────
  function openCheck() {
    show('sc-check');
    var body = $('#check-body');
    body.textContent = '';
    body.appendChild(el('p', { class: 'loading' }, el('span', { class: 'spinner' }), ' 제출한 내용을 불러오고 있어요…'));
    $('#check-actions').hidden = true;

    api('bootstrap').then(function (res) {
      body.textContent = '';
      if (!res.ok) {
        if (res.code === 'AUTH') needRelogin();
        return body.appendChild(el('div', { class: 'notice warn', text: res.message || '불러오지 못했어요.' }));
      }
      applyBootstrap(res, false);
      $('#check-actions').hidden = false;
      if (!state.submitted) {
        return body.appendChild(el('div', { class: 'notice', text: '아직 제출한 내용이 없어요.' }));
      }
      var complete = !problems(state.submitted.selections).length;
      if (!complete) body.appendChild(el('div', { class: 'notice warn no-print', text: '저장된 내용에 비어 있는 칸이 있어요. "과목 수정하러 가기"에서 채운 뒤 다시 제출해 주세요.' }));
      var art = el('article', { class: 'report' });
      art.appendChild(reportNode(state.submitted.selections, { timestamp: state.submitted.timestamp }));
      body.appendChild(art);
    }).catch(function (err) {
      body.textContent = '';
      body.appendChild(el('div', { class: 'notice warn', text: '서버에 연결하지 못했어요. (' + err.message + ')' }));
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  내보내기
  // ─────────────────────────────────────────────────────────────
  var loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function () { delete loaded[src]; reject(new Error('파일을 불러오지 못했어요.')); };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  }

  function fileBase() { return state.student.studentId + '_' + state.student.name + '_교육과정설계서'; }

  function exportExcel() {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').then(function () {
      var rows = [['학번', state.student.studentId, '이름', state.student.name, '희망 진로', state.career], [],
        ['학기', '과목명', '영역', '유형', '학점', '구분']];
      SEMS.forEach(function (sem) {
        sem.fixed.forEach(function (f) { rows.push([sem.label, f.n, AREA[f.g], f.t, f.c, '학교 지정']); });
        sem.groups.forEach(function (g) {
          g.list.forEach(function (item) {
            if (state.sel[g.id].indexOf(item.n) > -1) rows.push([sem.label, item.n, AREA[item.g], item.t, item.c, '학생 선택']);
          });
        });
      });
      var ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 12 }, { wch: 26 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 10 }];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '교육과정설계');
      XLSX.writeFile(wb, fileBase() + '.xlsx');
    }).catch(function (e) { toast('엑셀로 저장하지 못했어요. ' + e.message); });
  }

  function exportImage() {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js').then(function () {
      return html2canvas($('#report'), { scale: 2, backgroundColor: '#ffffff' });
    }).then(function (canvas) {
      var a = document.createElement('a');
      a.download = fileBase() + '.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    }).catch(function (e) { toast('이미지로 저장하지 못했어요. ' + e.message); });
  }

  // ─────────────────────────────────────────────────────────────
  //  이벤트
  // ─────────────────────────────────────────────────────────────
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('button');
    if (!t) return;

    if (t.classList.contains('subj')) return toggle(groupById(t.getAttribute('data-group')), t.getAttribute('data-name'));
    if (t.hasAttribute('data-tab')) return openTab(t.getAttribute('data-tab'));

    if (t.hasAttribute('data-reset')) {
      var sem = SEMS.filter(function (s) { return s.id === t.getAttribute('data-reset'); })[0];
      var had = sem.groups.some(function (g) { return state.sel[g.id].length; });
      if (!had) return toast('이 학기에는 선택한 과목이 없어요.');
      if (!confirm(sem.label + '에서 선택한 과목을 모두 초기화할까요?')) return;
      sem.groups.forEach(function (g) { state.sel[g.id] = []; });
      var dropped = dropOrphans();
      saveDraft();
      render();
      return toast(sem.label + ' 선택을 초기화했어요.' + (dropped.length ? ' 선행 이수가 필요한 ' + dropped.join(', ') + '도 함께 취소됐어요.' : ''));
    }

    if (t.hasAttribute('data-preset')) {
      var key = t.getAttribute('data-preset');
      state.preset = state.preset === key ? null : key;
      $$('[data-preset]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-preset') === state.preset); });
      var note = $('#preset-note');
      note.hidden = !state.preset;
      note.textContent = state.preset ? PRESETS[state.preset].note + ' 해당 과목에는 "추천" 표시가 붙어요.' : '';
      return render();
    }

    switch (t.getAttribute('data-action')) {
      case 'logout': return logout();
      case 'go': return show(t.getAttribute('data-screen'));
      case 'open-2025': return void window.open(CFG.LEGACY_2025_URL, '_blank', 'noopener');
      case 'open-select':
        buildSelect();
        render();
        openTab(state.tab);
        return show('sc-select');
      case 'open-check': return openCheck();
      case 'submit': return submit();
      case 'excel': return exportExcel();
      case 'image': return exportImage();
      case 'print': return window.print();
    }
  });

  $('#career').addEventListener('input', function (ev) {
    state.career = ev.target.value.trim();
    saveDraft();
    render();
  });

  window.addEventListener('load', initGoogle);
})();
