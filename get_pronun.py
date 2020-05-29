# coding: UTF-8
from requests_html import requests
from maketoken import *
from bs4 import BeautifulSoup
hea = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Cookie": "AspxAutoDetectCookieSupport=1",
    #"Host": "jyj.quanzhou.gov.cn",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36"
}
def download_mp3(content : str):
    url="http://dict.youdao.com/dictvoice?type=0&audio="+content
    usatok = mktoken()
    uktok = mktoken()
    path="./music/"+usatok+".mp3"
    r = requests.get(url)

    with open(path,"wb") as f:
        f.write(r.content)
    f.close()
    url="http://dict.youdao.com/dictvoice?type=1&audio="+content
    path="./music/"+uktok+".mp3"
    r = requests.get(url)

    with open(path,"wb") as f:
        f.write(r.content)
    f.close()
    
    return usatok,uktok

def get_word_mean(word: str, ua: dict):
    content = word
    req = requests.post(
        "http://dict.youdao.com/search?q=" + content + "&keyfrom=new-fanyi.smartResult",
        ua,
    )
    bs = BeautifulSoup(req.text, "html.parser")
    try:
        keyword = bs.find(
            attrs={"id": "phrsListTab", "class": "trans-wrapper clearfix"}
        ).get_text()
    except:
        return get_sentence_mean(word,ua)
    key_list = keyword.split("\n")
    keyword = ""
    tmp = False
    for i in key_list:
        if i != "":
            if i == "[":
                tmp = True
                continue
            if i.find("]") != -1 and tmp == True:
                tmp = False
                continue
            if tmp == True:
                keyword += i.strip() + " "
            else:
                keyword += i.strip() + "\n"
    return keyword

def get_sentence_mean(word: str, ua: dict):
    content = word
    req = requests.post(
        "http://dict.youdao.com/search?q=" + content + "&keyfrom=new-fanyi.smartResult",
        ua,
    )
    bs = BeautifulSoup(req.text, "html.parser")
    keyword = bs.find(
        attrs={"class": "collapse-content"}
    ).get_text()   
    return keyword.strip()


if __name__ == '__main__':
    download_mp3('I am in school')
    get_word_mean('I am in school',hea)