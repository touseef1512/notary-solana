import Groq from 'groq-sdk';

// Initialize the Groq client.
// We only configure the client if the GROQ_API_KEY is available (e.g. server-side).
const groq = process.env.GROQ_API_KEY ? new Groq({
  apiKey: process.env.GROQ_API_KEY,
}) : null;

export default groq;
