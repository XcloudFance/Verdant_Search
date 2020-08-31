#sorting.py functions
'''
这玩意儿用来搞数据库的排序，数据库需要动态排序
'''
import pymysql
mysql = pymysql.connect(
    host="localhost", port=3306, user="root", password="root", db="cylinder"
)
cursor = mysql.cursor()
keyword = ','
cursor.execute('select keyer from search')
keywords = cursor.fetchall()

for keyword in keywords:
    cursor.execute('select value from search where keyer = "'+keyword[0]+'"')
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