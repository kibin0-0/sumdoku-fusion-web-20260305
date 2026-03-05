# JLPT 漢字 Dialogue Lab

JLPT N1/N2 수준의 한자가 포함된 대화문을 통해 문장+한자를 동시에 학습하는 정적 웹앱입니다.

## 주요 기능

- N1/N2 레벨 필터
- 후리가나 on/off
- 한국어 번역 on/off
- 핵심 한자 사전(읽기/뜻/예문)
- 학습 완료 체크(localStorage 저장)
- 미니 뜻 맞추기 퀴즈

## 로컬 실행

```powershell
npx.cmd --yes serve .
```

또는

```powershell
python -m http.server 5173
```

브라우저에서 `http://localhost:3000` 또는 `http://localhost:5173` 접속.

## 배포

정적 사이트이므로 GitHub 푸시 후 Vercel에서 자동 배포됩니다.
