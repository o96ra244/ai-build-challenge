# AI Build Challenge 記録

30日間で15作品を公開するチャレンジの記録です。

## 作品01

- **作品番号:** 01
- **作品名:** 画像比率リサイズ計算機
- **制作日:** 2026-08-03
- **対象ユーザー:** Web制作者、ブロガー、SNS投稿者、画像を指定サイズへ変更したい一般利用者
- **解決する問題:** 元画像の縦横比を崩さないリサイズ値と、CSSで使う簡約比を手計算する手間や計算ミスを減らします。
- **差別化:** リサイズ後のサイズ、簡約した縦横比、コピー可能なサイズ表記と`aspect-ratio`宣言を1つの結果領域へまとめました。
- **主な機能:** 幅・高さ基準のリサイズ計算、整数入力の検証、縦横比の簡約、サイズ・CSSのコピー、入力エラー時のフォーカス移動
- **GitHub上のパス:** `app/works/01-aspect-ratio-resizer/`
- **公開URL:** https://ai-build-challenge.vercel.app/works/01-aspect-ratio-resizer
- **検証結果:** `npm run lint`、`npm run typecheck`、`npm run test`（23件）、`npm run build`に成功しました。
- **ブラウザ確認:** ローカル本番サーバーで幅390pxと1440pxを確認。初期表示、幅・高さ基準の計算、空欄・0・負数・小数・上限超過、コピー、Tab・Shift+Tab・矢印キー・Enter・Space、フォーカス表示、横スクロール、結果更新時のレイアウト、コンソールを確認しました。
- **既知の制約:** 画像ファイル自体の読み込みや加工は行いません。入力は1〜100000の整数ピクセルに限定します。データを外部送信または保存しません。
- **学んだこと:** 計算ロジックと検証を純粋関数へ分離すると、UI操作に依存せず境界値と丸めを明示的に検証できます。
- **次回への改善点:** 実装前に長い日本語タイトルの折り返し位置も含めたレスポンシブ確認基準を用意します。

## 作品02

- **作品番号:** 02
- **作品名:** 文字数・読了時間カウンター
- **制作日:** 2026-08-03
- **対象ユーザー:** Web制作者、ライター、ブロガー、広報・SNS担当者
- **解決する問題:** 原稿の文字数、行数、概算読了時間を別々に確認する手間を減らします。
- **差別化:** 見た目上の文字に近い単位の文字数と、日本語500文字／分の概算読了時間を同じ結果領域に即時表示します。
- **主な機能:** 空白込み文字数、空白除外文字数、行数、概算読了時間、入力クリア
- **GitHub上のパス:** `app/works/02-text-length-counter/`
- **想定公開URL:** https://ai-build-challenge.vercel.app/works/02-text-length-counter
- **検証結果:** `npm run lint`、`npm run typecheck`、`npm run test`（54件）、`npm run build`に成功しました。
- **ブラウザ確認:** ローカル本番サーバーで幅390pxと1440pxを確認。初期表示、通常入力、空白・改行、1・499・500・501文字、空行、末尾改行、絵文字・ZWJ絵文字・結合文字、日本語と英数字の混在、クリア、Tab・Shift+Tab、フォーカス表示、横スクロール、結果カードの寸法、コンソールを確認しました。
- **既知の制約:** 読了時間は日本語500文字／分を基準とした概算です。言語判定や英語の単語数計測は行いません。入力内容を保存または外部送信しません。
- **学んだこと:** `Intl.Segmenter`のgrapheme単位を使うことで、UTF-16のコードユニット数ではなく、ZWJ絵文字や結合文字を見た目上の1文字に近い単位で計測できます。
- **次回への改善点:** 入力中の結果更新を保ったまま、非常に長い文章に対する計測時間も定量的に確認できる基準を用意します。

## 作品03

- **作品番号:** 03
- **作品名:** WCAGコントラストチェッカー
- **制作日:** 2026-08-03
- **対象ユーザー:** Webデザイナー、フロントエンドエンジニア、Webサイト運用担当者、コンテンツ作成時に配色を確認したい人
- **解決する問題:** 文字色と背景色のコントラスト比を手計算し、通常文字・大きな文字・UI部品の基準を個別に確認する手間を減らします。
- **差別化:** コントラスト比、WCAG 2.2 AA・AAAの文字基準、非テキストコントラストの目安、入力色によるプレビューを同じ結果領域へまとめました。
- **主な機能:** #RGB・#RRGGBB入力と正規化、入力検証、2色の入れ替え、sRGB相対輝度とコントラスト比の計算、5基準の合否、配色プレビュー
- **GitHub上のパス:** `app/works/03-wcag-contrast-checker/`
- **想定公開URL:** https://ai-build-challenge.vercel.app/works/03-wcag-contrast-checker
- **検証結果:** `npm run lint`、`npm run typecheck`、`npm run test`（4ファイル・91件）、`npm run build`、`git diff --check`に成功しました。
- **ブラウザ確認:** ローカル本番サーバーで幅390pxと1440pxを確認。初期表示、#RGB・小文字HEXの正規化、2色の入れ替え、空欄・不正桁数・不正文字、エラー解消、最初の無効欄へのフォーカス移動、低コントラスト、合否テキスト、Tab・Shift+Tab・Enter、フォーカス表示、横スクロール、結果カードの寸法、作品一覧との往復、コンソールを確認しました。自動操作環境からOSネイティブのカラーピッカー選択値を変更できず、選択後のテキスト入力への同期だけは未確認です。
- **既知の制約:** sRGBの不透明なHEX色だけを対象とします。グラデーション、背景画像、透明度、実際のフォント描画は評価しません。2色の判定だけでページ全体のWCAG適合を保証しません。データを保存または外部送信しません。
- **学んだこと:** 判定用の元比率と表示用に切り捨てた比率を分離すると、境界値の誤判定を防ぎながら読みやすい表示にできます。
- **次回への改善点:** 実際の利用色を用いた境界値付近のブラウザ操作確認を、実装前の確認項目へ追加します。

## 作品04

- **作品番号:** 04
- **作品名:** ポモドーロ・ミニ
- **制作日:** 2026-08-03
- **対象ユーザー:** デスクワーカー、学生、在宅勤務者、短い集中時間と休憩を繰り返したい人
- **解決する問題:** タスク管理や履歴などを必要とせず、最低限の操作で集中と休憩を切り替えたい人に、実時間とのずれを補正できるタイマーを提供します。
- **差別化:** 終了予定時刻と現在時刻の差分による時間補正に加え、270度ゲージをドラッグ・ホイール・キーで1分ずつ動かす、視覚的で触って分かる設定体験を備えています。
- **主な機能:** 270度の円形ダイヤル、pointer・wheel・keyboard・±ボタン・直接入力による作業／休憩時間設定、入力検証、開始、一時停止、再開、リセット、手動・自動フェーズ切り替え、進捗表示、重要な状態変化のスクリーンリーダー通知、実行中の`document.title`更新
- **GitHub上のパス:** `app/works/04-pomodoro-mini/`
- **想定公開URL:** https://ai-build-challenge.vercel.app/works/04-pomodoro-mini
- **検証結果:** `npm run lint`、`npm run typecheck`、`npm run test`（5ファイル・174件）、`npm run build`、`git diff --check`に成功しました。
- **ブラウザ確認:** Chromeのローカル本番ビルドを幅390pxと1440pxで確認しました。事前フォーカスなしの上下ホイールは大きなdeltaでも1分、トラックパッド相当の`4px`を4回連続した小deltaは累積して1分変更され、時間変更中はページ位置を維持しました。最小値での減少方向と最大値での増加方向では値を維持したままページがスクロールしました。円周クリック・時計回りドラッグ、Arrowキー、±ボタン、直接入力とエラー解除、実行・一時停止中の無効化、リセット後の再有効化、休憩への切り替え、`document.title`も再確認しました。390pxで横スクロールはなく、コンソールのerror・warningもありません。実機Macトラックパッド、実機スマートフォン、タッチ指定可能なモバイルエミュレーション、`visibilitychange`による復帰補正は未確認です。タッチの上下スワイプ取得・端値でのページ通過と時刻差分補正はコード・純粋関数テストで確認しました。
- **既知の制約:** 音声通知やOS通知は行いません。ブラウザを閉じた状態では動作しません。端末スリープ中は画面を更新しませんが、ページが残っていれば復帰後に実時間との差分から補正します。入力内容やタイマー状態、履歴は保存しません。
- **学んだこと:** 時刻差分とダイヤル角度の計算をそれぞれ純粋関数へ分離すると、時間精度とポインター操作の境界値をUIから独立して検証できます。カスタム操作にはsliderのARIAと直接入力・ボタンの代替手段を併設することも重要でした。
- **次回への改善点:** 実機タッチと`visibilitychange`復帰を確実に再現できるブラウザテスト手段を、実装前の確認項目へ追加します。

## 作品05

- **作品番号:** 05
- **作品名:** レスポンシブカードグリッド設計ツール
- **制作日:** 2026-08-03
- **対象ユーザー:** フロントエンドエンジニア、HTML/CSSコーダー、Webデザイナー、WordPressテーマ制作者、カード一覧のレスポンシブ設計を行う人
- **解決する問題:** カードの最低幅、gap、最大列数、左右余白の組み合わせから、各画面幅の列数やカード幅を事前に判断しにくい問題を減らします。
- **差別化:** 任意幅での列数・カード幅、列数の切り替わり幅、`auto-fit`と`auto-fill`の空きトラックの違い、実装用コードを同じ画面で確認できます。
- **主な入力:** カードの最小幅、カード間の余白、最大列数、ページ左右の余白、カード数、`auto-fit`／`auto-fill`、プレビュー幅
- **主な出力:** 現在幅の列数・カード幅・利用可能幅・空きトラック数、最大グリッド幅、列数切り替わり幅、縮尺プレビュー、HTML・CSS
- **GitHub上のパス:** `app/works/05-responsive-grid-planner/`
- **想定公開URL:** https://ai-build-challenge.vercel.app/works/05-responsive-grid-planner
- **検証結果:** `npm run lint`、`npm run typecheck`、`npm run test`（6ファイル・226件）、`npm run build`、`git diff --check`に成功しました。
- **ブラウザ確認:** Chromeのローカル本番ビルドを1440×900、1440×768、900×800、390×844で確認しました。設定とプレビューは同一のワークスペースカード内で上下に並び、1440pxでは数値入力が5列、900pxでは3列、390pxでは1列です。横スクロールはなく、1440×900ではカードプレビュー上部まで、1440×768ではプレビュー見出しと幅スライダーまでをスクロール前に確認しました。全5数値入力のArrowUp／ArrowDownとネイティブのスピン矢印による1刻みの増減、数値・`auto-fit`／`auto-fill`の即時反映、空欄時のフォーカス・直前結果・コード維持、NaN・Infinityなし、到達可能列数の表、ヒントとエラーの`aria-describedby`を確認しました。ラジオのSpace、スライダーのEnd、HTML・CSSコピー、初期値へのリセット、focus-visible、コンソールのerror・warningなしも確認しました。
- **未確認事項:** 実機スマートフォン、200%ブラウザズーム、Clipboard API失敗時の表示はブラウザで未確認です。200%ズームは確認環境でキーボードショートカットを適用できませんでした。コピー失敗処理はコード上で確認しました。
- **既知の制約:** プレビューは縮尺表示です。実際の幅は親要素、スクロールバー、`box-sizing`などの影響を受けます。生成コードは出発点であり、デザインに応じた調整が必要です。入力内容は保存または外部送信しません。
- **学んだこと:** `auto-fit`と`auto-fill`の配置可能列数・実トラック数を別々の純粋関数にすると、カード数が少ない場合の差を境界値テストと視覚表示の両方で明確にできます。
- **次回への改善点:** ブラウザズームとClipboard API失敗を安定して再現できる確認手順を、実装前のチェックリストへ追加します。

## 作品06

- **作品番号:** 06
- **作品名:** SVG Motion Studio
- **制作日:** 2026-08-03
- **対象ユーザー:** フロントエンドエンジニア、Webデザイナー、FigmaやIllustratorからSVGを書き出す人、CSSアニメーションとモーションのアクセシビリティ対応を効率化したい人
- **解決する問題:** SVGアイコンごとにキーフレーム、発火条件、調整値、reduced-motion、アクセシブルなHTMLを毎回設計する手間を減らします。
- **差別化:** SVG内部を書き換えず、同じSVGで12種類の汎用モーションを一括比較し、選んだ動きの実装用HTML・CSSを生成します。危険または不正なSVGは自動修正せず拒否します。
- **主な機能:** 内蔵SVGアイコン18種類、任意SVG入力と安全検証、同一SVGによる汎用CSSモーション12種類の比較、Speed・Strength・Triggerの簡易設定、5発火条件の詳細設定、sandbox iframeプレビュー、HTML・CSS個別コピー、アクセシビリティ案内
- **GitHub上のパス:** `app/works/06-svg-motion-studio/`
- **想定公開URL:** https://ai-build-challenge.vercel.app/works/06-svg-motion-studio
- **検証結果:** `npm run lint`（警告なし）、`npm run typecheck`、`npm run test`（9ファイル・288件）、`npm run build`、`git diff --check`に成功しました。
- **ブラウザ確認:** Chromeのローカル本番ビルドを1440×900、390×844、320×800で確認しました。初期表示、内蔵18アイコン、5用途から12モーションへの到達、5発火条件の操作UI、サイズ・背景、HTML・CSSコピー、正常SVGの原文保持、script・onload・foreignObject・外部imageの拒否、Tab・Space・矢印キー、focus-visible、固定プレビュー高、コード領域以外の横スクロールなし、コンソールのerror・warningなしを確認しました。実機スマートフォン、マウスの実Hover、OSのreduced-motion設定切り替え、Clipboard API失敗時は未確認です。reduced-motionとコピー失敗処理はコードおよび単体テストで確認しました。
- **UI改善（2026-08-04）:** 縦に積んだ6ステップ構成を、左にプレビュー・アクセシビリティ要約・生成コード、右にSVG・用途・モーション・詳細設定を置く2カラム型ワークスペースへ変更しました。内蔵アイコンはカテゴリ切り替え式とし、アイコンを上、名称を下に配置した選択チェック付きカードへ再設計しました。700px以下ではプレビュー、設定、注意、コードの順に1カラム表示します。
- **UI改善後の再検証:** `npm run lint`（警告なし）、`npm run typecheck`、`npm run test`（9ファイル・288件）、`npm run build`、`git diff --check`に成功しました。Chromeのローカル本番ビルドで1440×900、1000×900、390×844、320×800を確認し、2カラムと1カラムの切り替え、18アイコン、5用途、12モーション、詳細設定、コピー、危険SVG拒否、横スクロールなし、focus-visible、カテゴリ・モーション・コードタブ切り替え時の寸法確保、コンソールのerror・warningなしを確認しました。sandbox iframe内のTabフォーカスによる発火は確認済みです。自動操作環境からiframe内の実Hover状態を成立させられなかったため、マウスの実Hoverは未確認です。実機スマートフォン、OSのreduced-motion設定切り替え、Clipboard API失敗時も未確認です。
- **プレイグラウンド再設計（2026-08-04）:** 必須だった用途選択を廃止し、ページ上部のメインプレビューと、現在の同一SVGで全12モーションを直接比較できるギャラリーへ変更しました。Speed・Strength・Triggerだけを常時表示し、正確な値と5発火条件は「詳細設定」へ、コード本文は「コードを見る」へ折りたたみました。内蔵アイコンと任意SVGの入力も開閉式にし、HTML・CSSコピーは初期状態から利用できます。
- **プレイグラウンド再検証:** `npm run lint`（警告なし）、`npm run typecheck`、`npm run test`（9ファイル・292件）、`npm run build`、`git diff --check`に成功しました。Chromeのローカル本番ビルドで1440×900、1000×900、390×844、320×800を確認し、1440pxではメインプレビューと比較ギャラリー1行目が初期画面内に見えること、全12カードが同じSVGを使うこと、Hover・Focus・矢印キー選択・一括再生・Speed・Strength・Trigger・詳細設定・HTML／CSSコピー・コード表示を確認しました。正常な任意SVGは12カードへ反映され、script・onload・foreignObject・外部imageは具体的な理由付きで拒否され、拒否後はプレビュー画像が生成されません。全幅で意図しない横スクロールはなく、可視ボタンは320pxでも44px以上、コンソールのerror・warningなし、初期レイアウトシフト計測値は0.00053未満でした。OSのreduced-motionエミュレーション、実機スマートフォン、Clipboard API失敗時は未確認です。reduced-motionの出力とページ内抑制はコードおよび単体テストで確認しました。
- **アニメーション不具合修正（2026-08-04）:** メインプレビュー文書のbody CSSルールを閉じ、生成CSSを独立したルールとして配置しました。一括再生は12カードへduration・easing・iteration・fill modeを含む完全なanimation指定を適用し、CSS ModulesとCSS変数でkeyframes名が不一致になる問題も専用名で解消しました。モーション選択時と同じカードの再操作時には、選択カードとメインプレビューを再実行します。「詳細設定」は「細かく調整する」へ変更し、用途説明と開閉アイコンを追加して、閉じたカードがコード領域の高さまで伸びないようにしました。
- **不具合修正後の再検証:** `npm run lint`（警告なし）、`npm run typecheck`、`npm run test`（10ファイル・296件）、`npm run build`、`git diff --check`に成功しました。Chromeのローカル本番ビルドで、メインプレビューの`animation-name`が`svg-motion-lift`、durationが`0.24s`であること、5秒へ変更した再実行中にtransformが変化することをcomputed styleで確認しました。一括再生は12件すべてduration `0.72s`、再生途中で12件すべてtransformまたはopacityが変化し、連続再実行も確認しました。Hover、Focus、矢印キー選択、Speed・Strength、背景・サイズ、停止、詳細設定のマウス・Enter・Space開閉を確認しました。1440×900、1000×900、390×844、320×800で横スクロールはなく、閉じた詳細設定はコードカードへstretchしません。コンソールerror・warningなし、主要領域の寸法は600ms間で変化なしでした。OSのreduced-motionエミュレーション、実機スマートフォン、Clipboard API失敗時は未確認です。生成CSSのreduced-motionとページ内抑制はコードで確認しました。
- **既知の制約:** SVG内部要素単位のアニメーション、pathモーフィング、stroke描画、GSAP、Lottie、SVG最適化には対応しません。SVGの安全性をあらゆる環境で保証するツールではありません。外部リソースを含むSVGは拒否します。SVG内部コードは最適化しません。ファイルアップロードは扱いません。
- **学んだこと:** 検証用の解析結果と生成に使う原文を分離すると、安全性を確認しながらSVG文字列の完全な保持を実現できます。
- **次回への改善点:** 実機端末と複数ブラウザでsandbox iframe内のフォーカス・モーションを比較できる確認手順を整えます。

## 作品07

- **作品番号:** 07
- **作品名:** Low Poly Tree Explorer
- **制作日:** 2026-08-05
- **対象ユーザー:** ブラウザ上で立体を回転させ、形の成り立ちを気軽に眺めたい人、Three.jsやWebGPUの表現に興味がある人
- **解決する問題:** 3Dモデルをただ見るだけでなく、回転・ズーム・分解を通して木の構造と低ポリゴン表現を理解できる短時間の体験を提供します。
- **一文の差別化:** ひとつの低ポリツリーを、景色として眺める状態と構造として分解する状態の両方で探索できます。
- **主な機能:** 低ポリツリーのOrbit、ホイール・ピンチ・ボタンによるZoom、組み立てる／分解するExplode、自動回転、視点リセット、レスポンシブ表示
- **操作方法:** マウスまたは1本指のドラッグで回転し、ホイールまたはピンチでズームします。`分解する`、`組み立てる`、`自動回転`、`視点をリセット`、ズームボタンはキーボードでも操作できます。
- **低ポリツリーの構成:** 6分割の幹と枝、複数のIcosahedronGeometryによる葉の塊、7角形の低ポリ島、土台と3つの石を組み合わせています。各パーツは幹・枝・内側の葉・外側の葉・地面・装飾へ分類しています。
- **技術構成:** Next.js App Router、React、TypeScript、Three.js 0.185.1、CSS Modules、Vitest
- **WebGPURenderer利用:** `three/webgpu`の`WebGPURenderer`をClient Componentから動的に読み込み、`await renderer.init()`後にシーンを描画します。実際のバックエンド名を推測せず、画面にはWebGPU APIの利用可能性だけを表示します。
- **WebGL 2フォールバック方針:** WebGPURendererの既定フォールバックを利用し、WebGPU APIが利用できない環境では同じGeometryとライト構成をThree.jsのWebGL 2バックエンドで描画します。フォールバックbackend自体は今回のブラウザ確認では実測していません。
- **OrbitControls:** パンを無効にし、距離・極角に上限を設定したOrbitControlsで、マウス・タッチの回転とホイール・ピンチのズームを受け付けます。canvas外はページの通常スクロールを維持します。
- **Explode設計:** progressを0〜1へclampし、幹・枝・葉・地面・石ごとに異なる方向と距離を事前定義します。葉は外側・上方向、枝は幹から外側、地面と石は下方向へ控えめに移動し、三次easingで補間します。
- **パフォーマンス対策:** GeometryとMaterialは初期化時に一度だけ生成し、pixel ratioを最大1.5、delta timeを最大0.05秒に制限します。ResizeObserver、IntersectionObserver、visibilitychangeでサイズ変更・画面外・タブ非表示時の描画を抑え、静止時はanimation loopを停止します。
- **アクセシビリティ対応:** 見出し、native button、`aria-pressed`、操作ステータスの`aria-live`、canvasのアクセシブルな説明、`:focus-visible`、色に依存しない状態テキストを実装しています。
- **reduced-motion対応:** 初期自動回転をOFFにし、Explodeの遷移時間とOrbitの減衰を短縮します。`LowPolyTreeScene.setReducedMotion`で実行中も設定を反映し、ONへの変更時は自動回転を停止してUIへ通知します。OFFへ戻しても自動回転は勝手に再開せず、明示的なボタン操作で再開できます。分解操作中も次フレームから最新の遷移時間を使います。
- **GitHub上のパス:** `app/works/07-low-poly-tree-explorer/`
- **想定公開URL:** https://ai-build-challenge.vercel.app/works/07-low-poly-tree-explorer
- **検証結果:** `npm run lint`（警告なし）、`npm run typecheck`、`npm run test`（11ファイル・305件）、`npm run build`、`git diff --check`に成功しました。ビルド出力で`/works/07-low-poly-tree-explorer`の静的生成を確認しました。テストではreduced-motion ON/OFFのExplode時間、Orbit dampingの有限値、自動回転停止とOFF復帰時の非再開方針を確認しています。
- **ブラウザ確認結果:** macOSのCodex In-app Browserで、viewport overrideの1440×900相当と390×844を確認しました。今回の修正後は通常設定で自動回転ONと`aria-pressed=true`、停止後のOFF表示と`aria-pressed=false`、自動回転ボタンからの明示的な再開、Explodeの分解表示、コンソールerror・warningなしを確認しました。WebGPURenderer初期化、WebGPU API利用可能の表示、木全体の初期表示、低ポリの幹・枝・葉・島・石、マウスドラッグOrbit、Reset、ズームボタン、キーボードのEnter／SpaceによるExplode・Auto rotate、390pxの横スクロールなし、canvas外の縦スクロール、pressed状態のボタン表示は既存確認を維持しています。接続中ブラウザには`prefers-reduced-motion`エミュレーション機能がなく、OS設定も変更していないため、ページを再読み込みせずにOS設定をON／OFFした実動作、実際の短縮遷移、damping変更は未確認です。390pxではcanvas 348×523px、ボタン高さ約60px、文書幅とviewport幅が390pxでした。実機スマートフォンの1本指Orbit・ピンチ、実機トラックパッドのホイール、WebGL 2フォールバックbackend、タブ非表示・復帰時の実動作は未確認です。ブラウザ自動操作では`:focus-visible`の疑似クラス成立までは取得できなかったため、CSSルールとネイティブbuttonのフォーカス順で確認しています。
- **既知の制約:** 外部モデル、テクスチャ、複数モデル切替、WebXR、エディター機能、モデル保存、スクリーンショット書き出しには対応しません。実機端末、OS設定によるreduced-motionの実動作、WebGL 2フォールバックbackendはこの環境だけでは確認できません。
- **学んだこと:** Object3Dをモデル定義へ持ち込まず、数値のパーツ定義とThree.jsの生成処理を分けると、Explodeの境界値とカメラプリセットをGPUなしでテストできます。
- **次回への改善点:** 複数ブラウザと実機タッチでOrbit・ピンチ・タブ復帰を確認し、WebGL 2へ強制切り替えた環境でフォールバック経路を検証します。

## 作品08

- **作品番号:** 08
- **作品名:** Low Poly Rover Garage
- **制作日:** 2026-08-06
- **対象ユーザー:** 低ポリゴンの乗り物を組み替え、短い試走で車体の違いと物理挙動を確かめたい人、Three.jsとRapierの小さな実装例を読みたい人
- **解決する問題:** 車体パーツの組み合わせと走行物理を別々に確認する手間を減らし、構成変更から小規模な走行テストまでを同じページで完結させます。
- **差別化:** Front・Cabin・Rearの12モジュールから64通りを組み立て、同じ車体を48×36の固定TEST YARDへ持ち込み、坂・起伏・丸太・箱・岩・小さなジャンプ台を短時間で試せます。
- **主な機能:** GARAGEの4×4×4モジュール選択、選択中構成の表示とswapアニメーション、Orbit・Zoom・Reset・Auto rotate、Rapierの4輪ray-cast vehicle、4WD・前輪操舵・ブレーキ・リカバリー、Pause、PCキーとスマートフォン向けpointer操作
- **操作方法:** `W`／`↑`で前進、`S`／`↓`でブレーキ・後退、`A`／`←`で左、`D`／`→`で右、`R`でStart PadへRecover、`P`でPause／Resume。画面下のネイティブ操作ボタンでも同じ入力を行えます。
- **技術構成:** Next.js App Router、TypeScript、Three.js `WebGPURenderer`、`@dimforge/rapier3d-compat` 0.19.3、CSS Modules、Vitest。RapierはTEST YARDへ入る時だけlazy loadします。
- **物理設計:** RapierのDynamicRayCastVehicleControllerを車体の唯一の運動源とし、動的chassis、4輪、前輪steer、4WD、brake、suspension、CCD、sleeping、固定タイムステップ1/60、最大4サブステップ、Pause・hidden時の停止、Recover・disposeを実装しました。
- **衝突形状の設計:** 床、坂、whoops、丸太、動的crate、固定rock、jump ramp、外周fenceのshape定義を共有し、同じ定義からThree.jsのvisualとRapierのcolliderを生成しています。
- **PR #9の扱い:** 旧PR #9はスコープ拡大により操作・物理・描画・検証の一貫性を確保できなかったため、マージせずクローズしました。作品08は`main`から小さな完成版として再実装しています。
- **検証結果:** `npm install`（397パッケージ、脆弱性0）、`npm run lint`（警告なし）、`npm run typecheck`、`npm run test`（16ファイル・323件）、`npm run build`、`git diff --check`、`npm ls @dimforge/rapier3d-compat`を実行しました。
- **ブラウザ確認結果:** ローカルproductionサーバーで1440×900、390×844、320×800を確認しました。初期GARAGE、12ラジオ、64 builds表示、構成選択とTEST YARDへの引き継ぎ、Zoom・Auto rotate、Rapier初期化、Pause・Resume、Recover、ネイティブ操作ボタン、横スクロールなし、コンソールのerror・warningなしを確認しています。in-app Browserのキーボード配送が安定せず、W／S／A／D／矢印／P／Rの実走行入力は未確認ですが、キー割り当てと移動結果の検証は単体テストで確認しています。実機タッチ、実機トラックパッド、OSのreduced-motion切り替え、WebGL 2フォールバックは未確認です。
- **既知の制約:** オープンワールド、Waystone、minimap、timer、score、checkpoint、NPC、敵、音声、保存、ランキング、terrain streaming、外部モデル・テクスチャ・WebXRには対応しません。TEST YARDは固定サイズの短い試走用です。
- **学んだこと:** AIへ大きな仕様を渡すほど品質が自動的に上がるわけではないため、主要体験を絞り、検証可能な範囲へ限定する必要があります。また、visualとcolliderを同一データから生成し、入力の正負ではなく実際の移動結果を検証する必要があります。
- **次回への改善点:** 実機のタッチ・トラックパッド、OSのreduced-motion変更、WebGL 2フォールバック、長時間走行時の負荷を複数ブラウザで確認し、必要なら車体ごとのサスペンション調整UIを追加します。

## 作品09

- **作品番号:** 09
- **作品名:** THE THINKER — LIGHT STUDY
- **制作日:** 2026-08-07
- **対象ユーザー:** 彫刻、デジタルアート、Three.js・WebGPUの視覚表現に関心があり、短時間で光と形の関係を観察したい人
- **解決する問題:** 同じ3Dモデルでも照明の方向・硬さ・色・背景が変わると読み取り方が変わることを、照明比較を主役にしたまま視点操作も加えて観察できる体験にします。
- **差別化:** ローカルの実在彫刻スキャンを固定のダークブロンズ素材で提示し、GALLERY／CHIAROSCURO／SPECTRUMでライト種別、方向、影、背景、露出、Bloomまで切り替えます。ポインターは主光源と小さなカメラ視差だけに反映し、光源マーカー・強度倍率で変化を追えるようにし、形状は変形しません。
- **主な機能:** 3つの照明モード、ポインターとLIGHT POSITIONボタンによる主光源操作、光源マーカーと距離ベースの強度表示、離脱時の中央復帰、VIEWボタンによる制限付き回転・拡大縮小、視点リセット、HOLD LIGHT、ローカルSTLのロード進捗・エラー表示、reduced-motion、WebGPU／WebGL 2フォールバック、選択的Bloom、レスポンシブ構図
- **GitHub上のパス:** `app/works/09-thinker-light-study/`
- **公開予定URL:** https://ai-build-challenge.vercel.app/works/09-thinker-light-study
- **使用技術:** Next.js App Router、React、TypeScript、Three.js 0.185.1、`WebGPURenderer`、`MeshStandardNodeMaterial`、TSL、`RenderPipeline`、CSS Modules、Vitest
- **モデル出典・ライセンス:** Wikimedia CommonsのScan the Worldによる《The Thinker》STLを利用しています。CC BY-SA 4.0に基づく帰属・リンク・変更表示を `public/models/09-thinker/ATTRIBUTION.md`、画面内credit、公開帰属ページへ実装しました。公式・美術館の承認を示す表現は使用していません。
- **最適化:** `/tmp`に取得した約39.93MiBの原本を、空間グリッドによる決定的な頂点クラスタリング、重複・退化三角形除去、法線再計算、バイナリSTL再出力で約3.52MB・70,376三角形へ削減しました。実行スクリプトは `scripts/prepare-thinker-model.mjs` です。
- **検証結果:** `npm run lint`（警告なし）、`npm run typecheck`、`npm run test`（22ファイル・352件）、`npm run build`、`git diff --check`に成功しました。単体テストでは資産サイズ・三角形数・帰属、公開帰属ページ、モデル正規化、プリセット差分、ポインター正規化・キーボード移動・強度範囲・品質プロファイル・停止条件、視点操作の境界値・NaN・Infinity・連続操作、作品登録を確認しています。
- **ブラウザ確認:** Codex In-app Browserで1440×900と390×844を確認し、初期の人物認識、3モード、LIGHT POSITION全ボタン、Enter／Spaceによる主光源移動、HOLD LIGHT中の5ボタン無効化、ポインター移動、キーボード位置のpointerleave保持、VIEW連打後の認識性、Canvasの縦スクロール非抑止、`touch-action: pan-y pinch-zoom`、creditと公開帰属ページ、横スクロールなしを確認しました。production server再起動後のconsole error・warningはありません。Tab／Shift+Tabは接続中ブラウザのキー配送が成立せず、native buttonのDOM順序とフォーカスCSSの確認に留めています。
- **WebGPU／WebGL 2の確認状況:** ブラウザ上で`WEBGPU / SELECTIVE BLOOM`表示、WebGPURenderer初期化、選択的Bloom、ローカルSTLの描画を確認しました。WebGPU APIが利用できない場合のWebGL 2フォールバックは実装していますが、backendの強制切替実測は未確認です。
- **既知の制約:** モデル編集・保存、複数モデル切替、音声、WebXR、外部ランタイムモデル取得には対応しません。視点回転・ズームは画面内の展示構図を保つ範囲に制限しています。WebGPU／WebGL 2の実測、実機入力、OS設定変更、CLSの直接値はこの環境で確認できた範囲だけを報告します。
- **学び:** 形状を変えずに照明プリセットの構造差を出すには、ライト種別・位置・ターゲット・fill・rim・shadow・背景・露出・Bloomをひとつのデータとして管理し、GPUなしの純粋ロジックテストで差分を保証するのが有効です。
- **次回への改善点:** Tab／Shift+Tabのブラウザ配送、実機タッチ・トラックパッド、OSのreduced-motion切替、WebGL 2 backend、直接のCLS計測、長時間表示時のGPU負荷を追加確認します。

### 作品09 本番後ホットフィックス（2026-08-08）

- **発見と原因:** 本番公開後のiPhone 16 Pro確認で、タイトル・ランタイム表示・数値readout・VIEW・HOLD LIGHT・長文説明・LIGHT POSITIONが同時に見えるため、彫刻を触って光を動かすという主操作が埋もれていました。Canvas上の広いUIレイヤーも、直接操作の優先順位を下げる要因でした。
- **Primary Action:** マウスはCanvas上の`pointermove`で連続的に主光源を移動し、タッチ／ペンは`pointerdown`でタップ位置へ即時に移動します。ポインター座標は四隅を含めて`-1〜1`へclampし、`pan-y pinch-zoom`を維持します。
- **画面整理:** メイン画面からVIEW、HOLD LIGHT、ランタイム詳細、KEY LIGHTの数値表示、距離応答表示、長文の日英説明を除去しました。タイトルは`09 / 15`、`THE THINKER`、`LIGHT STUDY`へ圧縮し、GALLERY／CHIAROSCURO／SPECTRUMの3モードを副操作として残しました。
- **キーボード代替:** 初期閉じのnative`details`へLIGHT POSITIONを移し、44px以上の5ボタン、日本語`aria-label`、focus-visible、既存`aria-live`通知を提供しました。ヘッダー・ヒント・装飾・creditはCanvasへの入力を遮らず、実コントロールとリンクだけを操作可能にしています。
- **帰属表示:** メイン画面のcreditを`The Thinker · Scan the World · CC BY-SA 4.0 · Credits`へ圧縮し、出典・ライセンス・変更内容・派生STL・非公式であることの詳細は公開帰属ページから確認できる状態を維持しました。
- **検証範囲と結果:** production serverで1440×900、402×874、390×844、402×740を確認しました。初期表示、3モード、マウスの中央／左上／右下、タッチ相当のpointerdown、LIGHT POSITION開閉、Credits、INDEX、横overflow、Canvasの`touch-action`、console error / warningを確認し、4 viewportのconsole error / warningとpage errorは0件でした。390×844と402×740は、初回のコンパクト化確認、開示パネルとモード列の重なり確認後の退避、closed時の非表示確認を経て最終スクリーンショットを撮影しました。数値CLSは未計測です。
- **既知の制約:** 実機iPhoneのタッチ、OSのreduced-motion切替、WebGL 2強制fallback、長時間表示時のGPU負荷、数値CLSはこの環境で未確認の場合があります。WebGPU／WebGL 2、ローカルSTL、TSL material、shadows／Bloom、observer・visibility・dispose・GPU queue disposal、ライセンス表示は既存実装を維持します。

### 作品09 SEO / OGP / X Card対応（2026-08-08）

- **SEO metadata:** rootへ本番`metadataBase`を設定し、作品09へ固有title、description、canonicalを追加しました。作品固有titleの二重連結がないことをproduction HTMLで確認しています。
- **Social metadata:** `openGraph`へwebsite、ja_JP、siteName、本番URL、作品固有title／description、画像寸法、altを設定し、Xへ`summary_large_image`のtitle／description／imageを設定しました。
- **OGP画像:** UIホットフィックス後のproduction画面を1200×630 viewportで表示し、モデルロード完了後にSPECTRUMを選択した実画面から`public/og/09-thinker-light-study.png`を撮影しました。彫刻を中央に置き、3モード、compact credit、`The Thinker · Scan the World · CC BY-SA 4.0`を含め、browser chromeと個人情報は含めていません。
- **検証結果:** production buildの実HTMLで`title`、description、canonical、`og:title`、`og:description`、`og:url`、`og:type`、`og:image`、`og:image:width`、`og:image:height`、`og:image:alt`、`twitter:card`、`twitter:title`、`twitter:description`、`twitter:image`を確認しました。OG画像はHTTP 200、`image/png`、1200×630でした。Previewでもページ表示、画像取得、本番canonicalを確認しました。
- **退行防止:** `metadata.test.ts`で本番canonical、OG画像path、PNG signature、1200×630、website、ja_JP、alt、`summary_large_image`を確認します。
- **既知の未確認事項:** X実投稿後のタイムライン表示、X側のキャッシュ更新、Facebook／LinkedIn等のクローラー表示差は未確認です。実際のHTMLと画像HTTP応答、Vercel Previewの取得までは確認済みです。

次の作品を追加する際は、以下のテンプレートを複製して記録します。

---

## 作品NN

- **作品番号:** NN
- **作品名:**
- **制作日:** YYYY-MM-DD
- **対象ユーザー:**
- **解決する問題:**
- **差別化:**
- **主な機能:**
- **GitHub上のパス:** `app/works/NN-slug/`
- **公開URL:**
- **検証結果:**
- **既知の制約:**
- **学んだこと:**
- **次回への改善点:**
