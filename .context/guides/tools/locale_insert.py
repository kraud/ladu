"""Append members at the end of a named object of a locale JSON file, as text.

Why text and not a JSON round-trip: `json.dump` reformats lines that have nothing to do with the
change (for example `"info":  "…"` with two spaces in `wordRelated.json`), so a diff would be noisy.

Used for the French work (.context/plans/language-french.md): the new form strings go into all
locales (`frontend/public/locales/<code>/wordRelated.json`).

Usage (run with `python3`, from the repo root):

    import sys; sys.path.insert(0, '.context/guides/tools')
    from locale_insert import append_members, french

    p = 'frontend/public/locales/fr/wordRelated.json'
    text = open(p, encoding='utf-8').read()
    text = append_members(text, ['wordForm', 'verb', 'fields'], [
        ('infinitiveFR', french("Infinitif~: (se termine par -er, -ir, -re)")),
    ])
    json.loads(text)                      # still valid JSON?
    open(p, 'w', encoding='utf-8').write(text)

`path` is the list of keys down to the object; each key is searched after the previous one. A member
value is a string or a dict (a nested object, for example an `errors.formFR` block).

`french(text)` writes French typography in a draft: `~` becomes a no-break space (before `: ; ? !`
and inside `« »`) and `'` becomes the apostrophe `’`. Use it only for the `fr` file.
Check the result with `npm test -w frontend` (`src/lib/locales.test.ts` compares every locale file
with English: keys, `{{placeholders}}`, tags).
"""
import json
import re

NBSP = ' '


def french(text: str) -> str:
    """Draft marker → French typography: `~` → no-break space, `'` → `’`."""
    return text.replace('~', NBSP).replace("'", '’')


def find_object(text, path):
    """Index of the '{' of the object at `path` (list of keys), searching each key after the previous one."""
    pos = 0
    for key in path:
        m = re.compile(r'"%s"\s*:\s*\{' % re.escape(key)).search(text, pos)
        if not m:
            raise KeyError(f'{key} not found after {pos}')
        pos = m.end() - 1
    return pos


def matching_brace(text, start):
    depth, i, in_str = 0, start, False
    while i < len(text):
        c = text[i]
        if in_str:
            if c == '\\':
                i += 1
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    raise ValueError('unbalanced')


def append_members(text, path, members):
    """members: list of (key, value); value is a str or a dict. Written with indent 2 from the object's indent."""
    start = find_object(text, path)
    end = matching_brace(text, start)
    line_start = text.rfind('\n', 0, end) + 1          # start of the line holding the closing brace
    close_indent = text[line_start:end]                 # its indentation (spaces only)
    inner = close_indent + '  '

    def render(key, value, indent):
        if isinstance(value, dict):
            body = ',\n'.join(render(k, v, indent + '  ') for k, v in value.items())
            return f'{indent}{json.dumps(key)}: {{\n{body}\n{indent}}}'
        return f'{indent}{json.dumps(key)}: {json.dumps(value, ensure_ascii=False)}'

    added = ',\n'.join(render(k, v, inner) for k, v in members)
    before = text[:line_start].rstrip('\n')
    return before + ',\n' + added + '\n' + text[line_start:]
