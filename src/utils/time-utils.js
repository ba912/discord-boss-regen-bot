/**
 * 시간 관련 유틸리티 함수들
 */

/**
 * 현재 한국 시간을 가져오는 함수
 * @returns {Date} 현재 한국 시간
 */
function getCurrentKoreanTime() {
  // UTC 시간에 9시간을 더해 한국 시간을 계산
  return new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
}

/**
 * 특정 시간까지 남은 시간(분)을 계산하는 함수
 * @param {Date} targetTime - 목표 시간
 * @returns {number} 남은 시간(분)
 */
function getMinutesUntil(targetTime) {
  const now = new Date();
  const diffMs = targetTime - now;
  return Math.floor(diffMs / (1000 * 60));
}

/**
 * 시:분 형식의 문자열을 Date 객체로 변환하는 함수
 * @param {string} timeString - "HH:MM" 형식의 시간 문자열
 * @param {Date} baseDate - 기준 날짜 (선택 사항)
 * @returns {Date} 시간이 설정된 Date 객체
 */
function parseTimeString(timeString, baseDate = new Date()) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * 요일 문자열을 숫자로 변환하는 함수 (0: 일요일, 1: 월요일, ..., 6: 토요일)
 * @param {string} dayString - 요일 문자열 (예: '월', '화', etc.)
 * @returns {number} 요일 숫자
 */
function dayStringToNumber(dayString) {
  const days = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  return days[dayString];
}

/**
 * 숫자 요일을 문자열로 변환하는 함수
 * @param {number} dayNumber - 요일 숫자 (0: 일요일, 1: 월요일, ..., 6: 토요일)
 * @returns {string} 요일 문자열
 */
function dayNumberToString(dayNumber) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[dayNumber];
}

/**
 * 특정 요일의 다음 날짜를 찾는 함수
 * @param {number} targetDay - 목표 요일 (0-6)
 * @param {Date} baseDate - 기준 날짜 (선택 사항)
 * @returns {Date} 다음 목표 요일의 날짜
 */
function getNextDayOfWeek(targetDay, baseDate = new Date()) {
  const date = new Date(baseDate);
  const currentDay = date.getDay();
  
  // 일주일 내에서 며칠 후에 목표 요일이 오는지 계산
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7; // 이미 지났거나 오늘이면 다음 주로
  }
  
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

/**
 * Date 객체를 읽기 쉬운 형식으로 포맷팅하는 함수
 * @param {Date} date - 포맷팅할 날짜
 * @returns {string} 포맷팅된 날짜 문자열
 */
function formatDate(date) {
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * 시간을 HH:MM 형식으로 포맷팅하는 함수
 * @param {Date} date - 포맷팅할 날짜
 * @returns {string} 포맷팅된 시간 문자열
 */
function formatTime(date) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export {
  getCurrentKoreanTime,
  getMinutesUntil,
  parseTimeString,
  dayStringToNumber,
  dayNumberToString,
  getNextDayOfWeek,
  formatDate,
  formatTime
};
