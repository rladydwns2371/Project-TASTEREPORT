import { useEffect, useMemo, useState } from 'react'
import { MUSIC_QUESTIONS } from './musicQuestionnaire'
import type { MusicAnswer, MusicCatalogItem, MusicQuestion, MusicQuestionId } from './types'
import { useMusicCatalogSearch } from './useCatalogSearch'

type MusicScreen = 'questionnaire' | 'review' | 'analyzing' | 'report'

const MUSIC_STORAGE_KEY = 'taste-report:music-draft:v2'

const SKIP_LABELS: Record<NonNullable<MusicAnswer['skipReason']>, string> = {
  forgot: '기억이 안 나요',
  no_music: '공부할 땐 음악을 안 들어요',
  no_specific_song: '딱히 정해 둔 곡은 없어요',
}

function readMusicDraft(): MusicAnswer[] {
  try {
    const value = window.sessionStorage.getItem(MUSIC_STORAGE_KEY)
    return value ? (JSON.parse(value) as MusicAnswer[]) : []
  } catch {
    return []
  }
}

function findMusicAnswer(question: MusicQuestion, answers: MusicAnswer[]) {
  return answers.find((answer) => answer.questionId === question.id)
}

function musicAnswerLabel(question: MusicQuestion, answer?: MusicAnswer) {
  if (!answer || answer.skipped) return '선택하지 않았어요'
  if (answer.skipReason) return SKIP_LABELS[answer.skipReason]
  if (answer.options?.length) {
    const custom = answer.userText ? ` · ${answer.userText}` : ''
    return `${answer.options.join(' · ')}${custom}`
  }
  if (answer.contents?.length) {
    return answer.contents.map((item, index) => question.kind === 'rankedTracks' ? `${index + 1}. ${item.title}` : item.title).join(' · ')
  }
  return question.optional ? '추가한 곡이 없어요' : '아직 답하지 않았어요'
}

export function MusicFlow({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<MusicScreen>('questionnaire')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<MusicAnswer[]>(readMusicDraft)

  useEffect(() => {
    window.sessionStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(answers))
  }, [answers])

  const saveAnswer = (answer: MusicAnswer) => {
    setAnswers((current) => [...current.filter((item) => item.questionId !== answer.questionId), answer])
  }

  const restart = () => {
    window.sessionStorage.removeItem(MUSIC_STORAGE_KEY)
    setAnswers([])
    setStep(0)
    setScreen('questionnaire')
  }

  if (screen === 'review') {
    return (
      <MusicReview
        answers={answers}
        onAnalyze={() => setScreen('analyzing')}
        onBackToThemes={onExit}
        onEdit={(index) => { setStep(index); setScreen('questionnaire') }}
      />
    )
  }
  if (screen === 'analyzing') return <MusicAnalyzing onComplete={() => setScreen('report')} />
  if (screen === 'report') {
    return <MusicReport answers={answers} onEdit={() => setScreen('review')} onExit={onExit} onRestart={restart} />
  }

  const question = MUSIC_QUESTIONS[step]
  return (
    <MusicQuestionScreen
      answer={findMusicAnswer(question, answers)}
      answers={answers}
      onAnswer={saveAnswer}
      onBack={() => step === 0 ? onExit() : setStep((current) => current - 1)}
      onNext={() => step === MUSIC_QUESTIONS.length - 1 ? setScreen('review') : setStep((current) => current + 1)}
      question={question}
      step={step}
    />
  )
}

function MusicTopBar({ dark = false }: { dark?: boolean }) {
  return (
    <header className={dark ? 'top-bar dark' : 'top-bar'}>
      <span className="logo">TASTE <b>REPORT</b></span>
      <span className="theme-label music-label"><i /> MUSIC TEST · PREVIEW</span>
    </header>
  )
}

type MusicQuestionScreenProps = {
  question: MusicQuestion
  answer?: MusicAnswer
  answers: MusicAnswer[]
  step: number
  onAnswer: (answer: MusicAnswer) => void
  onBack: () => void
  onNext: () => void
}

function MusicQuestionScreen({ question, answer, answers, step, onAnswer, onBack, onNext }: MusicQuestionScreenProps) {
  const [draft, setDraft] = useState<MusicAnswer>(() => answer ?? { questionId: question.id, role: question.role })

  useEffect(() => {
    setDraft(answer ?? { questionId: question.id, role: question.role })
  }, [answer, question.id, question.role])

  const isComplete = useMemo(() => {
    if (question.optional || draft.skipped || draft.skipReason) return true
    if (question.kind === 'multiChoice') return Boolean(draft.options?.length)
    return Boolean(draft.contents?.length)
  }, [draft, question.kind, question.optional])

  const update = (patch: Partial<MusicAnswer>) => {
    setDraft((current) => ({ ...current, ...patch, skipped: false, skipReason: undefined }))
  }

  const usedTracks = answers
    .filter((item) => item.questionId !== question.id)
    .flatMap((item) => item.contents ?? [])
    .filter((item) => item.itemType === 'track')

  const submit = () => {
    onAnswer(draft)
    onNext()
  }

  const chooseSkipReason = (skipReason: NonNullable<MusicAnswer['skipReason']>) => {
    onAnswer({ questionId: question.id, role: question.role, skipReason })
    onNext()
  }

  const skip = () => {
    onAnswer({ questionId: question.id, role: question.role, skipped: true })
    onNext()
  }

  const isCustomSelected = draft.options?.includes('기타')

  return (
    <main className="question-page music-question-page">
      <MusicTopBar />
      <div className="progress music-progress" aria-label={`전체 ${MUSIC_QUESTIONS.length}개 중 ${step + 1}번째 질문`}>
        <span style={{ width: `${((step + 1) / MUSIC_QUESTIONS.length) * 100}%` }} />
      </div>
      <section className="question-shell">
        <aside className="question-count" aria-hidden="true"><strong>{question.number}</strong><i /><span>{MUSIC_QUESTIONS.length}</span></aside>
        <article className="question-content">
          <header>
            <h1>{question.title.split('\n').map((line) => <span key={line}>{line}</span>)}</h1>
            <p className="question-guide">{question.guide}</p>
          </header>
          <div className="answer-zone">
            {draft.skipReason && (
              <div className="music-skip-selection">
                <span>현재 답변</span><strong>{SKIP_LABELS[draft.skipReason]}</strong>
                <button onClick={() => setDraft({ questionId: question.id, role: question.role })} type="button">곡으로 답하기</button>
              </div>
            )}
            {question.kind === 'multiChoice' && (
              <>
                <LimitedMultiChoice
                  exclusiveOption={question.exclusiveOption}
                  max={question.maxSelections ?? 3}
                  onChange={(options) => update({ options, userText: options.includes('기타') ? draft.userText : undefined })}
                  options={question.options ?? []}
                  selected={draft.options ?? []}
                />
                {question.allowCustom && isCustomSelected && (
                  <label className="other-genre-field">
                    <span>직접 적어주세요</span>
                    <input maxLength={40} onChange={(event) => update({ userText: event.target.value })} placeholder="예: OST, 시티팝" value={draft.userText ?? ''} />
                  </label>
                )}
              </>
            )}
            {question.kind === 'artists' && (
              <MusicCatalogSearch
                entity="artist"
                max={question.maxSelections ?? 3}
                onChange={(contents) => update({ contents })}
                placeholder="가수 이름을 검색해 주세요"
                selected={draft.contents ?? []}
              />
            )}
            {question.kind === 'rankedTracks' && (
              <MusicCatalogSearch
                entity="track"
                max={question.maxSelections ?? 3}
                onChange={(contents) => update({ contents })}
                placeholder="곡명이나 가수 이름을 검색해 주세요"
                ranked
                selected={draft.contents ?? []}
              />
            )}
            {question.kind === 'track' && (
              <MusicCatalogSearch
                entity="track"
                max={1}
                onChange={(contents) => update({ contents })}
                placeholder="곡명이나 가수 이름을 검색해 주세요"
                previous={usedTracks}
                selected={draft.contents ?? []}
              />
            )}
            {question.kind === 'tracks' && (
              <MusicCatalogSearch
                entity="track"
                excluded={usedTracks}
                max={question.maxSelections ?? 5}
                onChange={(contents) => update({ contents })}
                placeholder="추천하고 싶은 곡을 검색해 주세요"
                selected={draft.contents ?? []}
              />
            )}
          </div>
          <footer className="question-footer">
            <button className="back-button" onClick={onBack} type="button">← {step === 0 ? '테마 선택' : '이전'}</button>
            <div>
              {question.skipOptions?.map((option) => (
                <button className="skip-button music-skip" key={option.value} onClick={() => chooseSkipReason(option.value)} type="button">{option.label}</button>
              ))}
              {question.optional && <button className="skip-button" onClick={skip} type="button">건너뛰기</button>}
              <button className="primary-button music-primary" disabled={!isComplete} onClick={submit} type="button">
                {step === MUSIC_QUESTIONS.length - 1 ? '답변 확인하기' : '다음 질문'} <span>→</span>
              </button>
            </div>
          </footer>
        </article>
      </section>
    </main>
  )
}

function LimitedMultiChoice({ options, selected, max, exclusiveOption, onChange }: {
  options: string[]
  selected: string[]
  max: number
  exclusiveOption?: string
  onChange: (options: string[]) => void
}) {
  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option))
      return
    }
    if (option === exclusiveOption) {
      onChange([option])
      return
    }
    const withoutExclusive = selected.filter((item) => item !== exclusiveOption)
    if (withoutExclusive.length < max) onChange([...withoutExclusive, option])
  }

  return (
    <div className="multi-choice-wrap">
      <p><strong>{selected.length}</strong> / {max} 선택</p>
      <div className="choice-grid">
        {options.map((option, index) => {
          const active = selected.includes(option)
          const disabled = !active && option !== exclusiveOption && selected.filter((item) => item !== exclusiveOption).length >= max
          return (
            <button className={active ? 'choice selected' : 'choice'} disabled={disabled} key={option} onClick={() => toggle(option)} type="button">
              <span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong><i>{active ? '✓' : '+'}</i>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MusicCatalogSearch({ entity, selected, max, onChange, placeholder, previous = [], excluded = [], ranked = false }: {
  entity: 'artist' | 'track'
  selected: MusicCatalogItem[]
  max: number
  onChange: (items: MusicCatalogItem[]) => void
  placeholder: string
  previous?: MusicCatalogItem[]
  excluded?: MusicCatalogItem[]
  ranked?: boolean
}) {
  const [query, setQuery] = useState('')
  const excludedIds = new Set([...selected, ...excluded].map((item) => item.providerId))
  const { items, loading, error, attribution, retry } = useMusicCatalogSearch(query, entity)
  const results = items.filter((item) => !excludedIds.has(item.providerId))

  const add = (item: MusicCatalogItem) => {
    if (selected.length >= max || selected.some((current) => current.providerId === item.providerId)) return
    onChange([...selected, item])
    setQuery('')
  }

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= selected.length) return
    const next = [...selected]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    onChange(next)
  }

  const previousChoices = previous.filter((item, index, all) => all.findIndex((candidate) => candidate.providerId === item.providerId) === index && !excludedIds.has(item.providerId)).slice(0, 6)

  return (
    <div className="multi-search music-search">
      <div className="selection-count"><strong>{selected.length}</strong> / {max} 선택{ranked && ' · 위에서부터 1위예요'}</div>
      {selected.length > 0 && (
        <div className={ranked ? 'music-selected-list ranked' : 'music-selected-list'}>
          {selected.map((item, index) => (
            <div key={item.providerId}>
              {ranked && <b>{index + 1}</b>}
              <AlbumTile item={item} />
              <span><strong>{item.title}</strong><small>{item.subtitle}{item.detail ? ` · ${item.detail}` : ''}</small></span>
              {ranked && <span className="rank-controls"><button disabled={index === 0} onClick={() => move(index, -1)} type="button">↑</button><button disabled={index === selected.length - 1} onClick={() => move(index, 1)} type="button">↓</button></span>}
              <button className="remove-music" onClick={() => onChange(selected.filter((current) => current.providerId !== item.providerId))} type="button">×</button>
            </div>
          ))}
        </div>
      )}
      {selected.length < max && (
        <div className="movie-search">
          <label><span>⌕</span><input onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} value={query} />{query && <button onClick={() => setQuery('')} type="button">×</button>}</label>
          {!query && previousChoices.length > 0 && (
            <div className="previous-picks"><small>앞에서 고른 곡</small><div>{previousChoices.map((item) => <button key={item.providerId} onClick={() => add(item)} type="button">{item.title}</button>)}</div></div>
          )}
          {query.trim().length === 1 && <div className="search-hint">두 글자 이상 입력하면 검색해요.</div>}
          {query.trim().length >= 2 && (
            <div className="search-results compact-results">
              <p><strong>검색 결과</strong><span>{loading ? 'Apple 카탈로그에서 찾는 중…' : `${results.length}개 찾음`}</span></p>
              {loading ? <div className="search-status">음악 카탈로그를 검색하고 있어요.</div> : error ? (
                <div className="search-error"><span>{error}</span><button onClick={retry} type="button">다시 시도</button></div>
              ) : results.length ? results.map((item) => (
                <button key={item.providerId} onClick={() => add(item)} type="button">
                  <AlbumTile item={item} /><span><strong>{item.title}</strong><small>{item.subtitle}{item.detail ? ` · ${item.detail}` : ''}</small></span><i>추가 +</i>
                </button>
              )) : <div className="empty-result">검색 결과가 없어요. 곡명이나 가수명을 바꿔 다시 찾아보세요.</div>}
              {attribution && !loading && !error && <div className="catalog-credit"><a href={attribution.url} rel="noreferrer" target="_blank">{attribution.label}</a><span>{attribution.notice}</span></div>}
            </div>
          )}
        </div>
      )}
      {excluded.length > 0 && <p className="already-picked">앞서 고른 {excluded.length}곡은 이미 분석에 포함돼요.</p>}
    </div>
  )
}

function AlbumTile({ item }: { item: MusicCatalogItem }) {
  return <span className="album-tile" style={{ background: item.accent }}><b>{item.title.slice(0, 1)}</b><i>{item.itemType === 'artist' ? 'ARTIST' : 'TRACK'}</i></span>
}

function MusicReview({ answers, onEdit, onAnalyze, onBackToThemes }: {
  answers: MusicAnswer[]
  onEdit: (index: number) => void
  onAnalyze: () => void
  onBackToThemes: () => void
}) {
  return (
    <main className="review-page music-review-page">
      <MusicTopBar />
      <section className="review-heading">
        <p className="kicker">READY TO READ YOUR PLAYLIST</p>
        <h1>이 선곡들로<br />취향을 읽어볼게요.</h1>
        <p>최애와 상황별 선곡을 같은 의미로 섞지 않고 분석해요.<br />바꾸고 싶은 답이 있다면 지금 수정할 수 있어요.</p>
      </section>
      <section className="review-list">
        {MUSIC_QUESTIONS.map((question, index) => (
          <button key={question.id} onClick={() => onEdit(index)} type="button">
            <span>{question.number}</span>
            <span><small>{question.title.replace('\n', ' ')}</small><strong>{musicAnswerLabel(question, findMusicAnswer(question, answers))}</strong></span>
            <i>수정 ↗</i>
          </button>
        ))}
      </section>
      <footer className="review-footer">
        <button className="back-button" onClick={onBackToThemes} type="button">← 테마 선택</button>
        <div><strong>10개의 음악 취향 질문 완료</strong><small>이 탭의 세션 동안 답변이 유지돼요.</small></div>
        <button className="primary-button big music-primary" onClick={onAnalyze} type="button">내 음악 취향 분석하기 <span>→</span></button>
      </footer>
    </main>
  )
}

function MusicAnalyzing({ onComplete }: { onComplete: () => void }) {
  const stages = ['선곡마다 맡은 역할을 구분하고 있어요', '반복되는 음악적 결을 찾고 있어요', '최근 취향과 본진을 비교하고 있어요', '음악 DNA 리포트를 완성하고 있어요']
  const [active, setActive] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setActive((value) => Math.min(value + 1, stages.length - 1)), 700)
    const timer = window.setTimeout(onComplete, 3200)
    return () => { window.clearInterval(interval); window.clearTimeout(timer) }
  }, [onComplete, stages.length])

  return (
    <main className="analyzing-page music-analyzing-page">
      <MusicTopBar />
      <section className="analysis-layout">
        <div className="analysis-visual music-analysis-visual" aria-hidden="true"><span className="orbit one" /><span className="orbit two" /><span className="orbit three" /><span className="analysis-core">♪</span><em className="floating-word word-one">RHYTHM</em><em className="floating-word word-two">MOOD</em><em className="floating-word word-three">VOICE</em></div>
        <div className="analysis-copy"><p className="kicker">AI MUSIC LAB · SAMPLE MODE</p><h1>플레이리스트의<br />공통점을 찾고 있어요.</h1><ul>{stages.map((stage, index) => <li className={index <= active ? 'active' : ''} key={stage}><span>{index < active ? '✓' : index === active ? '●' : '○'}</span>{stage}</li>)}</ul><p className="disclaimer">이번 결과는 재미를 위한 취향 콘텐츠예요.<br />성격이나 음악 수준을 진단하지 않아요.</p></div>
      </section>
    </main>
  )
}

function firstMusicTitle(answers: MusicAnswer[], id: MusicQuestionId, fallback: string) {
  return answers.find((answer) => answer.questionId === id)?.contents?.[0]?.title ?? fallback
}

function MusicReport({ answers, onEdit, onRestart, onExit }: { answers: MusicAnswer[], onEdit: () => void, onRestart: () => void, onExit: () => void }) {
  const genres = answers.find((answer) => answer.questionId === 'music_primary_genre')?.options ?? ['R&B·소울']
  const repeatSong = firstMusicTitle(answers, 'music_recent_repeat', '오래 반복한 한 곡')
  const favoriteArtist = firstMusicTitle(answers, 'music_favorite_artist', '좋아하는 아티스트')

  return (
    <main className="report-page music-report-page">
      <MusicTopBar dark />
      <section className="music-report-hero">
        <div><p className="kicker">YOUR MUSIC DNA</p><h1>감정의 온도를<br />선곡으로 맞추는 디렉터</h1><p>장르는 바뀌어도 선명한 음색과 천천히 쌓이는 분위기에서 오래 머무는 편이에요.</p><div className="music-keywords"><span>#음색수집</span><span>#감정편집</span><span>#상황별선곡</span></div></div>
        <div className="rarity-card"><small>AI ESTIMATED RARITY</small><strong>8<em>%</em></strong><b>취향 희소성 상위</b><p>유명한 곡도 듣지만, 결국 남들이 지나치는 결을 정확히 찾아내요.</p><span>AI가 이번 선택을 바탕으로 추정한 재미용 지표예요.</span></div>
      </section>

      <MusicShareCard genres={genres} />

      <section className="report-section light-section music-dna-report">
        <div className="section-heading"><span className="section-index">01</span><div><p className="kicker">MUSIC DNA COORDINATES</p><h2>플레이리스트를 움직이는<br />다섯 개의 축</h2></div></div>
        <div className="music-axis-grid">
          {[['익숙함', '탐험성', 68], ['몰입형', '배경형', 34], ['감정 중심', '사운드 중심', 57], ['일관형', '전환형', 74], ['개인 감상형', '함께 듣기형', 43]].map(([left, right, score]) => (
            <div key={left as string}><p><span>{left}</span><b>{right}</b></p><i><em style={{ left: `${score}%` }} /></i></div>
          ))}
        </div>
        <blockquote>“혼자 들을 때는 깊이를,<br />함께 들을 때는 흐름을 먼저 골라요.”</blockquote>
      </section>

      <section className="report-section music-discovery-section">
        <span className="section-index">02</span>
        <div><p className="kicker">WHAT AI FOUND</p><h2>말한 취향과<br />선곡이 보여준 취향</h2></div>
        <div className="music-compare-cards"><article><small>내가 말한 기준</small><strong>{genres.join(' · ')}</strong><p>장르와 분위기를 기준으로 취향을 설명했어요.</p></article><article><small>AI가 찾은 중심</small><strong>목소리의 질감과 감정의 고조</strong><p>{repeatSong}을 포함한 반복곡에서 장르보다 일관되게 나타난 패턴이에요.</p></article></div>
      </section>

      <section className="report-section light-section music-timeline-section">
        <span className="section-index">03</span><div><p className="kicker">RECENT VS CORE</p><h2>최근 취향은 움직여도<br />본진의 감정선은 남아요.</h2><p>요즘은 리듬이 또렷한 곡으로 이동했지만, 오래 아끼는 곡에서는 감정이 서서히 쌓이는 흐름으로 돌아와요. 마지막 재생곡은 우연일 수 있어 약한 단서로만 반영했어요.</p></div><div className="music-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
      </section>

      <section className="report-section music-instinct-section">
        <div className="section-heading"><span className="section-index">04</span><div><p className="kicker">SELECTION INSTINCT</p><h2>선곡할 때 반복되는<br />세 가지 본능</h2></div></div>
        <div className="instinct-grid"><article><b>01</b><h3>선명한 음색</h3><p>{favoriteArtist}처럼 첫 소절만으로도 표정이 생기는 목소리에 빠르게 반응해요.</p></article><article><b>02</b><h3>늦게 오는 고조</h3><p>바로 터지는 곡보다 감정을 쌓아 올린 뒤 후렴에서 열리는 곡을 오래 들어요.</p></article><article><b>03</b><h3>상황의 온도</h3><p>좋아하는 곡을 그대로 반복하기보다 함께 듣는 사람과 장면에 맞춰 선곡을 바꿔요.</p></article></div>
      </section>

      <section className="report-section light-section music-predictions">
        <div className="section-heading"><span className="section-index">05</span><div><p className="kicker">AI GUESSED IT</p><h2>이미 좋아하고 있을 것 같은<br />노래 세 곡</h2><p>입력하지 않은 곡 중 반복된 취향 패턴과 가까운 곡을 골랐어요.</p></div></div>
        <div className="music-pick-grid">{[['백예린', 'Square (2017)', '#a96c77'], ['Radiohead', 'No Surprises', '#718792'], ['wave to earth', 'seasons', '#638b75']].map(([artist, title, color], index) => <article key={title}><span style={{ background: color }}><b>{title.slice(0, 1)}</b></span><small>0{index + 1} · AI PICK</small><h3>{title}</h3><p>{artist}</p></article>)}</div>
      </section>

      <section className="music-ideal-section"><p className="kicker">YOUR PLAYLIST'S IDEAL TYPE</p><h2>다정하지만<br />자기 세계가 선명한 사람</h2><p>필요한 순간에는 정확히 마음을 표현하고, 함께 있을 때는 편안하지만 각자의 취향도 존중하는 사람에게 끌릴 가능성이 보여요.</p><small>음악 취향을 바탕으로 추론한 재미용 결과이며 실제 연애 취향과 다를 수 있어요.</small></section>
      <section className="verdict-section music-verdict"><p className="kicker">FINAL VERDICT</p><h2>당신은 음악으로 감정을 설명하기보다,<br />감정의 온도를 조절해요.</h2><p>장르는 자주 바뀌지만 선명한 음색과 서서히 고조되는 전개는 여러 선택에서 반복돼요.</p></section>
      <footer className="report-footer"><div><strong>지금은 샘플 음악 리포트예요.</strong><small>실제 AI 연결 후 답변 근거와 검증된 곡 정보로 교체됩니다.</small></div><div><button onClick={onExit} type="button">테마 선택</button><button onClick={onEdit} type="button">답변 수정</button><button className="accent-button" onClick={onRestart} type="button">다시 답하기 ↗</button></div></footer>
    </main>
  )
}

function MusicShareCard({ genres }: { genres: string[] }) {
  const [saved, setSaved] = useState(false)
  const save = async () => {
    const didSave = await downloadMusicShareCard(genres[0] ?? 'MUSIC')
    if (didSave) { setSaved(true); window.setTimeout(() => setSaved(false), 1800) }
  }
  return (
    <section className="share-card-section music-share-section">
      <div className="share-card-copy"><p className="kicker">SHARE YOUR MUSIC DNA</p><h2>플레이리스트의 정체성을<br />한 장에 담았어요.</h2><p>음악 DNA 캐릭터와 희소성, 가장 강한 취향 축을 인스타 스토리 비율로 정리했어요.</p><span>수치는 실제 사용자 통계가 아닌 AI 추정 재미용 지표예요.</span></div>
      <div className="story-card-column"><div className="story-card music-story-card"><header><span>TASTE REPORT</span><small>MUSIC · 2026</small></header><div className="music-card-rarity"><small>취향 희소성 상위</small><strong>8%</strong></div><div className="story-character"><small>MY MUSIC DNA</small><h3>감정의 온도를<br />맞추는 디렉터</h3><p>장르는 바뀌어도<br />마음을 움직이는 결은 선명하다.</p></div><div className="story-meta"><span>#음색수집</span><span>#{genres[0] ?? 'MUSIC'}</span><span>#감정편집</span></div><footer><span>몰입형 · 전환형</span><b>나도 테스트하기 ↗</b></footer></div><button className="save-card-button music-save-button" onClick={() => void save()} type="button">{saved ? '저장 완료 ✓' : '카드 이미지로 저장 ↓'}</button></div>
    </section>
  )
}

async function downloadMusicShareCard(genre: string) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const context = canvas.getContext('2d')
  if (!context) return false
  const violet = '#7568df'
  const ink = '#17151e'
  const lime = '#d9ff43'
  context.fillStyle = violet
  context.fillRect(0, 0, 1080, 1920)
  context.strokeStyle = 'rgba(255,255,255,.2)'
  context.lineWidth = 3
  for (let y = 300; y < 1550; y += 130) {
    context.beginPath(); context.moveTo(70, y); context.bezierCurveTo(300, y - 100, 500, y + 100, 1010, y - 10); context.stroke()
  }
  context.fillStyle = '#fff'
  context.font = '700 32px "DM Sans", sans-serif'
  context.fillText('TASTE REPORT', 76, 95)
  context.textAlign = 'right'; context.font = '500 24px "DM Sans", sans-serif'; context.fillText('MUSIC · 2026', 1004, 95); context.textAlign = 'left'
  context.font = '400 34px "Jua", "Malgun Gothic", sans-serif'; context.fillText('취향 희소성 상위', 76, 310)
  context.fillStyle = lime; context.font = '700 330px "DM Sans", sans-serif'; context.fillText('8%', 55, 650)
  context.fillStyle = ink; context.fillRect(76, 735, 670, 86)
  context.fillStyle = '#fff'; context.font = '400 34px "Jua", "Malgun Gothic", sans-serif'; context.fillText('AI가 발견한 나의 음악 DNA', 105, 790)
  context.fillStyle = lime; context.font = '700 22px "DM Sans", sans-serif'; context.fillText('MY MUSIC DNA', 76, 1010)
  context.fillStyle = '#fff'; context.font = '400 94px "Jua", "Malgun Gothic", sans-serif'; context.fillText('감정의 온도를', 76, 1130); context.fillText('맞추는 디렉터', 76, 1235)
  context.font = '400 38px "Jua", "Malgun Gothic", sans-serif'; context.fillStyle = 'rgba(255,255,255,.8)'; context.fillText('장르는 바뀌어도 마음을 움직이는 결은 선명하다.', 76, 1370)
  context.fillStyle = '#fff'; context.font = '400 28px "Jua", "Malgun Gothic", sans-serif'; context.fillText(`#음색수집   #${genre}   #감정편집`, 76, 1540)
  context.strokeStyle = 'rgba(255,255,255,.4)'; context.beginPath(); context.moveTo(76, 1740); context.lineTo(1004, 1740); context.stroke()
  context.font = '500 26px "DM Sans", "Malgun Gothic", sans-serif'; context.fillText('몰입형 · 전환형', 76, 1810); context.textAlign = 'right'; context.fillStyle = lime; context.fillText('나도 테스트하기 ↗', 1004, 1810)
  return await new Promise<boolean>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(false); return }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'taste-report-music-dna.png'
      document.body.appendChild(link)
      link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1_000); resolve(true)
    }, 'image/png')
  })
}
