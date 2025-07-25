import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getCurrentKoreanTime,
  getMinutesUntil,
  parseTimeString,
  dayStringToNumber,
  getNextDayOfWeek,
  formatDate,
  formatTime,
  dayNumberToString
} from '../utils/time-utils.js';

// __dirname 설정 (ESM에서는 __dirname이 기본적으로 없음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 보스 데이터 파일 경로
const BOSSES_FILE_PATH = path.join(__dirname, '../../data/bosses.json');

// 알림 시간 (분 단위)
const NOTIFICATION_TIMES = [5, 1];  // 5분 전, 1분 전 알림

/**
 * 보스 데이터를 로드하는 함수
 * @returns {Object} 보스 데이터 객체
 */
function loadBossData() {
  try {
    const data = fs.readFileSync(BOSSES_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('보스 데이터 로드 중 오류:', error);
    // 기본 빈 데이터 반환
    return { bosses: [] };
  }
}

/**
 * 보스 데이터를 저장하는 함수
 * @param {Object} data - 저장할 보스 데이터 객체
 */
function saveBossData(data) {
  try {
    fs.writeFileSync(BOSSES_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log('보스 데이터가 저장되었습니다.');
  } catch (error) {
    console.error('보스 데이터 저장 중 오류:', error);
  }
}

/**
 * 보스 처치 시간을 업데이트하는 함수
 * @param {number} bossId - 보스 ID
 * @param {Date|null} killedTime - 처치 시간 (기본값: 현재 시간)
 * @returns {boolean} 성공 여부
 */
function updateBossKillTime(bossId, killedTime = new Date()) {
  try {
    const data = loadBossData();
    const boss = data.bosses.find(b => b.id === bossId);
    
    if (!boss) {
      console.error(`ID ${bossId}에 해당하는 보스를 찾을 수 없습니다.`);
      return false;
    }
    
    boss.lastKilled = killedTime ? killedTime.toISOString() : null;
    saveBossData(data);
    console.log(`보스 ${boss.name}의 처치 시간이 업데이트되었습니다:`, boss.lastKilled ? new Date(boss.lastKilled).toLocaleString('ko-KR') : '없음');
    return true;
  } catch (error) {
    console.error('보스 처치 시간 업데이트 중 오류:', error);
    return false;
  }
}

/**
 * 특정 보스의 다음 리젠 시간을 계산하는 함수
 * @param {Object} boss - 보스 객체
 * @returns {Date|null} 다음 리젠 시간 (Date 객체) 또는 null
 */
function calculateNextRespawnTime(boss) {
  try {
    const now = new Date();
    
    // 보스 타입에 따라 다음 리젠 시간 계산
    if (boss.respawnType === 'fixed_hour') {
      // 보스가 죽은 후 N시간 마다 리젠
      if (!boss.lastKilled) {
        console.log(`${boss.name}의 마지막 처치 시간이 기록되지 않았습니다.`);
        return null;
      }
      
      const lastKilledTime = new Date(boss.lastKilled);
      const nextRespawn = new Date(lastKilledTime);
      nextRespawn.setHours(nextRespawn.getHours() + boss.respawnHours);
      
      if (nextRespawn <= now) {
        // 이미 리젠 시간이 지났다면, 다음 주기 계산
        // (현재 시간 - 마지막 킬 시간) / 리젠 주기 = 지난 주기 수
        const elapsedHours = (now - lastKilledTime) / (1000 * 60 * 60);
        const cycles = Math.floor(elapsedHours / boss.respawnHours);
        const nextRespawnTime = new Date(lastKilledTime);
        nextRespawnTime.setHours(nextRespawnTime.getHours() + (cycles + 1) * boss.respawnHours);
        return nextRespawnTime;
      }
      
      return nextRespawn;
    } 
    else if (boss.respawnType === 'fixed_days') {
      // 특정 요일 특정 시간에 리젠
      const currentDay = now.getDay();
      const [hours, minutes] = boss.respawnTime.split(':').map(Number);
      
      // 오늘이 리젠 요일인지 확인
      const isTodayRespawnDay = boss.respawnDays.includes(dayNumberToString(currentDay));
      
      // 오늘의 리젠 시간 계산
      const todayRespawnTime = new Date(now);
      todayRespawnTime.setHours(hours, minutes, 0, 0);
      
      // 오늘이 리젠 요일이고 리젠 시간이 아직 안 지났으면
      if (isTodayRespawnDay && todayRespawnTime > now) {
        return todayRespawnTime;
      }
      
      // 그렇지 않으면 다음 리젠 요일 찾기
      const dayNumbers = boss.respawnDays.map(dayStringToNumber);
      dayNumbers.sort((a, b) => a - b);  // 요일 순으로 정렬
      
      // 이번 주 중 다가오는 리젠 요일 찾기
      let nextDayNumber = dayNumbers.find(day => day > currentDay);
      
      // 이번 주에 남은 리젠 요일이 없으면 다음 주 첫 리젠 요일
      if (nextDayNumber === undefined) {
        nextDayNumber = dayNumbers[0];
      }
      
      // 다음 리젠 날짜 계산
      const nextRespawnDay = getNextDayOfWeek(nextDayNumber, now);
      nextRespawnDay.setHours(hours, minutes, 0, 0);
      
      return nextRespawnDay;
    }
    
    return null;
  } catch (error) {
    console.error(`보스 ${boss.name}의 다음 리젠 시간 계산 중 오류:`, error);
    return null;
  }
}

/**
 * 모든 보스의 다음 리젠 시간과 알림 시간을 확인하는 함수
 * @returns {Array} 알림이 필요한 보스 목록
 */
function checkBossRespawns() {
  try {
    const data = loadBossData();
    const now = new Date();
    const notifications = [];
    
    for (const boss of data.bosses) {
      const nextRespawnTime = calculateNextRespawnTime(boss);
      
      if (!nextRespawnTime) {
        continue;
      }
      
      // 다음 리젠까지 남은 시간(분) 계산
      const minutesUntilRespawn = getMinutesUntil(nextRespawnTime);
      
      // 알림 시간에 도달했는지 확인
      if (NOTIFICATION_TIMES.includes(minutesUntilRespawn)) {
        notifications.push({
          boss: boss,
          respawnTime: nextRespawnTime,
          minutesUntil: minutesUntilRespawn
        });
      }
    }
    
    return notifications;
  } catch (error) {
    console.error('보스 리젠 확인 중 오류:', error);
    return [];
  }
}

/**
 * 모든 보스의 다음 리젠 시간 목록을 가져오는 함수
 * @returns {Array} 보스별 다음 리젠 시간 목록
 */
function getAllBossNextRespawns() {
  try {
    const data = loadBossData();
    const respawnList = [];
    
    for (const boss of data.bosses) {
      const nextRespawnTime = calculateNextRespawnTime(boss);
      
      if (nextRespawnTime) {
        respawnList.push({
          boss: boss,
          respawnTime: nextRespawnTime,
          formattedTime: formatDate(nextRespawnTime),
          minutesUntil: getMinutesUntil(nextRespawnTime)
        });
      } else {
        respawnList.push({
          boss: boss,
          respawnTime: null,
          formattedTime: '알 수 없음',
          minutesUntil: null
        });
      }
    }
    
    // 리젠 시간이 가까운 순으로 정렬 (남은 시간이 적은 순)
    respawnList.sort((a, b) => {
      // null값은 마지막으로 보내기
      if (!a.respawnTime) return 1;
      if (!b.respawnTime) return -1;
      
      // 리젠 완료된 보스는 가장 위에 표시
      if (a.minutesUntil <= 0 && b.minutesUntil > 0) return -1;
      if (a.minutesUntil > 0 && b.minutesUntil <= 0) return 1;
      
      // 리젠 완료된 보스들은 시간 순으로
      if (a.minutesUntil <= 0 && b.minutesUntil <= 0) {
        return a.respawnTime - b.respawnTime;
      }
      
      // 리젠 시간이 남은 보스들은 남은 시간이 적은 순으로
      return a.minutesUntil - b.minutesUntil;
    });
    
    return respawnList;
  } catch (error) {
    console.error('보스 리젠 목록 가져오기 중 오류:', error);
    return [];
  }
}

/**
 * fixed_hour 타입 보스 중 예상 리젠 시간보다 20분 이상 지났는데 컷타임 기록이 없는 보스들을 확인하는 함수
 * @returns {Array} 알림이 필요한 보스 목록
 */
function checkOverdueFixedHourBosses() {
  try {
    const data = loadBossData();
    const now = new Date();
    const overdueBosses = [];
    
    for (const boss of data.bosses) {
      // fixed_hour 타입 보스만 확인
      if (boss.respawnType !== 'fixed_hour') {
        continue;
      }
      
      // 마지막 처치 시간이 없으면 건너뛰기
      if (!boss.lastKilled) {
        continue;
      }
      
      const lastKilledTime = new Date(boss.lastKilled);
      
      // 마지막 처치 후 첫 번째 리젠 시간 계산
      const firstRespawnTime = new Date(lastKilledTime);
      firstRespawnTime.setHours(firstRespawnTime.getHours() + boss.respawnHours);
      
      // 첫 번째 리젠 시간이 현재보다 20분 이상 지났는지 확인
      const minutesOverdue = getMinutesUntil(firstRespawnTime);
      
      if (minutesOverdue <= -20) { // 20분 이상 지남
        overdueBosses.push({
          boss: boss,
          expectedRespawnTime: firstRespawnTime,
          minutesOverdue: Math.abs(minutesOverdue),
          lastKilledTime: lastKilledTime
        });
      }
    }
    
    return overdueBosses;
  } catch (error) {
    console.error('지연된 fixed_hour 보스 확인 중 오류:', error);
    return [];
  }
}

/**
 * 보스 목록 가져오기
 * @returns {Array} 보스 목록
 */
function getBossList() {
  try {
    const data = loadBossData();
    return data.bosses;
  } catch (error) {
    console.error('보스 목록 가져오기 중 오류:', error);
    return [];
  }
}

export {
  loadBossData,
  saveBossData,
  updateBossKillTime,
  calculateNextRespawnTime,
  checkBossRespawns,
  getAllBossNextRespawns,
  getBossList,
  checkOverdueFixedHourBosses
};
