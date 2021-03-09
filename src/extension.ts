import * as vscode from 'vscode';
import * as parser from '@babel/parser';
import * as traverse from '@babel/traverse';
import * as path from 'path';
// import * as postcss from 'postcss';
// eslint-disable-next-line @typescript-eslint/naming-convention
const postcss_less = require('postcss-less');

function compileStylesName(code: string, name: string, line: Number) {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"]
  });
  let stylesName = '';
  const visitor = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Identifier(path: any) {
      if (path?.node?.name === name && path?.node?.loc?.start?.line === line) {
        stylesName = stylesName || path?.parent?.object?.name;
        return;
      }
    }
  };

  traverse.default(ast, visitor);

  return stylesName;
}

function compileRequirePath(code: string, name: string) {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"]
  });
  let requirePath = '';
  const visitor = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Identifier(path: any) {
      if (path.node.name === 'require') {
        const parent = path.findParent((paths: any) => paths.isVariableDeclarator());
        if (parent?.node?.id?.name === name) {
          requirePath = requirePath || (path?.parent?.arguments[0] || {})?.value;
          return;
        }
      }
    }
  };

  traverse.default(ast, visitor);

  return requirePath;
}

let classNames: any = {};

function compileCss(rules: any[] = []) {
  if (rules.length === 0) { return; }
  rules.forEach((rule: any) => {
    rule.selector = rule.selector.substr((rule.f || '') ? 1 : 0);
    if(rule.selector.includes(',')){
      const arr = rule.selector.split(',');
      classNames[(rule.f || '') + arr[0]] = rule.positionInside().line;
      classNames[(rule.f || '') + arr[1].split('&')[1]] = rule.positionInside().line + 1;
    }else{
      classNames[(rule.f || '') + rule.selector] = rule.positionInside().line;
    }
    compileCss((rule.nodes || []).filter((node: any) => {
      if ((node?.selector || '')[0] === '&') {
        node.f = (rule.f || '') + rule.selector;
        return true;
      } else if((node?.selector || '')[0] === '.'){
        node.f = '';
        return true;
      }
    }));
  });
}

export function activate(context: vscode.ExtensionContext) {

  // eslint-disable-next-line @typescript-eslint/naming-convention
  let disposable_toCss = vscode.commands.registerCommand('tocss.toCss', async () => {
    const editor = vscode.window.activeTextEditor;
    const document = editor?.document;
    const selection = editor?.selection;
    const arr = document?.getText(selection).split('.')!;
    const requirePath = compileRequirePath(document?.getText()!, arr[0]);
    const uri = vscode.Uri.file(path.resolve(document?.fileName!, '../' + requirePath));
    const cssdoc = (await vscode.workspace.openTextDocument(uri));
    const root = postcss_less.parse(cssdoc.getText());
    classNames = {};
    compileCss((root?.nodes || []).filter((rule: any) => rule.type === 'rule'));
    const index = (classNames['.' + arr[1]] || 1) - 1;
    const range = new vscode.Range(new vscode.Position(index, 0), new vscode.Position(index + 1, 0));
    vscode.window.showTextDocument(cssdoc, {
      selection: range,
    });
  });

  let definition = vscode.languages.registerDefinitionProvider([
    { language: 'javascript', scheme: 'file' },
    { language: 'typescriptreact', scheme: 'file' }], {
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
      const name = document.getText(document.getWordRangeAtPosition(position));
      const text = document.getText();
      const stylesName = compileStylesName(text, name, position.line + 1);
      const requirePath = compileRequirePath(text, stylesName);
      const uri = vscode.Uri.file(path.resolve(document.fileName, '../' + requirePath));
      const cssdoc = (await vscode.workspace.openTextDocument(uri));
      const root = postcss_less.parse(cssdoc?.getText());
      classNames = {};
      compileCss((root?.nodes || []).filter((rule: any) => rule.type === 'rule' && rule?.selector[0] === '.'));
      const index = (classNames['.' + name] || 1) - 1;
      const range = new vscode.Range(new vscode.Position(index, 0), new vscode.Position(index + 1, 0));
      return new vscode.Location((uri), range);
    }
  });

  context.subscriptions.push(disposable_toCss);
  context.subscriptions.push(definition);
}

// this method is called when your extension is deactivated
export function deactivate() { }
