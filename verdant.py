#搜索引擎部分
import pymysql
import fastapi
import demjson
from fastapi import FastAPI

from starlette.responses import Response
from starlette.requests import Request
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from cut import *

mysql = pymysql.connect(host='127.0.0.1',port = 3306,user='root',password = 'root',db='cylinder')
cursor = mysql.cursor()

def deal(keywords : list):
    ret = keywords[:]
    tmp1 = keywords
    for i in list(range(len(tmp1))):

        if tmp1[i] == ' ' or tmp1[i] == '+':
            ret.remove(tmp1[i])#用了一个特别骚的方法，直接删除index的话会导致for循环越界
    return ret

# -- fastapi initialization --
app = FastAPI(debug = True)
app.mount(
    "/static", StaticFiles(directory="static"), name="static"
)  # 重定向/static作为static目录的css/js获取路径
templates = Jinja2Templates(directory="templates")
@app.get('/')
async def index(request:Request):
    return templates.TemplateResponse("index.html", context={"request": request})

@app.get('/searchlist')
async def searchlist(request:Request):
    return templates.TemplateResponse("search_list.html", context={"request": request,'keyword':'233'})
@app.get('/search')
async def search(*,keyword,amount):
    if keyword == ' ':
        return {}
    amount = int(amount)
    end_amount = int(amount)+10

    cursor.execute('select value from search where keyer = %s',(keyword))
    ret = cursor.fetchone()
    
    response_json = {}
    #在pymysql中，fetchall取不到返回()，fetchone取不到就返回None
    if ret == None:
        #试试分词
        #对结果进行分词,同样也对有空格的结果进行分词
        res_ = deal(Cut(keyword))

        set_ = set({})
        tmp = 0
        for i in res_:
            cursor.execute('select value from search where keyer = %s',(i,))
            fetch = cursor.fetchone()
            if fetch == None:
                tmp = 1
                
                continue
            index_list = fetch[0].split('|')
            if end_amount > len(index_list):
                end_amount = len(index_list)
            if tmp == 0:
                set_ = set(index_list)
                tmp = 1
            else:
                set_ = set(index_list) & set_ #计算交集

        if set_ == set({}):#{}是空字典而不是空集合
            
            return {}
        set_ = list(set_) #转换成列表好操作
        index_list = set_[amount:end_amount]
        #取前几个
        length = len(index_list)
        tmp = 0
        for i in index_list:
            cursor.execute('select * from content where id = '+i)
            res = cursor.fetchone()
            tmp+=1
            
            response_json[tmp] = {
                'url':res[1],
                'detail':res[2],
                'title':res[3]
            }
        response_json['length'] = (length)
        #如果发现这个keyword内没有任何空格的前提下就将其作为关键词存入
        #并且现阶段结果太少，对于所有搜索的东西都会有一个爬虫从百度抓取数据然后将结果第一页爬虫下来，并且权值全部高加成
        return response_json

    else:
        index_list = ret[0].split('|')
        if end_amount > len(index_list):
            end_amount = len(index_list)
        index_list = index_list[amount:end_amount]
        #取前几个
        length = len(index_list)
        tmp = 0
        for i in index_list:
            cursor.execute('select * from content where id = '+i)
            res = cursor.fetchone()
            tmp+=1
            
            response_json[tmp] = {
                'url':res[1],
                'detail':res[2],
                'title':res[3]
            }
        response_json['length'] = (length)
        return response_json
