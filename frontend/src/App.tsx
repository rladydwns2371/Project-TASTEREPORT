import { useEffect, useState } from 'react'

type HealthResponse = {
  status: string
  app: string
  environment: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<HealthResponse>
      })
      .then(setHealth)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : '알 수 없는 오류')
      })
  }, [])

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">TASTE REPORT</p>
        <h1>내 취향은 대중픽일까,<br />홍대병일까?</h1>
        <p className="description">
          영화와 음악에 답하다 보면 AI가 취향을 하나의 캐릭터와 성적표로 만들어줍니다.
        </p>
        <div className="status" aria-live="polite">
          <span className={health ? 'dot online' : 'dot'} />
          {health
            ? `API 연결됨 · ${health.environment}`
            : error
              ? `API 연결 대기 중 · ${error}`
              : 'API 연결 확인 중…'}
        </div>
      </section>
    </main>
  )
}

