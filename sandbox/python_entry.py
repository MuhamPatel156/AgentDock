"""Trusted entry point; project code executes only after isolated startup."""
from pathlib import Path
import runpy
import sys

def main():
    entry, root = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    if not entry.is_relative_to(root) or entry.suffix != '.py' or not entry.is_file():
        raise ValueError('Python entry must stay within the project.')
    sys.path.insert(0, str(root))
    sys.argv = [str(entry)]
    runpy.run_path(str(entry), run_name='__main__')

if __name__ == '__main__':
    main()
