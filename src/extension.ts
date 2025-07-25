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

function isSubDirectory(parent: string, child: string): boolean {
	const relativePath = path.relative(parent, child);
	return relativePath.length > 0 && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function get_config_at(dir: string) {
	if (!fs.existsSync(path.join(dir))) { return null; }
	if (fs.statSync(dir).isFile()) { dir = path.dirname(dir); }
	let result = true;
	while (!fs.existsSync(path.join(dir, 'cup.toml'))) {
		let in_workspace = false;
		for (const folder of vscode.workspace.workspaceFolders || []) {
			const uri = folder.uri.fsPath;
			if (isSubDirectory(uri, dir)) {
				in_workspace = true;
				break;
			}
		}
		if (!in_workspace) {
			result = false;
			break;
		}
		dir = path.dirname(dir);
	}
	if (!result) { return null; }

	return dir;
}

function build_project(is_debug: boolean, dir: string) {
	console.log('build project');
	const workspace = vscode.workspace.workspaceFolders;
	if (!workspace) {
		// 必须首先开启一个工作区
		vscode.window.showErrorMessage('No workspace opened');
		return;
	}

	let terminal = get_terminal();

	// 执行自动构建
	let msg = vscode.window.setStatusBarMessage('$(loading~spin)Building...');
	terminal.show();
	terminal.sendText("cup build" + (!is_debug ? " -r" : "") + ` --dir ${get_config_at(dir)}`);
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
		terminal.sendText("cup run" + (!is_debug ? " -r" : "") + ` --dir ${get_config_at(dir)}`);
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
	terminal.sendText("cup run " + (name + "/" + source_name) + (!is_debug ? " -r" : "") + ` --dir ${get_config_at(dir)}`);
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

function check_buildable(dir: string) {
	const config_at = get_config_at(dir);
	if (!config_at) { return false; }
	return true;
}

async function check_runable(dir: string) {
	const config_at = get_config_at(dir);
	if (!config_at) { return false; }
	const config_path = path.join(config_at, 'cup.toml');
	const content = await vscode.workspace.fs.readFile(vscode.Uri.file(config_path));
	const config = toml.parse(content.toString());
	// 检查 project.type 字段
	if (config.project && typeof config.project === 'object' && 'type' in config.project) {
		const type = config.project.type;
		const active_dir = vscode.window.activeTextEditor?.document.uri.fsPath;
		let is_runable_file = false;
		if (active_dir && typeof type === 'string') {
			const parentpath = path.dirname(active_dir);
			const name = path.basename(parentpath);
			is_runable_file = (
				['static', 'shared', 'interface'].includes(type) &&
				(name === "examples" || name === "tests")) ||
				(['binary', 'module'].includes(type) && name === 'tests');
		}
		// 仅当项目类型为 binary 或 examples、tests 目录下的文件时，显示运行按钮
		const runable = type === 'binary' || is_runable_file;
		return runable;
	}
	return false;
}

function update_button_visibility(uri: string) {
	vscode.commands.executeCommand('setContext', 'cppcup.buildable', check_buildable(uri));
	check_runable(uri).then(runable => {
		vscode.commands.executeCommand('setContext', 'cppcup.runable', runable);
	});
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "cppcup" is now active!');

	language_activate(context);

	context.subscriptions.push(vscode.commands.registerCommand('cppcup.release', (url: vscode.Uri) => {
		if (!check_buildable(url.fsPath)) {
			vscode.window.showErrorMessage('Not a buildable project.');
			return;
		}
		build_project(false, url.fsPath);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('cppcup.build', (url: vscode.Uri) => {
		if (!check_buildable(url.fsPath)) {
			vscode.window.showErrorMessage('Not a buildable project or file.');
			return;
		}
		build_project(true, url.fsPath);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('cppcup.run', (url: vscode.Uri) => {
		check_runable(url.fsPath).then(runable => {
			if (!runable) {
				vscode.window.showErrorMessage('Not a runable project or file.');
				return;
			}
			run_project(false, url.fsPath);
		});

	}));
	context.subscriptions.push(vscode.commands.registerCommand('cppcup.debug', (url: vscode.Uri) => {
		check_runable(url.fsPath).then(runable => {
			if (!runable) {
				vscode.window.showErrorMessage('Not a runable project or file.');
				return;
			}
			run_project(true, url.fsPath);
		});
	}));

	vscode.window.onDidChangeActiveTextEditor(
		(editor) => {
			const uri = editor?.document.uri;
			if (!uri) { return; }
			update_button_visibility(uri.fsPath);
		}
	);

	// 获取当前处于激活状态的文件
	const active_editor = vscode.window.activeTextEditor;
	if (active_editor) {
		update_button_visibility(active_editor.document.uri.fsPath);
	}
}

export function deactivate() { }
