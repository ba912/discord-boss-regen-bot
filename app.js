import 'dotenv/config';
import express from 'express';
import { verifyKeyMiddleware } from 'discord-interactions';

// 모듈 가져오기
import { client, setupClientReadyEvent, login } from './src/discord/client.js';
import { connectToVoiceChannel } from './src/discord/voice.js';
import { setupMessageHandler } from './src/services/message-service.js';
import { startBossNotificationSystem } from './src/services/boss-notification-service.js';
import { setupShutdownHandlers } from './src/utils/shutdown.js';

// Express 앱 생성
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * 앱 초기화 함수
 */
async function initializeApp() {
  try {
    // Graceful Shutdown 핸들러 설정
    setupShutdownHandlers();

    // 서버 시작 전에 실행할 코드
    async function init() {
      console.log('서버 초기화 중...');

      // 디스코드 봇 초기화
      setupClientReadyEvent(async () => {
        console.log('디스코드 봇이 준비되었습니다!');
        
        // 음성 채널에 연결
        try {
          await connectToVoiceChannel(client);
          console.log('음성 채널에 성공적으로 연결되었습니다.');
        } catch (error) {
          console.error('음성 채널 연결 중 오류:', error);
        }
        
        // 메시지 핸들러 설정 (!PREFIX 명령어 처리)
        setupMessageHandler();
        console.log('! 기반 메시지 명령어 처리기 설정 완료');
        
        // 보스 알림 시스템 시작
        await startBossNotificationSystem();
      });
      
      // 디스코드 로그인
      await login();
    }

    await init();

    // Express 서버 설정
    setupExpressServer();
    
    console.log('애플리케이션이 성공적으로 초기화되었습니다.');
  } catch (error) {
    console.error('애플리케이션 초기화 중 오류 발생:', error);
    process.exit(1);
  }
}

/**
 * Express 서버 설정 함수
 */
function setupExpressServer() {
  // 상호작용 엔드포인트 설정 (슬래시 명령어 등)
  app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), (req, res) => {
    // 상호작용 처리 로직 (필요한 경우)
    res.status(200).send({ type: 1 }); // Type 1 = PONG
  });
  
  // 서버 시작
  app.listen(PORT, () => {
    console.log(`Express 서버가 포트 ${PORT}에서 시작되었습니다`);
  });
}

// 앱 초기화 실행
initializeApp();
