#sorting.py functions
'''
这玩意儿用来搞数据库的排序，数据库需要动态排序
'''
import time,datetime,demjson

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
import psycopg2

while True:
    Datetmp =  datetime.datetime.strftime( datetime.datetime.now(),'%d')
    Hour = datetime.datetime.strftime( datetime.datetime.now(),'%H')
    Minu = datetime.datetime.strftime( datetime.datetime.now(),'%M')
    daterun = 0
    #if Hour!='2' or Minu!='0' or daterun==Datetmp:
        #这一段就相当于时间要到达，且当日还会执行就要重新排序内容
    #    continue
    daterun = Datetmp
    
    mysql = psycopg2.connect(
            host=host, port=int(port), user=root, password=password, database=database
    )
    cursor = mysql.cursor()

    #keyword = ','
    cursor.execute('select keyer from search')
    keywords = cursor.fetchall()

    for keyword in keywords:
        #print(keyword[0])
        cursor.execute('select value from search where keyer = %s;',(keyword[0],))
        tmp_list = {}
        index_list = cursor.fetchone()[0].split('|')
        for k in range(len(index_list)):
            # 取出每个地址的权值
            # print('select weigh from content where id = '+index_list[k])
            cursor.execute(
                "select weigh from content where id = " + index_list[k]
            )
            tmp_list[index_list[k]] = int(cursor.fetchone()[0]) #这边是用一个字典将关键词里面的地址序号和他们的权值对应起来，下面进行排序

        # 然后再生成一次字符串表
        # 不能去重，会被set改顺序


        f =  sorted(tmp_list.items(), key=lambda x: x[1])
        index_list_ = [i[0] for i in f]
        index_list_ = list(reversed(index_list_)) #搜索引擎要的是逆序的结果
        ret = ''
        for i in range(len(index_list_)):
            if i != len(index_list_)-1:
                ret += index_list_[i]+'|'
            else:
                ret += index_list_[i]
        cursor.execute("update search set value = %s where keyer = %s",(ret, keyword[0]),)
    mysql.commit()
        #print(i, " :end") 
    break