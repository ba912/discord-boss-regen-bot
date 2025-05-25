import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

// __dirname 설정 (ESM에서는 __dirname이 기본적으로 없음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// promisify fs.writeFile
const writeFileAsync = promisify(fs.writeFile);

// ResponsiveVoice API 키
const RV_API_KEY = 'cy08LzuY';

/**
 * ResponsiveVoice를 사용하여 텍스트를 음성 파일로 변환하는 함수
 * @param {string} text - 음성으로 변환할 텍스트
 * @param {Object} options - TTS 옵션 (선택사항)
 * @returns {Promise<string>} - 생성된 음성 파일 경로
 */
async function generateTTSAudio(text, options = {}) {
  try {
    // 기본 옵션 설정
    const defaultOptions = {
      lang: 'ko-KR',
      gender: 'female',  // 성별 옵션 (female: 기본 여성목소리, male: 조절된 여성목소리)
      pitch: 1.0,        // 음높이 옵션 (0.1~2.0)
      rate: 0.8,         // 속도 옵션 (0.1~2.0, 더 느리게 설정: 0.8)
      volume: 1.0        // 볼륨 옵션 (0.1~1.0)
    };
    
    // 사용자 옵션과 기본 옵션 병합
    const ttsOptions = { ...defaultOptions, ...options };
    
    // ResponsiveVoice를 사용하여 음성 생성
    return await generateResponsiveVoiceAudio(text, ttsOptions);
  } catch (error) {
    console.error('TTS 생성 중 오류 발생:', error);
    throw error;
  }
}



/**
 * ResponsiveVoice를 사용하여 텍스트를 음성 파일로 변환하는 함수
 * @param {string} text - 음성으로 변환할 텍스트
 * @param {Object} options - TTS 옵션
 * @returns {Promise<string>} - 생성된 음성 파일 경로
 */
async function generateResponsiveVoiceAudio(text, options) {
  try {
    // ResponsiveVoice는 한국어에 대해 Korean Female만 지원함
    const voice = 'Korean Female';
    
    // 남성 목소리 효과를 위한 음높이와 속도 조절
    const ttsOptions = { ...options };
    if (ttsOptions.gender === 'male') {
      ttsOptions.pitch = Math.min(ttsOptions.pitch, 0.8);
      ttsOptions.rate = Math.min(ttsOptions.rate, 0.9);
    }
    
    // 음성 생성을 위해 responsive-voice.js의 generateAudio 함수 호출
    const { generateAudio } = await import('./responsive-voice.js');
    const outputPath = await generateAudio(text, ttsOptions);
    
    console.log(`[ResponsiveVoice] 음성 파일이 생성되었습니다: ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error('[ResponsiveVoice] 오류 발생:', error);
    throw error;
  }
}



/**
 * 임시 오디오 파일을 정리하는 함수
 * @param {string} filePath - 정리할 파일 경로
 */
function cleanupTTSFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`TTS 파일 정리 완료: ${filePath}`);
    } catch (error) {
      console.error(`TTS 파일 정리 중 오류: ${error.message}`);
    }
  }
}

export { generateTTSAudio, cleanupTTSFile };
