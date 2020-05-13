from fastapi import FastAPI
app = FastAPI(debug=True)
cylinder = []
limitation = 200
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
    print(ret)
    return ret
    pass

@app.post('/set')
async def setting(*,url):
    global cylinder
    if len(cylinder)>=limitation:
        return 
    cylinder.append(url)
    cylinder = list(set(cylinder))
    pass

@app.post('/del')
async def delete():
    cylinder = []
    return

#port = 1278