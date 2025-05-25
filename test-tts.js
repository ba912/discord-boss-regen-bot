import { generateTTSAudio, cleanupTTSFile } from './src/tts/tts-service.js';

async function testTTS() {
  console.log('TTS 테스트 시작...');
  
  try {
    // 실제 사용할 메세지
    const bossText = '베나투스 리젠이 5분남았습니다.';
    
    // ResponsiveVoice TTS (기본 - 여성 목소리)
    console.log('\n=== ResponsiveVoice TTS - 한국어 여성 목소리 ===');
    console.log('옵션: ResponsiveVoice TTS 한국어 여성 목소리');
    const rvFemalePath = await generateTTSAudio(bossText, {
      gender: 'female',
      pitch: 1.0,
      rate: 0.7,  // 더 느리게 설정 (0.7)
      volume: 1.0
    });
    console.log(`생성된 파일: ${rvFemalePath}`);
    console.log('재생하려면: afplay ' + rvFemalePath);
    
    console.log('\n테스트 완료!');
    console.log('생성된 파일을 확인해보세요. 재생 명령어:');
    console.log(`ResponsiveVoice (여성, 느린 속도): afplay ${rvFemalePath}`);
    // 테스트용 다른 옵션들은 제거했습니다.
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  }
}

// 테스트 실행
testTTS();
