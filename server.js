const app = require('./api');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AI 챗봇: http://localhost:${port}`));
