import { VoiceChannel } from 'discord.js';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  NoSubscriberBehavior,
  entersState,
  getVoiceConnection
} from '@discordjs/voice';
import { createReadStream } from 'fs';
import fs from 'fs';

// 전역 변수 선언
let currentConnection = null;
let currentAudioPath = null;

// 전역 오디오 플레이어 생성 - 고급 옵션 적용
const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play, // 구독자가 없어도 재생 지속
  },
  debug: true // 디버그 메시지 활성화
});

// 플레이어 상태 이벤트 처리 - 한 번만 설정
player.on(AudioPlayerStatus.Idle, () => {
  console.log('재생 완료');
  
  // 음성 채널 연결은 유지하고 임시 파일만 삭제
  if (currentAudioPath) {
    fs.unlink(currentAudioPath, (err) => {
      if (err) console.error('임시 파일 삭제 중 오류:', err);
      else console.log('임시 파일 삭제 완료');
      currentAudioPath = null;
    });
  }
});

/**
 * 음성 채널에 연결하는 함수 - 개선된 버전
 * @param {Client} client - Discord 클라이언트 객체 
 * @returns {Promise<Object|null>} - 음성 연결 객체 또는 null
 */
async function connectToVoiceChannel(client) {
  try {
    const voiceChannelId = process.env.VOICE_CHANNEL_ID;
    if (!voiceChannelId) {
      console.error('VOICE_CHANNEL_ID가 .env 파일에 설정되어 있지 않습니다.');
      return null;
    }
    
    // 음성 채널 가져오기
    const voiceChannel = await client.channels.fetch(voiceChannelId);
    if (!voiceChannel || !(voiceChannel instanceof VoiceChannel)) {
      console.error('유효한 음성 채널을 찾을 수 없습니다.');
      return null;
    }
    
    // 기존 연결 확인 및 제거
    const existingConnection = getVoiceConnection(voiceChannel.guild.id);
    if (existingConnection) {
      console.log('기존 연결을 발견했습니다. 연결을 다시 설정합니다.');
      existingConnection.destroy();
    }
    
    // 새 음성 채널 연결 생성
    console.log(`${voiceChannel.name} 음성 채널에 연결하는 중...`);
    currentConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false, // 자신의 소리를 들을 수 있도록 설정
      selfMute: false  // 음소거 해제
    });
    
    // 연결 상태 변화 처리
    currentConnection.on(VoiceConnectionStatus.Connecting, () => {
      console.log('음성 연결 상태: Connecting');
    });
    
    currentConnection.on(VoiceConnectionStatus.Signalling, () => {
      console.log('음성 연결 상태: Signalling');
    });
    
    currentConnection.on(VoiceConnectionStatus.Ready, () => {
      console.log('음성 연결 상태: Ready - 오디오 재생 준비 완료!');
    });
    
    // 연결 끊김 처리 - 접속 재시도 로직 추가
    currentConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        console.log('연결이 끊어졌습니다. 자동 재연결 시도...');
        
        // 재연결 시도
        await Promise.race([
          entersState(currentConnection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(currentConnection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        
        // 연결이 진행중이면 Ready 상태로 전환 대기
        await entersState(currentConnection, VoiceConnectionStatus.Ready, 5_000);
        console.log('재연결 성공: 연결이 Ready 상태로 복구되었습니다.');
      } catch (error) {
        // 재연결 실패시 새 연결 시도
        console.warn('재연결 시도 실패, 새 연결을 생성합니다:', error.message);
        currentConnection.destroy();
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        await connectToVoiceChannel(client);
      }
    });
    
    // 연결 오류 처리
    currentConnection.on('error', (error) => {
      console.error('음성 연결 오류:', error);
    });
    
    // Ready 상태로 전환 대기 시도
    try {
      // Ready 상태로 전환을 위한 추가 시도 (최대 5초 대기)
      await entersState(currentConnection, VoiceConnectionStatus.Ready, 5000);
      console.log('음성 채널에 성공적으로 연결되었습니다!');
    } catch (error) {
      // 대기 시간 초과 시에도 연결 객체 반환
      console.warn('연결이 Ready 상태에 도달하지 못했지만 계속 진행합니다:', error.message);
      console.log(`현재 연결 상태: ${currentConnection.state.status}`);
    }
    
    return currentConnection;
  } catch (error) {
    console.error('음성 채널 연결 실패:', error);
    return null;
  }
}

/**
 * 오디오 파일을 재생하는 함수 - 개선된 버전
 * @param {string} audioFilePath - 재생할 오디오 파일 경로
 * @returns {Promise<Object|null>} - 구독 객체 또는 null
 */
async function playAudio(audioFilePath) {
  try {
    // 연결 객체 유효성 확인
    if (!currentConnection) {
      console.error('음성 연결이 없습니다. 먼저 연결해야 합니다.');
      return null;
    }
    
    // 연결 상태 확인 및 재생 시도
    console.log(`현재 연결 상태: ${currentConnection.state.status}`);
    
    // Ready 상태가 아닌 경우 재연결 시도
    if (currentConnection.state.status !== VoiceConnectionStatus.Ready) {
      console.log('연결이 Ready 상태가 아닙니다. Ready 상태로 전환 시도 중...');
      
      try {
        // Ready 상태로 전환 시도 (5초 대기)
        await entersState(currentConnection, VoiceConnectionStatus.Ready, 5000);
        console.log('연결이 Ready 상태로 전환되었습니다!');
      } catch (error) {
        // 시간 초과시에도 계속 진행
        console.warn('연결이 Ready 상태로 전환되지 않았지만 오디오 재생을 시도합니다:', error.message);
      }
    } else {
      console.log('연결이 이미 Ready 상태입니다. 오디오 재생 준비 완료!');
    }
    
    // 파일 존재 여부 확인
    try {
      await fs.promises.access(audioFilePath, fs.constants.F_OK);
      console.log(`파일 접근 가능: ${audioFilePath}`);
      
      // 파일 크기 확인 - 유효한 오디오 파일인지 확인
      const stats = await fs.promises.stat(audioFilePath);
      console.log(`파일 크기: ${stats.size} 바이트`);
      
      if (stats.size === 0) {
        throw new Error('파일 크기가 0입니다. 오디오 데이터가 없습니다.');
      }
    } catch (error) {
      console.error(`파일 접근 오류: ${error.message}`);
      throw error; // 오류를 상위로 전파하여 함수 종료
    }
    
    // 현재 재생중인 오디오 정보 업데이트
    currentAudioPath = audioFilePath;
    
    // 파일 스트림 생성
    const fileStream = createReadStream(audioFilePath);
    
    // 오디오 리소스 생성 - 고급 옵션 적용
    const resource = createAudioResource(fileStream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,    // 볼륨 조절 가능
    });
    
    // 볼륨 최대로 설정
    if (resource.volume) {
      resource.volume.setVolume(1.0);
      console.log('볼륨이 최대로 설정되었습니다.');
    }
    
    // 연결 객체 상태 상세 로깅 (디버그용)
    console.log('연결 객체 상태 세부 정보:', JSON.stringify({
      status: currentConnection.state.status,
      adapter: currentConnection.state.adapter ? '존재함' : '없음',
      networking: currentConnection.state.networking ? '존재함' : '없음',
      subscription: currentConnection.state.subscription ? '존재함' : '없음'
    }));
    
    // 플레이어로 오디오 재생 시작
    player.play(resource);
    console.log('오디오 재생이 시작되었습니다.');
    
    // 연결과 플레이어 연결
    const subscription = currentConnection.subscribe(player);
    
    if (subscription) {
      console.log('플레이어 구독 성공! 오디오가 재생됩니다.');
      return subscription;
    } else {
      console.error('플레이어 구독 실패! 연결이 불안정할 수 있습니다.');
      return null;
    }
  } catch (error) {
    console.error('오디오 재생 설정 중 오류:', error);
    return null;
  }
}

/**
 * 음성 채널 연결 종료 함수
 */
function disconnectVoiceChannel() {
  if (currentConnection) {
    try {
      if (player) {
        player.stop();
      }
      currentConnection.destroy();
      currentConnection = null;
      console.log('음성 채널 연결이 종료되었습니다.');
    } catch (error) {
      console.error('음성 채널 연결 종료 중 오류:', error);
    }
  }
}

export { 
  player, 
  connectToVoiceChannel, 
  playAudio, 
  disconnectVoiceChannel,
  currentConnection,
  currentAudioPath
};
