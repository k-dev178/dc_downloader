// Popup UI 로직
'use strict';

let voiceReplies = [];

document.addEventListener('DOMContentLoaded', async () => {
  const scanBtn = document.getElementById('scan-btn');
  const downloadBtn = document.getElementById('download-btn');
  const status = document.getElementById('status');
  const foundCount = document.getElementById('found-count');
  const count = document.getElementById('count');
  
  // 현재 탭 확인
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url || !tab.url.includes('dcinside.com')) {
    status.textContent = '⚠️ 디씨인사이드 페이지에서만 사용할 수 있습니다.';
    scanBtn.disabled = true;
    return;
  }
  
  status.textContent = '✅ 디씨인사이드 페이지 감지됨';
  
  // 스캔 버튼 클릭
  scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    scanBtn.textContent = '스캔 중...';
    status.textContent = '페이지를 분석하고 있습니다...';
    
    try {
      // Content script 주입 시도 (이미 있으면 무시됨)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (injectError) {
        console.log('Script injection:', injectError.message);
      }
      
      // 약간의 딜레이 후 메시지 전송
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Content script에 메시지 전송
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanVoiceReplies' });
      
      if (response && response.success) {
        voiceReplies = response.voiceReplies;
        count.textContent = voiceReplies.length;
        foundCount.classList.remove('hidden');
        
        if (voiceReplies.length > 0) {
          status.textContent = `✅ ${voiceReplies.length}개의 보이스리플을 발견했습니다!`;
          downloadBtn.classList.remove('hidden');
          downloadBtn.disabled = false;
        } else {
          status.textContent = '❌ 이 페이지에는 보이스리플이 없습니다.';
        }
      } else {
        status.textContent = '❌ 스캔 중 오류가 발생했습니다.';
      }
    } catch (error) {
      console.error('Scan error:', error);
      // 페이지 새로고침 안내
      if (error.message.includes('Receiving end does not exist')) {
        status.textContent = '⚠️ 페이지를 새로고침(F5) 후 다시 시도하세요.';
      } else {
        status.textContent = '❌ 스캔 실패: ' + error.message;
      }
    }
    
    scanBtn.disabled = false;
    scanBtn.textContent = '다시 스캔';
  });
  
  // 다운로드 버튼 클릭
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    scanBtn.disabled = true;
    
    const progressSection = document.getElementById('progress-section');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const logSection = document.getElementById('log-section');
    const logContainer = document.getElementById('log-container');
    
    progressSection.classList.remove('hidden');
    logSection.classList.remove('hidden');
    logContainer.innerHTML = '';
    
    let downloaded = 0;
    const total = voiceReplies.length;
    
    for (let i = 0; i < voiceReplies.length; i++) {
      const vr = voiceReplies[i];
      
      try {
        // Background script로 다운로드 요청 (새 방식)
        const result = await chrome.runtime.sendMessage({
          action: 'downloadVoice',
          vrId: vr.vrId,
          playerUrl: vr.playerUrl,
          filename: vr.filename
        });
        
        if (result.success) {
          downloaded++;
          const logItem = document.createElement('div');
          logItem.className = 'log-item log-success';
          logItem.textContent = `✓ ${vr.filename}`;
          logContainer.appendChild(logItem);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
        
      } catch (error) {
        console.error('Download error:', error);
        const logItem = document.createElement('div');
        logItem.className = 'log-item log-error';
        logItem.textContent = `✗ ${vr.filename} - ${error.message || '실패'}`;
        logContainer.appendChild(logItem);
      }
      
      // 진행률 업데이트
      const progress = Math.round(((i + 1) / total) * 100);
      progressFill.style.width = progress + '%';
      progressText.textContent = `${i + 1} / ${total}`;
      
      // 로그 스크롤
      logContainer.scrollTop = logContainer.scrollHeight;
      
      // 다운로드 간격 (서버 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    status.textContent = `✅ 다운로드 완료! (${downloaded}/${total})`;
    downloadBtn.textContent = '다운로드 완료';
  });
});
