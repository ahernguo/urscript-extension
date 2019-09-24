## urscript-extension

[English](README.md)

此專案是為了 [Universal Robots](https://www.universal-robots.com/)™ Script 語言所建的 Visual Studio Code 套件

因 UR 官方僅有 Ubuntu 虛擬機之離線編譯環境，並未提供 Windows 的離線編譯工具，故建立此 VSCode 套件來提供額外的程式撰寫環境

## 提醒

- 此套件 **不包含** 編譯、語法檢查，程式撰寫完畢後仍需傳入控制器或虛擬機進行檢查！
- 於啟用 URScript 語言後，會自動更改以下的 VSCode 編輯器參數
  - `editor.tabSize: 2`
  - `editor.insertSpaces: true`
  - `files.eol: '\n'`

## 功能說明

- 自動完成項目
  - 以官方 scriptManual.pdf 所產生對應的方法說明
    ![completion](resources/figures/completion.png)
- 滑鼠停留時的方法提示

  - 目前僅能提供 UR Script 方法的提示，自訂的方法( `def` )尚不能顯示提示
    ![hover](resources/figures/hover_tip.png)

- 程式碼區塊
  - 提供如 def、if、while 等語法可以快速建立，持續新增中
    ![snippet](resources/figures/snippets.png)

## 版本紀錄

### 0.0.x (dev)

- CompletionItems、SignatureHelp、Hover、Snippets

## 安裝方式

由於未發行至市集，須將此專案編譯為 VSIX 後載入。請於命令提示字元執行以下步驟：

1.  `npm install -g vsce` 安裝 Visual Studio Code Extension Manager 至本機電腦
2.  `git clone https://github.com/ahernguo/urscript-extension` 來將本套件下載至本機電腦
3.  `cd urscript-extension` 切換當前目錄至下載的資料夾中
4.  `npm install` 透過 Node.js 來安裝本套件所需的工具
5.  `vsce package` 編譯本套件，將會產生 vsix 套件檔
6.  開啟 VSCode 並於套件中心載入此 vsix 檔案