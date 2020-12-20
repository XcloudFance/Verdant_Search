import time
from requests_html import requests
while True:
    time.sleep(2)
    requests.post('http://127.0.0.1:1278/save')