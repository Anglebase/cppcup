import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import os from 'os';
import { assert } from 'console';

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

function get_table_title(document: vscode.TextDocument, position: vscode.Position) {
    let line = position.line;
    let find = false;
    while (line >= 0) {
        if (/^\[.*?\]$/gm.test(document.lineAt(line).text.trim())) {
            find = true;
            break;
        }
        line--;
    }
    return find ? line : null;
}

function check_pairs(document: vscode.TextDocument, position: vscode.Position) {
    const before = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    let in_quote1 = false;
    let in_quote2 = false;
    let stack = [];
    for (const c of before) {
        switch (c) {
            case '"':
                if (!in_quote2) { in_quote1 = !in_quote1; }
                break;
            case "'":
                if (!in_quote1) { in_quote2 = !in_quote2; }
                break;
            case '{':
            case '(':
            case '[':
                stack.push(c);
                break;
            case '}':
                if (stack.length > 0 && stack[stack.length - 1] === '{') { stack.pop(); }
                else { return false; }
                break;
            case ')':
                if (stack.length > 0 && stack[stack.length - 1] === '(') { stack.pop(); }
                else { return false; }
                break;
            case ']':
                if (stack.length > 0 && stack[stack.length - 1] === '[') { stack.pop(); }
                else { return false; }
                break;
        }
    }
    return stack.length === 0;
}

// 代码补全公共数据
class CompletionItemProvider implements vscode.CompletionItemProvider {
    public static tables = [
        'project',
        'build',
        'target',
        'generator',
        'features',
        'feature',
        'dependecies',
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
        if (['sources', 'includes', 'link_dirs', 'compile_commands', 'path'].includes(name)) {
            const prefix = document.lineAt(position.line).text.slice(0, position.character);
            const last_quote = prefix.lastIndexOf('"') > prefix.lastIndexOf("'") ? '"' : "'";
            const last_slash = prefix.lastIndexOf('/') > prefix.lastIndexOf('\\') ? '/' : '\\';
            let dir = prefix.slice(prefix.lastIndexOf(last_quote) + 1, prefix.lastIndexOf(last_slash) + 1);
            const root_dir = path.dirname(document.uri.fsPath);
            if (!dir) { dir = root_dir; }
            if (!path.isAbsolute(dir)) {
                dir = path.join(root_dir, dir);
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

class EnterCompletionItemProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext)
        : vscode.ProviderResult<vscode.CompletionItem[]> {
        if (!document.fileName.endsWith('cup.toml')) {
            return [];
        }

        const table_title_at = get_table_title(document, position);
        const table = table_title_at ? document.lineAt(table_title_at).text.trim() : null;
        console.log('table_name', table);
        const target_table = [
            { label: 'sources', kind: vscode.CompletionItemKind.Property },
            { label: 'includes', kind: vscode.CompletionItemKind.Property },
            { label: 'defines', kind: vscode.CompletionItemKind.Property },
            { label: 'link_dirs', kind: vscode.CompletionItemKind.Property },
            { label: 'link_libs', kind: vscode.CompletionItemKind.Property },
            { label: 'link_options', kind: vscode.CompletionItemKind.Property },
            { label: 'compile_options', kind: vscode.CompletionItemKind.Property },
            { label: 'compiler_features', kind: vscode.CompletionItemKind.Property },
        ];
        if (table && check_pairs(document, position)) {
            if (/\[[ ]*project[ ]*\]/gm.test(table)) {
                const items = [
                    { label: 'name', detail: '(require)', kind: vscode.CompletionItemKind.Property },
                    { label: 'type', detail: '(require)', kind: vscode.CompletionItemKind.Property },
                    { label: 'version', detail: '(require)', kind: vscode.CompletionItemKind.Property },
                    { label: 'license', kind: vscode.CompletionItemKind.Property },
                ];
                return items.map(item => {
                    return new vscode.CompletionItem({
                        label: item.label,
                        detail: item.detail
                    }, item.kind);
                });
            }
            if (/\[[ ]*build[ ]*\]/gm.test(table)) {
                const items = [
                    { label: 'generator', kind: vscode.CompletionItemKind.Property },
                    { label: 'jobs', kind: vscode.CompletionItemKind.Property },
                    { label: 'stdc', kind: vscode.CompletionItemKind.Property },
                    { label: 'stdcxx', kind: vscode.CompletionItemKind.Property },
                    { label: 'features', kind: vscode.CompletionItemKind.Property },
                ];
                items.push(...target_table);
                return items.map(item => {
                    return new vscode.CompletionItem(item.label, item.kind);
                });
            }
            if (/\[[ ]*((build)|(tests)|(examples))[ ]*\.[ ]*((debug)|(release))\]/gm.test(table) ||
                /\[[ ]*((tests)|(examples))[ ]*\]/gm.test(table) ||
                /\[[ ]*((feature)|(generator)|(target))\.".*?"(.((debug)|(release)))?\]/gm.test(table)
            ) {
                return target_table.map(item => {
                    return new vscode.CompletionItem(item.label, item.kind);
                });
            }
            if (/\[[ ]*build[ ]*\.[ ]*export[ ]*\]/g.test(table)) {
                return [new vscode.CompletionItem('compile_commands', vscode.CompletionItemKind.Property)];
            }
        }
    }
};

class TableCompletionItemProvider implements vscode.CompletionItemProvider {
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
        if (line.length > 1 && line[0] === '[') {
            return CompletionItemProvider.tables.map(table => {
                return new vscode.CompletionItem(table, vscode.CompletionItemKind.Struct);
            });
        }
    }
};

class DotCompletionItemProvider implements vscode.CompletionItemProvider {
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
        if (/^\[[ ]*((((feature)|(generator)|(target))\.".*?")|(tests)|(examples)|(build))/gm.test(before_cursor)) {
            const items = [
                { label: 'debug' },
                { label: 'release' }
            ];
            if (/\[[ ]*build[ ]*\.[ ]*export[ ]*\]/g.test(before_cursor)) {
                items.push({ label: 'compile_commands' });
            }
            return items.map(item => {
                return new vscode.CompletionItem(item.label, vscode.CompletionItemKind.Property);
            });
        }
    }
};

class FeatureCompletionItemProvider implements vscode.CompletionItemProvider {
    public static features = [
        { label: 'c_std_90', detail: '(C)', description: 'Compiler mode is at least C 90.' },
        { label: 'c_std_99', detail: '(C)', description: 'Compiler mode is at least C 99.' },
        { label: 'c_std_11', detail: '(C)', description: 'Compiler mode is at least C 11.' },
        { label: 'c_std_17', detail: '(C)', description: 'Compiler mode is at least C 17.' },
        { label: 'c_std_23', detail: '(C)', description: 'Compiler mode is at least C 23.' },
        { label: 'c_function_prototypes', detail: '(C)', description: 'Function prototypes, as defined in ISO/IEC 9899:1990.' },
        { label: 'c_restrict', detail: '(C)', description: '`restrict` keyword, as defined in ISO/IEC 9899:1999.' },
        { label: 'c_static_assert', detail: '(C)', description: 'Static assert, as defined in ISO/IEC 9899:2011.' },
        { label: 'c_variadic_macros', detail: '(C)', description: 'Variadic macros, as defined in ISO/IEC 9899:1999.' },
        { label: 'cuda_std_03', detail: '(CUDA)', description: 'Compiler mode is at least CUDA/C++ 03.' },
        { label: 'cuda_std_11', detail: '(CUDA)', description: 'Compiler mode is at least CUDA/C++ 11.' },
        { label: 'cuda_std_14', detail: '(CUDA)', description: 'Compiler mode is at least CUDA/C++ 14.' },
        { label: 'cuda_std_17', detail: '(CUDA)', description: 'Compiler mode is at least CUDA/C++ 17.' },
        { label: 'cuda_std_20', detail: '(CUDA)', description: 'Compiler mode is at least CUDA/C++ 20.' },
        { label: 'cuda_std_23', detail: '(CUDA)', description: 'Compiler mode is at least CUDA/C++ 23.' },
        { label: 'cuda_std_26', detail: '(CUDA)', description: 'Compiler mode is at least CUDA/C++ 26.' },
        { label: 'cxx_std_98', detail: '(C++)', description: 'Compiler mode is at least C++ 98.' },
        { label: 'cxx_std_11', detail: '(C++)', description: 'Compiler mode is at least C++ 11.' },
        { label: 'cxx_std_14', detail: '(C++)', description: 'Compiler mode is at least C++ 14.' },
        { label: 'cxx_std_17', detail: '(C++)', description: 'Compiler mode is at least C++ 17.' },
        { label: 'cxx_std_20', detail: '(C++)', description: 'Compiler mode is at least C++ 20.' },
        { label: 'cxx_std_23', detail: '(C++)', description: 'Compiler mode is at least C++ 23.' },
        { label: 'cxx_std_26', detail: '(C++)', description: 'Compiler mode is at least C++ 26.' },
        { label: 'cxx_template_template_parameters', detail: '(C++98)', description: 'Template template parameters, as defined in ISO/IEC 14882:1998.' },
        { label: 'cxx_alias_templates', detail: '(C++11)', description: 'Template aliases, as defined in N2258.' },
        { label: 'cxx_alignas', detail: '(C++11)', description: 'Alignment control alignas, as defined in N2341.' },
        { label: 'cxx_alignof', detail: '(C++11)', description: 'Alignment control alignof, as defined in N2341.' },
        { label: 'cxx_attributes', detail: '(C++11)', description: 'Generic attributes, as defined in N2761.' },
        { label: 'cxx_auto_type', detail: '(C++11)', description: 'Automatic type deduction, as defined in N1984.' },
        { label: 'cxx_constexpr', detail: '(C++11)', description: 'Constant expressions, as defined in N2235.' },
        { label: 'cxx_decltype_incomplete_return_types', detail: '(C++11)', description: 'Decltype on incomplete return types, as defined in N3276.' },
        { label: 'cxx_decltype', detail: '(C++11)', description: 'Decltype, as defined in N2343.' },
        { label: 'cxx_default_function_template_args', detail: '(C++11)', description: 'Default template arguments for function templates, as defined in DR226' },
        { label: 'cxx_defaulted_functions', detail: '(C++11)', description: 'Defaulted functions, as defined in N2346.' },
        { label: 'cxx_defaulted_move_initializers', detail: '(C++11)', description: 'Defaulted move initializers, as defined in N3053.' },
        { label: 'cxx_delegating_constructors', detail: '(C++11)', description: 'Delegating constructors, as defined in N1986.' },
        { label: 'cxx_deleted_functions', detail: '(C++11)', description: 'Deleted functions, as defined in N2346.' },
        { label: 'cxx_enum_forward_declarations', detail: '(C++11)', description: 'Enum forward declarations, as defined in N2764.' },
        { label: 'cxx_explicit_conversions', detail: '(C++11)', description: 'Explicit conversion operators, as defined in N2437.' },
        { label: 'cxx_extended_friend_declarations', detail: '(C++11)', description: 'Extended friend declarations, as defined in N1791.' },
        { label: 'cxx_extern_templates', detail: '(C++11)', description: 'Extern templates, as defined in N1987.' },
        { label: 'cxx_final', detail: '(C++11)', description: 'Override control final keyword, as defined in N2928, N3206 and N3272.' },
        { label: 'cxx_func_identifier', detail: '(C++11)', description: 'Predefined __func__ identifier, as defined in N2340.' },
        { label: 'cxx_generalized_initializers', detail: '(C++11)', description: 'Initializer lists, as defined in N2672.' },
        { label: 'cxx_inheriting_constructors', detail: '(C++11)', description: 'Inheriting constructors, as defined in N2540.' },
        { label: 'cxx_inline_namespaces', detail: '(C++11)', description: 'Inline namespaces, as defined in N2535.' },
        { label: 'cxx_lambdas', detail: '(C++11)', description: 'Lambda functions, as defined in N2927.' },
        { label: 'cxx_local_type_template_args', detail: '(C++11)', description: 'Local and unnamed types as template arguments, as defined in N2657.' },
        { label: 'cxx_long_long_type', detail: '(C++11)', description: 'long long type, as defined in N1811.' },
        { label: 'cxx_noexcept', detail: '(C++11)', description: 'Exception specifications, as defined in N3050.' },
        { label: 'cxx_nonstatic_member_init', detail: '(C++11)', description: 'Non-static data member initialization, as defined in N2756.' },
        { label: 'cxx_nullptr', detail: '(C++11)', description: 'Null pointer, as defined in N2431.' },
        { label: 'cxx_override', detail: '(C++11)', description: 'Override control override keyword, as defined in N2928, N3206 and N3272.' },
        { label: 'cxx_range_for', detail: '(C++11)', description: 'Range-based for, as defined in N2930.' },
        { label: 'cxx_raw_string_literals', detail: '(C++11)', description: 'Raw string literals, as defined in N2442.' },
        { label: 'cxx_reference_qualified_functions', detail: '(C++11)', description: 'Reference qualified functions, as defined in N2439.' },
        { label: 'cxx_right_angle_brackets', detail: '(C++11)', description: 'Right angle bracket parsing, as defined in N1757.' },
        { label: 'cxx_rvalue_references', detail: '(C++11)', description: 'R-value references, as defined in N2118.' },
        { label: 'cxx_sizeof_member', detail: '(C++11)', description: 'Size of non-static data members, as defined in N2253.' },
        { label: 'cxx_static_assert', detail: '(C++11)', description: 'Static assert, as defined in N1720.' },
        { label: 'cxx_strong_enums', detail: '(C++11)', description: 'Strongly typed enums, as defined in N2347.' },
        { label: 'cxx_thread_local', detail: '(C++11)', description: 'Thread-local variables, as defined in N2659.' },
        { label: 'cxx_trailing_return_types', detail: '(C++11)', description: 'Automatic function return type, as defined in N2541.' },
        { label: 'cxx_unicode_literals', detail: '(C++11)', description: 'Unicode string literals, as defined in N2442.' },
        { label: 'cxx_uniform_initialization', detail: '(C++11)', description: 'Uniform initialization, as defined in N2640.' },
        { label: 'cxx_unrestricted_unions', detail: '(C++11)', description: 'Unrestricted unions, as defined in N2544.' },
        { label: 'cxx_user_literals', detail: '(C++11)', description: 'User-defined literals, as defined in N2765.' },
        { label: 'cxx_variadic_macros', detail: '(C++11)', description: 'Variadic macros, as defined in N1653.' },
        { label: 'cxx_variadic_templates', detail: '(C++11)', description: 'Variadic templates, as defined in N2242.' },
        { label: 'cxx_aggregate_default_initializers', detail: '(C++14)', description: 'Aggregate default initializers, as defined in N3605.' },
        { label: 'cxx_attribute_deprecated', detail: '(C++14)', description: '[[deprecated]] attribute, as defined in N3760.' },
        { label: 'cxx_binary_literals', detail: '(C++14)', description: 'Binary literals, as defined in N3472.' },
        { label: 'cxx_contextual_conversions', detail: '(C++14)', description: 'Contextual conversions, as defined in N3323.' },
        { label: 'cxx_decltype_auto', detail: '(C++14)', description: 'decltype(auto) semantics, as defined in N3638.' },
        { label: 'cxx_digit_separators', detail: '(C++14)', description: 'Digit separators, as defined in N3781.' },
        { label: 'cxx_generic_lambdas', detail: '(C++14)', description: 'Generic lambdas, as defined in N3649.' },
        { label: 'cxx_lambda_init_captures', detail: '(C++14)', description: 'Initialized lambda captures, as defined in N3648.' },
        { label: 'cxx_relaxed_constexpr', detail: '(C++14)', description: 'Relaxed constexpr, as defined in N3652.' },
        { label: 'cxx_return_type_deduction', detail: '(C++14)', description: 'Return type deduction on normal functions, as defined in N3386.' },
        { label: 'cxx_variable_templates', detail: '(C++14)', description: 'Variable templates, as defined in N3651.' },
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
        const name = get_field_name(document, position);
        if (!name) { return []; }
        if (name === 'compiler_features') {
            return FeatureCompletionItemProvider.features.map(feature => {
                return new vscode.CompletionItem({
                    label: feature.label,
                    detail: feature.detail,
                    description: feature.description
                }, vscode.CompletionItemKind.Property);
            });
        }
    }
};

class DependencyCompletionItemProvider implements vscode.CompletionItemProvider {
    public static dependencies = [
        new vscode.CompletionItem('url', vscode.CompletionItemKind.Property),
        new vscode.CompletionItem('path', vscode.CompletionItemKind.Property),
        new vscode.CompletionItem('version', vscode.CompletionItemKind.Property),
        new vscode.CompletionItem('features', vscode.CompletionItemKind.Property),
        new vscode.CompletionItem('optional', vscode.CompletionItemKind.Property),
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
        const title_at = get_table_title(document, position);
        const title = title_at ? document.lineAt(title_at).text.trim() : '';
        if (!title || !title_at) { return []; }
        if (/\[[ ]*dependencies[ ]*\]/g.test(title)) {
            const before = document.getText(new vscode.Range(new vscode.Position(title_at, 0), position));
            for (let i = before.length - 1; i >= 0; i--) {
                switch (before[i]) {
                    case '{':
                        return DependencyCompletionItemProvider.dependencies;
                    case '}':
                        return [];
                }
            }
        }
    }
};

class DependencyTableCompletionItemProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext)
        : vscode.ProviderResult<vscode.CompletionItem[]> {
        if (!document.fileName.endsWith('cup.toml')) {
            return [];
        }
        const title_at = get_table_title(document, position);
        const title = title_at ? document.lineAt(title_at).text.trim() : '';
        if (!title || !title_at) { return []; }
        if (/\[[ ]*dependencies[ ]*\.[ ]*[a-zA-Z0-9_]+\]/g.test(title) && check_pairs(document, position)) {
            return DependencyCompletionItemProvider.dependencies;
        }
    }
};

export function language_activate(context: vscode.ExtensionContext) {
    // 代码补全
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new CompletionItemProvider()));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new EnterCompletionItemProvider(), '\n'));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new QuotesCompletionItemProvider(), '"', "'"));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new NumberCompletionItemProvider(), '=', ' ', ...'1234567890'));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new PathCompletionItemProvider(), '"', '/', '\\', "'"));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new TableCompletionItemProvider(), '['));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new DotCompletionItemProvider(), '.'));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new FeatureCompletionItemProvider(), '"', "'"));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new DependencyCompletionItemProvider(), '{', ','));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('toml',
        new DependencyTableCompletionItemProvider(), '\n'));
}