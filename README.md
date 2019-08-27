## urscript-extension

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

### 0.0.0 (dev)
  - CompletionItems、SignatureHelp、Hover、Snippets
