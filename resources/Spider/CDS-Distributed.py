# -*- coding:utf-8 -*-
# encoding:utf-8
# 此版本为CDS(Custom Distrbuted Spider)版本，支持一键直接爬虫
# 用redis+mysql实现
import os
import sys
import urllib
import urllib.parse
import urllib.request
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
import CubeQL_Client
import threading
import psycopg2
from CDS_Selenium import *

cube = CubeQL_Client.CubeQL()

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
    "Connection": "keep-alive",
    "Cookie": "AspxAutoDetectCookieSupport=1",
    # "Host": "jyj.quanzhou.gov.cn",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36",
}

# -- read config --
f = open("./../config.json", "r")  # 取上一级的config.json
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


def gethtmurl(url):
    soup = BeautifulSoup(url, "html.parser")
    ret = []
    href_ = soup.find_all(name="a")
    for each in href_:
        if str(each.get("href"))[:4] == "http":
            ret.append(each.get("href"))
    return ret


def get_content(urlcode):
    bs = BeautifulSoup(urlcode, "html.parser")
    [s.extract() for s in bs(["script", "style"])]
    return bs.get_text().replace("\n", "").replace("\xa0", "")


def get_title(urlcode):
    bs = BeautifulSoup(urlcode, "lxml")
    ret = bs.title.get_text()
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


dictlist = {}


def getsearchurl(keyword):
    url = requests.get(
        "http://mijisou.com/?q="
        + keyword
        + "&category_general=on&time_range=&language=zh-CN&pageno=1",
        hea_ordinary,
    ).text
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

    geturl = demjson.decode(cube.get())
    length = 0
    print(geturl)
    while True:
        if geturl == []:
            geturl = demjson.decode(cube.get())

            continue
        tmplist = geturl
        geturl = []

        for i in tmplist:
            #try:
                if i == []:
                    continue

                if i["typ"] == "normal":
                    destination_URI = simplify(i["content"])

                    # 用来判断这个url有没有被爬过，通过cubeql里面的filter
                    if cube.filter_contain(destination_URI) == "1":
                        continue

                    req = requests.get(destination_URI, hea)
                    req.encoding = req.apparent_encoding  # 这是个坑，每个网站都有不同的编码机制
                    if req.apparent_encoding.find("ISO") != -1:
                        req.encoding = "utf-8"
                    if destination_URI in dictlist:
                        continue
                    if destination_URI.find(".png") != -1:
                        continue
                    if req.status_code != 200:  # 0.12内容，如果网页不返回200，就不载入数据库
                        continue
                    code = req.text  # urllib.request.urlopen(req).read()
                    geturls = gethtmurl(code)
                    # 取body做为内容
                    maincontent = get_keywords(code) + " " + get_p_content(code)
                    title = get_title(code)
                    dictlist[
                        destination_URI
                    ] = maincontent  # get_content(str(code.decode('utf-8',"ignore"))).replace("\xa1","").replace('\u02d3',"").replace('\u0632',"")
                    for url_ in geturls:
                        # print(url_)
                        cube.set(url_, typ="normal")

                    geturl = demjson.decode(cube.get())
                    # 将geturls内的内容发到CubeQL
                    wordlist = list(set(Cut(maincontent) + Cut(title)))
                    cursor.execute("select count(*) as value from content")
                    my_weigh = weigh_judgement(destination_URI, code)  # 把权值保存到变量，一会儿要用
                    tablenum = str(cursor.fetchone()[0])  # 这边就是直接获取content表中到底有多少行了
                    cursor.execute(
                        "insert into content values ("
                        + tablenum
                        + ",%s,%s,%s,"
                        + str(my_weigh)
                        + ")",
                        (destination_URI, dictlist[destination_URI], title),
                    )

                    mysql.commit()
                    cube.filter_set(destination_URI)  # 插入过滤器
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
                            for k in range(len(index_list)):
                                # 取出每个地址的权值
                                # print('select weigh from content where id = '+index_list[k])
                                cursor.execute(
                                    "select weigh from content where id = " + index_list[k]
                                )
                                the_weigh = cursor.fetchone()[0]  # 取出此时要被比较的权值
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
                            tmp_list = list(set(index_list))
                            tmp_list.sort(key=index_list.index)
                            index_list = tmp_list
                            for k in range(len(index_list)):
                                if k == 0:
                                    index_list_ = index_list[k]
                                else:
                                    index_list_ += "|" + index_list[k]

                            # -- sort --
                            cursor.execute(
                                "update search set value = %s where keyer = %s",
                                (index_list_, j),
                            )
                            # --update
                    mysql.commit()
                    print(destination_URI, " :end")
                # ---------------------------------------------
                elif i["typ"] == "search":
                    destination_URI = i["content"]
                    mijisou(destination_URI)
                    print(destination_URI, " :end")
                elif i["typ"] == "fromsearch":
                    destination_URI = simplify(i["content"])
                    
                    # 用来判断这个url有没有被爬过，通过cubeql里面的filter
                    if cube.filter_contain(destination_URI) == "1":
                        continue

                    req = requests.get(destination_URI, hea)
                    req.encoding = req.apparent_encoding
                    if req.apparent_encoding.find("ISO") != -1:
                        req.encoding = "utf-8"
                    if destination_URI in dictlist:
                        continue
                    if destination_URI.find(".png") != -1:
                        continue
                    if req.status_code != 200:  # 0.12内容，如果网页不返回200，就不载入数据库
                        continue
                    code = req.text  # urllib.request.urlopen(req).read()
                    geturls = gethtmurl(code)
                    # 取body做为内容
                    maincontent = get_keywords(code) + " " + get_p_content(code)
                    title = get_title(code)
                    dictlist[destination_URI] = maincontent
                    for url_ in geturls:
                        cube.set(url_, typ="fromsearch")

                    geturl = demjson.decode(cube.get())
                    # 将geturls内的内容发到CubeQL
                    wordlist = list(set(Cut(maincontent) + Cut(title)))
                    cursor.execute("select count(*) as value from content")
                    my_weigh = (
                        weigh_judgement(destination_URI, code) + 20
                    )  # 这里和上面不同，因为这个是从搜索引擎出来的，所以分数有加成
                    tablenum = str(cursor.fetchone()[0])
                    cursor.execute(
                        "insert into content values ("
                        + tablenum
                        + ",%s,%s,%s,"
                        + str(my_weigh)
                        + ")",
                        (destination_URI, dictlist[destination_URI], title),
                    )
                    mysql.commit()
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
                            for k in range(len(index_list)):
                                # 取出每个地址的权值
                                # print('select weigh from content where id = '+index_list[k])
                                cursor.execute(
                                    "select weigh from content where id = " + index_list[k]
                                )
                                the_weigh = cursor.fetchone()[0]  # 取出此时要被比较的权值
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
                            tmp_list = list(set(index_list))
                            tmp_list.sort(key=index_list.index)
                            index_list = tmp_list
                            for k in range(len(index_list)):
                                if k == 0:
                                    index_list_ = index_list[k]
                                else:
                                    index_list_ += "|" + index_list[k]

                            # -- sort --
                            cursor.execute(
                                "update search set value = %s where keyer = %s",
                                (index_list_, j),
                            )
                            # --update
                    mysql.commit()
                    print(destination_URI, " :end")
            #except:
            #    print(destination_URI, " :error")

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
