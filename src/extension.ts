import * as vscode from 'vscode';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/naming-convention
const postcss_less = require('postcss-less');

let classNames = '';
let lines = 0;

function compileCss(rules: any[] = []) {
  if (rules.length === 0 || lines !== 0) { return; }
  for (let index = 0; index < rules.length; index++) {
    const rule = rules[index];
    rule.selector = rule.selector.substr(rule.selector[0] === '&' ? 1 : 0);
    if (rule.f || rule.selector[0] === '.') {
      if (rule.selector.includes(',')) {
        const arr = rule.selector.split(',');
        let i = -1;
        for (let j = 0; j < arr.length; j++) {
          let rulej = arr[j];
          if (rulej.includes('\n')) {
            i++;
          }
          if (rulej.includes('&')) {
            rulej = rulej.split('&')[1];
          }
          rulej = rulej.replace(/(^\s*)|(\s*$)/g, "");
          if (classNames === ((rulej[0] === '.' ? '' : (rule.f || '')) + rulej)) {
            lines = i + rule.positionInside().line;
            return;
          }
        }
      } else {
        if ((rule.f || '') + rule.selector.replace(/(^\s*)|(\s*$)/g, "") === classNames) {
          lines = rule.positionInside().line - 1;
          return;
        }
      }
    }
    if (lines !== 0) { return; }
    compileCss((rule.nodes || []).filter((node: any) => {
      if ((node?.selector || '')[0] === '&') {
        node.f = rule.s ? '' : (rule.f || '') + rule.selector;
        return true;
      } else if ((node?.selector || '')[0] === '.') {
        node.f = '';
        return true;
      } else if (node.type === 'rule') {
        compileCss(node.nodes.filter((r: any) => {
          if (r.type === 'rule') {
            r.s = true;
            return true;
          }
        }));
      }
    }));
  }
}

export function activate(context: vscode.ExtensionContext) {

  let definition = vscode.languages.registerDefinitionProvider([
    { language: 'javascript', scheme: 'file' },
    { language: 'typescriptreact', scheme: 'file' }], {
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
      let name = document.getText(document.getWordRangeAtPosition(position));
      const text = document.getText();
      const arrText = text.split('\n');
      const lineText = arrText[position.line];
      let stylesName = '';
      if (lineText.includes('.' + name)) {
        lineText.replace(new RegExp("[a-zA-Z0-9_]{1,}." + name, "g"), (s, i) => {
          if (!/[0-9]|[a-z]|[A-Z]|_/.test(lineText[i + s.length])) {
            stylesName = s.split('.')[0];
          }
          return s;
        });
      } else {
        lineText.replace(/\[([^\[\]]*)\]/g, (s, _, i) => {
          name = s.substr(2, s.length - 4);
          const styleline = lineText.split(s)[0].replace(/(^\s*)|(\s*$)/g, "");
          let f = true;
          for (let i = styleline.length - 1; i >= 0; i--) {
            const element = styleline[i];
            if (/[0-9]|[a-z]|[A-Z]|_/.test(element) && f) {
              stylesName = element + stylesName;
            } else {
              f = false;
            }
          }
          return s;
        });
      }
      const requirePaths = arrText.find(path => path.includes(' ' + stylesName + ' '));
      let requirePath = '';
      if (requirePaths?.includes("'")) {
        requirePath = requirePaths.split("'")[1];
      } else if (requirePaths?.includes('"')) {
        requirePath = requirePaths.split('"')[1];
      }
      if (!requirePath) { return; }
      const uri = vscode.Uri.file(path.resolve(document.fileName, '../' + requirePath));
      const cssdoc = (await vscode.workspace.openTextDocument(uri));
      const root = postcss_less.parse(cssdoc?.getText());
      classNames = '.' + name;
      lines = 0;
      compileCss((root?.nodes || []).filter((rule: any) => rule.type === 'rule'));
      const range = new vscode.Range(new vscode.Position(lines, 0), new vscode.Position(lines + 1, 0));
      return new vscode.Location((uri), range);
    }
  });

  context.subscriptions.push(definition);
}

// this method is called when your extension is deactivated
export function deactivate() { }
