const form = document.querySelector('#chat-form');
const input = document.querySelector('#input');
const send = document.querySelector('#send');
const reset = document.querySelector('#reset');
const list = document.querySelector('#messages');
const welcome = document.querySelector('#welcome');
const errorBox = document.querySelector('#error');
const storageKey = 'mini-chat-v1';
let history = [];
let busy = false;
try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved) && saved.length <= 40 && saved.length % 2 === 0 &&
    saved.every((m, i) => m && m.role === (i % 2 ? 'assistant' : 'user') && typeof m.content === 'string' && m.content.length <= (i % 2 ? 12000 : 6000))) history = saved;
} catch { /* Storage may be disabled; in-memory conversation still works. */ }

function persist() {
  try { sessionStorage.setItem(storageKey, JSON.stringify(history)); } catch { /* Keep in memory. */ }
}
function addMessage(role, content, pending = false) {
  const item = document.createElement('div');
  item.className = `message ${role}${pending ? ' pending' : ''}`;
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'user' ? '나' : '✳';
  const body = document.createElement('div');
  body.className = 'message-body';
  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = role === 'user' ? '나' : 'Mini Chat';
  const text = document.createElement('div');
  text.className = 'message-text';
  text.textContent = content;
  body.append(label, text);
  item.append(avatar, body);
  list.append(item);
  return item;
}
function resize() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px`; }
function scrollToLatest() { list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }
function render() {
  list.replaceChildren();
  welcome.hidden = history.length > 0;
  history.forEach(m => addMessage(m.role, m.content));
}
render();
input.addEventListener('input', resize);
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  input.value = button.dataset.prompt;
  resize();
  input.focus();
}));
reset.addEventListener('click', () => {
  if (busy) return;
  history = [];
  persist();
  render();
  errorBox.hidden = true;
  input.value = '';
  resize();
  input.focus();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const content = input.value.trim();
  if (busy || !content) return;
  busy = true;
  send.disabled = reset.disabled = input.disabled = true;
  errorBox.hidden = true;
  welcome.hidden = true;
  addMessage('user', content);
  const pending = addMessage('assistant', '함께 생각하고 있어요…', true);
  input.value = '';
  resize();
  scrollToLatest();
  // Keep the latest 20 complete turns; the server is stateless.
  const messages = [...history.slice(-40), { role: 'user', content }];
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(55000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
    if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('답변을 받지 못했습니다. 다시 시도해 주세요.');
    history = [...messages, { role: 'assistant', content: data.reply }].slice(-40);
    persist();
    pending.remove();
    addMessage('assistant', data.reply);
    if (data.truncated) {
      errorBox.textContent = '답변이 길어 일부가 잘렸어요. “이어서 설명해 줘”라고 요청해 주세요.';
      errorBox.hidden = false;
    }
  } catch (error) {
    render();
    input.value = content;
    resize();
    errorBox.textContent = ['TimeoutError', 'AbortError'].includes(error.name)
      ? '응답 시간이 길어졌습니다. 다시 시도해 주세요.'
      : error instanceof TypeError ? '네트워크 연결을 확인한 뒤 다시 시도해 주세요.' : error.message;
    errorBox.hidden = false;
  } finally {
    busy = false;
    send.disabled = reset.disabled = input.disabled = false;
    input.focus({ preventScroll: true });
    scrollToLatest();
  }
});
