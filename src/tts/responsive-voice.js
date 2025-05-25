// ResponsiveVoice 통합 모듈 - API 직접 호출 방식
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// __dirname 설정 (ESM에서는 __dirname이 기본적으로 없음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Promisify fs.writeFile & fs.mkdir
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

// ResponsiveVoice API 키 (인증 완료됨)
const RV_API_KEY = 'cy08LzuY';

/**
 * ResponsiveVoice 서비스를 사용하여 텍스트를 음성 파일로 변환
 * @param {string} text - 음성으로 변환할 텍스트
 * @param {Object} options - 음성 변환 옵션
 * @returns {Promise<string>} - 생성된 음성 파일 경로
 */
export async function generateAudio(text, options = {}) {
  try {
    // 기본 옵션 설정
    const defaultOptions = {
      gender: 'female',
      lang: 'ko-KR',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    };

    // 사용자 옵션과 기본 옵션 병합
    const ttsOptions = { ...defaultOptions, ...options };
    
    // ResponsiveVoice는 한국어에 대해 Korean Female만 지원함
    const voice = 'Korean Female';
    
    // 남성 목소리 효과를 위한 음높이와 속도 조절
    if (ttsOptions.gender === 'male') {
      ttsOptions.pitch = Math.min(ttsOptions.pitch, 0.8);
      ttsOptions.rate = Math.min(ttsOptions.rate, 0.9);
    }
    
    // 임시 파일 디렉토리 생성
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      await mkdirAsync(tempDir, { recursive: true });
    }
    
    // 임시 파일 경로 생성
    const timestamp = Date.now();
    const outputPath = path.join(process.cwd(), `temp_rv_audio_${timestamp}.mp3`);
    
    console.log(`[ResponsiveVoice] 음성: ${voice}, 텍스트: ${text}`);
    
    // 원래 ResponsiveVoice API URL 사용
    const apiUrl = new URL('https://texttospeech.responsivevoice.org/v1/text:synthesize');
    
    // URL 파라미터 설정 - ResponsiveVoice 소스코드 참고
    const params = {
      text: text,
      key: RV_API_KEY,
      src: 'ResponsiveVoiceNode',
      hl: 'ko-KR',      // 한국어 코드
      r: ttsOptions.rate,      // 속도
      p: ttsOptions.pitch,     // 음높이
      v: ttsOptions.volume,    // 볼륨
      c: 'mp3',               // 파일 형식
      f: '44khz_16bit_stereo', // 오디오 품질
      sv: 'g3',               // 서버 버전 (g3은 한국어 지원 서버)
      gender: ttsOptions.gender, // 성별
      voice: 'Korean Female',   // 음성 타입
      lang: 'ko'                // 한국어 코드 (추가)
    };
    
    // URL 파라미터 추가
    Object.keys(params).forEach(key => {
      apiUrl.searchParams.append(key, params[key]);
    });
    
    const apiUrlString = apiUrl.toString();
    console.log(`[ResponsiveVoice] API URL: ${apiUrlString}`);
    
    // API 호출 및 MP3 다운로드
    const response = await fetch(apiUrlString);
    
    if (!response.ok) {
      throw new Error(`ResponsiveVoice API 오류: ${response.status} ${response.statusText}`);
    }
    
    // 응답 데이터를 파일로 저장
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFileAsync(outputPath, buffer);
    
    console.log(`[ResponsiveVoice] 음성 파일이 생성되었습니다: ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error('[ResponsiveVoice] TTS 생성 중 오류 발생:', error);
    throw error;
  }
}

/**
 * ResponsiveVoice를 사용하는 HTML 콘텐츠 생성
 * @param {string} text - 음성으로 변환할 텍스트
 * @param {string} voice - 음성 유형 (한국어는 Korean Female만 지원)
 * @param {Object} options - 음성 옵션
 * @returns {string} - HTML 콘텐츠
 */
// 이 파일은 이제 함수가 하나만 필요합니다 - generateAudio
