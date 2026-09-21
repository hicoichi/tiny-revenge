<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { HOLD_DECIDE_MS } from '~/constants/revenge';
import {
    MAX_CUSTOM_ACT_LENGTH,
    MIN_CUSTOM_ACT_LENGTH,
    REVENGE_STAGES,
} from '~/constants/revengeStages';
import { useRevenge } from '~/composables/useRevenge';
import { useRitual } from '~/composables/useRitual';
import { useRitualAnimation } from '~/composables/useRitualAnimation';

// 白木(何も書かれていない護摩木)に表示する文言。
const BLANK_LABEL = '自分で書く';

// 選択(select)と確認(decide)は炉と炎を共有する一続きの場面のため、1つのコンポーネントで扱う。
// 画面を分けると、選ぶたびに育ててきた炎が確認画面で途切れてしまう。
const revenge = useRevenge();
const ritual = useRitual();
const anim = useRitualAnimation();

const hearthRef = ref<{ getFireRect: () => DOMRect | null } | null>(null);
const handEl = ref<HTMLElement | null>(null);
const writeInputEl = ref<HTMLInputElement | null>(null);
const isOffering = ref(false);
const offeringLabel = ref<string | null>(null);

// 選択肢が多い段階では、先に系統を選んでから護摩木を選ぶ。
const activeGroupLabel = ref<string | null>(null);

// 白木に自分で書く行為。書き終えるまでは護摩木として並べず、入力欄を出す。
const isWriting = ref(false);
const customText = ref('');
const customLabel = ref<string | null>(null);

const isSelecting = computed(() => ritual.step.value === 'select');
const stage = computed(() => REVENGE_STAGES[ritual.selectIndex.value]!);
const currentIndex = computed(() => (isSelecting.value ? ritual.selectIndex.value : null));
const flamePower = computed(() => revenge.pickedCount.value / REVENGE_STAGES.length);

const groups = computed(() => revenge.groupsFor(stage.value));
const hasGroupChoice = computed(() => groups.value.length > 1);
const activeGroup = computed(
    () => groups.value.find((group) => group.label === activeGroupLabel.value) ?? null,
);
const shownItems = computed(() => activeGroup.value?.items ?? []);
const showCustom = computed(() => Boolean(stage.value.allowsCustom) && activeGroup.value !== null);
const maxChars = computed(() =>
    Math.max(
        1,
        ...shownItems.value.map((item) => item.length),
        showCustom.value ? BLANK_LABEL.length : 0,
    ),
);
const customTabletLabel = computed(() => customLabel.value ?? BLANK_LABEL);
const isCustomWide = computed(
    () => customLabel.value !== null && customLabel.value.length > maxChars.value,
);
const canSubmitCustom = computed(() => customText.value.trim().length >= MIN_CUSTOM_ACT_LENGTH);

// 段階が変わったら、系統の選択と書きかけの内容を初期化する。系統が1つしかない段階は最初から選択済みにする。
watch(
    groups,
    (next) => {
        activeGroupLabel.value = next.length === 1 ? next[0]!.label : null;
        isWriting.value = false;
        customText.value = '';
        customLabel.value = null;
    },
    { immediate: true },
);

function wait(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// 選んだ護摩木を炉へくべ、炎が育つのを見届けてから次の段階へ進む。
async function onPick(label: string, el: HTMLElement | null) {
    if (isOffering.value) return;
    isOffering.value = true;
    offeringLabel.value = label;

    const fireRect = hearthRef.value?.getFireRect();
    if (fireRect && el) await anim.offerGomagi(el, fireRect);
    revenge.setPick(stage.value.key, label);
    await wait(600);

    ritual.next();
    isOffering.value = false;
    offeringLabel.value = null;
}

function selectGroup(label: string) {
    if (isOffering.value) return;
    activeGroupLabel.value = label;
}

// 白木を選んだら、まず墨で書く入力欄を出す。
async function startWriting() {
    if (isOffering.value) return;
    isWriting.value = true;
    await nextTick();
    writeInputEl.value?.focus();
}

function cancelWriting() {
    isWriting.value = false;
    customText.value = '';
}

// 書き終えたら、その文言の護摩木としてくべる。
async function submitCustom() {
    if (!canSubmitCustom.value || isOffering.value) return;
    const text = customText.value.trim();
    customLabel.value = text;
    isWriting.value = false;
    await nextTick();
    const el = handEl.value?.querySelector<HTMLElement>('[data-custom]') ?? null;
    await onPick(text, el);
}

function onRewind(index: number) {
    if (isOffering.value) return;
    revenge.clearPicksFrom(index);
    ritual.rewindTo(index);
}
</script>

<template>
    <div class="offering" :style="{ '--fire-lv': revenge.pickedCount.value }">
        <div class="offering__floor" />

        <div class="offering__scroll">
            <RitualVowSentence
                :picks="revenge.picks"
                :current-index="currentIndex"
                :dimmed="!isSelecting"
                @rewind="onRewind"
            />

            <Transition name="rr-stage" mode="out-in">
                <section v-if="isSelecting" :key="stage.key" class="offering__stage">
                    <p class="offering__mark">{{ stage.mark }}</p>
                    <h1 class="offering__title">
                        {{ stage.title }}
                        <span v-if="stage.note" class="offering__note">{{ stage.note }}</span>
                    </h1>

                    <div v-if="hasGroupChoice" class="offering__groups" role="group" aria-label="系統">
                        <button
                            v-for="group in groups"
                            :key="group.label"
                            type="button"
                            class="offering__group"
                            :class="{ 'offering__group--active': group.label === activeGroupLabel }"
                            :aria-pressed="group.label === activeGroupLabel"
                            :disabled="isOffering"
                            @click="selectGroup(group.label)"
                        >
                            {{ group.label }}
                        </button>
                    </div>

                    <p v-if="hasGroupChoice && !activeGroup" class="offering__hint">系統を選べ。</p>

                    <div v-else-if="isWriting" class="offering__write">
                        <p class="offering__write-title">墨で、一行だけ書き記せ。</p>
                        <input
                            ref="writeInputEl"
                            v-model="customText"
                            type="text"
                            class="offering__write-input"
                            :maxlength="MAX_CUSTOM_ACT_LENGTH"
                            placeholder="例：夜のうちに、返信せず眠る"
                            aria-label="行為を自分の言葉で書く"
                            @keydown.enter.prevent="submitCustom"
                        />
                        <div class="offering__write-actions">
                            <button
                                type="button"
                                class="offering__write-submit"
                                :disabled="!canSubmitCustom"
                                @click="submitCustom"
                            >
                                く べ る
                            </button>
                            <button type="button" class="offering__write-cancel" @click="cancelWriting">
                                や め る
                            </button>
                        </div>
                    </div>

                    <div v-else :key="activeGroupLabel ?? 'none'" ref="handEl" class="offering__hand">
                        <RitualGomagi
                            v-for="(item, index) in shownItems"
                            :key="item"
                            :label="item"
                            :index="index"
                            :max-chars="maxChars"
                            :dimmed="isOffering && offeringLabel !== item"
                            :disabled="isOffering"
                            @pick="onPick"
                        />
                        <RitualGomagi
                            v-if="showCustom"
                            key="custom"
                            data-custom
                            :label="customTabletLabel"
                            :index="shownItems.length"
                            :max-chars="maxChars"
                            :dimmed="false"
                            :disabled="isOffering"
                            :blank="customLabel === null"
                            :wide="isCustomWide"
                            @pick="startWriting"
                        />
                    </div>
                </section>

                <section v-else key="decide" class="offering__decide">
                    <div class="offering__paper">
                        <p class="offering__vow">{{ revenge.vow.value }}</p>
                    </div>
                    <div class="offering__hold">
                        <RitualHoldButton
                            label="復 讐 を 決 め る"
                            :hold-ms="HOLD_DECIDE_MS"
                            @complete="ritual.enterRite()"
                        />
                    </div>
                    <p class="offering__note-small">これが、お前の復讐だ。</p>
                    <button type="button" class="offering__redo" @click="onRewind(0)">
                        選 び 直 す
                    </button>
                </section>
            </Transition>

            <RitualHearth ref="hearthRef" :power="flamePower" />
        </div>
    </div>
</template>

<style scoped>
.offering {
    position: absolute;
    inset: 0;
    overflow: hidden;
}

/* 炎が育つほど、周囲の空間がうっすら赤く照らされる。 */
.offering__floor {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
        ellipse 75% 45% at 50% 100%,
        rgba(255, 120, 30, 0.3),
        transparent 72%
    );
    opacity: calc(0.12 + var(--fire-lv, 0) * 0.16);
    transition: opacity 1.4s;
}

.offering__scroll {
    position: absolute;
    inset: 0;
    max-width: 1040px;
    margin: 0 auto;
    padding: 16px 16px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
}

.offering__stage,
.offering__decide {
    margin-top: 12px;
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.offering__mark {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.42em;
    color: var(--rr-ink-faint);
}

.offering__title {
    margin: 10px 0 0;
    font-size: clamp(20px, 5.4vw, 26px);
    font-weight: 600;
    line-height: 1.7;
    letter-spacing: 0.1em;
    text-align: center;
    /* スマホは縦幅が足りないため、タイトルは改行せず1行に収める(PCでは改行を生かす)。 */
    white-space: normal;
    color: var(--rr-ink-brightest);
}

.offering__note {
    display: block;
    margin-top: 0;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0.3em;
    color: var(--rr-ink-faint);
}

/* 系統の選択。護摩木を選ぶ前に、探す範囲を絞る。 */
.offering__groups {
    margin-top: 12px;
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
}

.offering__group {
    background: none;
    border: 1px solid var(--rr-border-soft);
    padding: 7px 11px;
    font-size: 12px;
    letter-spacing: 0.16em;
    color: var(--rr-ink-soft);
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.4s, color 0.4s, background 0.4s;
}

.offering__group:hover:not(:disabled) {
    border-color: var(--rr-border-selected);
}

.offering__group--active {
    border-color: var(--rr-gold);
    color: var(--rr-ink-brightest);
    background: var(--rr-hold-fill);
}

.offering__group:focus-visible,
.offering__write-submit:focus-visible,
.offering__write-cancel:focus-visible {
    outline: 2px solid var(--rr-gold);
    outline-offset: 3px;
}

.offering__hint {
    margin: 24px 0 0;
    font-size: 13px;
    letter-spacing: 0.34em;
    color: var(--rr-ink-faint);
}

.offering__hand {
    margin-top: 14px;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    gap: 10px 8px;
}

/* 白木に自分で書く入力欄。 */
.offering__write {
    margin-top: 20px;
    width: min(340px, 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    animation: rr-in 0.6s ease both;
}

.offering__write-title {
    margin: 0;
    font-size: 15px;
    letter-spacing: 0.24em;
    color: var(--rr-ink-strong);
}

.offering__write-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--rr-border);
    color: var(--rr-ink-brightest);
    font-family: inherit;
    font-size: 17px;
    letter-spacing: 0.1em;
    padding: 14px 16px;
}

.offering__write-input:focus {
    border-color: var(--rr-border-selected);
}

.offering__write-actions {
    display: flex;
    align-items: center;
    gap: 22px;
}

.offering__write-submit {
    background: none;
    border: 1px solid var(--rr-flame-border);
    color: var(--rr-flame-ink);
    padding: 13px 34px;
    font-size: 14px;
    letter-spacing: 0.4em;
    cursor: pointer;
    font-family: inherit;
}

.offering__write-submit:disabled {
    border-color: var(--rr-border-soft);
    color: var(--rr-ink-dim);
    cursor: default;
}

.offering__write-cancel {
    background: none;
    border: none;
    color: var(--rr-ink-muted);
    font-size: 12px;
    letter-spacing: 0.3em;
    cursor: pointer;
    padding: 10px 4px;
    font-family: inherit;
}

.offering__decide {
    margin-top: 8px;
}

.offering__paper {
    width: min(280px, 76vw);
    height: clamp(300px, 44dvh, 360px);
    padding: 20px 18px;
    border-radius: 2px;
    background: linear-gradient(160deg, var(--rr-paper), var(--rr-paper-dark));
    color: var(--rr-paper-ink);
    box-shadow: 0 0 70px rgba(255, 138, 31, 0.14), 0 24px 50px rgba(0, 0, 0, 0.65);
    display: flex;
    justify-content: center;
}

.offering__vow {
    margin: 0;
    writing-mode: vertical-rl;
    white-space: pre-line;
    font-size: 14px;
    font-weight: 600;
    line-height: 2.2;
    letter-spacing: 0.1em;
}

.offering__hold {
    margin-top: 14px;
    width: min(300px, 100%);
}

.offering__note-small {
    margin: 10px 0 0;
    font-size: 11px;
    letter-spacing: 0.34em;
    color: var(--rr-ink-faint);
}

.offering__redo {
    margin-top: 2px;
    background: none;
    border: none;
    font-size: 12px;
    letter-spacing: 0.3em;
    color: var(--rr-ink-faint);
    cursor: pointer;
    padding: 6px;
    font-family: inherit;
}

.offering__redo:hover {
    color: var(--rr-ink);
}

.rr-stage-enter-active,
.rr-stage-leave-active {
    transition: opacity 0.5s ease;
}

.rr-stage-enter-from,
.rr-stage-leave-to {
    opacity: 0;
}

/* PC: 護摩木を大きく一列に並べ、炉を広い空間の奥に据える。 */
@media (min-width: 880px) {
    .offering__scroll {
        padding: 44px 16px 20px;
    }

    .offering__stage {
        margin-top: 40px;
    }

    .offering__title {
        font-size: clamp(22px, 2.4vw, 30px);
        white-space: pre-line;
    }

    .offering__note {
        margin-top: 2px;
    }

    .offering__groups {
        margin-top: 22px;
    }

    .offering__groups {
        max-width: 720px;
    }

    .offering__hand {
        max-width: 860px;
        margin-top: 44px;
        gap: 16px 18px;
    }

    .offering__decide {
        margin-top: 20px;
    }

    .offering__paper {
        width: 340px;
        height: clamp(420px, 56vh, 540px);
        padding: 34px 28px;
    }

    .offering__vow {
        font-size: 21px;
        line-height: 2.3;
        letter-spacing: 0.12em;
    }

    .offering__hold {
        margin-top: 22px;
    }

    .offering__note-small {
        margin-top: 18px;
    }
}
</style>
