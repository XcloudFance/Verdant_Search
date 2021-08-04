from fastapi import FastAPI
from pybloom_live import ScalableBloomFilter, BloomFilter
bloom = ScalableBloomFilter(initial_capacity=1000)
from multiprocessing import Process #用多进程
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
    if url in bloom:
        print('bloom filter responsed!')
        return #直接在这边加过滤器
    cylinder.insert(0,{'typ':typ,'content':url})
    bloom.add(url)
    bloom.add("https://"+url)
    bloom.add("http://"+url)
    
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
            ret.insert(0,cylinder[i])
    return ret
@app.post('/filter_set')
async def baiduset(*,url):
    bloom.add(url)


@app.post('/filter_contain')
async def baidudel(*,url):
    
    if url in bloom:
        return '1'
    else:
        return '0'

@app.get('/save')
async def save():
    f = open('bloom_temp.bin','wb')
    bloom.tofile(f)
    f.close()
    return '{}'
@app.get('/read')
async def read():
    f = open('bloom_temp.bin','rb')
    bloom = bloom.fromfile(f)
    f.close()
    return '{}'

#port = 1278

#这边最新版本实现了一个分布式锁，依然存在内存中，savetimer会定期备份分布式锁的内存，防止出事，对内存要求更高了
@app.get('/sqlget')
async def sqlget():
    
    pass

