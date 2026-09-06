/**
 * ログイン画面（アプリ化要件定義.md F2-1）。
 *
 * 失敗の理由は**分けて出さない**。「メールアドレスまたはパスワードが違います」に統一する。
 * 「そのアドレスは存在しません」と返すと、アカウントの有無を確かめる口になる。
 * ロック中だけは別で伝える（正しいパスワードを入れても通らない理由が分からないため）。
 */
import { adminPage } from './layout.ts';
import { esc } from '../result.ts';
import { jst } from '../../lib/admin-format.ts';

export function loginPage(opts: { error?: string; email?: string; notice?: string } = {}): string {
  const body =
    '<div class="login">' +
      '<h1>ログイン</h1>' +
      '<p class="sub">ナチュール診断の管理画面です。</p>' +
      (opts.notice ? `<p class="ok">${esc(opts.notice)}</p>` : '') +
      (opts.error ? `<p class="warn">${esc(opts.error)}</p>` : '') +
      '<div class="panel">' +
        '<form method="post" action="/admin/login">' +
          '<div class="f"><label for="email">メールアドレス</label>' +
          `<input id="email" name="email" type="email" required autocomplete="username" value="${esc(opts.email ?? '')}"></div>` +
          '<div class="f"><label for="password">パスワード</label>' +
          '<input id="password" name="password" type="password" required autocomplete="current-password"></div>' +
          '<button class="btn" type="submit" style="width:100%">ログイン</button>' +
        '</form>' +
        '<p class="note">5回続けて失敗すると、しばらくログインできなくなります。</p>' +
      '</div>' +
    '</div>';
  return adminPage({ title: 'ログイン', nav: 'none' }, body);
}

/** ロック中の案内。いつ試せるかを出す。 */
export function lockedMessage(retryAt: string): string {
  return `ログインを一時的に停止しています。${jst(retryAt)}（JST）以降に、もう一度お試しください。`;
}

/**
 * 初期アカウントの作成（1回だけ）。
 * `admin_users` が空で、かつ ADMIN_BOOTSTRAP_* が設定されているときにだけ出す。
 * 1人でも作られたあとは 404 になるので、この画面は二度と開かない。
 */
export function bootstrapPage(email: string): string {
  const body =
    '<div class="login">' +
      '<h1>初期アカウントの作成</h1>' +
      '<p class="sub">管理アカウントがまだありません。環境変数の値で1つ作ります。</p>' +
      '<div class="panel">' +
        `<dl class="kv"><dt>メールアドレス</dt><dd>${esc(email)}</dd>` +
        '<dt>パスワード</dt><dd class="muted">ADMIN_BOOTSTRAP_PASSWORD の値</dd></dl>' +
        '<form method="post" action="/admin/bootstrap" style="margin-top:14px">' +
          '<button class="btn" type="submit" style="width:100%">このアカウントを作成する</button>' +
        '</form>' +
        '<p class="note">作成後、この画面は開けなくなります。<br>' +
        '作成できたら <code>ADMIN_BOOTSTRAP_PASSWORD</code> を環境変数から消してください。</p>' +
      '</div>' +
    '</div>';
  return adminPage({ title: '初期アカウントの作成', nav: 'none' }, body);
}
