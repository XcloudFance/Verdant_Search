import psycopg2
import time

class pssql_Handler:

    def __init__(self,host,port,root,password,database):
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
    def postgresql_check_status(self,func):
        def regular_checks(*args,**kwargs):

            
            # print(1)
            try:
                self.cursor.execute("")
            except:
                print('pssql error!')
            return func(*args,**kwargs)
        return regular_checks

    def increaseURLWeight(self,website):
        self.cursor.execute("update content set weigh = weigh + 1 where url = %s", (website,))
        self.pssql.commit()

    def increaseKeywordWeight(self,keyword):
        self.cursor.execute(
            "update search set weigh = weigh + 1 where keyer = %s", (keyword,)
        )
        self.pssql.commit()
    def recordLog(self,content,nowdate):
        self.cursor.execute("insert into daily_logs values('0','" + content + "','" + nowdate + "');")
        self.pssql.commit()

    def queryKeywordDescendingSort(self,keyword):
        self.cursor.execute(
            "select keyer from search where keyer like %s order by weigh desc",
            (keyword + "%",),
        )
        return self.cursor.fetchall()
    def queryKeyword(self,keyword):
        self.cursor.execute("select value from search where keyer ~* %s;", (keyword,))
        return self.cursor.fetchall()
    def getKeywordWeight(self,keyword):
        self.cursor.execute("select weigh from content where id = " + i)  # 拿到权值
        return self.cursor.fetchone()