#-*- coding:utf-8 -*-
#encoding:utf-8
import os
import sys
import urllib
import urllib.parse
import urllib.request
import re
from bs4 import BeautifulSoup
import jsonpage
def togbk(string):
    return string.encode('gbk')
def delcssjs(code):
    while(code.find("<style>")!=-1):
        code = code[code.find("<style>")+len("<style>"):code.find("</style>")]
    while (code.find("<script>") != -1):
        code = code[code.find("<script>") + len("<script>"):code.find("</script>")]
    while code.find('<script type="text/javascript">')!=-1:
        code = code[code.find('<script type="text/javascript">') + len('<script type="text/javascript">'):code.find("</script>")]
    return code
def gethtmurl(url):
       soup = BeautifulSoup(url,"html.parser")
       ret=[]
       href_ = soup.find_all(name='a')
       for each in href_:
           if str(each.get('href'))[:4]=='http':
               ret.append(each.get('href'))
       return ret
def get_content(url):
    bs = BeautifulSoup(url,'html.parser')
    [s.extract() for s in bs(['script','style'])]
    return bs.get_text().replace('\n','').replace('\xa0','')
dictlist={}
def mainly():
    #print(delcssjs("<style>2333</style>123"))
    headers = {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0'}
    url = "https://www.baidu.com/"
  #  req = urll:ib.request.Request(url=url, headers=headers)
    geturl=[url]
    #geturl = gethtmurl(url)
    #dictlist[url] = get_content(str(urllib.request.urlopen(req).read().decode('utf-8',"ignore")))
    length=0
    while geturl!=[]:
        tmplist=geturl
        geturl=[]
        #print(tmplist)
        #print(geturl)
        for i in tmplist:
            try:
                req = urllib.request.Request(url=i, headers=headers)
                if(i in dictlist):
                    continue
                if(i.find('.png')!=-1):
                    continue
                code = urllib.request.urlopen(req).read()
                geturls = gethtmurl(code)
                tmpcode = code
                count = 0
                while 1 and count <= 100:
                    count += 1
                    tmpcode = get_content(tmpcode)#.replace("\xa1","").replace('\u02d3',"").replace('\u0632',"")
                    if(code != tmpcode):
                      code = tmpcode
                    else:
                      break
                dictlist[i]= code #get_content(str(code.decode('utf-8',"ignore"))).replace("\xa1","").replace('\u02d3',"").replace('\u0632',"")
                geturl+=(geturls)
            except:
              print(i+" :error")
            try:
                print(dictlist)
            except:
                print("编码错误")
                dictlist.pop(i)
def test():
    print(jsonpage.js001)
if(__name__ == "__main__"):
    test()
    mainly()


