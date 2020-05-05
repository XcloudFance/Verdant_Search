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
def sort_by_value(d):
    items=d.items()
    backitems=[[v[1],v[0]] for v in items]
    backitems.sort()
    return [ backitems[i][1] for i in range(0,len(backitems))]

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
        match_weigh = {}
        tmp_index_list = {}
        for i in res_:
            cursor.execute('select value from search where keyer = %s',(i,))
            fetch = cursor.fetchone()
            index_list = fetch[0].split('|')
            for j in index_list:
                if j in match_weigh:
                    match_weigh[j] += 1
                else:
                    match_weigh[j] = 1

        for i in match_weigh:
            cursor.execute('select weigh from content where id = '+i)#拿到权值
            tmp_index_list[i] = cursor.fetchone()[0] + match_weigh[i]
        index_list = sort_by_value(tmp_index_list)
        index_list.reverse()
            
        #取前几个
        #排序
        if end_amount > len(index_list):
            end_amount = len(index_list)
        index_list = index_list[amount:end_amount]
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
