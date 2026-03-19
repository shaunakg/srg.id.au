from __future__ import annotations
import os, re, shutil, textwrap, tomllib
from pathlib import Path

SRC = Path('/home/ubuntu/portfolio-zola')
DST = Path('/home/ubuntu/portfolio-astro')
POSTS_SRC = SRC / 'content' / 'posts'
POSTS_DST = DST / 'src' / 'content' / 'posts'

IMPORTS = textwrap.dedent('''
import Figure from '../../components/mdx/Figure.astro'
import Carousel from '../../components/mdx/Carousel.astro'
import CarouselItem from '../../components/mdx/CarouselItem.astro'
import VideoFigure from '../../components/mdx/VideoFigure.astro'
import Callout from '../../components/mdx/Callout.astro'
''').strip()

ATTR_RE = re.compile(r'(\w+)\s*=\s*(".*?"|true|false|[0-9]+)', re.S)


def parse_frontmatter(raw: str):
    text = raw.lstrip('\n')
    if not text.startswith('+++'):
        return {}, raw
    _, rest = text.split('+++', 1)
    front, body = rest.split('+++', 1)
    data = tomllib.loads(front)
    return data, body.lstrip('\n')


def yaml_scalar(value):
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if value is None:
        return 'null'
    return '"' + str(value).replace('"', '\\"') + '"'


def build_yaml(data: dict):
    lines = ['---']
    fields = {
        'title': data.get('title'),
        'description': data.get('description'),
        'date': str(data.get('date')) if data.get('date') else None,
        'draft': data.get('draft', False),
        'slug': data.get('slug'),
        'tags': (data.get('taxonomies') or {}).get('tags', []),
        'featureImage': (data.get('extra') or {}).get('feature_image'),
        'bannerIframe': (data.get('extra') or {}).get('banner_iframe'),
        'useImageAsTitle': (data.get('extra') or {}).get('use_image_as_title'),
        'ogImage': (data.get('extra') or {}).get('og_image'),
        'externalLink': data.get('extra', {}).get('external_link') if isinstance(data.get('extra'), dict) else data.get('extra.external_link'),
        'disableComments': (data.get('extra') or {}).get('disable_comments', False),
        'disableToc': (data.get('extra') or {}).get('disable_toc', False),
    }
    for key, value in fields.items():
        if value in (None, [], False) and key not in {'draft', 'disableComments', 'disableToc'}:
            continue
        if isinstance(value, list):
            lines.append(f'{key}:')
            for item in value:
                lines.append(f'  - {yaml_scalar(item)}')
        else:
            lines.append(f'{key}: {yaml_scalar(value)}')
    lines.append('---')
    return '\n'.join(lines)


def parse_attrs(attrs: str):
    parsed = {}
    for key, value in ATTR_RE.findall(attrs):
        value = value.strip()
        if value == 'true':
            parsed[key] = True
        elif value == 'false':
            parsed[key] = False
        elif value.isdigit():
            parsed[key] = int(value)
        elif value.startswith('"') and value.endswith('"'):
            parsed[key] = value[1:-1]
        else:
            parsed[key] = value
    return parsed


def jsx_attrs(attrs: dict, slug: str):
    out = []
    for key, value in attrs.items():
        prop_key = {'video_type': 'videoType'}.get(key, key)
        if isinstance(value, bool):
            if value:
                out.append(prop_key)
        elif isinstance(value, int):
            out.append(f'{prop_key}={{{value}}}')
        else:
            if prop_key in {'src', 'link'}:
                value = resolve_asset(value, slug)
            out.append(f'{prop_key}="{value.replace("\"", "&quot;")}"')
    return (' ' + ' '.join(out)) if out else ''


def resolve_asset(value: str, slug: str):
    if value.startswith(('http://', 'https://', '/', '#', 'mailto:')):
        return value
    return f'/posts/{slug}/{value}'


def find_block(text: str, start: int):
    open_match = re.match(r'\{%\s*([a-z_]+)\((.*?)\)\s*%\}', text[start:], re.S)
    if not open_match:
        return None
    tag = open_match.group(1)
    attrs = open_match.group(2)
    cursor = start + open_match.end()
    depth = 1
    token_re = re.compile(r'\{%\s*([a-z_]+)(?:\((.*?)\))?\s*%\}', re.S)
    while True:
        token = token_re.search(text, cursor)
        if not token:
            raise ValueError(f'unterminated shortcode block: {tag}')
        name = token.group(1)
        if name == 'end':
            depth -= 1
            if depth == 0:
                body = text[start + open_match.end():token.start()]
                return tag, attrs, body, token.end()
        else:
            depth += 1
        cursor = token.end()


def convert_shortcodes(text: str, slug: str):
    text = re.sub(r'<!--\s*\{%[\s\S]*?\{%\s*end\s*%\}\s*-->', '', text)
    output = []
    i = 0
    while i < len(text):
        start = text.find('{%', i)
        if start == -1:
            output.append(text[i:])
            break
        output.append(text[i:start])
        block = find_block(text, start)
        if not block:
            output.append(text[start:start+2])
            i = start + 2
            continue
        tag, attrs_text, body, end_idx = block
        attrs = parse_attrs(attrs_text)
        inner = convert_shortcodes(body.strip(), slug) if body.strip() else ''
        if tag == 'figure':
            output.append(f'<Figure{jsx_attrs(attrs, slug)}>\n{inner}\n</Figure>')
        elif tag == 'video':
            output.append(f'<VideoFigure{jsx_attrs(attrs, slug)}>\n{inner}\n</VideoFigure>')
        elif tag == 'callout':
            output.append(f'<Callout{jsx_attrs(attrs, slug)}>\n{inner}\n</Callout>')
        elif tag == 'carousel':
            output.append(f'<Carousel>\n{inner}\n</Carousel>')
        elif tag == 'carousel_item':
            output.append(f'<CarouselItem{jsx_attrs(attrs, slug)}>\n{inner}\n</CarouselItem>')
        else:
            output.append(text[start:end_idx])
        i = end_idx
    return ''.join(output)


def main():
    POSTS_DST.mkdir(parents=True, exist_ok=True)
    for path in POSTS_SRC.glob('*.md'):
        if path.name == '_index.md':
            continue
        raw = path.read_text()
        frontmatter, body = parse_frontmatter(raw)
        slug = frontmatter.get('slug') or path.stem
        yaml = build_yaml(frontmatter)
        converted = convert_shortcodes(body, slug)
        final = f'{yaml}\n\n{IMPORTS}\n\n{converted.strip()}\n'
        (POSTS_DST / f'{path.stem}.mdx').write_text(final)

if __name__ == '__main__':
    main()
