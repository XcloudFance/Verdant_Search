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
                exit(0)
            return func(*args,**kwargs)
        return regular_checks
    def Accumulate_weight(Target_Word):
        self.cursor.execute("update content set weigh = weigh + 1 where url = %s", (website,))
        self.pssql.commit()
        