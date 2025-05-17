import {
  sendBossList,
  sendBossSchedule,
  markBossKilled,
  cancelBossKill,
  addNewBoss,
  deleteBoss
} from '../services/boss-command-service.js';

/**
 * 슬래시 명령어 상호작용을 처리하는 함수
 * @param {Object} interaction - Discord 상호작용 객체
 * @returns {Promise<void>}
 */
async function handleInteraction(interaction) {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;
  console.log(`슬래시 명령어 실행: ${commandName}`);
  
  try {
    // 응답 지연 설정 (Discord는 3초 이내 응답 필요)
    await interaction.deferReply();
    console.log(`응답 지연 설정 완료`);
    
    switch (commandName) {
      case 'boss-list':
        await handleBossList(interaction);
        break;
        
      case 'boss-schedule':
        await handleBossSchedule(interaction);
        break;
        
      case 'kill':
        await handleKill(interaction);
        break;
        
      case 'cancel-kill':
        await handleCancelKill(interaction);
        break;
        
      case 'add-boss':
        await handleAddBoss(interaction);
        break;
        
      case 'delete-boss':
        await handleDeleteBoss(interaction);
        break;
        
      default:
        await interaction.editReply('알 수 없는 명령어입니다.');
    }
  } catch (error) {
    console.error('명령어 처리 중 오류:', error);
    
    // 이미 응답이 전송되었는지 확인
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('명령어 처리 중 오류가 발생했습니다.');
    } else {
      await interaction.reply({
        content: '명령어 처리 중 오류가 발생했습니다.',
        ephemeral: true
      });
    }
  }
}

/**
 * 보스 목록 명령어 처리
 */
async function handleBossList(interaction) {
  console.log('보스 목록 명령어 처리 시작');
  
  try {
    // 커스텀 메시지 인터셉터 생성
    const customMessageSender = createCustomMessageSender(interaction);
    
    // 기존 함수 호출 (메시지 전송이 인터셉트됨)
    await sendBossList(customMessageSender);
    console.log('보스 목록 명령어 처리 완료');
  } catch (error) {
    console.error('보스 목록 처리 중 오류:', error);
    await interaction.editReply('보스 목록을 가져오는 중 오류가 발생했습니다.');
  }
}

/**
 * 보스 일정 명령어 처리
 */
async function handleBossSchedule(interaction) {
  const customMessageSender = createCustomMessageSender(interaction);
  await sendBossSchedule(customMessageSender);
}

/**
 * 보스 처치 명령어 처리
 */
async function handleKill(interaction) {
  const bossName = interaction.options.getString('name');
  const timeString = interaction.options.getString('time');
  let killTime = null;
  
  // 시간이 지정된 경우 처리
  if (timeString) {
    if (/^\d{3,4}$/.test(timeString)) {
      const now = new Date();
      let hours, minutes;
      
      // 3자리 식이면 (ex: 845) -> 8시 45분
      if (timeString.length === 3) {
        hours = parseInt(timeString.substring(0, 1));
        minutes = parseInt(timeString.substring(1, 3));
      } 
      // 4자리 식이면 (ex: 1845) -> 18시 45분
      else {
        hours = parseInt(timeString.substring(0, 2));
        minutes = parseInt(timeString.substring(2, 4));
      }
      
      // 유효한 시간 값 확인
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        killTime = new Date();
        killTime.setHours(hours, minutes, 0, 0);
        
        // 지정한 시간이 현재보다 미래인 경우, 어제로 설정
        if (killTime > now) {
          killTime.setDate(killTime.getDate() - 1);
        }
      } else {
        await interaction.editReply('시간 형식이 잘못되었습니다. HHMM 형식(24시간제)을 사용해주세요.');
        return;
      }
    } else {
      await interaction.editReply('시간 형식이 잘못되었습니다. HHMM 형식(24시간제)을 사용해주세요.');
      return;
    }
  }
  
  const customMessageSender = createCustomMessageSender(interaction);
  await markBossKilled(bossName, killTime, customMessageSender);
}

/**
 * 보스 처치 취소 명령어 처리
 */
async function handleCancelKill(interaction) {
  const bossName = interaction.options.getString('name');
  const customMessageSender = createCustomMessageSender(interaction);
  await cancelBossKill(bossName, customMessageSender);
}

/**
 * 보스 추가 명령어 처리
 */
async function handleAddBoss(interaction) {
  const name = interaction.options.getString('name');
  const typeInfo = interaction.options.getString('type');
  const location = interaction.options.getString('location') || '알 수 없음';
  
  const customMessageSender = createCustomMessageSender(interaction);
  await addNewBoss(name, typeInfo, location, customMessageSender);
}

/**
 * 보스 삭제 명령어 처리
 */
async function handleDeleteBoss(interaction) {
  const name = interaction.options.getString('name');
  const customMessageSender = createCustomMessageSender(interaction);
  await deleteBoss(name, customMessageSender);
}

/**
 * 커스텀 메시지 전송 함수 생성
 * 기존 함수의 결과를 Discord 상호작용으로 전달
 */
function createCustomMessageSender(interaction) {
  return async (message) => {
    try {
      console.log(`메시지 전송 시도: ${message.substring(0, 50)}...`);
      // 이미 응답했거나 지연 설정된 경우 editReply 사용
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message });
      } else {
        await interaction.reply({ content: message });
      }
      console.log('메시지 전송 성공');
    } catch (error) {
      console.error('메시지 전송 중 오류:', error);
      // 오류 발생 시 기본 오류 메시지 전송 시도
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: '메시지 전송 중 오류가 발생했습니다.' });
        } else {
          await interaction.reply({ content: '메시지 전송 중 오류가 발생했습니다.' });
        }
      } catch (secondaryError) {
        console.error('기본 오류 메시지 전송 중 오류:', secondaryError);
      }
    }
  };
}

export { handleInteraction };
