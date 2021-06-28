import psycopg2
import time

class pssql_Handler:

    def __init__(self,host,port,root,password,database): #初始化数据库
        global pssql, cursor
        self.pssql = psycopg2.connect(
            host=host, port=int(port), user=root, password=password, database=database
        )
        self.cursor = self.pssql.cursor()

        while False:
            try:
                pssql = psycopg2.connect(
                    host=host,
                    port=int(port),
                    user=root,
                    password=password,
                    database=database,
                )
            except:
                time.sleep(1) #如果延迟不到就无限死循环请求连接，直到成功
                continue
            break
    def postgresql_check_status(self,func): #功能未完成，这边本想检测pssql重连情况
        def regular_checks(*args,**kwargs):

            
            # print(1)
            try:
                self.cursor.execute("")
            except:
                print('pssql error!')
            return func(*args,**kwargs)
        return regular_checks

    def increaseURLWeight(self,website): #给对应的url权值+1
        self.cursor.execute("update content set weigh = weigh + 1 where url = %s", (website,))
        self.pssql.commit()

    def increaseKeywordWeight(self,keyword):#给对应的关键词权值+1
        self.cursor.execute(
            "update search set weigh = weigh + 1 where keyer = %s", (keyword,)
        )
        self.pssql.commit()
    def recordLog(self,content,nowdate):#记录每天的dailylog,记载访问记录
        self.cursor.execute("insert into daily_logs values('0','" + content + "','" + nowdate + "');")
        self.pssql.commit()

    def queryKeywordDescendingSort(self,keyword):#逆序排联想关键词
        self.cursor.execute(
            "select keyer from search where keyer like %s order by weigh desc",
            (keyword + "%",),
        )
        return self.cursor.fetchall()
    def queryKeyword(self,keyword):#查询关键词
        try:
            self.cursor.execute('select value from search where keyer ~* %s;', (keyword,))
        except:
            self.pssql.rollback()
            return ""
        return self.cursor.fetchall()
    def getKeywordWeight(self,keyword):#获得权值
        self.cursor.execute("select weigh from content where id = " + keyword)
        return self.cursor.fetchone()
    def getRecordDetails(self,id):
            self.cursor.execute("select * from content where id = " + id)
            return self.cursor.fetchone()