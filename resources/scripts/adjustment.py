#要对每一个重复//的数据进行处理，处理后如果出现问题，就直接ban掉
import time,datetime,demjson
import psycopg2

# -- read config --
f = open("./config/config.json", "r")
js = demjson.decode(f.read())
f.close()
host = js["Main"]["host"]
port = js["Main"]["port"]
root = js["Main"]["root"]
password = js["Main"]["password"]
database = js["Main"]["db"]
mysql = psycopg2.connect(
        host=host, port=int(port), user=root, password=password, database=database
)
cursor = mysql.cursor()
table = {}
def cope_del_symbol(str1: str):
    newstr = str1
    while newstr[8:].find('//')!=-1:
        newstr = newstr[:8] + newstr[8:].replace('//','/')
    return newstr
cursor.execute('update content set banned = False')
#如果有相同标题的，直接删除
for i in range(2500,3000):
    cursor.execute('select * from content where id = ' + str(i))
    content = list(cursor.fetchone())
    title = content[2]
    url = content[1]
    if title in table:
        content[-1] = True
    else:
        table[title] = 1
    copestr = cope_del_symbol(content[1])
    if content[1] != copestr:
        content[1] = copestr
    try:
        cursor.execute('update content set url = %s , banned =  '+str(content[-1])+' where id = ' +str(content[0]),(content[1],))
    except:
        mysql.rollback()
        cursor.execute('update content set banned = True where id = ' +str(content[0]))
    mysql.commit()
