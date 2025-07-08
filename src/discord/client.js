import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

// Discord.js 클라이언트 생성 - 필요한 인텐트 설정 및 디버그 옵션 추가
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // 메시지 내용 읽기 인텐트 추가 (슬래시 명령어 동작에 필수)
    GatewayIntentBits.GuildVoiceStates, // 음성 채널 사용을 위한 인텐트 추가
    GatewayIntentBits.DirectMessages, // DM 메시지 접근 허용
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: ['CHANNEL'], // 부분적 객체 활성화
  rest: { timeout: 60000 }, // REST 타임아웃 증가
  failIfNotExists: false, // 존재하지 않는 항목에 대한 오류 방지
  retryLimit: 5 // 재시도 횟수 증가
});

/**
 * Discord.js 클라이언트 준비 이벤트 핸들러 설정
 * @param {Function} callback - 클라이언트가 준비되었을 때 실행할 콜백 함수
 */
function setupClientReadyEvent(callback) {
  client.once('ready', async () => {
    console.log(`Discord 봇이 준비되었습니다: ${client.user.tag}`);
    if (callback && typeof callback === 'function') {
      await callback();
    }
  });
}

/**
 * Discord 클라이언트 로그인
 * @returns {Promise} - 로그인 프로미스
 */
function login() {
  return client.login(process.env.DISCORD_TOKEN)
    .catch(error => {
      console.error('Discord 로그인 실패:', error);
      throw error;
    });
}

export { client, setupClientReadyEvent, login };
