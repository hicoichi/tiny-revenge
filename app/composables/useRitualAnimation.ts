import gsap from 'gsap';

type TweenVars = gsap.TweenVars;

// gsap.to()の完了を待てるように、Tween完了時に解決するPromiseへ包む。
function tweenTo(el: gsap.TweenTarget, vars: TweenVars): Promise<void> {
    return new Promise((resolve) => {
        gsap.to(el, { ...vars, onComplete: resolve });
    });
}

// 儀式演出（紙の移動・変形、炎、灰、フェード、カメラ的な移動・ズーム）を GSAP で表現する。
// UI コンポーネントはここに定義した関数を呼び出すだけにし、アニメーションの詳細を持たない。
export function useRitualAnimation() {
    function appearPaper(el: HTMLElement) {
        gsap.set(el, { opacity: 0, y: 40, rotateX: 38, scale: 0.92 });
        return tweenTo(el, {
            opacity: 1,
            y: 0,
            rotateX: 0,
            scale: 1,
            duration: 2.2,
            ease: 'power3.out',
        });
    }

    function fadeInText(el: HTMLElement) {
        return new Promise<void>((resolve) => {
            gsap.fromTo(
                el,
                { opacity: 0 },
                { opacity: 1, duration: 1.8, ease: 'power1.out', onComplete: resolve },
            );
        });
    }

    function raisePaper(el: HTMLElement) {
        return tweenTo(el, {
            y: -58,
            scale: 0.86,
            duration: 2.8,
            ease: 'power2.inOut',
        });
    }

    function detachPaper(el: HTMLElement) {
        return tweenTo(el, {
            y: -14,
            rotate: 3,
            duration: 1.5,
            ease: 'power1.inOut',
        });
    }

    function dropPaper(el: HTMLElement) {
        return tweenTo(el, {
            y: 250,
            scale: 0.8,
            rotate: -9,
            duration: 1.1,
            ease: 'power2.in',
        });
    }

    function ignitePaper(el: HTMLElement) {
        return tweenTo(el, {
            filter: 'sepia(1) brightness(0.6)',
            boxShadow: '0 22px 60px rgba(255,120,20,.45)',
            duration: 1,
            ease: 'power1.in',
        });
    }

    function burnPaper(el: HTMLElement) {
        return tweenTo(el, {
            maskPosition: '0% 100%',
            webkitMaskPosition: '0% 100%',
            duration: 4.4,
            ease: 'none',
        });
    }

    function fadeOutPaper(el: HTMLElement) {
        return tweenTo(el, { opacity: 0, duration: 0.6 });
    }

    // 保存状態からの復元時など、演出を再生せずに休止状態の見た目へ即座に合わせる。
    function settlePaper(el: HTMLElement, phase: 'ready' | 'raised') {
        if (phase === 'raised') {
            gsap.set(el, { opacity: 1, y: -58, scale: 0.86, rotateX: 0 });
        } else {
            gsap.set(el, { opacity: 1, y: 0, scale: 1, rotateX: 0 });
        }
    }

    // 炎は表示されている間ずっと揺らぎ続けるループアニメーション。完了しないため呼び切りで良い。
    function loopFlame(el: HTMLElement) {
        return gsap.to(el, {
            scaleY: 1.15,
            scaleX: 0.95,
            opacity: 1,
            duration: 1.1,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
        });
    }

    function scatterAsh(els: HTMLElement[]) {
        if (els.length === 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
            gsap.to(els, {
                y: -120,
                x: 18,
                opacity: 0,
                duration: 3,
                stagger: 0.25,
                ease: 'power1.out',
                onComplete: resolve,
            });
        });
    }

    return {
        appearPaper,
        fadeInText,
        raisePaper,
        detachPaper,
        dropPaper,
        ignitePaper,
        burnPaper,
        fadeOutPaper,
        settlePaper,
        loopFlame,
        scatterAsh,
    };
}
