#-*- coding:utf-8 -*-
#encoding = utf-8
from requests_html import requests
import demjson
from bs4 import BeautifulSoup
hea_ordinary = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Cookie": "AspxAutoDetectCookieSupport=1",
    "Host": "jyj.quanzhou.gov.cn",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36"
}
def getsearchurl(url):
    soup = BeautifulSoup(url, "html.parser")
    ret = []
    href_ = soup.find_all(name="a")
    #print(href_)
    for each in href_:
        #print(each.get('rel'))
        if each.get("rel") == ["noopener" ,"noreferrer"]:
            if each.get('href').find('mijisou.com')==-1:
                ret.append(each.get("href"))
    return ret
def mainly():
    #直接从CubeQL里面提取baiduCDS的内容，然后放进cylinder的爬虫队列内
    req = requests.post('/get')
    que = demjson.decode(req.text)
    while que != []:
        word = que.pop()
        urllist = []
        a = gethtmurl(requests.get('http://baidu.com/s?wd='+word).text)
        print(a)
        requests.post('/set?url = ',que.pop())
        if que == []:
            req = requests.post('/baidu_get')
            que = demjson.decode(req.text)
        
    
if __name__ == '__main__':
    #mainly()
    word='Linux'
    print(gethtmurl(requests.get('https://mijisou.com/?q='+word+'&category_general=on&time_range=&language=zh-CN&pageno=1',hea_ordinary).text))
    #print(gethtmurl(requests.get('https://mijisou.com/?q='+word,hea_ordinary).text))