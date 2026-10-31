"""Turn dist/ into an artifact page fragment (dist/page.html) and print the files map."""
import re, glob, os, json
h = open('dist/index.html').read()
js = re.search(r'src="\./assets/([^"]+\.js)"', h).group(1); css = re.search(r'href="\./assets/([^"]+\.css)"', h).group(1)
body = re.search(r'<body>(.*?)</body>', h, re.S).group(1)
open('dist/page.html', 'w').write(f'''<title>FAB: The Bulge</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="assets/{css}">
{body}<script type="module" src="assets/{js}"></script>
''')
files = {f'assets/{js}': f'web/dist/assets/{js}', f'assets/{css}': f'web/dist/assets/{css}', 'map.jpg': 'web/dist/map.jpg', 'map-vector.svg': 'web/dist/map-vector.svg'}
files.update({'chit/' + os.path.basename(f): 'web/' + f for f in sorted(glob.glob('dist/chit/*'))})
files.update({'blocks/' + os.path.basename(f): 'web/' + f for f in sorted(glob.glob('dist/blocks/*.png'))})
print(json.dumps(files))
