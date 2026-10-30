"""Fixed Python jobs. No dependency installation or arbitrary shell command."""
import ast
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import unittest
HELPER_ROOT = Path(__file__).resolve().parent

def main():
    mode, source, work = sys.argv[1], Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve()
    if mode not in {'syntax', 'unittest', 'pytest', 'run'}:
        raise ValueError('Unsupported Python job.')
    files = sorted(source.rglob('*.py'))
    if not files:
        raise ValueError('Add a Python source file first.')
    if mode == 'syntax':
        failed = False
        for file in files:
            try:
                ast.parse(file.read_text(encoding='utf-8'), filename=str(file.relative_to(source)))
                print(str(file.relative_to(source)) + ': syntax passed')
            except (SyntaxError, UnicodeError) as error:
                failed = True
                print(str(file.relative_to(source)) + ': line ' + str(getattr(error, 'lineno', '?')) + ' / ' + str(getattr(error, 'msg', 'invalid text')))
        return 1 if failed else 0
    shutil.copytree(source, work, dirs_exist_ok=True)
    os.chdir(work)
    os.environ['PYTEST_DISABLE_PLUGIN_AUTOLOAD'] = '1'
    if mode == 'pytest':
        import pytest  # Load the image's runner before adding project imports.
        sys.path.insert(0, str(work))
        return pytest.main(['-q', '-c', str(HELPER_ROOT / 'pytest.ini'), '-p', 'no:cacheprovider', '--basetemp=' + str(work / '.pytest-temp'), str(work)])
    if mode == 'unittest':
        sys.path.insert(0, str(work))
        suite = unittest.defaultTestLoader.discover(str(work), pattern='test_*.py')
        result = unittest.TextTestRunner(verbosity=2).run(suite)
        return (0 if result.wasSuccessful() else 1) if result.testsRun else 5
    config = json.loads((work / 'agentdock.runtime.json').read_text(encoding='utf-8'))
    if config.get('kind') != 'script':
        raise ValueError('Run Python script requires kind: script in runtime configuration.')
    entry = (work / config.get('entry', 'main.py')).resolve()
    if not entry.is_relative_to(work) or entry.suffix != '.py':
        raise ValueError('Invalid Python script entry.')
    return subprocess.call([sys.executable, '-I', '-B', str(HELPER_ROOT / 'python_entry.py'), str(entry), str(work)], env={key: value for key, value in os.environ.items() if key in {'PATH', 'PORT', 'PYTHONDONTWRITEBYTECODE', 'PYTHONUNBUFFERED'}})

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
