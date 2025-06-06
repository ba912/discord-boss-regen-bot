/**
 * 음성 메시지 대기열 관리 시스템
 * 동시에 여러 음성 메시지 요청이 들어올 경우, 순차적으로 처리하기 위한 모듈
 */

// 대기열 및 상태 관리
const voiceQueue = [];
let isPlaying = false;

/**
 * 음성 메시지를 대기열에 추가
 * @param {string} message - 재생할 메시지
 * @param {Object} options - TTS 옵션
 * @param {Function} playFunction - 실제 음성을 재생하는 함수
 * @returns {Promise<void>}
 */
export function queueVoiceMessage(message, options, playFunction) {
  return new Promise((resolve, reject) => {
    // 대기열에 추가
    voiceQueue.push({
      message,
      options,
      playFunction,
      resolve,
      reject
    });
    
    console.log(`[음성 대기열] 메시지 추가됨: "${message}" (현재 대기열 길이: ${voiceQueue.length})`);
    
    // 현재 재생 중이 아니면 재생 시작
    if (!isPlaying) {
      processNextInQueue();
    }
  });
}

/**
 * 대기열에서 다음 메시지를 처리
 * @private
 */
function processNextInQueue() {
  if (voiceQueue.length === 0) {
    isPlaying = false;
    return;
  }
  
  isPlaying = true;
  const item = voiceQueue.shift();
  
  console.log(`[음성 대기열] 메시지 재생 중: "${item.message}" (남은 대기열: ${voiceQueue.length})`);
  
  // 메시지 재생
  item.playFunction(item.message, item.options)
    .then(result => {
      // 성공 콜백 호출
      item.resolve(result);
      
      // 약간의 대기 시간 후 다음 메시지 처리 (한 메시지가 끝나고 다음 메시지 사이의 쉼 시간)
      setTimeout(() => {
        processNextInQueue();
      }, 500);
    })
    .catch(error => {
      // 실패 콜백 호출
      console.error(`[음성 대기열] 오류 발생: ${error.message}`);
      item.reject(error);
      
      // 오류가 발생해도 다음 메시지는 계속 처리
      setTimeout(() => {
        processNextInQueue();
      }, 500);
    });
}

/**
 * 현재 대기열 상태 정보
 * @returns {Object} 대기열 상태 정보
 */
export function getQueueStatus() {
  return {
    isPlaying,
    queueLength: voiceQueue.length,
    currentMessage: isPlaying && voiceQueue.length > 0 ? voiceQueue[0].message : null
  };
}

/**
 * 대기열 초기화 (모든 대기 중인 메시지 취소)
 */
export function clearQueue() {
  const canceledCount = voiceQueue.length;
  
  // 대기 중인 모든 항목에 대해 reject 호출
  voiceQueue.forEach(item => {
    item.reject(new Error('대기열이 초기화되었습니다.'));
  });
  
  // 대기열 비우기
  voiceQueue.length = 0;
  
  console.log(`[음성 대기열] 초기화됨 (취소된 메시지: ${canceledCount}개)`);
  
  return canceledCount;
}
