# Taste Report API

마지막 갱신: 2026-10-09

## 표기

- `Implemented`: 현재 코드에 존재하며 테스트된 계약
- `Proposed`: 방향을 맞추기 위한 초안이며 구현 전에 변경 가능

## Implemented

### `GET /api/health`

서버 실행 상태와 환경을 확인한다.

응답 `200`:

```json
{
  "status": "ok",
  "app": "Taste Report API",
  "environment": "development"
}
```

현재 구현:

- 라우터: `backend/app/api/routes/health.py`
- 테스트: `backend/tests/test_health.py`

### `GET /api/catalog/movies/search`

Wikidata에서 영화 제목을 검색하고 Wikimedia Commons에서 재사용 가능한 이미지를 조회한다. 별도 API 키는 필요하지 않으며 서버가 공급자 요청과 이미지별 라이선스 정보를 정규화한다.

Query:

- `query`: 2~100자의 검색어
- `page`: 현재 `1`만 지원

### `GET /api/catalog/music/search`

인증키가 필요 없는 Apple iTunes Search API에서 가수 또는 곡을 검색한다.

Query:

- `query`: 2~100자의 검색어
- `entity`: `artist` 또는 `track`
- `limit`: 1~25, 기본값 15

두 검색 API의 응답 `200`:

```json
{
  "items": [
    {
      "provider": "wikidata",
      "provider_id": "Q488222",
      "item_type": "movie",
      "title": "괴물",
      "subtitle": "괴물",
      "detail": "봉준호",
      "release_year": 2006,
      "image_url": "https://upload.wikimedia.org/...",
      "external_url": "https://www.wikidata.org/wiki/Q488222",
      "image_credit": {
        "creator": "KIYOUNG KIM",
        "license": "CC BY 2.0",
        "source_url": "https://commons.wikimedia.org/wiki/File:...",
        "license_url": "https://creativecommons.org/licenses/by/2.0"
      }
    }
  ],
  "page": 1,
  "has_more": false,
  "attribution": {
    "provider": "wikidata",
    "label": "Wikidata · Wikimedia Commons",
    "notice": "영화 정보는 Wikidata, 이미지는 Wikimedia Commons의 파일별 라이선스를 따릅니다.",
    "url": "https://www.wikidata.org"
  }
}
```

`provider`는 `wikidata | itunes`, `item_type`은 `movie | artist | track`이다. 영화 이미지는 출처·저작자·라이선스를 함께 표시할 수 있는 경우에만 제공한다. 음악 응답은 같은 형태를 사용하며 이미지·세부 정보가 없을 수 있다. 공급자 원시 응답은 노출하지 않는다.

구현된 검색 오류:

| HTTP | 코드 | 의미 |
|---|---|---|
| `422` | FastAPI 검증 오류 | 검색어 길이·페이지·entity·limit가 잘못됨 |
| `429` | `RATE_LIMITED` | 외부 공급자 호출 제한 |
| `503` | `CATALOG_PROVIDER_UNAVAILABLE` | 외부 공급자 타임아웃·장애·잘못된 응답 |

현재 구현:

- 라우터: `backend/app/api/routes/catalog.py`
- 스키마: `backend/app/schemas/catalog.py`
- 어댑터: `backend/app/providers/wikidata.py`, `backend/app/providers/itunes.py`
- 테스트: `backend/tests/test_catalog.py`

## Proposed

아래 분석 API는 아직 구현되지 않았다. 실제 구현 전 질문 ID와 오류 정책을 확정한다.

질문 ID와 분석 역할의 기준 목록은 `.ai/PRODUCT.md`의 영화·음악 질문지 화면 사양을 따른다. 프론트엔드와 백엔드는 한국어 표시 문구가 아니라 이 고정 ID로 계약한다.

### `POST /api/reports/movie/analyze`

질문별 역할을 보존한 영화 답변을 분석해 구조화된 리포트를 반환한다.

요청 핵심 형태:

```json
{
  "theme": "movie",
  "answers": [
    {
      "question_id": "life_movie",
      "role": "core_positive_preference",
      "content": {
        "provider": "provider-name",
        "provider_id": "movie-id",
        "title": "영화 제목",
        "release_year": 2024
      },
      "user_text": "친구에게 덧붙이고 싶은 말"
    }
  ]
}
```

응답에 필요한 범주:

- `character`: 캐릭터명, 이미지 방향, 핵심 키워드
- `one_liner`: AI 한줄평
- `scorecard`: 재미용 지표와 짧은 근거
- `insights`: 답변 근거가 연결된 해석
- `representative_content`: 대표 선택과 이유
- `surprising_choice`: 의외의 선택과 이유
- `recommendations`: 실재 여부가 확인된 추천 3개와 연결 이유
- `disclaimer`: AI 추정·재미용 안내

## 분석 API 공통 오류 계약 후보

```json
{
  "error": {
    "code": "ANALYSIS_TIMEOUT",
    "message": "분석 시간이 길어지고 있습니다. 다시 시도해 주세요.",
    "request_id": "optional-id"
  }
}
```

오류 코드 후보:

| 코드 | 의미 |
|---|---|
| `VALIDATION_ERROR` | 요청 구조 또는 필수 답변 오류 |
| `CATALOG_PROVIDER_UNAVAILABLE` | 콘텐츠 검색 공급자 장애 |
| `CONTENT_NOT_FOUND` | 선택 콘텐츠를 식별할 수 없음 |
| `ANALYSIS_TIMEOUT` | AI 분석 시간 초과 |
| `ANALYSIS_INVALID_OUTPUT` | AI 구조화 응답 검증 실패 |
| `RATE_LIMITED` | 외부 공급자 또는 서비스 사용량 제한 |

HTTP 상태와 사용자 메시지는 구현 시 함께 확정한다.

## API 변경 규칙

- Implemented 계약을 바꾸면 프론트 사용처, 테스트, 이 문서를 같은 작업에서 갱신한다.
- Proposed 항목을 구현할 때 실제 스키마로 교체하고 Implemented로 이동한다.
- 공급자 원시 응답을 프론트 계약으로 직접 노출하지 않는다.
- 질문 ID와 역할 이름은 분석 품질에 영향을 주므로 임의로 변경하지 않는다.

