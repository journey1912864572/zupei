# 组织学与胚胎学题库

纯静态 PWA 题库，包含 786 道独立题目，支持章节练习、题型练习和错题反复重练。学习记录保存在浏览器本地，无需登录。

## 本地运行

双击 `启动题库.bat`，或运行：

```powershell
python start_server.py
```

## 部署

项目可直接部署到 GitHub Pages，无需构建步骤。

## 更新题库

```powershell
python scripts\parse_questions.py
```
