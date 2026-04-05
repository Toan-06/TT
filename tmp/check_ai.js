const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: 'dummy' });
console.log('Methods of ai:', Object.keys(ai));
if (ai.models) console.log('Methods of ai.models:', Object.keys(ai.models));
