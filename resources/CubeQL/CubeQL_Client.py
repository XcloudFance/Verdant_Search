from requests_html import requests
import demjson
class CubeQL:
    

    #host = 'localhost'
    def __init__(self,f):
        
        js = demjson.decode(f.read())
        f.close()
        self.host = js['CubeQL_Client']['host']
        self.port = js['CubeQL_Client']['port']
        pass
    def get(self):
        #print(self.host,self.port)
        req = requests.post('http://'+self.host+':'+self.port+'/get')

        return req.text
    def set(self,url,typ):
        hea = {'accept':'application/json'}
        req = requests.post('http://'+self.host+':'+self.port+'/set?url='+url+'&typ='+typ,hea)
    def filter_set(self,url):
        req = requests.post('http://'+self.host+':'+self.port+'/filter_set?url='+url,hea)
    def filter_contain(self,url):
        req = requests.post('http://'+self.host+':'+self.port+'/filter_contain?url='+url)
        return req.text
    def set_record(self,name,content,amount):
        req = requests.get('http://'+self.host+':'+self.port+'/set_record?name='+name+'&content='+content+'&amount='+amount)
        return req.text
    def get_record(self,name,amount):
        req = requests.get('http://'+self.host+':'+self.port+'/get_record?name='+name+'&amount='+amount)
        return req.text
    def del_all(self):
        pass
if __name__ == '__main__':
    cube = CubeQL()
    cube.set('http://www.baidu.com')
