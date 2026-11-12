// curriculum.js 의 내용을 apps-script/Code.gs 의 <CURRICULUM> 블록에 그대로 복사해요.
// 사용법:  node tools/sync-curriculum.js          (복사)
//          node tools/sync-curriculum.js --check  (두 곳이 같은지만 확인)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const gsPath = path.join(root, 'apps-script', 'Code.gs');
const data = fs.readFileSync(path.join(root, 'curriculum.js'), 'utf8')
  .replace(/^\/\*\*[\s\S]*?\*\/\n/, '')   // 맨 위 설명 주석은 빼요
  .trim();

const gs = fs.readFileSync(gsPath, 'utf8');
const re = /(\/\/ <CURRICULUM>[^\n]*\n)[\s\S]*?(\/\/ <\/CURRICULUM>)/;
if (!re.test(gs)) {
  console.error('Code.gs 에서 <CURRICULUM> 블록을 찾지 못했어요.');
  process.exit(1);
}
const next = gs.replace(re, (_, open, close) => open + data + '\n' + close);

if (process.argv.includes('--check')) {
  if (next !== gs) {
    console.error('curriculum.js 와 Code.gs 의 교육과정이 달라요. node tools/sync-curriculum.js 를 실행해 주세요.');
    process.exit(1);
  }
  console.log('교육과정이 서로 같아요.');
} else {
  fs.writeFileSync(gsPath, next);
  console.log(next === gs ? '이미 같아요.' : 'Code.gs 를 갱신했어요.');
}
