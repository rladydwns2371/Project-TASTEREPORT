export type Theme = 'movie' | 'music'

export type CatalogItem = {
  provider: 'mock'
  providerId: string
  title: string
  subtitle: string
  year: number
  accent: string
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
