# Change Log
All notable changes to the "urscript" extension will be documented in this file.

Goto [urscript-extension](https://github.com/ahernguo/urscript-extension) for more details.

## `0.1.21` (07-Dec-2025) by _Ebbe Fuglsang_ and _xemjeff_
* FEATURE
  * Update of builtins ([#35](https://github.com/ahernguo/urscript-extension/pull/35))

## `0.1.20` (19-Nov-2025)
* HOTFIX
  * Bump js-yaml from 3.13.1 to 3.14.2 ([#34](https://github.com/ahernguo/urscript-extension/pull/34))

## `0.1.19` (15-Aug-2025) by _Ebbe Fuglsang_
* BUGFIXES
  * fix signatureHelpProvider is not parsing `,` in poses/lists as argument seperators

## `0.1.18` (16-Dec-2024) by _Ebbe Fuglsang_
* FEATURE
  * urscript manual 5.19 tool_wrench_limit functions added
  * time() updated to urscript manual 5.18
  * development container added
  * package.lock.json updated to version 1.17

## `0.1.17` (08-Jul-2024)
* FEATURE
  * Added 5.17.0 new functions ([#32](https://github.com/ahernguo/urscript-extension/pull/32))

## `0.1.16` (06-Mar-2024)
* BUGFIXES
  * added missing semicolon to import new functions ([#31](https://github.com/ahernguo/urscript-extension/pull/31))

## `0.1.15` (14-Feb-2024)
* FEATURE
  * reintroduced ([#30](https://github.com/ahernguo/urscript-extension/pull/30))

## `0.1.14` (03-Jul-2023)
* FEATURE
  * added encoder_unwind_delta_tick_count ([#26](https://github.com/ahernguo/urscript-extension/pull/26))

## `0.1.13` (06-Jan-2023)
* FEATURE
  * Initial support for upcoming struct type ([#24](https://github.com/ahernguo/urscript-extension/pull/24))

## `0.1.12` (14-Sep-2022)
* BUGFIXES
  * Fix incorrect regex to catch method name ([#22](https://github.com/ahernguo/urscript-extension/issues/22))
* FEATURE
  * Display parameters on hover ([#23](https://github.com/ahernguo/urscript-extension/issues/23))

## `0.1.11` (12-May-2022)
* FEATURE
  * Added request_integer_from_primary_client()
  * Added request_float_from_primary_client()
  * Added request_string_from_primary_client()
  * Added request_boolean_from_primary_client()

## `0.1.10` (08-May-2022)
* FEATURE
  * Add `end` to completion list with high priority ([#20](https://github.com/ahernguo/urscript-extension/issues/20))

## `0.1.9` (20-Dec-2021)
* BUGFIXES
  * Correct the misspelling of `ﬁ` in _functions.json_ to `fi`.

## `0.1.8` (19-Apr-2021)
* BUGFIXES
  * Fix string or comment containing `end` cause an indent decrease([#12](https://github.com/ahernguo/urscript-extension/issues/12))
  * Fix hover item pop-up when string value is same as function
  * Fix recursive format when nested bracket
  * Fix format error when using `*` or `/` before negative sign `-`
  * Correct `folding` and `indentationRules`

## `0.1.7` (08-Jun-2020)
* FEATURE
  * Supports `.urscript` extension ([#10](https://github.com/ahernguo/urscript-extension/pull/10))

## `0.1.6` (19-May-2020)
* BUGFIXES
  * Features will search all `.variable` and `.script` files in the workspace (including subfolders)
  * Prevent `Range` to be `undefined` to cause exception
  * Clear previous `Hover.range` when hovering same word repeatedly
  * Correct the spelling of **float** in `function.json`

## `0.1.5` (02-Mar-2020)
* FEATURE
  * Toggle comments now available. Key bindings to `Cmd`+`/` (`Ctrl`+`/` in windows) as default.
* BUGFIXES
  * Fix exception when `#` in the last line

## `0.1.4` (05-Dec-2019)
* FEATURE
  * Add and upload logo

## `0.1.3` (26-Nov-2019)
* BUGFIXES
  * Correct formatting when formats `if (not isArcOn()):`

## `0.1.2` (11-Nov-2019)
* BUGFIXES
  * Fix regex error when spaces after `:` sign
* FEATURE
  * Supports `Document Symbols`. It provides `CTRL + SHIFT + O` and outline to show functions.

## `0.1.0` (16-Oct-2019)
* BUILD
  * README with .gif images
  * Release for beta version

## `0.0.6` (15-Oct-2019)
* BUGFIXES
  * Fix `Hover` and `SignatureHelp` got incorrect item when start as same word
* FEATURE
  * Supports `.variables` file


## `0.0.5` (04-Oct-2019)
* BUGFIXES
  * Fix format incorrect when sign/keyword in string and comment
* ENHANCEMENT
  * Add keyword formatting
  * Now `CompletionItems`, `SignatureHelp`, `Hover`, `Go to Definition` can search current unsaved document

## `0.0.4` (26-Sep-2019)
* BUGFIXES
  * Fix documentation not shows well
  * Fix multi-lines function format incorrectly
  * Line is full of spaces and comments are formatted properly

## `0.0.3` (25-Sep-2019)
* FEATURE
  * TSDoc like documentation added
* ENHANCEMENT
  * VSCode version necessary downgrade to 1.35.1

## `0.0.2` (24-Sep-2019)
* BUGFIXES
  * [fix/repo missing](https://github.com/ahernguo/urscript-extension/pull/2)
  * [fix/forward slash](https://github.com/ahernguo/urscript-extension/pull/3)

## `0.0.1` (27-Aug-2019)
* FEATURE
  * CompletionItems
  * Hover
  * SignatureHelp
  * Definition

## `0.0.0` (22-Aug-2019)
* BUILD
  * initial repo
