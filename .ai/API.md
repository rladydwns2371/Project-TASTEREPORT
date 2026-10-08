# Taste Report API

마지막 갱신: 2026-09-29

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

## Proposed

아래 API는 아직 구현되지 않았다. 실제 구현 전 질문 ID, 공급자, 오류 정책을 확정한다.

질문 ID와 분석 역할의 기준 목록은 `.ai/PRODUCT.md`의 영화·음악 질문지 화면 사양을 따른다. 프론트엔드와 백엔드는 한국어 표시 문구가 아니라 이 고정 ID로 계약한다.

### `GET /api/catalog/movies/search`

영화 제목을 검색하고 동명 작품과 리메이크를 구분할 수 있는 최소 정보를 반환한다.

Query:

- `query`: 검색어
- `page`: 선택, 기본값 1

응답 후보:

```json
{
  "items": [
    {
      "provider": "provider-name",
      "provider_id": "movie-id",
      "title": "영화 제목",
      "original_title": "Original Title",
      "release_year": 2024,
      "poster_url": "https://..."
    }
  ],
  "page": 1,
  "has_more": false
}
```

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

## 공통 오류 계약 후보

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

