import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendTextAndVoiceMessage, sendTextMessage } from './message-service.js';
import { formatDate } from '../utils/time-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_BOSSES_FILE = path.join(__dirname, '../../data/test-bosses.json');

/**
 * 테스트 보스 데이터 불러오기
 * @returns {Array} 테스트 보스 목록
 */
function loadTestBosses() {
  try {
    if (fs.existsSync(TEST_BOSSES_FILE)) {
      const rawData = fs.readFileSync(TEST_BOSSES_FILE, 'utf8');
      const data = JSON.parse(rawData);
      return data.bosses || [];
    } else {
      console.error('테스트 보스 파일이 존재하지 않습니다:', TEST_BOSSES_FILE);
      return [];
    }
  } catch (error) {
    console.error('테스트 보스 데이터 로드 중 오류:', error);
    return [];
  }
}

/**
 * 테스트 알림 메시지 템플릿 (텍스트용)
 */
const TEXT_NOTIFICATION_MESSAGES = {
  5: (boss) => {
    const now = new Date();
    const respawnTime = new Date(now.getTime() + 5 * 60 * 1000); // 5분 후
    return `⚠️ [보스 리젠 알림] ⚠️\n${boss.name}이(가) ${formatDate(respawnTime)}에 리젠됩니다. 아직 5분 남았습니다!`;
  },
  1: (boss) => {
    const now = new Date();
    const respawnTime = new Date(now.getTime() + 1 * 60 * 1000); // 1분 후
    return `🔴 [보스 리젠 임박] 🔴\n${boss.name}이(가) ${formatDate(respawnTime)}에 리젠됩니다. 1분 남았습니다! 준비하세요!`;
  }
};

/**
 * 테스트 알림 메시지 템플릿 (음성용)
 */
const VOICE_NOTIFICATION_MESSAGES = {
  5: (boss) => {
    return `${boss.name} 리젠이 5분 남았습니다.`;
  },
  1: (boss) => {
    return `${boss.name} 리젠이 1분 남았습니다.`;
  }
};

/**
 * 테스트 알림 실행
 */
async function runTestNotifications() {
  try {
    console.log('테스트 알림 시작...');
    
    // 테스트 보스 데이터 불러오기
    const testBosses = loadTestBosses();
    
    if (testBosses.length === 0) {
      await sendTextMessage('테스트 보스 데이터가 없습니다. data/test-bosses.json 파일을 확인해주세요.');
      return;
    }
    
    // 각 테스트 보스에 대한 알림 전송
    for (const boss of testBosses) {
      const minutesUntil = boss.minutesUntil;
      
      // 텍스트 템플릿 및 음성 템플릿 가져오기
      const textTemplate = TEXT_NOTIFICATION_MESSAGES[minutesUntil];
      const voiceTemplate = VOICE_NOTIFICATION_MESSAGES[minutesUntil];
      
      if (!textTemplate || !voiceTemplate) {
        console.error(`${minutesUntil}분 템플릿이 없습니다.`);
        continue;
      }
      
      // 텍스트 및 음성 메시지 생성
      const textMessage = textTemplate(boss);
      const voiceMessage = voiceTemplate(boss);
      
      console.log(`테스트 알림 전송: ${boss.name}, ${minutesUntil}분`);
      console.log(`- 텍스트: ${textMessage}`);
      console.log(`- 음성: ${voiceMessage}`);
      
      // 1초 대기 후 알림 전송 (연속 전송 방지)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 메시지 전송
      await sendTextAndVoiceMessage(textMessage, voiceMessage, {
        ttsOptions: { lang: 'ko' }
      });
    }
    
    return true;
  } catch (error) {
    console.error('테스트 실행 중 오류:', error);
    await sendTextMessage('❌ 테스트 중 오류가 발생했습니다.');
    return false;
  }
}

export { runTestNotifications };
