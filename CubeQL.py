from fastapi import FastAPI
app = FastAPI(debug=True)
cylinder = []
baidu_cylinder = []
templation = {'type':'','content':''}
#type有normal和search两种类型
limitation = 200
#baidu-cds的思路就是将关键词从百度获取要爬虫的消息，然后放进cds待爬虫队列里面爬虫，并且标注为baidu出来的网址，给每个权值+20分x
@app.post('/get')
async def get():
    global cylinder
    #默认丢四个地址回去，以防不够
    ret = []
    #如果内存过小的情况下，就自动将amount调大，limit调小
    amount = 4
    for i in range(amount):
        if cylinder != []:
            ret.append(cylinder.pop())
    return ret
    pass

@app.post('/set')
async def setting(*,url,typ):
    global cylinder
    if len(cylinder)>=limitation:
        return 
    cylinder.append({'type':typ,'content':url})
    #cylinder = list(set(cylinder))
    pass

@app.post('/del')
async def delete():
    cylinder = []
    return
@app.post('/baidu_get')
async def baiduget():
    global baidu_cylinder
    ret = []
    amount = 5
    for i in range(amount):
        if baidu_cylinder != []:
            ret.append(baidu_cylinder.pop())
    return ret
    pass

@app.post('/baidu_set')
async def baiduset(*,url):
    global baidu_cylinder
    if len(baidu_cylinder)>limitation:
        return
    baidu_cylinder.append(url)
    baidu_cylinder = list(set(baidu_cylinder))
    pass
@app.post('/baidu_del')
async def baidudel():
    baidu_cylinder = []
    pass
#port = 1278