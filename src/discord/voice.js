import { VoiceChannel } from 'discord.js';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  NoSubscriberBehavior
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
 * 음성 채널에 연결하는 함수
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
    
    // 음성 채널에 연결
    currentConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false, // 자신의 소리를 들을 수 있도록 설정
      selfMute: false  // 음소거 해제
    });
    
    // 연결 상태 이벤트 처리
    currentConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log('연결이 끊어졌습니다. 재연결 시도...');
      try {
        // 재연결 시도
        await connectToVoiceChannel(client);
      } catch (error) {
        console.error('재연결 시도 중 오류 발생:', error);
      }
    });
    
    // 연결 오류 처리
    currentConnection.on('error', (error) => {
      console.error('음성 연결 오류:', error);
    });
    
    console.log('음성 채널에 성공적으로 연결되었습니다!');
    return currentConnection;
  } catch (error) {
    console.error('음성 채널 연결 실패:', error);
    return null;
  }
}

/**
 * 오디오 파일을 재생하는 함수
 * @param {string} audioFilePath - 재생할 오디오 파일 경로
 * @returns {Promise<Object|null>} - 구독 객체 또는 null
 */
async function playAudio(audioFilePath) {
  try {
    if (!currentConnection) {
      console.error('음성 연결이 없습니다. 먼저 연결해야 합니다.');
      return null;
    }
    
    // 파일이 존재하는지 확인
    await new Promise((resolve, reject) => {
      fs.access(audioFilePath, fs.constants.F_OK, (err) => {
        if (err) {
          console.error(`파일이 존재하지 않습니다: ${audioFilePath}`);
          reject(err);
        } else {
          console.log(`파일 접근 가능: ${audioFilePath}`);
          resolve();
        }
      });
    });
    
    // 기존 임시 파일 경로 정리 및 새 경로 설정
    currentAudioPath = audioFilePath;
    
    // 파일 스트림 생성
    const fileStream = createReadStream(audioFilePath);
    
    // 오디오 리소스 생성 및 재생
    const resource = createAudioResource(fileStream, {
      inputType: StreamType.Arbitrary,  // 임의 스트림 형식
      inlineVolume: true  // 볼륨 조절 가능
    });
    
    // 볼륨 설정
    if (resource.volume) {
      resource.volume.setVolume(1.0); // 최대 볼륨
      console.log('볼륨이 설정되었습니다');
    }
    
    // 오디오 재생 시작
    player.play(resource);
    console.log('오디오 재생 시작');
    
    // 연결 객체와 플레이어 연결
    const subscription = currentConnection.subscribe(player);
    console.log('연결에 플레이어 구독 완료:', subscription ? '성공' : '실패');
    
    return subscription;
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
