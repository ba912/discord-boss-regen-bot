import fs from 'fs';
import { client } from '../discord/client.js';
import { disconnectVoiceChannel } from '../discord/voice.js';

/**
 * Graceful Shutdown 처리
 * 프로세스가 종료될 때 필요한 정리 작업을 수행하는 함수
 */
async function performGracefulShutdown() {
  console.log('프로그램이 종료됩니다. 리소스 정리 중...');
  
  // 음성 채널 연결 종료
  disconnectVoiceChannel();
  
  // Discord 클라이언트 정리
  if (client && client.isReady()) {
    try {
      await client.destroy();
      console.log('Discord 클라이언트를 안전하게 종료했습니다.');
    } catch (error) {
      console.error('Discord 클라이언트 종료 중 오류:', error);
    }
  }
  
  console.log('프로그램이 안전하게 종료되었습니다.');
  // 지연 후 종료 (async 함수의 완료 보장)
  setTimeout(() => process.exit(0), 1000);
}

/**
 * 종료 시그널 처리기 설정
 */
function setupShutdownHandlers() {
  // 프로세스 종료 시그널 이벤트 처리
  process.on('SIGINT', performGracefulShutdown);  // Ctrl+C
  process.on('SIGTERM', performGracefulShutdown); // 도커 컨테이너 종료 등

  // 예상하지 못한 오류 처리
  process.on('uncaughtException', (error) => {
    console.error('예상하지 못한 예외 발생:', error);
    performGracefulShutdown();
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('처리되지 않은 약속 거부:', reason);
    performGracefulShutdown();
  });
  
  console.log('Graceful shutdown 핸들러가 설정되었습니다.');
}

export { performGracefulShutdown, setupShutdownHandlers };
