# AGENTS.md — pi-request-command

読者: pi-request-command を変更するエージェントと開発者。利用者向けの仕様は [README](README.md)、設計判断は [DESIGN.md](DESIGN.md)。
共通の検証と規則はルートの `AGENTS.md` にある。

## 壊してはいけない制約

- モデル向けのツールは `request_user_command` の1つだけ。`exposure` は `model-only`。コマンドとイベントハンドラは登録しない（`test/contract/surface.test.ts`）。
- 拡張はプロセスを起動しない。`src/` は `child_process` などのプロセス生成モジュールを import しない（`test/contract/no-process.test.ts`）。
- 選択肢の文言は固定する: `実行した` / `拒否` / `出力を貼って完了`（`test/integration/extension.test.ts`）。
- 結果の `status` は `executed_reported` / `rejected` / `output_provided` の3つ。キャンセルは `status` を持たない失敗にする（`test/integration/extension.test.ts`）。
- 「実行した」の結果文は、pi が実行しておらず検証できないと明記する（`test/integration/extension.test.ts`）。
- Esc のキャンセルは拒否ではなく例外にする。選択と貼り付けの両方（`test/integration/extension.test.ts`）。
- `ctx.hasUI` が false のときは何も表示せず例外にする（`test/integration/extension.test.ts`）。
- 出力は `MAX_OUTPUT_BYTES`（50 KiB）で先頭から切る。切ったら `truncated` を true にし、結果文に明記する（`test/unit/tool.test.ts`）。
- 実行時依存を持たない。配布は `src` の範囲内（`test/contract/dependencies.test.ts`、`test/ci/package-contents.test.ts`）。

## 変更手順

- ツール面（名前・exposure・選択肢・status）を変えるときは、先に `test/contract/` と `test/integration/` を更新する。
- 上限値を変えるときは、先に `test/unit/tool.test.ts` を更新する。計測値はテストのコメントに、理由はコミットメッセージに残す。
- 手動で確認する項目（TUI の表示、実際の貼り付けの挙動）は [docs/manual-checks.md](docs/manual-checks.md) に書く。
