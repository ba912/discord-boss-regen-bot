import { checkBossRespawns, getAllBossNextRespawns, checkOverdueFixedHourBosses } from './boss-service.js';
import { sendTextAndVoiceMessage, sendTextMessage, sendTextMessageWithButtons } from './message-service.js';
import { formatDate } from '../utils/time-utils.js';
import { ButtonStyle } from 'discord.js';

// 텍스트 알림 메시지 템플릿
const TEXT_NOTIFICATION_MESSAGES = {
  // 5분 전 알림
  5: (boss, respawnTime) => {
    return `${boss.name} 5분전`;
  },
  // 1분 전 알림
  1: (boss, respawnTime) => {
    return `${boss.name} 1분전 \n`;
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
    console.log('보스 리젠 알림 스케줄러 시작');
    const notifications = checkBossRespawns();
    const sentNotifications = [];
    
    for (const notification of notifications) {
      const { boss, respawnTime, minutesUntil } = notification;
      
      // 텍스트/음성 메시지 템플릿 가져오기
      const textTemplate = TEXT_NOTIFICATION_MESSAGES[minutesUntil];
      const voiceTemplate = VOICE_NOTIFICATION_MESSAGES[minutesUntil];
      
      if (!voiceTemplate) continue;
      
      const voiceMessage = voiceTemplate(boss);
      
      if (minutesUntil === 1) {
        if (!textTemplate) continue;
        // 버튼을 노출하지 않을 보스 ID 목록
        const excludeButtonBossIds = [56, 57, 58, 59, 60, 61, 62];
        const shouldShowButton = !excludeButtonBossIds.includes(boss.id);
        const textMessage = textTemplate(boss, respawnTime);
        if (shouldShowButton) {
          const buttons = [
            {
              customId: `boss_kill_${boss.name}`,
              label: '컷',
              style: ButtonStyle.Primary
            }
          ];
          await sendTextMessageWithButtons(textMessage, buttons);
        } else {
          await sendTextMessage(textMessage);
        }
        // 음성 메시지는 별도로 전송
        await sendTextAndVoiceMessage(null, voiceMessage, {
          ttsOptions: {
            lang: 'ko'
          }
        });
      } else if (minutesUntil === 5) {
        if (!textTemplate) continue;
        const textMessage = textTemplate(boss, respawnTime);
        await sendTextMessage(textMessage);
        await sendTextAndVoiceMessage(null, voiceMessage, {
          ttsOptions: {
            lang: 'ko'
          }
        });
      }
      // 기타 알림은 무시
      
      console.log(`보스 ${boss.name}의 ${minutesUntil}분 전 알림이 전송되었습니다.`);
      sentNotifications.push(notification);
    }
    
    console.log('보스 리젠 알림 스케줄러 종료');
    
    return sentNotifications;
  } catch (error) {
    console.error('보스 알림 전송 중 오류:', error);
    return [];
  }
}

/**
 * 지연된 fixed_hour 보스 알림을 보내는 함수
 * @returns {Promise<Array>} 보낸 알림 목록
 */
async function sendOverdueBossNotifications() {
  try {
    console.log('지연된 보스 알림 확인 시작...');
    const overdueBosses = checkOverdueFixedHourBosses();
    console.log(`지연된 보스 수: ${overdueBosses.length}`);
    
    const sentNotifications = [];
    
    for (const overdueBoss of overdueBosses) {
      const { boss, expectedRespawnTime, minutesOverdue, lastKilledTime } = overdueBoss;
      
      // 간결한 텍스트 메시지 생성
      const textMessage = `‼️‼️‼️ ${boss.name} 컷타임 확인해주세요. 젠되고 ${minutesOverdue}분 지났습니다.`;
      
      // 텍스트 메시지만 전송
      console.log(`지연 알림 전송 시도: ${textMessage}`);
      const result = await sendTextMessage(textMessage);
      console.log(`지연 알림 전송 결과: ${result}`);
      
      if (result) {
        sentNotifications.push(overdueBoss);
        console.log(`보스 ${boss.name}의 지연 알림이 성공적으로 전송되었습니다. (${minutesOverdue}분 지연)`);
      } else {
        console.error(`보스 ${boss.name}의 지연 알림 전송 실패`);
      }
    }
    
    console.log(`총 ${sentNotifications.length}개의 지연 알림이 전송되었습니다.`);
    return sentNotifications;
  } catch (error) {
    console.error('지연된 보스 알림 전송 중 오류:', error);
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

// 전역 타이머 변수
let bossNotificationTimer = null;
let overdueBossTimer = null;

/**
 * 보스 리젠 알림 시스템을 주기적으로 실행하는 함수
 * @param {number} intervalMs - 실행 간격 (밀리초)
 * @returns {Object} 타이머 객체들
 */
function startBossNotificationSystem(intervalMs = 60000) {
  console.log(`보스 리젠 알림 시스템이 ${intervalMs / 1000}초 간격으로 시작됩니다.`);
  
  // 시작 시 한 번 실행
  sendBossNotifications();
  
  // 주기적으로 실행 (1분마다)
  bossNotificationTimer = setInterval(sendBossNotifications, intervalMs);
  
  // 지연된 보스 알림은 10분마다 실행
  console.log('지연된 보스 알림 시스템이 10분 간격으로 시작됩니다.');
  
  // 시작 시 한 번 실행
  sendOverdueBossNotifications();
  
  // 10분마다 실행 (600000ms = 10분)
  overdueBossTimer = setInterval(sendOverdueBossNotifications, 600000);
  
  return { timer: bossNotificationTimer, overdueTimer: overdueBossTimer };
}

/**
 * 보스 알림 시스템을 정리하는 함수
 */
function stopBossNotificationSystem() {
  if (bossNotificationTimer) {
    clearInterval(bossNotificationTimer);
    bossNotificationTimer = null;
    console.log('보스 리젠 알림 타이머가 정리되었습니다.');
  }
  
  if (overdueBossTimer) {
    clearInterval(overdueBossTimer);
    overdueBossTimer = null;
    console.log('지연된 보스 알림 타이머가 정리되었습니다.');
  }
}

export {
  sendBossNotifications,
  sendBossScheduleList,
  startBossNotificationSystem,
  sendOverdueBossNotifications,
  stopBossNotificationSystem
};
