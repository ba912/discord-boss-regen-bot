import 'dotenv/config';
import { REST, Routes } from 'discord.js';

// 명령어 구조 정의
const commands = [
  {
    name: 'boss-list',
    description: '등록된 모든 보스 목록을 표시합니다',
  },
  {
    name: 'boss-schedule',
    description: '다음 리젠 예정 시간과 남은 시간을 표시합니다',
  },
  {
    name: 'kill',
    description: '보스 처치를 기록합니다',
    options: [
      {
        name: 'name',
        description: '처치한 보스 이름',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'time',
        description: '처치 시간 (예: 1845 - 오후 6시 45분)',
        type: 3, // STRING
        required: false,
      },
    ],
  },
  {
    name: 'cancel-kill',
    description: '보스 처치 기록을 취소합니다',
    options: [
      {
        name: 'name',
        description: '취소할 보스 이름',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'add-boss',
    description: '새 보스를 추가합니다',
    options: [
      {
        name: 'name',
        description: '보스 이름',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'type',
        description: '보스 타입 (예: 12h 또는 월,수,금/20:00)',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'location',
        description: '보스 등장 위치',
        type: 3, // STRING
        required: false,
      }
    ],
  },
  {
    name: 'delete-boss',
    description: '보스를 삭제합니다',
    options: [
      {
        name: 'name',
        description: '삭제할 보스 이름',
        type: 3, // STRING
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

/**
 * 슬래시 명령어를 등록하는 함수
 */
async function registerCommands() {
  try {
    console.log('슬래시 명령어 등록 중...');
    
    const clientId = process.env.APP_ID;
    // 채널 ID 읽기
    const guildId = process.env.GUILD_ID || process.env.CHANNEL_ID?.split('/')[0];
    
    if (!clientId) {
      console.error('APP_ID가 .env 파일에 설정되어 있지 않습니다.');
      return;
    }
    
    if (!guildId) {
      console.error('서버 ID(GUILD_ID)가 없습니다. 서버별 명령어를 등록할 수 없습니다.');
      console.log('글로벌 명령어로 등록하는 중... (최대 1시간 소요)');
      
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      
      console.log(`${data.length}개의 글로벌 슬래시 명령어가 등록되었습니다.`);
    } else {
      // 서버별 명령어 등록 (즉시 반영)
      console.log(`서버 ID: ${guildId}에 명령어 등록 중...`);
      
      const data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      
      console.log(`${data.length}개의 서버별 슬래시 명령어가 등록되었습니다.`);
    }
  } catch (error) {
    console.error('명령어 등록 중 오류 발생:', error);
  }
}

export { registerCommands, commands };
