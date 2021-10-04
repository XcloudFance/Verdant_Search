import requests
from bs4 import BeautifulSoup
res = requests.get('https://news.sina.com.cn/world/')
res.encoding = 'utf-8'#设置编码格式为utf-8
soup = BeautifulSoup(res.text, 'html.parser')#前面已经介绍将html文档格式化为一个树形结构，每个节点都是一个对python对象，方便获取节点内容
for new in soup.select('.news-item'):#BeautifulSoup提供的方法通过select选择想要的html节点类名，标签等，获取到的内容会被放到列表中
    if len(new.select('h2')) > 0:
        #加[0]是因为select获取内容后是放在list列表中[内容,],text可以获取标签中的内容
        print new.select('.time')[0].text+' '+new.select('h2')[0].text +' '+ new.select('a')[0]['href'] 