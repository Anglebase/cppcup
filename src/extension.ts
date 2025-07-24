// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import toml from '@iarna/toml';
import { language_activate } from './language';

function get_terminal() {
	const workspace = vscode.workspace.workspaceFolders;
	if (!workspace || workspace.length > 1) {
		throw new Error('Workspace error.');
	}
	const folder = workspace[0];

	let terminal = vscode.window.terminals.find(t => t.name === 'Cup');
	if (!terminal) {
		terminal = vscode.window.createTerminal({
			name: 'Cup',
			cwd: folder.uri,
			hideFromUser: true,
		});
	}
	return terminal;
}

function build_project(is_debug: boolean) {
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

	let terminal = get_terminal();

	// 执行自动构建
	let msg = vscode.window.setStatusBarMessage('$(loading~spin)Building...');
	terminal.show();
	terminal.sendText("cup build" + (!is_debug ? " -r" : ""));
	vscode.window.onDidEndTerminalShellExecution((e) => {
		if (e.terminal.name !== 'Cup') {
			return;
		}
		msg.dispose();
		vscode.window.setStatusBarMessage(
			e.exitCode === 0
				? '$(check)Build success.'
				: '$(error)Build failed.',
			3000);
	});
}

function run_project(is_debug: boolean, dir: string) {
	console.log('run project');
	const parentpath = path.dirname(dir);
	const name = path.basename(parentpath);

	let terminal = get_terminal();
	terminal.show();

	// 对于根目录的运行命令，只对 binary 类型的项目生效
	if (dir === '' || (name !== "examples" && name !== "tests")) {
		terminal.sendText("cup run" + (!is_debug ? " -r" : ""));
		let msg = vscode.window.setStatusBarMessage('$(loading~spin)Running...');
		vscode.window.onDidEndTerminalShellExecution((e) => {
			if (e.terminal.name !== 'Cup') {
				return;
			}
			msg.dispose();
			vscode.window.setStatusBarMessage(
				e.exitCode === 0
					? '$(check)Run success.'
					: '$(error)Run failed.',
				3000);
		});
		return;
	}

	// 对于 examples 和 tests 目录下的运行命令，需要指定具体的源文件
	const source_name = path.basename(dir);
	terminal.sendText("cup run " + (name + "/" + source_name) + (!is_debug ? " -r" : ""));
	let msg = vscode.window.setStatusBarMessage('$(loading~spin)Running...');
	vscode.window.onDidEndTerminalShellExecution((e) => {
		if (e.terminal.name !== 'Cup') {
			return;
		}
		msg.dispose();
		vscode.window.setStatusBarMessage(
			e.exitCode === 0
				? '$(check)Run success.'
				: '$(error)Run failed.',
			3000);
	});
}

// 更新编辑器标题栏运行按钮的可见性
function update_button_visibility() {
	const workspace = vscode.workspace.workspaceFolders;
	if (workspace && workspace.length === 1) {
		const folder = workspace[0];
		const config_path = path.join(folder.uri.fsPath, 'cup.toml');
		vscode.workspace.fs.readFile(vscode.Uri.file(config_path)).then((content) => {
			const config = toml.parse(content.toString());
			// 检查 project.type 字段
			if (config.project && typeof config.project === 'object' && 'type' in config.project) {
				const type = config.project.type;
				const active_dir = vscode.window.activeTextEditor?.document.uri.fsPath;
				let is_examples_or_tests = false;
				if (active_dir) {
					const parentpath = path.dirname(active_dir);
					const name = path.basename(parentpath);
					is_examples_or_tests = name === "examples" || name === "tests";
				}
				// 仅当项目类型为 binary 或 examples、tests 目录下的文件时，显示运行按钮
				const runable = type === 'binary' || is_examples_or_tests;
				vscode.commands.executeCommand('setContext', 'cppcup.runable', runable);
			}
		});
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "cppcup" is now active!');

	language_activate(context);

	context.subscriptions.push(vscode.commands.registerCommand('cppcup.build', () => { build_project(true); }));
	context.subscriptions.push(vscode.commands.registerCommand('cppcup.run', (url: vscode.Uri) => { run_project(false, url.fsPath); }));
	context.subscriptions.push(vscode.commands.registerCommand('cppcup.debug', (url: vscode.Uri) => { run_project(true, url.fsPath); }));
	context.subscriptions.push(vscode.commands.registerCommand('cppcup.release', () => { build_project(false); }));

	update_button_visibility();

	vscode.workspace.onDidSaveTextDocument(
		(document) => {
			console.log('onDidChangeTextDocument', document);
			if (document.fileName.endsWith('cup.toml')) {
				update_button_visibility();
				console.log('cup.toml saved');
			}
		}
	);
	vscode.window.onDidChangeActiveTextEditor(
		(editor) => {
			console.log('onDidChangeActiveTextEditor', editor);
			update_button_visibility();
		}
	);

	const auto_update = vscode.workspace.getConfiguration().get<boolean>('cppcup.autoUpdate');
	if (auto_update) { 
		build_project(true);
	}
}

export function deactivate() { }
