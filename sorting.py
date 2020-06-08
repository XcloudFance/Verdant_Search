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
cursor.execute('select value from search where keyer = "'+keyword+'"')
tmp_list = {}
index_list = cursor.fetchone()[0].split('|')
print(index_list)
for k in range(len(index_list)):
    # 取出每个地址的权值
    # print('select weigh from content where id = '+index_list[k])
    cursor.execute(
        "select weigh from content where id = " + index_list[k]
    )
    tmp_list[index_list[k]] = int(cursor.fetchone()[0])

# 然后再生成一次字符串表
# 不能去重，会被set改顺序
print(tmp_list)

f =  sorted(tmp_list.items(), key=lambda x: x[1])
index_list_ = [i[0] for i in f]
print(index_list_)
ret = ''
for i in range(len(index_list_)):
    if i != len(index_list_)-1:
        ret += index_list_[i]+'|'
    else:
        ret += index_list_[i]
cursor.execute("update search set value = %s where keyer = %s",(ret, keyword),)
mysql.commit()
#print(i, " :end")