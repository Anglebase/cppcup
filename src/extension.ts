// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

function build_project() {
	console.log('build project');
	const workspace = vscode.workspace.workspaceFolders;
	if (!workspace) {
		// 必须首先开启一个工作区
		vscode.window.showErrorMessage('No workspace opened');
		return;
	}
	if (workspace.length > 1) {
		// 多工作区下不自动构建
		return;
	}

	const folder = workspace[0];

	// 检查配置文件
	if (!fs.existsSync(path.join(folder.uri.fsPath, "cup.toml"))) {
		vscode.window.showErrorMessage('Workspace not a cup project.');
		return;
	}

	// 获取终端实例
	let terminal = vscode.window.terminals.find(t => t.name === 'Cup');
	if (!terminal) {
		terminal = vscode.window.createTerminal({
			name: 'Cup',
			cwd: folder.uri,
			hideFromUser: true,
		});
	}

	// 执行自动构建
	let msg = vscode.window.setStatusBarMessage('$(sync)Building...');
	terminal.show();
	terminal.sendText("cup build");
	vscode.window.onDidEndTerminalShellExecution((e) => {
		if (e.terminal.name !== 'Cup') {
			return;
		}
		msg.dispose();
		if (e.exitCode === 0) {
			vscode.window.setStatusBarMessage('$(check)Build succeeded.', 5000);
			// 构建成功则关闭终端
			e.terminal.dispose();
		} else {
			vscode.window.setStatusBarMessage('$(error)Build failed.', 5000);
		}
	});
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "cppcup" is now active!');

	const build_disposable = vscode.commands.registerCommand('cppcup.build', build_project);
	context.subscriptions.push(build_disposable);

	build_project();
}

// This method is called when your extension is deactivated
export function deactivate() { }
