# Volvo Data Dashboard

Volvo Car Korea의 V3S, VOC, CX Index와 ONE VOICE 지표를 통합해 보여주는 운영 대시보드입니다.

## 운영 구조

- **GitHub `main`**: 검증된 최신 소스의 단일 기준(Source of Truth)
- **OpenAI Sites**: 서버 API, D1, R2를 포함한 운영 호스팅
- **Supabase**: 본부장·지점장 허용 계정의 익명 접속 통계
- **Sites D1**: Supabase가 일시적으로 응답하지 않을 때 사용하는 운영 폴백

ES90 Matrix와 동일하게 GitHub의 `main`을 최신 원본으로 관리합니다. Data Dashboard는 정적 GitHub Pages로 전환하지 않습니다. 로그인 API, ONE VOICE 수집 API, D1/R2가 필요한 전체 스택 앱이므로 Sites에서 호스팅하되, 배포 시 GitHub `main`과 Sites 소스 저장소에 같은 커밋을 넣어 두 환경의 소스가 달라지지 않도록 합니다.

## 자동 검증

GitHub에 푸시하거나 Pull Request를 만들면 GitHub Actions가 다음을 자동 실행합니다.

1. 고정된 의존성 설치
2. 운영 빌드
3. 렌더링·접근 제어·UI 회귀 테스트

ONE VOICE 일일 감시도 GitHub Actions에서 평일 오전 10시 이후 운영 API를 확인합니다.

## 접속 통계

접속 현황은 `app/data/login-access.json`의 `countedCdsids`에 포함된 본부장·지점장의 **성공 로그인만** 집계합니다. CDSID 원문은 외부 저장소에 저장하지 않고, 서버에서 salt를 적용한 SHA-256 해시만 Supabase 및 D1에 기록합니다.

Supabase 스키마는 다음 파일을 기준으로 관리합니다.

- `supabase/volvo-dashboard-login-stats.sql`

필수 운영 환경 변수는 다음과 같습니다.

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `LOGIN_STATS_HASH_SALT`

비밀값은 GitHub 소스에 커밋하지 않고 운영 환경의 Secret으로만 관리합니다.

## 개발 및 검증

```bash
npm ci
npm run dev
npm test
```

Node.js `22.13.0` 이상이 필요합니다.
