<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRevenge } from '~/composables/useRevenge';
import { useRevengeStorage } from '~/composables/useRevengeStorage';
import { useRitual } from '~/composables/useRitual';

const revenge = useRevenge();
const ritual = useRitual();
const storage = useRevengeStorage();

onMounted(() => {
    storage.init();
});

const screenKey = computed(() =>
    ritual.step.value === 'question'
        ? `question-${ritual.questionIndex.value}`
        : ritual.step.value,
);

function onAnswerUpdate(value: string) {
    revenge.setAnswer(ritual.currentQuestion.value.key, value);
}

function onRestart() {
    ritual.reset();
    revenge.resetRevenge();
    storage.clear();
}
</script>

<template>
    <div class="experience">
        <Transition name="rr-screen" mode="out-in">
            <RitualStart
                v-if="ritual.step.value === 'start'"
                key="start"
                @start="ritual.next()"
            />

            <RitualQuestionStep
                v-else-if="ritual.step.value === 'question'"
                :key="screenKey"
                :question="ritual.currentQuestion.value"
                :answer="revenge.answers[ritual.currentQuestion.value.key]"
                @update:answer="onAnswerUpdate"
                @back="ritual.back()"
                @next="ritual.next()"
            />

            <RitualConstraintStep
                v-else-if="ritual.step.value === 'constraint'"
                key="constraint"
                :constraints="revenge.constraints"
                :selected="revenge.constraint.value"
                @select="revenge.setConstraint"
                @back="ritual.back()"
                @next="ritual.next()"
            />

            <RitualVerbStep
                v-else-if="ritual.step.value === 'verb'"
                key="verb"
                :verbs="revenge.verbs"
                :selected="revenge.verb.value"
                @select="revenge.setVerb"
                @back="ritual.back()"
                @next="ritual.next()"
            />

            <RitualComposeStep
                v-else-if="ritual.step.value === 'compose'"
                key="compose"
                :constraint-label="revenge.constraint.value ?? ''"
                :verb-label="revenge.verb.value ?? ''"
                :vow="revenge.vow.value"
                :is-vow-valid="revenge.isVowValid.value"
                @update:vow="revenge.setVow"
                @back="ritual.back()"
                @decide="ritual.enterRite()"
            />

            <RitualStage v-else-if="ritual.step.value === 'rite'" key="rite" />

            <RitualVerdict
                v-else-if="ritual.step.value === 'verdict'"
                key="verdict"
                @restart="onRestart"
            />
        </Transition>
    </div>
</template>

<style scoped>
.experience {
    position: relative;
    min-height: 100vh;
    width: 100%;
    background: radial-gradient(
        120% 70% at 50% 8%,
        var(--rr-bg-glow) 0%,
        var(--rr-bg) 58%,
        var(--rr-bg-deep) 100%
    );
    color: var(--rr-ink);
    overflow: hidden;
}

.rr-screen-enter-active,
.rr-screen-leave-active {
    transition: opacity 0.6s ease;
}

.rr-screen-enter-from,
.rr-screen-leave-to {
    opacity: 0;
}
</style>
