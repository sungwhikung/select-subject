/**
 * 사이트 설정 — 연결 정보를 바꿀 때는 이 파일만 고치면 돼요.
 */
const APP_CONFIG = {
  // Apps Script 웹앱 주소 (배포 → 배포 관리에서 복사한 …/exec 주소)
  // ⚠ 테스트 중에는 반드시 "사본 시트"의 웹앱 주소를 넣어요.
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxcRYPXYfpvgw41i6rCESlWhElu-O632G7r1HIe5ySwHBXsOpe5U4RdlrJYHX82poMk/exec',

  // 구글 로그인 클라이언트 ID (apps-script/Code.gs 의 CLIENT_ID 와 같아야 해요)
  CLIENT_ID: '132908628137-396mibqkfq8h1pfbcu56nggbkbt5968i.apps.googleusercontent.com',

  // 로그인할 수 있는 학교 계정 도메인
  SCHOOL_DOMAIN: 'pess.cnehs.kr',

  // 2025학년도 입학생용 기존 조회 사이트
  LEGACY_2025_URL: 'https://script.google.com/a/macros/pess.cnehs.kr/s/AKfycbw3OJYxvInH1dRXjO-zZwPpuR70aSPbMByvbZIMHIgpChy5vt6lKwggM-CUryASd2BSWg/exec'
};
