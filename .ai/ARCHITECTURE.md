# Taste Report Architecture

## 1. 현재 구성

```text
Browser
  └─ React + TypeScript + Vite (:5173)
       └─ /api proxy
            └─ FastAPI (:8000)
                 ├─ configuration / secrets
                 ├─ Wikidata·Commons / iTunes catalog adapters
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
- 도메인 서비스는 Wikidata, iTunes 같은 특정 공급자의 원시 응답 형식에 의존하지 않는다.
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
| `WIKIMEDIA_USER_AGENT` | Wikimedia 요청 식별자. 공개 배포에서는 서비스 URL 또는 연락처 포함 |
| `CATALOG_TIMEOUT_SECONDS` | 외부 카탈로그 요청 타임아웃, 기본 8초 |
| `CATALOG_MAX_RETRIES` | 일시적 외부 호출 실패 재시도 횟수, 기본 1회 |

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

- OpenAI 모델과 구조화 출력 방식
- 공개 정보 조사 범위와 출처 정책
- 분석 1회 비용·시간 예산
- 결과 캐릭터 이미지의 생성 또는 준비된 에셋 사용 여부
- 배포 플랫폼과 운영 로그 보관 기간

결정 전에는 특정 공급자 SDK를 핵심 도메인 계층에 확산시키지 않는다.

## 9. 콘텐츠 검색 공급자

프론트엔드는 공급자 원시 응답을 직접 사용하지 않고 다음 공통 형태만 사용한다.

```text
CatalogItem = provider + providerId + title + subtitle + detail + year + imageUrl + imageCredit
```

- 영화 공급자: 광고가 있는 서비스에서도 사용할 수 있는 CC0 구조화 데이터인 Wikidata를 사용한다. 한국어·영어 엔터티 검색을 합친 뒤 SPARQL로 영화만 필터링하고, 제목·개봉연도·감독·제작국·고유 QID를 정규화한다. 한글 검색에서는 대한민국 영화를 우선하는 별도 랭킹을 적용한다.
- 영화 이미지: Wikimedia Commons의 파일별 라이선스와 저작자 정보를 함께 조회한다. 라이선스·출처를 표시할 수 있는 이미지만 노출하므로 결과에 따라 이미지가 없을 수 있고, 공식 포스터가 아닌 홍보 사진이나 스틸일 수 있다. 화면에서는 각 이미지 바로 아래에 출처 링크를 표시한다.
- Wikimedia 호출은 의미 있는 `User-Agent`를 보내고 동일 검색 결과를 서버 메모리에 5분간 캐시한다. 공개 배포 전 `WIKIMEDIA_USER_AGENT`에 실제 서비스 URL 또는 연락처를 설정한다.
- 음악 공급자: 인증키가 필요 없는 Apple iTunes Search API를 사용한다. KR 스토어가 주요 한국 가수 검색에도 빈 결과를 반환해 한국어·영어 검색이 모두 동작한 US 스토어를 사용한다. 화면 입력은 350ms 디바운스·이전 요청 취소를 적용하고, 서버는 동일 검색을 60초간 메모리 캐시한다.
- Apple의 홍보용 콘텐츠 조건에 불필요하게 묶이지 않도록 현재 음악 검색에서는 앨범 이미지와 미리듣기를 가져오지 않고 제목·가수·앨범·연도·공식 링크만 사용한다.
- 음악 대안: MusicBrainz는 키가 없지만 의미 있는 `User-Agent`와 초당 1회 제한 때문에 FastAPI 프록시가 필요하다. Spotify는 2026년 Development Mode의 Premium·사용자·쿼터 제약 때문에 MVP 기본 공급자로 사용하지 않는다.

두 공급자 모두 FastAPI를 거쳐 공통 `CatalogItem`으로 변환한다. 프론트엔드는 공급자 원시 응답을 모르며, 오래된 TMDB 선택 데이터가 남지 않도록 영화 세션 초안 키를 v3로 올렸다.

```text
영화: Browser → /api/catalog/movies/search → FastAPI Wikidata adapter → Wikidata + Wikimedia Commons
음악: Browser → /api/catalog/music/search → FastAPI iTunes adapter → Apple catalog
분석: Browser → /api/reports/{theme}/analyze → FastAPI AI service → Claude
```

## 10. 실제 분석으로 전환하는 순서

1. 현재 `App.tsx`와 `MusicFlow.tsx`의 모의 분석 타이머를 `POST /api/reports/{theme}/analyze` 호출로 교체한다. 요청에는 질문 ID, 역할, 선택 콘텐츠, 사용자 문구와 명시적 `skipped` 상태를 모두 보낸다.
2. 모의 결과 JSX를 서버 응답 타입으로 분리한다. 전체 성공, 제한된 축소 결과, 타임아웃, 구조 검증 실패와 사용자 재시도 상태를 각각 화면으로 만든다.
3. 서버가 추천 작품과 곡의 실재 여부와 기존 선택 제외를 검증한 뒤 반환하게 한다. 프론트는 추천 제목을 새로 만들어내지 않는다.
4. 실제 분석 계약이 정해지면 `.ai/API.md`의 Proposed 예시를 Pydantic 스키마와 동일한 Implemented 계약으로 교체한다.

