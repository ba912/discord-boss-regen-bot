import { TextChannel, ChannelType } from 'discord.js';
import { generateTTSAudio } from '../tts/tts-service.js';
import { playAudio } from '../discord/voice.js';
import { client } from '../discord/client.js';
import { processBossCommand } from './boss-command-service.js';

/**
 * 텍스트 메시지만 보내는 함수 (명령어 응답용)
 * @param {string} message - 보낼 메시지 내용
 * @returns {Promise<boolean>} - 성공 여부
 */
async function sendTextMessage(message) {
  try {
    // 채널 ID 확인
    const channelId = process.env.CHANNEL_ID;
    if (!channelId) {
      console.error('CHANNEL_ID가 .env 파일에 설정되어 있지 않습니다.');
      return false;
    }
    
    // 채널 가져오기
    const textChannel = await client.channels.fetch(channelId);
    if (textChannel && textChannel.type === ChannelType.GuildText) {
      await textChannel.send({
        content: message
      });
      console.log('텍스트 메시지가 전송되었습니다.');
      return true;
    } else {
      console.error('유효한 텍스트 채널을 찾을 수 없습니다.');
      return false;
    }
  } catch (error) {
    console.error('텍스트 메시지 전송 중 오류:', error);
    return false;
  }
}

/**
 * 음성 메시지만 재생하는 함수
 * @param {string} message - 재생할 음성 메시지 내용
 * @param {Object} options - TTS 옵션 (선택사항)
 * @returns {Promise<boolean>} - 성공 여부
 */
async function playVoiceMessage(message, options = {}) {
  try {
    // 기본 TTS 옵션
    const ttsOptions = {
      lang: 'ko-KR',  // 기본 한국어 여성 음성
      ...options
    };
    
    // TTS 음성 파일 생성
    const audioFilePath = await generateTTSAudio(message, ttsOptions);
    
    // 음성 재생
    await playAudio(audioFilePath);
    console.log('음성 메시지가 재생되었습니다.');
    
    return true;
  } catch (error) {
    console.error('음성 메시지 재생 중 오류:', error);
    return false;
  } finally {
    // 명시적으로 임시 파일 정리 시도
    if (audioFilePath) {
      import('../tts/tts-service.js').then(({ cleanupTTSFile }) => {
        setTimeout(() => cleanupTTSFile(audioFilePath), 2000); // 재생 완료 후 2초 뒤 파일 삭제 시도
      });
    }
  }
}

/**
 * 텍스트 메시지와 음성 메시지를 동시에 보내는 함수
 * @param {string} message - 보낼 메시지 내용
 * @param {Object} options - 메시지 옵션 (선택사항)
 * @returns {Promise<boolean>} - 성공 여부
 */
async function sendTextAndVoiceMessage(textMessage, voiceMessage = null, options = {}) {
  try {
    // 텍스트 메시지 전송
    await sendTextMessage(textMessage);
    
    // 음성 메시지가 별도로 지정되지 않은 경우 텍스트 메시지를 음성으로 사용
    if (voiceMessage === null) {
      // 음성 메시지를 지정하지 않았으니 텍스트를 재생하지 않음
      return true;
    }
    
    // 음성 메시지 재생
    await playVoiceMessage(voiceMessage, options.ttsOptions);
    
    return true;
  } catch (error) {
    console.error('메시지 전송 중 오류:', error);
    return false;
  }
}

/**
 * 주기적으로 메시지를 보내는 타이머를 시작하는 함수
 * @param {Function} messageCallback - 메시지 내용을 생성하는 콜백 함수
 * @param {number} intervalMs - 메시지 전송 간격 (밀리초)
 */
function startPeriodicMessages(messageCallback, intervalMs = 60000) {
  console.log(`${intervalMs/1000}초마다 메시지를 보내는 타이머를 시작합니다.`);
  
  // 클라이언트가 준비된 상태에서만 메시지 전송
  if (client.isReady()) {
    // 처음에 한 번 실행
    messageCallback();
    
    // 지정된 간격마다 반복 실행
    const timer = setInterval(messageCallback, intervalMs);
    return timer;
  } else {
    console.log('Discord 클라이언트가 아직 준비되지 않았습니다. 준비 완료 시 타이머가 시작됩니다.');
    return null;
  }
}

/**
 * Discord 메시지 이벤트 핸들러 설정 - 명령어 처리
 */
function setupMessageHandler() {
  console.log('Discord 메시지 핸들러가 설정되었습니다.');
  
  client.on('messageCreate', async (message) => {
    // 봇 메시지는 무시
    if (message.author.bot) return;
    
    // 명령어 확인
    const content = message.content.trim();
    
    // 보스 명령어 처리
    if (content.startsWith('!')) {
      try {
        await processBossCommand(content);
      } catch (error) {
        console.error('명령어 처리 중 오류:', error);
        message.channel.send('명령어 처리 중 오류가 발생했습니다.').catch(console.error);
      }
    }
  });
}

/**
 * 테스트 메시지 보내기 (데모용)
 */
async function sendTestMessage() {
  console.log('테스트 메시지 전송 중...');
  await sendTextAndVoiceMessage('테스트입니다.');
  console.log('테스트 메시지가 전송되었습니다:', new Date().toLocaleString('ko-KR'));
}

export { sendTextMessage, playVoiceMessage, sendTextAndVoiceMessage, startPeriodicMessages, sendTestMessage, setupMessageHandler };
