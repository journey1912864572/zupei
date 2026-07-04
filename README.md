# 组织学与胚胎学题库

纯静态 PWA 题库，包含 786 道独立题目，支持章节练习、题型练习和错题反复重练。学习记录保存在浏览器本地，无需登录。

## 本地运行

双击 `启动题库.bat`，或运行：

```powershell
python start_server.py
```

## 部署

推送到 `main` 分支后，GitHub Actions 会自动将网站部署到 GitHub Pages，无需构建步骤。

网站地址：https://journey1912864572.github.io/zupei/

## 更新题库

```powershell
python scripts\parse_questions.py
```
