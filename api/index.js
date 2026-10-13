require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('node:path');

function createApp({ fetchImpl = fetch, getApiKey = () => process.env.OPENAI_API_KEY } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'");
    next();
  });

  app.post(['/api/chat', '/api/index'], async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || !messages.length || messages.length > 41 ||
      messages.some((m, i) => !m || m.role !== (i % 2 === 0 ? 'user' : 'assistant') ||
        typeof m.content !== 'string' || !m.content.trim() || m.content.length > (m.role === 'user' ? 6000 : 12000)) ||
      messages.at(-1)?.role !== 'user' ||
      messages.reduce((sum, m) => sum + m.content.length, 0) > 100000) {
      return res.status(400).json({ error: '대화 형식이 올바르지 않거나 메시지가 너무 깁니다.' });
    }
    const apiKey = getApiKey();
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      return res.status(503).json({ error: '서버의 OPENAI_API_KEY 환경변수를 설정해 주세요.' });
    }
    try {
      const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: '당신은 친절하고 정확한 AI 도우미입니다. 이전 대화의 맥락을 반영하고, 기본적으로 한국어로 답변하세요. 모르는 내용은 솔직히 말하고, 답변은 이해하기 쉽게 작성하세요.' },
            ...messages.map(({ role, content }) => ({ role, content }))
          ],
          max_completion_tokens: 1500,
          store: false
        })
      });
      if (!response.ok) {
        const status = response.status === 429 ? 429 : 502;
        const error = response.status === 429
          ? 'API 사용 한도 또는 잔액을 확인한 뒤 잠시 후 다시 시도해 주세요.'
          : response.status === 401
            ? '서버의 OpenAI API 키가 유효하지 않습니다. 설정을 확인해 주세요.'
            : 'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
        return res.status(status).json({ error });
      }
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('Empty reply');
      res.json({ reply, truncated: data.choices[0].finish_reason === 'length' });
    } catch (error) {
      const timeout = ['TimeoutError', 'AbortError'].includes(error.name);
      const code = error.cause?.code;
      // Log only error classifications, never credentials or conversation contents.
      console.error('OpenAI connection error:', { name: error.name, code });
      const connectionError = error instanceof TypeError && error.message === 'fetch failed';
      const message = timeout
        ? '응답 시간이 길어졌습니다. 다시 시도해 주세요.'
        : ['EACCES', 'EPERM'].includes(code)
          ? '서버의 외부 네트워크 연결이 차단되었습니다. 로컬 터미널에서 npm.cmd start로 서버를 실행해 주세요.'
          : connectionError
            ? '서버에서 OpenAI에 연결하지 못했습니다. 인터넷 연결과 방화벽 설정을 확인해 주세요.'
            : 'AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      res.status(timeout ? 504 : 502).json({
        error: message
      });
    }
  });
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/api', (req, res) => res.status(404).json({ error: 'API를 찾을 수 없습니다.' }));
  app.use((error, req, res, next) => {
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: '요청 데이터가 너무 크거나 올바른 JSON 형식이 아닙니다.' });
  });
  return app;
}

module.exports = createApp();
module.exports.createApp = createApp;
