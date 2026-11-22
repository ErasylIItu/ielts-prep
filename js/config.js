// App-wide configuration.
//
// AI_PROXY_URL: address of the Cloudflare Worker from /server (no trailing slash), e.g.
//   'https://ielts-prep-ai.<your-subdomain>.workers.dev'
// When it is set, everyone can use the AI features without their own Gemini key:
// the Worker adds the owner's key on the server side. Leave '' to require a personal key.
export const AI_PROXY_URL = 'https://ielts-prep-ai.prep-aapp.workers.dev';
