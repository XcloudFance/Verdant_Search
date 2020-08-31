import fastapi
from fastapi import FastAPI
from gevent import monkey
from gevent.pywsgi import WSGIServer
import flask
import time
monkey.patch_all()
app = flask.Flask(__name__,static_url_path='',template_folder='templates')
app.jinja_env.auto_reload = True
app.config['TEMPLATES_AUTO_RELOAD'] = True
@app.route('/test1')
async def retail():
    time.sleep(10)
    return '0'
@app.route('/test2')
def test2():
    return '1'

http_server = WSGIServer(('0.0.0.0', 8888), app)
http_server.serve_forever()

