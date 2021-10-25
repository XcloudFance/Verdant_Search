#encoding:utf-8
import requests
from bs4 import BeautifulSoup

import re
import json,demjson

template = r'''
<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title></title>
    <style>
        * {
            margin: 0;
            padding: 0;
        }
        
        .ls {
            list-style: none;
            line-height: 1.5rem;
        }
        
        .dc {
            color: #009c0f;
            text-decoration: none;
        }
        
        .dc:hover {
            color: #007409;
        }
        
        .box {
            text-overflow: ellipsis;
            font-size: 16px;
            overflow: hidden;
            border: 1px solid rgba(0, 0, 0, 0.12);
            box-shadow: 1px 1px 1px rgb(0 0 0 / 23%);
            border-radius: 0.25rem;
            padding: 0.45rem;
        }
        
        #img1 {
            height: 200px;
        }
        
        .left {
            float: left;
            width: 50%;
            height: 98%;
        }
        
        .right {
            position: relative;
            overflow: hidden;
            left: 10px;
            width: 48%;
        }
    </style>

</head>

<body>
    <div class="box">
        <img class='left' src='imglink' id='img1' />
        <div class='right'>
            <div style="position: relative;">
                <h4>title</h4>
            </div>
            <div id="inputx" class="ls">
                content
            </div>

        </div>
    </div>
</body>
<script>
</script>

</html>

'''

def loads_jsonp(_jsonp):
    try:
        return json.loads(re.match(".*?({.*}).*",_jsonp,re.S).group(1))
    except:
        pass

res = requests.get('https://cre.dp.sina.cn/api/v3/get?cateid=m&mod=wtech&cre=tianyi&merge=3&statics=1&ad={%22rotate_count%22:20,%22page_url%22:%22http%3A%2F%2Fauto.sina.cn%22,%22channel%22:%22133919%22,%22platform%22:%22wap%22,%22timestamp%22:1515924404759}&length=20&up=3&down=0&action=1&_=1515924404760&callback=jsonp4')
res = loads_jsonp(res.text)
f = open('technews.json','w',encoding='utf-8')
content = []
for i in res['data']:
     
    wapurl = (i['wapurls'][0])
    title = i['title']
    intro = i['intro']
    pic = i['thumbs'][0]
    content.append({
        'url':wapurl,
        'title': title,
        'intro':intro,
        'pic':pic
    })   

template = template.replace('target',content[0]['url'])
template = template.replace('title',content[0]['title'])
template = template.replace('content',content[0]['intro'])
template = template.replace('imglink',content[0]['pic'])

f.write(demjson.encode(content))
print(content)
f.close() 

f = open('index.html','w')
f.write(template)
f.close()
print(wapurl)
print(title)
print(intro)
print(pic)