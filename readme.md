# verdant search
目前为了考虑后端的负载量，将搜索引擎的后端改成了flask
但是其临时存储结构CubeQL用了fastapi

## Key Feature

- 搜索引擎会自动从其他搜索引擎上寻找数据库缺失的搜索结果，自动更新
- 直接关联有道词典，查词更方便
- 搜索没有广告，界面更加简洁
- 无痕搜索，不会产生大数据杀熟
- 对csdn等博客网页实现去相似化，提高了搜索效率(coming)

## CubeQL

用于青荇搜索的临时存储结构，实现类似redis的功能，同时还能通过布隆过滤器模块来过滤已经爬虫过的网址，用作去重

**预计使用vlang进行速度优化**

## 0.1.1更新阶段
1. 实现了对数据库内关键词的网页动态排序
2. 将后端改成了flask，其他的仍然使用fastapi

## 0.1.2 更新
对分布式爬虫爬取的statuscode出现404仍然收录的问题进行优化  
增加了搜索结果网页排序和权值增加（重定向）

## 0.1.3 更新
- 对其他搜索引擎进行爬虫汇总
- 修复了一些bug
- 实现了bloomfilter布隆过滤器的实现，让筛选直接从mysql中脱离，接下来要实现mysql分库存储数据，减轻负担
- 并且实现了一个定时保存器
- 对其他搜索引擎的爬虫使用了selenium
## 0.1.4 更新 2020/01/30

- 增加了crisp API方便用户提交意见
- 实现了postgresql的转移（从mysql）
- 增加了对bing的结果爬虫（没实现）
- 解决了之前对搜素联想词的机制优化，现在只要输入一个新字符就会发送请求

- 修复了爬虫和cubeql的已知bug

  

## User-agent
Mozilla/5.0 (compatible;VerdantSpider/1.0)




## To-do
1. 增加一些必要的搜索引擎权值动态更新的功能
2. 实现中文->拼音的模糊搜索(需要建立新的映射表)
3. 实现分割数据库存储
4. 转换为postgresql
5. 统计每次搜索的细节，方便总结
6. 添加cubeql实现的分布式锁
7. 实现搜单词保存在云端，服务器不需要多次爬虫
8. 实现点击音量图标后再爬虫音频
9. 实现vlang代替大部分python功能，优化性能
10. 实现每日搜索热点
11. 实现各种搜索引擎的智能汇总
12. 扩大数据库
13. 用容器管理环境，实现一键部署和一键运行

14. 对搜索的每个单条索引进行寿命周期，过一段阵子就会降低权值（需要新的程序来维护）
15. 实现simhash，实现csdn等博客类网站的去重

16. 支持多样化搜索，更人性化的筛选器



## Environment

python >= 3.6

flask

fastapi==0.54.1

postgresql == 11.10 

psycopg2

starlette

requests_html

jieba

demjson

asyncio



##### 迁移postgresql遇到的问题

1. postgresql只支持单引号来包含字符串
2. 用户名和mysql不一样
3. postgresql有模式，但是不需要注意sql修改，因为会自动指向public模式

------



#### 使用方法

##### 目录结构

├─.vscode  
├─docs  
├─resources  
│  ├─config  
│  ├─CubeQL  
│  │  └─__pycache__  
│  ├─lib  
│  ├─Spider  
│  │  └─__pycache __ 
│  ├─static  
│  │  ├─css  
│  │  ├─img  
│  │  └─music  
│  ├─templates  
│  └─__pycache __  
└─sql   

docs : 定期存放文档

resources ：源码存放目录

config：配置文件json的备用存放目录（真正调用在根目录，目前尚未完成对目录结构的优化

CubeQL：存放CubeQL相关源码的目录

Spider：存放爬虫的目录

lib：存放requirements

static：存放静态文件

templates：存放模板文件

sql：存放备用的建表sql文件



backend.py - 搜素引擎后端文件

config.json - 配置文件，只有在运行代码的根目录的json文件才生效



运行步骤

修改config.json的数据库账号密码和ip

确保postgresql是开着的

在CubeQL目录下运行

uvicorn CubeQL:app --port 1278

在resources目录下运行

python backend.py

在spider目录下运行（不运行也可以打开青荇搜索）

python CDS-Distributed.py



