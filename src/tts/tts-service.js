import 'dotenv/config';
import googleTTS from 'google-tts-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

// __dirname 설정 (ESM에서는 __dirname이 기본적으로 없음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// promisify fs.writeFile
const writeFileAsync = promisify(fs.writeFile);

/**
 * Google TTS API를 사용하여 텍스트를 음성 파일로 변환하는 함수
 * @param {string} text - 음성으로 변환할 텍스트
 * @param {Object} options - TTS 옵션 (선택사항)
 * @returns {Promise<string>} - 생성된 음성 파일 경로
 */
async function generateTTSAudio(text, options = {}) {
  try {
    // 기본 옵션 설정
    const defaultOptions = {
      lang: 'ko-KR',  // 기본 한국어 여성 음성
      host: 'https://translate.google.com',
    };
    
    // 사용자 옵션과 기본 옵션 병합
    const ttsOptions = { ...defaultOptions, ...options };
    
    // 임시 파일 경로 생성 (프로젝트 루트 디렉토리 기준)
    const outputPath = path.join(process.cwd(), `temp_audio_${Date.now()}.mp3`);
    
    // Google TTS API를 사용하여 URL 가져오기
    const url = googleTTS.getAudioUrl(text, ttsOptions);
    
    console.log(`사용된 언어 설정: ${ttsOptions.lang}`);
    console.log('발음 위한 URL:', url);
    
    // URL에서 오디오 다운로드
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TTS 서비스 오류: ${response.status} ${response.statusText}`);
    }
    
    // 응답 데이터를 바이너리로 변환
    const buffer = await response.arrayBuffer();
    const binaryData = Buffer.from(buffer);
    
    // 바이너리 데이터를 파일로 저장
    await writeFileAsync(outputPath, binaryData);
    
    console.log(`TTS 음성 파일이 생성되었습니다: ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error('TTS 생성 중 오류 발생:', error);
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
