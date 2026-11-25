/**
 * Request spec for generating a study card's details with Gemini.
 * Shared by the browser (services/vocabulary.ts) and the /api/word server function,
 * so cards are generated the same way everywhere.
 */

export const CARD_DETAILS_MODEL = 'gemini-2.5-flash';

export const buildCardDetailsRequest = (word: string, meaning?: string) => {
    const verbFormsSchema = {
        type: 'object',
        properties: {
            eu: { type: 'string' },
            tu: { type: 'string' },
            ele: { type: 'string' },
            nos: { type: 'string' },
            eles: { type: 'string' }
        },
        required: ["eu", "tu", "ele", "nos", "eles"]
    };

    const detailSchema = {
        type: 'object',
        properties: {
            definition: { type: 'string' },
            grammarNotes: { type: 'string' },
            visualPrompt: { type: 'string' },
            frequency: {
                type: 'string',
                enum: ["Top 500", "Top 1000", "Top 3000", "Top 5000", "10000+"]
            },
            conjugation: {
                type: 'object',
                properties: {
                    isVerb: { type: 'boolean' },
                    tenses: {
                        type: 'object',
                        properties: {
                            presente: verbFormsSchema,
                            perfeito: verbFormsSchema,
                            imperfeito: verbFormsSchema,
                            futuro: verbFormsSchema
                        }
                    }
                },
                required: ["isVerb"]
            },
            examples: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        level: { type: 'string', enum: ["A1", "A2", "B1", "B2"] },
                        sentence: { type: 'string' },
                        translation: { type: 'string' },
                        patterns: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    target: { type: 'string' },
                                    explanation: { type: 'string' }
                                },
                                required: ["target", "explanation"]
                            }
                        }
                    },
                    required: ["level", "sentence", "translation"]
                }
            }
        },
        required: ["definition", "grammarNotes", "examples", "visualPrompt", "conjugation"]
    };

    const systemInstruction = `
    Create a study card for: "${word}".
    Target: European Portuguese.
    Output Language for explanations: Russian.

    Requirements:
    1. Definition in simple PT.
    2. 4 Examples (A1-B2).
    3. Visual prompt: Write a detailed prompt for generating a REALISTIC, life-like illustration of this word. 
       The prompt should describe a concrete scene or object that represents the word's meaning.
       Style: Modern digital art, warm colors, soft lighting, educational flashcard style.
       Example for "o pão": "A freshly baked loaf of bread on a wooden cutting board, with steam rising, warm kitchen background"
    3a. The visual prompt must be in English and contain one concrete real-life scene with a clear main subject.
    3b. Use realistic photography style details: natural lighting, real textures, natural proportions, and believable environment.
    3c. For abstract words, show an everyday human situation that clearly demonstrates the concept.
    3d. Explicitly avoid: abstract art, symbolism, surrealism, icon style, flat vector style, watercolor style.
    3e. Always append: "no text, no letters, no logos".
    4. Grammar notes in Russian.
    5. Frequency rank estimate.
    6. Conjugation if verb (Present, Perf, Imperf, Future).
      `;

    return {
        model: CARD_DETAILS_MODEL,
        contents: {
            parts: [{
                text: meaning
                    ? `Generate details for "${word}" in the meaning «${meaning}» (Russian). All examples and the definition must use this meaning.`
                    : `Generate details for "${word}"`,
            }],
        },
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: detailSchema,
        },
    };
};
