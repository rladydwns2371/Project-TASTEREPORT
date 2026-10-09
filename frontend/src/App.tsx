import { useEffect, useMemo, useState } from 'react'
import { MusicFlow } from './MusicFlow'
import { MOVIE_QUESTIONS } from './questionnaire'
import type { CatalogItem, MovieAnswer, MovieQuestion, MovieQuestionId } from './types'
import { useMovieCatalogSearch } from './useCatalogSearch'

type Screen = 'theme' | 'questionnaire' | 'music' | 'review' | 'analyzing' | 'report'

const STORAGE_KEY = 'taste-report:movie-draft:v3'

function readDraft(): MovieAnswer[] {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY)
    return value ? (JSON.parse(value) as MovieAnswer[]) : []
  } catch {
    return []
  }
}

function movieAnswer(question: MovieQuestion, answers: MovieAnswer[]) {
  return answers.find((answer) => answer.questionId === question.id)
}

function answerLabel(question: MovieQuestion, answer?: MovieAnswer) {
  if (!answer || answer.skipped) return '선택하지 않았어요'
  if (answer.options) return answer.options.join(' · ')
  if (answer.option) return answer.option
  if (answer.contents) return answer.contents.map((movie) => movie.title).join(' · ') || '추가 작품 없음'
  if (answer.content && answer.userText) return `${answer.content.title} · ${answer.userText}`
  if (answer.content) return answer.content.title
  if (answer.userText) return answer.userText
  return question.optional ? '입력하지 않았어요' : '아직 답하지 않았어요'
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('theme')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<MovieAnswer[]>(readDraft)

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
  }, [answers])

  const saveAnswer = (answer: MovieAnswer) => {
    setAnswers((current) => [
      ...current.filter((item) => item.questionId !== answer.questionId),
      answer,
    ])
  }

  const finishAnalysis = () => setScreen('report')

  const restart = () => {
    window.sessionStorage.removeItem(STORAGE_KEY)
    setAnswers([])
    setStep(0)
    setScreen('theme')
  }

  if (screen === 'theme') {
    return <ThemeSelection onSelect={(theme) => setScreen(theme === 'movie' ? 'questionnaire' : 'music')} />
  }
  if (screen === 'music') return <MusicFlow onExit={() => setScreen('theme')} />
  if (screen === 'analyzing') return <AnalyzingScreen onComplete={finishAnalysis} />
  if (screen === 'report') {
    return <ReportScreen answers={answers} onEdit={() => setScreen('review')} onRestart={restart} />
  }
  if (screen === 'review') {
    return (
      <ReviewScreen
        answers={answers}
        onAnalyze={() => setScreen('analyzing')}
        onEdit={(index) => {
          setStep(index)
          setScreen('questionnaire')
        }}
      />
    )
  }

  return (
    <QuestionScreen
      answer={movieAnswer(MOVIE_QUESTIONS[step], answers)}
      answers={answers}
      onAnswer={saveAnswer}
      onBack={() => setStep((current) => Math.max(0, current - 1))}
      onNext={() => {
        if (step === MOVIE_QUESTIONS.length - 1) setScreen('review')
        else setStep((current) => current + 1)
      }}
      question={MOVIE_QUESTIONS[step]}
      step={step}
    />
  )
}

function ThemeSelection({ onSelect }: { onSelect: (theme: 'movie' | 'music') => void }) {
  return (
    <main className="theme-page">
      <TopBar />
      <section className="theme-intro">
        <span className="theme-doodle">✦</span>
        <h1>오늘은 어떤 취향을<br />꺼내볼까요?</h1>
        <p>몇 가지 질문에 답하면, 취향을 성적표와 캐릭터로 만들어드려요.</p>
      </section>
      <section className="theme-cards">
        <button className="theme-card movie-theme" onClick={() => onSelect('movie')} type="button">
          <span className="theme-card-number">01</span>
          <div className="theme-icon film-icon"><i /><i /><i /></div>
          <div><small>MOVIE TASTE</small><h2>영화 취향<br />성적표</h2><p>오래 남은 장면과 최애 캐릭터로 알아보는 나의 영화 취향</p></div>
          <strong>시작하기 →</strong>
        </button>
        <button className="theme-card music-theme" onClick={() => onSelect('music')} type="button">
          <span className="theme-card-number">02</span>
          <div className="theme-icon music-icon">♪</div>
          <div><small>MUSIC TASTE</small><h2>음악 취향<br />성적표</h2><p>반복해서 듣는 곡과 선곡 습관으로 알아보는 나의 음악 취향</p></div>
          <strong>시작하기 →</strong>
        </button>
      </section>
    </main>
  )
}

type QuestionScreenProps = {
  question: MovieQuestion
  answer?: MovieAnswer
  answers: MovieAnswer[]
  step: number
  onAnswer: (answer: MovieAnswer) => void
  onBack: () => void
  onNext: () => void
}

function QuestionScreen({ question, answer, answers, step, onAnswer, onBack, onNext }: QuestionScreenProps) {
  const [draft, setDraft] = useState<MovieAnswer>(() => answer ?? {
    questionId: question.id,
    role: question.role,
  })

  useEffect(() => {
    setDraft(answer ?? { questionId: question.id, role: question.role })
  }, [answer, question.id, question.role])

  const isComplete = useMemo(() => {
    if (draft.skipped || question.optional) return true
    if (question.kind === 'choice') return Boolean(draft.option)
    if (question.kind === 'multiChoice') return Boolean(draft.options?.length)
    if (question.kind === 'text') return Boolean(draft.userText?.trim())
    if (question.kind === 'movie') return Boolean(draft.content)
    if (question.kind === 'movies') return true
    return Boolean(draft.content && draft.userText?.trim())
  }, [draft, question.kind, question.optional])

  const selectedGenres = answers.find((item) => item.questionId === 'movie_primary_genre')?.options ?? []
  const displayTitle = question.id === 'movie_outside_taste' && selectedGenres.length
    ? `${selectedGenres.join('·')} 장르에는 속하지 않지만,\n가장 재미있었던 영화는 뭐예요?`
    : question.title

  const update = (patch: Partial<MovieAnswer>) => {
    setDraft((current) => ({ ...current, ...patch, skipped: false }))
  }

  const continueFlow = () => {
    onAnswer(draft)
    onNext()
  }

  const skip = () => {
    const skipped = { questionId: question.id, role: question.role, skipped: true }
    onAnswer(skipped)
    onNext()
  }

  return (
    <main className="question-page">
      <TopBar />
      <div className="progress" aria-label={`전체 ${MOVIE_QUESTIONS.length}개 중 ${step + 1}번째 질문`}>
        <span style={{ width: `${((step + 1) / MOVIE_QUESTIONS.length) * 100}%` }} />
      </div>

      <section className="question-shell">
        <aside className="question-count" aria-hidden="true">
          <strong>{question.number}</strong>
          <i />
          <span>{MOVIE_QUESTIONS.length}</span>
        </aside>

        <article className="question-content">
          <header>
            <h1>{displayTitle.split('\n').map((line) => <span key={line}>{line}</span>)}</h1>
          </header>

          <div className="answer-zone">
            {question.kind === 'choice' && (
              <ChoiceAnswer
                options={question.options ?? []}
                selected={draft.option}
                onSelect={(option) => update({ option })}
              />
            )}
            {question.kind === 'multiChoice' && (
              <>
                <MultiChoiceAnswer
                  options={question.options ?? []}
                  selected={draft.options ?? []}
                  onChange={(options) => update({ options })}
                />
                {draft.options?.includes('기타 · 좋아하는 장르가 여기에 없어요') && (
                  <label className="other-genre-field">
                    <span>좋아하는 장르를 직접 적어주세요</span>
                    <input
                      maxLength={40}
                      onChange={(event) => update({ userText: event.target.value })}
                      placeholder="예: 뮤지컬 영화, 스포츠 영화"
                      value={draft.userText ?? ''}
                    />
                  </label>
                )}
              </>
            )}
            {question.kind === 'text' && (
              <TextAnswer
                maxLength={question.maxLength}
                placeholder={question.placeholder}
                value={draft.userText ?? ''}
                onChange={(userText) => update({ userText })}
              />
            )}
            {(question.kind === 'movie' || question.kind === 'movieText') && (
              <MovieSearch
                placeholder={question.placeholder}
                selected={draft.content}
                usedMovies={answers.flatMap((item) => item.content ? [item.content] : item.contents ?? [])}
                onSelect={(content) => update({ content })}
              />
            )}
            {question.kind === 'movieText' && draft.content && (
              <label className="text-answer compact">
                <span>{question.textLabel}</span>
                <textarea
                  maxLength={question.maxLength}
                  onChange={(event) => update({ userText: event.target.value })}
                  placeholder={question.textPlaceholder}
                  rows={3}
                  value={draft.userText ?? ''}
                />
                <small>{draft.userText?.length ?? 0} / {question.maxLength}</small>
              </label>
            )}
            {question.kind === 'movies' && (
              <MultiMovieSearch
                selected={draft.contents ?? []}
                usedMovies={answers.flatMap((item) => item.content ? [item.content] : [])}
                onChange={(contents) => update({ contents })}
              />
            )}
          </div>

          <footer className="question-footer">
            <button className="back-button" disabled={step === 0} onClick={onBack} type="button">← 이전</button>
            <div>
              {(question.allowNone || question.optional) && (
                <button className="skip-button" onClick={skip} type="button">
                  {question.allowNone ? '딱히 없어요' : '건너뛰기'}
                </button>
              )}
              <button className="primary-button" disabled={!isComplete} onClick={continueFlow} type="button">
                {step === MOVIE_QUESTIONS.length - 1 ? '답변 확인하기' : '다음 질문'} <span>→</span>
              </button>
            </div>
          </footer>
        </article>
      </section>
    </main>
  )
}

function TopBar({ dark = false }: { dark?: boolean }) {
  return (
    <header className={dark ? 'top-bar dark' : 'top-bar'}>
      <span className="logo">TASTE <b>REPORT</b></span>
      <span className="theme-label"><i /> MOVIE TEST · PREVIEW</span>
    </header>
  )
}

function ChoiceAnswer({ options, selected, onSelect }: { options: string[], selected?: string, onSelect: (option: string) => void }) {
  return (
    <div className="choice-grid">
      {options.map((option, index) => (
        <button className={selected === option ? 'choice selected' : 'choice'} key={option} onClick={() => onSelect(option)} type="button">
          <span>{String.fromCharCode(65 + index)}</span>
          <strong>{option}</strong>
          <i>{selected === option ? '✓' : '↗'}</i>
        </button>
      ))}
    </div>
  )
}

function MultiChoiceAnswer({ options, selected, onChange }: { options: string[], selected: string[], onChange: (options: string[]) => void }) {
  return (
    <div className="multi-choice-wrap">
      <p><strong>{selected.length}</strong>개 선택 · 제한 없이 골라도 괜찮아요</p>
      <div className="choice-grid">
        {options.map((option, index) => {
          const isSelected = selected.includes(option)
          return (
            <button
              className={isSelected ? 'choice selected' : 'choice'}
              key={option}
              onClick={() => onChange(isSelected ? selected.filter((item) => item !== option) : [...selected, option])}
              type="button"
            >
              <span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong><i>{isSelected ? '✓' : '+'}</i>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TextAnswer({ value, placeholder, maxLength, onChange }: { value: string, placeholder?: string, maxLength?: number, onChange: (value: string) => void }) {
  return (
    <label className="text-answer">
      <textarea autoFocus maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={5} value={value} />
      <small>{value.length} / {maxLength}</small>
    </label>
  )
}

type MovieSearchProps = {
  selected?: CatalogItem
  usedMovies: CatalogItem[]
  placeholder?: string
  onSelect: (movie?: CatalogItem) => void
}

function MovieSearch({ selected, usedMovies, placeholder, onSelect }: MovieSearchProps) {
  const [query, setQuery] = useState('')
  const { items: results, loading, error, attribution, retry } = useMovieCatalogSearch(query)

  if (selected) {
    return (
      <div className="selected-movie">
        <Poster movie={selected} />
        <div>
          <small>선택한 영화</small><strong>{selected.title}</strong><span>{movieMeta(selected)}</span>
          {selected.imageCredit && <ImageCredit movie={selected} className="selected-image-credit" />}
        </div>
        <button onClick={() => { setQuery(''); onSelect(undefined) }} type="button">다시 고르기</button>
      </div>
    )
  }

  return (
    <div className="movie-search">
      <label>
        <span>⌕</span>
        <input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} value={query} />
        {query && <button onClick={() => setQuery('')} type="button">×</button>}
      </label>
      {!query && usedMovies.length > 0 && (
        <div className="previous-picks">
          <small>앞에서 고른 영화</small>
          <div>{usedMovies.slice(0, 4).map((movie) => <button key={movie.providerId} onClick={() => onSelect(movie)} type="button">{movie.title}</button>)}</div>
        </div>
      )}
      {query.trim().length === 1 && <div className="search-hint">두 글자 이상 입력하면 검색해요.</div>}
      {query.trim().length >= 2 && (
        <div className="search-results">
          <p><strong>검색 결과</strong><span>{loading ? 'Wikidata에서 찾는 중…' : `${results.length}개 찾음`}</span></p>
          {loading ? <div className="search-status">영화 카탈로그를 검색하고 있어요.</div> : error ? (
            <div className="search-error"><span>{error}</span><button onClick={retry} type="button">다시 시도</button></div>
          ) : results.length ? results.map((movie) => (
            <MovieResult key={movie.providerId} movie={movie} onChoose={() => onSelect(movie)} verb="선택" />
          )) : <div className="empty-result">검색 결과가 없어요. 원제나 다른 제목으로 다시 찾아보세요.</div>}
          {attribution && !loading && !error && <CatalogCredit label={attribution.label} notice={attribution.notice} url={attribution.url} />}
        </div>
      )}
    </div>
  )
}

function MultiMovieSearch({ selected, usedMovies, onChange }: { selected: CatalogItem[], usedMovies: CatalogItem[], onChange: (movies: CatalogItem[]) => void }) {
  const [query, setQuery] = useState('')
  const excludedIds = new Set([...selected, ...usedMovies].map((movie) => movie.providerId))
  const { items, loading, error, attribution, retry } = useMovieCatalogSearch(query)
  const results = items.filter((movie) => !excludedIds.has(movie.providerId))

  return (
    <div className="multi-search">
      <div className="selection-count"><strong>{selected.length}</strong> / 5 선택</div>
      {selected.length > 0 && (
        <div className="selected-list">
          {selected.map((movie) => (
            <button key={movie.providerId} onClick={() => onChange(selected.filter((item) => item.providerId !== movie.providerId))} type="button">
              {movie.title} <span>×</span>
            </button>
          ))}
        </div>
      )}
      {selected.length < 5 && (
        <div className="movie-search">
          <label><span>⌕</span><input onChange={(event) => setQuery(event.target.value)} placeholder="영화를 검색해 추가해 주세요" value={query} /></label>
          {query.trim().length === 1 && <div className="search-hint">두 글자 이상 입력하면 검색해요.</div>}
          {query.trim().length >= 2 && <div className="search-results compact-results">
            <p><strong>검색 결과</strong><span>{loading ? 'Wikidata에서 찾는 중…' : `${results.length}개 찾음`}</span></p>
            {loading ? <div className="search-status">영화 카탈로그를 검색하고 있어요.</div> : error ? (
              <div className="search-error"><span>{error}</span><button onClick={retry} type="button">다시 시도</button></div>
            ) : results.length ? results.map((movie) => (
              <MovieResult key={movie.providerId} movie={movie} onChoose={() => { onChange([...selected, movie]); setQuery('') }} verb="추가" />
            )) : <div className="empty-result">추가할 수 있는 영화를 찾지 못했어요.</div>}
            {attribution && !loading && !error && <CatalogCredit label={attribution.label} notice={attribution.notice} url={attribution.url} />}
          </div>}
        </div>
      )}
      {usedMovies.length > 0 && <p className="already-picked">앞서 고른 {usedMovies.length}편은 이미 분석에 포함돼요.</p>}
    </div>
  )
}

function Poster({ movie }: { movie: CatalogItem }) {
  if (movie.imageUrl) return <span className="poster poster-image"><img alt={`${movie.title} 관련 이미지`} src={movie.imageUrl} /></span>
  return <span className="poster" style={{ background: movie.accent }}><b>{movie.title.slice(0, 2)}</b><i>FILM</i></span>
}

function MovieResult({ movie, onChoose, verb }: { movie: CatalogItem, onChoose: () => void, verb: '선택' | '추가' }) {
  return (
    <div className="movie-result">
      <button className="movie-result-choice" onClick={onChoose} type="button">
        <Poster movie={movie} />
        <span><strong>{movie.title}</strong><small>{movieMeta(movie)}</small></span>
        <i>{verb} +</i>
      </button>
      {movie.imageCredit && <ImageCredit movie={movie} className="image-credit" />}
    </div>
  )
}

function ImageCredit({ movie, className }: { movie: CatalogItem, className: string }) {
  if (!movie.imageCredit) return null
  return (
    <a className={className} href={movie.imageCredit.sourceUrl} rel="noreferrer" target="_blank">
      이미지 {movie.imageCredit.creator} · {movie.imageCredit.license}
    </a>
  )
}

function movieMeta(movie: CatalogItem) {
  return [movie.year, movie.subtitle, movie.detail].filter(Boolean).join(' · ') || '상세 정보 없음'
}

function CatalogCredit({ label, notice, url }: { label: string, notice: string, url: string }) {
  return <div className="catalog-credit"><a href={url} rel="noreferrer" target="_blank">{label}</a><span>{notice}</span></div>
}

function ReviewScreen({ answers, onEdit, onAnalyze }: { answers: MovieAnswer[], onEdit: (index: number) => void, onAnalyze: () => void }) {
  return (
    <main className="review-page">
      <TopBar />
      <section className="review-heading">
        <p className="kicker">READY TO READ YOUR TASTE</p>
        <h1>이 답변들로<br />취향을 읽어볼게요.</h1>
        <p>질문마다 다른 의미를 그대로 보존해서 분석해요.<br />바꾸고 싶은 답이 있다면 지금 수정할 수 있어요.</p>
      </section>
      <section className="review-list">
        {MOVIE_QUESTIONS.map((question, index) => (
          <button key={question.id} onClick={() => onEdit(index)} type="button">
            <span>{question.number}</span>
            <span><small>{question.title.replace('\n', ' ')}</small><strong>{answerLabel(question, movieAnswer(question, answers))}</strong></span>
            <i>수정 ↗</i>
          </button>
        ))}
      </section>
      <footer className="review-footer">
        <div><strong>11개의 취향 질문 완료</strong><small>새로고침해도 이 탭이 열려 있는 동안 답변이 유지돼요.</small></div>
        <button className="primary-button big" onClick={onAnalyze} type="button">내 취향 분석하기 <span>→</span></button>
      </footer>
    </main>
  )
}

function AnalyzingScreen({ onComplete }: { onComplete: () => void }) {
  const stages = ['답변의 역할을 정리하고 있어요', '영화 사이의 공통점을 찾고 있어요', '의외의 선택을 비교하고 있어요', '취향 성적표를 완성하고 있어요']
  const [active, setActive] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setActive((value) => Math.min(value + 1, stages.length - 1)), 700)
    const timer = window.setTimeout(onComplete, 3200)
    return () => { window.clearInterval(interval); window.clearTimeout(timer) }
  }, [onComplete, stages.length])

  return (
    <main className="analyzing-page">
      <TopBar />
      <section className="analysis-layout">
        <div className="analysis-visual" aria-hidden="true">
          <span className="orbit one" /><span className="orbit two" /><span className="orbit three" />
          <span className="analysis-core">TR</span>
          <em className="floating-word word-one">CONTEXT</em><em className="floating-word word-two">PATTERN</em><em className="floating-word word-three">SURPRISE</em>
        </div>
        <div className="analysis-copy">
          <p className="kicker">AI TASTE LAB · SAMPLE MODE</p>
          <h1>취향의 모양을<br />찾고 있어요.</h1>
          <ul>{stages.map((stage, index) => <li className={index <= active ? 'active' : ''} key={stage}><span>{index < active ? '✓' : index === active ? '●' : '○'}</span>{stage}</li>)}</ul>
          <p className="disclaimer">이번 결과는 재미를 위한 취향 콘텐츠예요.<br />성격이나 능력을 진단하지 않아요.</p>
        </div>
      </section>
    </main>
  )
}

function getAnswerTitle(answers: MovieAnswer[], id: MovieQuestionId, fallback: string) {
  return answers.find((answer) => answer.questionId === id)?.content?.title ?? fallback
}

function ReportScreen({ answers, onEdit, onRestart }: { answers: MovieAnswer[], onEdit: () => void, onRestart: () => void }) {
  const lifeMovie = getAnswerTitle(answers, 'movie_life_movie', '오래 마음에 남은 영화')
  const outsideMovie = getAnswerTitle(answers, 'movie_outside_taste', '뜻밖의 한 편')
  const genre = answers.find((answer) => answer.questionId === 'movie_primary_genre')?.options?.join('·') ?? '드라마'

  return (
    <main className="report-page">
      <TopBar dark />
      <section className="report-hero">
        <div className="score-block"><span>AI TASTE SCORE</span><strong>87</strong><small>/ 100</small><em>A · 장면 뒤를 읽는 관객</em></div>
        <div className="hero-report-copy">
          <p className="kicker">YOUR MOVIE TASTE</p>
          <h1>끝난 장면을<br />오래 붙잡는 관객</h1>
          <p>명작이라는 이름보다, 보고 난 뒤 내 안에 무엇이 남았는지를 더 믿는 편이에요.</p>
          <div className="viewpoint"><span>평론가의 시선 <b>68</b></span><i><em /></i><span><b>32</b> 대중의 시선</span></div>
          <small>AI가 이번 답변을 고정 기준으로 추정한 재미용 점수예요.</small>
        </div>
      </section>

      <ShareCardSection genre={genre} />

      <section className="character-section report-section">
        <span className="section-index">01</span>
        <div className="character-art"><span>✦</span><i /><b>AFTER<br />GLOW</b></div>
        <div><p className="kicker">TASTE CHARACTER</p><h2>엔딩 크레딧<br />잔류자</h2><p>이야기가 끝나도 감정은 한참 뒤에 퇴장하는 타입. <b>{lifeMovie}</b>처럼 한 장면이 오래 남는 영화를 자기만의 언어로 기억해요.</p><div className="tag-row"><span>#여운수집</span><span>#인물의선택</span><span>#최애는별개</span></div></div>
      </section>

      <section className="dna-section report-section light-section">
        <div className="section-heading"><span className="section-index">02</span><div><p className="kicker">CINEMA DNA</p><h2>취향을 이루는<br />다섯 개의 축</h2></div></div>
        <div className="dna-list">
          {[
            ['사건 추진', '감정의 여운', 82], ['인물 중심', '세계·아이디어', 71], ['익숙한 안정감', '낯선 실험성', 58], ['현실 밀착', '상상 확장', 46], ['명확한 결말', '열린 해석', 76],
          ].map(([left, right, score]) => <div key={left as string}><p><span>{left}</span><b>{right}</b></p><i><em style={{ left: `${score}%` }} /></i></div>)}
        </div>
        <blockquote>“복잡한 세계관도 결국<br />한 사람의 선택으로 기억하는 편.”</blockquote>
      </section>

      <section className="insight-section report-section">
        <span className="section-index">03</span>
        <div className="insight-title"><p className="kicker">WHAT AI FOUND</p><h2>말한 장르는 {genre},<br />반복해서 고른 건 ‘관계의 잔상’</h2></div>
        <div className="insight-copy"><p>표면에서는 {genre} 장르를 골랐지만, 선택한 영화들 사이에는 관계가 바뀐 뒤에도 오래 남는 감정이 반복돼요. 장르보다 인물이 어떤 선택을 하고 무엇을 남기는지가 더 중요한 기준으로 보여요.</p><ul><li><span>01</span>{lifeMovie}에서 선택 이후의 감정을 중요하게 봤어요.</li><li><span>02</span>{outsideMovie}은 익숙한 장르 밖에서도 같은 기준이 작동한다는 단서예요.</li></ul></div>
      </section>

      <section className="boundary-section report-section light-section">
        <span className="section-index">04</span>
        <div><p className="kicker">TASTE BORDER</p><h2>취향의 경계는<br />장르보다 마음에 있어요.</h2><p>낯선 형식도 인물의 감정선을 붙잡을 수 있다면 기꺼이 넘어가요. 반대로 유명한 작품이어도 내 안에 질문을 남기지 못하면 조금 멀어질 가능성이 보여요.</p></div>
        <div className="quote-card"><small>당신에게 영화가 남는 순간</small><strong>“결말을 이해한 순간보다,<br />그 선택을 다시 생각하게 될 때.”</strong><span>기억한 표현과 선택 작품을 함께 본 AI 추정</span></div>
      </section>

      <section className="role-section report-section">
        <span className="section-index">05</span><div className="role-label">IF YOU WERE IN A MOVIE</div><h2>마지막 장면에서<br />말없이 다시 돌아오는 조력자</h2><p>모두가 떠난 뒤, 주인공 옆 빈자리에 조용히 앉는 장면으로 등장해요.</p><blockquote>“답을 주러 온 건 아니에요.<br />혼자 두지 않으려고 왔어요.”</blockquote><small>실제 영화 대사가 아닌, 결과를 위해 만든 문장이에요.</small>
      </section>

      <section className="recommend-section report-section light-section">
        <div className="section-heading"><span className="section-index">06</span><div><p className="kicker">AI GUESSED IT</p><h2>이미 좋아하고 있을 것 같은<br />영화 세 편</h2><p>입력한 작품은 빼고, 같은 감독만 고르는 쉬운 추론도 피했어요.</p></div></div>
        <div className="recommend-grid">
          {[['01', '애프터썬', '2022', '기억 속 장면이 시간이 흐른 뒤 다른 감정으로 돌아오는 영화'], ['02', '괴물', '2023', '시선이 바뀔 때마다 인물의 선택이 새롭게 읽히는 영화'], ['03', '패스트 라이브즈', '2023', '말하지 않은 가능성과 관계의 잔상이 오래 남는 영화']].map(([no, title, year, reason]) => <article key={title}><span>{no}</span><div className="fake-poster"><b>{title.slice(0, 2)}</b></div><small>AI PICK · {year}</small><h3>{title}</h3><p>{reason}</p></article>)}
        </div>
      </section>

      <section className="verdict-section"><p className="kicker">FINAL VERDICT</p><h2>좋은 영화는 끝나는 것이 아니라,<br />당신 안에서 한 장면 더 찍혀요.</h2><p>당신은 영화를 보고 끝내는 관객이 아니라, 인물의 선택이 왜 그 장면에 놓였는지 한 번 더 읽는 관객이에요.</p></section>

      <footer className="report-footer"><div><strong>지금은 샘플 리포트예요.</strong><small>실제 AI 연결 후 답변 근거와 검증된 작품 정보로 교체됩니다.</small></div><div><button onClick={onEdit} type="button">답변 수정</button><button className="accent-button" onClick={onRestart} type="button">처음부터 다시 ↗</button></div></footer>
    </main>
  )
}

function ShareCardSection({ genre }: { genre: string }) {
  const [saved, setSaved] = useState(false)

  const saveCard = async () => {
    const didSave = await downloadShareCard(genre)
    if (didSave) {
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
    }
  }

  return (
    <section className="share-card-section">
      <div className="share-card-copy">
        <p className="kicker">SHARE YOUR SCORE</p>
        <h2>인스타에 바로 올릴<br />한 장짜리 성적표</h2>
        <p>긴 리포트를 읽기 전에 점수, 관점, 캐릭터가 한눈에 보이도록 9:16 카드로 정리했어요.</p>
        <span>버튼을 누르면 인스타 스토리 비율의 PNG 이미지로 바로 저장돼요.</span>
      </div>
      <div className="story-card-column">
        <div className="story-card" aria-label="인스타그램 스토리용 영화 취향 성적표 미리보기">
          <header><span>TASTE REPORT</span><small>MOVIE · 2026</small></header>
          <div className="story-score"><small>나의 영화 취향 점수</small><strong>87</strong><em>점</em></div>
          <div className="story-grade">A · 장면 뒤를 읽는 관객</div>
          <div className="story-character"><small>MY TASTE CHARACTER</small><h3>엔딩 크레딧<br />잔류자</h3><p>좋은 영화는 끝나는 것이 아니라,<br />내 안에서 한 장면 더 찍힌다.</p></div>
          <div className="story-meta"><span>#여운수집</span><span>#{genre.split('·')[0]}</span><span>#인물의선택</span></div>
          <footer><span>평론가 68 : 32 대중</span><b>나도 테스트하기 ↗</b></footer>
        </div>
        <button className="save-card-button" onClick={() => void saveCard()} type="button">
          {saved ? '저장 완료 ✓' : '카드 이미지로 저장 ↓'}
        </button>
      </div>
    </section>
  )
}

async function downloadShareCard(genre: string) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const context = canvas.getContext('2d')
  if (!context) return false

  const ink = '#ffffff'
  const blue = '#5a73ff'
  const lime = '#d9ff43'
  const coral = '#ff6b4a'
  context.fillStyle = blue
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.strokeStyle = 'rgba(255,255,255,.16)'
  context.lineWidth = 3
  for (const radius of [230, 350, 470]) {
    context.beginPath()
    context.arc(1010, 630, radius, 0, Math.PI * 2)
    context.stroke()
  }

  context.fillStyle = ink
  context.font = '700 32px "DM Sans", sans-serif'
  context.fillText('TASTE REPORT', 76, 92)
  context.textAlign = 'right'
  context.font = '500 24px "DM Sans", sans-serif'
  context.fillText('MOVIE · 2026', 1004, 92)
  context.textAlign = 'left'

  context.font = '400 32px "Jua", "Malgun Gothic", sans-serif'
  context.fillText('나의 영화 취향 점수', 76, 260)
  context.fillStyle = lime
  context.font = '700 420px "DM Sans", sans-serif'
  context.fillText('87', 50, 640)
  context.fillStyle = ink
  context.font = '400 38px "Jua", "Malgun Gothic", sans-serif'
  context.fillText('점', 640, 610)

  context.save()
  context.translate(76, 720)
  context.rotate(-Math.PI / 90)
  context.fillStyle = coral
  context.fillRect(0, 0, 520, 82)
  context.fillStyle = ink
  context.font = '400 34px "Jua", "Malgun Gothic", sans-serif'
  context.fillText('A · 장면 뒤를 읽는 관객', 28, 54)
  context.restore()

  context.fillStyle = lime
  context.font = '700 22px "DM Sans", sans-serif'
  context.fillText('MY TASTE CHARACTER', 76, 970)
  context.fillStyle = ink
  context.font = '400 102px "Jua", "Malgun Gothic", sans-serif'
  context.fillText('엔딩 크레딧', 76, 1090)
  context.fillText('잔류자', 76, 1195)
  context.font = '400 38px "Jua", "Malgun Gothic", sans-serif'
  context.fillStyle = 'rgba(255,255,255,.78)'
  context.fillText('좋은 영화는 끝나는 것이 아니라,', 76, 1320)
  context.fillText('내 안에서 한 장면 더 찍힌다.', 76, 1375)

  const tags = ['#여운수집', `#${genre.split('·')[0]}`, '#인물의선택']
  context.font = '400 29px "Jua", "Malgun Gothic", sans-serif'
  let tagX = 76
  for (const tag of tags) {
    const width = context.measureText(tag).width + 52
    context.strokeStyle = 'rgba(255,255,255,.55)'
    context.strokeRect(tagX, 1510, width, 64)
    context.fillStyle = ink
    context.fillText(tag, tagX + 26, 1553)
    tagX += width + 15
  }

  context.strokeStyle = 'rgba(255,255,255,.35)'
  context.beginPath()
  context.moveTo(76, 1740)
  context.lineTo(1004, 1740)
  context.stroke()
  context.fillStyle = ink
  context.font = '500 26px "DM Sans", "Malgun Gothic", sans-serif'
  context.fillText('평론가 68 : 32 대중', 76, 1810)
  context.textAlign = 'right'
  context.fillStyle = lime
  context.fillText('나도 테스트하기 ↗', 1004, 1810)

  return await new Promise<boolean>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(false); return }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'taste-report-movie-score.png'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      resolve(true)
    }, 'image/png')
  })
}

