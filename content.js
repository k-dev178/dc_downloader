// Content Script - 디씨인사이드 페이지에서 보이스리플 데이터 추출
'use strict';

console.log('디피갤 보플 다운로더 - Content Script Loaded');

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanVoiceReplies') {
    const voiceReplies = extractVoiceReplies();
    sendResponse({ success: true, voiceReplies });
  }
  return true;
});

/**
 * 페이지에서 보이스리플 데이터를 추출
 * 디씨인사이드: iframe 내 voice player 방식
 */
function extractVoiceReplies() {
  const voiceReplies = [];
  
  console.log('=== DC VoiceReply Scanner Started ===');
  console.log('Current URL:', window.location.href);
  
  // 게시글 제목 및 작성자 추출
  const postTitle = getPostTitle();
  const postAuthor = getPostAuthor();
  console.log('Post title:', postTitle);
  console.log('Post author:', postAuthor);
  
  // 보이스리플 정보 수집 (작성자 정보 포함)
  const voiceInfos = [];
  
  // 방법 1: 본문의 voice_wrap에서 찾기 (게시글 작성자)
  const contentArea = document.querySelector('.write_div, .writing_view_box, .view_content_wrap');
  if (contentArea) {
    const voiceWraps = contentArea.querySelectorAll('.voice_wrap');
    voiceWraps.forEach((wrap) => {
      const iframe = wrap.querySelector('iframe');
      if (iframe && iframe.src && iframe.src.includes('voice/player')) {
        try {
          const url = new URL(iframe.src);
          const vrId = url.searchParams.get('vr');
          if (vrId && !voiceInfos.some(v => v.vrId === vrId)) {
            voiceInfos.push({
              vrId: vrId,
              author: postAuthor,
              isComment: false
            });
          }
        } catch (e) {}
      }
    });
  }
  
  // 방법 2: 댓글 영역에서 찾기 (각 댓글 작성자)
  const comments = document.querySelectorAll('.cmt_info, .comment_row, .reply_info, li.ub-content');
  comments.forEach((comment) => {
    const voiceWrap = comment.querySelector('.voice_wrap, iframe[src*="voice"]');
    if (voiceWrap) {
      let iframe = voiceWrap;
      if (voiceWrap.tagName !== 'IFRAME') {
        iframe = voiceWrap.querySelector('iframe');
      }
      
      if (iframe && iframe.src && iframe.src.includes('voice/player')) {
        try {
          const url = new URL(iframe.src);
          const vrId = url.searchParams.get('vr');
          
          if (vrId && !voiceInfos.some(v => v.vrId === vrId)) {
            // 댓글 작성자 찾기
            const authorEl = comment.querySelector('.nickname, .nick, .gall_writer, .user_name, .name em, [data-nick]');
            let author = '';
            if (authorEl) {
              author = authorEl.getAttribute('data-nick') || authorEl.textContent || '';
              author = author.trim();
            }
            
            voiceInfos.push({
              vrId: vrId,
              author: author || '익명',
              isComment: true
            });
          }
        } catch (e) {}
      }
    }
  });
  
  // 방법 3: 전체 페이지에서 놓친 것 찾기
  const allIframes = document.querySelectorAll('iframe[src*="voice/player"]');
  allIframes.forEach((iframe) => {
    try {
      const url = new URL(iframe.src);
      const vrId = url.searchParams.get('vr');
      
      if (vrId && !voiceInfos.some(v => v.vrId === vrId)) {
        // 부모 요소에서 작성자 찾기 시도
        let author = findAuthorFromParent(iframe);
        
        voiceInfos.push({
          vrId: vrId,
          author: author || postAuthor || '익명',
          isComment: false
        });
      }
    } catch (e) {}
  });
  
  // voiceReplies 배열 생성
  const total = voiceInfos.length;
  
  voiceInfos.forEach((info, index) => {
    voiceReplies.push({
      vrId: info.vrId,
      playerUrl: `https://m.dcinside.com/voice/player?vr=${info.vrId}&vr_open=1&type=A`,
      filename: generateFilename(postTitle, info.author, index + 1, total)
    });
    console.log(`Extracted voice ${index + 1}: ID=${info.vrId}, Author=${info.author}`);
  });
  
  console.log(`=== Scan Complete ===`);
  console.log(`Found ${voiceReplies.length} unique voice replies:`, voiceReplies);
  
  return voiceReplies;
}

/**
 * 부모 요소에서 작성자 찾기
 */
function findAuthorFromParent(element) {
  let parent = element.parentElement;
  let depth = 0;
  
  while (parent && depth < 10) {
    const authorEl = parent.querySelector('.nickname, .nick, .gall_writer, .user_name, .name em, [data-nick]');
    if (authorEl) {
      const author = authorEl.getAttribute('data-nick') || authorEl.textContent || '';
      if (author.trim()) {
        return author.trim();
      }
    }
    parent = parent.parentElement;
    depth++;
  }
  
  return '';
}

/**
 * 게시글 제목 추출
 */
function getPostTitle() {
  // 디씨인사이드 게시글 제목 선택자들
  const selectors = [
    '.title_subject',           // 일반 게시판
    '.title_headtext + span',   // 말머리 뒤 제목
    '.view_content_wrap .title',
    '.gallview_head .title',
    'h3.title',
    '.tit_view',
    'meta[property="og:title"]' // 메타 태그
  ];
  
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      let title = '';
      if (selector.includes('meta')) {
        title = el.getAttribute('content') || '';
      } else {
        title = el.textContent || '';
      }
      title = title.trim();
      if (title && title.length > 0) {
        return title;
      }
    }
  }
  
  // document.title에서 추출 시도
  const docTitle = document.title;
  if (docTitle) {
    // " - 디시인사이드" 같은 접미사 제거
    const cleaned = docTitle.replace(/\s*[-|]\s*(디시인사이드|dcinside|갤러리).*$/i, '').trim();
    if (cleaned) {
      return cleaned;
    }
  }
  
  return '보이스리플';
}

/**
 * 게시글 작성자 추출
 */
function getPostAuthor() {
  const selectors = [
    '.gall_writer .nickname',
    '.gall_writer .nick',
    '.gall_writer [data-nick]',
    '.writer_info .nickname',
    '.nickname em',
    '.user_info .name',
    '.view_head .writer',
    'meta[property="article:author"]'
  ];
  
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      let author = '';
      if (selector.includes('meta')) {
        author = el.getAttribute('content') || '';
      } else {
        author = el.getAttribute('data-nick') || el.textContent || '';
      }
      author = author.trim();
      if (author && author.length > 0) {
        return author;
      }
    }
  }
  
  return '';
}

/**
 * 파일명 생성
 */
function generateFilename(title, author, index, total) {
  // 제목에서 파일명에 사용 불가능한 문자 제거
  let safeTitle = title
    .replace(/[\/\\:*?"<>|]/g, '')   // 파일시스템 금지 문자 제거
    .replace(/\s+/g, ' ')             // 연속 공백 정리
    .trim()
    .substring(0, 40);                // 길이 제한
  
  // 작성자 이름 정리
  let safeAuthor = author
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 20);
  
  if (!safeTitle) {
    safeTitle = '보이스리플';
  }
  
  // 파일명 생성
  let filename = safeTitle;
  
  // 작성자가 있으면 추가
  if (safeAuthor) {
    filename += ` by ${safeAuthor}`;
  }
  
  // 여러개면 번호 붙이기
  if (total > 1) {
    filename += `_${index}`;
  }
  
  return `${filename}.mp3`;
}

// 페이지 로드 시 자동 스캔 (선택적)
// window.addEventListener('load', () => {
//   setTimeout(() => {
//     const voiceReplies = extractVoiceReplies();
//     if (voiceReplies.length > 0) {
//       console.log(`Auto-detected ${voiceReplies.length} voice replies`);
//     }
//   }, 2000);
// });
