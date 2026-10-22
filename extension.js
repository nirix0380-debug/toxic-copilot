const vscode = require('vscode');

// База правил на основе Словаря русского мата
const TOXIC_RULES = [
  {
    id: 'single-letter-var',
    regex: /\b(?:const|let|var)\s+([a-zA-Z])\s*=/,
    getMessage: (m) => `Переменная "${m[1]}"?! Ты совсем ебанько? Назови её нормально, хули ты буквы экономишь, распиздяй!`,
    shortGhost: '💀 Переменная из одной буквы? Что за поебень?!'
  },
  {
    id: 'lazy-var-names',
    regex: /\b(?:const|let|var)\s+(data|temp|tmp|info|item|val|value|obj|res|foo|bar|test|arr|str|num)\s*=/i,
    getMessage: (m) => `Переменная "${m[1]}" — ни в пизду, ни в Красную Армию! Что там внутри лежит? Хуй его знает! Придумай осмысленное имя!`,
    shortGhost: '💀 "Хуй проссышь" что лежит в этой переменной'
  },
  {
    id: 'commented-code',
    regex: /^\s*\/\/\s*(?:const|let|var|function|if|for|while|return|import|export|class|switch|try|catch)\b/,
    getMessage: () => `Закомменченный мусор! Нахуя ты хранишь этот труп в файле? Снеси его к ёбаной бабушке, для истории есть Git!`,
    shortGhost: '💀 Закомменченный код. Удали эту хуету нахуй!'
  },
  {
    id: 'var-keyword',
    regex: /\bvar\s+[a-zA-Z_$]/,
    getMessage: () => `Ты из каких ебеней припиздил со своим "var" в 2026 году?! Используй const или let, хуемырло старообрядческое!`,
    shortGhost: '💀 Опа, "var"! Пахнуло древней хуйнёй...'
  },
  {
    id: 'ts-any',
    regex: /:\s*any\b/,
    getMessage: () => `Тип "any" — это открытое наебалово и распиздяйство! Нахуя тебе вообще TypeScript, если ты лепишь сюда эту поебень?!`,
    shortGhost: '💀 Тип any — высшая степень похуизма'
  },
  {
    id: 'console-log',
    regex: /\bconsole\.log\s*\(/,
    getMessage: () => `Опять дебажишь через console.log? Сделано уёбищенски! Не забудь вычистить за собой это блядство перед коммитом.`,
    shortGhost: '💀 Убери за собой этот console.log, разъебай!'
  },
  {
    id: 'empty-catch',
    regex: /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/,
    getMessage: () => `Пустой catch?! Это объебательство чистой воды! Ошибки пущены по пизде — когда прод наебнётся, хуй проссышь почему!`,
    shortGhost: '💀 Ошибки накрылись пиздой (пустой catch)'
  },
  {
    id: 'todo-comment',
    regex: /\/\/\s*(?:TODO|FIXME)\b/i,
    getMessage: () => `Хватит тянуть за хуй и оставлять TODO! Мы оба знаем: там ещё конь и хуй не валялся, и ты хуй забьёшь на эту задачу!`,
    shortGhost: '💀 Не пизди, нихуя ты этот TODO не сделаешь'
  },
  {
    id: 'loose-equality',
    regex: /[^=!]==[^=]/,
    getMessage: () => `Двойное равно "=="? Ты хочешь, чтобы приведение типов косоёбилось как попало? Ставь "===", тупиздень!`,
    shortGhost: '💀 Ставь "===", не устраивай тут пиздопляску типов!'
  },
  {
    id: 'pyramid-of-doom',
    regex: /^\s{16,}(?:if|for|while|switch)\b/,
    getMessage: () => `Ебать-колотить, какая хитровыебанная вложенность! От этой пиздопляски с отступами можно опизденеть. Вынеси в отдельную функцию!`,
    shortGhost: '💀 Хитровыебанная вложенность! Рефактори давай!'
  }
];

// Случайные фразы для всплывающих пушей при сохранении файла
const SAVE_ROASTS = [
  'Ёбаный стос! Ты реально собрался сохранять эту поебень?! Нахуярил так, что всё перехуяривать придётся!',
  'Я посмотрел твой код... Это высший пиздец! Сделано максимально уёбищенски.',
  'Ну ты и нахуевертил тут костылей! В продакшене эта хуёвина накроется пиздой за 3 секунды.',
  'Хватит ебланить и груши хуем околачивать! В файле куча говнокода, переделывай давай!',
  'Слушай, программист хуев, от твоих переменных типа "a" и "temp" компилятор сейчас ёбнется!'
];

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('toxic-copilot');
  context.subscriptions.push(diagnosticCollection);

  // Стиль для "призрачного" текста прямо в редакторе (как у Copilot)
  const ghostDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 2em',
      color: '#ff555599',
      fontStyle: 'italic'
    },
    isWholeLine: true
  });

  // Функция анализа документа
  function analyzeDocument(document) {
    if (!document || document.uri.scheme !== 'file') return [];

    const diagnostics = [];
    const findings = [];
    const lines = document.getText().split('\n');

    lines.forEach((lineText, lineIndex) => {
      // Пропускаем уже вставленные комменты самого Toxic Copilot
      if (lineText.includes('TOXIC COPILOT:')) return;

      for (const rule of TOXIC_RULES) {
        const match = lineText.match(rule.regex);
        if (match) {
          const startPos = lineText.indexOf(match[0]);
          const range = new vscode.Range(
            lineIndex,
            Math.max(0, startPos),
            lineIndex,
            lineText.length
          );

          const message = rule.getMessage(match);
          const diagnostic = new vscode.Diagnostic(
            range,
            `💀 ${message}`,
            vscode.DiagnosticSeverity.Warning
          );
          diagnostic.source = 'Toxic Copilot';
          diagnostics.push(diagnostic);

          findings.push({
            lineIndex,
            message,
            shortGhost: rule.shortGhost
          });
          break; // По одному оскорблению на строку, чтобы не спамить
        }
      }
    });

    diagnosticCollection.set(document.uri, diagnostics);
    return findings;
  }

  // Обновление призрачного текста на активной строке
  function updateGhostText(editor) {
    if (!editor) return;
    const findings = analyzeDocument(editor.document);
    const activeLine = editor.selection.active.line;

    const currentLineFinding = findings.find((f) => f.lineIndex === activeLine);
    if (currentLineFinding) {
      const range = new vscode.Range(activeLine, 0, activeLine, editor.document.lineAt(activeLine).text.length);
      editor.setDecorations(ghostDecorationType, [
        {
          range,
          renderOptions: {
            after: {
              contentText: currentLineFinding.shortGhost
            }
          }
        }
      ]);
    } else {
      editor.setDecorations(ghostDecorationType, []);
    }
  }

  // События редактора
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) updateGhostText(editor);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        updateGhostText(editor);
      }
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      updateGhostText(event.textEditor);
    })
  );

  // Токсичный пуш при сохранении файла (Ctrl+S)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      const config = vscode.workspace.getConfiguration('toxicCopilot');
      if (!config.get('roastOnSave')) return;

      const findings = analyzeDocument(document);
      if (findings.length > 0) {
        const randomRoast = SAVE_ROASTS[Math.floor(Math.random() * SAVE_ROASTS.length)];
        const choice = await vscode.window.showErrorMessage(
          `${randomRoast} (Найдено косяков: ${findings.length})`,
          'Впечатать комменты в код 💀',
          'ИИ-разъёб (Gemini) 🔥',
          'Я распиздяй, ща перехуярю'
        );

        if (choice === 'Впечатать комменты в код 💀') {
          vscode.commands.executeCommand('toxic-copilot.roastFile');
        } else if (choice === 'ИИ-разъёб (Gemini) 🔥') {
          vscode.commands.executeCommand('toxic-copilot.aiRoast');
        }
      }
    })
  );

  // КОМАНДА 1: Впечатать токсичные комменты прямо в код файла (идеально для скринов и видео!)
  context.subscriptions.push(
    vscode.commands.registerCommand('toxic-copilot.roastFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const findings = analyzeDocument(editor.document);
      if (findings.length === 0) {
        vscode.window.showInformationMessage('Бля буду, код чистый! Даже доебаться не до чего, красавчик!');
        return;
      }

      await editor.edit((editBuilder) => {
        // Вставляем снизу вверх, чтобы не сбились номера строк
        for (let i = findings.length - 1; i >= 0; i--) {
          const f = findings[i];
          const line = editor.document.lineAt(f.lineIndex);
          const indent = line.text.match(/^\s*/)[0];
          editBuilder.insert(
            new vscode.Position(f.lineIndex, 0),
            `${indent}// 💀 TOXIC COPILOT: ${f.message}\n`
          );
        }
      });

      vscode.window.showWarningMessage(`Впечатано ${findings.length} токсичных комментов прямо в твой говнокод!`);
    })
  );

  // КОМАНДА 2: Установить бесплатный API ключ от Gemini
  context.subscriptions.push(
    vscode.commands.registerCommand('toxic-copilot.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Вставь бесплатный API-ключ от Google AI Studio (aistudio.google.com)',
        placeHolder: 'AIzaSy...',
        password: true
      });
      if (key !== undefined) {
        await vscode.workspace.getConfiguration('toxicCopilot').update('geminiApiKey', key.trim(), vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Заебись! Ключ сохранён. Теперь выделяй код и запускай ИИ-разъёб!');
      }
    })
  );

  // КОМАНДА 3: ИИ-разъёб через бесплатный Gemini API (BYOK — без своих серверов)
  context.subscriptions.push(
    vscode.commands.registerCommand('toxic-copilot.aiRoast', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const config = vscode.workspace.getConfiguration('toxicCopilot');
      let apiKey = config.get('geminiApiKey');

      if (!apiKey) {
        const action = await vscode.window.showWarningMessage(
          'У тебя нет API-ключа Gemini! Вставь свой бесплатный ключ от Google AI Studio.',
          'Вставить ключ 🔑'
        );
        if (action === 'Вставить ключ 🔑') {
          await vscode.commands.executeCommand('toxic-copilot.setApiKey');
          apiKey = vscode.workspace.getConfiguration('toxicCopilot').get('geminiApiKey');
        }
        if (!apiKey) return;
      }

      const selection = editor.selection;
      const codeToRoast = !selection.isEmpty
        ? editor.document.getText(selection)
        : editor.document.getText().slice(0, 3000);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '💀 Toxic Copilot анализирует твою поебень...',
          cancellable: false
        },
        async () => {
          try {
            const prompt = `Ты — экстремально токсичный, злой, но чертовски умный Senior-разработчик.
Проанализируй этот код и жестко, смешно и креативно унизь автора за костыли, плохие названия переменных, закомменченный мусор или кривую логику.
Обязательно используй отборный русский мат и производные слова: "нахуевертить", "поебень", "уёбищенски", "хитровыебанный", "пиздопляска", "распиздяйство", "объебательство", "тянуть за хуй", "ни в пизду ни в Красную Армию", "хуй проссышь", "перехуяривать".
Ответ дай кратко (2-4 предложения), без приветствий, сразу к делу.

Код для разъёба:
\`\`\`
${codeToRoast}
\`\`\``;

            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }]
                })
              }
            );

            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error?.message || 'Ошибка API');
            }

            const roastText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Даже нейросеть охуела от твоего кода и потеряла дар речи.';

            // Вставляем ответ ИИ красивым многострочным комментарием прямо над выделенным кодом
            const targetLine = !selection.isEmpty ? selection.start.line : 0;
            const indent = editor.document.lineAt(targetLine).text.match(/^\s*/)[0];
            const formattedComment =
              `${indent}/* 💀 AI TOXIC COPILOT:\n` +
              roastText
                .split('\n')
                .map((line) => `${indent} * ${line}`)
                .join('\n') +
              `\n${indent} */\n`;

            await editor.edit((editBuilder) => {
              editBuilder.insert(new vscode.Position(targetLine, 0), formattedComment);
            });

            vscode.window.showErrorMessage(`🔥 ИИ-разъёб: ${roastText}`);
          } catch (err) {
            vscode.window.showErrorMessage(`Пиздец, запрос к Gemini накрылся пиздой: ${err.message}`);
          }
        }
      );
    })
  );

  // Запускаем проверку при старте
  if (vscode.window.activeTextEditor) {
    updateGhostText(vscode.window.activeTextEditor);
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};