# -*- coding:utf-8 -*-
# 搜索引擎部分
from gevent import monkey
from gevent.pywsgi import WSGIServer

monkey.patch_all()
import pymysql

## -- postgresql  --
import psycopg2

import demjson
import json
from starlette.responses import Response
from starlette.requests import Request
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from cut import *
import time
import re
from requests_html import requests
from get_pronun import *
import asyncio
import CubeQL_Client

# flask定义
import flask
from flask import render_template, request, redirect

app = flask.Flask(__name__, template_folder="./templates", static_url_path="")
app.jinja_env.auto_reload = True
# flask end
# -- read config --
f = open("config.json", "r")
js = demjson.decode(f.read())
f.close()
host = js["Main"]["host"]
port = js["Main"]["port"]
root = js["Main"]["root"]
password = js["Main"]["password"]
database = js["Main"]["db"]
# -- end of read config --

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
mysql, cursor = None, None


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


def sort_by_value(d):
    items = d.items()
    backitems = [[v[1], v[0]] for v in items]
    backitems.sort()
    return [backitems[i][1] for i in range(0, len(backitems))]


def deal(keywords: list):
    ret = keywords[:]
    tmp1 = keywords
    for i in list(range(len(tmp1))):

        if tmp1[i] == " " or tmp1[i] == "+":
            ret.remove(tmp1[i])  # 用了一个特别骚的方法，直接删除index的话会导致for循环越界
    return ret


def deal2(website: str):
    return "/redirect?_=" + website


def reping():
    return

    global mysql, cursor
    # print(1)
    try:
        mysql.ping(reconnect=True)
        cursor.execute("")
    except:
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


def specfic_search(word):  # 如果啥也没有就返回False，如果有就返回搜索后的结果
    try:

        re_list = ["([a-z]|[A-Z]|\s){1,}翻译", "([a-z]|[A-Z]|\s){1,}", "(.*)的英语"]
        mode = -1
        tmp = -1
        cmpres = ""
        for i in re_list:

            cmp = re.compile(i)
            cmpres = re.match(cmp, word)
            tmp += 1
            if cmpres != None:
                print(cmpres)
                mode = tmp
                break
        if mode == -1:
            # print(-1)
            return False
            # try
        # print(mode)
        # print(cmpres)
        content = cmpres.group()
        # print(content)
        if mode == 1:
            content = content[: len(content)]
        if mode == 0:
            content = content[: len(content) - 2]
        if mode == 2:
            content = content[: len(content) - 3]
        # print(content)
        req = requests.get(
            "http://fanyi.youdao.com/translate?&doctype=json&type=AUTO&i=" + content
        )

        ret = get_word_mean(content, hea_ordinary)
        ret_url = (
            "http://dict.youdao.com/search?q="
            + content
            + "&keyfrom=new-fanyi.smartResult"
        )
        return ret, ret_url, mode
    except:
        return False


@app.route("/")
def index():
    return render_template("index2.html")


@app.route("/searchlist")
def searchlist():
    return render_template("search_list.html")


@app.route("/search", methods=["GET"])
def search():

    amount = request.args.get("amount")
    keyword = request.args.get("keyword")
    print(keyword)
    reping()
    if keyword == " ":
        return {}
    amount = int(amount)
    end_amount = int(amount) + 10
    length = 0
    cursor.execute("select value from search where keyer = %s;", (keyword,))
    ret = cursor.fetchone()

    response_json = {}
    # 在pymysql中，fetchall取不到返回()，fetchone取不到就返回None

    specialsearch = specfic_search(keyword)
    # print(specialsearch)

    if specialsearch != False:  # 单词翻译查询
        if specialsearch[2] == 0 or specialsearch[2] == 1:
            # maybe，这个地方需要重做，因为每次搜索一个单词就需要去爬虫一次，或者用一个特别大的库去存特定单词的音也不是不行
            usatok, uktok = download_mp3(keyword)
            response_json["1"] = {
                "type": "translation",
                "url": specialsearch[1],
                "detail": specialsearch[0],
                "title": keyword + "_有道翻译",
                "music_USA": usatok,
                "music_UK": uktok,
            }
        elif specialsearch[2] == 2:
            response_json["1"] = {
                "type": "translation",
                "url": specialsearch[1],
                "detail": specialsearch[0],
                "title": keyword + "_有道翻译",
            }
        length += 1
        pass
    if ret == None:
        # 试试分词
        # 对结果进行分词,同样也对有空格的结果进行分词
        res_ = deal(Cut(keyword))
        match_weigh = {}
        tmp_index_list = {}
        for i in res_:
            cursor.execute("select value from search where keyer = %s", (i,))
            fetch = cursor.fetchone()
            if fetch == None:
                continue
            index_list = fetch[0].split("|")
            for j in index_list:
                if j in match_weigh:
                    match_weigh[j] += 10
                else:
                    match_weigh[j] = 1

        for i in match_weigh:
            cursor.execute("select weigh from content where id = " + i)  # 拿到权值
            tmp_index_list[i] = cursor.fetchone()[0] + match_weigh[i]
        index_list = sort_by_value(tmp_index_list)
        index_list.reverse()

        # 取前几个
        # 排序
        if end_amount > len(index_list):
            end_amount = len(index_list)
        index_list = index_list[amount:end_amount]

        for i in index_list:
            cursor.execute("select * from content where id = " + i)
            res = cursor.fetchone()

            length += 1
            response_json[length] = {
                "url": deal2(res[1]),
                "detail": res[2],
                "title": res[3],
                "type": "normal",
            }
        response_json["length"] = length
        # 如果发现这个keyword内没有任何空格的前提下就将其作为关键词存入
        # 并且现阶段结果太少，对于所有搜索的东西都会有一个爬虫从百度抓取数据然后将结果第一页爬虫下来，并且权值全部高加成
        if length <= 10:
            # 开始对百度进行爬虫，给CDS布置任务
            print(length)
            cube = CubeQL_Client.CubeQL()
            cube.set(keyword, "search")
        # 这边获得的结果可以变成一个新的关键词，并且加2分关键词基础分
        if length != 0:
            pass
        # print(demjson.encode(response_json))
        return json.dumps(response_json)

    else:
        # 新增关键词权值统计
        cursor.execute(
            "update search set weigh = weigh + 1 where keyer = %s", (keyword,)
        )
        mysql.commit()
        index_list = ret[0].split("|")
        if end_amount > len(index_list):
            end_amount = len(index_list)
        index_list = index_list[amount:end_amount]
        # 取前几个

        for i in index_list:
            cursor.execute("select * from content where id = " + i)
            res = cursor.fetchone()
            length += 1

            response_json[length] = {
                "url": deal2(res[1]),
                "detail": res[2],
                "title": res[3],
            }
        response_json["length"] = length
        if length <= 10:
            # 开始对百度进行爬虫，给CDS布置任务
            print(length)
            cube = CubeQL_Client.CubeQL()
            cube.set(keyword, "search")

        return json.dumps(response_json)


@app.route("/keyword_think", methods=["GET"])
def thinking():
    reping()
    keyword = str(request.args.get("keyword"))
    limited = 7
    step = 0
    cursor.execute(
        "select keyer from search where keyer like %s order by weigh desc",
        (keyword + "%",),
    )
    # desc为逆序排序，like就是匹配字符串的前缀
    ret = []
    for i in cursor.fetchall():
        step += 1
        if step == limited:
            break

        ret.append(i[0])
    return demjson.encode(ret)


@app.route("/redirect", methods=["GET"])
def redirected():
    reping()
    website = str(request.args.get("_"))  # 获取网址
    # 数据库操作
    print(website)
    #这地方有问题，如果重定向了一个数据库都没有的网页，那不就tm出事了，所以这边得采取更成熟的行为
    cursor.execute("update content set weigh = weigh + 1 where url = %s", (website,))
    mysql.commit()
    return redirect(website)


# 可能需要防SQL注入，因为每一个点都是通过直接连接sql的,可能需要base64


@app.route("/getwebsite", methods=["GET"])
def getsite():
    pass


if __name__ == "__main__":
    # mysql_initation()
    postgresql_initation()
    http_server = WSGIServer(("0.0.0.0", 8888), app)
    http_server.serve_forever()
