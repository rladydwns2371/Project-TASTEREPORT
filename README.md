# Taste Report

영화와 음악에 관한 답변을 바탕으로 AI가 취향 캐릭터, 성적표, 총평, 추천 콘텐츠와 공유 카드를 만드는 서비스의 MVP 개발 환경입니다.

## 구성

```text
taste-report/
├─ frontend/              # React + TypeScript + Vite
├─ backend/               # FastAPI
├─ scripts/               # Windows 개발 환경 스크립트
├─ AGENTS.md              # AI 개발 규칙과 문서 진입점
├─ CLAUDE.md              # Claude Code용 포인터
├─ .ai/                   # 제품·아키텍처·상태·API·작업 기록
├─ .editorconfig
├─ .gitignore
└─ README.md
```

현재 단계에서는 기획 원칙에 맞춰 데이터베이스와 회원가입을 포함하지 않습니다. 비밀 API 키는 `backend/.env`에서만 관리하며 브라우저에 노출하지 않습니다.

## AI 기반 개발 문서

AI 개발 도구는 프로젝트 루트의 `AGENTS.md`를 먼저 읽습니다.

- `.ai/PRODUCT.md`: 서비스 목적, 범위, 질문 역할과 분석 원칙
- `.ai/ARCHITECTURE.md`: 기술 구조, 경계, 데이터 흐름
- `.ai/STATE.md`: 현재 상태, 결정, 다음 작업과 백로그
- `.ai/API.md`: 구현 API와 제안 API 계약
- `.ai/WORKLOG.md`: 완료 작업과 검증 기록

새 세션에서 “이어서 하자”라고 요청하면 `AGENTS.md`와 `.ai/STATE.md`를 기준으로 현재 상황을 파악할 수 있습니다.

## 필수 도구

- Node.js 22 LTS 이상
- pnpm 11 이상 (`corepack enable` 후 사용 권장)
- Python 3.12 이상
- Git

> 현재 컴퓨터의 일반 PATH에서는 `npm`과 Python이 확인되지 않았습니다. 본격 개발 전 공식 Node.js LTS와 Python을 설치하고, 설치 과정에서 Python의 `Add python.exe to PATH`를 활성화하세요.

## 최초 설정

PowerShell에서 프로젝트 루트로 이동한 다음 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

또는 수동 설정:

```powershell
cd frontend
Copy-Item .env.example .env.local
pnpm install

cd ..\backend
Copy-Item .env.example .env
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

## 개발 서버 실행

두 개의 PowerShell 창에서 각각 실행합니다.

```powershell
cd frontend
pnpm dev
```

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

- 프론트엔드: http://localhost:5173
- API 문서: http://localhost:8000/docs
- 상태 확인: http://localhost:8000/api/health

질문지는 프론트엔드만으로 열 수 있지만 실제 영화·음악 검색에는 백엔드가 필요합니다. 영화는 Wikidata와 Wikimedia Commons, 음악은 Apple iTunes Search API를 FastAPI 프록시로 호출합니다. 분석과 리포트는 아직 모의 데이터이며, 답변은 테마별 브라우저 `sessionStorage`에만 보관됩니다.

한 번에 두 창을 열려면 다음 스크립트를 사용할 수 있습니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

## 검증 명령

```powershell
cd frontend
pnpm build

cd ..\backend
.\.venv\Scripts\python.exe -m pytest
```

## 환경 변수 원칙

- 실제 `.env` 파일은 Git에 커밋하지 않습니다.
- `VITE_` 접두사가 붙은 값은 브라우저 번들에 포함될 수 있으므로 비밀키를 넣지 않습니다.
- OpenAI 비밀키는 `backend/.env`에만 저장합니다.
- 영화 검색은 별도 API 키가 필요하지 않습니다. 공개 배포에서는 Wikimedia 요청 정책에 맞게 `WIKIMEDIA_USER_AGENT`에 실제 서비스 URL 또는 연락처를 포함하세요.
- Apple iTunes Search API 음악 검색은 별도 키가 필요하지 않습니다.
- 프론트엔드는 개발 중 `/api` 경로를 Vite 프록시로 FastAPI에 전달합니다.

## 카탈로그 검색

- 영화: Wikidata 한국어·영어 검색, 영화 타입 필터, 개봉연도·원제·감독·제작국 제공
- 영화 이미지: Wikimedia Commons에서 파일별 재사용 조건을 확인해 제공하며, 이미지 아래에 저작자·라이선스·출처 링크 표시. 결과에 따라 이미지가 없거나 공식 포스터가 아닌 스틸·홍보 사진일 수 있음
- 음악: Apple iTunes Search API의 가수·곡 검색. 한국어 검색 품질 때문에 US 스토어를 사용
- 공통: 2자부터 검색, 350ms 디바운스, 이전 요청 취소, 로딩·빈 결과·오류·재시도 표시
- 음악 검색은 Apple 자산 이용 범위를 단순하게 유지하기 위해 앨범 이미지와 미리듣기를 표시하지 않음

Wikidata의 구조화 데이터는 CC0이며, Commons 이미지는 파일마다 라이선스가 다릅니다. 화면의 이미지별 크레딧을 제거하지 말고, 공개 배포 전에 실제 `WIKIMEDIA_USER_AGENT`와 캐시·호출량 정책을 점검하세요.

## 다음 개발 순서 제안

1. 분석 요청/응답 JSON 스키마 고정
2. 샘플 분석 타이머를 실제 AI 분석 API로 교체
3. AI 분석 결과의 근거 연결과 실패 처리 구현
4. 음악 검색 결과의 한국어 표시 품질 개선
5. 실제 분석 결과 기반 9:16 공유 카드와 모바일 시스템 공유 보강

