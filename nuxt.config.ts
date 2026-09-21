// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2026-09-21',
    devtools: { enabled: true },
    css: ['~/assets/css/main.css'],
    app: {
        // GitHub Pages(プロジェクトページ)は /<repo名>/ 配下で配信されるため、
        // CI(nuxt generate)ではNUXT_APP_BASE_URLでこの値を上書きする。
        baseURL: process.env.NUXT_APP_BASE_URL || '/',
        head: {
            htmlAttrs: { lang: 'ja' },
            title: '復讐',
            meta: [
                {
                    name: 'description',
                    content: '日常の小さな決着をつけるための復讐の儀式。',
                },
                { name: 'viewport', content: 'width=device-width, initial-scale=1' },
            ],
            link: [
                { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
                {
                    rel: 'preconnect',
                    href: 'https://fonts.gstatic.com',
                    crossorigin: '',
                },
                {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;600;800&display=swap',
                },
            ],
        },
    },
    typescript: {
        strict: true,
    },
});
