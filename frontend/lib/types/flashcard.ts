export type Card = {
  flashcard_id: number;
  question: string;
  answer: string;
  position: number;
};
export type SetData = {
  flashcardsets_id: number;
  user_id: number;
  course_id: string;
  title: string;
  description: string | null;
  cards: Card[];
};
export type SetPayload = {
  course_id: string;
  title: string;
  description: string;
  cards: { flashcard_id?: number; question: string; answer: string }[];
};
export type Course = { course_id: string; title: string };
export type Rating = "easy" | "practice" | "hard";
