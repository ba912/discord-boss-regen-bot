import { checkBossRespawns, getAllBossNextRespawns } from './boss-service.js';
import { sendTextAndVoiceMessage, sendTextMessage } from './message-service.js';
import { formatDate } from '../utils/time-utils.js';

// 텍스트 알림 메시지 템플릿
const TEXT_NOTIFICATION_MESSAGES = {
  // 5분 전 알림
  5: (boss, respawnTime) => {
    return `⚠️ [보스 리젠 알림] ⚠️\n${boss.name}이(가) ${formatDate(respawnTime)}에 리젠됩니다. 아직 5분 남았습니다!`;
  },
  // 1분 전 알림
  1: (boss, respawnTime) => {
    return `🔴 [보스 리젠 임박] 🔴\n${boss.name}이(가) ${formatDate(respawnTime)}에 리젠됩니다. 1분 남았습니다! 준비하세요!`;
  }
};

// 음성 알림 메시지 템플릿 (간결한 형태)
const VOICE_NOTIFICATION_MESSAGES = {
  // 5분 전 알림
  5: (boss) => {
    return `${boss.name} 리젠이 5분 남았습니다.`;
  },
  // 1분 전 알림
  1: (boss) => {
    return `${boss.name} 리젠이 1분 남았습니다.`;
  }
};

/**
 * 보스 리젠 알림을 보내는 함수
 * @returns {Promise<Array>} 보낸 알림 목록
 */
async function sendBossNotifications() {
  try {
    const notifications = checkBossRespawns();
    const sentNotifications = [];
    
    for (const notification of notifications) {
      const { boss, respawnTime, minutesUntil } = notification;
      
      // 텍스트/음성 메시지 템플릿 가져오기
      const textTemplate = TEXT_NOTIFICATION_MESSAGES[minutesUntil];
      const voiceTemplate = VOICE_NOTIFICATION_MESSAGES[minutesUntil];
      
      if (!textTemplate || !voiceTemplate) continue;
      
      // 텍스트와 음성 메시지 생성
      const textMessage = textTemplate(boss, respawnTime);
      const voiceMessage = voiceTemplate(boss);
      
      // 메시지 전송 (텍스트와 음성 따로 전송)
      await sendTextAndVoiceMessage(textMessage, voiceMessage, {
        ttsOptions: {
          lang: 'ko'  // 한국어 TTS 설정
        }
      });
      
      console.log(`보스 ${boss.name}의 ${minutesUntil}분 전 알림이 전송되었습니다.`);
      sentNotifications.push(notification);
    }
    
    return sentNotifications;
  } catch (error) {
    console.error('보스 알림 전송 중 오류:', error);
    return [];
  }
}

/**
 * 모든 보스의 다음 리젠 시간 목록을 메시지로 전송하는 함수
 */
async function sendBossScheduleList() {
  try {
    const respawnList = getAllBossNextRespawns();
    
    if (respawnList.length === 0) {
      await sendTextAndVoiceMessage('등록된 보스가 없습니다.');
      return;
    }
    
    let message = '📅 [보스 리젠 일정] 📅\n\n';
    
    for (const item of respawnList) {
      const { boss, formattedTime, minutesUntil } = item;
      
      let timeInfo;
      if (minutesUntil === null) {
        timeInfo = '마지막 처치 기록 없음';
      } else if (minutesUntil <= 0) {
        timeInfo = '리젠 완료';
      } else {
        const hours = Math.floor(minutesUntil / 60);
        const minutes = minutesUntil % 60;
        timeInfo = `${hours > 0 ? `${hours}시간 ` : ''}${minutes > 0 ? `${minutes}분` : ''} 남음`;
      }
      
      message += `🔹 ${boss.name}: ${formattedTime} (${timeInfo})\n`;
    }
    
    await sendTextAndVoiceMessage(message);
    console.log('보스 일정 목록이 전송되었습니다.');
  } catch (error) {
    console.error('보스 일정 목록 전송 중 오류:', error);
  }
}

/**
 * 보스 리젠 알림 시스템을 주기적으로 실행하는 함수
 * @param {number} intervalMs - 실행 간격 (밀리초)
 * @returns {Object} 타이머 객체
 */
function startBossNotificationSystem(intervalMs = 60000) {
  console.log(`보스 리젠 알림 시스템이 ${intervalMs / 1000}초 간격으로 시작됩니다.`);
  
  // 시작 시 한 번 실행
  sendBossNotifications();
  
  // 주기적으로 실행
  const timer = setInterval(sendBossNotifications, intervalMs);
  return timer;
}

export {
  sendBossNotifications,
  sendBossScheduleList,
  startBossNotificationSystem
};
