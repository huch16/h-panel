// functions/lib/bcrypt.js
// Vendored bcryptjs 2.4.3 (https://github.com/dcodeIO/bcrypt.js, Apache-2.0)
// 不依赖外部 npm 包；bcryptjs dist 是 UMD，可直接在 ES Module 上下文运行。
//
// 之所以 vendor：Cloudflare Pages 构建时若不在 Dashboard 设置 build command，
// 不会运行 `npm install`，导致 wrangler 打包阶段找不到 node_modules 中的 bcryptjs。
// 本地嵌入绕开该问题，运行时零变化（仍产生标准 bcrypt $2a$ 哈希，可与既有 KV 数据兼容）。

import bcryptVendor from './bcrypt-vendor.js';

// bcryptjs 2.4.3 暴露的 API：hashSync(salt, callback?) / hash(data, salt, progressCallback?, callback?)
// / compareSync(s, hash) / compare(s, hash, progressCallback?, callback?)
// 我们只用到 hashSync（登录成功后自动升级到 bcrypt）和 compare（同步风格，但实现是 async）。
const bcrypt = bcryptVendor;

export async function compare(plain, hash) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(plain, hash, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export function hashSync(plain, saltRounds = 10) {
  const salt = bcrypt.genSaltSync(saltRounds);
  return bcrypt.hashSync(plain, salt);
}

export default { compare, hashSync };