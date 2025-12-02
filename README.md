# DC 보이스리플 다운로더

디씨인사이드 게시판의 보이스리플(보플)을 일괄 다운로드하는 Chrome Extension입니다.

## 기능

- 🎙️ 현재 페이지의 모든 보이스리플 자동 감지
- 📥 한 번의 클릭으로 전체 다운로드
- 📊 다운로드 진행상황 실시간 표시
- 📝 다운로드 로그 확인

## 설치 방법

### 1. 소스코드 다운로드
이 저장소를 클론하거나 ZIP으로 다운로드합니다.

```bash
git clone [repository-url]
cd dc
```

### 2. Chrome Extension 개발자 모드로 설치

1. Chrome 브라우저를 엽니다
2. 주소창에 `chrome://extensions/` 입력
3. 오른쪽 상단의 "개발자 모드" 토글을 활성화
4. "압축해제된 확장 프로그램을 로드합니다" 클릭
5. 이 프로젝트 폴더(`dc`)를 선택

### 3. 아이콘 추가 (선택사항)

현재 아이콘 파일이 없어서 경고가 표시될 수 있습니다. 
`icons/` 폴더에 다음 크기의 PNG 이미지를 추가하세요:
- icon16.png (16x16)
- icon48.png (48x48)
- icon128.png (128x128)

또는 임시로 manifest.json에서 icons 부분을 주석 처리할 수 있습니다.

## 사용 방법

1. 디씨인사이드 게시판 페이지로 이동합니다
2. Chrome 툴바에서 확장 프로그램 아이콘을 클릭합니다
3. "보플 스캔" 버튼을 클릭합니다
4. 발견된 보이스리플 개수가 표시됩니다
5. "전체 다운로드" 버튼을 클릭합니다
6. 다운로드는 `다운로드/dc_voice/` 폴더에 저장됩니다

## 파일 구조

```
dc/
├── manifest.json          # Extension 설정 파일
├── popup.html            # 팝업 UI HTML
├── popup.css             # 팝업 UI 스타일
├── popup.js              # 팝업 UI 로직
├── content.js            # 페이지 분석 스크립트
├── background.js         # 다운로드 처리 스크립트
├── icons/                # 아이콘 폴더 (생성 필요)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # 이 파일
```

## 기술 스택

- Chrome Extension Manifest V3
- Vanilla JavaScript (No frameworks)
- Chrome APIs:
  - `chrome.downloads` - 파일 다운로드
  - `chrome.tabs` - 탭 정보 조회
  - `chrome.runtime` - 메시지 통신

## 주의사항

⚠️ **중요**: 이 확장 프로그램은 디씨인사이드의 실제 DOM 구조에 맞춰 `content.js`를 수정해야 합니다.

현재 코드는 일반적인 패턴을 기반으로 작성되었으며, 실제 사이트에서 테스트 후 다음을 조정해야 할 수 있습니다:

- 보이스리플 요소의 정확한 선택자(selector)
- 보이스리플 URL 추출 방식
- 파일명 생성 로직

## 디버깅

1. `chrome://extensions/`에서 확장 프로그램의 "상세정보" 클릭
2. "배경 페이지 검사" 또는 "Service Worker" 클릭하여 콘솔 확인
3. 팝업 UI: 팝업을 열고 마우스 우클릭 > "검사"
4. Content Script: 디씨인사이드 페이지에서 F12 > Console 탭

## 문제 해결

### 보이스리플이 감지되지 않음
- `content.js`의 선택자를 디씨인사이드 실제 구조에 맞게 수정
- 브라우저 콘솔에서 에러 메시지 확인

### 다운로드 실패
- 다운로드 권한 확인
- CORS 정책으로 인한 실패일 경우 background.js에서 fetch 후 Blob으로 변환 필요

### Extension 로드 오류
- manifest.json 문법 확인
- 모든 파일이 올바른 위치에 있는지 확인

## 라이선스

MIT License

## 개발자

개인 프로젝트로 제작되었습니다.
