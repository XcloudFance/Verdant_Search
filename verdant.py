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

        return {}
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
