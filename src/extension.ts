import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('tocss.helloWorld', () => {

		vscode.window.showInformationMessage('Hello World from toCss!');
	});

	context.subscriptions.push(disposable); 
}

// this method is called when your extension is deactivated
export function deactivate() {}
