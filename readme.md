# verdant search
青荇搜索是一个用python+mysql实现的搜索引擎，目前还没有任何的优化233，就单纯为了实现搜索功能  
后期可能为了搜索增加redis优化  

## 0.1.1更新阶段
1. 实现了对数据库内关键词的网页动态排序
2. 将后端改成了flask，其他的仍然使用fastapi


## User-agent
Mozilla/5.0 (compatible;VerdantSpider/1.0)

## 结构介绍
Sorting.py 排序代码，直接运行就可
verdant_flask.py 最核心的代码，也是直接运行就可
运行之前先确保开启了mysql
sql文件可以私下找我要


## 接下来要增加的内容
1. 增加一些必要的搜索引擎权值动态更新的功能
2. 实现中文->拼音的模糊搜索
3. 对其他搜索引擎进行内容收入
4. 实现分布式爬虫（开发到一半）

