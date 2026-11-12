/**
 * 논산대건고등학교 선택과목 수강신청 — Google Apps Script 백엔드 (v2)
 * ─────────────────────────────────────────────────────────────────
 * 사용법: 스프레드시트에서 [확장 프로그램 → Apps Script]를 열고 이 파일 전체를 붙여넣어요.
 *        이 스크립트는 "자기가 붙어 있는 스프레드시트"에만 읽고 써요.
 *        (사본 시트에 붙이면 사본만 바뀌고, 원본은 건드리지 않아요.)
 *
 * 시트 구성
 *   학번DB           A:학번  B:이름  C:학년  D:이메일          (1행 제목, 2행부터 학생)
 *   제출현황         A:학번  B:이름  C:제출시각  D~:과목명 26칸  (1행 제목, 2행부터 학생)
 *   2026 입학 1학년  A:학번  B:이름  C:이메일  D~:과목별 열      (1행 학기, 2행 과목명, 3행부터 학생)
 *   설정             A열 이름 / B열 값
 *                      IS_OPEN         TRUE 또는 FALSE (제출 열기/닫기)
 *                      CLOSED_MESSAGE  닫혀 있을 때 학생에게 보여줄 문구
 *                      OPEN_FROM       (선택) 이 날짜·시각부터 제출 가능
 *                      OPEN_UNTIL      (선택) 이 날짜·시각까지 제출 가능 (날짜만 쓰면 그날 밤까지)
 */

// ===================================================================
//  설정
// ===================================================================
const CONFIG = {
  // 비워 두면 이 스크립트가 붙어 있는 스프레드시트를 써요 (권장).
  // 스프레드시트에 붙이지 않고 따로 만든 스크립트라면 여기에 스프레드시트 ID를 넣어요.
  SPREADSHEET_ID: '',

  // 구글 로그인 클라이언트 ID — 사이트의 config.js 와 같은 값이어야 해요.
  CLIENT_ID: '209856790601-foujcjpmor0acnsu4iv7avev4hj0jj0n.apps.googleusercontent.com',
  SCHOOL_DOMAIN: 'pess.cnehs.kr',

  SHEET_DB: '학번DB',
  SHEET_SUBMIT: '제출현황',
  SHEET_V2: '2026 입학 1학년',
  SHEET_SETTINGS: '설정',

  V2_SEMESTER_ROW: 1, // "2학년 1학기" 같은 학기 제목이 있는 행
  V2_HEADER_ROW: 2,   // 과목명이 있는 행
  V2_DATA_START: 3,   // 학생 데이터가 시작하는 행

  TIMEZONE: 'Asia/Seoul'
};

// <CURRICULUM> — 이 블록은 사이트의 curriculum.js 와 내용이 같아야 해요.
const CURRICULUM = {
  totalCredits: 174, // 총 이수 학점 (정확히 이 값이어야 제출 가능)
  maxKms: 81,        // 국어·수학·영어 합계 상한
  minLib: 16,        // 교양 합계 하한
  // 선이수 과목: 왼쪽 과목은 오른쪽 과목을 더 앞 학기에 골라야 선택할 수 있어요
  prerequisites: {
    "역학과 에너지": "물리학", "전자기와 양자": "물리학",
    "물질과 에너지": "화학", "화학 반응의 세계": "화학",
    "세포와 물질대사": "생명과학", "생물의 유전": "생명과학",
    "지구시스템과학": "지구과학", "행성우주과학": "지구과학"
  },
  semesters: [
    {
      id: "t1_1", label: "1학년 1학기",
      fixed: [
        ["공통국어1", "kor", 4, "공통"],
        ["공통수학1", "math", 4, "공통"],
        ["공통영어1", "eng", 4, "공통"],
        ["한국사1", "soc", 3, "공통"],
        ["통합사회1", "soc", 4, "공통"],
        ["통합과학1", "sci", 4, "공통"],
        ["과학탐구실험1", "sci", 1, "공통"],
        ["정보", "etc", 3, "일반"],
        ["스포츠문화", "pe", 1, "진로"]
      ],
      groups: [
        {
          id: "s1_1", name: "예술 및 교양", limit: 1,
          list: [
            ["음악", "art", 2, "일반"],
            ["미술", "art", 2, "일반"],
            ["삶과 종교", "etc", 2, "진로"]
          ]
        }
      ]
    },
    {
      id: "t1_2", label: "1학년 2학기",
      fixed: [
        ["공통국어2", "kor", 4, "공통"],
        ["공통수학2", "math", 4, "공통"],
        ["공통영어2", "eng", 4, "공통"],
        ["한국사2", "soc", 3, "공통"],
        ["통합사회2", "soc", 4, "공통"],
        ["통합과학2", "sci", 4, "공통"],
        ["과학탐구실험2", "sci", 1, "공통"],
        ["인공지능기초", "etc", 3, "진로"],
        ["스포츠과학", "pe", 1, "진로"]
      ],
      groups: [
        {
          id: "s1_2", name: "예술 및 교양", limit: 1,
          list: [
            ["음악", "art", 2, "일반"],
            ["미술", "art", 2, "일반"],
            ["삶과 종교", "etc", 2, "진로"]
          ]
        }
      ]
    },
    {
      id: "t2_1", label: "2학년 1학기",
      fixed: [
        ["독서와 작문", "kor", 4, "일반"],
        ["대수", "math", 4, "일반"],
        ["영어Ⅰ", "eng", 4, "일반"],
        ["체육1", "pe", 2, "일반"]
      ],
      groups: [
        {
          id: "s2_art1", name: "예술 영역", limit: 1,
          list: [
            ["음악 연주와 창작", "art", 2, "진로"],
            ["미술 창작", "art", 2, "진로"]
          ]
        },
        {
          id: "s2_lib1", name: "교양 영역", limit: 1,
          list: [
            ["교육의 이해", "etc", 2, "진로"],
            ["인간과 철학", "etc", 2, "진로"],
            ["논술", "etc", 2, "융합"],
            ["인간과 심리", "etc", 2, "진로"],
            ["보건", "etc", 2, "진로"]
          ]
        },
        {
          id: "s4", name: "심화 선택그룹", limit: 4,
          list: [
            ["주제 탐구 독서", "kor", 3, "진로"],
            ["인공지능 수학", "math", 3, "진로"],
            ["영어 발표와 토론", "eng", 3, "진로"],
            ["세계시민과 지리", "soc", 3, "일반"],
            ["세계사", "soc", 3, "일반"],
            ["사회와 문화", "soc", 3, "일반"],
            ["정치", "soc", 3, "진로"],
            ["현대사회와 윤리", "soc", 3, "일반"],
            ["물리학", "sci", 3, "일반"],
            ["화학", "sci", 3, "일반"],
            ["생명과학", "sci", 3, "일반"],
            ["지구과학", "sci", 3, "일반"],
            ["프로그래밍", "etc", 3, "진로"],
            ["일본어", "etc", 3, "일반"],
            ["중국어", "etc", 3, "일반"]
          ]
        }
      ]
    },
    {
      id: "t2_2", label: "2학년 2학기",
      fixed: [
        ["문학", "kor", 4, "일반"],
        ["미적분Ⅰ", "math", 4, "일반"],
        ["영어Ⅱ", "eng", 4, "일반"],
        ["체육2", "pe", 2, "일반"]
      ],
      groups: [
        {
          id: "s2_art2", name: "예술 영역", limit: 1,
          list: [
            ["음악 연주와 창작", "art", 2, "진로"],
            ["미술 창작", "art", 2, "진로"]
          ]
        },
        {
          id: "s2_lib2", name: "교양 영역", limit: 1,
          list: [
            ["교육의 이해", "etc", 2, "진로"],
            ["인간과 철학", "etc", 2, "진로"],
            ["논술", "etc", 2, "융합"],
            ["인간과 심리", "etc", 2, "진로"],
            ["보건", "etc", 2, "진로"]
          ]
        },
        {
          id: "s5", name: "심화 선택그룹", limit: 4,
          list: [
            ["매체 의사소통", "kor", 3, "융합"],
            ["독서 토론과 글쓰기", "kor", 3, "융합"],
            ["기하", "math", 3, "진로"],
            ["수학과 문화", "math", 3, "융합"],
            ["심화 영어", "eng", 3, "진로"],
            ["한국지리 탐구", "soc", 3, "진로"],
            ["동아시아 역사 기행", "soc", 3, "진로"],
            ["사회와 문화", "soc", 3, "일반"],
            ["법과 사회", "soc", 3, "진로"],
            ["윤리와 사상", "soc", 3, "진로"],
            ["물리학", "sci", 3, "일반"],
            ["화학", "sci", 3, "일반"],
            ["생명과학", "sci", 3, "일반"],
            ["지구과학", "sci", 3, "일반"],
            ["역학과 에너지", "sci", 3, "진로"],
            ["물질과 에너지", "sci", 3, "진로"],
            ["세포와 물질대사", "sci", 3, "진로"],
            ["지구시스템과학", "sci", 3, "진로"],
            ["정보과학", "etc", 3, "진로"],
            ["소프트웨어와 생활", "etc", 3, "융합"],
            ["일본어 회화", "etc", 3, "진로"],
            ["중국어 회화", "etc", 3, "진로"]
          ]
        }
      ]
    },
    {
      id: "t3_1", label: "3학년 1학기",
      fixed: [
        ["화법과 언어", "kor", 4, "일반"],
        ["확률과 통계", "math", 4, "일반"],
        ["영어 독해와 작문", "eng", 4, "일반"],
        ["운동과 건강", "pe", 2, "진로"]
      ],
      groups: [
        {
          id: "s3_art1", name: "예술 영역", limit: 1,
          list: [
            ["음악 감상과 비평", "art", 2, "진로"],
            ["미술 감상과 비평", "art", 2, "진로"]
          ]
        },
        {
          id: "s6", name: "심화 선택그룹", limit: 4,
          list: [
            ["독서 토론과 글쓰기", "kor", 3, "융합"],
            ["미적분 II", "math", 3, "진로"],
            ["심화 영어 독해와 작문", "eng", 3, "진로"],
            ["도시의 미래 탐구", "soc", 3, "진로"],
            ["역사로 탐구하는 현대세계", "soc", 3, "융합"],
            ["경제", "soc", 3, "일반"],
            ["인문학과 윤리", "soc", 3, "진로"],
            ["역학과 에너지", "sci", 3, "진로"],
            ["물질과 에너지", "sci", 3, "진로"],
            ["세포와 물질대사", "sci", 3, "진로"],
            ["지구시스템과학", "sci", 3, "진로"],
            ["전자기와 양자", "sci", 3, "진로"],
            ["화학 반응의 세계", "sci", 3, "진로"],
            ["생물의 유전", "sci", 3, "진로"],
            ["행성우주과학", "sci", 3, "진로"],
            ["일본 문화", "etc", 3, "융합"],
            ["중국 문화", "etc", 3, "융합"],
            ["데이터 과학", "etc", 3, "진로"]
          ]
        }
      ]
    },
    {
      id: "t3_2", label: "3학년 2학기",
      fixed: [
        ["스포츠 생활1", "pe", 2, "융합"],
        ["생애 설계와 자립", "etc", 1, "융합"]
      ],
      groups: [
        {
          id: "s3_art2", name: "예술 영역", limit: 1,
          list: [
            ["음악 감상과 비평", "art", 2, "진로"],
            ["미술 감상과 비평", "art", 2, "진로"]
          ]
        },
        {
          id: "s7", name: "융합 선택그룹", limit: 3,
          list: [
            ["문학과 영상", "kor", 4, "융합"],
            ["언어생활 탐구", "kor", 4, "융합"],
            ["수학과제 탐구", "math", 4, "융합"],
            ["세계 문화와 영어", "eng", 4, "융합"],
            ["미디어 영어", "eng", 4, "융합"]
          ]
        },
        {
          id: "s8", name: "융합 선택그룹", limit: 3,
          list: [
            ["사회문제 탐구", "soc", 3, "융합"],
            ["윤리문제 탐구", "soc", 3, "융합"],
            ["역사로 탐구하는 현대세계", "soc", 3, "융합"],
            ["융합과학 탐구", "sci", 3, "융합"],
            ["기후변화와 환경생태", "sci", 3, "융합"],
            ["인공지능 일반", "etc", 3, "진로"],
            ["심화 일본어", "etc", 3, "진로"],
            ["심화 중국어", "etc", 3, "진로"]
          ]
        }
      ]
    }
  ]
};
// </CURRICULUM>

// ===================================================================
//  웹 API
//    ?action=status                        → { ok, status:{open,message} }
//    ?action=bootstrap&token=…             → { ok, student, status, submission }
//    ?action=submit&token=…&selections=…   → { ok, message, timestamp, warning? }
//  cb=함수이름 을 붙이면 JSONP 로, 없으면 JSON 으로 답해요.
// ===================================================================
function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    out = p.action ? route_(p) : { ok: true, message: 'Daegeon HS Subject Selection API v2' };
  } catch (err) {
    out = { ok: false, code: 'SERVER', message: '서버 오류: ' + err.message };
  }
  const json = JSON.stringify(out);
  const cb = String(p.cb || '');
  if (/^[A-Za-z_$][\w$]{0,60}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function route_(p) {
  const ss = book_();
  const action = String(p.action);

  if (action === 'status') return { ok: true, status: getStatus_(ss) };

  const auth = verifyToken_(p.token);
  if (!auth.ok) return auth;
  const st = findStudent_(ss, auth.email);
  if (!st.ok) return st;
  const student = { studentId: st.studentId, name: st.name, email: auth.email };

  if (action === 'bootstrap') {
    return { ok: true, student: student, status: getStatus_(ss), submission: readSubmission_(ss, st.studentId) };
  }

  if (action === 'submit') {
    const status = getStatus_(ss);
    if (!status.open) return { ok: false, code: 'CLOSED', message: status.message };
    let raw;
    try { raw = JSON.parse(p.selections || '{}'); }
    catch (e) { return { ok: false, code: 'INVALID', message: '선택 내용을 읽을 수 없어요. 새로고침 후 다시 시도해 주세요.' }; }
    const checked = validateSelections_(raw);
    if (!checked.ok) {
      return { ok: false, code: 'INVALID', message: '제출할 수 없어요.\n' + checked.errors.join('\n'), errors: checked.errors };
    }
    return writeSubmission_(ss, student, checked.selections);
  }

  return { ok: false, code: 'UNKNOWN', message: '알 수 없는 요청이에요: ' + action };
}

function book_() {
  const id = String(CONFIG.SPREADSHEET_ID || '').trim();
  if (id && id.indexOf('YOUR_') !== 0) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('스프레드시트를 찾을 수 없어요. CONFIG.SPREADSHEET_ID 를 입력해 주세요.');
  return ss;
}

// ===================================================================
//  로그인 확인
// ===================================================================
function verifyToken_(token) {
  token = String(token || '');
  if (!token) return { ok: false, code: 'AUTH', message: '로그인이 필요해요.' };

  const cache = CacheService.getScriptCache();
  const key = 'tok_' + digest_(token);
  const hit = cache.get(key);
  if (hit) return { ok: true, email: hit };

  const expired = { ok: false, code: 'AUTH', message: '로그인이 만료됐어요. 다시 로그인해 주세요.' };
  let d;
  try {
    const res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return expired;
    d = JSON.parse(res.getContentText());
  } catch (e) {
    return { ok: false, code: 'AUTH', message: '로그인 확인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' };
  }

  if (d.aud !== CONFIG.CLIENT_ID) return expired;
  if (d.email_verified !== 'true' && d.email_verified !== true) return expired;
  const email = String(d.email || '').toLowerCase();
  if (!email || email.slice(-(CONFIG.SCHOOL_DOMAIN.length + 1)) !== '@' + CONFIG.SCHOOL_DOMAIN) {
    return { ok: false, code: 'AUTH', message: '학교 계정(@' + CONFIG.SCHOOL_DOMAIN + ')으로만 로그인할 수 있어요.' };
  }

  const left = Number(d.exp) - Math.floor(Date.now() / 1000);
  if (!(left > 0)) return expired;
  cache.put(key, email, Math.min(300, left));
  return { ok: true, email: email };
}

function digest_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text)
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); })
    .join('');
}

// ===================================================================
//  학번DB
// ===================================================================
function findStudent_(ss, email) {
  const cache = CacheService.getScriptCache();
  const key = 'stu_' + email;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const sh = ss.getSheetByName(CONFIG.SHEET_DB);
  if (!sh) return { ok: false, code: 'SETUP', message: '"' + CONFIG.SHEET_DB + '" 시트를 찾을 수 없어요. 담당 선생님께 알려 주세요.' };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][3] || '').trim().toLowerCase() === email) {
      const found = { ok: true, studentId: idStr_(rows[i][0]), name: String(rows[i][1] || '').trim() };
      cache.put(key, JSON.stringify(found), 600);
      return found;
    }
  }
  return {
    ok: false, code: 'NO_STUDENT',
    message: '이 계정(' + email + ')으로 등록된 학생 정보가 없어요. 담당 선생님께 문의해 주세요.'
  };
}

function idStr_(v) {
  if (typeof v === 'number') return String(Math.round(v));
  return String(v == null ? '' : v).trim();
}

// ===================================================================
//  제출 열림/닫힘 (설정 시트)
// ===================================================================
function readSettings_(ss) {
  const out = {};
  const sh = ss.getSheetByName(CONFIG.SHEET_SETTINGS);
  if (!sh) return out;
  sh.getDataRange().getValues().forEach(function (r) {
    const k = String(r[0] == null ? '' : r[0]).trim().toUpperCase();
    if (k) out[k] = r[1];
  });
  return out;
}

function getStatus_(ss) {
  const s = readSettings_(ss);
  let open = true;
  if ('IS_OPEN' in s) open = truthy_(s.IS_OPEN);
  else if ('제출 상태' in s) open = truthy_(s['제출 상태']);

  const closedMsg = String(s.CLOSED_MESSAGE == null ? '' : s.CLOSED_MESSAGE).trim() || '지금은 제출 기간이 아니에요.';
  const from = toDate_(s.OPEN_FROM, false);
  const until = toDate_(s.OPEN_UNTIL, true);
  const now = new Date();
  let message = open ? '과목 선택 제출이 열려 있어요.' : closedMsg;

  if (open && from && now < from) {
    open = false;
    message = '아직 제출 기간이 아니에요. (' + fmt_(from) + '부터 제출할 수 있어요)';
  }
  if (open && until && now > until) {
    open = false;
    message = '제출 기간이 끝났어요. (마감: ' + fmt_(until) + ')';
  }
  return { open: open, message: message, until: until ? fmt_(until) : '' };
}

function truthy_(v) {
  if (v === true) return true;
  const t = String(v == null ? '' : v).trim().toUpperCase();
  return ['TRUE', '열림', 'OPEN', 'Y', 'YES', '1', 'O'].indexOf(t) > -1;
}

function toDate_(v, endOfDay) {
  if (v === '' || v == null) return null;
  let d;
  if (v instanceof Date) {
    d = new Date(v.getTime());
  } else {
    // 글자로 적은 날짜: 2026-11-20, 2026.11.20, 2026-11-20 16:30 모두 받아요
    const m = String(v).trim().match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\.?(?:[ T]+(\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0));
  }
  if (isNaN(d.getTime())) return null;
  // 날짜만 적은 마감일은 그날 23:59:59 까지로 봐요
  if (endOfDay && d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function fmt_(d) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
}

// ===================================================================
//  교육과정 도우미
// ===================================================================
function slots_() {
  const out = [];
  CURRICULUM.semesters.forEach(function (sem) {
    sem.groups.forEach(function (g) { out.push({ id: g.id, limit: g.limit, semId: sem.id, semLabel: sem.label, name: g.name, list: g.list }); });
  });
  return out;
}

/** 과목명 비교용: 띄어쓰기와 로마숫자 표기 차이를 없애요 (영어Ⅰ = 영어1, 미적분 II = 미적분2) */
function norm_(s) {
  return String(s == null ? '' : s)
    .replace(/\s+/g, '')
    .replace(/Ⅲ/g, '3').replace(/Ⅱ/g, '2').replace(/Ⅰ/g, '1')
    .replace(/III/g, '3').replace(/II/g, '2').replace(/I/g, '1')
    .toLowerCase();
}

/** 서버 쪽 검증 — 브라우저에서 무엇을 보내든 규칙에 맞는지 다시 확인해요 */
function validateSelections_(raw) {
  const errors = [];
  const clean = {};
  const pickedAt = {};  // 과목명 → 고른 학기 순서(0부터)
  let total = 0, kms = 0, lib = 0;
  const add = function (g, c) {
    total += c;
    if (g === 'kor' || g === 'math' || g === 'eng') kms += c;
    if (g === 'etc') lib += c;
  };

  CURRICULUM.semesters.forEach(function (sem, si) {
    sem.fixed.forEach(function (f) { add(f[1], f[2]); });
    sem.groups.forEach(function (g) {
      const where = sem.label + ' ' + g.name;
      const got = (raw && Array.isArray(raw[g.id])) ? raw[g.id] : [];
      const names = [];
      got.forEach(function (n) {
        n = String(n);
        if (names.indexOf(n) === -1) names.push(n);
      });
      const picked = [];
      g.list.forEach(function (item) {          // 교육과정 순서대로 정리
        if (names.indexOf(item[0]) > -1) picked.push(item);
      });
      if (picked.length !== names.length) errors.push(where + ': 목록에 없는 과목이 들어 있어요.');
      if (picked.length > g.limit) errors.push(where + ': 최대 ' + g.limit + '과목까지 고를 수 있어요.');
      if (picked.length < g.limit) errors.push(where + ': ' + g.limit + '과목을 골라야 해요. (현재 ' + picked.length + '과목)');
      picked.forEach(function (item) {
        if (item[0] in pickedAt) errors.push(item[0] + ': 같은 과목은 한 번만 고를 수 있어요.');
        else pickedAt[item[0]] = si;
        add(item[1], item[2]);
      });
      clean[g.id] = picked.slice(0, g.limit).map(function (item) { return item[0]; });
    });
  });

  Object.keys(CURRICULUM.prerequisites).forEach(function (name) {
    if (!(name in pickedAt)) return;
    const need = CURRICULUM.prerequisites[name];
    if (!(need in pickedAt) || pickedAt[need] >= pickedAt[name]) {
      errors.push(name + ': ' + need + '을(를) 더 앞 학기에 먼저 골라야 해요.');
    }
  });

  if (total !== CURRICULUM.totalCredits) errors.push('총 이수 학점은 ' + CURRICULUM.totalCredits + '학점이어야 해요. (현재 ' + total + '학점)');
  if (kms > CURRICULUM.maxKms) errors.push('국어·수학·영어 합계는 ' + CURRICULUM.maxKms + '학점을 넘을 수 없어요. (현재 ' + kms + '학점)');
  if (lib < CURRICULUM.minLib) errors.push('교양 합계는 ' + CURRICULUM.minLib + '학점 이상이어야 해요. (현재 ' + lib + '학점)');

  return { ok: errors.length === 0, errors: errors, selections: clean };
}

// ===================================================================
//  제출현황 시트 (과목명을 칸에 적는 형식)
// ===================================================================
function findRowById_(sheet, studentId, startRow) {
  const last = sheet.getLastRow();
  if (last < startRow) return -1;
  const ids = sheet.getRange(startRow, 1, last - startRow + 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (idStr_(ids[i][0]) === studentId) return startRow + i;
  }
  return -1;
}

function rowToSelections_(row) {
  const sel = {};
  let col = 3;
  slots_().forEach(function (s) {
    const picked = [];
    for (let k = 0; k < s.limit; k++) {
      const v = row[col + k];
      if (v !== '' && v != null) picked.push(String(v).trim());
    }
    col += s.limit;
    if (picked.length) sel[s.id] = picked;
  });
  return sel;
}

function selectionsToFlat_(sel) {
  const flat = [];
  slots_().forEach(function (s) {
    const picked = (sel && sel[s.id]) || [];
    for (let k = 0; k < s.limit; k++) flat.push(picked[k] || '');
  });
  return flat;
}

function readSubmission_(ss, studentId) {
  const none = { hasSubmitted: false, timestamp: '', selections: {} };
  const sh = ss.getSheetByName(CONFIG.SHEET_SUBMIT);
  if (!sh) return none;
  const r = findRowById_(sh, studentId, 2);
  if (r === -1) return none;
  const width = 3 + selectionsToFlat_({}).length;
  const row = sh.getRange(r, 1, 1, width).getValues()[0];
  if (!row[2]) return none;
  const ts = (row[2] instanceof Date) ? fmt_(row[2]) : String(row[2]);
  return { hasSubmitted: true, timestamp: ts, selections: rowToSelections_(row) };
}

// ===================================================================
//  2026 입학 1학년 시트 (과목별 열에 1 을 적는 형식)
//  ★ 열 "순서"가 아니라 1행의 학기 제목과 2행의 과목명으로 열을 찾아요.
//    그래서 중간에 "10개" 같은 열이 끼어 있거나 순서가 바뀌어도 맞는 칸에 적어요.
// ===================================================================
function buildV2Map_(sheet) {
  const lastCol = sheet.getLastColumn();
  const top = lastCol ? sheet.getRange(CONFIG.V2_SEMESTER_ROW, 1, 1, lastCol).getValues()[0] : [];
  const head = lastCol ? sheet.getRange(CONFIG.V2_HEADER_ROW, 1, 1, lastCol).getValues()[0] : [];

  // 각 열이 어느 학기에 속하는지 (병합된 제목은 첫 칸에만 값이 있어서 오른쪽으로 이어 붙여요)
  const colSem = [];
  let cur = null;
  for (let c = 0; c < lastCol; c++) {
    const m = norm_(top[c]).match(/(\d)학년(\d)학기/);
    if (m) cur = 't' + m[1] + '_' + m[2];
    colSem.push(cur);
  }
  const hasSemRow = colSem.some(function (x) { return x; });

  const used = {};
  const cols = [];
  const missing = [];
  const take = function (semId, name) {
    const want = norm_(name);
    for (let c = 3; c < lastCol; c++) {   // A~C(학번·이름·이메일) 다음부터
      if (used[c] || norm_(head[c]) !== want) continue;
      if (hasSemRow && colSem[c] !== semId) continue;
      used[c] = true;
      return c + 1;
    }
    return -1;
  };

  CURRICULUM.semesters.forEach(function (sem) {
    if (hasSemRow && colSem.indexOf(sem.id) === -1) return; // 이 시트에 없는 학기(1학년)는 건너뛰어요
    if (!hasSemRow && sem.id.charAt(1) === '1') return;
    sem.fixed.forEach(function (f) {
      const col = take(sem.id, f[0]);
      if (col > 0) cols.push({ col: col, kind: 'fixed', semId: sem.id, name: f[0] });
      else missing.push(sem.label + ' ' + f[0]);
    });
    sem.groups.forEach(function (g) {
      g.list.forEach(function (item) {
        const col = take(sem.id, item[0]);
        if (col > 0) cols.push({ col: col, kind: 'choice', semId: sem.id, groupId: g.id, name: item[0] });
        else missing.push(sem.label + ' ' + item[0]);
      });
    });
  });

  cols.sort(function (a, b) { return a.col - b.col; });
  return { cols: cols, missing: missing, hasSemRow: hasSemRow };
}

/** 한 학생의 행에 1/빈칸을 적어요. 과목 열만 건드리고, 개수·합계 열은 그대로 둬요. */
function writeV2Row_(sheet, rowIdx, map, sel) {
  let run = null;
  const flush = function () {
    if (run) sheet.getRange(rowIdx, run.start, 1, run.vals.length).setValues([run.vals]);
    run = null;
  };
  map.cols.forEach(function (c) {
    const v = (c.kind === 'fixed') ? 1 : (((sel[c.groupId] || []).indexOf(c.name) > -1) ? 1 : '');
    if (run && c.col === run.start + run.vals.length) run.vals.push(v);
    else { flush(); run = { start: c.col, vals: [v] }; }
  });
  flush();
}

function v2RowToSelections_(row, map) {
  const sel = {};
  map.cols.forEach(function (c) {
    if (c.kind !== 'choice') return;
    const v = row[c.col - 1];
    if (v === 1 || String(v).trim() === '1') {
      if (!sel[c.groupId]) sel[c.groupId] = [];
      sel[c.groupId].push(c.name);
    }
  });
  return sel;
}

// ===================================================================
//  제출 저장 (제출현황 + 2026 입학 1학년, 한 번에)
// ===================================================================
function writeSubmission_(ss, student, sel) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh1 = ss.getSheetByName(CONFIG.SHEET_SUBMIT);
    if (!sh1) return { ok: false, code: 'SETUP', message: '"' + CONFIG.SHEET_SUBMIT + '" 시트를 찾을 수 없어요. 담당 선생님께 알려 주세요.' };

    const now = new Date();
    const flat = selectionsToFlat_(sel);
    let r1 = findRowById_(sh1, student.studentId, 2);
    if (r1 === -1) {
      r1 = Math.max(sh1.getLastRow(), 1) + 1;
      sh1.getRange(r1, 1, 1, 2).setValues([[student.studentId, student.name]]);
    }
    sh1.getRange(r1, 3, 1, 1 + flat.length).setValues([[now].concat(flat)]);

    let warning = '';
    const sh2 = ss.getSheetByName(CONFIG.SHEET_V2);
    if (!sh2) {
      warning = '"' + CONFIG.SHEET_V2 + '" 시트가 없어서 제출현황에만 저장됐어요.';
    } else {
      const r2 = findRowById_(sh2, student.studentId, CONFIG.V2_DATA_START);
      if (r2 === -1) {
        warning = '"' + CONFIG.SHEET_V2 + '" 시트에 학번 ' + student.studentId + ' 행이 없어서 제출현황에만 저장됐어요.';
      } else {
        const map = buildV2Map_(sh2);
        writeV2Row_(sh2, r2, map, sel);
        if (map.missing.length) warning = '"' + CONFIG.SHEET_V2 + '" 시트에서 찾지 못한 과목 열이 있어요: ' + map.missing.join(', ');
      }
    }
    SpreadsheetApp.flush();

    const out = { ok: true, timestamp: fmt_(now), message: '제출이 완료됐어요. (' + fmt_(now) + ')' };
    if (warning) {
      out.warning = warning;
      console.warn('[제출 경고] ' + student.studentId + ' ' + student.name + ' — ' + warning);
    }
    return out;
  } finally {
    lock.releaseLock();
  }
}

// ===================================================================
//  관리자 메뉴 — 스프레드시트를 열면 맨 위 메뉴에 "수강신청 관리"가 생겨요
// ===================================================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('수강신청 관리')
    .addItem('① 설정 점검하기 (아무것도 바꾸지 않아요)', 'checkSetup')
    .addSeparator()
    .addItem('② 제출현황에 빠진 학생 행 추가', 'syncRoster')
    .addItem('③ 제출현황 다시 만들기 (2026 입학 1학년 → 제출현황)', 'rebuildSubmissionsFromV2')
    .addItem('④ 2026 입학 1학년 다시 채우기 (제출현황 → 2026 입학 1학년)', 'rebuildV2FromSubmissions')
    .addToUi();
}

function say_(msg) {
  console.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* 편집기에서 실행하면 로그로만 보여요 */ }
}

function confirm_(msg) {
  try {
    const ui = SpreadsheetApp.getUi();
    return ui.alert(msg, ui.ButtonSet.OK_CANCEL) === ui.Button.OK;
  } catch (e) { return true; }
}

function idList_(sheet, startRow) {
  const last = sheet.getLastRow();
  if (last < startRow) return [];
  return sheet.getRange(startRow, 1, last - startRow + 1, 1).getValues()
    .map(function (r) { return idStr_(r[0]); })
    .filter(function (x) { return x; });
}

/** ① 설정 점검 — 읽기만 해요 */
function checkSetup() {
  const ss = book_();
  const L = [];
  L.push('연결된 스프레드시트: ' + ss.getName());
  L.push(ss.getUrl());
  L.push('');

  const db = ss.getSheetByName(CONFIG.SHEET_DB);
  const sub = ss.getSheetByName(CONFIG.SHEET_SUBMIT);
  const v2 = ss.getSheetByName(CONFIG.SHEET_V2);
  [[CONFIG.SHEET_DB, db], [CONFIG.SHEET_SUBMIT, sub], [CONFIG.SHEET_V2, v2], [CONFIG.SHEET_SETTINGS, ss.getSheetByName(CONFIG.SHEET_SETTINGS)]]
    .forEach(function (x) { L.push((x[1] ? '✔ ' : '✘ 없음: ') + x[0] + ' 시트'); });

  const st = getStatus_(ss);
  L.push('');
  L.push('제출 상태: ' + (st.open ? '열림' : '닫힘') + ' — ' + st.message);

  let dbIds = [];
  if (db) {
    const rows = db.getDataRange().getValues().slice(1).filter(function (r) { return r[0] !== '' && r[0] != null; });
    dbIds = rows.map(function (r) { return idStr_(r[0]); });
    const noMail = rows.filter(function (r) { return !String(r[3] || '').trim(); }).map(function (r) { return idStr_(r[0]); });
    const seen = {}, dup = [];
    rows.forEach(function (r) {
      const m = String(r[3] || '').trim().toLowerCase();
      if (!m) return;
      if (seen[m]) dup.push(m); else seen[m] = true;
    });
    L.push('');
    L.push('학번DB 학생 ' + rows.length + '명');
    if (noMail.length) L.push('  ⚠ 이메일 없는 학번: ' + noMail.join(', '));
    if (dup.length) L.push('  ⚠ 같은 이메일이 두 번: ' + dup.join(', '));
  }
  if (sub && db) {
    const have = idList_(sub, 2);
    const lack = dbIds.filter(function (x) { return have.indexOf(x) === -1; });
    L.push('제출현황 ' + have.length + '명' + (lack.length ? '  ⚠ 행 없는 학번: ' + lack.join(', ') + ' (제출하면 자동으로 추가돼요)' : ''));
  }
  if (v2) {
    const map = buildV2Map_(v2);
    L.push('');
    L.push('2026 입학 1학년: 과목 열 ' + map.cols.length + '개를 이름으로 찾았어요.' + (map.hasSemRow ? '' : ' (⚠ 1행에서 학기 제목을 찾지 못했어요)'));
    if (map.missing.length) L.push('  ⚠ 찾지 못한 과목: ' + map.missing.join(', '));
    if (db) {
      const have2 = idList_(v2, CONFIG.V2_DATA_START);
      const lack2 = dbIds.filter(function (x) { return have2.indexOf(x) === -1; });
      L.push('  학생 ' + have2.length + '명' + (lack2.length ? '  ⚠ 행 없는 학번: ' + lack2.join(', ') + ' (이 학생들은 제출해도 이 시트에는 기록되지 않아요. 행을 직접 추가해 주세요)' : ''));
    }
  }
  say_(L.join('\n'));
}

/** ② 학번DB 에는 있는데 제출현황에 행이 없는 학생을 맨 아래에 추가해요 (기존 내용은 그대로) */
function syncRoster() {
  const ss = book_();
  const db = ss.getSheetByName(CONFIG.SHEET_DB);
  if (!db) return say_('"' + CONFIG.SHEET_DB + '" 시트를 찾을 수 없어요.');
  let sub = ss.getSheetByName(CONFIG.SHEET_SUBMIT);
  if (!sub) sub = ss.insertSheet(CONFIG.SHEET_SUBMIT);
  if (sub.getLastRow() === 0) {
    const head = ['학번', '이름', '제출시각'];
    slots_().forEach(function (s) {
      for (let k = 1; k <= s.limit; k++) head.push(s.semLabel.replace('학년 ', '-').replace('학기', '') + ' ' + s.name + '-' + k);
    });
    sub.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sub.setFrozenRows(1);
  }
  const have = idList_(sub, 2);
  const add = [];
  db.getDataRange().getValues().slice(1).forEach(function (r) {
    const id = idStr_(r[0]);
    if (id && have.indexOf(id) === -1) add.push([id, String(r[1] || '').trim()]);
  });
  if (add.length) sub.getRange(sub.getLastRow() + 1, 1, add.length, 2).setValues(add);
  say_('제출현황에 ' + add.length + '명을 추가했어요.');
}

/** ③ 2026 입학 1학년 시트의 1 표시를 읽어서 제출현황의 2~3학년 칸을 다시 채워요 */
function rebuildSubmissionsFromV2() {
  const ss = book_();
  const v2 = ss.getSheetByName(CONFIG.SHEET_V2);
  const sub = ss.getSheetByName(CONFIG.SHEET_SUBMIT);
  if (!v2 || !sub) return say_('"' + CONFIG.SHEET_V2 + '" 또는 "' + CONFIG.SHEET_SUBMIT + '" 시트를 찾을 수 없어요.');
  if (!confirm_('"' + CONFIG.SHEET_V2 + '" 시트 내용으로 "' + CONFIG.SHEET_SUBMIT + '"의 2~3학년 과목 칸을 덮어써요.\n(1학년 칸과 제출시각은 그대로 둬요)\n\n계속할까요?')) return;

  const map = buildV2Map_(v2);
  const inV2 = {};
  map.cols.forEach(function (c) { if (c.groupId) inV2[c.groupId] = true; });
  const width = 3 + selectionsToFlat_({}).length;
  const data = v2.getDataRange().getValues();
  let done = 0, skipped = 0;
  const lacking = [];

  for (let i = CONFIG.V2_DATA_START - 1; i < data.length; i++) {
    const id = idStr_(data[i][0]);
    if (!id) continue;
    const fromV2 = v2RowToSelections_(data[i], map);
    if (!Object.keys(fromV2).length) { skipped++; continue; }
    const r = findRowById_(sub, id, 2);
    if (r === -1) { lacking.push(id); continue; }
    const row = sub.getRange(r, 1, 1, width).getValues()[0];
    const sel = rowToSelections_(row);
    Object.keys(inV2).forEach(function (gid) { sel[gid] = fromV2[gid] || []; });
    const out = [(row[2] instanceof Date) ? row[2] : new Date()].concat(selectionsToFlat_(sel));
    sub.getRange(r, 3, 1, out.length).setValues([out]);
    done++;
  }
  say_('제출현황 다시 만들기 완료: ' + done + '명' +
    (skipped ? '\n선택 내용이 없어 건너뜀: ' + skipped + '명' : '') +
    (lacking.length ? '\n⚠ 제출현황에 행이 없는 학번: ' + lacking.join(', ') : '') +
    (map.missing.length ? '\n⚠ 찾지 못한 과목 열: ' + map.missing.join(', ') : ''));
}

/** ④ 제출현황(제출시각이 있는 학생)의 과목명을 읽어서 2026 입학 1학년 시트의 1 표시를 다시 채워요 */
function rebuildV2FromSubmissions() {
  const ss = book_();
  const v2 = ss.getSheetByName(CONFIG.SHEET_V2);
  const sub = ss.getSheetByName(CONFIG.SHEET_SUBMIT);
  if (!v2 || !sub) return say_('"' + CONFIG.SHEET_V2 + '" 또는 "' + CONFIG.SHEET_SUBMIT + '" 시트를 찾을 수 없어요.');
  if (!confirm_('"' + CONFIG.SHEET_SUBMIT + '" 시트 내용으로 "' + CONFIG.SHEET_V2 + '"의 과목 칸(1 표시)을 덮어써요.\n\n계속할까요?')) return;

  const map = buildV2Map_(v2);
  const data = sub.getDataRange().getValues();
  let done = 0, skipped = 0;
  const lacking = [];
  for (let i = 1; i < data.length; i++) {
    const id = idStr_(data[i][0]);
    if (!id) continue;
    if (!data[i][2]) { skipped++; continue; }
    const r = findRowById_(v2, id, CONFIG.V2_DATA_START);
    if (r === -1) { lacking.push(id); continue; }
    writeV2Row_(v2, r, map, rowToSelections_(data[i]));
    done++;
  }
  say_('2026 입학 1학년 다시 채우기 완료: ' + done + '명' +
    (skipped ? '\n미제출이라 건너뜀: ' + skipped + '명' : '') +
    (lacking.length ? '\n⚠ 이 시트에 행이 없는 학번: ' + lacking.join(', ') : '') +
    (map.missing.length ? '\n⚠ 찾지 못한 과목 열: ' + map.missing.join(', ') : ''));
}
