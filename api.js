/**
 * =====================================================
 *  portal api.js  —  データアクセス統合ファイル
 * =====================================================
 *
 *  【GitHub Pages 運用中】  → MODE = 'github'  のまま使う
 *  【XSERVERへ移行するとき】→ 下の「▼ XSERVER設定エリア」だけ編集してMODEを切り替える
 *
 *  このファイルを変えるだけで index.html / blog.html / admin.html
 *  すべての読み書きが自動的に切り替わります。
 */

// =====================================================
//  ▼▼▼ ここだけ編集すればOK ▼▼▼
// =====================================================

const MODE = 'github'; // 'github'  →  'xserver' に変えるだけで移行完了

// --- GitHub設定（現在の運用） ---
const GITHUB = {
  owner  : 'mgunshi3060',
  repo   : 'portal.index',
  branch : 'main',
  // GitHub Personal Access Token（admin.htmlのGitHub設定ページで入力・保存）
  // ここには書かない。ブラウザのlocalStorageから自動で読む
};

// --- XSERVER設定（移行時に記入） ---
const XSERVER = {
  // XSERVERのドメインを入れる（末尾スラッシュなし）
  domain : 'https://your-domain.com',

  // ポータルを置くディレクトリ（ルートなら '' でOK）
  dir    : '/portal',

  // APIファイルの場所（通常は変更不要）
  api    : '/api',
};

// =====================================================
//  ▲▲▲ 編集するのはここまで ▲▲▲
// =====================================================


// --- 内部で使うURL計算（触らなくてOK） ---
const _GH_RAW  = `https://raw.githubusercontent.com/${GITHUB.owner}/${GITHUB.repo}/${GITHUB.branch}/`;
const _GH_API  = `https://api.github.com/repos/${GITHUB.owner}/${GITHUB.repo}/contents/`;
const _XS_API  = `${XSERVER.domain}${XSERVER.dir}${XSERVER.api}/`;

function _ghToken() { return localStorage.getItem('portal_gh_token') || ''; }


// =====================================================
//  読み込み API
// =====================================================

/**
 * お知らせ一覧を取得
 * @returns {Promise<Array>}
 */
async function apiGetDocs() {
  if (MODE === 'github') {
    const res = await fetch(_GH_RAW + 'data/docs.json?_=' + Date.now());
    if (!res.ok) throw new Error('docs.json 取得失敗 (' + res.status + ')');
    return res.json();
  }
  if (MODE === 'xserver') {
    const res = await fetch(_XS_API + 'docs.php?action=list');
    if (!res.ok) throw new Error('docs API エラー (' + res.status + ')');
    return res.json();
  }
}

/**
 * ブログ一覧を取得
 * @returns {Promise<Array>}
 */
async function apiGetBlogs() {
  if (MODE === 'github') {
    const res = await fetch(_GH_RAW + 'data/blogs.json?_=' + Date.now());
    if (!res.ok) throw new Error('blogs.json 取得失敗 (' + res.status + ')');
    return res.json();
  }
  if (MODE === 'xserver') {
    const res = await fetch(_XS_API + 'blogs.php?action=list');
    if (!res.ok) throw new Error('blogs API エラー (' + res.status + ')');
    return res.json();
  }
}

/**
 * キャッシュフォールバック付き読み込み（index.html / blog.html から呼ぶ）
 * ネット切断時などはlocalStorageの前回データを返す
 */
async function apiLoad(type, cacheKey) {
  try {
    const data = type === 'docs' ? await apiGetDocs() : await apiGetBlogs();
    localStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
  } catch (e) {
    console.warn('[portal-api] サーバー取得失敗→キャッシュ使用:', e.message);
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch (_) { return []; }
  }
}


// =====================================================
//  書き込み API（admin.html から呼ぶ）
// =====================================================

/**
 * お知らせ一覧を保存
 * @param {Array}  docs     - 保存するデータ配列
 * @param {string} message  - コミットメッセージ（GitHub用）
 */
async function apiSaveDocs(docs, message = 'Update docs') {
  if (MODE === 'github') {
    return _ghSaveJson('data/docs.json', docs, message);
  }
  if (MODE === 'xserver') {
    return _xsSave('docs.php', docs);
  }
}

/**
 * ブログ一覧を保存
 */
async function apiSaveBlogs(blogs, message = 'Update blogs') {
  if (MODE === 'github') {
    return _ghSaveJson('data/blogs.json', blogs, message);
  }
  if (MODE === 'xserver') {
    return _xsSave('blogs.php', blogs);
  }
}

/**
 * PDFファイルをアップロード
 * @param {string} filename  - ファイル名
 * @param {string} base64DataUrl - "data:application/pdf;base64,xxxx" 形式
 * @returns {Promise<string>} - アクセスURL
 */
async function apiUploadPdf(filename, base64DataUrl) {
  if (MODE === 'github') {
    const b64 = base64DataUrl.split(',')[1];
    const path = 'pdfs/' + filename;
    await _ghPutFile(path, b64, 'Upload PDF: ' + filename);
    return _GH_RAW + 'pdfs/' + encodeURIComponent(filename);
  }
  if (MODE === 'xserver') {
    // XSERVERはmultipart/form-dataでPHPへ送信
    const blob = _b64ToBlob(base64DataUrl);
    const form = new FormData();
    form.append('file', blob, filename);
    const res = await fetch(_XS_API + 'upload.php', {
      method: 'POST',
      headers: { 'X-Portal-Token': _xsAdminToken() },
      body: form
    });
    if (!res.ok) throw new Error('PDF upload失敗 (' + res.status + ')');
    const result = await res.json();
    return result.url; // PHPが返すURL
  }
}


// =====================================================
//  内部ユーティリティ（触らなくてOK）
// =====================================================

// GitHub: Token の接続テスト（admin.html の saveToken() / initAdmin() から呼ばれる）
async function ghCheckToken() {
  const token = _ghToken();
  if (!token) return { ok: false, msg: 'Token未設定' };
  try {
    const res = await fetch(
      'https://api.github.com/repos/' + GITHUB.owner + '/' + GITHUB.repo,
      {
        headers: {
          'Authorization': 'token ' + token,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    if (res.ok) {
      const d = await res.json();
      return { ok: true, msg: '接続OK ✅ (' + d.full_name + ')' };
    }
    if (res.status === 401) return { ok: false, msg: 'Token無効 (401 Unauthorized)' };
    if (res.status === 403) return { ok: false, msg: 'アクセス拒否 (403 Forbidden)' };
    if (res.status === 404) return { ok: false, msg: 'リポジトリが見つかりません (404)' };
    return { ok: false, msg: 'エラー (HTTP ' + res.status + ')' };
  } catch (e) {
    return { ok: false, msg: 'ネットワークエラー: ' + e.message };
  }
}

// GitHub: ファイルのSHAを取得（更新時に必要）
async function _ghGetSha(path) {
  try {
    const res = await fetch(_GH_API + path, {
      headers: { 'Authorization': 'token ' + _ghToken(), 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) return null;
    return (await res.json()).sha;
  } catch (_) { return null; }
}

// GitHub: JSONファイルを保存
async function _ghSaveJson(path, data, message) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  const sha = await _ghGetSha(path);
  const body = { message, content, branch: GITHUB.branch };
  if (sha) body.sha = sha;
  return _ghPutFile(path, content, message, sha);
}

// GitHub: ファイルをPUT
async function _ghPutFile(path, content, message, sha) {
  const token = _ghToken();
  if (!token) throw new Error('GitHub Token が設定されていません（管理者ページ → GitHub設定）');
  const body = { message, content, branch: GITHUB.branch };
  if (sha) body.sha = sha;
  else {
    const existingSha = await _ghGetSha(path);
    if (existingSha) body.sha = existingSha;
  }
  const res = await fetch(_GH_API + path, {
    method: 'PUT',
    headers: {
      'Authorization': 'token ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('GitHub APIエラー(' + res.status + '): ' + (err.message || res.statusText));
  }
  return res.json();
}

// XSERVER: JSONデータをPHPへPOST
async function _xsSave(endpoint, data) {
  const res = await fetch(_XS_API + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Portal-Token': _xsAdminToken() // XSERVER管理者トークン（admin.htmlのlocalStorageから）
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('XSERVER保存エラー (' + res.status + ')');
  return res.json();
}

// XSERVER管理者トークン（移行後に admin.html で設定）
function _xsAdminToken() { return localStorage.getItem('portal_xs_token') || ''; }

// Base64 DataURL → Blob変換
function _b64ToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/*
 =====================================================
  XSERVER移行チェックリスト
 =====================================================
  □ 1. このファイルの MODE を 'xserver' に変更
  □ 2. XSERVER.domain にドメインを入力
        例: 'https://example-company.com'
  □ 3. XSERVER.dir にポータルのディレクトリを入力
        例: '/portal'  または  '' （ルートなら空文字）
  □ 4. XSERVERのサーバーに以下のPHPファイルを設置
        /portal/api/docs.php   ← 下記テンプレートを使用
        /portal/api/blogs.php
        /portal/api/upload.php
  □ 5. admin.html の「GitHub設定」→「XSERVERトークン設定」に変わる
        （このapi.jsを使えばadmin.htmlの変更は最小限）

 =====================================================
  PHPテンプレート（/portal/api/docs.php として保存）
 =====================================================

<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Portal-Token');

// ▼ このトークンをadmin.htmlのXSERVER設定で設定したものと一致させる
define('ADMIN_TOKEN', 'ここに任意のトークン文字列を入れる');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';
$file   = __DIR__ . '/../data/docs.json';

// 読み込み（誰でもOK）
if ($method === 'GET' && $action === 'list') {
    echo file_exists($file) ? file_get_contents($file) : '[]';
    exit;
}

// 書き込み（トークン認証必須）
$token = $_SERVER['HTTP_X_PORTAL_TOKEN'] ?? '';
if ($token !== ADMIN_TOKEN) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

if ($method === 'POST') {
    $body = file_get_contents('php://input');
    if (!json_decode($body)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }
    file_put_contents($file, $body);
    echo json_encode(['ok' => true]);
}
// blogs.php も同じ内容で $file のパスだけ blogs.json に変える
*/
