# Taste Report Architecture

## 1. 현재 구성

```text
Browser
  └─ React + TypeScript + Vite (:5173)
       └─ /api proxy
            └─ FastAPI (:8000)
                 ├─ configuration / secrets
                 ├─ content provider adapters (planned)
                 ├─ analysis service (planned)
                 └─ structured response validation (planned)
```

- 프론트엔드: 설문 진행, 콘텐츠 선택, 결과 표시, 공유 카드 렌더링
- 백엔드: 비밀키, 콘텐츠 검색 공급자 호출, 공개 정보 조사, AI 분석, 응답 검증
- 데이터베이스: 초기 MVP에서는 사용하지 않음
- 상태 보관: 설문 중 답변과 결과는 브라우저 메모리 또는 세션 범위

## 2. 디렉터리

```text
frontend/
├─ src/App.tsx
├─ src/main.tsx
├─ src/index.css
└─ vite.config.mjs

backend/
├─ app/main.py
├─ app/core/config.py
├─ app/api/routes/
└─ tests/
```

기능이 늘어나면 다음 방향으로 확장한다.

```text
frontend/src/
├─ app/             # 앱 조립, 라우팅, 전역 공급자
├─ features/        # questionnaire, catalog-search, report, share-card
├─ shared/          # 공용 UI, API client, 유틸리티
└─ types/           # 공통 클라이언트 타입

backend/app/
├─ api/routes/      # HTTP 입력과 출력
├─ schemas/         # Pydantic 요청·응답 모델
├─ services/        # 설문 정규화와 분석 흐름
├─ providers/       # 영화·음악·AI 외부 공급자 어댑터
└─ core/            # 설정, 공통 오류, 로깅
```

실제 필요가 생기기 전 빈 계층을 미리 만들지 않는다.

## 3. 목표 데이터 흐름

1. 프론트엔드가 질문 ID와 질문 역할을 포함해 답변을 수집한다.
2. 콘텐츠 선택은 공급자 ID, 제목, 연도 또는 아티스트/버전을 함께 보존한다.
3. 백엔드가 요청 스키마를 검증하고 중복 콘텐츠를 정규화한다.
4. 공급자 어댑터가 분석에 필요한 공개 정보만 조회한다.
5. 분석 서비스가 질문 역할, 사용자 표현, 콘텐츠 정보를 AI 입력으로 조립한다.
6. AI의 JSON 결과를 Pydantic 스키마로 검증한다.
7. 실패한 필드의 제한적 재시도 또는 축소 결과를 적용한다.
8. 프론트엔드가 일반 결과 화면과 별도의 9:16 공유 카드를 렌더링한다.

## 4. 경계 규칙

- 프론트엔드는 OpenAI 및 콘텐츠 공급자 비밀키를 알지 못한다.
- API 라우터에 프롬프트 조립과 공급자별 세부 구현을 넣지 않는다.
- 도메인 서비스는 TMDB, Spotify 같은 특정 공급자의 원시 응답 형식에 의존하지 않는다.
- 공급자 ID와 사람이 읽는 표시 값을 함께 보존해 동명 작품·리메이크·라이브·리믹스를 구분한다.
- AI 결과를 저장하거나 표시하기 전 서버 스키마를 통과시킨다.
- 영구 저장이 없더라도 서버 로그와 외부 API 요청에 사용자 답변이 남을 수 있으므로 로깅 범위를 제한한다.

## 5. 환경 변수

현재 `backend/.env`에서 사용하는 값:

| 변수 | 용도 |
|---|---|
| `APP_ENV` | 실행 환경 |
| `APP_NAME` | API 표시 이름 |
| `API_PREFIX` | 기본값 `/api` |
| `FRONTEND_ORIGINS` | CORS 허용 출처, 쉼표 구분 |
| `OPENAI_API_KEY` | AI 분석 공급자 키 |
| `MOVIE_API_KEY` | 영화 카탈로그 공급자 키 |
| `MUSIC_API_KEY` | 음악 카탈로그 공급자 키 |

프론트엔드의 `VITE_API_BASE_URL`은 공개 가능한 API 기준 경로이며 기본값은 `/api`다.

## 6. 오류와 관측성

공통 오류 응답은 향후 다음 형태를 목표로 한다.

```json
{
  "error": {
    "code": "CATALOG_PROVIDER_UNAVAILABLE",
    "message": "콘텐츠 검색을 잠시 사용할 수 없습니다.",
    "request_id": "optional-id"
  }
}
```

- 사용자 메시지와 내부 원인을 분리한다.
- 외부 호출에는 타임아웃을 둔다.
- 재시도는 일시적 실패에만 제한적으로 적용한다.
- 로그에는 요청 ID, 단계, 지연시간, 공급자 상태를 남기되 API 키와 원문 답변은 기본적으로 남기지 않는다.
- AI 분석 실패 시 전체 오류, 축소 결과, 사용자 재시도 중 어떤 UX를 제공할지 명시적으로 결정한다.

## 7. 테스트 전략

- 프론트엔드: 타입 검사, 프로덕션 빌드, 핵심 설문 상태 전이 테스트
- 백엔드: 라우터 계약, 질문 역할 보존, 중복 제거, 오류 매핑 테스트
- 공급자: 실제 네트워크 대신 고정된 fixture로 기본 테스트
- AI: 프롬프트 문자열보다 구조화 출력의 필수 필드와 도메인 불변 규칙을 테스트
- 통합: 프론트 `/api` 프록시와 백엔드 health 확인

## 8. 아직 결정되지 않은 항목

- 영화·음악 카탈로그 공급자
- OpenAI 모델과 구조화 출력 방식
- 공개 정보 조사 범위와 출처 정책
- 분석 1회 비용·시간 예산
- 결과 캐릭터 이미지의 생성 또는 준비된 에셋 사용 여부
- 배포 플랫폼과 운영 로그 보관 기간

결정 전에는 특정 공급자 SDK를 핵심 도메인 계층에 확산시키지 않는다.

