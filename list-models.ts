import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import Groq from 'groq-sdk';
async function main() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const models = await groq.models.list();
  console.log(models.data.map(m => m.id).join('\n'));
}
main();
