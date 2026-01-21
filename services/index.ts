// Re-export all services for backward compatibility
// Components can import from './services/geminiService' or './services' 

export { getAIClient, callWithRetry } from './client';
export { loadAudio, playAudio, preloadAudio, getOrGenerateAudio, generateAudio } from './audio';
export { generateImage, getOrGenerateImage } from './images';
export { extractVocabulary, generateCardDetails, enrichCardPatterns } from './vocabulary';
export { generateStoryFromWords } from './stories';
export { suggestSmartSorting, type SmartSortSuggestion } from './smartSort';
