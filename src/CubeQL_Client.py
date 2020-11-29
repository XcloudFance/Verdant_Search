from requests_html import requests
import demjson
class CubeQL:
    

    #host = 'localhost'
    def __init__(self):
        f = open('config.json','r')
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
        params = {'url':url}
        hea = {'accept':'application/json'}
        req = requests.post('http://'+self.host+':'+self.port+'/set?url='+url+'&typ='+typ,hea)

    def del_all(self):
        pass
if __name__ == '__main__':
    cube = CubeQL()
    cube.set('http://www.baidu.com')