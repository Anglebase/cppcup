import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import os from 'os';

function get_field_name(document: vscode.TextDocument, position: vscode.Position) {
    // 查找光标之前等号位置
    let line = position.line;
    let find = false;
    while (line >= 0) {
        if (document.lineAt(line).text.trim().includes("=")) {
            find = true;
            break;
        }
        line--;
    }
    if (!find) { return null; }
    let line_text = document.lineAt(line).text.trim();
    let match = line_text.match(/([a-z_]+)[ ]*=/g);
    console.log(match);
    if (!match) { return null; }
    const name = match[match.length - 1].replace("=", "").trim();
    return name;
}

// 代码补全公共数据
class CompletionItemProvider implements vscode.CompletionItemProvider {
    public static keywords = [
        'project',
        'build',
        'target',
        'generator',
        'features',
        'feature',
        'dependecies',

        'name',
        'type',
        'version',
        'license',

        'jobs',
        'stdc',
        'stdcxx',
        'features',

        'sources',
        'defines',
        'includes',
        'link_dirs',
        'link_libs',
        'link_options',
        'compile_options',
        'compiler_features',

        'export',
        'compile_commands',

        'debug',
        'release',

        'url',
        'path',
        'tests',
        'examples'
    ];
    public static generators = [
        // Makefile
        { label: 'Borland Makefiles', description: 'Makefile' },
        { label: 'MSYS Makefiles', description: 'Makefile' },
        { label: 'MinGW Makefiles', description: 'Makefile' },
        { label: 'NMake Makefiles', description: 'Makefile' },
        { label: 'NMake Makefiles JOM', description: 'Makefile' },
        { label: 'Unix Makefiles', description: 'Makefile' },
        { label: 'Watcom WMake', description: 'Makefile' },
        // Ninja
        { label: 'Ninja', description: 'Ninja' },
        { label: 'Ninja Multi-Config', description: 'Ninja' },
        // Visual Studio
        { label: 'Visual Studio 6', description: 'Visual Studio' },
        { label: 'Visual Studio 7', description: 'Visual Studio' },
        { label: 'Visual Studio 7 .NET 2003', description: 'Visual Studio' },
        { label: 'Visual Studio 8 2005', description: 'Visual Studio' },
        { label: 'Visual Studio 9 2008', description: 'Visual Studio' },
        { label: 'Visual Studio 10 2010', description: 'Visual Studio' },
        { label: 'Visual Studio 11 2012', description: 'Visual Studio' },
        { label: 'Visual Studio 12 2013', description: 'Visual Studio' },
        { label: 'Visual Studio 14 2015', description: 'Visual Studio' },
        { label: 'Visual Studio 15 2017', description: 'Visual Studio' },
        { label: 'Visual Studio 16 2019', description: 'Visual Studio' },
        { label: 'Visual Studio 17 2022', description: 'Visual Studio' },
        // Other
        { label: 'Green Hills MULTI' },
        { label: 'Xcode' },
        // Deprecated
        { label: 'CodeBlocks', deprecated: true },
        { label: 'CodeLite', deprecated: true },
        { label: 'Eclipse CDT4', deprecated: true },
        { label: 'Kate', deprecated: true },
        { label: 'Sublime Text 2', deprecated: true },
    ];
    public static targets = [
        { label: 'ADSP', description: 'Analog Devices Audio Digital Signal Processing' },
        { label: 'AIX', description: 'IBM Unix operating system' },
        { label: 'Android', description: 'Android operating system' },
        { label: 'ARTOS', description: 'Operating system for microcontrollers' },
        { label: 'BeOS', description: 'Operating system for personal computers', deprecated: true },
        { label: 'BlueGeneL', description: 'Blue Gene/L static environment' },
        { label: 'BlueGeneP-dynamic', description: 'Blue Gene/P dynamic environment' },
        { label: 'BlueGeneP-static', description: 'Blue Gene/P static environment' },
        { label: 'BlueGeneQ-dynamic', description: 'Blue Gene/Q dynamic environment' },
        { label: 'BlueGeneQ-static', description: 'Blue Gene/Q static environment' },
        { label: 'BSDOS', description: 'BSD operating system', deprecated: true },
        { label: 'Catamount', description: 'Operating system for Cray XT series' },
        { label: 'CrayLinuxEnvironment', description: 'Cray Linux Environment' },
        { label: 'CYGWIN', description: 'Cygwin environment for Windows' },
        { label: 'Darwin', description: 'Apple stationary operating systems (macOS, OS X, etc.)' },
        { label: 'DOS', description: 'MS-DOS or compatible' },
        { label: 'DragonFly', description: 'BSD-derived operating system' },
        { label: 'eCos', description: 'Real-time embedded operating system' },
        { label: 'Emscripten', description: 'Compiler toolchain to WebAssembly' },
        { label: 'Euros', description: 'Real-time operating system for embedded devices' },
        { label: 'FreeBSD', description: 'FreeBSD operating system' },
        { label: 'Fuchsia', description: 'Operating system by Google based on the Zircon kernel' },
        { label: 'Generic-ADSP', description: 'Generic ADSP (Audio DSP) environment' },
        { label: 'Generic-ELF', description: 'Generic ELF (Executable and Linkable Format) environment' },
        { label: 'Generic', description: 'Some platforms, e.g. bare metal embedded devices' },
        { label: 'GHS-MULTI', description: 'Green Hills Software MULTI environment' },
        { label: 'GNU', description: 'GNU/Hurd-based operating system' },
        { label: 'Haiku', description: 'Unix operating system inspired by BeOS' },
        { label: 'HP-UX', description: 'Hewlett Packard Unix' },
        { label: 'iOS', description: 'Apple mobile phone operating system' },
        { label: 'Linux', description: 'All Linux-based distributions' },
        { label: 'Midipix', description: 'POSIX-compatible layer for Windows' },
        { label: 'MirBSD', description: 'MirOS BSD operating system' },
        { label: 'MP-RAS', description: 'MP-RAS UNIX operating system' },
        { label: 'MSYS', description: 'MSYS environment (MSYSTEM=MSYS)' },
        { label: 'NetBSD', description: 'NetBSD operating systems' },
        { label: 'OpenBSD', description: 'OpenBSD operating systems' },
        { label: 'OpenVMS', description: 'OpenVMS operating system by HP' },
        { label: 'OS2', description: 'OS/2 operating system' },
        { label: 'OSF1', description: 'Compaq Tru64 UNIX (formerly DEC OSF/1, Digital Unix)', deprecated: true },
        { label: 'QNX', description: 'Unix-like operating system by BlackBerry' },
        { label: 'RISCos', description: 'RISC OS operating system' },
        { label: 'SCO_SV', description: 'SCO OpenServer 5' },
        { label: 'SerenityOS', description: 'Unix-like operating system' },
        { label: 'SINIX', description: 'SINIX operating system' },
        { label: 'SunOS', description: 'Oracle Solaris and all illumos operating systems' },
        { label: 'syllable', description: 'Syllable operating system' },
        { label: 'Tru64', description: 'Compaq Tru64 UNIX (formerly DEC OSF/1) operating system' },
        { label: 'tvOS', description: 'Apple TV operating system' },
        { label: 'ULTRIX', description: 'Unix operating system', deprecated: true },
        { label: 'UNIX_SV', description: 'SCO UnixWare (pre release 7)' },
        { label: 'UnixWare', description: 'SCO UnixWare 7' },
        { label: 'visionOS', description: 'Apple mixed reality operating system' },
        { label: 'WASI', description: 'WebAssembly System Interface' },
        { label: 'watchOS', description: 'Apple watch operating system' },
        { label: 'Windows', description: 'Windows stationary operating systems' },
        { label: 'WindowsCE', description: 'Windows Embedded Compact' },
        { label: 'WindowsPhone', description: 'Windows mobile phone operating system' },
        { label: 'WindowsStore', description: 'Universal Windows Platform applications' },
        { label: 'Xenix', description: 'SCO Xenix Unix operating system', deprecated: true }
    ];
    public static stdc = [
        { label: '90', description: 'C89/C90' },
        { label: '99', description: 'C99' },
        { label: '11', description: 'C11' },
        { label: '17', description: 'Since CMake 3.21, C17' },
        { label: '23', description: 'Since CMake 3.21, C23' },
    ];
    public static stdcxx = [
        { label: '98', description: 'C++98' },
        { label: '11', description: 'C++11' },
        { label: '14', description: 'C++14' },
        { label: '17', description: 'Since CMake 3.8, C++17' },
        { label: '20', description: 'Since CMake 3.12, C++20' },
        { label: '23', description: 'Since CMake 3.20, C++23' },
        { label: '26', description: 'Since CMake 3.25, C++26' },
    ];
    public static types = [
        'binary',
        'static',
        'shared',
        'module',
        'interface'
    ];

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext)
        : vscode.ProviderResult<vscode.CompletionItem[]> {
        if (!document.fileName.endsWith('cup.toml')) {
            return [];
        }
        return CompletionItemProvider.keywords.map(keyword => {
            let result = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            return result;
        });
    }
};

// 针对于字符串的补全
class QuotesCompletionItemProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext)
        : vscode.ProviderResult<vscode.CompletionItem[]> {
        if (!document.fileName.endsWith('cup.toml')) {
            return [];
        }
        const line = document.lineAt(position.line).text.trim();
        const before_cursor = line.slice(0, position.character);
        console.log(line, before_cursor);
        // 匹配 [generator. ， 列出有效的生成器
        if (/[ ]*\[[ ]*generator[ ]*\./g.test(before_cursor) ||
            /[ ]*generator[ ]*=[ ]*/g.test(before_cursor)) {
            return CompletionItemProvider.generators.map(generator => {
                let result = new vscode.CompletionItem({
                    label: generator.label,
                    description: generator.description
                }, vscode.CompletionItemKind.Value);
                if (generator.deprecated) {
                    result.tags = [vscode.CompletionItemTag.Deprecated];
                }
                return result;
            });
        }
        // 匹配 [target. 列出有效的目标平台
        if (/[ ]*\[[ ]*target[ ]*\./g.test(before_cursor)) {
            return CompletionItemProvider.targets.map(target => {
                let result = new vscode.CompletionItem({
                    label: target.label,
                    description: target.description
                }, vscode.CompletionItemKind.Value);
                if (target.deprecated) {
                    result.tags = [vscode.CompletionItemTag.Deprecated];
                }
                return result;
            });
        }
        // 匹配 type = 列出有效的项目类型
        if (/[ ]*type[ ]*=[ ]*/g.test(before_cursor)) {
            console.log('in type');
            // 获取本地的插件项目类型
            const plugin_dir = path.join(os.homedir(), '.cup', 'plugins');
            let plugin_names: string[] = [];
            if (fs.existsSync(plugin_dir)) {
                for (let file of fs.readdirSync(plugin_dir)) {
                    const name = path.basename(file, path.extname(file));
                    plugin_names.push(name);
                }
            }
            plugin_names.push(...CompletionItemProvider.types);
            console.log(plugin_names);
            return plugin_names.map(type => {
                let result = new vscode.CompletionItem(type, vscode.CompletionItemKind.Value);
                return result;
            });
        }
    };
};

// 针对于数字的补全
class NumberCompletionItemProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext)
        : vscode.ProviderResult<vscode.CompletionItem[]> {
        if (!document.fileName.endsWith('cup.toml')) {
            return [];
        }
        const line = document.lineAt(position.line).text.trim();
        // 匹配 stdc = 列出有效的 C 标准
        if (/[ ]*stdc[ ]*=[ ]*/g.test(line)) {
            return CompletionItemProvider.stdc.map(std => {
                let result = new vscode.CompletionItem({
                    label: std.label,
                    description: std.description
                }, vscode.CompletionItemKind.Value);
                return result;
            });
        }
        // 匹配 stdcxx = 列出有效的 C++ 标准
        if (/[ ]*stdcxx[ ]*=[ ]*/g.test(line)) {
            return CompletionItemProvider.stdcxx.map(std => {
                let result = new vscode.CompletionItem({
                    label: std.label,
                    description: std.description
                }, vscode.CompletionItemKind.Value);
                return result;
            });
        }
        // 匹配 jobs = 列出有效的并行编译数
        if (/[ ]*jobs[ ]*=[ ]*/g.test(line)) {
            const count = os.availableParallelism();
            let result = [];
            result.push({ label: '0', detail: `(${count})` });
            for (let i = 1; i <= count; i++) {
                result.push({ label: i.toString() });
            }
            return result.map(job => {
                return new vscode.CompletionItem({
                    label: job.label,
                    detail: job.detail
                }, vscode.CompletionItemKind.Value);
            });
        }
    }
};

// 针对于路径项的补全
class PathCompletionItemProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext)
        : vscode.ProviderResult<vscode.CompletionItem[]> {
        if (!document.fileName.endsWith('cup.toml')) {
            return [];
        }
        const name = get_field_name(document, position);
        console.log('name', name);
        if (!name) { return []; }
        // 判断是否属于路径配置字段
        if (['sources', 'includes', 'link_dirs'].includes(name)) {
            const prefix = document.lineAt(position.line).text.slice(0, position.character);
            const last_quote = prefix.lastIndexOf('"') > prefix.lastIndexOf("'") ? '"' : "'";
            const last_slash = prefix.lastIndexOf('/') > prefix.lastIndexOf('\\') ? '/' : '\\';
            let dir = prefix.slice(prefix.lastIndexOf(last_quote) + 1, prefix.lastIndexOf(last_slash) + 1);
            if (!vscode.workspace.workspaceFolders) { return []; }
            const workspace_dir = vscode.workspace.workspaceFolders[0].uri.fsPath;
            if (!dir) { dir = workspace_dir; }
            if (!path.isAbsolute(dir)) {
                dir = path.join(workspace_dir, dir);
            }
            // 解析路径所定位的位置
            dir = path.normalize(dir);
            if (!fs.existsSync(dir)) {
                return [];
            }
            // 列出该路径下所有的有效内容
            let items = [];
            for (const file of fs.readdirSync(dir)) {
                console.log(file);
                items.push({
                    name: file,
                    is_file: fs.statSync(path.join(dir, file)).isFile()
                });
            }
            return items.map(item => {
                const name = item.name;
                const type = item.is_file ? vscode.CompletionItemKind.File : vscode.CompletionItemKind.Folder;
                return new vscode.CompletionItem(name, type);
            });
        }
    }
};

export function language_activate(context: vscode.ExtensionContext) {
    // 代码补全
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new CompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new QuotesCompletionItemProvider(), '"', "'"));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new NumberCompletionItemProvider(), '=', ' ', ...'1234567890'));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new PathCompletionItemProvider(), '"', '/', '\\', "'"));
}