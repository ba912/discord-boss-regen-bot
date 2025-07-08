import { TextChannel, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { generateTTSAudio } from '../tts/tts-service.js';
import { playAudio } from '../discord/voice.js';
import { client } from '../discord/client.js';
import { processBossCommand } from './boss-command-service.js';
import { queueVoiceMessage } from '../tts/voice-queue.js';

/**
 * 텍스트 메시지만 보내는 함수 (명령어 응답용)
 * @param {string|Object} messageOrContent - 보낼 메시지 내용 또는 메시지 객체
 * @param {string} content - 보낼 메시지 내용 (messageOrContent가 객체인 경우)
 * @returns {Promise<boolean>} - 성공 여부
 */
async function sendTextMessage(messageOrContent, content = null) {
  // 매개변수 처리: messageOrContent가 객체면 content를 사용, 아니면 messageOrContent를 사용
  const messageContent = content || messageOrContent;
  
  if (!messageContent || messageContent.trim() === '') {
    console.warn('빈 메시지로 인해 텍스트 메시지 전송이 건너뜀');
    return false;
  }
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
        content: messageContent
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
 * 실제로 음성 메시지를 생성하고 재생하는 함수
 * @private
 * @param {string} message - 재생할 음성 메시지 내용
 * @param {Object} options - TTS 옵션 (선택사항)
 * @returns {Promise<boolean>} - 성공 여부
 */
async function _playVoiceMessageInternal(message, options = {}) {
  let audioFilePath; // audioFilePath 변수를 try 블록 외부에서 선언
  
  try {
    // 기본 TTS 옵션
    const ttsOptions = {
      lang: 'ko-KR',  // 기본 한국어 여성 음성
      ...options
    };
    
    // TTS 음성 파일 생성
    audioFilePath = await generateTTSAudio(message, ttsOptions);
    
    // 음성 재생
    await playAudio(audioFilePath);
    console.log(`음성 메시지 재생 완료: "${message}"`);
    
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
 * 음성 메시지를 대기열에 추가하여 순차적으로 재생하는 함수
 * @param {string} message - 재생할 음성 메시지 내용
 * @param {Object} options - TTS 옵션 (선택사항)
 * @returns {Promise<boolean>} - 성공 여부
 */
async function playVoiceMessage(message, options = {}) {
  try {
    // 대기열에 음성 메시지 추가
    await queueVoiceMessage(message, options, _playVoiceMessageInternal);
    return true;
  } catch (error) {
    console.error('음성 메시지 대기열 처리 중 오류:', error);
    return false;
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
 * 버튼이 포함된 텍스트 메시지를 보내는 함수
 * @param {string} message - 보낼 메시지 내용
 * @param {Array} buttons - 버튼 배열 [{customId, label, style, emoji}]
 * @returns {Promise<boolean>} - 성공 여부
 */
async function sendTextMessageWithButtons(message, buttons = []) {
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
      // 버튼 컴포넌트 생성
      const components = [];
      if (buttons.length > 0) {
        const actionRow = new ActionRowBuilder();
        
        buttons.forEach(button => {
          const buttonBuilder = new ButtonBuilder()
            .setCustomId(button.customId)
            .setLabel(button.label)
            .setStyle(button.style || ButtonStyle.Primary);
          
          if (button.emoji) {
            buttonBuilder.setEmoji(button.emoji);
          }
          
          actionRow.addComponents(buttonBuilder);
        });
        
        components.push(actionRow);
      }
      
      await textChannel.send({
        content: message,
        components: components
      });
      console.log('버튼이 포함된 텍스트 메시지가 전송되었습니다.');
      return true;
    } else {
      console.error('유효한 텍스트 채널을 찾을 수 없습니다.');
      return false;
    }
  } catch (error) {
    console.error('버튼 메시지 전송 중 오류:', error);
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
        await processBossCommand(content, message);
      } catch (error) {
        console.error('명령어 처리 중 오류:', error);
        message.channel.send('명령어 처리 중 오류가 발생했습니다.').catch(console.error);
      }
    }
  });
}

/**
 * Discord 상호작용(슬래시 명령어, 버튼, 셀렉트 등) 통합 핸들러 설정
 */
function setupInteractionHandler() {
  console.log('Discord 상호작용 핸들러가 설정되었습니다.');

  client.on('interactionCreate', async (interaction) => {
    try {
      // !보스추가 플로우: add_boss_로 시작하는 셀렉트/모달/버튼 상호작용 위임
      if (
        (interaction.isStringSelectMenu() && interaction.customId.startsWith('add_boss_')) ||
        (interaction.type === 5 && interaction.customId && interaction.customId.startsWith('add_boss_')) || // ModalSubmit
        (interaction.isButton() && interaction.customId.startsWith('add_boss_'))
      ) {
        const { handleAddBossInteraction } = await import('./boss-command-service.js');
        await handleAddBossInteraction(interaction);
        return;
      }
      if (interaction.isChatInputCommand()) {
        // 슬래시 명령어 처리 (기존 handleInteraction 등으로 위임)
        const { handleInteraction } = await import('../commands/interaction-handler.js');
        await handleInteraction(interaction);
      } else if (interaction.isButton()) {
        // 버튼 상호작용 처리
        const { customId } = interaction;
        const userId = interaction.user.id;
        const username = interaction.user.username;
        console.log(`버튼 클릭: ${customId} by ${username} (${userId})`);

        // 최소 버튼 상호작용 테스트
        if (customId === 'test_button_minimal') {
          await interaction.reply({ content: '버튼 클릭됨!', ephemeral: true });
          return;
        }
        // 보스 처치 확인 버튼 (컷 버튼)
        if (customId.startsWith('boss_kill_')) {
          const bossName = customId.replace(/^boss_kill_/, '').replace(/_\d+$/, '');
          console.log(`보스 처치 버튼 처리 시작: ${bossName}`);
          await handleBossKillButton(interaction, bossName);
        } else {
          console.log(`알 수 없는 버튼 customId: ${customId}`);
        }
      } else if (interaction.isStringSelectMenu()) {
        // 셀렉트 메뉴 상호작용 처리 (필요시 구현)
        await interaction.reply({ content: '셀렉트 메뉴 상호작용은 아직 지원하지 않습니다.', ephemeral: true });
      }
    } catch (error) {
      console.error('상호작용 처리 중 오류:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '상호작용 처리 중 오류가 발생했습니다.', ephemeral: true });
        } else {
          await interaction.editReply({ content: '상호작용 처리 중 오류가 발생했습니다.' });
        }
      } catch (e) {
        // 무시
      }
    }
  });
}

/**
 * 보스 처치 확인 버튼 처리
 */
async function handleBossKillButton(interaction, bossName) {
  try {
    // 보스 처치 기록
    const { markBossKilled } = await import('./boss-command-service.js');
    const success = await markBossKilled(bossName, null, async (message) => {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: message });
      } else {
        // 이미 응답된 경우 editReply로 시도 (실패해도 무시)
        try {
          await interaction.editReply({ content: message });
        } catch (e) {
          // 무시
        }
      }
    });
    
    if (success) {
      // 원본 메시지의 버튼을 비활성화
      const newComponents = interaction.message.components.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach(component => {
          component.setDisabled(true);
        });
        return newRow;
      });
      
      await interaction.message.edit({
        components: newComponents
      });
    }
  } catch (error) {
    console.error('보스 처치 버튼 처리 중 오류:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: '보스 처치 처리 중 오류가 발생했습니다.'
      });
    } else {
      try {
        await interaction.editReply({ content: '보스 처치 처리 중 오류가 발생했습니다.' });
      } catch (e) {
        // 무시
      }
    }
  }
}

/**
 * 테스트 메시지 보내기 (데모용)
 */
async function sendTestMessage() {
  console.log('테스트 메시지 전송 중...');
  await sendTextAndVoiceMessage('테스트입니다.');
  console.log('테스트 메시지가 전송되었습니다:', new Date().toLocaleString('ko-KR'));
}

export { 
  sendTextMessage, 
  playVoiceMessage, 
  sendTextAndVoiceMessage, 
  sendTextMessageWithButtons,
  startPeriodicMessages, 
  sendTestMessage, 
  setupMessageHandler,
  setupInteractionHandler
};
