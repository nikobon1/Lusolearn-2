export enum Difficulty {
  New = 'New',
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard'
}

export interface Pattern {
  target: string; // The substring to highlight (e.g. "gostaria de")
  explanation: string; // Grammar explanation in Russian
}

export interface Example {
  level: 'A1' | 'A2' | 'B1' | 'B2';
  sentence: string;
  translation: string;
  patterns?: Pattern[]; // Grammar patterns found in this sentence
  audioBase64?: string; // Cache for example audio
}

export interface VerbForms {
    eu: string;
    tu: string;
    ele: string;
    nos: string;
    eles: string;
}

export interface Conjugation {
  isVerb: boolean;
  tenses?: {
    presente: VerbForms;   // Presente do Indicativo
    perfeito: VerbForms;   // Pretérito Perfeito
    imperfeito: VerbForms; // Pretérito Imperfeito
    futuro: VerbForms;     // Futuro do Presente
  };
}

export interface Flashcard {
  id: string;
  folderIds: string[]; // Changed from folderId to support multiple folders
  tags: string[];
  originalTerm: string; // The word or phrase
  translation: string;
  definition: string; // In Portuguese
  examples: Example[]; // Array of examples by level
  conjugation?: Conjugation; // Optional verb conjugation data
  grammarNotes?: string;
  imageUrl?: string; // User uploaded or generated
  imagePrompt?: string; // Prompt used to generate image
  audioBase64?: string; // Cached audio data for the main word
  frequency?: string; // New field: "High", "Medium", "Low"
  
  // SRS Data
  difficulty: Difficulty;
  nextReviewDate: number; // Timestamp
  interval: number; // Current interval in days (0 for learning steps)
  easeFactor: number; // SM-2 Ease factor (starts at 2.5)
  
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  icon?: string;
  createdAt?: number; // Timestamp for sorting
}

export interface SavedStory {
  id: string;
  contentPt: string;
  contentRu: string;
  audioUrl?: string; // Public URL from Supabase
  wordsUsed: string[];
  createdAt: number;
}

export type QuestType = 'review_cards' | 'add_cards' | 'create_story';

export interface Quest {
    id: string;
    type: QuestType;
    description: string;
    target: number;
    progress: number;
    completed: boolean;
    xpReward: number;
}

export interface UserProfile {
  xp: number;
  level: number;
  streak: number;
  lastStudyDate: string; // ISO Date string
  cardsLearned: number;
  // Key: YYYY-MM-DD, Value: Count of cards passed that day
  learningHistory: Record<string, number>;
  quests?: Quest[];
  lastQuestDate?: string;
}

export enum ViewState {
  Dashboard = 'DASHBOARD',
  Study = 'STUDY',
  Create = 'CREATE',
  Profile = 'PROFILE',
  Story = 'STORY',
  StoryList = 'STORY_LIST'
}

// Gemini Response Schema Types
export interface VocabularyItem {
  word: string;
  translation: string;
  context: string; // Brief context of why it was picked
}

export interface AICardDetails {
  definition: string;
  grammarNotes: string;
  visualPrompt: string; // English description for image generator
  frequency?: string; // Estimated frequency
  conjugation: Conjugation;
  examples: {
      level: 'A1' | 'A2' | 'B1' | 'B2';
      sentence: string;
      translation: string;
      patterns?: Pattern[];
  }[];
}