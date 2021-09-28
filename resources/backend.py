# -*- coding:utf-8 -*-
# 搜索引擎部分
__version__ = "0.3.1"
from sys import version
from gevent import monkey
from gevent.pywsgi import WSGIServer

# monkey.patch_all()
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
import datetime

# flask定义
import flask
from flask import render_template, request, redirect, send_from_directory
from pssqlHandler import *
import os

app = flask.Flask(__name__, template_folder="./templates", static_url_path="")
app.jinja_env.auto_reload = True
# flask end

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

page_Count: int = 0
js = {}
host = port = password = database = root = extensions_path = ""
extensions_config = {}


def Get_Config():
    global host, port, root, password, database, js, extensions_path, extensions_config
    # -- read config --
    f = open("config.json", "r")
    js = demjson.decode(f.read())
    f.close()
    host = js["Main"]["host"]
    port = js["Main"]["port"]
    root = js["Main"]["root"]
    password = js["Main"]["password"]
    database = js["Main"]["db"]
    extensions_path = js["Main"]["extensions"]
    paths = os.listdir(extensions_path)
    print("Initializing the extension system...")
    for i in paths:
        f = open(extensions_path + "/" + i + "/package.json", "r+")
        content = f.read()
        f.close()
        extensions_config[i] = demjson.decode(content)
        if not os.path.exists(extensions_path + "/" + i + "/index.html"):
            os.system("git clone " + extensions_config[i]["respositary"])
            # if the project is not completed, fork it from github
        for j in extensions_config[i]["command"]:
            os.system(j)
    print("Finished")

    # -- end of read config --


Get_Config()
databaseHandler = pssql_Handler(host, port, root, password, database)


def ordered_set(old_list):  # 有序去重
    new_list = list(set(old_list))
    new_list.sort(key=old_list.index)
    return new_list


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
        content = cmpres.group()
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


@app.route("/return_count", methods=["GET"])
def return_count():
    return page_Count


def prefix_zero(content):
    if content < 10:
        return "0" + str(content)


def record_log(content):

    now = datetime.datetime.now()
    datenow = str(now.year) + "-" + str(now.month) + "-" + str(now.day)
    # print(datenow)

    databaseHandler.recordLog(content, datenow)


@app.route("/search", endpoint="search", methods=["GET"])
@databaseHandler.postgresql_check_status
def search():
    # -- everytime searching, record the history--
    global page_Count
    page_Count += 1
    amount = request.args.get("amount")
    keyword = request.args.get("keyword")
    record_log(keyword) #加入记录系统
    print(keyword)
    if keyword == " ":
        return {}
    # == extension search ==
    
    # == extension search end ==

    amount = int(amount)
    end_amount = int(amount) + 10
    length = 0
    res = databaseHandler.queryKeyword(keyword)

    fetch = []
    for j in res:
        # print(j)
        fetch += j[0].split("|")  # 因为这里面只出现一个结果

    index_list = ordered_set(fetch)

    response_json = {}
    ifsearch = False
    # 在pymysql中，fetchall取不到返回()，fetchone取不到就返回None
    if amount == 0:
        # 0.1.5:这边增加了一个特判，只有在第一页的时候才会触发翻译
        ifsearch = specfic_search(keyword)
        # print(ifsearch)

    if ifsearch != False and js["Main"]["Whether_Translation"] == 1:  # 单词翻译查询
        if ifsearch[2] == 0 or ifsearch[2] == 1:
            # 或者，加一个多线程的思想，这边直接交给协程做，做好了用await等待加载完
            usatok, uktok = download_mp3(keyword)
            response_json["1"] = {
                "type": "translation",
                "url": ifsearch[1],
                "detail": ifsearch[0],
                "title": keyword + "_有道翻译",
                "music_USA": usatok,
                "music_UK": uktok,
            }
        elif ifsearch[2] == 2:
            response_json["1"] = {
                "type": "translation",
                "url": ifsearch[1],
                "detail": ifsearch[0],
                "title": keyword + "_有道翻译",
            }
        length += 1
        pass

    if index_list == []:
        # 试试分词
        # 对结果进行分词,同样也对有空格的结果进行分词
        # 这边出现了bug，原因是因为~*的postgresql操作符所出现的问题 2021/3/2
        res_ = deal(Cut(keyword))
        # print(res_)
        match_weigh = {}
        tmp_index_list = {}
        for i in res_:

            res = databaseHandler.queryKeyword(i)
            # print(res)
            if res == []:
                continue
            fetch = []
            for j in res:
                fetch += j[0].split("|")
            index_list = ordered_set(fetch)
            for j in index_list:  # 这边match_weigh里面每一项对应tf*idf的权值加成，关键词匹配度越高，排名越前
                if j in match_weigh:
                    match_weigh[j] += 10
                else:
                    match_weigh[j] = 1

        for i in match_weigh:
            res = databaseHandler.getKeywordWeight(i)
            tmp_index_list[i] = res[0] + match_weigh[i]
        index_list = sort_by_value(tmp_index_list)
        index_list.reverse()
        # 取前几个
        # 排序
        if end_amount > len(index_list):
            end_amount = len(index_list)
        index_list = index_list[amount:end_amount]
        # print(index_list)
        for i in index_list:
            res = databaseHandler.getRecordDetails(i)
            length += 1
            response_json[length] = {
                "url": deal2(res[1]),
                "detail": res[2][:300],
                "title": res[3],
            }
        response_json["length"] = length
        # 如果发现这个keyword内没有任何空格的前提下就将其作为关键词存入
        # 并且现阶段结果太少，对于所有搜索的东西都会有一个爬虫从百度抓取数据然后将结果第一页爬虫下来，并且权值全部高加成
        if length <= 10 and amount == 0:
            # 开始对百度进行爬虫，给CDS布置任务rrrr
            cube = CubeQL_Client.CubeQL()
            cube.set(keyword, "search")
        # 这边获得的结果可以变成一个新的关键词，并且加2分关键词基础分
        if length != 0:
            pass
        # print(demjson.encode(response_json))
        return json.dumps(response_json)

    else:
        if end_amount > len(index_list):
            end_amount = len(index_list)
        index_list = index_list[amount:end_amount]
        # 新增关键词权值统计
        databaseHandler.increaseKeywordWeight(keyword)
        # 取前几个

        for i in index_list:

            databaseHandler.cursor.execute("select * from content where id = " + i)
            res = databaseHandler.cursor.fetchone()
            length += 1

            response_json[length] = {
                "url": deal2(res[1]),
                "detail": res[2][:300],  # 限制字数
                "title": res[3],
            }
        response_json["length"] = length
        if length <= 10:
            # 开始对百度进行爬虫，给CDS布置任务
            # print(length)
            cube = CubeQL_Client.CubeQL()
            cube.set(keyword, "search")

        return json.dumps(response_json)


@app.route("/keyword_think", endpoint="thinking", methods=["GET"])
@databaseHandler.postgresql_check_status
def thinking():
    keyword = str(request.args.get("keyword"))
    limited = 7
    step = 0

    # desc为逆序排序，like就是匹配字符串的前缀
    ret = []
    for i in databaseHandler.queryKeywordDescendingSort(keyword):
        step += 1
        if step == limited:
            break
        ret.append(i[0])
    # print(ret)
    return demjson.encode(ret)


@app.route("/get_today_data", methods=["GET", "POST"])
def get_today_data():
    if request.method == "GET":
        return render_template("qs.html")
    else:
        ret = {"Code": "200", "Data": []}
        keyword = request.json.get("keyword")
        for i in keyword:
            ret["Data"].append(databaseHandler.getKeywordTrend(i))

        print(keyword, type(keyword))
        return ret
        # cursor.execute("select * from where content = '"+keyword+"' and timerange>='"+time_begin+"' and timerange<='"+"'") #获取时间段
        # res = cursor.fetchall()
        # print(res)


@app.route("/trend", methods=["GET"])
def trend():
    return render_template("qs.html")


@app.route("/redirect", endpoint="redirected", methods=["GET"])
@databaseHandler.postgresql_check_status
def redirected():
    website = str(request.args.get("_"))  # 获取网址
    # 数据库操作
    # print(website)
    # 这地方有问题，重定向了一个数据库都没有的网页，所以这边得采取更成熟的行为
    databaseHandler.increaseURLWeight(website)
    return redirect(website)


# 可能需要防SQL注入，因为每一个点都是通过直接连接sql的,可能需要base64


@app.route("/extensions", endpoint="extensions", methods=["GET"])
def extensions():
    try:
        extension_name = request.args.get("name")
        return send_from_directory("./extensions/" + extension_name, "index.html")
    except Exception as e:
        return str(e)


@app.route("/pure_visit", endpoint="pure_visit", methods=["GET"])
def purevisit():
    URL = request.args.get("target")
    print(URL)


if __name__ == "__main__":
    # mysql_initation()
    # jieba.enable_parallel(4)
    print(
        "=================== Welcome to use Verdant_Search Engine Backend! ================="
    )
    print("Your now version : ", __version__)
    print("Python version : ", version)
    print(
        "if you get some troubles during using, please contact me in my Github: https://github.com/XCloudFance"
    )
    http_server = WSGIServer(("0.0.0.0", 7777), app)

    http_server.serve_forever()
