# Coding Standards

このプロジェクトのコード品質・構造・実装方針を定義します。

## TypeScript

TypeScriptを使用します。

可能な限り型を明示し、`any`の使用は避けてください。

```ts
// Good
interface Revenge {
    content: string;
    status: RevengeStatus;
}

// Avoid
const revenge: any = {};
```

`unknown`で十分な場合は`any`ではなく`unknown`を使用してください。

## Vue Components

Vue Single File Component（`.vue`）を基本とします。

コンポーネントは単一責任を意識してください。

例えば、

```text
components/
├── ritual/
│   ├── RitualStage.vue
│   ├── RitualPaper.vue
│   ├── RitualFlame.vue
│   └── RitualAsh.vue
```

のように、意味のある単位で分割してください。

ただし、細かく分割しすぎないでください。

「再利用されるから」という理由だけでコンポーネントを作る必要はありません。

## Naming

### Components

PascalCaseを使用します。

```text
RevengeInput.vue
RitualPaper.vue
CompletionButton.vue
```

### Functions

camelCaseを使用します。

```ts
createRevenge();
completeRevenge();
startBurningAnimation();
```

### Variables

camelCaseを使用します。

```ts
const revengeContent = ref('');
const isCompleted = ref(false);
```

### Constants

UPPER_SNAKE_CASEを使用します。

```ts
const MAX_REVENGE_LENGTH = 200;
```

## Composables

複数のコンポーネントから利用する状態やロジックはComposableへの切り出しを検討してください。

例：

```text
composables/
├── useRevenge.ts
├── useRitual.ts
└── useRitualAnimation.ts
```

ただし、すべてをComposableにする必要はありません。

単一コンポーネントだけで使用する単純な処理は、そのコンポーネント内に置いてください。

## Business Logic

UIとビジネスロジックを可能な限り分離してください。

例えば、

```text
UI
↓
Composable
↓
Domain / Logic
```

という依存方向を基本とします。

アニメーション処理も、可能な範囲でUIコンポーネントの責務と状態管理の責務を分離してください。

## Template

Vue template内に複雑なロジックを書かないでください。

```vue
<!-- Avoid -->
<div v-if="revenge.status === 'completed' && revenge.content.length > 0 && !isAnimating">
```

条件が複雑になる場合はcomputedなどに切り出してください。

## CSS

グローバルCSSは最小限にしてください。

コンポーネント固有のスタイルはScoped CSSなどを利用し、意図しない影響を避けてください。

ただし、デザインシステムとして共通化すべきtokensやvariablesはグローバルに定義して構いません。

## Responsive Design

SPとPCの両方を正式にサポートします。

単純な画面幅による縮小ではなく、必要に応じてレイアウトを変更してください。

```text
SP
↓
縦方向・集中したUI

PC
↓
余白・空間・奥行きを活かしたUI
```

ただし、SPとPCでプロダクト体験そのものを変えないでください。

## Accessibility

基本的なアクセシビリティを維持してください。

- semantic HTML
- 適切なbutton要素
- キーボード操作
- focus state
- form label
- 十分なコントラスト

などを考慮してください。

ただし、アクセシビリティのためにプロダクトの世界観を不必要に損なわないようにしてください。

## Error Handling

ユーザーに意味のない技術的エラーを直接表示しないでください。

エラー状態はプロダクトの世界観を維持しながら、ユーザーが次に何をすればよいか分かるようにしてください。

## Comments

コードから明らかな内容をコメントしないでください。

コメントは、

- なぜこの実装になっているか
- なぜ通常とは異なる実装をしているか
- 将来変更する際に注意すべきこと

など、コードだけでは分からない理由を書くために使用してください。

## Avoid Overengineering

MVPでは過剰な抽象化を避けてください。

将来的に必要になるかもしれない機能のために、

- 不要なinterface
- 不要なservice layer
- 不要なrepository pattern
- 不要なstate management
- 不要なutility
- 不要なpackage

を追加しないでください。

まず現在必要なものをシンプルに実装してください。
