## urscript-extension

[繁體中文](README_zhTW.md)

This is a Visual Studio Code extension that built for **[Universal Robots](https://www.universal-robots.com/)™ Script** language.

Universal Robots provides simulator for Linux only. This extension provides a simple coding environment with VSCode.

## Notice

- Compiler, syntax check are **NOT** includes. You should upload program to controller or simulator for compile and execute.
- Below option will be modified after extension activated
  - `editor.tabSize: 2`
  - `editor.insertSpaces: true`
  - `files.eol: '\n'`

## Features

- Completion Items
  - Base on scriptManual.pdf
    ![completion](resources/figures/completion.png)

- Show tips when mouse hover
  - Contains URScript and user defined
    ![hover](resources/figures/hover_tip.png)

- Code snippets
  - def, if and others
    ![snippet](resources/figures/snippets.png)

## Version

### 0.0.x (dev)

- CompletionItems、SignatureHelp、Hover、Snippets

## Installation

To install the extension we need to compile it into the VSIX code and then side load it into VSCode.

1.  `npm install -g vsce` to make sure you have vsce installed globally
2.  `git clone https://github.com/ahernguo/urscript-extension` to clone the repo if you havent already done so
3.  `cd urscript-extension`
4.  `npm install` to install dependencies if you havent already done so
5.  `vsce package` to build the package. This will generate a file with extension vsix
6.  Open VSCode and Run the command Extensions: Install from VSIX..., choose the vsix file generated in the previous step
