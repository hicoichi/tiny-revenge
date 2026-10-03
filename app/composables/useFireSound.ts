// 焚き火の音を、録音した本物の焚き火の音で鳴らす(合成音では不自然だったため)。
// 音は3層: 常に流れる焚き火の音(base)、炎が育つほど重なる燃え盛る音(roar)、くべた瞬間などに弾けるパチッ(crackle)。
//
// 音源はすべてFreesoundのCC0(パブリックドメイン)素材を切り出し・音量調整したもの。
// - fire-base.mp3: "campfire.wav" by Spandau https://freesound.org/s/40699/ (120〜210秒)
// - fire-roar.mp3: "Fire ambience, flames, crackles, pops, burning" by ahriik https://freesound.org/s/508110/
// - crackle-*.mp3: "Campfire Close Crackling Sticks" by FunWithSound https://freesound.org/s/588401/ から単発のパチッを切り出し
import { readonly, ref } from 'vue';

const SOUND_STORAGE_KEY = 'tiny-revenge:sound';
const CRACKLE_COUNT = 8;
// ループのつなぎ目は2つの再生を重ねてなめらかに切り替える。MP3は先頭・末尾にわずかな無音が入り、
// 単純なループ再生ではつなぎ目でプツッと途切れるため。
const LOOP_CROSSFADE_SEC = 3;
// ファイル末尾の無音を避けるため、終わりの少し手前で次の再生へ切り替える。
const LOOP_TAIL_MARGIN_SEC = 0.15;
const SCHEDULER_INTERVAL_MS = 250;

interface SoundBuffers {
    base: AudioBuffer;
    roar: AudioBuffer;
    crackles: AudioBuffer[];
}

interface FireSoundEngine {
    ctx: AudioContext;
    master: GainNode;
    baseGain: GainNode;
    roarGain: GainNode;
    buffers: SoundBuffers | null;
}

interface LoopState {
    buffer: AudioBuffer;
    output: GainNode;
    nextStartTime: number;
}

const isEnabled = ref(true);
let preferenceLoaded = false;
let engine: FireSoundEngine | null = null;
// null は炎がない(無音)状態。
let power: number | null = null;
let nextCrackleTime = 0;
const loops: LoopState[] = [];

function loadPreference() {
    if (preferenceLoaded || typeof window === 'undefined') return;
    preferenceLoaded = true;
    try {
        isEnabled.value = window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
    } catch {
        // 保存できない環境でも、音ありとして動けばよい。
    }
}

function savePreference() {
    try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, isEnabled.value ? 'on' : 'off');
    } catch {
        // noop
    }
}

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    // 古いSafariはdecodeAudioDataがPromiseを返さないため、コールバック形式で呼ぶ。
    return new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));
}

async function loadBuffers(ctx: AudioContext, baseUrl: string): Promise<SoundBuffers> {
    const [base, roar, ...crackles] = await Promise.all([
        loadBuffer(ctx, `${baseUrl}sounds/fire-base.mp3`),
        loadBuffer(ctx, `${baseUrl}sounds/fire-roar.mp3`),
        ...Array.from({ length: CRACKLE_COUNT }, (_, i) => loadBuffer(ctx, `${baseUrl}sounds/crackle-${i + 1}.mp3`)),
    ]);
    return { base: base!, roar: roar!, crackles };
}

// 等パワーのクロスフェード曲線(重なっている間も音量が落ち込まない)。
function fadeCurve(fadeIn: boolean): Float32Array {
    const curve = new Float32Array(64);
    for (let i = 0; i < curve.length; i += 1) {
        const t = i / (curve.length - 1);
        curve[i] = fadeIn ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
    }
    return curve;
}

// 1回分の再生を予約する。毎回ランダムな位置から始め、同じ流れの繰り返しに気づかれにくくする。
function scheduleLoopVoice(ctx: AudioContext, loop: LoopState) {
    const { buffer } = loop;
    const usable = buffer.duration - LOOP_TAIL_MARGIN_SEC;
    const offset = Math.random() * usable * 0.5;
    const length = usable - offset;
    const start = Math.max(loop.nextStartTime, ctx.currentTime);
    const end = start + length;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const voiceGain = ctx.createGain();
    // 曲線の開始時刻に別の値を予約すると、setValueCurveAtTimeは例外を投げる(重なる予約が禁止のため)。
    voiceGain.gain.setValueCurveAtTime(fadeCurve(true), start, LOOP_CROSSFADE_SEC);
    voiceGain.gain.setValueCurveAtTime(fadeCurve(false), end - LOOP_CROSSFADE_SEC, LOOP_CROSSFADE_SEC);
    source.connect(voiceGain).connect(loop.output);
    source.start(start, offset, length);

    loop.nextStartTime = end - LOOP_CROSSFADE_SEC;
}

// 録音から切り出したパチッを1発。毎回わずかに音の高さ・大きさ・左右の位置を変え、同じ音の繰り返しに聞こえないようにする。
function playCrackle(e: FireSoundEngine, at: number, loudness: number) {
    if (!e.buffers) return;
    const { crackles } = e.buffers;
    const source = e.ctx.createBufferSource();
    source.buffer = crackles[Math.floor(Math.random() * crackles.length)]!;
    source.playbackRate.value = 0.85 + Math.random() * 0.3;
    const gain = e.ctx.createGain();
    gain.gain.value = loudness * (0.35 + Math.random() * 0.65);

    let output: AudioNode = gain;
    // 古いSafariにはStereoPannerがない。
    if (typeof e.ctx.createStereoPanner === 'function') {
        const panner = e.ctx.createStereoPanner();
        panner.pan.value = (Math.random() - 0.5) * 1.2;
        gain.connect(panner);
        output = panner;
    }
    source.connect(gain);
    output.connect(e.master);
    source.start(at);
}

function update(e: FireSoundEngine) {
    const now = e.ctx.currentTime;
    const level = power ?? 0;
    // 録音そのものに自然な揺らぎがあるので、音量は炎の勢いにだけ合わせ、明滅では揺らさない。
    e.baseGain.gain.setTargetAtTime(power === null ? 0 : 0.55 + 0.45 * level, now, 0.5);
    e.roarGain.gain.setTargetAtTime(power === null ? 0 : 0.9 * level ** 1.2, now, 0.5);
    if (!e.buffers) return;

    for (const loop of loops) {
        if (loop.nextStartTime < now + 1) scheduleLoopVoice(e.ctx, loop);
    }

    // 燃え盛るほど、録音のパチパチに単発のパチッを足して密度を上げる(間隔はランダム)。
    if (power === null || level < 0.05) return;
    const rate = 2.5 * level;
    if (nextCrackleTime < now) nextCrackleTime = now - Math.log(1 - Math.random()) / rate;
    while (nextCrackleTime < now + SCHEDULER_INTERVAL_MS / 1000 + 0.1) {
        playCrackle(e, nextCrackleTime, 0.5);
        nextCrackleTime += -Math.log(1 - Math.random()) / rate;
    }
}

function createEngine(baseUrl: string): FireSoundEngine | null {
    const AudioCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    const ctx = new AudioCtor();

    // パチッが重なっても音割れしないよう、最後に軽く圧縮する。
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.ratio.value = 4;
    compressor.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = isEnabled.value ? 1 : 0;
    master.connect(compressor);
    const baseGain = ctx.createGain();
    baseGain.gain.value = 0;
    baseGain.connect(master);
    const roarGain = ctx.createGain();
    roarGain.gain.value = 0;
    roarGain.connect(master);

    const created: FireSoundEngine = { ctx, master, baseGain, roarGain, buffers: null };
    // 読み込めなかった場合は無音のまま儀式を続ける(音は体験の補助であり、止める理由にならない)。
    loadBuffers(ctx, baseUrl)
        .then((buffers) => {
            created.buffers = buffers;
            loops.push(
                { buffer: buffers.base, output: baseGain, nextStartTime: 0 },
                { buffer: buffers.roar, output: roarGain, nextStartTime: 0 },
            );
        })
        .catch(() => {});

    // 別のタブに切り替えている間は音を止める。
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) ctx.suspend();
        else ctx.resume();
    });

    window.setInterval(() => update(created), SCHEDULER_INTERVAL_MS);
    return created;
}

export function useFireSound() {
    loadPreference();
    const baseUrl = useRuntimeConfig().app.baseURL.replace(/\/?$/, '/');

    // ブラウザは操作(タップ・キー入力)の中でしか音を鳴らし始められないため、操作のたびに呼ぶ。
    function unlock() {
        if (!engine) engine = createEngine(baseUrl);
        engine?.ctx.resume();
    }

    // 炎の勢い(0〜1)。null で炎が消えて無音になる。
    function setPower(value: number | null) {
        power = value;
    }

    // 炎の勢いが増した瞬間(くべる・着火)に、パチパチと続けて弾けさせる。
    function burst() {
        if (!engine || power === null) return;
        const start = engine.ctx.currentTime + 0.01;
        const count = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i += 1) {
            playCrackle(engine, start + Math.random() * 0.6, i === 0 ? 1 : 0.7);
        }
    }

    function toggle() {
        isEnabled.value = !isEnabled.value;
        savePreference();
        if (engine) {
            engine.master.gain.setTargetAtTime(isEnabled.value ? 1 : 0, engine.ctx.currentTime, 0.05);
        }
    }

    return { isEnabled: readonly(isEnabled), unlock, setPower, burst, toggle };
}
