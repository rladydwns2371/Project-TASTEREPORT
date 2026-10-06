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
- OpenAI, 영화, 음악 API 키는 `backend/.env`에만 저장합니다.
- 프론트엔드는 개발 중 `/api` 경로를 Vite 프록시로 FastAPI에 전달합니다.

## 다음 개발 순서 제안

1. 영화 질문지 화면과 답변 상태 모델 구현
2. 영화·음악 검색 공급자 선정 및 서버 어댑터 작성
3. 분석 요청/응답 JSON 스키마 고정
4. AI 분석 결과의 근거 연결과 실패 처리 구현
5. 9:16 공유 카드 렌더링 및 이미지 저장
6. 비용·지연시간·완료율 측정 범위 결정

