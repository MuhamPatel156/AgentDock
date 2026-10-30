import {starter} from './core.mjs';
import {reactTemplate} from './templates.mjs';
import {PYTHON_PACKAGES} from './environments.mjs';

const pythonStatic=String.raw`
ROOT = Path(__file__).resolve().parent

def asset_path(name):
    root = (ROOT / 'dist' if (ROOT / 'dist').is_dir() else ROOT).resolve()
    if name not in {'index.html', 'styles.css', 'app.js'} and not name.startswith('assets/'):
        raise ValueError('Not found')
    target = (root / name).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise ValueError('Not found')
    if name.startswith('assets/') and (not target.is_relative_to((root / 'assets').resolve()) or target.suffix not in {'.js', '.css', '.svg', '.json'}):
        raise ValueError('Not found')
    return target

def health():
    return {'ok': True, 'service': SERVICE}

def echo_message(value):
    if not isinstance(value, str) or len(value) > 200:
        raise ValueError('Use a message of at most 200 characters.')
    return {'message': value}
`;
const stdlibApp=String.raw`import json
import mimetypes
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
SERVICE = 'python-stdlib'
`+pythonStatic+String.raw`
class Handler(BaseHTTPRequestHandler):
    def reply(self, status, value):
        body = json.dumps(value).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        route = unquote(urlsplit(self.path).path)
        if route == '/api/health':
            return self.reply(200, health())
        try:
            target = asset_path('index.html' if route == '/' else route.lstrip('/'))
            body = target.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(str(target))[0] or 'application/octet-stream')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ValueError, OSError):
            self.reply(404, {'error': 'Not found'})

    def do_POST(self):
        if urlsplit(self.path).path != '/api/echo':
            return self.reply(404, {'error': 'Not found'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 0 or length > 2048:
                return self.reply(413, {'error': 'Body limit'})
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Use a JSON object.')
            self.reply(200, echo_message(data.get('message')))
        except (ValueError, TypeError):
            self.reply(400, {'error': 'Use a JSON message up to 200 characters.'})

    def log_message(self, *_args):
        pass

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '4182'))
    print('Python backend: http://127.0.0.1:' + str(port), flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
`;
const flaskApp=String.raw`import os
from pathlib import Path
from flask import Flask, jsonify, request, send_file
SERVICE = 'python-flask'
`+pythonStatic+String.raw`
app = Flask(__name__, static_folder=None)
app.config['MAX_CONTENT_LENGTH'] = 2048

@app.get('/api/health')
def health_route():
    return jsonify(health())

@app.post('/api/echo')
def echo_route():
    try:
        data = request.get_json(silent=True)
        return jsonify(echo_message(data.get('message') if isinstance(data, dict) else None))
    except ValueError as error:
        return jsonify(error=str(error)), 400

@app.get('/')
def index():
    return send_file(asset_path('index.html'))

@app.get('/<path:name>')
def asset(name):
    try:
        return send_file(asset_path(name))
    except ValueError:
        return jsonify(error='Not found'), 404

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '4182')), debug=False, use_reloader=False)
`;
const fastapiApp=String.raw`import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import uvicorn
SERVICE = 'python-fastapi'
`+pythonStatic+String.raw`
app = FastAPI(docs_url=None, redoc_url=None)

class EchoBody(BaseModel):
    message: str = Field(max_length=200)

@app.get('/api/health')
def health_route():
    return health()

@app.post('/api/echo')
def echo_route(body: EchoBody):
    return echo_message(body.message)

@app.get('/')
def index():
    return FileResponse(asset_path('index.html'))

@app.get('/{name:path}')
def asset(name: str):
    try:
        return FileResponse(asset_path(name))
    except ValueError:
        raise HTTPException(status_code=404, detail='Not found')

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=int(os.environ.get('PORT', '4182')), log_level='info')
`;
const pythonTests=String.raw`import unittest
from app import health, echo_message

class ApplicationTests(unittest.TestCase):
    def test_health(self):
        self.assertTrue(health()['ok'])
        self.assertTrue(health()['service'].startswith('python-'))

    def test_echo(self):
        self.assertEqual(echo_message('hello'), {'message': 'hello'})

    def test_oversized_input(self):
        with self.assertRaises(ValueError):
            echo_message('x' * 201)
`;
export function pythonTemplate(flavor='stdlib'){
 if(!['stdlib','flask','fastapi','script','notebook'].includes(flavor))throw Error('Unsupported Python starter.');
 if(flavor==='script')return pythonScriptTemplate();
 if(flavor==='notebook')return pythonNotebookTemplate();
 const files=starter(),service='python-'+flavor;
 files['index.html']='<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Python application</title><link rel="stylesheet" href="styles.css"></head><body><main><span class="eyebrow">PYTHON DEVELOPMENT</span><h1>A Python backend.<br>A working application.</h1><p>Start this backend in Runtime, then test its API here.</p><button id="backend-check">Check Python backend</button><p id="backend-status">Not checked</p><section><h2>Try a JSON request</h2><label for="echo-input">Message</label><input id="echo-input" maxlength="200" value="hello"><button id="echo-send">Send message</button><p id="echo-status"></p></section></main><script src="app.js"></script></body></html>';
 files['app.js']=`document.querySelector('#backend-check').addEventListener('click',async()=>{try{const response=await fetch('/api/health');if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();document.querySelector('#backend-status').textContent=data.service;}catch(error){document.querySelector('#backend-status').textContent='Start a Python live backend in Runtime. '+error.message;}});\ndocument.querySelector('#echo-send').addEventListener('click',async()=>{try{const response=await fetch('/api/echo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:document.querySelector('#echo-input').value})});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();document.querySelector('#echo-status').textContent=data.message;}catch(error){document.querySelector('#echo-status').textContent=error.message;}});\n`;
 files['app.py']={stdlib:stdlibApp,flask:flaskApp,fastapi:fastapiApp}[flavor];
 files['test_app.py']=pythonTests;
 files['requirements.txt']=flavor==='stdlib'?'':flavor==='flask'?`Flask==${PYTHON_PACKAGES.flask}\n`:`fastapi==${PYTHON_PACKAGES.fastapi}\nuvicorn==${PYTHON_PACKAGES.uvicorn}\n`;
 files['agentdock.runtime.json']=JSON.stringify({language:'python',entry:'app.py',kind:'web',port:3000,build:false},null,2);
 files['agentdock.tests.json']=JSON.stringify({steps:[{action:'exists',selector:'h1'},{action:'exists',selector:'#backend-check'}]},null,2);
 files['agentdock.live-tests.json']=JSON.stringify({steps:[{action:'click',selector:'#backend-check'},{action:'wait-text',selector:'#backend-status',contains:service,timeout:5000},{action:'input',selector:'#echo-input',value:'hello'},{action:'click',selector:'#echo-send'},{action:'wait-text',selector:'#echo-status',contains:'hello',timeout:5000}]},null,2);
 files['README.md']='# Python '+flavor+' application\n\nIn Studio: Runtime > Python syntax, Python unittest (or pytest), then Start current backend. The owner rebuilds the trusted image once; project jobs use its curated packages offline. Run browser checks from the live preview to verify GET and POST API calls.\n\nOn your own laptop: use Python 3.11+, create a virtual environment, install requirements.txt if needed, and run python app.py. Open http://127.0.0.1:4182. Run python -m unittest discover -p "test_*.py".\n\nThis is a local starter. Add authentication, a reviewed production server/deployment, monitoring and persistent storage as needed before public hosting. No platform keys are passed to this app.\n';
 return files;
}
export function pythonScriptTemplate(){
 return {
  'index.html':'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Python data utility</title></head><body><h1>Python data utility</h1><p>Edit main.py and data.csv. Open Runtime, approve execution, then choose Run Python script. Inspect its JSON output there.</p></body></html>',
  'main.py':String.raw`import csv
import json
from pathlib import Path
from statistics import mean

def summarize(values):
    if not values:
        raise ValueError('Provide at least one value.')
    return {'count': len(values), 'min': min(values), 'max': max(values), 'mean': mean(values)}

if __name__ == '__main__':
    with Path(__file__).with_name('data.csv').open(newline='', encoding='utf-8') as file:
        values = [float(row['value']) for row in csv.DictReader(file)]
    print(json.dumps(summarize(values), indent=2))
`,
  'test_main.py':String.raw`import unittest
from main import summarize

class SummaryTests(unittest.TestCase):
    def test_summary(self):
        self.assertEqual(summarize([1, 2, 3, 4]), {'count': 4, 'min': 1, 'max': 4, 'mean': 2.5})

    def test_empty(self):
        with self.assertRaises(ValueError):
            summarize([])
`,
  'data.csv':'value\n1\n2\n3\n4\n','requirements.txt':'',
  'agentdock.runtime.json':JSON.stringify({language:'python',entry:'main.py',kind:'script',port:3000,build:false},null,2),
  'agentdock.tests.json':JSON.stringify({steps:[{action:'exists',selector:'h1'}]},null,2),
  'README.md':'# Python data utility\n\nRuntime supports Python syntax, unittest, pytest and Run Python script. Use Start current backend for web projects. The data utility uses only the standard library. Outside Studio, run python main.py or python -m unittest discover -p "test_*.py". Output files/state inside a Studio job are temporary; source edits and source export are preserved separately.\n'
 };
}
export function reactPythonTemplate(){
 const files=reactTemplate(),python=pythonTemplate('flask');delete files['server.mjs'];delete files['server.test.mjs'];
 for(const name of ['app.py','test_app.py','requirements.txt'])files[name]=python[name];
 files['agentdock.runtime.json']=JSON.stringify({language:'python',entry:'app.py',kind:'web',port:3000,build:true},null,2);
 files['agentdock.live-tests.json']=JSON.stringify({steps:[{action:'click',selector:'#backend-check'},{action:'wait-text',selector:'#backend-status',contains:'python-flask',timeout:5000}]},null,2);
 const pkg=JSON.parse(files['package.json']);pkg.scripts.start='python app.py';pkg.scripts.test='python -m unittest discover -p "test_*.py"';files['package.json']=JSON.stringify(pkg,null,2);
 files['README.md']='# React + Python Flask\n\nRuntime > Start current backend builds React, then serves the frontend and API with Python. Python syntax and unittest/pytest are separate approved jobs.\n\nOutside Studio: install package.json and requirements.txt dependencies in local environments, run npm run build, then python app.py. Open http://127.0.0.1:4182. Add production authentication/hosting/monitoring before publishing.\n';
 return files;
}

export function pythonNotebookTemplate(){
 return {
  'index.html': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>ML & Data Science Environment</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <main class="container">\n    <span class="eyebrow">ML & DATA SCIENCE NOTEBOOK</span>\n    <h1>Linear Regression & Dataset Analysis</h1>\n    <p>Run <code>main.py</code> in the isolated Python environment to compute metrics and model parameters.</p>\n    <div class="metrics-grid">\n      <div class="metric-card"><small>SAMPLES</small><strong id="m-count">10</strong></div>\n      <div class="metric-card"><small>CORRELATION (R)</small><strong id="m-r">0.99</strong></div>\n      <div class="metric-card"><small>SLOPE (m)</small><strong id="m-slope">2.41</strong></div>\n      <div class="metric-card"><small>INTERCEPT (b)</small><strong id="m-intercept">5.12</strong></div>\n    </div>\n    <section class="chart-section">\n      <h2>Interactive Prediction</h2>\n      <div class="predict-row">\n        <label>Input Feature X: <input type="number" id="input-x" value="10" step="1"></label>\n        <button id="btn-predict" class="btn">Predict Y</button>\n      </div>\n      <p id="pred-result">Predicted Y: <strong>29.22</strong></p>\n    </section>\n  </main>\n  <script src="app.js"></script>\n</body>\n</html>',
  'styles.css': 'body { font-family: system-ui, sans-serif; background: #f7f9f4; color: #233e31; margin: 0; padding: 40px 20px; }\n.container { max-width: 800px; margin: 0 auto; }\n.eyebrow { font-size: 10px; letter-spacing: 1.5px; color: #6b8574; font-weight: 700; }\nh1 { font-size: 32px; letter-spacing: -1px; margin: 10px 0 16px; }\np { color: #5a7262; line-height: 1.7; }\n.metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 25px 0; }\n.metric-card { background: #fff; border: 1px solid #dce4d6; border-radius: 8px; padding: 16px; text-align: center; }\n.metric-card small { display: block; font-size: 9px; color: #7f9584; margin-bottom: 4px; }\n.metric-card strong { font-size: 20px; color: #23543d; }\n.chart-section { background: #fff; border: 1px solid #dce4d6; border-radius: 8px; padding: 24px; margin-top: 20px; }\n.predict-row { display: flex; gap: 12px; align-items: center; margin: 16px 0; }\n.predict-row input { padding: 8px 12px; border: 1px solid #c9d8c4; border-radius: 6px; font-size: 14px; }\n.btn { background: #245944; color: #fff; border: none; padding: 9px 18px; border-radius: 6px; cursor: pointer; font-weight: 600; }\n#pred-result { font-size: 16px; color: #23543d; margin-top: 12px; }',
  'app.js': "document.querySelector('#btn-predict').addEventListener('click', () => {\n  const x = parseFloat(document.querySelector('#input-x').value) || 0;\n  const slope = 2.41, intercept = 5.12;\n  const y = (x * slope + intercept).toFixed(2);\n  document.querySelector('#pred-result').innerHTML = 'Predicted Y: <strong>' + y + '</strong> (fitted linear regression)';\n});",
  'main.py': 'import csv\nimport json\nimport math\nfrom pathlib import Path\nfrom statistics import mean\n\ndef linear_regression(xs, ys):\n    if len(xs) != len(ys) or len(xs) < 2:\n        raise ValueError("Requires at least 2 data points.")\n    x_bar = mean(xs)\n    y_bar = mean(ys)\n    ss_xy = sum((x - x_bar) * (y - y_bar) for x, y in zip(xs, ys))\n    ss_xx = sum((x - x_bar) ** 2 for x in xs)\n    ss_yy = sum((y - y_bar) ** 2 for y in ys)\n    if ss_xx == 0:\n        raise ValueError("Variance in X must be non-zero.")\n    slope = ss_xy / ss_xx\n    intercept = y_bar - slope * x_bar\n    r = ss_xy / math.sqrt(ss_xx * ss_yy) if ss_yy > 0 else 0\n    return {"count": len(xs), "slope": round(slope, 4), "intercept": round(intercept, 4), "r_squared": round(r ** 2, 4)}\n\nif __name__ == "__main__":\n    data_file = Path(__file__).with_name("data.csv")\n    xs, ys = [], []\n    with open(data_file, newline="", encoding="utf-8") as f:\n        for row in csv.DictReader(f):\n            xs.append(float(row["x"]))\n            ys.append(float(row["y"]))\n    print(json.dumps(linear_regression(xs, ys), indent=2))\n',
  'data.csv': 'x,y\n1.0,7.5\n2.0,10.1\n3.0,12.2\n4.0,14.9\n5.0,17.0\n6.0,19.8\n7.0,21.9\n8.0,24.5\n9.0,26.8\n10.0,29.3\n',
  'test_main.py': 'import unittest\nfrom main import linear_regression\n\nclass RegressionTests(unittest.TestCase):\n    def test_line(self):\n        res = linear_regression([1, 2, 3], [2, 4, 6])\n        self.assertEqual(res["slope"], 2.0)\n        self.assertEqual(res["intercept"], 0.0)\n    def test_empty(self):\n        with self.assertRaises(ValueError):\n            linear_regression([], [])\n',
  'requirements.txt': '',
  'agentdock.runtime.json': JSON.stringify({language:'python',entry:'main.py',kind:'script',port:3000,build:false}, null, 2),
  'agentdock.tests.json': JSON.stringify({steps:[{action:'exists',selector:'h1'},{action:'exists',selector:'#btn-predict'},{action:'click',selector:'#btn-predict'}]}, null, 2),
  'README.md': '# ML & Data Science Environment\n\nIsolated Python ML and statistical data analysis environment with zero external dependencies.\n'
 };
}
