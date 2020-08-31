# -*- coding:utf-8 -*-
import requests
from lxml import etree
import sys

def getfromBaidu(word):
    list=[]
    headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, compress',
        'Accept-Language': 'en-us;q=0.5,en;q=0.3',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:22.0) Gecko/20100101 Firefox/22.0'
        }
    baiduurl = 'http://www.baidu.com'
    url = 'https://mijisou.com/?q=' + word
    html = requests.get(url=url,headers=headers)
    path = etree.HTML(html.content)
    #用k来控制爬取的页码范围
    for k in range(1, 2):
        path = etree.HTML(requests.get(url, headers).content)
        flag = 11
        if k == 1:
            flag = 10
        for i in range(1, flag):
            sentence = ""
            for j in path.xpath('//*[@id="%d"]/h3/a//text()'%((k-1)*10+i)):
                sentence+=j
            print (sentence)
            list.append(sentence)
        url = baiduurl+path.xpath('//*[@id="page"]/a[%d]/@href'%flag)[0]
    return list
#主程序测试函数
if __name__ == '__main__':
    print (getfromBaidu('drug'))
    