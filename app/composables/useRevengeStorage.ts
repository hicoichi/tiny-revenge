import { watch } from 'vue';
import { REVENGE_STORAGE_KEY } from '~/constants/revenge';
import { useRevenge } from '~/composables/useRevenge';
import { useRitual } from '~/composables/useRitual';
import type { RevengeSnapshot, RitualSnapshot } from '~/types/revenge';

interface PersistedState {
    version: 3;
    ritual: RitualSnapshot;
    revenge: RevengeSnapshot;
}

function isPersistedState(data: unknown): data is PersistedState {
    return (
        typeof data === 'object' &&
        data !== null &&
        (data as { version?: unknown }).version === 3
    );
}

let watching = false;

// 復讐が決定してから決行するまでの間に離脱しても再開できるよう、
// 誓いの内容と儀式の進行状況をlocalStorageへ保存/復元する。
// バックエンドを持たないMVP方針のため、永続化先はlocalStorageのみとする。
export function useRevengeStorage() {
    const revenge = useRevenge();
    const ritual = useRitual();

    function load() {
        if (typeof window === 'undefined') return;
        let raw: string | null;
        try {
            raw = window.localStorage.getItem(REVENGE_STORAGE_KEY);
        } catch {
            return;
        }
        if (!raw) return;
        let data: unknown;
        try {
            data = JSON.parse(raw);
        } catch {
            return;
        }
        if (!isPersistedState(data)) return;
        revenge.hydrate(data.revenge);
        ritual.hydrate(data.ritual);
        // 選択が欠けたまま復讐の確定・儀式へ進んだ状態は成立しないため、最初からやり直す。
        const needsCompleteVow = ['decide', 'rite', 'verdict'].includes(ritual.step.value);
        if (needsCompleteVow && !revenge.isComplete.value) {
            ritual.reset();
            revenge.resetRevenge();
        }
    }

    function save() {
        if (typeof window === 'undefined') return;
        const data: PersistedState = {
            version: 3,
            ritual: ritual.snapshot(),
            revenge: revenge.snapshot(),
        };
        try {
            window.localStorage.setItem(REVENGE_STORAGE_KEY, JSON.stringify(data));
        } catch {
            // 保存容量超過やプライベートモード等は復讐の体験自体を止める理由にならない。
        }
    }

    function clear() {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.removeItem(REVENGE_STORAGE_KEY);
        } catch {
            // noop
        }
    }

    // アプリ全体で一度だけ、保存済み状態の読み込みと以降の自動保存を開始する。
    function init() {
        if (watching) return;
        watching = true;
        load();
        watch(
            () => [
                ritual.step.value,
                ritual.selectIndex.value,
                ritual.ritePhase.value,
                revenge.picks.target,
                revenge.picks.deed,
                revenge.picks.verb,
                revenge.picks.act,
                revenge.picks.constraint,
            ],
            save,
        );
    }

    return { init, clear };
}
