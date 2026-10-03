export const HOLD_DECIDE_MS = 2200;
export const HOLD_COMPLETE_MS = 2600;

export const REVENGE_STORAGE_KEY = 'tiny-revenge:state:v1';

// 炎に落ちてから燃え尽きるまでの演出タイミング。
export const IGNITE_FLASH_MS = 350;
// 「穴が開く」前線が紙全体を覆い切るまでの時間。
export const BURN_FRONT_MS = 3600;
// 黒い炭の層は前線よりも少し遅れて追いかけるように消えていく。
export const BURN_CHAR_DELAY_MS = 550;
// WebGLで紙を燃やすときの、着火から燃え尽きるまでの時間。焦げ→炭→穴の変化を見せるため、穴だけの演出より長い。
export const PAPER_BURN_MS = 5600;
// 燃え尽きた後、最後の灰が舞い落ちるのを見届ける時間。
export const ASH_SETTLE_MS = 1400;
