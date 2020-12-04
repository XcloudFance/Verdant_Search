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


@app.post('/set')
async def setting(*,url,typ):
    global cylinder
    if len(cylinder)>=limitation:
        return 
    cylinder.append({'typ':typ,'content':url})
    #cylinder = list(set(cylinder))
    pass

@app.post('/del')
async def delete():
    global cylinder
    cylinder = []
    return
@app.post('/just_get')
async def justget():
    global cylinder
    #默认丢四个地址回去，以防不够
    ret = []
    #如果内存过小的情况下，就自动将amount调大，limit调小
    amount = 4
    for i in range(amount):
        if i<len(cylinder):
            ret.append(cylinder[i])
    return ret
@app.post('/filter_set')
async def baiduset(*,url):
    global baidu_cylinder
    if len(baidu_cylinder)>limitation:
        return
    baidu_cylinder.append(url)
    baidu_cylinder = list(set(baidu_cylinder))
    pass
@app.post('/filter_get')
async def baidudel():
    baidu_cylinder = []
    pass
#port = 1278