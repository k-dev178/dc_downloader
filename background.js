// Background Service Worker - 다운로드 처리
'use strict';

console.log('디피갤 보플 다운로더 - Background Service Worker Started');

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadVoice') {
    downloadVoice(request.vrId, request.playerUrl, request.filename)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 비동기 응답을 위해 true 반환
  }
  
  if (request.action === 'downloadFile') {
    downloadFile(request.url, request.filename)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * 보이스리플 다운로드 - player 페이지에서 실제 audio URL 추출
 */
async function downloadVoice(vrId, playerUrl, filename) {
  try {
    // 입력 검증
    if (!vrId || typeof vrId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(vrId)) {
      throw new Error('Invalid voice reply ID');
    }
    
    console.log(`Original filename from content script: ${filename}`);
    
    // 파일명 sanitize
    filename = sanitizeFilename(filename);
    
    console.log(`Sanitized filename: ${filename}`);
    
    // voice_open()과 동일한 방식으로 실제 플레이어 HTML 요청
    // /voice/player?vr=xxx&vr_open=1&type=A
    const openPlayerUrl = `https://m.dcinside.com/voice/player?vr=${vrId}&vr_open=1&type=A`;
    
    console.log(`Fetching opened player: ${openPlayerUrl}`);
    
    // 1. 실제 플레이어 HTML 가져오기
    const response = await fetch(openPlayerUrl, {
      credentials: 'include',
      headers: {
        'Referer': 'https://m.dcinside.com/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch player: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('Player HTML received, length:', html.length);
    console.log('HTML preview:', html.substring(0, 500));
    
    // 2. HTML에서 audio src 추출
    // 패턴: value="https://vr.dcinside.com/viewvoice.php?con_key=...&vr_path=..."
    // 또는 input hidden에 있을 수 있음
    
    let audioUrl = null;
    
    // 패턴 1: viewvoice.php URL 직접 찾기
    const viewvoiceMatch = html.match(/https:\/\/vr\.dcinside\.com\/viewvoice\.php\?[^'"<>\s]+/);
    if (viewvoiceMatch) {
      audioUrl = viewvoiceMatch[0];
      console.log('Found viewvoice URL:', audioUrl);
    }
    
    // 패턴 2: input value에서 찾기
    if (!audioUrl) {
      const inputMatch = html.match(/value\s*=\s*["']([^"']*viewvoice\.php[^"']*)/);
      if (inputMatch) {
        audioUrl = inputMatch[1];
        console.log('Found in input value:', audioUrl);
      }
    }
    
    // 패턴 3: audiofile_ ID를 가진 input
    if (!audioUrl) {
      const audioFileMatch = html.match(/id\s*=\s*["']audiofile_[^"']*["'][^>]*value\s*=\s*["']([^"']+)/);
      if (audioFileMatch) {
        audioUrl = audioFileMatch[1];
        console.log('Found audiofile input:', audioUrl);
      }
    }
    
    // 패턴 4: value가 먼저 오는 경우
    if (!audioUrl) {
      const valueFirstMatch = html.match(/value\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*id\s*=\s*["']audiofile_/);
      if (valueFirstMatch) {
        audioUrl = valueFirstMatch[1];
        console.log('Found value-first pattern:', audioUrl);
      }
    }
    
    if (!audioUrl) {
      console.error('Full HTML:', html);
      throw new Error('Audio URL not found in player HTML');
    }
    
    // HTML 엔티티 디코딩
    audioUrl = audioUrl.replace(/&amp;/g, '&');
    
    console.log('Final audio URL:', audioUrl);
    
    // 3. 실제 파일 다운로드
    return await downloadFile(audioUrl, filename);
    
  } catch (error) {
    console.error('Download voice error:', error);
    throw error;
  }
}

/**
 * 파일 다운로드 함수 - fetch로 받아서 mp3로 저장
 */
async function downloadFile(url, filename) {
  try {
    // 확장자를 mp3로 변경
    filename = filename.replace(/\.(m4a|mp4)$/i, '.mp3');
    
    console.log(`Fetching audio: ${url}`);
    
    // fetch로 파일 데이터 가져오기
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Referer': 'https://m.dcinside.com/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    
    // ArrayBuffer로 변환 후 Base64로 인코딩
    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    
    console.log(`Fetched audio: ${arrayBuffer.byteLength} bytes`);
    
    // Data URL 생성 (audio/mpeg으로 설정)
    const dataUrl = `data:audio/mpeg;base64,${base64}`;
    
    // Chrome Downloads API로 다운로드
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: `dc_voice/${filename}`,
      conflictAction: 'uniquify',
      saveAs: false
    });
    
    console.log(`Download started: ${downloadId}`);
    
    return new Promise((resolve, reject) => {
      const listener = (delta) => {
        if (delta.id === downloadId) {
          if (delta.state && delta.state.current === 'complete') {
            chrome.downloads.onChanged.removeListener(listener);
            console.log(`Download completed: ${filename}`);
            resolve({ downloadId });
          } else if (delta.state && delta.state.current === 'interrupted') {
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error(`Download interrupted: ${filename}`));
          } else if (delta.error) {
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error(`Download error: ${delta.error.current}`));
          }
        }
      };
      
      chrome.downloads.onChanged.addListener(listener);
      
      // 타임아웃 (30초)
      setTimeout(() => {
        chrome.downloads.onChanged.removeListener(listener);
        resolve({ downloadId });
      }, 30000);
    });
    
  } catch (error) {
    console.error(`Download failed: ${filename}`, error);
    throw error;
  }
}

/**
 * ArrayBuffer를 Base64 문자열로 변환
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 파일명 sanitize - 위험한 문자 제거
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'dc_voice_unknown.mp3';
  }
  // 경로 탐색 방지, 특수문자 제거
  return filename
    .replace(/\.\.\//g, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/^\./g, '_')
    .substring(0, 200); // 파일명 길이 제한
}

// Extension 설치/업데이트 시
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});
