# RUN 部署

- 项目：`boardgame`（ID `2431`）
- 地址：<https://boardgame.run.ingarena.net/>
- 应用端口：`3000`
- 健康检查：<https://boardgame.run.ingarena.net/healthz>
- 应用版本：`1.0.0`，首个应用提交 `9afdf8e`
- 运行方式：RUN 容器内 Node.js，后台 `nohup` 进程。
- RUN 项目源代码保持私有。

## 启动与恢复

启动容器后，使用平台项目详情提供的 SSH 信息登录。代码目录为 SSH 用户家目录。

```sh
cd ~
node scripts/build.cjs
npm test
nohup env HOST=0.0.0.0 PORT=3000 node server.cjs > /tmp/boardgame-app.log 2>&1 < /dev/null &
echo $! > /tmp/boardgame-app.pid
curl --fail http://127.0.0.1:3000/healthz
```

已有服务运行时先检查 `/tmp/boardgame-app.pid` 和监听端口，避免重复启动。应用日志为 `/tmp/boardgame-app.log`。容器重启后需重新启动该进程。

## 增量更新

从 GitHub 获取新版，重新构建、检查后，通过 SSH 同步对应路径；然后重启应用进程并检查线上页面与 `/healthz`。不要上传 `.env`、访问密钥、依赖缓存或本地浏览器数据。

```sh
node tests/http-check.cjs https://boardgame.run.ingarena.net
```

平台反向代理可能合并相同的安全响应头，HTTP 检查允许重复但相同的 `nosniff` 和 `DENY` 值。

本次部署已验证 HTTPS 页面、健康检查、静态图片、Gzip、缓存、请求方法和私有路径隔离；完成平台备份。
