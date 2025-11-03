# NPM 发布指南

本文档介绍如何为此项目配置 npm 仓库认证并发布包。

## 方案一：项目级别登录（推荐）

### 1. 登录到 npm 账号

在项目根目录运行：

```bash
# 登录到 npmjs.org
npm login

# 或者登录到私有仓库
npm login --registry=https://your-private-registry.com/
```

这会在项目根目录创建或更新 `.npmrc` 文件，包含认证令牌。

### 2. 验证登录状态

```bash
# 查看当前登录的用户
npm whoami

# 查看当前配置
npm config list
```

### 3. 发布包

```bash
# 发布到 npm
pnpm publish

# 或指定 tag
pnpm publish --tag beta
```

## 方案二：使用环境变量（CI/CD 推荐）

### 1. 创建 npm token

访问 https://www.npmjs.com/settings/[your-username]/tokens 创建 access token

### 2. 配置环境变量

```bash
# 在 .env.local 中配置（此文件已在 .gitignore 中）
echo "NPM_TOKEN=your-npm-token-here" >> .env.local
```

### 3. 在发布脚本中使用

修改 `package.json`：

```json
{
  "scripts": {
    "prepublishOnly": "pnpm run clean && pnpm run build",
    "publish:npm": "npm publish --access public"
  }
}
```

### 4. 手动配置（临时方案）

```bash
# 创建 .npmrc.local 文件（已在 .gitignore 中）
echo "//registry.npmjs.org/:_authToken=\${NPM_TOKEN}" > .npmrc.local
```

## 方案三：使用 pnpm 配置

### 1. 配置 .npmrc

项目根目录的 `.npmrc` 文件已经创建，你可以编辑它：

```ini
# 默认使用 npm 官方仓库
registry=https://registry.npmjs.org/

# 如果是 scoped package，可以指定特定仓库
@your-scope:registry=https://registry.npmjs.org/
```

### 2. 登录

```bash
pnpm login
```

## 发布前检查清单

### 1. 检查 package.json 配置

确保以下字段正确：

- ✅ `name`: 包名（如果发布到 npm，需要唯一）
- ✅ `version`: 版本号（遵循 semver）
- ✅ `main`: 入口文件
- ✅ `module`: ESM 入口
- ✅ `types`: TypeScript 类型定义
- ✅ `files`: 要发布的文件
- ✅ `publishConfig`: 发布配置

当前配置：

```json
{
  "name": "@ddc-market/sdk",
  "version": "0.1.0",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"]
}
```

### 2. 检查 .gitignore 和 .npmignore

- ✅ `.gitignore` - 控制哪些文件不提交到 Git
- ✅ `.npmignore` - 控制哪些文件不发布到 npm（如果没有此文件，使用 `files` 字段）

### 3. 构建和测试

```bash
# 清理旧构建
pnpm run clean

# 构建
pnpm run build

# 检查构建产物
ls -la dist/

# 测试（如果有）
pnpm test
```

### 4. 预览发布内容

```bash
# 查看将要发布的文件
npm pack --dry-run

# 或者实际打包查看
npm pack
tar -tzf ddc-market-sdk-0.1.0.tgz
```

## 发布流程

### 首次发布

```bash
# 1. 确保已登录
npm whoami

# 2. 构建
pnpm run build

# 3. 发布
pnpm publish --access public
```

### 更新版本并发布

```bash
# 1. 更新版本号
npm version patch  # 0.1.0 -> 0.1.1
# 或
npm version minor  # 0.1.0 -> 0.2.0
# 或
npm version major  # 0.1.0 -> 1.0.0

# 2. 构建和发布（prepublishOnly 会自动运行）
pnpm publish --access public

# 3. 推送 tag 到 git
git push --follow-tags
```

## Scoped Package 说明

当前包名是 `@ddc-market/sdk`，这是一个 scoped package。

### 发布 scoped package

```bash
# 必须使用 --access public（默认是 private，需要付费）
pnpm publish --access public
```

### 在 package.json 中配置

```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

## 私有仓库配置

如果要发布到私有 npm 仓库（如 Verdaccio、Nexus 等）：

### 1. 配置 .npmrc

```ini
registry=https://your-private-registry.com/
//your-private-registry.com/:_authToken=${NPM_TOKEN}
```

### 2. 登录

```bash
npm login --registry=https://your-private-registry.com/
```

### 3. 发布

```bash
pnpm publish --registry=https://your-private-registry.com/
```

## 安全注意事项

⚠️ **重要**：

1. ❌ **不要**提交 npm token 到 Git
2. ✅ 使用 `.npmrc.local` 存储敏感信息（已在 .gitignore）
3. ✅ 使用环境变量存储 token
4. ✅ 定期轮换 npm token
5. ✅ 使用 automation tokens（用于 CI/CD）
6. ✅ 为不同项目使用不同的 token

## CI/CD 配置示例

### GitHub Actions

创建 `.github/workflows/publish.yml`：

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm run build

      - name: Publish to npm
        run: pnpm publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 配置 GitHub Secret

1. 在 GitHub 仓库设置中添加 secret：`NPM_TOKEN`
2. 值为你的 npm access token

## 常见问题

### 1. 错误：需要登录

```bash
npm ERR! code ENEEDAUTH
npm ERR! need auth This command requires you to be logged in.
```

**解决方案**：运行 `npm login`

### 2. 错误：包名已存在

```bash
npm ERR! code E403
npm ERR! 403 403 Forbidden - PUT https://registry.npmjs.org/@ddc-market%2fsdk
```

**解决方案**：更改包名或确保你有权限发布此包

### 3. 错误：作用域包需要付费

```bash
npm ERR! code E402
npm ERR! 402 Payment Required
```

**解决方案**：使用 `--access public` 标志

### 4. 如何撤销已发布的版本

```bash
# 撤销特定版本（72小时内）
npm unpublish @ddc-market/sdk@0.1.0

# 废弃特定版本（推荐）
npm deprecate @ddc-market/sdk@0.1.0 "这个版本有问题，请使用 0.1.1"
```

## 测试安装

发布后，在其他项目中测试安装：

```bash
# 安装
pnpm add @ddc-market/sdk

# 或从特定版本安装
pnpm add @ddc-market/sdk@0.1.0
```

## 相关资源

- [npm 文档](https://docs.npmjs.com/)
- [pnpm 发布文档](https://pnpm.io/cli/publish)
- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [npm token 管理](https://docs.npmjs.com/about-access-tokens)
