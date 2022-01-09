import psycopg2
import time
import datetime 

class pssql_Handler:

    def __init__(self,host,port,root,password,database): #初始化数据库
        global pssql, cursor
        self.host = host
        self.port = port
        self.root = root
        self.password = password
        self.database = database
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
                
                self.cursor.execute('select id from content where id = 1;')
            except:
                print('pssql error!')
                self.pssql = psycopg2.connect(
                    host=self.host, port=int(self.port), user=self.root, password=self.password, database=self.database
                )
                self.cursor = self.pssql.cursor()
            return func(*args,**kwargs)
        return regular_checks

    def increaseURLWeight(self,website): #给对应的url权值+1

        try:
            self.cursor.execute("update content set weigh = weigh + 1 where url = %s", (website,))
            self.pssql.commit()
        except:
            self.pssql.rollback()

    def increaseKeywordWeight(self,keyword):#给对应的关键词权值+1
        try:
            self.cursor.execute(
                "update search set weigh = weigh + 1 where keyer = %s", (keyword,)
            )
            self.pssql.commit()
        except:
            self.pssql.rollback()
    def recordLog(self,content,nowdate):#记录每天的dailylog,记载访问记录
        try:
            self.cursor.execute("insert into daily_logs values('0',%s,%s);",(content,nowdate))
            self.pssql.commit()
        except:
            self.pssql.rollback()

    def queryKeywordDescendingSort(self,keyword):#逆序排联想关键词
        try:
            self.cursor.execute(
                "select keyer from search where keyer like %s order by weigh desc",
                (keyword + "%",),
            )
            return self.cursor.fetchall()
        except:
            self.pssql.rollback()
            return ""
            
    def queryKeyword(self,keyword):#查询关键词
        try:
            self.cursor.execute('select value from search where keyer ~* %s;', (keyword,))
        except:
            self.pssql.rollback()
            return ""
        return self.cursor.fetchall()
    def restrictedQueryKeyword(self,keyword):#查询关键词
        try:
            self.cursor.execute('select value from search where keyer = %s;', (keyword,))
        except:
            self.pssql.rollback()
            return ""
        return self.cursor.fetchall()
    def getKeywordWeight(self,keyword):#获得权值
        try:
            self.cursor.execute("select weigh from content where id = " + keyword)
        except:
            self.pssql.rollback()
            return ""
        return self.cursor.fetchone()
    def getRecordDetails(self,id):
        try:
            self.cursor.execute("select * from content where id = " + id)
        except:
            self.pssql.rollback()
            return ""
        return self.cursor.fetchone()

    def getKeywordTrend(self,keyword):#这边是青荇趋势的获取日期和对应的搜索权值
        try:
            self.cursor.execute("select timerange from daily_logs where content = %s",(keyword,))
            res = self.cursor.fetchall()
            ret = []
            tmp_dict = {}
            for i in res:
                date = str(i[0].year) + "-"+str(i[0].month)+ "-"+str(i[0].day)
                if date in tmp_dict:
                    tmp_dict[date] += 1
                else:
                    tmp_dict[date] = 1 
            for j in tmp_dict:
                ret.append([j,tmp_dict[j]])
            return ret
        except:
            self.pssql.rollback()
            return ""