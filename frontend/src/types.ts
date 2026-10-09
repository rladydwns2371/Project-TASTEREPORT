export type Theme = 'movie' | 'music'

export type CatalogItem = {
  provider: 'wikidata'
  providerId: string
  title: string
  subtitle: string
  detail?: string
  year?: number
  accent: string
  imageUrl?: string
  imageCredit?: CatalogImageCredit
  sourceUrl?: string
}

export type CatalogImageCredit = {
  creator: string
  license: string
  sourceUrl: string
  licenseUrl?: string
}

export type MovieQuestionId =
  | 'movie_primary_genre'
  | 'movie_life_movie'
  | 'movie_life_movie_pitch'
  | 'movie_recent_favorite'
  | 'movie_outside_taste'
  | 'movie_not_for_me'
  | 'movie_favorite_character'
  | 'movie_memorable_quote'
  | 'movie_friend_recommendation'
  | 'movie_friend_intention'
  | 'movie_additional_favorites'

export type MovieQuestionRole =
  | 'self_reported_genre'
  | 'core_positive_preference'
  | 'user_expression'
  | 'recent_positive_preference'
  | 'taste_expansion'
  | 'negative_boundary'
  | 'character_attachment'
  | 'memory_fragment'
  | 'social_recommendation'
  | 'recommendation_intent'
  | 'additional_positive_preference'

export type MovieAnswer = {
  questionId: MovieQuestionId
  role: MovieQuestionRole
  option?: string
  options?: string[]
  content?: CatalogItem
  contents?: CatalogItem[]
  userText?: string
  skipped?: boolean
}

export type MovieQuestion = {
  id: MovieQuestionId
  role: MovieQuestionRole
  number: string
  title: string
  kind: 'choice' | 'multiChoice' | 'movie' | 'text' | 'movieText' | 'movies'
  options?: string[]
  placeholder?: string
  textLabel?: string
  textPlaceholder?: string
  maxLength?: number
  allowNone?: boolean
  optional?: boolean
}

export type MusicCatalogItem = {
  provider: 'mock' | 'itunes'
  providerId: string
  itemType: 'artist' | 'track'
  title: string
  subtitle: string
  detail?: string
  accent: string
  releaseYear?: number
  sourceUrl?: string
}

export type CatalogAttribution = {
  provider: 'wikidata' | 'itunes'
  label: string
  notice: string
  url: string
}

export type MusicQuestionId =
  | 'music_primary_genre'
  | 'music_favorite_artist'
  | 'music_primary_context'
  | 'music_decisive_element'
  | 'music_recent_repeat'
  | 'music_last_played'
  | 'music_drive_first_song'
  | 'music_study_song'
  | 'music_way_home_song'
  | 'music_additional_favorites'

export type MusicQuestionRole =
  | 'self_reported_genre'
  | 'favorite_artist'
  | 'listening_context'
  | 'listening_priority'
  | 'recent_core_preference'
  | 'weak_recent_signal'
  | 'social_context_choice'
  | 'focus_context_choice'
  | 'transition_context_choice'
  | 'additional_positive_preference'

export type MusicAnswer = {
  questionId: MusicQuestionId
  role: MusicQuestionRole
  options?: string[]
  contents?: MusicCatalogItem[]
  userText?: string
  skipReason?: 'forgot' | 'no_music' | 'no_specific_song'
  skipped?: boolean
}

export type MusicQuestion = {
  id: MusicQuestionId
  role: MusicQuestionRole
  number: string
  title: string
  guide: string
  kind: 'multiChoice' | 'artists' | 'rankedTracks' | 'track' | 'tracks'
  options?: string[]
  maxSelections?: number
  exclusiveOption?: string
  allowCustom?: boolean
  skipOptions?: Array<{ label: string, value: NonNullable<MusicAnswer['skipReason']> }>
  optional?: boolean
}
