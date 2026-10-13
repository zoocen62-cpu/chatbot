# Mini Chat

HTML, CSS, JavaScript + Node.js, Express 기반의 간단한 AI 챗봇입니다. OpenAI `gpt-4o-mini`를 사용합니다.

## 로컬 실행

1. Node.js 22 LTS를 설치합니다.
2. `npm install`을 실행합니다. PowerShell에서 실행 정책 오류가 나면 `npm.cmd install`을 사용하세요.
3. 기존 `.env`에 `OPENAI_API_KEY=실제_API_키`를 설정합니다. `.env.example`을 참고하세요. API 키는 브라우저 코드에 넣지 않습니다.
4. `npm start` (PowerShell: `npm.cmd start`) 실행 후 http://localhost:3000 에 접속합니다.

개발 중 자동 재시작: `npm run dev`. 테스트: `npm test`.

## Vercel 배포

1. `.env`와 `node_modules`를 제외한 프로젝트를 GitHub 저장소에 올립니다.
2. Vercel에서 저장소를 Import합니다. Framework Preset은 **Other**, Build Command와 Output Directory는 별도로 지정하지 않습니다.
3. 프로젝트 Settings → Environment Variables에서 `OPENAI_API_KEY`를 등록합니다. 필요한 Production/Preview 환경을 선택합니다.
4. Deploy합니다. 환경변수를 나중에 변경하면 다시 배포하세요.

`public/` 파일은 정적으로 제공하고, `/api/chat`은 `api/index.js`의 Express 앱으로 연결합니다. 함수 제한은 60초, OpenAI 요청 제한은 45초입니다. 로컬 `.env`는 Vercel에 자동 전달되지 않습니다.

## 대화 기록과 기능

- DB와 서버의 사용자별 저장소를 사용하지 않습니다.
- 브라우저 `sessionStorage`에 최근 20회 질문/답변을 저장합니다. 같은 탭에서 새로고침해도 유지되며 탭을 닫거나 **새 대화**를 누르면 초기화됩니다.
- 질문할 때 최근 20회 대화와 새 질문을 보내 이전 맥락을 반영합니다. 그보다 오래된 대화는 전달하지 않습니다.
- Enter로 전송, Shift+Enter로 줄바꿈, 한국어 IME 입력, 추천 질문, 응답 대기 표시, 실패 시 입력 복구를 지원합니다.
- 사용자 메시지당 6,000자, AI 메시지당 12,000자, 요청 내 대화 총 100,000자로 제한합니다. AI 응답은 일반 텍스트로 표시해 HTML 실행을 방지합니다.
- 인증은 없는 학습용 앱입니다. 공개 배포하면 방문자도 설정된 키로 API를 호출할 수 있고 사용량에 따라 요금이 발생합니다.

## 구조

```text
api/index.js      Express 앱 / OpenAI 호출 / 입력 검증
server.js         로컬 서버
public/           HTML, CSS, 브라우저 JavaScript
test/             서버 테스트 (외부 API 호출 없음)
vercel.json       API 라우팅 / 함수 설정
.env.example      환경변수 예시
```

공식 문서: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Vercel Express](https://vercel.com/docs/frameworks/backend/express).
