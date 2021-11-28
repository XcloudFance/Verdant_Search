# -*- coding:utf-8 -*-
# encoding:utf-8
# 此版本为CDS(Custom Distrbuted Spider)版本，支持一键直接爬虫
# 用redis+postgresql实现
import os

import urllib
import urllib.parse
import urllib.request
from bs4.builder import TreeBuilderRegistry
from numpy import maximum
import requests
import re
from bs4 import BeautifulSoup
from cut import *
import pymysql
import socket, socketserver
import threading
import demjson
import json
import random
import redis
import sys
sys.path.append('..')
from CubeQL import CubeQL_Client
import threading
import psycopg2
from CDS_Selenium import *
import time
from urllib.parse import urlparse

cube = CubeQL_Client.CubeQL(open('../config/config.json','r'))
mode = 'released'
hea_ordinary = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Cookie": "AspxAutoDetectCookieSupport=1",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36",
}
hea = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Connection": "close",
    "Cookie": "AspxAutoDetectCookieSupport=1",
    # "Host": "jyj.quanzhou.gov.cn",
    "Pragma": "no-cache",
    
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36",
}

cube = CubeQL_Client.CubeQL(open('../config/config.json','r'))

# -- read config --
f = open("./../config/config.json", "r")  # 取上一级的config.json
js = demjson.decode(f.read())
f.close()
host = js["Spider"]["host"]
port = js["Spider"]["port"]
root = js["Spider"]["root"]
password = js["Spider"]["password"]
database = js["Spider"]["db"]
# -- end of read config --
mysql,cursor = None,None
#-- mysql --
def mysql_initation():  # 保证一定可以连到数据库
    global mysql, cursor
    while True:
        try:
            mysql = pymysql.connect(
                host=host, port=int(port), user=root, password=password, db=database
            )
        except:
            time.sleep(1)
            continue
        break
    cursor = mysql.cursor()

def  cope_del_symbol(str1: str):
    newstr = str1
    while newstr[8:].find('//')!=-1:
        newstr = newstr[:8] + newstr[8:].replace('//','/')
    return newstr

# -- postgres --
def postgresql_initation():  # 这边是postgres的版本
    global mysql, cursor
    mysql = psycopg2.connect(
        host=host, port=int(port), user=root, password=password, database=database
    )
    cursor = mysql.cursor()

    while False:
        try:
            mysql = psycopg2.connect(
                host=host,
                port=int(port),
                user=root,
                password=password,
                database=database,
            )
        except:
            time.sleep(1)
            continue
        break
    # cursor = mysql.cursor()

# -- end postgres -- 
def togbk(string):
    return string.encode("gbk")

def get_url_code(url):
    driver = webdriver.Chrome(chrome_options=chrome_options)
    
    driver.get(url)

    return driver.page_source



def delcssjs(code):
    while code.find("<style>") != -1:
        code = code[code.find("<style>") + len("<style>") : code.find("</style>")]
    while code.find("<script>") != -1:
        code = code[code.find("<script>") + len("<script>") : code.find("</script>")]
    while code.find('<script type="text/javascript">') != -1:
        code = code[
            code.find('<script type="text/javascript">')
            + len('<script type="text/javascript">') : code.find("</script>")
        ]
    return code


def get_url(url,origin):
    soup = BeautifulSoup(url, "html.parser")
    ret = []
    href_ = soup.find_all(name="a")
    for each in href_:
        
        if str(each.get("href"))[:4] == "http":
            ret.append(each.get("href"))
        else:
            try:      
                ret.append('http://'+urlparse(origin).netloc+'/'+each.get('href'))
            except:
                continue
    return ret


def get_content(urlcode):
    bs = BeautifulSoup(urlcode, "html.parser")
    [s.extract() for s in bs(["script", "style"])]
    return bs.get_text().replace("\n", "").replace("\xa0", "")


def get_title(urlcode):
    bs = BeautifulSoup(urlcode, "lxml")
    try:
        ret = bs.title.get_text()
    except:
        return ""
    if ret == "":
        title = bs.findAll(name="meta")
        for i in title:
            if str(i.get("property")) == "og:title":
                ret = i.get("content")
                break
    return ret


def get_p_content(urlcode):
    bs = BeautifulSoup(urlcode, "lxml")
    ret = ""
    for i in bs(["p"]):
        ret += i.get_text() + " "
    for i in bs(['a']):
        ret += i.get_text()+ " "
    return ret


def get_keywords(urlcode):
    bs = BeautifulSoup(urlcode, "lxml")
    ret = ""
    keyword = ""
    description = ""
    try:
        keyword = bs.find(attrs={"name": "keywords"})["content"]
    except:
        pass
    try:
        description = bs.find(attrs={"name": "description"})["content"]
    except:
        pass
    ret = keyword + description
    return ret


def weigh_judgement(url, urlcode):
    weigh = 10
    weigh_json = {}
    f = open("./weigh.json", "r+")
    weigh_json = demjson.decode(f.read())
    f.close()
    # print(weigh_json)
    for i in weigh_json:
        if url.find(i) != -1:
            weigh += int(weigh_json[i])
    weigh_json = {}
    f = open("./profession.json", "r+")
    weigh_json = demjson.decode(f.read())
    f.close()
    for i in weigh_json:
        if url == i:
            weigh += int(weigh_json[i])
    weigh += random.randint(1, 4)
    # 判断是否为主页
    slide = len(url.split("/"))
    if slide > 10:
        slide = 10
    weigh += 10 - slide
    return weigh



def getsearchurl(keyword):
    url = get_url_code(
        "http://mijisou.com/?q="
        + keyword
        + "&category_general=on&time_range=&language=zh-CN&pageno=1",
        hea_ordinary,
    )
    print(url)
    soup = BeautifulSoup(url, "html.parser")
    ret = []
    href_ = soup.find_all(name="span")
    # print(href_)
    for each in href_:
        # print(each.get('rel'))
        if each.get("class") == ["url"]:  # ["noopener", "noreferrer"]:
            print(each.text)

    return ret


def simplify(url):
    while True:
        if url[len(url) - 1] == "/":
            url = url[: len(url) - 1]
        else:
            break
    if url[:5] == "https":
        url = url[:4] + url[5:]
    return url[:]


def mainly():
    global cube
    #这一部分就开始做更新处理了，更新处理就是将数据库的记录拿出来再次爬取一次，然后对结果进行更新处理
    #然后进行一个段的处理方式
    cursor.execute('select id,url,detail from content ORDER BY "id" DESC LIMIT 1000 OFFSET 1000') #从倒数1000个开始数1000个数字
    res = cursor.fetchall()
    for i in res:
        try:
            code = get_url_code(i[1])
        except:
            print(i[1],":error")
            cursor.execute('update content set bannned = True where id = ' +str(i[0]))
            mysql.commit()
            continue
        geturls = list(set(get_url(code,i[1])))#获取该页面的所有子链接

        maincontent = get_keywords(code) + " " + get_p_content(code)
        title = get_title(code)
        if maincontent != i[2]:
            print('something is updated')
            cursor.execute('update content set detail = %s where id = '+str(i[0]),(maincontent,))
            mysql.commit()
            #--
            if title.strip() == "": #过滤掉没有标题的内容9(filter sites that don't have its titles)
                continue
            for url_ in geturls:
                # print(url_)
                url_ = cope_del_symbol(url_) #去除多余的/
                #爬虫不爬政府网站
                if url_.find('beian.gov')!=-1:
                    continue

                if not(url_.find('bing.com')!=-1 and url_.find('?q')!=-1):
                    cube.set(url_, typ="normal") #往cubeql里面加已经获取到的URI
                else:
                    cube.set(url_,typ="search_url")
            

            wordlist = list(set(Cut(maincontent) + Cut(title)))
            cursor.execute("select count(*) as value from content")
            my_weigh = weigh_judgement(i[1], code)  # 把权值保存到变量，一会儿要用
                
            tablenum = str(cursor.fetchone()[0])  # 这边就是直接获取content表中到底有多少行了

            # 在插入之前要先对这个网址进行权值判定，并且在判定完加入关键词的时候要进行排序，或者减少并发量，在夜晚的时候提交mysql表单好像也不是不行，但是这样做很麻烦
            # 此时就要添加关键词进去了，采取的方案是，如果有实现预留的关键词，就在里面的原先内容中添加，如果没有，就新建一个数据项
            # 判断这个关键词存不存在
            
            for j in wordlist:
                cursor.execute("select value from search where keyer = %s", (j,))
                index = cursor.fetchone()
                # print(index)
                if index == None:
                    cursor.execute(
                        "insert into search values(%s,%s,0)", (j, tablenum)
                    )

                else:
                    # -- sort --
                    # 如果没有就得对其进行排序，从头搜到尾，用降序的形式实现这序列
                    # 首先先将原序列变成一个列表才方便操作
                    index_list = index[0].split("|")
                    # print(index_list)
                    index_list = [x for x in index_list if x != ""]
                    time_start = time.time()
                    for k in range(len(index_list)):
                        # 取出每个地址的权值
                        # print('select weigh from content where id = '+index_list[k])
                        cursor.execute(
                            "select weigh from content where id = " + index_list[k]
                        )
                        try:
                            the_weigh = cursor.fetchone()[0]  # 取出此时要被比较的权值
                        except:
                            the_weigh = 0
                        if my_weigh >= the_weigh:
                            index_list.insert(k, tablenum)
                            break
                        elif k == len(index_list) - 1:
                            index_list.insert(k + 1, tablenum)
                            index_list = [x for x in index_list if x != ""]
                            break
                            # 如果没有比自己小的值就放在最后面

                    # 然后再生成一次字符串表
                    # 不能去重，会被set改顺序
                    time_end = time.time()
                    if mode == 'debug':
                        print(time_end-time_start)
                    tmp_list = list(set(index_list))
                    tmp_list.sort(key=index_list.index)
                    index_list = tmp_list
                    for k in range(len(index_list)):
                        if k == 0:
                            index_list_ = index_list[k]
                        else:
                            index_list_ += "|" + index_list[k]

                    # -- sort --
                    
                    times = 0
                    while times <= 20:
                        try:
                            cursor.execute(
                                "update search set value = %s where keyer = %s",
                                (index_list_, j),
                            )
                            
                            # --update
                            break
                        except:
                            times += 1
                            mysql.rollback()
            mysql.commit()
            print(i[1], " :end")
            # ---------------------------------------------

            #--
        else:
            print(i[1],'ok')


    print(res)
if __name__ == "__main__":
    print("Start!")
    # req =  requests.get('http://poi.ac', hea)
    # code = req.text
    # get_p_content(code)

    # cursor.execute('TRUNCATE TABLE search;')
    # cursor.execute('TRUNCATE TABLE content;')
    # mysql.commit()
    postgresql_initation()
    mainly()
    # print(getsearchurl('due'))
    # print(simplify('https://baidu.com//'))
    # 直接不用redis了，直接用我自己写的数据库
    print("End!")