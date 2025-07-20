import { 
  loadBossData, 
  saveBossData, 
  updateBossKillTime, 
  getBossList, 
  getAllBossNextRespawns 
} from './boss-service.js';
import { sendTextMessage, sendTextMessageWithButtons, sendTextAndVoiceMessage } from './message-service.js';
import { runTestNotifications } from './test-service.js';
import { formatDate, getCurrentKoreanTime, formatTime } from '../utils/time-utils.js';
import { ButtonStyle } from 'discord.js';

/**
 * GitHub Gist에 데이터를 업로드하는 함수
 * @param {Object} data - 업로드할 데이터
 * @returns {Promise<string|null>} Gist URL 또는 null
 */
async function uploadToGist(data) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('GITHUB_TOKEN이 설정되지 않았습니다.');
      return null;
    }

    const backupTime = new Date().toISOString();
    const backupInfo = {
      ...data,
      _backupInfo: {
        backupTime: backupTime,
        backupDate: new Date().toLocaleString('ko-KR')
      }
    };

    const gistData = {
      description: `Boss data backup - ${backupTime}`,
      public: false,
      files: {
        "bosses.json": {
          content: JSON.stringify(backupInfo, null, 2)
        }
      }
    };

    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Discord-Boss-Bot'
      },
      body: JSON.stringify(gistData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Gist 업로드 실패:', error);
      return null;
    }

    const result = await response.json();
    return result.html_url;
  } catch (error) {
    console.error('Gist 업로드 중 오류:', error);
    return null;
  }
}

/**
 * 보스 명령어 처리 함수
 * @param {string} command - 명령어 문자열
 * @returns {Promise<boolean>} 처리 성공 여부
 */
async function processBossCommand(command) {
  try {
    // 명령어 파싱
    const args = command.trim().split(/\s+/);
    
    if (args.length === 0) {
      return false;
    }
    
    const mainCommand = args[0].toLowerCase();
    
    // 명령어 도움말 조회
    if (mainCommand === '!명령어' || mainCommand === '!도움말' || mainCommand === '!help') {
      await sendCommandHelp();
      return true;
    }
    
    // 보스 일정 명령어
    if (mainCommand === '!보스일정') {
      await sendBossSchedule();
      return true;
    }
    
    // 보스 백업 명령어
    if (mainCommand === '!보스백업') {
      await sendBossBackup();
      return true;
    }
    
    // 보스 복구 명령어
    if (mainCommand === '!보스복구') {
      if (args.length < 2) {
        await sendTextMessage('사용법: !보스복구 [백업키]');
        return false;
      }
      
      const gistId = args[1];
      await sendBossRestore(gistId);
      return true;
    }
    
    // 테스트 명령어 (개발자용)
    if (mainCommand === '!테스트') {
      await runTestNotifications();
      return true;
    }
    
    // 버튼 테스트 명령어 (개발자용)
    if (mainCommand === '!버튼테스트') {
      await sendButtonTest();
      return true;
    }
    
    // 버튼 제외 목록 확인 명령어 (개발자용)
    if (mainCommand === '!버튼제외목록') {
      await sendButtonExcludeList();
      return true;
    }
    
    // !버튼테스트2 명령어
    if (mainCommand === '!버튼테스트2') {
      await sendButtonTest2();
      return true;
    }
    
    // 음성 메시지 명령어
    if (mainCommand === '!말') {
      if (args.length < 2) {
        await sendTextMessage('사용법: !말 [메시지]');
        return false;
      }
      
      // 첫 번째 인자(!말)를 제외하고 나머지를 모두 합쳐서 메시지로 만듦
      const message = args.slice(1).join(' ');
      
      // 음성 메시지만 전송 (텍스트는 null)
      await sendTextAndVoiceMessage(null, message, {
        ttsOptions: {
          lang: 'ko'
        }
      });
      
      console.log(`음성 메시지 전송: "${message}"`);
      return true;
    }
    
    // 보스 처치 명령어
    if (mainCommand === '!처치' || mainCommand === '!컷') {
      if (args.length < 2) {
        await sendTextMessage('사용법: !컷 [보스이름] [시간(optional, 1845 같은 형식)]');
        return false;
      }
      
      const bossName = args[1];
      let killTime = null;
      
      // 시간이 지정된 경우 (예: !처치 베나투스 1845)
      if (args.length >= 3) {
        const timeString = args[2];
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
            await sendTextMessage('시간 형식이 잘못되었습니다. HHMM 형식(24시간제)을 사용해주세요.');
            return false;
          }
        } else {
          await sendTextMessage('시간 형식이 잘못되었습니다. HHMM 형식(24시간제)을 사용해주세요.');
          return false;
        }
      }
      
      return await markBossKilled(bossName, killTime);
    }
    
    return false;
  } catch (error) {
    console.error('보스 명령어 처리 중 오류:', error);
    await sendTextMessage('명령어 처리 중 오류가 발생했습니다.');
    return false;
  }
}

/**
 * 보스 목록을 전송하는 함수
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 */
async function sendBossList(messageSender = sendTextMessage) {
  const bosses = getBossList();
  
  if (bosses.length === 0) {
    await messageSender('등록된 보스가 없습니다.');
    return;
  }
  
  let message = '📎 [등록된 보스 목록] 📎\n\n';
  
  for (const boss of bosses) {
    let schedule;
    if (boss.respawnType === 'fixed_hour') {
      schedule = `${boss.respawnHours}시간 마다 리젠`;
    } else if (boss.respawnType === 'fixed_days') {
      schedule = `${boss.respawnDays.join(', ')} ${boss.respawnTime}에 리젠`;
    } else {
      schedule = '알 수 없음';
    }
    
    const lastKilled = boss.lastKilled ? 
      `마지막 처치: ${formatDate(new Date(boss.lastKilled))}` : 
      '마지막 처치: 기록 없음';
    
    message += `💹 ${boss.name} (${boss.id})\n   ${schedule}\n   ${lastKilled}\n\n`;
  }
  
  await messageSender(message);
}

/**
 * 보스 일정을 전송하는 함수
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 */
async function sendBossSchedule(messageSender = sendTextMessage) {
  const respawnList = getAllBossNextRespawns();
  
  if (respawnList.length === 0) {
    await messageSender('등록된 보스가 없습니다.');
    return;
  }
  
  let message = '```⭐️ 보스 리젠 일정 ⭐️\n';
  let currentDate = null;
  
  for (const item of respawnList) {
    const { boss, formattedTime, minutesUntil, respawnTime } = item;
    
    // 날짜 구분선 추가
    if (respawnTime) {
      const respawnDate = new Date(respawnTime);
      const dateStr = `📅 ${(respawnDate.getMonth() + 1).toString().padStart(2, '0')}-${respawnDate.getDate().toString().padStart(2, '0')}`;
      
      if (currentDate !== dateStr) {
        if (currentDate !== null) {
          message += '\n'; // 이전 날짜와 새 날짜 사이에 빈 줄 추가
        }
        message += `${dateStr}\n`;
        currentDate = dateStr;
      }
    }
    
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
    
    // 시간 부분만 추출 (HH:MM 형식)
    const timeOnly = respawnTime ? `${respawnTime.getHours().toString().padStart(2, '0')}:${respawnTime.getMinutes().toString().padStart(2, '0')}` : '??:??';
    
    // 일정한 열 너비 사용하여 깔끔한 표 형태로 표현
    const paddedTime = timeOnly.padEnd(8, ' '); // 시간 열 (예: "12:00   ")
    const columnWidth = 20; // 보스 이름을 표시할 열의 너비
    
    // 보스 이름이 columnWidth를 초과하면 잘라내고, 부족하면 공백으로 채움
    let displayName = boss.name;
    if (displayName.length > columnWidth) {
      displayName = displayName.substring(0, columnWidth - 3) + '...';
    }
    const paddedBossName = displayName.padEnd(columnWidth, ' ');
    
    // message += `${paddedTime}${paddedBossName}(${timeInfo})\n`;
    message += `${paddedTime}${paddedBossName}\n`;
  }
  
  message += '```';
  
  await messageSender(message);
}

/**
 * GitHub Gist에서 데이터를 다운로드하는 함수
 * @param {string} gistId - Gist ID
 * @returns {Promise<Object|null>} 다운로드된 데이터 또는 null
 */
async function downloadFromGist(gistId) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('GITHUB_TOKEN이 설정되지 않았습니다.');
      return null;
    }

    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Discord-Boss-Bot'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Gist 다운로드 실패:', error);
      return null;
    }

    const result = await response.json();
    const bossesFile = result.files['bosses.json'];
    
    if (!bossesFile) {
      console.error('bosses.json 파일을 찾을 수 없습니다.');
      return null;
    }

    return JSON.parse(bossesFile.content);
  } catch (error) {
    console.error('Gist 다운로드 중 오류:', error);
    return null;
  }
}

/**
 * 보스 데이터를 GitHub Gist로 백업하는 함수
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 */
async function sendBossBackup(messageSender = sendTextMessage) {
  try {
    await messageSender('📦 보스 데이터 백업을 시작합니다...');
    
    const data = loadBossData();
    const gistUrl = await uploadToGist(data);
    
    if (gistUrl) {
      const backupTime = new Date().toLocaleString('ko-KR');
      // Gist URL에서 ID 추출
      const gistId = gistUrl.split('/').pop();
      await messageSender(`✅ 백업이 완료되었습니다!\n\n📅 백업 시간: ${backupTime}\n🔑 백업키: ${gistId}`);
    } else {
      await messageSender('❌ 백업 중 오류가 발생했습니다.');
    }
  } catch (error) {
    console.error('보스 백업 중 오류:', error);
    await messageSender('❌ 백업 중 오류가 발생했습니다.');
  }
}

/**
 * 보스 데이터를 GitHub Gist에서 복구하는 함수
 * @param {string} gistId - Gist ID
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 */
async function sendBossRestore(gistId, messageSender = sendTextMessage) {
  try {
    await messageSender('🔄 보스 데이터 복구를 시작합니다...');
    
    const data = await downloadFromGist(gistId);
    
    if (data) {
      // 백업 시점 정보 추출
      let backupInfo = '';
      if (data._backupInfo) {
        const backupDate = data._backupInfo.backupDate || data._backupInfo.backupTime;
        backupInfo = `\n📅 백업 시점: ${backupDate}`;
        
        // 백업 정보 제거하고 순수 보스 데이터만 저장
        const { _backupInfo, ...pureData } = data;
        saveBossData(pureData);
      } else {
        // 백업 정보가 없는 경우 (이전 버전 호환성)
        saveBossData(data);
        backupInfo = '\n📅 백업 시점: 알 수 없음 (이전 버전)';
      }
      
      const restoreTime = new Date().toLocaleString('ko-KR');
      await messageSender(`✅ 복구가 완료되었습니다!\n\n📅 복구 시간: ${restoreTime}${backupInfo}\n🔑 복구키: ${gistId}`);
    } else {
      await messageSender('❌ 복구 중 오류가 발생했습니다. 백업키를 확인해주세요.');
    }
  } catch (error) {
    console.error('보스 복구 중 오류:', error);
    await messageSender('❌ 복구 중 오류가 발생했습니다.');
  }
}

/**
 * 사용 가능한 명령어 도움말을 보여주는 함수
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 */
async function sendCommandHelp(messageSender = sendTextMessage) {
  const helpMessage = [
    '🔴 **보스 알림 봇 명령어 목록** 🔴\n',
    '**기본 명령어**',
    '`!명령어` 또는 `!도움말` - 이 명령어 목록을 보여줍니다',
    '`!보스일정` - 다음 리젠 예정 시간과 남은 시간을 보여줍니다',
    '`!보스백업` - 현재 보스 데이터를 백업합니다',
    '`!보스복구 [백업키]` - 백업키로 보스 데이터를 복구합니다',
    '',
    '**음성 명령어**',
    '`!말 [메시지]` - 음성 채널에 메시지를 전송합니다',
    '',
    '**보스 처치 명령어**',
    '`!처치` 또는 `!컷` `[보스이름] [시간]` - 보스 처치를 기록합니다 (시간은 선택사항, 지정하지 않으면 현재 시간)'
  ].join('\n');
  
  await messageSender(helpMessage);
}

/**
 * 보스 처치를 기록하는 함수
 * @param {string} bossName - 보스 이름
 * @param {Date|null} killTime - 처치 시간 (지정하지 않으면 현재 시간)
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 * @returns {Promise<boolean>} 성공 여부
 */
async function markBossKilled(bossName, killTime = null, messageSender = sendTextMessage) {
  const data = loadBossData();
  const boss = data.bosses.find(b => b.name === bossName);
  
  if (!boss) {
    await messageSender(`${bossName} 보스를 찾을 수 없습니다.`);
    return false;
  }
  
  // 처치 시간이 지정되지 않으면 현재 시간으로 설정
  const now = killTime || new Date();
  const success = updateBossKillTime(boss.id, now);
  
  if (success) {
    await messageSender(`${boss.name} 컷 완료. 컷타임 : ${formatDate(now)}`);
    return true;
  } else {
    await messageSender(`${boss.name} 보스 처치 기록 중 오류가 발생했습니다.`);
    return false;
  }
}

/**
 * 보스 처치 기록을 취소하는 함수
 * @param {string} bossName - 보스 이름
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 * @returns {Promise<boolean>} 성공 여부
 */
async function cancelBossKill(bossName, messageSender = sendTextAndVoiceMessage) {
  const data = loadBossData();
  const boss = data.bosses.find(b => b.name === bossName);
  
  if (!boss) {
    await messageSender(`${bossName} 보스를 찾을 수 없습니다.`);
    return false;
  }
  
  const success = updateBossKillTime(boss.id, null);
  
  if (success) {
    await messageSender(`${boss.name} 보스의 처치 기록이 취소되었습니다.`);
    return true;
  } else {
    await messageSender(`${boss.name} 보스 처치 기록 취소 중 오류가 발생했습니다.`);
    return false;
  }
}

/**
 * 새로운 보스를 추가하는 함수
 * @param {string} name - 보스 이름
 * @param {string} typeInfo - 보스 타입 정보 (12h 또는 월,수,금/20:00 형식)
 * @param {string} location - 보스 등장 위치 (선택사항)
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 * @returns {Promise<boolean>} 성공 여부
 */
async function addNewBoss(name, typeInfo, location = '알 수 없음', messageSender = sendTextAndVoiceMessage) {
  try {
    const data = loadBossData();
    
    // 이미 같은 이름의 보스가 있는지 확인
    if (data.bosses.some(b => b.name === name)) {
      await messageSender(`이미 ${name} 보스가 존재합니다.`);
      return false;
    }
    
    // 새 보스 ID 생성
    const newId = data.bosses.length > 0 
      ? Math.max(...data.bosses.map(b => b.id)) + 1 
      : 1;
    
    let newBoss = {
      id: newId,
      name: name,
      lastKilled: null,
      location: location
    };
    
    // 타입 정보 파싱
    if (typeInfo.includes('h')) {
      // 시간 단위 리젠
      const hours = parseInt(typeInfo);
      if (isNaN(hours) || hours <= 0) {
        await sendTextMessage('시간 형식이 잘못되었습니다. 예: 12h');
        return false;
      }
      
      newBoss.respawnType = 'fixed_hour';
      newBoss.respawnHours = hours;
      newBoss.description = `보스가 죽은 시간 이후 ${hours}시간마다 리젠`;
    } 
    else if (typeInfo.includes('/')) {
      // 요일 및 시간 리젠
      const [daysStr, timeStr] = typeInfo.split('/');
      const days = daysStr.split(',').map(day => day.trim());
      
      // 시간 형식 검증 (HH:MM)
      if (!/^\d{1,2}:\d{2}$/.test(timeStr)) {
        await sendTextMessage('시간 형식이 잘못되었습니다. 예: 20:00');
        return false;
      }
      
      // 유효한 요일인지 확인
      const validDays = ['일', '월', '화', '수', '목', '금', '토'];
      for (const day of days) {
        if (!validDays.includes(day)) {
          await sendTextMessage(`유효하지 않은 요일: ${day}. 유효한 요일: 일, 월, 화, 수, 목, 금, 토`);
          return false;
        }
      }
      
      newBoss.respawnType = 'fixed_days';
      newBoss.respawnDays = days;
      newBoss.respawnTime = timeStr;
      newBoss.description = `${days.join('/')} ${timeStr}에 리젠`;
    } 
    else {
      await sendTextMessage('타입 형식이 잘못되었습니다. 예: 12h 또는 월,수,금/20:00');
      return false;
    }
    
    // 보스 추가
    data.bosses.push(newBoss);
    saveBossData(data);
    
    const locationInfo = location !== '알 수 없음' ? ` (위치: ${location})` : '';
    await messageSender(`새로운 보스 "${name}"이(가) 추가되었습니다. (${newBoss.description})${locationInfo}`);
    return true;
  } catch (error) {
    console.error('보스 추가 중 오류:', error);
    await messageSender('보스 추가 중 오류가 발생했습니다.');
    return false;
  }
}

/**
 * 보스를 삭제하는 함수
 * @param {string} name - 보스 이름
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 * @returns {Promise<boolean>} 성공 여부
 */
async function deleteBoss(name, messageSender = sendTextAndVoiceMessage) {
  try {
    const data = loadBossData();
    const initialLength = data.bosses.length;
    
    data.bosses = data.bosses.filter(b => b.name !== name);
    
    if (data.bosses.length === initialLength) {
      await messageSender(`${name} 보스를 찾을 수 없습니다.`);
      return false;
    }
    
    saveBossData(data);
    await messageSender(`보스 "${name}"이(가) 삭제되었습니다.`);
    return true;
  } catch (error) {
    console.error('보스 삭제 중 오류:', error);
    await messageSender('보스 삭제 중 오류가 발생했습니다.');
    return false;
  }
}

/**
 * 버튼 테스트 함수
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 */
async function sendButtonTest(messageSender = sendTextMessageWithButtons) {
  const testMessage = '테스트';
  const uniqueId = Date.now();
  const buttons = [
    {
      customId: `boss_kill_테스트보스_${uniqueId}`,
      label: '컷',
      style: ButtonStyle.Success,
      emoji: ''
    }
  ];
  await messageSender(testMessage, buttons);
  console.log('버튼 테스트 메시지가 전송되었습니다.');
}

/**
 * 버튼 제외 목록 확인 함수
 * @param {Function} messageSender - 메시지 전송 함수 (선택사항)
 */
async function sendButtonExcludeList(messageSender = sendTextMessage) {
  const excludeButtonBossIds = [56, 57, 58, 59, 60, 61, 62];
  const data = loadBossData();
  
  let message = '🚫 **버튼 제외 보스 목록** 🚫\n\n';
  
  for (const bossId of excludeButtonBossIds) {
    const boss = data.bosses.find(b => b.id === bossId);
    if (boss) {
      message += `🔹 **${boss.name}** (ID: ${boss.id})\n   📍 ${boss.location}\n   ⏰ ${boss.description}\n\n`;
    } else {
      message += `🔹 **알 수 없는 보스** (ID: ${bossId})\n\n`;
    }
  }
  
  message += `\n총 ${excludeButtonBossIds.length}개의 보스가 버튼 제외 목록에 있습니다.`;
  
  await messageSender(message);
  console.log('버튼 제외 목록이 전송되었습니다.');
}

/**
 * 최소 버튼 상호작용 테스트 함수
 */
async function sendButtonTest2(messageSender = sendTextMessageWithButtons) {
  const testMessage = '🟢 최소 버튼 상호작용 테스트';
  const buttons = [
    {
      customId: 'test_button_minimal',
      label: '테스트 버튼',
      style: ButtonStyle.Primary
    }
  ];
  await messageSender(testMessage, buttons);
  console.log('최소 버튼 테스트 메시지가 전송되었습니다.');
}

export {
  processBossCommand,
  sendBossList,
  sendBossSchedule,
  markBossKilled,
  cancelBossKill,
  addNewBoss,
  deleteBoss,
  sendCommandHelp,
  sendBossBackup,
  sendBossRestore,
  sendButtonTest,
  sendButtonExcludeList,
  sendButtonTest2
};
